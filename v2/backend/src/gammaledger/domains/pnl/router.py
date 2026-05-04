"""P&L endpoints."""

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

router = APIRouter(prefix="/pnl", tags=["pnl"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]


@router.get("/summary")
async def get_pnl_summary(
    session: SessionDep,
    current_user: CurrentUserDep,
    as_of: Annotated[date | None, Query()] = None,
) -> dict[str, Any]:
    """Return realized/unrealized P&L windows from the MCP-compatible context."""
    statement = select(Trade).where(Trade.user_id == current_user.id)
    if current_user.tenant_id is not None:
        statement = statement.where(Trade.tenant_id == current_user.tenant_id)
    rows = (await session.exec(statement)).all()
    context = build_mcp_context(list(rows), as_of=as_of or date.today())
    return envelope(context["portfolio"]["pl"])
