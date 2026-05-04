"""Strategy endpoints built from the server-computed analytics context."""

from collections import defaultdict
from datetime import date
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from ...database import get_session
from ...shared.envelope import envelope
from ..analytics.mcp_context import build_mcp_context
from ..trades.models import Trade
from ..users.dependencies import CurrentUserDep

router = APIRouter(prefix="/strategies", tags=["strategies"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]


@router.get("/breakdown")
async def get_strategy_breakdown(
    session: SessionDep,
    current_user: CurrentUserDep,
    as_of: Annotated[date | None, Query()] = None,
) -> dict[str, Any]:
    rows = (await session.exec(_trade_query(current_user))).all()
    context = build_mcp_context(list(rows), as_of=as_of or date.today())
    return envelope(context["strategyBreakdown"])


@router.get("/wheel-pmcc")
async def get_wheel_pmcc_positions(
    session: SessionDep,
    current_user: CurrentUserDep,
    as_of: Annotated[date | None, Query()] = None,
) -> dict[str, Any]:
    rows = (await session.exec(_trade_query(current_user))).all()
    context = build_mcp_context(list(rows), as_of=as_of or date.today())
    return envelope(context["wheelPmccPositions"])


@router.get("/csp-groups")
async def get_csp_groups(
    session: SessionDep,
    current_user: CurrentUserDep,
    as_of: Annotated[date | None, Query()] = None,
) -> dict[str, Any]:
    """Group active CSP-like rows by ticker for the credit playbook surface."""
    rows = (await session.exec(_trade_query(current_user))).all()
    context = build_mcp_context(list(rows), as_of=as_of or date.today())
    groups: dict[str, dict[str, Any]] = defaultdict(
        lambda: {"ticker": "", "count": 0, "capitalAtRisk": 0.0, "openPositions": []}
    )
    for position in context["activePositions"]:
        if position["strategy"] not in {"Cash-Secured Put", "Wheel"}:
            continue
        ticker = position["ticker"]
        group = groups[ticker]
        group["ticker"] = ticker
        group["count"] += 1
        group["capitalAtRisk"] = round(group["capitalAtRisk"] + position["capitalAtRisk"], 2)
        group["openPositions"].append(position)
    return envelope(list(groups.values()))


def _trade_query(current_user: CurrentUserDep) -> Any:
    statement = select(Trade).where(Trade.user_id == current_user.id)
    if current_user.tenant_id is not None:
        statement = statement.where(Trade.tenant_id == current_user.tenant_id)
    return statement
