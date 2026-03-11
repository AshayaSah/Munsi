from groq import Groq
from config import get_settings

_client = None

SYSTEM_PROMPT = """You are a friendly and professional sales representative for an online shop.
Your job is to help customers with product inquiries, orders, pricing, and general support.
Be warm, helpful, and persuasive — but never pushy.
Keep all your replies concise: minimum 1 sentence, maximum 50 words. Never exceed 50 words."""

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
    # Base system prompt + optional page-level instructions
    system = SYSTEM_PROMPT
    if instructions:
        system += f"\n\nAdditional instructions: {instructions}"

    # Build messages: history first, then current message
    messages = []
    if history:
        messages.extend(history)
    messages.append({"role": "user", "content": message})

    try:
        response = get_client().chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "system", "content": system}] + messages,
            max_tokens=150,
        )
        return response.choices[0].message.content or "Sorry, I could not generate a reply."
    except Exception as e:
        print(f"❌ Groq error: {e}")
        return "Sorry, something went wrong on my end."