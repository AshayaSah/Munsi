"""
messenger.py — auto-reply pipeline

Lead creation happens ONLY when the AI confirms an order (order_confirmed=True).
Every other message is just a normal AI conversation — no lead detection runs.
"""

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import Page, User, Message, Log, SalesLead
from services.facebook import send_message
from services.ai_service import get_ai_reply, strip_confirmation_tag
from services.lead_detector import create_lead_from_confirmed_order


async def handle_incoming_message(
    db: AsyncSession,
    sender_id: str,
    page_id: str,
    fb_message_id: str | None,
    message_text: str | None,
    log_id: int | None = None,
    conversation_id: str | None = None,   # FB conversation ID for richer extraction
):
    try:
        # ── 1. Load page ──────────────────────────────────────────────────────
        page: Page | None = await db.get(Page, page_id)
        if not page or not page.is_active:
            print(f"⏭️  Page {page_id} not found or inactive — skipping")
            await _mark_log(db, log_id, processed=True, error="Page inactive or not found")
            return

        # ── 2. Upsert user ────────────────────────────────────────────────────
        result = await db.execute(
            select(User).where(User.user_id == sender_id, User.page_id == page_id)
        )
        user: User | None = result.scalar_one_or_none()
        if not user:
            user = User(user_id=sender_id, page_id=page_id)
            db.add(user)

        user.last_seen = datetime.now(timezone.utc)
        await db.flush()

        # ── 3. Save incoming message ──────────────────────────────────────────
        if message_text:
            db.add(Message(
                fb_message_id=fb_message_id,
                page_id=page_id,
                user_id=user.id,
                from_role="user",
                content=message_text,
                status="received",
            ))

        # ── 4. Early exits ────────────────────────────────────────────────────
        if user.is_blocked:
            print(f"🚫 User {sender_id} is blocked")
            await _mark_log(db, log_id, processed=True, error="User blocked")
            await db.commit()
            return

        if not message_text:
            await _mark_log(db, log_id, processed=True)
            await db.commit()
            return

        # -- 5. Fetch conversation history -----------------------------------
        # Pull last 30, find the most recent confirmed order in the DB, and
        # only pass messages AFTER that point. This prevents the AI from seeing
        # a previous confirmed order and re-triggering confirmation.
        # Also resets on a 2+ hour gap between messages.
        from datetime import timedelta
        history_result = await db.execute(
            select(Message)
            .where(Message.user_id == user.id, Message.page_id == page_id)
            .order_by(Message.sent_at.desc())
            .limit(30)
        )
        all_msgs = list(reversed(history_result.scalars().all()))

        # Find the most recent confirmed lead for this user — use its timestamp
        # as the hard session boundary so the AI never sees pre-confirmation chat.
        last_lead_result = await db.execute(
            select(SalesLead)
            .where(SalesLead.user_id == user.id, SalesLead.page_id == page_id)
            .order_by(SalesLead.detected_at.desc())
            .limit(1)
        )
        last_lead = last_lead_result.scalar_one_or_none()
        last_confirmed_at = last_lead.detected_at if last_lead else None

        session_start = 0
        for i in range(len(all_msgs) - 1, 0, -1):
            gap = (all_msgs[i].sent_at - all_msgs[i - 1].sent_at).total_seconds()
            # Hard boundary: don't include messages from before the last confirmed order
            if last_confirmed_at and all_msgs[i - 1].sent_at <= last_confirmed_at:
                session_start = i
                break
            # Soft boundary: 2+ hour gap means a new session
            if gap > 7200:
                session_start = i
                break

        history = [
            {
                "role": "user" if m.from_role == "user" else "assistant",
                "content": m.content,
            }
            for m in all_msgs[session_start:]
        ]

        # ── 6. Generate AI reply ───────────────────────────────────────────────
        raw_reply = await get_ai_reply(
            message=message_text,
            instructions=page.ai_instructions,
            history=history,
        )

        # ── 7. Check for order confirmation tag ───────────────────────────────
        clean_reply, order_confirmed = strip_confirmation_tag(raw_reply)

        if not clean_reply:
            clean_reply = "Sorry, I could not generate a reply."

        # ── 8. Send reply ─────────────────────────────────────────────────────
        send_result = await send_message(
            page.access_token, page_id, sender_id, clean_reply
        )
        status = "sent" if "message_id" in send_result else "failed"

        # ── 9. Save outgoing message ──────────────────────────────────────────
        db.add(Message(
            fb_message_id=send_result.get("message_id"),
            page_id=page_id,
            user_id=user.id,
            from_role="ai",
            content=clean_reply,
            status=status,
        ))

        # ── 10. Mark log processed ────────────────────────────────────────────
        await _mark_log(db, log_id, processed=True)

        # -- 11. Create lead ONLY on confirmed orders --------------------------
        # Deduplication guard: if a confirmed lead already exists for this user
        # in the last 60 seconds, skip creation — it's a duplicate webhook fire.
        if order_confirmed:
            from datetime import timedelta
            recent_cutoff = datetime.now(timezone.utc) - timedelta(seconds=60)
            dup_result = await db.execute(
                select(SalesLead)
                .where(
                    SalesLead.user_id == user.id,
                    SalesLead.page_id == page_id,
                    SalesLead.detected_at >= recent_cutoff,
                )
                .limit(1)
            )
            if dup_result.scalar_one_or_none():
                print(f"⚠️  Duplicate order confirmation ignored for user {user.id}")
                order_confirmed = False

        if order_confirmed:
            try:
                lead = await create_lead_from_confirmed_order(
                    db=db,
                    page_id=page_id,
                    user_id=user.id,
                    history=history,
                    latest_message=message_text,
                    page_access_token=page.access_token,
                    conversation_id=conversation_id,
                )
                print(
                    f"🛒 Order confirmed → {lead.order_ref_id} | "
                    f"{lead.product_interest} | {lead.customer_name} | {lead.phone_number}"
                )
            except Exception as e:
                # Never let lead creation break the reply pipeline
                print(f"⚠️  Lead creation error (non-fatal): {e}")

        await db.commit()
        print(f"✅ Reply sent to {sender_id}: {clean_reply[:80]}…")

    except Exception as e:
        import traceback
        traceback.print_exc()
        await _mark_log(db, log_id, processed=False, error=str(e))
        await db.commit()


async def _mark_log(
    db: AsyncSession,
    log_id: int | None,
    processed: bool,
    error: str | None = None,
):
    if log_id is None:
        return
    log: Log | None = await db.get(Log, log_id)
    if log:
        log.is_processed = processed
        log.error = error