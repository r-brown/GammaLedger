"""User registration, login, refresh-token rotation, and audit helpers."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from fastapi import HTTPException
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from ... import config
from .models import AuditLog, Portfolio, RefreshToken, User, UserPreferences, UserProfile
from .schemas import LoginRequest, RegisterRequest
from .security import (
    access_delta,
    create_token,
    hash_password,
    hash_token,
    refresh_delta,
    verify_password,
)


async def register_user(session: AsyncSession, payload: RegisterRequest) -> User:
    """Create a hosted user plus default profile, preferences, and portfolio."""
    email = _normalize_email(payload.email)
    existing = (await session.exec(select(User).where(User.email == email))).one_or_none()
    if existing is not None:
        raise HTTPException(status_code=409, detail="email already registered")
    user = User(
        id=f"user-{uuid4().hex}",
        email=email,
        hashed_password=hash_password(payload.password),
        is_verified=False,
    )
    session.add(user)
    await session.flush()
    portfolio = Portfolio(
        id=f"pf-{uuid4().hex}",
        user_id=user.id,
        name="Default Portfolio",
        is_default=True,
    )
    session.add(portfolio)
    session.add(
        UserProfile(
            user_id=user.id,
            display_name=payload.display_name,
            default_portfolio_id=portfolio.id,
        )
    )
    session.add(UserPreferences(user_id=user.id))
    await audit(session, user_id=user.id, action="register", entity="user", entity_id=user.id)
    await session.flush()
    return user


async def verify_user(session: AsyncSession, *, email: str) -> User:
    """Mark a user verified. Token validation is intentionally stubbed for Phase 5."""
    user = await find_user_by_email(session, email)
    user.is_verified = True
    session.add(user)
    await audit(session, user_id=user.id, action="verify", entity="user", entity_id=user.id)
    await session.flush()
    return user


async def login_user(session: AsyncSession, payload: LoginRequest) -> tuple[User, str, str]:
    """Validate credentials and issue access/refresh tokens."""
    user = await find_user_by_email(session, payload.email)
    if not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=401, detail="inactive user")
    if config.AUTH_REQUIRE_VERIFIED_EMAIL and not user.is_verified:
        raise HTTPException(status_code=403, detail="email verification required")
    user.last_login_at = datetime.now(UTC)
    session.add(user)
    tokens = await issue_tokens(session, user)
    await audit(session, user_id=user.id, action="login", entity="user", entity_id=user.id)
    return user, tokens[0], tokens[1]


async def issue_tokens(session: AsyncSession, user: User) -> tuple[str, str]:
    """Create access and refresh tokens and persist the hashed refresh token."""
    access = create_token(subject=user.id, token_type="access", expires_delta=access_delta())
    refresh = create_token(subject=user.id, token_type="refresh", expires_delta=refresh_delta())
    session.add(
        RefreshToken(
            token_hash=hash_token(refresh),
            user_id=user.id,
            expires_at=datetime.now(UTC) + refresh_delta(),
        )
    )
    await session.flush()
    return access, refresh


async def revoke_refresh_token(session: AsyncSession, refresh_token: str) -> None:
    """Revoke a persisted refresh token if present."""
    row = await session.get(RefreshToken, hash_token(refresh_token))
    if row is not None and row.revoked_at is None:
        row.revoked_at = datetime.now(UTC)
        session.add(row)
        await audit(session, user_id=row.user_id, action="logout", entity="refresh_token")
        await session.flush()


async def find_user_by_email(session: AsyncSession, email: str) -> User:
    """Return user by normalized email or raise 401."""
    user = (
        await session.exec(select(User).where(User.email == _normalize_email(email)))
    ).one_or_none()
    if user is None:
        raise HTTPException(status_code=401, detail="invalid credentials")
    return user


async def audit(
    session: AsyncSession,
    *,
    user_id: str,
    action: str,
    entity: str,
    entity_id: str | None = None,
) -> None:
    """Record a write operation."""
    session.add(
        AuditLog(
            id=f"audit-{uuid4().hex}",
            user_id=user_id,
            action=action,
            entity=entity,
            entity_id=entity_id,
        )
    )


def _normalize_email(email: str) -> str:
    value = email.strip().lower()
    if "@" not in value:
        raise HTTPException(status_code=422, detail="valid email is required")
    return value

