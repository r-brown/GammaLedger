"""Shared fixtures: v2.6 databases (with / without ``mcpContext``) and a connected MCP client."""

from __future__ import annotations

import json
import shutil
from collections.abc import AsyncIterator, Callable, Iterator
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import pytest
import pytest_asyncio
from gammaledger_mcp import database
from gammaledger_mcp.database import GammaLedgerDB, configure_db
from gammaledger_mcp.server import create_server
from mcp import ClientSession
from mcp.shared.memory import create_connected_server_and_client_session
from mcp.types import CallToolResult

FIXTURES = Path(__file__).parent / "fixtures"
# "Now" for tests that should see a fresh export (the fixtures were exported 2026-11-02 10:00Z).
FRESH_NOW = datetime(2026, 11, 2, 12, 0, tzinfo=timezone.utc)
STALE_NOW = FRESH_NOW + timedelta(days=6)


@pytest.fixture
def full_db(tmp_path: Path) -> Path:
    """A v2.6 database with ``mcpContext`` (7 trades; 3 closed trades the app did not embed)."""
    target = tmp_path / "gammaledger.json"
    shutil.copy(FIXTURES / "db_v26_full.json", target)
    return target


@pytest.fixture
def no_context_db(tmp_path: Path) -> Path:
    """A v2.6 database saved without ``mcpContext`` (older app build)."""
    target = tmp_path / "gammaledger.json"
    shutil.copy(FIXTURES / "db_v26_no_context.json", target)
    return target


def load_fixture(name: str) -> dict[str, Any]:
    payload: dict[str, Any] = json.loads((FIXTURES / name).read_text(encoding="utf-8"))
    return payload


@pytest.fixture
def configure() -> Iterator[Callable[..., GammaLedgerDB]]:
    """Configure the module-level DB singleton the tools read; reset it afterwards."""

    def _configure(path: Path, now: datetime = FRESH_NOW, **kwargs: Any) -> GammaLedgerDB:
        return configure_db(path, clock=lambda: now, **kwargs)

    yield _configure
    database._db = None


@pytest_asyncio.fixture
async def connect() -> AsyncIterator[Callable[[], Any]]:
    """Factory for an in-memory client connected to a fresh server."""

    def _connect() -> Any:
        return create_connected_server_and_client_session(create_server()._mcp_server)

    yield _connect


async def call(session: ClientSession, name: str, **args: Any) -> CallToolResult:
    return await session.call_tool(name, args)


def payload(result: CallToolResult) -> Any:
    """Decode a tool result: structured content if the tool has a schema, else the JSON text."""
    if result.structuredContent is not None:
        return result.structuredContent
    return json.loads(result.content[0].text)  # type: ignore[union-attr]
