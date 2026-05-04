"""Persisted settings and migration metadata.

These tables capture the non-trade localStorage surface documented in
INTEGRATIONS.md §5. API keys are stored as opaque migrated envelopes only; local
users should re-enter live secrets in the v2 UI before any third-party call.
"""

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(UTC)


class LegacyImportBatch(SQLModel, table=True):
    __tablename__ = "legacy_import_batches"

    id: str = Field(primary_key=True)
    user_id: str = Field(default="local", index=True)
    source_version: str | None = None
    export_date: datetime | None = None
    timestamp: datetime | None = None
    file_name: str | None = None
    source_shape: str
    mcp_context: dict[str, Any] | None = Field(default=None, sa_column=Column(JSON))
    source_trade_count: int = 0
    source_leg_count: int = 0
    source_financial_checksum: float = 0.0
    imported_at: datetime = Field(default_factory=_utcnow)


class TradeRuntimeSnapshot(SQLModel, table=True):
    __tablename__ = "trade_runtime_snapshots"

    trade_id: str = Field(foreign_key="trades.id", primary_key=True, ondelete="CASCADE")
    fields: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))


class LegImportMetadata(SQLModel, table=True):
    __tablename__ = "leg_import_metadata"

    leg_id: str = Field(foreign_key="legs.id", primary_key=True, ondelete="CASCADE")
    external_id: str | None = Field(default=None, index=True)
    import_group_id: str | None = Field(default=None, index=True)
    import_source: str | None = None
    import_batch_id: str | None = Field(default=None, index=True)
    ticker_symbol: str | None = Field(default=None, index=True)
    raw: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))


class AppSetting(SQLModel, table=True):
    __tablename__ = "app_settings"

    key: str = Field(primary_key=True)
    value: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    updated_at: datetime = Field(default_factory=_utcnow)


class ConsentRecord(SQLModel, table=True):
    __tablename__ = "consent_records"

    key: str = Field(primary_key=True)
    accepted_at: datetime


class ApiCredentialConfig(SQLModel, table=True):
    __tablename__ = "api_credential_configs"

    service: str = Field(primary_key=True)
    model: str | None = None
    encrypted: bool = False
    payload: dict[str, Any] | None = Field(default=None, sa_column=Column(JSON))
    fallback: str | None = None
    secret_material: str | None = None
    max_tokens: int | None = None
    rate_limit_per_minute: int | None = None
    migrated_plaintext_present: bool = False
    updated_at: datetime = Field(default_factory=_utcnow)
