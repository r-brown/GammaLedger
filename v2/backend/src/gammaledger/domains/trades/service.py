"""Persistence operations for the trades domain.

Routers own HTTP concerns and transaction boundaries. This module keeps the
domain operations testable against an AsyncSession.
"""

from collections.abc import Sequence
from typing import Any, cast

from sqlalchemy import func
from sqlalchemy.orm import selectinload
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from .models import Leg, Trade
from .schemas import TradeCreate, TradeUpdate


class TradeNotFoundError(Exception):
    """Raised when a trade id does not exist."""


class TradeAlreadyExistsError(Exception):
    """Raised when creating a duplicate trade id."""


async def list_trades(
    session: AsyncSession,
    *,
    user_id: str = "local",
    tenant_id: str | None = None,
    ticker: str | None = None,
    status: str | None = None,
    strategy: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> Sequence[Trade]:
    """Return paginated trades ordered by newest opening date first."""
    statement = _filtered_trade_query(
        user_id=user_id, ticker=ticker, status=status, strategy=strategy
    )
    statement = _apply_tenant_filter(statement, tenant_id=tenant_id)
    statement = (
        statement.order_by(col(Trade.opened_date).desc(), Trade.id).offset(offset).limit(limit)
    )
    result = await session.exec(statement)
    return cast(Sequence[Trade], result.all())


async def count_trades(
    session: AsyncSession,
    *,
    user_id: str = "local",
    tenant_id: str | None = None,
    ticker: str | None = None,
    status: str | None = None,
    strategy: str | None = None,
) -> int:
    """Count trades matching the list filters."""
    statement: Any = select(func.count()).select_from(Trade)
    statement = _apply_filters(
        statement, user_id=user_id, ticker=ticker, status=status, strategy=strategy
    )
    statement = _apply_tenant_filter(statement, tenant_id=tenant_id)
    result = await session.exec(statement)
    return int(result.one())


async def get_trade(
    session: AsyncSession,
    trade_id: str,
    *,
    user_id: str = "local",
    tenant_id: str | None = None,
) -> Trade:
    """Fetch a trade with legs or raise TradeNotFoundError."""
    statement = (
        select(Trade)
        .where(Trade.id == trade_id, Trade.user_id == user_id)
        .options(selectinload(Trade.legs))  # type: ignore[arg-type]
    )
    statement = _apply_tenant_filter(statement, tenant_id=tenant_id)
    result = await session.exec(statement)
    trade = result.one_or_none()
    if trade is None:
        raise TradeNotFoundError(f"Trade {trade_id} not found")
    return trade


async def create_trade(
    session: AsyncSession,
    payload: TradeCreate,
    *,
    user_id: str = "local",
    tenant_id: str | None = None,
) -> Trade:
    """Create a trade and its legs. Caller commits."""
    existing = await get_trade_or_none(session, payload.id, user_id=user_id, tenant_id=tenant_id)
    if existing is not None:
        raise TradeAlreadyExistsError(f"Trade {payload.id} already exists")

    trade = _build_trade(payload, user_id=user_id, tenant_id=tenant_id)
    session.add(trade)
    await session.flush()
    await session.refresh(trade, attribute_names=["legs"])
    return trade


async def upsert_trade(
    session: AsyncSession,
    payload: TradeCreate,
    *,
    user_id: str = "local",
    tenant_id: str | None = None,
) -> Trade:
    """Replace an existing trade or create a new one. Caller commits."""
    existing = await get_trade_or_none(session, payload.id, user_id=user_id, tenant_id=tenant_id)
    if existing is not None:
        await session.delete(existing)
        await session.flush()
    trade = _build_trade(payload, user_id=user_id, tenant_id=tenant_id)
    session.add(trade)
    await session.flush()
    await session.refresh(trade, attribute_names=["legs"])
    return trade


async def update_trade(
    session: AsyncSession,
    trade_id: str,
    payload: TradeUpdate,
    *,
    user_id: str = "local",
    tenant_id: str | None = None,
) -> Trade:
    """Patch persisted trade-level fields. Caller commits."""
    trade = await get_trade(session, trade_id, user_id=user_id, tenant_id=tenant_id)
    data: dict[str, Any] = payload.model_dump(exclude_unset=True)
    legs = data.pop("legs", None)
    if "ticker" in data and data["ticker"] is not None:
        data["ticker"] = data["ticker"].upper()
    for key, value in data.items():
        setattr(trade, key, value)
    if legs is not None:
        trade.legs = [Leg(**leg, trade_id=trade.id) for leg in legs]
    session.add(trade)
    await session.flush()
    await session.refresh(trade, attribute_names=["legs"])
    return trade


async def delete_trade(
    session: AsyncSession, trade_id: str, *, user_id: str = "local", tenant_id: str | None = None
) -> None:
    """Delete a trade and cascade-delete its legs. Caller commits."""
    trade = await get_trade(session, trade_id, user_id=user_id, tenant_id=tenant_id)
    await session.delete(trade)
    await session.flush()


async def delete_trades(
    session: AsyncSession,
    trade_ids: Sequence[str],
    *,
    user_id: str = "local",
    tenant_id: str | None = None,
) -> tuple[int, list[str]]:
    """Bulk-delete trades by id. Caller commits."""
    deleted = 0
    missing: list[str] = []
    for trade_id in trade_ids:
        trade = await get_trade_or_none(
            session, trade_id, user_id=user_id, tenant_id=tenant_id
        )
        if trade is None:
            missing.append(trade_id)
            continue
        await session.delete(trade)
        deleted += 1
    await session.flush()
    return deleted, missing


async def get_trade_or_none(
    session: AsyncSession, trade_id: str, *, user_id: str, tenant_id: str | None = None
) -> Trade | None:
    """Fetch a trade owned by user_id or return None."""
    result = await session.exec(
        _apply_tenant_filter(
            select(Trade).where(Trade.id == trade_id, Trade.user_id == user_id),
            tenant_id=tenant_id,
        )
    )
    return result.one_or_none()


def _build_trade(payload: TradeCreate, *, user_id: str, tenant_id: str | None = None) -> Trade:
    data = payload.model_dump(exclude={"legs"})
    data["ticker"] = data["ticker"].upper()
    data["user_id"] = user_id
    data["tenant_id"] = tenant_id
    trade = Trade(**data)
    trade.legs = [Leg(**leg.model_dump(), trade_id=trade.id) for leg in payload.legs]
    return trade


def _filtered_trade_query(
    *,
    user_id: str,
    ticker: str | None,
    status: str | None,
    strategy: str | None,
) -> Any:
    statement = select(Trade)
    return _apply_filters(
        statement, user_id=user_id, ticker=ticker, status=status, strategy=strategy
    )


def _apply_filters(
    statement: Any,
    *,
    user_id: str,
    ticker: str | None,
    status: str | None,
    strategy: str | None,
) -> Any:
    statement = statement.where(Trade.user_id == user_id)
    if ticker:
        statement = statement.where(func.upper(Trade.ticker) == ticker.upper())
    if status:
        statement = statement.where(col(Trade.status) == status)
    if strategy:
        statement = statement.where(col(Trade.strategy) == strategy)
    return statement


def _apply_tenant_filter(statement: Any, *, tenant_id: str | None) -> Any:
    if tenant_id is not None:
        statement = statement.where(Trade.tenant_id == tenant_id)
    return statement
