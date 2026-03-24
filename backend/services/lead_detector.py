"""
services/lead_detector.py

Lead creation fires ONLY when the AI emits <!--ORDER_CONFIRMED-->.

That means this module is called once per confirmed order, not on every message.
It looks back through the full conversation history to extract the structured
order details (name, phone, address, product) that were collected during the chat.
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from models import SalesLead, User

logger = logging.getLogger(__name__)

_EXTRACTION_PROMPT = """
You are an order-detail extraction agent.

You will be given a conversation between a customer and a sales bot.
The order has already been confirmed by the customer.

Extract the final, confirmed order details and return ONLY a valid JSON object
with no markdown fences, no explanation, just the JSON:

{
  "phone_number":     string | null,
  "delivery_address": string | null,
  "product_interest": string | null,
  "order_notes":      string | null
}

Rules:
- Use only information explicitly stated in the conversation.
- If the customer corrected a detail (e.g. gave a new address), use the LATEST value.
- Do not invent or guess any field. Use null if not found.
- product_interest should include the product name and quantity if mentioned.
- Do not extract or store customer names.
- delivery_address should be as complete as possible.
""".strip()


def _build_conversation_text(history: list[dict], latest_message: str) -> str:
    lines = []
    for msg in history:
        role = "Customer" if msg["role"] == "user" else "Bot"
        lines.append(f"{role}: {msg['content']}")
    lines.append(f"Customer: {latest_message}")
    return "\n".join(lines)


def _fb_messages_to_history(fb_response: dict, page_id: str) -> list[dict]:
    """
    Convert the Facebook Graph API response from get_conversation_messages()
    into the same [{"role": ..., "content": ...}] format used throughout.

    The page itself is the "assistant" — any sender whose id matches page_id
    is the bot. Everyone else is the customer.

    FB returns messages newest-first, so we reverse to get chronological order.
    """
    raw_messages = (
        fb_response.get("messages", {}).get("data", [])
    )
    # Reverse so oldest message is first (chronological)
    raw_messages = list(reversed(raw_messages))

    history = []
    for msg in raw_messages:
        text = msg.get("message", "").strip()
        if not text:
            continue
        sender_id = msg.get("from", {}).get("id", "")
        role = "assistant" if sender_id == page_id else "user"
        history.append({"role": role, "content": text})

    return history


async def _fetch_fb_history(
    page_access_token: str,
    conversation_id: str,
    page_id: str,
) -> list[dict]:
    """
    Fetch the full conversation from Facebook and return it as a history list.
    Falls back to an empty list if the fetch fails so lead creation still works.
    """
    from services.facebook import get_conversation_messages
    try:
        fb_response = await get_conversation_messages(page_access_token, conversation_id)
        return _fb_messages_to_history(fb_response, page_id)
    except Exception:
        logger.warning("FB conversation fetch failed — falling back to DB history")
        return []


def _merge_histories(fb_history: list[dict], db_history: list[dict]) -> list[dict]:
    """
    Merge FB and DB histories, preferring FB as the source of truth.

    If FB returned messages, use them directly — they are the real conversation.
    DB history is only used as a fallback when FB fetch failed or returned empty.
    """
    if fb_history:
        return fb_history
    return db_history


async def create_lead_from_confirmed_order(
    db: AsyncSession,
    page_id: str,
    user_id: int,
    history: list[dict],
    latest_message: str,
    *,
    page_access_token: str | None = None,
    conversation_id: str | None = None,
    groq_api_key: str | None = None,
    groq_model: str = "llama-3.3-70b-versatile",
) -> SalesLead:
    """
    Called exactly once when the customer confirms an order.

    Fetches the full conversation from Facebook (if access_token +
    conversation_id are provided) for richer context, falls back to the
    DB history slice passed in from messenger.py, then extracts structured
    order details and creates a confirmed SalesLead row.
    """
    # -- Fetch FB conversation for richer context -----------------------------
    if page_access_token and conversation_id:
        fb_history = await _fetch_fb_history(
            page_access_token=page_access_token,
            conversation_id=conversation_id,
            page_id=page_id,
        )
    else:
        fb_history = []

    # FB is source of truth; DB history is the fallback
    rich_history = _merge_histories(fb_history, history)

    # -- Extract order details from conversation ------------------------------
    try:
        details = await _extract_order_details(
            history=rich_history,
            latest_message=latest_message,
            groq_api_key=groq_api_key,
            groq_model=groq_model,
        )
    except Exception:
        logger.exception("Order detail extraction failed — creating lead with nulls")
        details = {}

    # ── Create the lead ───────────────────────────────────────────────────────
    lead = SalesLead(
        page_id=page_id,
        user_id=user_id,
        status="confirmed",
        confidence=1.0,                        # customer explicitly said yes
        trigger_message=latest_message[:500],
        raw_extracted_json=json.dumps(details),
        detected_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
        phone_number=details.get("phone_number"),
        delivery_address=details.get("delivery_address"),
        product_interest=details.get("product_interest"),
        order_notes=details.get("order_notes"),
    )
    db.add(lead)
    await db.flush()   # get lead.id

    lead.order_ref_id = f"ORD-{lead.id:04d}"

    # ── Update User contact memory ────────────────────────────────────────────
    user: User | None = await db.get(User, user_id)
    if user:
        if lead.phone_number:
            user.remembered_phone = lead.phone_number
        if lead.delivery_address:
            user.remembered_address = lead.delivery_address

    await db.flush()

    logger.info(
        "✅ New confirmed order %s created — user_id=%s product=%r name=%r",
        lead.order_ref_id, user_id,
        lead.product_interest, lead.customer_name,
    )
    return lead


# ── Extraction model ──────────────────────────────────────────────────────────

def _get_groq_client(api_key: str | None = None):
    from groq import Groq
    from config import get_settings
    return Groq(api_key=api_key or get_settings().GROQ_API_KEY)


async def _extract_order_details(
    history: list[dict],
    latest_message: str,
    groq_api_key: str | None,
    groq_model: str,
) -> dict:
    client = _get_groq_client(groq_api_key)
    conversation_text = _build_conversation_text(history, latest_message)

    def _sync_call() -> str:
        response = client.chat.completions.create(
            model=groq_model,
            temperature=0,
            max_tokens=300,
            messages=[
                {"role": "system", "content": _EXTRACTION_PROMPT},
                {
                    "role": "user",
                    "content": (
                        f"Conversation:\n\n{conversation_text}\n\n"
                        "Return the JSON now."
                    ),
                },
            ],
        )
        return response.choices[0].message.content or "{}"

    raw = await asyncio.get_event_loop().run_in_executor(None, _sync_call)
    raw = raw.strip()

    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    return json.loads(raw)