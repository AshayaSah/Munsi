import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from config import get_settings
from database import get_db
from models import Page
from services.facebook import (
    exchange_code_for_token,
    get_me,
    get_user_pages,
    subscribe_page_to_webhook,
)
from urllib.parse import quote

router = APIRouter(prefix="/auth/facebook", tags=["auth"])
settings = get_settings()


@router.get("/login")
def facebook_login():
    """Redirect user to Facebook OAuth dialog."""
    scope = (
        "instagram_basic,instagram_manage_messages,"
        "pages_read_engagement,pages_show_list,"
        "business_management,pages_messaging"
    )
    url = (
        f"https://www.facebook.com/v18.0/dialog/oauth"
        f"?client_id={settings.FB_APP_ID}"
        f"&redirect_uri={settings.FB_REDIRECT_URI}"
        f"&scope={scope}"
        f"&response_type=code"
    )
    return RedirectResponse(url=url)


@router.get("/callback")
async def facebook_callback(code: str, db: AsyncSession = Depends(get_db)):
    """
    Exchange code → access token, save pages to DB,
    subscribe each page to the webhook, then redirect to frontend.
    """
    if not code:
        raise HTTPException(status_code=400, detail="No authorization code provided")

    # 1. Exchange code for user access token
    token_data = await exchange_code_for_token(code)
    user_access_token = token_data["access_token"]

    # 2. Get logged-in user info
    user_info = await get_me(user_access_token)
    user_fb_id = user_info.get("id")
    user_name = user_info.get("name", "")
    user_avatar = user_info.get("picture", {}).get("data", {}).get("url", "")

    # 3. Fetch pages the user manages
    pages = await get_user_pages(user_access_token)

    for page_data in pages:
        page_id = page_data["id"]
        page_token = page_data.get("access_token", user_access_token)

        # 4. Upsert page in DB
        existing: Page | None = await db.get(Page, page_id)
        if existing:
            existing.name = page_data.get("name", existing.name)
            existing.access_token = page_token
        else:
            new_page = Page(
                id=page_id,
                name=page_data.get("name", "Unknown Page"),
                access_token=page_token,
                is_active=True,
            )
            db.add(new_page)
            # 5. Subscribe NEW pages to webhook automatically
            await subscribe_page_to_webhook(page_id, page_token)

    await db.commit()

    # Redirect to frontend with user context
    frontend_url = (
        f"http://localhost:5173"
        f"?user_id={user_fb_id}"
        f"&access_token={user_access_token}"
        f"&logged_in=true"
        f"&name={quote(user_name)}"
        f"&avatar={quote(user_avatar)}"
    )
    return RedirectResponse(url=frontend_url)
