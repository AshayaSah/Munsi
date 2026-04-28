"""
routes/analytics.py

Analytics dashboard API.

Reads directly from the existing tables — no new models, no new columns.
All endpoints accept optional page_id + date range filters so the frontend
can scope the dashboard to a single page or look across all pages.

Mount in main.py:
    from routes.analytics import router as analytics_router
    app.include_router(analytics_router)
"""

from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select, func, and_, case
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Message, User, SalesLead, Log, Page

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


# ── Helpers ──────────────────────────────────────────────────────────────────

def _resolve_range(
    start: Optional[datetime],
    end: Optional[datetime],
    days: int,
) -> tuple[datetime, datetime]:
    """Default to the last `days` days if start/end aren't given."""
    now = datetime.now(timezone.utc)
    end = end or now
    start = start or (end - timedelta(days=days))
    return start, end


def _apply_page_filter(stmt, model, page_id: Optional[str]):
    if page_id:
        stmt = stmt.where(model.page_id == page_id)
    return stmt


# ── Schemas ──────────────────────────────────────────────────────────────────

class OverviewResponse(BaseModel):
    range_start: datetime
    range_end: datetime
    total_messages: int
    user_messages: int
    ai_messages: int
    unique_users: int
    new_users: int
    failed_replies: int
    reply_failure_rate: float        # percent, 0–100
    total_leads: int
    confirmed_leads: int
    conversion_rate: float           # confirmed / unique_users, percent


class HourlyBucket(BaseModel):
    day_of_week: int                 # 0=Mon … 6=Sun
    hour: int                        # 0–23
    count: int


class HeatmapResponse(BaseModel):
    range_start: datetime
    range_end: datetime
    buckets: list[HourlyBucket]


class TimeseriesPoint(BaseModel):
    date: str                        # ISO date YYYY-MM-DD
    user_messages: int
    ai_messages: int
    total: int


class TimeseriesResponse(BaseModel):
    range_start: datetime
    range_end: datetime
    points: list[TimeseriesPoint]


class TopUser(BaseModel):
    user_id: int
    fb_user_id: str
    page_id: str
    message_count: int
    last_seen: Optional[datetime]


class TopUsersResponse(BaseModel):
    range_start: datetime
    range_end: datetime
    users: list[TopUser]


class StatusCount(BaseModel):
    status: str
    count: int


class LeadFunnelResponse(BaseModel):
    range_start: datetime
    range_end: datetime
    statuses: list[StatusCount]
    total: int


class PageActivity(BaseModel):
    page_id: str
    page_name: str
    is_active: bool
    message_count: int
    unique_users: int
    confirmed_leads: int


class PagesActivityResponse(BaseModel):
    range_start: datetime
    range_end: datetime
    pages: list[PageActivity]


# ── 1. Overview KPIs ─────────────────────────────────────────────────────────

@router.get("/overview", response_model=OverviewResponse)
async def overview(
    page_id: Optional[str] = Query(None),
    start: Optional[datetime] = Query(None),
    end: Optional[datetime] = Query(None),
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
):
    """
    Top-level KPI cards for the dashboard.
    Defaults to the last 30 days if no range is given.
    """
    start, end = _resolve_range(start, end, days)

    # Messages — totals + per role
    msg_q = select(
        func.count().label("total"),
        func.sum(case((Message.from_role == "user", 1), else_=0)).label("user"),
        func.sum(case((Message.from_role == "ai", 1), else_=0)).label("ai"),
        func.sum(case((Message.status == "failed", 1), else_=0)).label("failed"),
    ).where(Message.sent_at.between(start, end))
    msg_q = _apply_page_filter(msg_q, Message, page_id)
    msg_row = (await db.execute(msg_q)).one()

    total_messages = msg_row.total or 0
    user_messages = msg_row.user or 0
    ai_messages = msg_row.ai or 0
    failed = msg_row.failed or 0

    # Unique users who sent a message in the range
    uniq_q = (
        select(func.count(func.distinct(Message.user_id)))
        .where(
            Message.sent_at.between(start, end),
            Message.from_role == "user",
        )
    )
    uniq_q = _apply_page_filter(uniq_q, Message, page_id)
    unique_users = (await db.execute(uniq_q)).scalar_one() or 0

    # New users — User.created_at falls inside the range
    new_q = select(func.count()).select_from(User).where(
        User.created_at.between(start, end)
    )
    new_q = _apply_page_filter(new_q, User, page_id)
    new_users = (await db.execute(new_q)).scalar_one() or 0

    # Leads
    lead_q = select(
        func.count().label("total"),
        func.sum(case((SalesLead.status == "confirmed", 1), else_=0)).label("confirmed"),
    ).where(SalesLead.detected_at.between(start, end))
    lead_q = _apply_page_filter(lead_q, SalesLead, page_id)
    lead_row = (await db.execute(lead_q)).one()
    total_leads = lead_row.total or 0
    confirmed_leads = lead_row.confirmed or 0

    failure_rate = round((failed / ai_messages) * 100, 2) if ai_messages else 0.0
    conversion_rate = round((confirmed_leads / unique_users) * 100, 2) if unique_users else 0.0

    return OverviewResponse(
        range_start=start,
        range_end=end,
        total_messages=total_messages,
        user_messages=user_messages,
        ai_messages=ai_messages,
        unique_users=unique_users,
        new_users=new_users,
        failed_replies=failed,
        reply_failure_rate=failure_rate,
        total_leads=total_leads,
        confirmed_leads=confirmed_leads,
        conversion_rate=conversion_rate,
    )


# ── 2. Hour-of-day × day-of-week heatmap ─────────────────────────────────────

@router.get("/heatmap", response_model=HeatmapResponse)
async def heatmap(
    page_id: Optional[str] = Query(None),
    start: Optional[datetime] = Query(None),
    end: Optional[datetime] = Query(None),
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns a grid of message counts for every (day_of_week, hour) bucket.
    Frontend can render this as a 7×24 heatmap.

    day_of_week is 0–6 where 0 = Monday (Python's weekday() convention).
    Counts user-sent messages only — that's what the page actually receives.
    """
    start, end = _resolve_range(start, end, days)

    # extract() on a TIMESTAMP gives ISO weekday (1=Mon..7=Sun in Postgres).
    # We normalize to 0=Mon..6=Sun in Python after the fetch.
    dow = func.extract("isodow", Message.sent_at).label("dow")
    hour = func.extract("hour", Message.sent_at).label("hour")

    q = (
        select(dow, hour, func.count().label("count"))
        .where(
            Message.sent_at.between(start, end),
            Message.from_role == "user",
        )
        .group_by(dow, hour)
    )
    q = _apply_page_filter(q, Message, page_id)

    rows = (await db.execute(q)).all()
    buckets = [
        HourlyBucket(
            day_of_week=int(r.dow) - 1,   # 1..7 → 0..6
            hour=int(r.hour),
            count=r.count,
        )
        for r in rows
    ]
    return HeatmapResponse(range_start=start, range_end=end, buckets=buckets)


# ── 3. Daily timeseries ──────────────────────────────────────────────────────

@router.get("/timeseries", response_model=TimeseriesResponse)
async def timeseries(
    page_id: Optional[str] = Query(None),
    start: Optional[datetime] = Query(None),
    end: Optional[datetime] = Query(None),
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
):
    """
    Daily message counts split into user vs AI.
    Fills in zero-count days so the frontend gets a continuous series.
    """
    start, end = _resolve_range(start, end, days)

    day = func.date_trunc("day", Message.sent_at).label("day")
    q = (
        select(
            day,
            func.sum(case((Message.from_role == "user", 1), else_=0)).label("user_count"),
            func.sum(case((Message.from_role == "ai", 1), else_=0)).label("ai_count"),
        )
        .where(Message.sent_at.between(start, end))
        .group_by(day)
        .order_by(day)
    )
    q = _apply_page_filter(q, Message, page_id)
    rows = (await db.execute(q)).all()

    # index by date string for gap-filling
    by_date = {
        r.day.date().isoformat(): (r.user_count or 0, r.ai_count or 0)
        for r in rows
    }

    points: list[TimeseriesPoint] = []
    cursor = start.date()
    end_date = end.date()
    while cursor <= end_date:
        key = cursor.isoformat()
        u, a = by_date.get(key, (0, 0))
        points.append(TimeseriesPoint(
            date=key, user_messages=u, ai_messages=a, total=u + a
        ))
        cursor += timedelta(days=1)

    return TimeseriesResponse(range_start=start, range_end=end, points=points)


# ── 4. Top users by message volume ───────────────────────────────────────────

@router.get("/top-users", response_model=TopUsersResponse)
async def top_users(
    page_id: Optional[str] = Query(None),
    start: Optional[datetime] = Query(None),
    end: Optional[datetime] = Query(None),
    days: int = Query(30, ge=1, le=365),
    limit: int = Query(10, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Most active customers in the range — useful for spotting power users."""
    start, end = _resolve_range(start, end, days)

    count_col = func.count(Message.id).label("count")
    q = (
        select(
            User.id,
            User.user_id,
            User.page_id,
            User.last_seen,
            count_col,
        )
        .join(Message, Message.user_id == User.id)
        .where(
            Message.sent_at.between(start, end),
            Message.from_role == "user",
        )
        .group_by(User.id, User.user_id, User.page_id, User.last_seen)
        .order_by(count_col.desc())
        .limit(limit)
    )
    if page_id:
        q = q.where(User.page_id == page_id)

    rows = (await db.execute(q)).all()
    return TopUsersResponse(
        range_start=start,
        range_end=end,
        users=[
            TopUser(
                user_id=r.id,
                fb_user_id=r.user_id,
                page_id=r.page_id,
                message_count=r.count,
                last_seen=r.last_seen,
            )
            for r in rows
        ],
    )


# ── 5. Lead funnel ───────────────────────────────────────────────────────────

@router.get("/lead-funnel", response_model=LeadFunnelResponse)
async def lead_funnel(
    page_id: Optional[str] = Query(None),
    start: Optional[datetime] = Query(None),
    end: Optional[datetime] = Query(None),
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
):
    """
    Lead count grouped by status — your conversion funnel.
    Always returns all 5 statuses (zero-filled) so the frontend can render
    a stable funnel chart.
    """
    start, end = _resolve_range(start, end, days)

    q = (
        select(SalesLead.status, func.count().label("count"))
        .where(SalesLead.detected_at.between(start, end))
        .group_by(SalesLead.status)
    )
    q = _apply_page_filter(q, SalesLead, page_id)
    rows = (await db.execute(q)).all()
    counts = {r.status: r.count for r in rows}

    all_statuses = ["interested", "collecting", "pending", "confirmed", "cancelled"]
    statuses = [StatusCount(status=s, count=counts.get(s, 0)) for s in all_statuses]
    total = sum(s.count for s in statuses)

    return LeadFunnelResponse(
        range_start=start, range_end=end, statuses=statuses, total=total
    )


# ── 6. Per-page activity (for the "all pages" view) ──────────────────────────

@router.get("/pages-activity", response_model=PagesActivityResponse)
async def pages_activity(
    start: Optional[datetime] = Query(None),
    end: Optional[datetime] = Query(None),
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
):
    """
    Per-page activity table — one row per page with message volume,
    unique users, and confirmed leads. Lets the dashboard surface
    which pages are actually generating sales.
    """
    start, end = _resolve_range(start, end, days)

    msg_q = (
        select(
            Message.page_id,
            func.count(Message.id).label("messages"),
            func.count(func.distinct(Message.user_id)).label("users"),
        )
        .where(Message.sent_at.between(start, end))
        .group_by(Message.page_id)
    )
    msg_rows = {r.page_id: r for r in (await db.execute(msg_q)).all()}

    lead_q = (
        select(SalesLead.page_id, func.count().label("confirmed"))
        .where(
            SalesLead.detected_at.between(start, end),
            SalesLead.status == "confirmed",
        )
        .group_by(SalesLead.page_id)
    )
    lead_rows = {r.page_id: r.confirmed for r in (await db.execute(lead_q)).all()}

    pages = (await db.execute(select(Page))).scalars().all()
    out: list[PageActivity] = []
    for p in pages:
        m = msg_rows.get(p.id)
        out.append(PageActivity(
            page_id=p.id,
            page_name=p.name,
            is_active=p.is_active,
            message_count=m.messages if m else 0,
            unique_users=m.users if m else 0,
            confirmed_leads=lead_rows.get(p.id, 0),
        ))

    # sort most-active first
    out.sort(key=lambda x: x.message_count, reverse=True)

    return PagesActivityResponse(range_start=start, range_end=end, pages=out)