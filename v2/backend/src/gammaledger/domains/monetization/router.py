"""Feature flag and usage endpoints."""

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query
from sqlmodel.ext.asyncio.session import AsyncSession

from ...database import get_session
from ...shared.envelope import envelope
from ..users.dependencies import CurrentUserDep
from . import service
from .schemas import FeatureFlagRead, UsageRead

router = APIRouter(tags=["monetization"])
SessionDep = Annotated[AsyncSession, Depends(get_session)]


@router.get("/features")
async def features(session: SessionDep, current_user: CurrentUserDep) -> dict[str, Any]:
    """Return current user's feature flags."""
    flags = await service.list_features(
        session, user_id=current_user.id, local_mode=current_user.is_local
    )
    return envelope(
        [FeatureFlagRead.model_validate(flag).model_dump(by_alias=True) for flag in flags]
    )


@router.get("/usage")
async def usage(
    session: SessionDep,
    current_user: CurrentUserDep,
    period: Annotated[str | None, Query(pattern=r"^\d{4}-\d{2}$")] = None,
) -> dict[str, Any]:
    """Return current user's usage counters for a period."""
    rows = await service.list_usage(session, user_id=current_user.id, period=period)
    flags = {
        flag.feature_name: flag
        for flag in await service.list_features(
            session, user_id=current_user.id, local_mode=current_user.is_local
        )
    }
    return envelope(
        [
            UsageRead(
                feature=row.feature,
                count=row.count,
                period=row.period,
                limit_value=flags.get(row.feature).limit_value if flags.get(row.feature) else None,
            ).model_dump(by_alias=True)
            for row in rows
        ],
        meta={"period": period or service.current_period()},
    )

