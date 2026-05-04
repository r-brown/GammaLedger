"""Feature flag and usage-metering models."""

from datetime import UTC, datetime

from sqlmodel import Field, SQLModel


def utcnow() -> datetime:
    """Return current UTC timestamp."""
    return datetime.now(UTC)


class FeatureFlag(SQLModel, table=True):
    """Per-user entitlement flag."""

    __tablename__ = "feature_flags"

    id: str = Field(primary_key=True)
    user_id: str = Field(index=True)
    feature_name: str = Field(index=True)
    enabled: bool = Field(default=False, index=True)
    limit_value: int | None = None
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


class UsageEvent(SQLModel, table=True):
    """Aggregated monthly feature usage."""

    __tablename__ = "usage_events"

    id: str = Field(primary_key=True)
    user_id: str = Field(index=True)
    feature: str = Field(index=True)
    count: int = 0
    period: str = Field(index=True)
    updated_at: datetime = Field(default_factory=utcnow)

