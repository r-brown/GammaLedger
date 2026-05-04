"""White-label tenant models."""

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


def utcnow() -> datetime:
    """Return current UTC timestamp."""
    return datetime.now(UTC)


class Tenant(SQLModel, table=True):
    """Hosted tenant / white-label account."""

    __tablename__ = "tenants"

    id: str = Field(primary_key=True)
    slug: str = Field(unique=True, index=True)
    name: str
    domain: str | None = Field(default=None, unique=True, index=True)
    logo_url: str | None = None
    primary_color: str = "#21808d"
    secondary_color: str = "#5900c6"
    font_family: str = "Inter, Roboto, system-ui, sans-serif"
    is_active: bool = Field(default=True, index=True)
    plan: str = Field(default="FREE", index=True)
    created_at: datetime = Field(default_factory=utcnow)


class TenantSettings(SQLModel, table=True):
    """Tenant-specific key/value settings."""

    __tablename__ = "tenant_settings"

    id: str = Field(primary_key=True)
    tenant_id: str = Field(foreign_key="tenants.id", index=True, ondelete="CASCADE")
    setting_key: str = Field(index=True)
    setting_value: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))

