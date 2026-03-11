import json
from fastapi import APIRouter, Request, HTTPException, BackgroundTasks, Depends
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession

from config import get_settings
from database import get_db
from models import Log
from services.messenger import handle_incoming_message

router = APIRouter(prefix="/webhook", tags=["webhook"])
settings = get_settings()


@router.get("")
async def verify_webhook(request: Request):
    """Facebook webhook verification handshake."""
    hub_mode = request.query_params.get("hub.mode")
    hub_token = request.query_params.get("hub.verify_token")
    hub_challenge = request.query_params.get("hub.challenge")

    print(f"[webhook] verify → mode={hub_mode} token={hub_token}")

    if hub_mode == "subscribe" and hub_token == settings.WEBHOOK_VERIFY_TOKEN:
        print("✅ Webhook verified")
        return PlainTextResponse(content=hub_challenge)

    raise HTTPException(status_code=403, detail="Verification failed")


@router.post("")
async def receive_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Receive incoming events from Facebook."""
    try:
        body = await request.json()
        print(f"\n📨 Webhook received: {json.dumps(body)[:200]}")
    except Exception:
        return {"status": "invalid json"}

    if body.get("object") != "page":
        return {"status": "ignored"}

    for entry in body.get("entry", []):
        for event in entry.get("messaging", []):
            sender_id = event.get("sender", {}).get("id")
            page_id = event.get("recipient", {}).get("id")

            # ── Log raw payload ────────────────────────────────────
            log = Log(
                page_id=page_id,
                raw_message=json.dumps(event),
                is_processed=False,
            )
            db.add(log)
            await db.flush()        # get log.id immediately
            log_id = log.id
            await db.commit()

            # ── Handle message event ───────────────────────────────
            if event.get("message"):
                message = event["message"]
                message_text = message.get("text")
                fb_message_id = message.get("mid")

                print(f"🆕 Message from {sender_id} on page {page_id}: {message_text}")

                # Run pipeline in background so we return 200 fast
                background_tasks.add_task(
                    _run_pipeline,
                    sender_id=sender_id,
                    page_id=page_id,
                    fb_message_id=fb_message_id,
                    message_text=message_text,
                    log_id=log_id,
                )

            elif event.get("postback"):
                print(f"📲 Postback from {sender_id}: {event['postback'].get('payload')}")

            elif event.get("delivery"):
                print(f"✅ Delivery confirmed for {sender_id}")

            elif event.get("read"):
                print(f"👁️  Read receipt from {sender_id}")

    return {"status": "ok"}


async def _run_pipeline(
    sender_id: str,
    page_id: str,
    fb_message_id: str | None,
    message_text: str | None,
    log_id: int,
):
    """Runs inside BackgroundTask — creates its own DB session."""
    from database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        await handle_incoming_message(
            db=db,
            sender_id=sender_id,
            page_id=page_id,
            fb_message_id=fb_message_id,
            message_text=message_text,
            log_id=log_id,
        )
