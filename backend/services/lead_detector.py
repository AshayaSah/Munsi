"""
services/lead_detector.py

Agentic lead-detection layer.

After every AI reply, call `detect_and_upsert_lead()`. It will:
  1. Ask Groq to analyse the recent conversation for buying intent.
  2. Extract structured order details (name, phone, address, product, notes).
  3. Upsert a SalesLead row — create on first detection, update on each
     subsequent message as more details arrive.

The detector uses a SEPARATE, cheap AI call (not the reply call) so the
main reply pipeline is never slowed down — it runs inside the same
background task after the reply is sent.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import SalesLead

logger = logging.getLogger(__name__)

# ── Prompt ────────────────────────────────────────────────────────────────────

_SYSTEM_PROMPT = """
You are an order-detection agent for a Facebook Messenger sales bot.

Analyse the conversation below and decide whether the customer has shown
buying intent or has already provided order details.

Return ONLY a valid JSON object — no markdown, no explanation — with these keys:

{
  "has_intent": true | false,
  "status": "interested" | "collecting" | "pending" | "confirmed" | "cancelled",
  "confidence": 0.0–1.0,
  "customer_name": string | null,
  "phone_number": string | null,
  "delivery_address": string | null,
  "product_interest": string | null,
  "order_notes": string | null
}

Status rules:
- "interested"  → customer asked about price, availability, or showed general interest
- "collecting"  → customer started giving details but info is still incomplete
- "pending"     → customer provided name + phone OR address — enough to follow up
- "confirmed"   → customer explicitly confirmed the order or said "yes, I'll take it"
- "cancelled"   → customer said they no longer want it or stopped engaging negatively

Set has_intent=false and status="interested" with confidence<0.3 if there is
no buying signal at all. In that case all other fields should be null.
""".strip()


def _build_conversation_text(history: list[dict[str, str]], latest_message: str) -> str:
    lines: list[str] = []
    for msg in history:
        role = "Customer" if msg["role"] == "user" else "Bot"
        lines.append(f"{role}: {msg['content']}")
    lines.append(f"Customer: {latest_message}")
    return "\n".join(lines)


# ── Main entry point ──────────────────────────────────────────────────────────

async def detect_and_upsert_lead(
    db: AsyncSession,
    page_id: str,
    user_id: int,              # internal DB user.id (not FB sender_id)
    history: list[dict],       # same history list already built in messenger.py
    latest_message: str,
    *,
    groq_api_key: str | None = None,
    groq_model: str = "llama-3.3-70b-versatile",   # same model as ai_service.py
) -> SalesLead | None:
    """
    Detect buying intent in the conversation and upsert a SalesLead.

    Returns the SalesLead row (new or updated), or None if no intent found
    and no existing lead to update.
    """
    try:
        extraction = await _call_detection_model(
            history=history,
            latest_message=latest_message,
            groq_api_key=groq_api_key,
            groq_model=groq_model,
        )
    except Exception:
        logger.exception("Lead detection model call failed — skipping lead upsert")
        return None

    has_intent: bool = extraction.get("has_intent", False)
    confidence: float = float(extraction.get("confidence", 0.0))
    status: str = extraction.get("status", "interested")

    # ── Check if a lead already exists for this user+page ────────────────────
    result = await db.execute(
        select(SalesLead)
        .where(SalesLead.user_id == user_id, SalesLead.page_id == page_id)
        .order_by(SalesLead.detected_at.desc())
        .limit(1)
    )
    existing: SalesLead | None = result.scalar_one_or_none()

    # Don't create a new lead for low-confidence non-intent signals
    if not has_intent and confidence < 0.4 and existing is None:
        return None

    # ── Build field updates ───────────────────────────────────────────────────
    updates: dict[str, Any] = {
        "status": status,
        "confidence": confidence,
        "trigger_message": latest_message[:500],
        "raw_extracted_json": json.dumps(extraction),
        "updated_at": datetime.now(timezone.utc),
    }

    # Only overwrite detail fields if the new extraction actually found something
    for field in ("customer_name", "phone_number", "delivery_address",
                  "product_interest", "order_notes"):
        value = extraction.get(field)
        if value:
            updates[field] = value

    if existing:
        # Patch existing lead — never downgrade a confirmed/pending status
        _PRIORITY = {"cancelled": 0, "interested": 1, "collecting": 2,
                     "pending": 3, "confirmed": 4}
        if _PRIORITY.get(status, 0) >= _PRIORITY.get(existing.status, 0):
            updates["status"] = status
        else:
            updates.pop("status")  # keep the higher status

        for k, v in updates.items():
            setattr(existing, k, v)

        lead = existing
        logger.info(
            "🔄 SalesLead #%s updated → status=%s confidence=%.2f",
            lead.id, lead.status, lead.confidence,
        )
    else:
        # Create brand-new lead
        lead = SalesLead(
            page_id=page_id,
            user_id=user_id,
            detected_at=datetime.now(timezone.utc),
            **updates,
        )
        db.add(lead)
        logger.info(
            "🛒 New SalesLead created for user_id=%s page=%s status=%s confidence=%.2f",
            user_id, page_id, status, confidence,
        )

    # Flush so the caller can access lead.id immediately if needed
    await db.flush()
    return lead


# ── Detection model call (Groq SDK — same as ai_service.py) ──────────────────

def _get_groq_client(api_key: str | None = None):
    """Reuse the same Groq SDK your ai_service.py already uses."""
    from groq import Groq
    from config import get_settings
    key = api_key or get_settings().GROQ_API_KEY
    return Groq(api_key=key)


async def _call_detection_model(
    history: list[dict],
    latest_message: str,
    groq_api_key: str | None,
    groq_model: str,
) -> dict:
    """
    Uses the groq SDK (same as ai_service.py) so the API key is read
    from config/settings — no raw httpx, no os.environ needed.
    """
    import asyncio

    client = _get_groq_client(groq_api_key)
    conversation_text = _build_conversation_text(history, latest_message)

    # groq SDK is sync — run it in a thread so we don't block the event loop
    def _sync_call() -> str:
        response = client.chat.completions.create(
            model=groq_model,
            temperature=0,        # deterministic JSON extraction
            max_tokens=400,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": (
                        "Here is the conversation:\n\n"
                        f"{conversation_text}\n\n"
                        "Return the JSON object now."
                    ),
                },
            ],
        )
        return response.choices[0].message.content or ""

    raw_text = await asyncio.get_event_loop().run_in_executor(None, _sync_call)
    raw_text = raw_text.strip()

    # Strip accidental markdown fences
    if raw_text.startswith("```"):
        raw_text = raw_text.split("```")[1]
        if raw_text.startswith("json"):
            raw_text = raw_text[4:]
    raw_text = raw_text.strip()

    return json.loads(raw_text)