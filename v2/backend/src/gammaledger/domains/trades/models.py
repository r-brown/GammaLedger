"""SQLModel domain entities for Trade + Leg.

Field set tracks DOMAIN_MODEL_MAP §2 (Trade) and §3 (Leg) — the persisted
shape only. Runtime fields (pl, roi, lifecycleStatus, etc.) are computed
on read by the pnl domain and never stored.
"""

from datetime import date

from sqlmodel import Field, Relationship, SQLModel


class Leg(SQLModel, table=True):
    __tablename__ = "legs"

    id: str = Field(primary_key=True)
    trade_id: str = Field(foreign_key="trades.id", index=True, ondelete="CASCADE")

    order_type: str  # BTO/STO/BTC/STC
    type: str  # CALL/PUT/STOCK/CASH/FUTURE/ETF
    quantity: float
    multiplier: float

    execution_date: date | None = None
    expiration_date: date | None = None
    strike: float | None = None
    premium: float = 0.0
    fees: float = 0.0
    underlying_price: float | None = None
    underlying_type: str

    trade: "Trade" = Relationship(back_populates="legs")


class Trade(SQLModel, table=True):
    __tablename__ = "trades"

    id: str = Field(primary_key=True)
    user_id: str = Field(default="local", index=True)
    tenant_id: str | None = Field(default=None, index=True)
    portfolio_id: str | None = Field(default=None, index=True)
    ticker: str = Field(index=True)
    strategy: str
    underlying_type: str
    status: str = Field(index=True)

    opened_date: date = Field(index=True)
    closed_date: date | None = None
    expiration_date: date | None = None

    exit_reason: str | None = None
    notes: str | None = None
    max_risk_override: float | None = None
    status_override: str | None = None

    legs: list[Leg] = Relationship(
        back_populates="trade",
        sa_relationship_kwargs={"cascade": "all, delete-orphan", "lazy": "selectin"},
    )
