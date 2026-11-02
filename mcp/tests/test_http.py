"""Streamable HTTP transport: bearer auth, Host protection, stateless calls, real process."""

from __future__ import annotations

import json
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest
from gammaledger_mcp.http_app import BearerTokenMiddleware, build_http_app, transport_security
from gammaledger_mcp.server import create_server, main
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client
from starlette.applications import Starlette
from starlette.responses import PlainTextResponse
from starlette.routing import Route
from starlette.testclient import TestClient

TOKEN = "s3cret-token"
RPC_HEADERS = {"Accept": "application/json, text/event-stream", "Content-Type": "application/json"}


def _rpc(method: str, params: dict[str, Any] | None = None, id_: int = 1) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": id_, "method": method, "params": params or {}}


@pytest.fixture
def client(configure, full_db: Path) -> Iterator[TestClient]:
    configure(full_db)
    app = build_http_app(
        create_server(),
        host="127.0.0.1",
        port=8765,
        token=TOKEN,
        allowed_hosts=["mcp.example.com"],
    )
    with TestClient(app, base_url="http://127.0.0.1:8765") as c:
        yield c


def _auth(token: str = TOKEN) -> dict[str, str]:
    return {**RPC_HEADERS, "Authorization": f"Bearer {token}"}


# ── Authentication ──────────────────────────────────────────────────────────


def test_requests_without_a_token_are_rejected(client: TestClient) -> None:
    r = client.post("/mcp", json=_rpc("tools/list"), headers=RPC_HEADERS)
    assert r.status_code == 401
    assert r.headers["www-authenticate"].startswith("Bearer")
    assert r.json()["error"] == "unauthorized"


@pytest.mark.parametrize("header", ["Bearer wrong", "Bearer ", "Basic czNjcmV0", TOKEN, "bearer"])
def test_wrong_credentials_are_rejected(client: TestClient, header: str) -> None:
    r = client.post(
        "/mcp", json=_rpc("tools/list"), headers={**RPC_HEADERS, "Authorization": header}
    )
    assert r.status_code == 401


def test_token_prefix_does_not_match(client: TestClient) -> None:
    assert (
        client.post("/mcp", json=_rpc("tools/list"), headers=_auth(TOKEN[:-1])).status_code == 401
    )
    assert (
        client.post("/mcp", json=_rpc("tools/list"), headers=_auth(TOKEN + "x")).status_code == 401
    )


def test_scheme_is_case_insensitive(client: TestClient) -> None:
    headers = {**RPC_HEADERS, "Authorization": f"bEaReR {TOKEN}"}
    assert client.post("/mcp", json=_rpc("tools/list"), headers=headers).status_code == 200


def test_health_check_needs_no_token_and_reveals_nothing(client: TestClient) -> None:
    r = client.get("/healthz")
    assert r.status_code == 200
    assert r.text == "ok"


def test_other_paths_are_protected_too(client: TestClient) -> None:
    assert client.get("/anything").status_code == 401


# ── Serving ─────────────────────────────────────────────────────────────────


def test_initialize_reports_name_and_version(client: TestClient) -> None:
    from gammaledger_mcp import __version__

    body = _rpc(
        "initialize",
        {
            "protocolVersion": "2025-03-26",
            "capabilities": {},
            "clientInfo": {"name": "pytest", "version": "0"},
        },
    )
    r = client.post("/mcp", json=body, headers=_auth())
    assert r.status_code == 200
    info = r.json()["result"]["serverInfo"]
    assert info["name"] == "gammaledger-mcp"
    assert info["version"] == __version__


def test_stateless_tool_call_without_a_session(client: TestClient) -> None:
    """Every request stands alone, so a restart or a load balancer never strands a session."""
    r = client.post(
        "/mcp",
        json=_rpc("tools/call", {"name": "gammaledger_database_info", "arguments": {}}),
        headers=_auth(),
    )
    assert r.status_code == 200
    result = r.json()["result"]
    assert result["structuredContent"]["tradeCount"] == 7
    assert json.loads(result["content"][0]["text"])["version"] == "2.6"


def test_tools_list_over_http(client: TestClient) -> None:
    r = client.post("/mcp", json=_rpc("tools/list"), headers=_auth())
    names = {t["name"] for t in r.json()["result"]["tools"]}
    assert "gammaledger_search_trades" in names
    assert len(names) == 16


# ── Host header / DNS-rebinding protection ──────────────────────────────────


def test_unknown_host_header_is_refused(client: TestClient) -> None:
    r = client.post("/mcp", json=_rpc("tools/list"), headers={**_auth(), "Host": "evil.example"})
    assert r.status_code == 421


def test_public_host_name_is_accepted_when_listed(client: TestClient) -> None:
    for host in ("mcp.example.com", "mcp.example.com:443"):
        r = client.post("/mcp", json=_rpc("tools/list"), headers={**_auth(), "Host": host})
        assert r.status_code == 200, host


def test_transport_security_settings() -> None:
    default = transport_security([])
    assert default.enable_dns_rebinding_protection is True
    assert {"127.0.0.1:*", "localhost:*", "[::1]:*"} <= set(default.allowed_hosts)
    listed = transport_security(["mcp.example.com"])
    assert {"mcp.example.com", "mcp.example.com:*"} <= set(listed.allowed_hosts)
    assert {"https://mcp.example.com", "http://mcp.example.com"} <= set(listed.allowed_origins)
    assert transport_security(["*"]).enable_dns_rebinding_protection is False


def test_middleware_lets_lifespan_and_websocket_scopes_through() -> None:
    import asyncio

    seen: list[str] = []

    async def inner(scope: Any, receive: Any, send: Any) -> None:
        seen.append(scope["type"])

    mw = BearerTokenMiddleware(inner, token="t")

    async def run() -> None:
        for kind in ("lifespan", "websocket"):
            await mw({"type": kind}, None, None)  # type: ignore[arg-type]

    asyncio.run(run())
    assert seen == ["lifespan", "websocket"]


def test_middleware_composes_with_plain_starlette_apps() -> None:
    async def hello(request: Any) -> PlainTextResponse:
        return PlainTextResponse("hi")

    app = Starlette(routes=[Route("/x", hello)])
    app.add_middleware(BearerTokenMiddleware, token="t")
    with TestClient(app) as c:
        assert c.get("/x").status_code == 401
        assert c.get("/x", headers={"Authorization": "Bearer t"}).text == "hi"


# ── Command line ────────────────────────────────────────────────────────────


def test_public_bind_without_a_token_is_refused(
    full_db: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.delenv("GAMMALEDGER_MCP_TOKEN", raising=False)
    with pytest.raises(SystemExit) as exc:
        main(["--db-path", str(full_db), "--http", "--host", "0.0.0.0"])
    assert exc.value.code == 2


@pytest.mark.parametrize("flag", [["--port", "0"], ["--port", "70000"], ["--path", "mcp"]])
def test_bad_http_options_are_refused(full_db: Path, flag: list[str]) -> None:
    with pytest.raises(SystemExit) as exc:
        main(["--db-path", str(full_db), "--http", *flag])
    assert exc.value.code == 2


# ── A real process, a real client ───────────────────────────────────────────


def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return int(s.getsockname()[1])


@pytest.fixture
def running_server(full_db: Path) -> Iterator[str]:
    port = _free_port()
    proc = subprocess.Popen(
        [
            sys.executable,
            "-m",
            "gammaledger_mcp.server",
            "--db-path",
            str(full_db),
            "--http",
            "--port",
            str(port),
        ],
        env={"GAMMALEDGER_MCP_TOKEN": TOKEN, "PATH": "", "HOME": str(full_db.parent)},
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
    )
    base = f"http://127.0.0.1:{port}"
    try:
        deadline = time.monotonic() + 30
        while time.monotonic() < deadline:
            if proc.poll() is not None:
                pytest.fail(
                    f"server exited early: {proc.stderr.read().decode() if proc.stderr else ''}"
                )
            try:
                with urllib.request.urlopen(f"{base}/healthz", timeout=1) as r:
                    if r.status == 200:
                        break
            except (urllib.error.URLError, ConnectionError, OSError):
                time.sleep(0.2)
        else:
            pytest.fail("server did not start")
        yield base
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()


async def test_real_client_over_http(running_server: str) -> None:
    async with (
        streamablehttp_client(
            f"{running_server}/mcp", headers={"Authorization": f"Bearer {TOKEN}"}
        ) as (
            read,
            write,
            _,
        ),
        ClientSession(read, write) as session,
    ):
        await session.initialize()
        names = {t.name for t in (await session.list_tools()).tools}
        assert "gammaledger_open_positions" in names
        result = await session.call_tool("gammaledger_search_trades", {"ticker": "QQQ"})
        assert result.structuredContent is not None
        assert result.structuredContent["trades"][0]["pl"] == 238.7


def test_real_server_rejects_missing_token(running_server: str) -> None:
    req = urllib.request.Request(
        f"{running_server}/mcp",
        data=json.dumps(_rpc("tools/list")).encode(),
        headers=RPC_HEADERS,
        method="POST",
    )
    with pytest.raises(urllib.error.HTTPError) as exc:
        urllib.request.urlopen(req, timeout=5)
    assert exc.value.code == 401
