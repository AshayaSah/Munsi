import httpx
from config import get_settings

settings = get_settings()

FB_GRAPH = "https://graph.facebook.com/v18.0"


async def exchange_code_for_token(code: str) -> dict:
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{FB_GRAPH}/oauth/access_token",
            params={
                "client_id": settings.FB_APP_ID,
                "client_secret": settings.FB_APP_SECRET,
                "redirect_uri": settings.FB_REDIRECT_URI,
                "code": code,
            },
        )
        r.raise_for_status()
        return r.json()


async def get_me(access_token: str) -> dict:
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{FB_GRAPH}/me",
            params={"access_token": access_token, "fields": "id,name,email"},
        )
        r.raise_for_status()
        return r.json()


async def get_user_pages(access_token: str) -> list[dict]:
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{FB_GRAPH}/me/accounts",
            params={"access_token": access_token},
        )
        r.raise_for_status()
        return r.json().get("data", [])


async def subscribe_page_to_webhook(page_id: str, page_access_token: str) -> dict:
    """Subscribe a page to receive webhook events."""
    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"{FB_GRAPH}/{page_id}/subscribed_apps",
            params={
                "subscribed_fields": "messages,messaging_postbacks,message_deliveries,message_reads",
                "access_token": page_access_token,
            },
        )
        data = r.json()
        if r.status_code != 200:
            print(f"⚠️  Webhook subscribe failed for page {page_id}: {data}")
        else:
            print(f"✅ Page {page_id} subscribed to webhook")
        return data


async def send_message(page_access_token: str, page_id: str, recipient_id: str, text: str) -> dict:
    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"{FB_GRAPH}/{page_id}/messages",
            params={"access_token": page_access_token},
            json={"recipient": {"id": recipient_id}, "message": {"text": text}},
        )
        data = r.json()
        if r.status_code != 200:
            print(f"❌ send_message failed: {data}")
        return data


async def get_conversations(page_access_token: str, page_id: str) -> dict:
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{FB_GRAPH}/{page_id}/conversations",
            params={
                "fields": "participants,updated_time,message_count,snippet",
                "access_token": page_access_token,
            },
        )
        r.raise_for_status()
        return r.json()


async def get_conversation_messages(page_access_token: str, conversation_id: str) -> dict:
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{FB_GRAPH}/{conversation_id}",
            params={
                "fields": "messages{message,from,created_time,id}",
                "access_token": page_access_token,
            },
        )
        r.raise_for_status()
        return r.json()
