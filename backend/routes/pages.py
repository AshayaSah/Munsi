from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from database import get_db
from models import Page
from services.facebook import (
    get_user_pages,
    subscribe_page_to_webhook,
)

router = APIRouter(prefix="/api", tags=["pages"])


class PageUpdate(BaseModel):
    ai_instructions: Optional[str] = None
    is_active: Optional[bool] = None


@router.get("/user/pages")
async def get_user_pages_endpoint(access_token: str):
    """Returns pages from FB Graph API (live)."""
    pages = await get_user_pages(access_token)
    return {"pages": pages}


@router.get("/pages")
async def list_db_pages(db: AsyncSession = Depends(get_db)):
    """Returns all pages stored in the database."""
    result = await db.execute(select(Page))
    pages = result.scalars().all()
    return {
        "pages": [
            {
                "id": p.id,
                "name": p.name,
                "is_active": p.is_active,
                "ai_instructions": p.ai_instructions,
                "created_at": p.created_at,
            }
            for p in pages
        ]
    }


@router.patch("/pages/{page_id}")
async def update_page(page_id: str, body: PageUpdate, db: AsyncSession = Depends(get_db)):
    """Update AI instructions or active status for a page."""
    page: Page | None = await db.get(Page, page_id)
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")

    if body.ai_instructions is not None:
        page.ai_instructions = body.ai_instructions
    if body.is_active is not None:
        page.is_active = body.is_active

    await db.commit()
    return {"ok": True, "page_id": page_id}


@router.post("/pages/{page_id}/subscribe")
async def subscribe_page(page_id: str, db: AsyncSession = Depends(get_db)):
    """Manually re-subscribe a page to the webhook."""
    page: Page | None = await db.get(Page, page_id)
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")

    result = await subscribe_page_to_webhook(page_id, page.access_token)
    return result
