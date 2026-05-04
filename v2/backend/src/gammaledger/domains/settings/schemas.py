"""Pydantic schemas for settings and migration metadata."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class _Base(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class LegacyImportBatchSchema(_Base):
    id: str
    source_version: str | None = None
    export_date: datetime | None = None
    timestamp: datetime | None = None
    file_name: str | None = None
    source_shape: str
    mcp_context: dict[str, Any] | None = None
    source_trade_count: int
    source_leg_count: int
    source_financial_checksum: float
    imported_at: datetime


class TradeRuntimeSnapshotSchema(_Base):
    trade_id: str
    fields: dict[str, Any]


class LegImportMetadataSchema(_Base):
    leg_id: str
    external_id: str | None = None
    import_group_id: str | None = None
    import_source: str | None = None
    import_batch_id: str | None = None
    ticker_symbol: str | None = None
    raw: dict[str, Any]


class AppSettingSchema(_Base):
    key: str
    value: dict[str, Any]
    updated_at: datetime


class ConsentRecordSchema(_Base):
    key: str
    accepted_at: datetime


class ApiCredentialConfigSchema(_Base):
    service: str
    model: str | None = None
    encrypted: bool
    payload: dict[str, Any] | None = None
    fallback: str | None = None
    secret_material: str | None = None
    max_tokens: int | None = None
    rate_limit_per_minute: int | None = None
    migrated_plaintext_present: bool
    updated_at: datetime
