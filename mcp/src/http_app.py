"""Streamable HTTP transport: serve the MCP server over the network behind a bearer token.

Meant to sit behind a TLS-terminating reverse proxy (Caddy, nginx, a gateway) so that web
clients - Claude on the web, Grok, anything that speaks remote MCP - can reach a database
that lives on your own machine or server. The server itself only speaks plain HTTP.
"""

from __future__ import annotations

import hmac
import json
import logging
from collections.abc import Iterable

from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings
from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import PlainTextResponse
from starlette.types import ASGIApp, Receive, Scope, Send

logger = logging.getLogger(__name__)

HEALTH_PATH = "/healthz"
LOOPBACK_BIND_HOSTS = {"127.0.0.1", "localhost", "::1"}
_LOOPBACK_ALLOWED_HOSTS = ["127.0.0.1:*", "localhost:*", "[::1]:*"]
_LOOPBACK_ALLOWED_ORIGINS = ["http://127.0.0.1:*", "http://localhost:*", "http://[::1]:*"]


class BearerTokenMiddleware:
    """Reject every HTTP request that lacks ``Authorization: Bearer <token>``.

    Pure ASGI (no response buffering, so streaming responses are untouched). The token is
    compared in constant time. ``public_paths`` (the health check) skip authentication.
    """

    def __init__(
        self,
        app: ASGIApp,
        token: str,
        public_paths: Iterable[str] = (HEALTH_PATH,),
    ) -> None:
        self.app = app
        self._token = token.encode("utf-8")
        self._public = frozenset(public_paths)

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or scope.get("path") in self._public:
            await self.app(scope, receive, send)
            return

        supplied = b""
        for name, value in scope.get("headers", []):
            if name == b"authorization":
                scheme, _, credentials = value.decode("latin-1").partition(" ")
                if scheme.lower() == "bearer":
                    supplied = credentials.strip().encode("utf-8")
                break

        if supplied and hmac.compare_digest(supplied, self._token):
            await self.app(scope, receive, send)
            return

        body = json.dumps({"error": "unauthorized", "detail": "Missing or invalid bearer token."})
        await send(
            {
                "type": "http.response.start",
                "status": 401,
                "headers": [
                    (b"content-type", b"application/json"),
                    (b"www-authenticate", b'Bearer realm="gammaledger-mcp"'),
                    (b"content-length", str(len(body)).encode()),
                ],
            }
        )
        await send({"type": "http.response.body", "body": body.encode()})


def transport_security(allowed_hosts: Iterable[str]) -> TransportSecuritySettings:
    """DNS-rebinding protection: accept loopback plus the public host names you list.

    ``["*"]`` turns the Host/Origin check off (the bearer token still applies).
    """
    extra = [h.strip() for h in allowed_hosts if h and h.strip()]
    if "*" in extra:
        return TransportSecuritySettings(enable_dns_rebinding_protection=False)
    hosts = list(_LOOPBACK_ALLOWED_HOSTS)
    origins = list(_LOOPBACK_ALLOWED_ORIGINS)
    for host in extra:
        hosts += [host, f"{host}:*"]
        origins += [f"https://{host}", f"https://{host}:*", f"http://{host}", f"http://{host}:*"]
    return TransportSecuritySettings(
        enable_dns_rebinding_protection=True, allowed_hosts=hosts, allowed_origins=origins
    )


def register_health_route(mcp: FastMCP) -> None:
    @mcp.custom_route(HEALTH_PATH, methods=["GET"])
    async def healthz(request: Request) -> PlainTextResponse:
        return PlainTextResponse("ok")


def build_http_app(
    mcp: FastMCP,
    *,
    host: str,
    port: int,
    path: str = "/mcp",
    token: str | None = None,
    allowed_hosts: Iterable[str] = (),
) -> Starlette:
    """Configure ``mcp`` for stateless streamable HTTP and return the ASGI app.

    Stateless + JSON responses: every request stands alone, so a proxy that load-balances,
    a client that reconnects, or a server restart never leaves a dangling session behind.
    """
    mcp.settings.host = host
    mcp.settings.port = port
    mcp.settings.streamable_http_path = path
    mcp.settings.stateless_http = True
    mcp.settings.json_response = True
    mcp.settings.transport_security = transport_security(allowed_hosts)

    app = mcp.streamable_http_app()
    if token:
        app.add_middleware(BearerTokenMiddleware, token=token)
    return app


def serve_http(app: Starlette, *, host: str, port: int, verbose: bool = False) -> None:
    import uvicorn

    uvicorn.run(app, host=host, port=port, log_level="debug" if verbose else "info")
