"""Pydantic schemas — wire format mirrors the v2.5 JSON (camelCase aliases),
DB attributes stay snake_case. Round-trips losslessly via populate_by_name.
"""

from datetime import date
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic.alias_generators import to_camel

from .constants import LEG_TYPES, ORDER_TYPES, TRADE_STATUSES, UNDERLYING_TYPES


def _empty_str_to_none(v: Any) -> Any:
    return None if v == "" else v


class _Base(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class LegSchema(_Base):
    id: str
    order_type: Literal[ORDER_TYPES]  # type: ignore[valid-type]
    type: Literal[LEG_TYPES]  # type: ignore[valid-type]
    quantity: float
    multiplier: float
    execution_date: date | None = None
    expiration_date: date | None = None
    strike: float | None = None
    premium: float = 0.0
    fees: float = 0.0
    underlying_price: float | None = None
    underlying_type: str

    @field_validator(
        "execution_date", "expiration_date", "strike", "underlying_price", mode="before"
    )
    @classmethod
    def _empty_to_none(cls, v: Any) -> Any:
        return _empty_str_to_none(v)


class TradeSchema(_Base):
    id: str
    ticker: str
    strategy: str
    underlying_type: Literal[UNDERLYING_TYPES]  # type: ignore[valid-type]
    status: Literal[TRADE_STATUSES]  # type: ignore[valid-type]
    opened_date: date
    closed_date: date | None = None
    expiration_date: date | None = None
    exit_reason: str | None = None
    notes: str | None = None
    max_risk_override: float | None = None
    status_override: str | None = None
    legs: Annotated[list[LegSchema], Field(default_factory=list)]

    @field_validator("closed_date", "expiration_date", mode="before")
    @classmethod
    def _empty_to_none(cls, v: Any) -> Any:
        return _empty_str_to_none(v)


class TradeListItem(_Base):
    """Lightweight list-view shape (no legs)."""

    id: str
    ticker: str
    strategy: str
    status: str
    opened_date: date
    closed_date: date | None = None


class TradeCreate(TradeSchema):
    """Same shape as TradeSchema — id is client-supplied (TRD-XXXX format)."""


class TradeUpdate(_Base):
    """Partial update. When legs is supplied it replaces the full leg set.

    The legacy GammaLedger editor treats the trade and its legs as one editable
    document, so the v2 API supports the same save semantics.
    """

    ticker: str | None = None
    strategy: str | None = None
    underlying_type: str | None = None
    status: str | None = None
    opened_date: date | None = None
    closed_date: date | None = None
    expiration_date: date | None = None
    exit_reason: str | None = None
    notes: str | None = None
    max_risk_override: float | None = None
    status_override: str | None = None
    legs: list[LegSchema] | None = None


class BulkDeleteRequest(_Base):
    ids: Annotated[list[str], Field(min_length=1, max_length=500)]


class BulkDeleteResult(_Base):
    requested: int
    deleted: int
    missing: list[str]


class OfxImportResult(_Base):
    imported: int
    replaced: int
    skipped: int
    errors: list[str]
    message: str
