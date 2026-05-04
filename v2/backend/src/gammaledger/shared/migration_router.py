"""Legacy JSON migration endpoints."""

from typing import Annotated, Any

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlmodel.ext.asyncio.session import AsyncSession

from ..database import get_session
from ..domains.users import service as user_service
from ..domains.users.dependencies import CurrentUserDep
from .envelope import envelope
from .migrations import import_export

router = APIRouter(prefix="/migrate", tags=["migration"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]


@router.post("")
async def migrate_json(
    session: SessionDep,
    current_user: CurrentUserDep,
    payload: Annotated[Any, Body()],
    replace_existing: bool = True,
) -> dict[str, Any]:
    """Import a legacy GammaLedger JSON export into the SQL database."""
    try:
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
        session, user_id=current_user.id, action="import_json", entity="trade"
    )
    await session.commit()
    return envelope(
        {
            "imported": result.imported,
            "replaced": result.replaced,
            "skipped": result.skipped,
            "errors": result.errors,
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
                "settingsRows": result.settings_rows,
                "matches": result.source_trade_count == result.persisted_trade_count
                and result.source_leg_count == result.persisted_leg_count
                and result.source_financial_checksum == result.persisted_financial_checksum,
            },
        }
    )
