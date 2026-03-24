"""
routes/admin.py

REST endpoints for the custom admin dashboard frontend.
All routes are protected by the X-Admin-Token header which must match SECRET_KEY.

Mount in main.py:
    from routes.admin import router as admin_router
    app.include_router(admin_router)
"""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Header, Query
from pydantic import BaseModel
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from config import get_settings
from database import get_db
from models import Page, User, Message, Log, SalesLead

router = APIRouter(prefix="/api/admin", tags=["admin"])
settings = get_settings()


# ── Auth dependency ───────────────────────────────────────────────────────────

def require_admin(x_admin_token: str = Header(...)):
    """Validate the admin token sent from the frontend."""
    if x_admin_token != settings.SECRET_KEY:
        raise HTTPException(status_code=401, detail="Invalid admin token")


# ── Schemas ───────────────────────────────────────────────────────────────────

class AdminLoginRequest(BaseModel):
    username: str
    password: str

class AdminLoginResponse(BaseModel):
    token: str
    message: str

class PageOut(BaseModel):
    id: str
    name: str
    is_active: bool
    created_at: datetime
    class Config: from_attributes = True

class PageUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None
    ai_instructions: Optional[str] = None

class UserOut(BaseModel):
    id: int
    user_id: str
    page_id: str
    last_seen: Optional[datetime]
    is_blocked: bool
    created_at: datetime
    class Config: from_attributes = True

class UserUpdate(BaseModel):
    is_blocked: Optional[bool] = None

class MessageOut(BaseModel):
    id: int
    page_id: str
    user_id: int
    from_role: str
    content: str
    sent_at: datetime
    status: str
    class Config: from_attributes = True

class LogOut(BaseModel):
    id: int
    page_id: Optional[str]
    raw_message: str
    is_processed: bool
    error: Optional[str]
    received_at: datetime
    class Config: from_attributes = True

class SalesLeadOut(BaseModel):
    id: int
    page_id: str
    user_id: int
    status: str
    confidence: Optional[float]
    customer_name: Optional[str]
    phone_number: Optional[str]
    delivery_address: Optional[str]
    product_interest: Optional[str]
    order_notes: Optional[str]
    trigger_message: Optional[str]
    detected_at: datetime
    updated_at: datetime
    class Config: from_attributes = True

class SalesLeadUpdate(BaseModel):
    status: Optional[str] = None

class PaginatedResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: list

class StatsResponse(BaseModel):
    total_pages: int
    active_pages: int
    total_users: int
    blocked_users: int
    total_messages: int
    total_logs: int
    unprocessed_logs: int
    total_leads: int
    pending_leads: int
    confirmed_leads: int


# ── Auth ──────────────────────────────────────────────────────────────────────

@router.post("/login", response_model=AdminLoginResponse)
async def admin_login(body: AdminLoginRequest):
    """Validate admin credentials and return the token."""
    if body.username != "admin" or body.password != settings.SECRET_KEY:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return AdminLoginResponse(token=settings.SECRET_KEY, message="Login successful")


# ── Stats ─────────────────────────────────────────────────────────────────────

@router.get("/stats", response_model=StatsResponse, dependencies=[Depends(require_admin)])
async def get_stats(db: AsyncSession = Depends(get_db)):
    """Dashboard KPI counts."""
    async def count(model, *filters):
        q = select(func.count()).select_from(model)
        for f in filters:
            q = q.where(f)
        return (await db.execute(q)).scalar_one()

    return StatsResponse(
        total_pages      = await count(Page),
        active_pages     = await count(Page, Page.is_active == True),
        total_users      = await count(User),
        blocked_users    = await count(User, User.is_blocked == True),
        total_messages   = await count(Message),
        total_logs       = await count(Log),
        unprocessed_logs = await count(Log, Log.is_processed == False),
        total_leads      = await count(SalesLead),
        pending_leads    = await count(SalesLead, SalesLead.status == "pending"),
        confirmed_leads  = await count(SalesLead, SalesLead.status == "confirmed"),
    )


# ── Pages ─────────────────────────────────────────────────────────────────────

@router.get("/pages", dependencies=[Depends(require_admin)])
async def list_pages(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    total = (await db.execute(select(func.count()).select_from(Page))).scalar_one()
    rows = (await db.execute(
        select(Page).order_by(desc(Page.created_at))
        .offset((page - 1) * page_size).limit(page_size)
    )).scalars().all()
    return PaginatedResponse(total=total, page=page, page_size=page_size,
                             items=[PageOut.model_validate(r) for r in rows])

@router.patch("/pages/{page_id}", dependencies=[Depends(require_admin)])
async def update_page(page_id: str, body: PageUpdate, db: AsyncSession = Depends(get_db)):
    p = await db.get(Page, page_id)
    if not p:
        raise HTTPException(404, "Page not found")
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(p, field, val)
    await db.commit()
    await db.refresh(p)
    return PageOut.model_validate(p)

@router.delete("/pages/{page_id}", dependencies=[Depends(require_admin)])
async def delete_page(page_id: str, db: AsyncSession = Depends(get_db)):
    p = await db.get(Page, page_id)
    if not p:
        raise HTTPException(404, "Page not found")
    await db.delete(p)
    await db.commit()
    return {"deleted": page_id}


# ── Users ─────────────────────────────────────────────────────────────────────

@router.get("/users", dependencies=[Depends(require_admin)])
async def list_users(
    page_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    q = select(User).order_by(desc(User.created_at))
    cq = select(func.count()).select_from(User)
    if page_id:
        q = q.where(User.page_id == page_id)
        cq = cq.where(User.page_id == page_id)
    total = (await db.execute(cq)).scalar_one()
    rows = (await db.execute(q.offset((page - 1) * page_size).limit(page_size))).scalars().all()
    return PaginatedResponse(total=total, page=page, page_size=page_size,
                             items=[UserOut.model_validate(r) for r in rows])

@router.patch("/users/{user_id}", dependencies=[Depends(require_admin)])
async def update_user(user_id: int, body: UserUpdate, db: AsyncSession = Depends(get_db)):
    u = await db.get(User, user_id)
    if not u:
        raise HTTPException(404, "User not found")
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(u, field, val)
    await db.commit()
    await db.refresh(u)
    return UserOut.model_validate(u)

# ── Messages ──────────────────────────────────────────────────────────────────

@router.get("/messages", dependencies=[Depends(require_admin)])
async def list_messages(
    page_id: Optional[str] = Query(None),
    user_id: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    q = select(Message).order_by(desc(Message.sent_at))
    cq = select(func.count()).select_from(Message)
    if page_id:
        q = q.where(Message.page_id == page_id)
        cq = cq.where(Message.page_id == page_id)
    if user_id:
        q = q.where(Message.user_id == user_id)
        cq = cq.where(Message.user_id == user_id)
    total = (await db.execute(cq)).scalar_one()
    rows = (await db.execute(q.offset((page - 1) * page_size).limit(page_size))).scalars().all()
    return PaginatedResponse(total=total, page=page, page_size=page_size,
                             items=[MessageOut.model_validate(r) for r in rows])


# ── Logs ──────────────────────────────────────────────────────────────────────

@router.get("/logs", dependencies=[Depends(require_admin)])
async def list_logs(
    processed: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    q = select(Log).order_by(desc(Log.received_at))
    cq = select(func.count()).select_from(Log)
    if processed is not None:
        q = q.where(Log.is_processed == processed)
        cq = cq.where(Log.is_processed == processed)
    total = (await db.execute(cq)).scalar_one()
    rows = (await db.execute(q.offset((page - 1) * page_size).limit(page_size))).scalars().all()
    return PaginatedResponse(total=total, page=page, page_size=page_size,
                             items=[LogOut.model_validate(r) for r in rows])


# ── Sales Leads ───────────────────────────────────────────────────────────────

@router.get("/leads", dependencies=[Depends(require_admin)])
async def list_leads(
    page_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    q = select(SalesLead).order_by(desc(SalesLead.updated_at))
    cq = select(func.count()).select_from(SalesLead)
    if page_id:
        q = q.where(SalesLead.page_id == page_id)
        cq = cq.where(SalesLead.page_id == page_id)
    if status:
        q = q.where(SalesLead.status == status)
        cq = cq.where(SalesLead.status == status)
    total = (await db.execute(cq)).scalar_one()
    rows = (await db.execute(q.offset((page - 1) * page_size).limit(page_size))).scalars().all()
    return PaginatedResponse(total=total, page=page, page_size=page_size,
                             items=[SalesLeadOut.model_validate(r) for r in rows])

@router.patch("/leads/{lead_id}", dependencies=[Depends(require_admin)])
async def update_lead(lead_id: int, body: SalesLeadUpdate, db: AsyncSession = Depends(get_db)):
    lead = await db.get(SalesLead, lead_id)
    if not lead:
        raise HTTPException(404, "Lead not found")
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(lead, field, val)
    await db.commit()
    await db.refresh(lead)
    return SalesLeadOut.model_validate(lead)

@router.delete("/leads/{lead_id}", dependencies=[Depends(require_admin)])
async def delete_lead(lead_id: int, db: AsyncSession = Depends(get_db)):
    lead = await db.get(SalesLead, lead_id)
    if not lead:
        raise HTTPException(404, "Lead not found")
    await db.delete(lead)
    await db.commit()
    return {"deleted": True, "lead_id": lead_id}