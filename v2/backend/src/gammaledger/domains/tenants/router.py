"""Tenant config endpoints."""

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query, Request
from sqlmodel.ext.asyncio.session import AsyncSession

from ...database import get_session
from ...shared.envelope import envelope
from . import service

router = APIRouter(prefix="/tenant", tags=["tenant"])
SessionDep = Annotated[AsyncSession, Depends(get_session)]


@router.get("/config")
async def config(request: Request, session: SessionDep) -> dict[str, Any]:
    """Return active tenant branding for the current request."""
    key = getattr(request.state, "tenant_key", None)
    source = getattr(request.state, "tenant_resolved_from", "default")
    if key is None:
        key, source = service.requested_tenant_key(request)
    tenant_config = await service.resolve_tenant_config(
        session, key=str(key), resolved_from=str(source)
    )
    return envelope(tenant_config.model_dump(by_alias=True))


@router.get("/resolve")
async def resolve(
    session: SessionDep,
    domain: Annotated[str, Query(min_length=1)],
) -> dict[str, Any]:
    """Resolve a tenant by custom domain or slug."""
    tenant_config = await service.resolve_tenant_config(
        session, key=domain.lower(), resolved_from="domain"
    )
    return envelope(tenant_config.model_dump(by_alias=True))

