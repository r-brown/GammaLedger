"""Smoke-test an *installed* gammaledger-mcp the way an MCP client launches it.

Run with the Python of a clean virtualenv that has only the built wheel
installed (so dependencies are freshly resolved, as for `uvx gammaledger-mcp`):

    python scripts/smoke_installed.py --expect-version 1.2.3

It writes a tiny GammaLedger v2.6 database, starts the ``gammaledger-mcp``
console script over stdio, and checks the handshake, tool list and a few calls.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import subprocess
import sys
import tempfile
from pathlib import Path

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

DB = {
    "version": "2.6",
    "exportDate": "2026-11-02T10:00:00.000Z",
    "trades": [
        {
            "id": "TRD-0001",
            "ticker": "SPY",
            "strategy": "Cash-Secured Put",
            "status": "Open",
            "legs": [],
        }
    ],
    "watchlist": [{"ticker": "NVDA", "rating": 5, "notes": "", "addedDate": "2026-09-01"}],
    "mcpContext": {
        "generatedAt": "2026-11-02T10:00:00.000Z",
        "asOfDate": "2026-11-02",
        "portfolio": {"counts": {"totalTrades": 1, "active": 1}},
        "activePositions": [{"id": "TRD-0001", "ticker": "SPY", "pl": 12.5, "dte": 9}],
    },
}

REQUIRED_TOOLS = {
    "gammaledger_database_info",
    "gammaledger_portfolio_summary",
    "gammaledger_open_positions",
    "gammaledger_position",
    "gammaledger_search_trades",
    "gammaledger_watchlist",
    "gammaledger_audit_risk",
}


async def run(exe: Path, db_path: Path) -> None:
    params = StdioServerParameters(command=str(exe), args=["--db-path", str(db_path)])
    async with stdio_client(params) as (read, write), ClientSession(read, write) as session:
        await session.initialize()
        tools = {t.name for t in (await session.list_tools()).tools}
        missing = REQUIRED_TOOLS - tools
        assert not missing, f"missing tools: {sorted(missing)}"

        async def call(name: str, args: dict[str, object] | None = None) -> dict:
            result = await session.call_tool(name, args or {})
            payload = json.loads(result.content[0].text)  # type: ignore[union-attr]
            assert not (isinstance(payload, dict) and payload.get("error")), (name, payload)
            return payload

        assert (await call("gammaledger_database_info"))["tradeCount"] == 1
        assert (await call("gammaledger_open_positions"))["count"] == 1
        found = await call("gammaledger_search_trades", {"ticker": "SPY"})
        assert found["trades"][0]["pl"] == 12.5, found
        assert (await call("gammaledger_watchlist"))["count"] == 1
        prompts = {p.name for p in (await session.list_prompts()).prompts}
        assert "analyze_portfolio" in prompts
    print(f"OK: {len(tools)} tools, {len(prompts)} prompts")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--expect-version", required=True)
    args = parser.parse_args()

    exe = Path(sys.executable).parent / (
        "gammaledger-mcp.exe" if sys.platform == "win32" else "gammaledger-mcp"
    )
    assert exe.exists(), f"console script not found next to the interpreter: {exe}"

    out = subprocess.run([str(exe), "--version"], capture_output=True, text=True, check=True)
    reported = out.stdout.strip()
    assert reported == f"gammaledger-mcp {args.expect_version}", (
        f"--version reported {reported!r}, expected {args.expect_version!r}"
    )
    print(reported)

    with tempfile.TemporaryDirectory() as tmp:
        db_path = Path(tmp) / "gammaledger.json"
        db_path.write_text(json.dumps(DB), encoding="utf-8")
        asyncio.run(run(exe, db_path))


if __name__ == "__main__":
    main()
