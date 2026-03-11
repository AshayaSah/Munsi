"""
Orchestrates the full auto-reply pipeline:
  1. Upsert User row
  2. Save incoming Message
  3. Generate AI reply (with conversation history)
  4. Send reply via FB Graph API
  5. Save outgoing Message
  6. Update Log as processed
"""
import json
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import Page, User, Message, Log
from services.facebook import send_message
from services.ai_service import get_ai_reply


async def handle_incoming_message(
    db: AsyncSession,
    sender_id: str,
    page_id: str,
    fb_message_id: str | None,
    message_text: str | None,
    log_id: int | None = None,
):
    try:
        # ── 1. Load page ──────────────────────────────────────────
        page: Page | None = await db.get(Page, page_id)
        if not page or not page.is_active:
            print(f"⏭️  Page {page_id} not found or inactive — skipping auto-reply")
            await _mark_log(db, log_id, processed=True, error="Page inactive or not found")
            return

        # ── 2. Upsert user ────────────────────────────────────────
        result = await db.execute(
            select(User).where(User.user_id == sender_id, User.page_id == page_id)
        )
        user: User | None = result.scalar_one_or_none()
        if not user:
            user = User(user_id=sender_id, page_id=page_id)
            db.add(user)

        user.last_seen = datetime.now(timezone.utc)
        await db.flush()

        # ── 3. Save incoming message ──────────────────────────────
        if message_text:
            incoming = Message(
                fb_message_id=fb_message_id,
                page_id=page_id,
                user_id=user.id,
                from_role="user",
                content=message_text,
                status="received",
            )
            db.add(incoming)

        # ── 4. Skip auto-reply if user is blocked ─────────────────
        if user.is_blocked:
            print(f"🚫 User {sender_id} is blocked — no auto-reply")
            await _mark_log(db, log_id, processed=True, error="User blocked")
            await db.commit()
            return

        if not message_text:
            await _mark_log(db, log_id, processed=True)
            await db.commit()
            return

        # ── 5. Fetch last 20 messages for context ─────────────────
        history_result = await db.execute(
            select(Message)
            .where(Message.user_id == user.id, Message.page_id == page_id)
            .order_by(Message.sent_at.asc())
            .limit(20)
        )
        history_rows = history_result.scalars().all()

        # Convert to Groq message format (exclude the just-added incoming one)
        history = [
            {
                "role": "user" if m.from_role == "user" else "assistant",
                "content": m.content,
            }
            for m in history_rows
        ]

        # ── 6. Generate AI reply with context ─────────────────────
        ai_text = await get_ai_reply(message_text, page.ai_instructions, history)

        # ── 7. Send via FB Graph API ──────────────────────────────
        send_result = await send_message(page.access_token, page_id, sender_id, ai_text)
        status = "sent" if "message_id" in send_result else "failed"

        # ── 8. Save outgoing message ──────────────────────────────
        outgoing = Message(
            fb_message_id=send_result.get("message_id"),
            page_id=page_id,
            user_id=user.id,
            from_role="ai",
            content=ai_text,
            status=status,
        )
        db.add(outgoing)

        # ── 9. Mark log processed ─────────────────────────────────
        await _mark_log(db, log_id, processed=True)
        await db.commit()
        print(f"✅ Auto-reply sent to {sender_id}: {ai_text[:60]}…")

    except Exception as e:
        import traceback
        traceback.print_exc()
        await _mark_log(db, log_id, processed=False, error=str(e))
        await db.commit()


async def _mark_log(db: AsyncSession, log_id: int | None, processed: bool, error: str | None = None):
    if log_id is None:
        return
    log: Log | None = await db.get(Log, log_id)
    if log:
        log.is_processed = processed
        log.error = error