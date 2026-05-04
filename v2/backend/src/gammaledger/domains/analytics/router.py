"""Analytics endpoints."""

from datetime import date
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from ...database import get_session
from ...shared.envelope import envelope
from ..trades.models import Trade
from ..users.dependencies import CurrentUserDep
from .mcp_context import build_mcp_context

router = APIRouter(prefix="/analytics", tags=["analytics"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]


@router.get("/mcp-context")
async def get_mcp_context(
    session: SessionDep,
    current_user: CurrentUserDep,
    as_of: Annotated[date | None, Query()] = None,
) -> dict[str, Any]:
    """Return a legacy-compatible MCP context snapshot."""
    rows = (await session.exec(_trade_query(current_user))).all()
    return envelope(build_mcp_context(list(rows), as_of=as_of or date.today()))


@router.get("/portfolio-summary")
async def get_portfolio_summary(
    session: SessionDep,
    current_user: CurrentUserDep,
    as_of: Annotated[date | None, Query()] = None,
) -> dict[str, Any]:
    rows = (await session.exec(_trade_query(current_user))).all()
    context = build_mcp_context(list(rows), as_of=as_of or date.today())
    return envelope(context["portfolio"])


@router.get("/strategy-breakdown")
async def get_strategy_breakdown(
    session: SessionDep,
    current_user: CurrentUserDep,
    as_of: Annotated[date | None, Query()] = None,
) -> dict[str, Any]:
    rows = (await session.exec(_trade_query(current_user))).all()
    context = build_mcp_context(list(rows), as_of=as_of or date.today())
    return envelope(context["strategyBreakdown"])


@router.get("/ticker-exposure")
async def get_ticker_exposure(
    session: SessionDep,
    current_user: CurrentUserDep,
    as_of: Annotated[date | None, Query()] = None,
    top_n: Annotated[int, Query(ge=1, le=50)] = 15,
) -> dict[str, Any]:
    rows = (await session.exec(_trade_query(current_user))).all()
    context = build_mcp_context(list(rows), as_of=as_of or date.today())
    return envelope(context["tickerExposure"][:top_n])


def _trade_query(current_user: CurrentUserDep) -> Any:
    statement = select(Trade).where(Trade.user_id == current_user.id)
    if current_user.tenant_id is not None:
        statement = statement.where(Trade.tenant_id == current_user.tenant_id)
    return statement
