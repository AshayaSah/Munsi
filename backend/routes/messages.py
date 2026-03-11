from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Page
from services.facebook import (
    get_conversations,
    get_conversation_messages,
    send_message as fb_send_message,
)

router = APIRouter(prefix="/api", tags=["messages"])


@router.get("/conversations")
async def get_conversations_endpoint(access_token: str, page_id: str):
    return await get_conversations(access_token, page_id)


@router.get("/messages")
async def get_messages_endpoint(
    access_token: str,
    page_id: str,
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
):
    page: Page | None = await db.get(Page, page_id)
    token = page.access_token if page else access_token
    return await get_conversation_messages(token, conversation_id)


@router.post("/send-message")
async def send_message_endpoint(
    access_token: str,
    page_id: str,
    recipient_id: str,
    message_text: str,
    db: AsyncSession = Depends(get_db),
):
    page: Page | None = await db.get(Page, page_id)
    token = page.access_token if page else access_token

    result = await fb_send_message(token, page_id, recipient_id, message_text)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result)
    return result

@router.get("/recent-messages")
async def get_recent_messages(
    page_id: str | None = None,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import select, desc
    from sqlalchemy.orm import selectinload
    from models import Message

    # Get user messages
    query = (
        select(Message)
        .options(selectinload(Message.user))
        .where(Message.from_role == "user")
        .order_by(desc(Message.sent_at))
        .limit(limit)
    )
    if page_id:
        query = query.where(Message.page_id == page_id)

    result = await db.execute(query)
    user_messages = result.scalars().all()

    # For each user message, find the next AI reply using row id (more reliable than timestamp)
    data = []
    for m in user_messages:
        ai_result = await db.execute(
            select(Message)
            .where(
                Message.user_id == m.user_id,
                Message.page_id == m.page_id,
                Message.from_role == "ai",
                Message.id > m.id,  # 👈 use id instead of timestamp
            )
            .order_by(Message.id.asc())  # 👈 closest next row
            .limit(1)
        )
        ai_msg = ai_result.scalar_one_or_none()

        data.append({
            "sender_id": m.user.user_id if m.user else str(m.user_id),
            "recipient_id": m.page_id,
            "message_id": m.fb_message_id,
            "message_text": m.content,
            "attachments": None,
            "timestamp": int(m.sent_at.timestamp() * 1000) if m.sent_at else None,
            "ai_reply": ai_msg.content if ai_msg else None,
            "ai_status": ai_msg.status if ai_msg else None,
        })

    return {"messages": data, "count": len(data)}