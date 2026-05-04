"""REST endpoints for the trades domain.

Response envelope: { "data": ..., "meta": {...} } — see shared/envelope.py.
"""

from typing import Annotated, Any

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlmodel.ext.asyncio.session import AsyncSession

from ...database import get_session
from ...integrations.ofx import parse_ofx_export
from ...shared.envelope import envelope
from ...shared.migrations import import_export
from ..users import service as user_service
from ..users.dependencies import CurrentUserDep
from . import service
from .schemas import (
    BulkDeleteRequest,
    BulkDeleteResult,
    OfxImportResult,
    TradeCreate,
    TradeListItem,
    TradeSchema,
    TradeUpdate,
)

router = APIRouter(prefix="/trades", tags=["trades"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]


@router.get("")
async def list_trades(
    session: SessionDep,
    current_user: CurrentUserDep,
    ticker: str | None = None,
    status_filter: Annotated[str | None, Query(alias="status")] = None,
    strategy: str | None = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> dict[str, Any]:
    rows = await service.list_trades(
        session,
        user_id=current_user.id,
        tenant_id=current_user.tenant_id,
        ticker=ticker,
        status=status_filter,
        strategy=strategy,
        limit=limit,
        offset=offset,
    )
    total = await service.count_trades(
        session,
        user_id=current_user.id,
        tenant_id=current_user.tenant_id,
        ticker=ticker,
        status=status_filter,
        strategy=strategy,
    )
    return envelope(
        [TradeListItem.model_validate(t).model_dump(by_alias=True) for t in rows],
        meta={"total": total, "limit": limit, "offset": offset},
    )


@router.post("/bulk-delete")
async def bulk_delete_trades(
    session: SessionDep, current_user: CurrentUserDep, payload: BulkDeleteRequest
) -> dict[str, Any]:
    deleted, missing = await service.delete_trades(
        session, payload.ids, user_id=current_user.id, tenant_id=current_user.tenant_id
    )
    await user_service.audit(
        session, user_id=current_user.id, action="bulk_delete", entity="trade"
    )
    await session.commit()
    result = BulkDeleteResult(requested=len(payload.ids), deleted=deleted, missing=missing)
    return envelope(result.model_dump(by_alias=True))


@router.post("/import/ofx", status_code=status.HTTP_202_ACCEPTED)
async def import_ofx(
    session: SessionDep,
    current_user: CurrentUserDep,
    content: Annotated[str, Body(media_type="text/plain")],
    replace_existing: bool = True,
) -> dict[str, Any]:
    """Import broker OFX investment transactions as GammaLedger trades."""
    try:
        payload = parse_ofx_export(content)
        result = await import_export(
            session,
            payload,
            replace_existing=replace_existing,
            user_id=current_user.id,
            tenant_id=current_user.tenant_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    await user_service.audit(
        session, user_id=current_user.id, action="import_ofx", entity="trade"
    )
    await session.commit()
    response = OfxImportResult(
        imported=result.imported,
        replaced=result.replaced,
        skipped=result.skipped,
        errors=result.errors,
        message="OFX import completed.",
    )
    return envelope(
        response.model_dump(by_alias=True),
        meta={
            "validation": {
                "importBatchId": result.import_batch_id,
                "sourceTradeCount": result.source_trade_count,
                "persistedTradeCount": result.persisted_trade_count,
                "sourceLegCount": result.source_leg_count,
                "persistedLegCount": result.persisted_leg_count,
                "sourceFinancialChecksum": result.source_financial_checksum,
                "persistedFinancialChecksum": result.persisted_financial_checksum,
                "runtimeSnapshots": result.runtime_snapshots,
                "legMetadataRows": result.leg_metadata_rows,
            }
        },
    )


@router.get("/{trade_id}")
async def get_trade(session: SessionDep, current_user: CurrentUserDep, trade_id: str) -> dict[str, Any]:
    try:
        trade = await service.get_trade(
            session, trade_id, user_id=current_user.id, tenant_id=current_user.tenant_id
        )
    except service.TradeNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return envelope(TradeSchema.model_validate(trade).model_dump(by_alias=True))


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_trade(
    session: SessionDep, current_user: CurrentUserDep, payload: TradeCreate
) -> dict[str, Any]:
    try:
        trade = await service.create_trade(
            session, payload, user_id=current_user.id, tenant_id=current_user.tenant_id
        )
    except service.TradeAlreadyExistsError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    await user_service.audit(
        session, user_id=current_user.id, action="create", entity="trade", entity_id=trade.id
    )
    await session.commit()
    return envelope(TradeSchema.model_validate(trade).model_dump(by_alias=True))


@router.put("/{trade_id}")
async def update_trade(
    session: SessionDep, current_user: CurrentUserDep, trade_id: str, payload: TradeUpdate
) -> dict[str, Any]:
    try:
        trade = await service.update_trade(
            session,
            trade_id,
            payload,
            user_id=current_user.id,
            tenant_id=current_user.tenant_id,
        )
    except service.TradeNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    await user_service.audit(
        session, user_id=current_user.id, action="update", entity="trade", entity_id=trade.id
    )
    await session.commit()
    return envelope(TradeSchema.model_validate(trade).model_dump(by_alias=True))


@router.delete("/{trade_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_trade(session: SessionDep, current_user: CurrentUserDep, trade_id: str) -> None:
    try:
        await service.delete_trade(
            session, trade_id, user_id=current_user.id, tenant_id=current_user.tenant_id
        )
        await user_service.audit(
            session, user_id=current_user.id, action="delete", entity="trade", entity_id=trade_id
        )
    except service.TradeNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    await session.commit()
