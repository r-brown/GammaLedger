"""Auth and user-resource endpoints."""

from datetime import datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel.ext.asyncio.session import AsyncSession

from ... import config
from ...database import get_session
from ...shared.envelope import envelope
from . import service
from .dependencies import CurrentUserDep
from .models import RefreshToken, User
from .schemas import (
    AuthFeatures,
    LoginRequest,
    OAuthStub,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    UserRead,
    VerifyRequest,
)
from .security import decode_token, hash_token

router = APIRouter(prefix="/auth", tags=["auth"])
SessionDep = Annotated[AsyncSession, Depends(get_session)]


@router.get("/features")
async def features() -> dict[str, Any]:
    """Return auth feature flags for frontend gating."""
    return envelope(
        AuthFeatures(
            auth_enabled=config.AUTH_ENABLED,
            local_mode=not config.AUTH_ENABLED,
            local_user_id=config.LOCAL_USER_ID,
            access_token_minutes=config.JWT_ACCESS_TTL_MINUTES,
            refresh_token_days=config.JWT_REFRESH_TTL_DAYS,
            oauth_providers=["google", "github"],
        ).model_dump(by_alias=True)
    )


@router.post("/register", status_code=201)
async def register(
    payload: RegisterRequest,
    session: SessionDep,
) -> dict[str, Any]:
    """Register a hosted user. Disabled in local mode."""
    _require_auth_enabled()
    user = await service.register_user(session, payload)
    access, refresh = await service.issue_tokens(session, user)
    await session.commit()
    return envelope(_token_response(user, access, refresh))


@router.post("/login")
async def login(
    payload: LoginRequest,
    session: SessionDep,
) -> dict[str, Any]:
    """Login and issue access/refresh tokens."""
    _require_auth_enabled()
    user, access, refresh = await service.login_user(session, payload)
    await session.commit()
    return envelope(_token_response(user, access, refresh))


@router.post("/verify")
async def verify(
    payload: VerifyRequest,
    session: SessionDep,
) -> dict[str, Any]:
    """Mark an email verified. Verification-token delivery is scaffolded."""
    _require_auth_enabled()
    user = await service.verify_user(session, email=payload.email)
    await session.commit()
    return envelope(UserRead.model_validate(user).model_dump(by_alias=True))


@router.post("/refresh")
async def refresh(
    payload: RefreshRequest,
    session: SessionDep,
) -> dict[str, Any]:
    """Rotate a refresh token and return fresh credentials."""
    _require_auth_enabled()
    try:
        decoded = decode_token(payload.refresh_token, expected_type="refresh")
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    row = await session.get(RefreshToken, hash_token(payload.refresh_token))
    if row is None or row.revoked_at is not None or row.expires_at < datetime.now(row.expires_at.tzinfo):
        raise HTTPException(status_code=401, detail="invalid refresh token")
    user = await session.get(User, str(decoded["sub"]))
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="inactive or missing user")
    await service.revoke_refresh_token(session, payload.refresh_token)
    access, new_refresh = await service.issue_tokens(session, user)
    await session.commit()
    return envelope(_token_response(user, access, new_refresh))


@router.post("/logout", status_code=204)
async def logout(
    payload: RefreshRequest,
    session: SessionDep,
) -> None:
    """Revoke the provided refresh token."""
    if payload is not None:
        await service.revoke_refresh_token(session, payload.refresh_token)
        await session.commit()


@router.get("/me")
async def me(current_user: CurrentUserDep) -> dict[str, Any]:
    """Return the current user identity."""
    return envelope(
        {
            "id": current_user.id,
            "email": current_user.email,
            "isLocal": current_user.is_local,
        }
    )


@router.get("/oauth/{provider}")
async def oauth_stub(provider: str) -> dict[str, Any]:
    """OAuth hook placeholder for Google/GitHub providers."""
    if provider not in {"google", "github"}:
        raise HTTPException(status_code=404, detail="unknown OAuth provider")
    return envelope(
        OAuthStub(
            provider=provider,
            message=f"{provider} OAuth is scaffolded; provider credentials are not configured.",
        ).model_dump(by_alias=True)
    )


def _token_response(user: User, access: str, refresh: str) -> dict[str, Any]:
    return TokenResponse(
        access_token=access,
        refresh_token=refresh,
        expires_in=config.JWT_ACCESS_TTL_MINUTES * 60,
        user=UserRead.model_validate(user),
    ).model_dump(by_alias=True)


def _require_auth_enabled() -> None:
    if not config.AUTH_ENABLED:
        raise HTTPException(status_code=404, detail="auth is disabled in local mode")
