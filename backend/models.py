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

    id: Mapped[str] = mapped_column(String(64), primary_key=True)          # FB Page ID
    name: Mapped[str] = mapped_column(String(256))
    access_token: Mapped[str] = mapped_column(Text)
    ai_instructions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    user_fb_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True) 
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # relationships
    users: Mapped[list["User"]] = relationship("User", back_populates="page", cascade="all, delete-orphan")
    messages: Mapped[list["Message"]] = relationship("Message", back_populates="page", cascade="all, delete-orphan")
    logs: Mapped[list["Log"]] = relationship("Log", back_populates="page", cascade="all, delete-orphan")
    sales_leads: Mapped[list["SalesLead"]] = relationship("SalesLead", back_populates="page", cascade="all, delete-orphan")


class User(Base):
    """One row per (user_id, page_id) pair."""
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True)            # FB sender PSID
    page_id: Mapped[str] = mapped_column(String(64), ForeignKey("pages.id"))
    last_seen: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_blocked: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

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
    Detected sales opportunity extracted from a Messenger conversation.

    Lead status lifecycle:
      interested → collecting → pending → confirmed
                                        → cancelled
    """
    __tablename__ = "sales_leads"

    # ── Primary key ───────────────────────────────────────────────────────────
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # ── Foreign keys — both reference "pages.id" (the actual PK column name) ──
    page_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("pages.id", ondelete="CASCADE"),   # ← was "pages.page_id" (wrong)
        nullable=False,
        index=True,
    )
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ── Lead status ───────────────────────────────────────────────────────────
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="interested",
        index=True,
    )

    # ── Customer / order details ──────────────────────────────────────────────
    customer_name: Mapped[str | None]      = mapped_column(String(255), nullable=True)
    phone_number: Mapped[str | None]       = mapped_column(String(50),  nullable=True)
    delivery_address: Mapped[str | None]   = mapped_column(Text,        nullable=True)
    product_interest: Mapped[str | None]   = mapped_column(Text,        nullable=True)
    order_notes: Mapped[str | None]        = mapped_column(Text,        nullable=True)
    raw_extracted_json: Mapped[str | None] = mapped_column(Text,        nullable=True)

    # ── Confidence & trigger ──────────────────────────────────────────────────
    confidence: Mapped[float | None]     = mapped_column(Float,  nullable=True)
    trigger_message: Mapped[str | None]  = mapped_column(Text,   nullable=True)

    # ── Timestamps ────────────────────────────────────────────────────────────
    detected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),  # ← timezone now imported
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

    def __repr__(self) -> str:
        return (
            f"<SalesLead id={self.id} status={self.status!r} "
            f"user_id={self.user_id} page={self.page_id!r}>"
        )