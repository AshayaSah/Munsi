"""
services/ai_service.py

The AI has one job: have a natural sales conversation.

Order flow:
  1. Chat normally — answer questions, discuss products, pricing, etc.
  2. When the customer shows buying intent, collect 3 fields one at a time:
     name, phone number, delivery address.
  3. Once all 3 are in hand, read back a summary and ask "confirm?".
  4. Customer says YES → reply with confirmation message AND append the tag:
         <!--ORDER_CONFIRMED-->
     That tag is the ONLY thing that triggers lead creation. Nothing else does.

The tag is stripped before the message is sent to the customer.
"""

from groq import Groq
from config import get_settings

_client = None

SYSTEM_PROMPT = """You are a friendly sales assistant for an online shop on Facebook Messenger.

YOUR JOB
────────
Have natural conversations. Answer questions about products, prices, and availability.
When a customer is ready to order, guide them through placing it step by step.

ORDER FLOW — follow this exactly
─────────────────────────────────
STEP 1 — Detect intent
  When a customer clearly wants to buy, start collecting their details.
  Do NOT ask for all fields at once. Ask one at a time, naturally.

STEP 2 — Collect these 2 fields:
  • Phone number
  • Delivery address (as specific as possible)

  If you already have a field from earlier in THIS conversation, skip it and
  confirm what you have rather than asking again.
  Do NOT carry over details from previous conversations about different products.
  Each new product the customer asks about is a fresh order — start clean.

STEP 3 — Confirmation summary
  Once you have BOTH fields, send a summary exactly like this:

    "Here's your order summary:
    📦 [product and quantity]
    📞 [phone]
    📍 [address]

    Reply YES to confirm your order, or let me know if anything needs changing."

  Then stop and wait for the customer to reply.

STEP 4 — Place the order
  If the customer replies YES (or "yes", "confirm", "go ahead", "yep", "ok", etc.):
    Write a short friendly confirmation: "Your order is confirmed! We'll be in touch soon."
    Then on a NEW LINE at the very end, write EXACTLY:
        <!--ORDER_CONFIRMED-->
    Do not explain this tag. The customer will never see it.

  If the customer says NO or wants to change something, update the detail and
  go back to step 3 with the corrected summary.

MULTIPLE ORDERS
───────────────
If a customer orders again in the same or a later conversation, treat it as a
brand-new order and go through all 4 steps again from the top.

CANCELLATIONS / UPDATES
────────────────────────
Handle these conversationally. No special tag needed — just respond naturally
and confirm the change with the customer.

TONE
────
Warm, concise, never robotic. Keep replies short except during order summaries.
Never ask for payment details.
"""


def get_client():
    global _client
    if _client is None:
        settings = get_settings()
        _client = Groq(api_key=settings.GROQ_API_KEY)
    return _client


async def get_ai_reply(
    message: str,
    instructions: str | None = None,
    history: list[dict] | None = None,
) -> str:
    """
    Generate a reply. Returns the RAW string, which may contain
    the hidden <!--ORDER_CONFIRMED--> tag. Call strip_confirmation_tag()
    before sending to the customer.
    """
    system = SYSTEM_PROMPT
    if instructions:
        system += f"\n\nADDITIONAL INSTRUCTIONS\n{instructions}"

    messages = []
    if history:
        messages.extend(history)
    messages.append({"role": "user", "content": message})

    try:
        response = get_client().chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "system", "content": system}] + messages,
            max_tokens=400,
            temperature=0.4,
        )
        return response.choices[0].message.content or "Sorry, I could not generate a reply."
    except Exception as e:
        print(f"❌ Groq error: {e}")
        return "Sorry, something went wrong on my end."


def strip_confirmation_tag(reply: str) -> tuple[str, bool]:
    """
    Strip the hidden <!--ORDER_CONFIRMED--> tag from a reply.

    Returns
    -------
    (clean_reply, order_confirmed)
        clean_reply     — safe to send to the customer
        order_confirmed — True only if the tag was present
    """
    TAG = "<!--ORDER_CONFIRMED-->"
    confirmed = TAG in reply
    clean = reply.replace(TAG, "").strip()
    return clean, confirmed