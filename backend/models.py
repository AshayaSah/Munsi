from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import (
    String, Text, Boolean, DateTime, ForeignKey,
    Integer, Float, func
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base


class Page(Base):
    """One row per Facebook Page."""
    __tablename__ = "pages"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(256))
    access_token: Mapped[str] = mapped_column(Text)
    ai_instructions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    user_fb_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    users: Mapped[list["User"]] = relationship("User", back_populates="page", cascade="all, delete-orphan")
    messages: Mapped[list["Message"]] = relationship("Message", back_populates="page", cascade="all, delete-orphan")
    logs: Mapped[list["Log"]] = relationship("Log", back_populates="page", cascade="all, delete-orphan")
    sales_leads: Mapped[list["SalesLead"]] = relationship("SalesLead", back_populates="page", cascade="all, delete-orphan")


class User(Base):
    """
    One row per (user_id, page_id) pair.

    Contact memory fields (phone_number, delivery_address) are stored here
    so they are remembered across all orders and pre-filled into new leads.
    The lead detector updates these whenever it extracts fresher values.
    """
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True)            # FB sender PSID
    page_id: Mapped[str] = mapped_column(String(64), ForeignKey("pages.id"))
    last_seen: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_blocked: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # ── Persistent contact memory ─────────────────────────────────────────────
    # These are updated every time the detector finds a cleaner value.
    # They are injected into the AI system prompt for new conversations so the
    # bot can say "shall I use your previous address?" rather than asking again.
    remembered_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    remembered_phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    remembered_address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    page: Mapped["Page"] = relationship("Page", back_populates="users")
    messages: Mapped[list["Message"]] = relationship("Message", back_populates="user")
    sales_leads: Mapped[list["SalesLead"]] = relationship("SalesLead", back_populates="user")


class Message(Base):
    """Full conversation history."""
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    fb_message_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True, unique=True)
    page_id: Mapped[str] = mapped_column(String(64), ForeignKey("pages.id"))
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"))
    from_role: Mapped[str] = mapped_column(String(16))   # "user" | "ai"
    content: Mapped[str] = mapped_column(Text)
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    status: Mapped[str] = mapped_column(String(32), default="sent")

    page: Mapped["Page"] = relationship("Page", back_populates="messages")
    user: Mapped["User"] = relationship("User", back_populates="messages")


class Log(Base):
    """Raw record of every incoming webhook payload."""
    __tablename__ = "logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    page_id: Mapped[Optional[str]] = mapped_column(String(64), ForeignKey("pages.id"), nullable=True)
    raw_message: Mapped[str] = mapped_column(Text)
    is_processed: Mapped[bool] = mapped_column(Boolean, default=False)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    page: Mapped[Optional["Page"]] = relationship("Page", back_populates="logs")


class SalesLead(Base):
    """
    One row per ORDER (not per user).

    Each distinct order the customer places gets its own SalesLead row,
    identified by order_ref_id (a short human-readable key like "ORD-0001").

    Multiple orders from the same user are linked via user_id.
    An order that replaces/cancels another references it via parent_lead_id.

    Status lifecycle:
        interested → collecting → pending → confirmed → delivered
                                                      → cancelled
    """
    __tablename__ = "sales_leads"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    page_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("pages.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ── Per-order identity ────────────────────────────────────────────────────
    # A short, stable key assigned when the order is first created so the AI
    # and detector can reference a specific order across messages.
    # Format: "ORD-<4-digit-zero-padded-id>" assigned after first flush.
    order_ref_id: Mapped[Optional[str]] = mapped_column(String(32), nullable=True, index=True)

    # Links to a previous order this one modifies or replaces (optional).
    parent_lead_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("sales_leads.id", ondelete="SET NULL"), nullable=True
    )

    # ── Lead status ───────────────────────────────────────────────────────────
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="interested",
        index=True,
    )

    # ── Customer / order details ──────────────────────────────────────────────
    customer_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    phone_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    delivery_address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    product_interest: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    order_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    raw_extracted_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # ── Confidence & trigger ──────────────────────────────────────────────────
    confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    trigger_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # ── Timestamps ────────────────────────────────────────────────────────────
    detected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    page: Mapped["Page"] = relationship("Page", back_populates="sales_leads")
    user: Mapped["User"] = relationship("User", back_populates="sales_leads")

    # Self-referential: child orders can reference a parent order
    parent_lead: Mapped[Optional["SalesLead"]] = relationship(
        "SalesLead", remote_side="SalesLead.id", foreign_keys=[parent_lead_id]
    )

    def __repr__(self) -> str:
        return (
            f"<SalesLead id={self.id} ref={self.order_ref_id!r} "
            f"status={self.status!r} user_id={self.user_id}>"
        )