from datetime import datetime
from typing import Optional
from sqlalchemy import (
    String, Text, Boolean, DateTime, ForeignKey,
    Integer, func
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
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # relationships
    users: Mapped[list["User"]] = relationship("User", back_populates="page", cascade="all, delete-orphan")
    messages: Mapped[list["Message"]] = relationship("Message", back_populates="page", cascade="all, delete-orphan")
    logs: Mapped[list["Log"]] = relationship("Log", back_populates="page", cascade="all, delete-orphan")


class User(Base):
    """One row per (user_id, page_id) pair."""
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True)            # FB sender PSID
    page_id: Mapped[str] = mapped_column(String(64), ForeignKey("pages.id"))
    last_seen: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_blocked: Mapped[bool] = mapped_column(Boolean, default=False)        # opted out of auto-replies
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    page: Mapped["Page"] = relationship("Page", back_populates="users")
    messages: Mapped[list["Message"]] = relationship("Message", back_populates="user")


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
    status: Mapped[str] = mapped_column(String(32), default="sent")         # sent | failed | pending

    page: Mapped["Page"] = relationship("Page", back_populates="messages")
    user: Mapped["User"] = relationship("User", back_populates="messages")


class Log(Base):
    """Raw record of every incoming webhook payload."""
    __tablename__ = "logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    page_id: Mapped[Optional[str]] = mapped_column(String(64), ForeignKey("pages.id"), nullable=True)
    raw_message: Mapped[str] = mapped_column(Text)      # JSON string
    is_processed: Mapped[bool] = mapped_column(Boolean, default=False)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    page: Mapped[Optional["Page"]] = relationship("Page", back_populates="logs")
