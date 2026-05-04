"""Feature flag and usage-metering service functions."""

from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, date, datetime
from typing import Annotated
from uuid import uuid4

from fastapi import Depends, HTTPException
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from ...database import get_session
from ..users.dependencies import CurrentUserDep
from .models import FeatureFlag, UsageEvent

LOCAL_DEFAULT_FEATURES: dict[str, int | None] = {
    "ai_assistant": None,
    "white_label": None,
    "ofx_export": None,
    "api_access": None,
}

FREE_DEFAULT_FEATURES: dict[str, int | None] = {
    "ai_assistant": 0,
    "white_label": 0,
    "ofx_export": 0,
    "api_access": 0,
}


async def list_features(session: AsyncSession, *, user_id: str, local_mode: bool) -> list[FeatureFlag]:
    """Return explicit flags plus local/free defaults."""
    rows = (await session.exec(select(FeatureFlag).where(FeatureFlag.user_id == user_id))).all()
    by_name = {row.feature_name: row for row in rows}
    defaults = LOCAL_DEFAULT_FEATURES if local_mode else FREE_DEFAULT_FEATURES
    for name, limit in defaults.items():
        if name not in by_name:
            by_name[name] = FeatureFlag(
                id=f"virtual-{user_id}-{name}",
                user_id=user_id,
                feature_name=name,
                enabled=local_mode or bool(limit),
                limit_value=limit,
            )
    return list(by_name.values())


async def is_feature_enabled(
    session: AsyncSession, *, user_id: str, feature_name: str, local_mode: bool
) -> tuple[bool, int | None]:
    """Return entitlement state and limit for a feature."""
    features = await list_features(session, user_id=user_id, local_mode=local_mode)
    for feature in features:
        if feature.feature_name == feature_name:
            return feature.enabled, feature.limit_value
    return False, 0


def require_feature(feature_name: str) -> Callable[..., object]:
    """Dependency factory that enforces a feature flag."""
    async def _dependency(
        session: Annotated[AsyncSession, Depends(get_session)],
        current_user: CurrentUserDep,
    ) -> None:
        enabled, _ = await is_feature_enabled(
            session,
            user_id=current_user.id,
            feature_name=feature_name,
            local_mode=current_user.is_local,
        )
        if not enabled:
            raise HTTPException(status_code=403, detail=f"{feature_name} is not enabled")

    return _dependency


async def increment_usage(
    session: AsyncSession,
    *,
    user_id: str,
    feature: str,
    count: int = 1,
    period: str | None = None,
) -> UsageEvent:
    """Increment a user's monthly feature usage counter."""
    usage_period = period or current_period()
    row = (
        await session.exec(
            select(UsageEvent).where(
                UsageEvent.user_id == user_id,
                UsageEvent.feature == feature,
                UsageEvent.period == usage_period,
            )
        )
    ).one_or_none()
    if row is None:
        row = UsageEvent(
            id=f"usage-{uuid4().hex}",
            user_id=user_id,
            feature=feature,
            period=usage_period,
            count=count,
        )
    else:
        row.count += count
        row.updated_at = datetime.now(UTC)
    session.add(row)
    await session.flush()
    return row


async def list_usage(session: AsyncSession, *, user_id: str, period: str | None = None) -> list[UsageEvent]:
    """Return usage counters for a period."""
    usage_period = period or current_period()
    rows = (
        await session.exec(
            select(UsageEvent).where(
                UsageEvent.user_id == user_id,
                UsageEvent.period == usage_period,
            )
        )
    ).all()
    return list(rows)


def current_period() -> str:
    """Return current monthly usage period."""
    return date.today().strftime("%Y-%m")

