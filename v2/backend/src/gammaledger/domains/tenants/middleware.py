"""Tenant resolution middleware."""

from collections.abc import Awaitable, Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from .service import requested_tenant_key


class TenantMiddleware(BaseHTTPMiddleware):
    """Attach tenant lookup metadata to request.state."""

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        key, source = requested_tenant_key(request)
        request.state.tenant_key = key
        request.state.tenant_resolved_from = source
        response = await call_next(request)
        response.headers.setdefault("x-tenant-key", key)
        return response

