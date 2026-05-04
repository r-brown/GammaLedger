"""Tenant resolution and configuration assembly."""

from __future__ import annotations

from time import monotonic
from uuid import uuid4

from fastapi import Request
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from ... import config
from .models import Tenant, TenantSettings
from .schemas import TenantConfig

_CACHE_TTL_SECONDS = 300
_cache: dict[str, tuple[float, TenantConfig]] = {}


def requested_tenant_key(request: Request) -> tuple[str, str]:
    """Resolve a tenant lookup key from header or host."""
    header_tenant = request.headers.get("x-tenant-id")
    if header_tenant:
        return header_tenant.strip().lower(), "header"
    host = request.headers.get("host", "").split(":", 1)[0].lower()
    if host and not host.startswith(("127.", "localhost")):
        return host, "host"
    return config.DEFAULT_TENANT_SLUG, "default"


async def resolve_tenant_config(
    session: AsyncSession, *, key: str, resolved_from: str
) -> TenantConfig:
    """Return tenant config from cache/DB or the local default."""
    cache_key = f"{resolved_from}:{key}"
    cached = _cache.get(cache_key)
    if cached and monotonic() - cached[0] < _CACHE_TTL_SECONDS:
        return cached[1]

    tenant = None
    if config.TENANTS_ENABLED:
        tenant = (
            await session.exec(
                select(Tenant).where(
                    Tenant.is_active == True,  # noqa: E712
                    (Tenant.slug == key) | (Tenant.domain == key),
                )
            )
        ).one_or_none()
    if tenant is None:
        tenant = _default_tenant()

    settings_rows = (
        await session.exec(select(TenantSettings).where(TenantSettings.tenant_id == tenant.id))
    ).all()
    tenant_config = TenantConfig(
        id=tenant.id,
        slug=tenant.slug,
        name=tenant.name,
        domain=tenant.domain,
        logo_url=tenant.logo_url,
        primary_color=tenant.primary_color,
        secondary_color=tenant.secondary_color,
        font_family=tenant.font_family,
        plan=tenant.plan,
        settings={row.setting_key: row.setting_value for row in settings_rows},
        resolved_from=resolved_from,
    )
    _cache[cache_key] = (monotonic(), tenant_config)
    return tenant_config


async def ensure_tenant(session: AsyncSession, slug: str, name: str) -> Tenant:
    """Create a tenant if missing; useful for hosted bootstrap/tests."""
    existing = (await session.exec(select(Tenant).where(Tenant.slug == slug))).one_or_none()
    if existing is not None:
        return existing
    tenant = Tenant(id=f"tenant-{uuid4().hex}", slug=slug, name=name)
    session.add(tenant)
    await session.flush()
    _cache.clear()
    return tenant


def _default_tenant() -> Tenant:
    return Tenant(
        id="tenant-local",
        slug=config.DEFAULT_TENANT_SLUG,
        name="GammaLedger",
        domain=None,
        logo_url=None,
        primary_color="#6500d3",
        secondary_color="#21808d",
        font_family="Inter, Roboto, system-ui, sans-serif",
        is_active=True,
        plan="LOCAL",
    )
