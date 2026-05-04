"""Hosted auth and multi-user persistence models.

The tables mirror the FastAPI-Users user surface while keeping SQLModel as the
project ORM. Local mode can run without persisted users because the dependency
injects the synthetic LOCAL_USER_ID.
"""

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


def utcnow() -> datetime:
    """Return a timezone-aware UTC timestamp."""
    return datetime.now(UTC)


class User(SQLModel, table=True):
    """Application user account."""

    __tablename__ = "users"

    id: str = Field(primary_key=True)
    email: str = Field(unique=True, index=True)
    hashed_password: str
    is_verified: bool = Field(default=False, index=True)
    is_active: bool = Field(default=True, index=True)
    created_at: datetime = Field(default_factory=utcnow)
    last_login_at: datetime | None = None


class UserProfile(SQLModel, table=True):
    """User profile and default portfolio pointer."""

    __tablename__ = "user_profiles"

    user_id: str = Field(foreign_key="users.id", primary_key=True, ondelete="CASCADE")
    display_name: str | None = None
    timezone: str = "UTC"
    currency: str = "USD"
    default_portfolio_id: str | None = Field(default=None, index=True)


class Portfolio(SQLModel, table=True):
    """User-owned portfolio container."""

    __tablename__ = "portfolios"

    id: str = Field(primary_key=True)
    user_id: str = Field(foreign_key="users.id", index=True, ondelete="CASCADE")
    tenant_id: str | None = Field(default=None, index=True)
    name: str
    description: str | None = None
    is_default: bool = Field(default=False, index=True)
    created_at: datetime = Field(default_factory=utcnow)


class UserPreferences(SQLModel, table=True):
    """Hosted user preferences."""

    __tablename__ = "user_preferences"

    user_id: str = Field(foreign_key="users.id", primary_key=True, ondelete="CASCADE")
    theme: str = "system"
    date_format: str = "YYYY-MM-DD"
    number_format: str = "en-US"
    notification_settings: dict[str, Any] = Field(
        default_factory=dict, sa_column=Column(JSON, nullable=False)
    )


class RefreshToken(SQLModel, table=True):
    """Hashed refresh tokens for rotation and revocation."""

    __tablename__ = "refresh_tokens"

    token_hash: str = Field(primary_key=True)
    user_id: str = Field(foreign_key="users.id", index=True, ondelete="CASCADE")
    expires_at: datetime = Field(index=True)
    revoked_at: datetime | None = Field(default=None, index=True)
    created_at: datetime = Field(default_factory=utcnow)


class AuditLog(SQLModel, table=True):
    """Write audit log scoped by user."""

    __tablename__ = "audit_logs"

    id: str = Field(primary_key=True)
    user_id: str = Field(index=True)
    action: str = Field(index=True)
    entity: str = Field(index=True)
    entity_id: str | None = Field(default=None, index=True)
    timestamp: datetime = Field(default_factory=utcnow, index=True)
    detail: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))

