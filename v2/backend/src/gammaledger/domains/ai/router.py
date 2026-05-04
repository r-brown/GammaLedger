"""AI assistant endpoints."""

from datetime import date
from typing import Annotated, Any

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from ...database import get_session
from ...shared.envelope import envelope
from ..analytics.mcp_context import build_mcp_context
from ..monetization import service as monetization_service
from ..trades import service as trade_service
from ..trades.models import Trade
from ..users.dependencies import CurrentUserDep
from . import service
from .schemas import AIAnalysisResponse, AIChatRequest, TradeAnalysisRequest

router = APIRouter(prefix="/ai", tags=["ai"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]


@router.get("/features")
async def get_ai_features() -> dict[str, Any]:
    return envelope(service.feature_flags())


@router.post("/chat")
async def chat(session: SessionDep, current_user: CurrentUserDep, payload: AIChatRequest) -> dict[str, Any]:
    await _require_ai(session, current_user)
    rows = (await session.exec(_trade_query(current_user))).all()
    as_of = date.fromisoformat(payload.as_of) if payload.as_of else date.today()
    context = build_mcp_context(list(rows), as_of=as_of)
    try:
        message, provider, external = await service.analyze_with_ai(
            user_message=payload.message,
            context=context,
            history=[item.model_dump() for item in payload.history],
        )
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    result = AIAnalysisResponse(
        message=message,
        provider=provider,
        external_call=external,
        feature_flags=service.feature_flags(),
    )
    await monetization_service.increment_usage(
        session, user_id=current_user.id, feature="ai_assistant"
    )
    await session.commit()
    return envelope(result.model_dump(by_alias=True))


@router.post("/trades/{trade_id}/analysis")
async def analyze_trade(
    session: SessionDep, current_user: CurrentUserDep, trade_id: str, payload: TradeAnalysisRequest
) -> dict[str, Any]:
    await _require_ai(session, current_user)
    try:
        trade = await trade_service.get_trade(
            session, trade_id, user_id=current_user.id, tenant_id=current_user.tenant_id
        )
    except trade_service.TradeNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    as_of = date.fromisoformat(payload.as_of) if payload.as_of else date.today()
    context = build_mcp_context([trade], as_of=as_of)
    prompt = (
        payload.prompt or f"Analyze trade {trade_id}. Cover P&L, risk, lifecycle, and next actions."
    )
    try:
        message, provider, external = await service.analyze_with_ai(
            user_message=prompt,
            context=context,
            history=[],
        )
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    result = AIAnalysisResponse(
        message=message,
        provider=provider,
        external_call=external,
        feature_flags=service.feature_flags(),
    )
    await monetization_service.increment_usage(
        session, user_id=current_user.id, feature="ai_assistant"
    )
    await session.commit()
    return envelope(result.model_dump(by_alias=True))


def _trade_query(current_user: CurrentUserDep) -> Any:
    statement = select(Trade).where(Trade.user_id == current_user.id)
    if current_user.tenant_id is not None:
        statement = statement.where(Trade.tenant_id == current_user.tenant_id)
    return statement


async def _require_ai(session: AsyncSession, current_user: CurrentUserDep) -> None:
    enabled, _ = await monetization_service.is_feature_enabled(
        session,
        user_id=current_user.id,
        feature_name="ai_assistant",
        local_mode=current_user.is_local,
    )
    if not enabled:
        raise HTTPException(status_code=403, detail="ai_assistant is not enabled")
