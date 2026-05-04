"""Position endpoints."""

from datetime import date
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from ...database import get_session
from ...shared.envelope import envelope
from ..analytics.mcp_context import build_mcp_context
from ..trades import service as trade_service
from ..trades.models import Trade
from ..trades.schemas import TradeSchema
from ..users.dependencies import CurrentUserDep

router = APIRouter(prefix="/positions", tags=["positions"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]


@router.get("/open")
async def list_open_positions(
    session: SessionDep,
    current_user: CurrentUserDep,
    as_of: Annotated[date | None, Query()] = None,
    ticker: str | None = None,
    strategy: str | None = None,
    dte_max: Annotated[int | None, Query(ge=0)] = None,
) -> dict[str, Any]:
    """Return active positions using the legacy MCP trade row shape."""
    rows = (await session.exec(_trade_query(current_user))).all()
    context = build_mcp_context(list(rows), as_of=as_of or date.today())
    positions = context["activePositions"]
    if ticker:
        positions = [row for row in positions if row["ticker"].upper() == ticker.upper()]
    if strategy:
        positions = [row for row in positions if row["strategy"] == strategy]
    if dte_max is not None:
        positions = [row for row in positions if row.get("dte", 0) <= dte_max]
    return envelope(positions)


@router.get("/expiring")
async def list_expiring_positions(
    session: SessionDep,
    current_user: CurrentUserDep,
    as_of: Annotated[date | None, Query()] = None,
    within_days: Annotated[int, Query(ge=0, le=365)] = 7,
) -> dict[str, Any]:
    rows = (await session.exec(_trade_query(current_user))).all()
    context = build_mcp_context(list(rows), as_of=as_of or date.today())
    expiring = [
        row
        for row in context["activePositions"]
        if row.get("dte") is not None and row["dte"] <= within_days
    ]
    return envelope(sorted(expiring, key=lambda row: row.get("dte", 0)))


@router.get("/{trade_id}")
async def get_position_detail(
    session: SessionDep,
    current_user: CurrentUserDep,
    trade_id: str,
    as_of: Annotated[date | None, Query()] = None,
) -> dict[str, Any]:
    try:
        trade = await trade_service.get_trade(
            session, trade_id, user_id=current_user.id, tenant_id=current_user.tenant_id
        )
    except trade_service.TradeNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    context = build_mcp_context([trade], as_of=as_of or date.today())
    return envelope(
        {
            "trade": TradeSchema.model_validate(trade).model_dump(by_alias=True),
            "context": context,
        }
    )


def _trade_query(current_user: CurrentUserDep) -> Any:
    statement = select(Trade).where(Trade.user_id == current_user.id)
    if current_user.tenant_id is not None:
        statement = statement.where(Trade.tenant_id == current_user.tenant_id)
    return statement
