"""
routers/leads.py

Dashboard REST API for SalesLeads.

Mount in main.py:
    from routers.leads import router as leads_router
    app.include_router(leads_router)
"""

from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import SalesLead, User

router = APIRouter(prefix="/leads", tags=["leads"])


# ── Pydantic schemas ─────────────────────────────────────────────────────────

class SalesLeadOut(BaseModel):
    id: int
    page_id: str
    user_id: int
    status: str
    confidence: float | None
    customer_name: str | None
    phone_number: str | None
    delivery_address: str | None
    product_interest: str | None
    order_notes: str | None
    trigger_message: str | None
    detected_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SalesLeadUpdate(BaseModel):
    status: Literal["interested", "collecting", "pending", "confirmed", "cancelled"]


class LeadListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: list[SalesLeadOut]


class StatusSummary(BaseModel):
    status: str
    count: int


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("", response_model=LeadListResponse)
async def list_leads(
    page_id: str | None = Query(None, description="Filter by Facebook page ID"),
    status: str | None = Query(None, description="Filter by status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """
    List sales leads for the dashboard.
    Supports filtering by page_id and status with pagination.
    """
    q = select(SalesLead).order_by(SalesLead.updated_at.desc())

    if page_id:
        q = q.where(SalesLead.page_id == page_id)
    if status:
        q = q.where(SalesLead.status == status)

    # Total count
    count_q = select(func.count()).select_from(q.subquery())
    total: int = (await db.execute(count_q)).scalar_one()

    # Paginated results
    q = q.offset((page - 1) * page_size).limit(page_size)
    rows = (await db.execute(q)).scalars().all()

    return LeadListResponse(
        total=total,
        page=page,
        page_size=page_size,
        items=[SalesLeadOut.model_validate(r) for r in rows],
    )


@router.get("/summary", response_model=list[StatusSummary])
async def lead_summary(
    page_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Return count per status — useful for dashboard KPI cards.
    e.g. [{"status": "pending", "count": 12}, ...]
    """
    q = (
        select(SalesLead.status, func.count().label("count"))
        .group_by(SalesLead.status)
    )
    if page_id:
        q = q.where(SalesLead.page_id == page_id)

    rows = (await db.execute(q)).all()
    return [StatusSummary(status=r.status, count=r.count) for r in rows]


@router.get("/{lead_id}", response_model=SalesLeadOut)
async def get_lead(lead_id: int, db: AsyncSession = Depends(get_db)):
    """Fetch a single lead by ID."""
    lead = await db.get(SalesLead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return SalesLeadOut.model_validate(lead)


@router.patch("/{lead_id}", response_model=SalesLeadOut)
async def update_lead_status(
    lead_id: int,
    body: SalesLeadUpdate,
    db: AsyncSession = Depends(get_db),
):
    """
    Manually update a lead's status from the dashboard.
    e.g. mark as confirmed or cancelled after a human follow-up.
    """
    lead = await db.get(SalesLead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    lead.status = body.status
    await db.commit()
    await db.refresh(lead)
    return SalesLeadOut.model_validate(lead)