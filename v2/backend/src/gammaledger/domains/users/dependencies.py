"""Current-user dependency and local-mode auth bypass."""

from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, Header, HTTPException, Request
from sqlmodel.ext.asyncio.session import AsyncSession

from ... import config
from ...database import get_session
from .models import User
from .security import decode_token


@dataclass(frozen=True)
class CurrentUser:
    """Authenticated or local synthetic user."""

    id: str
    email: str
    is_local: bool = False
    tenant_id: str | None = None


async def get_current_user(
    request: Request,
    session: Annotated[AsyncSession, Depends(get_session)],
    authorization: Annotated[str | None, Header()] = None,
) -> CurrentUser:
    """Return the hosted authenticated user or the local synthetic user."""
    if not config.AUTH_ENABLED:
        return CurrentUser(id=config.LOCAL_USER_ID, email="local@gammaledger.local", is_local=True)

    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="authentication required")
    token = authorization.split(" ", 1)[1]
    try:
        payload = decode_token(token, expected_type="access")
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    user = await session.get(User, str(payload.get("sub")))
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="inactive or missing user")
    tenant_id = getattr(request.state, "tenant_key", None) if config.TENANTS_ENABLED else None
    return CurrentUser(id=user.id, email=user.email, tenant_id=tenant_id)


CurrentUserDep = Annotated[CurrentUser, Depends(get_current_user)]
