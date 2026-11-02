"""The ``mcpContext`` contract between the GammaLedger app and this server.

The app (``src/integrations/mcp.ts``) decides what ``mcpContext`` contains; the tools here read
it by key. These tests fail loudly when the two drift apart, instead of letting an agent get
quietly emptier answers:

* every key the tools read exists in the v2.6 fixture, and
* every one of those keys is still emitted by the app's TypeScript source (when this package is
  tested from a full checkout of the repository), and
* every tool survives a database whose ``mcpContext`` is missing, empty, or from a future app.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

import pytest

from .conftest import call, load_fixture, payload

REPO_ROOT = Path(__file__).resolve().parents[2]
APP_SOURCE = REPO_ROOT / "src" / "integrations" / "mcp.ts"

# What the server reads, by location in mcpContext.
CONTEXT_KEYS = {
    "generatedAt",
    "asOfDate",
    "portfolio",
    "strategyBreakdown",
    "underlyingBreakdown",
    "concentration",
    "activePositions",
    "wheelPmccPositions",
    "tickerExposure",
    "recentClosedTrades",
}
PORTFOLIO_KEYS = {
    "counts",
    "pl",
    "performance",
    "risk",
    "fees",
    "trading",
    "largestWinner",
    "largestLoser",
}
PL_KEYS = {
    "total",
    "realized",
    "unrealized",
    "ytd",
    "mtd",
    "last7d",
    "last30d",
    "last90d",
    "last1y",
}
PERFORMANCE_KEYS = {"winRate", "profitFactor", "maxDrawdown", "sharpeRatio", "sortinoRatio"}
POSITION_KEYS = {
    "id",
    "ticker",
    "strategy",
    "status",
    "strike",
    "quantity",
    "expires",
    "dte",
    "pl",
    "roi",
    "capitalAtRisk",
    "riskIsUnlimited",
}
WHEEL_KEYS = {
    "type",
    "shares",
    "strike",
    "effectiveCostBasis",
    "premiumCollected",
    "coverageStatus",
    "uncoveredShares",
    "coveredCallCount",
}
CONCENTRATION_KEYS = {"id", "ticker", "strategy", "capitalAtRisk", "sharePct"}


def _context() -> dict[str, Any]:
    ctx: dict[str, Any] = load_fixture("db_v26_full.json")["mcpContext"]
    return ctx


def test_fixture_has_every_top_level_key_the_tools_read() -> None:
    assert set(_context()) >= CONTEXT_KEYS


def test_fixture_portfolio_sections() -> None:
    portfolio = _context()["portfolio"]
    assert PORTFOLIO_KEYS - {"largestLoser"} <= set(portfolio)  # a loser is not always present
    assert set(portfolio["pl"]) >= PL_KEYS
    assert set(portfolio["performance"]) >= PERFORMANCE_KEYS
    assert {"collateralAtRisk", "totalMaxRisk"} <= set(portfolio["risk"])


def test_fixture_position_shapes() -> None:
    ctx = _context()
    assert POSITION_KEYS - {"riskIsUnlimited"} <= set(ctx["activePositions"][0])
    assert set(ctx["wheelPmccPositions"][0]) >= WHEEL_KEYS
    assert set(ctx["concentration"][0]) >= CONCENTRATION_KEYS


def test_default_projections_only_name_real_keys() -> None:
    from gammaledger_mcp.tools_positions import OPEN_POSITION_DEFAULT_FIELDS

    assert set(OPEN_POSITION_DEFAULT_FIELDS) == POSITION_KEYS


@pytest.mark.skipif(
    not APP_SOURCE.exists(), reason="needs the full GammaLedger repository checkout"
)
class TestAppStillEmitsWhatTheServerReads:
    """Compare against the app's builder. Keys are matched as whole words in its source."""

    @pytest.fixture(scope="class")
    def source(self) -> str:
        return APP_SOURCE.read_text(encoding="utf-8")

    @staticmethod
    def _missing(source: str, keys: set[str]) -> list[str]:
        return sorted(k for k in keys if not re.search(rf"\b{re.escape(k)}\b", source))

    def test_context_sections(self, source: str) -> None:
        assert self._missing(source, CONTEXT_KEYS | PORTFOLIO_KEYS) == []

    def test_portfolio_metrics(self, source: str) -> None:
        assert self._missing(source, PL_KEYS | PERFORMANCE_KEYS) == []

    def test_position_fields(self, source: str) -> None:
        # buildMCPTrade renames openedDate/expirationDate to opened/expires.
        assert self._missing(source, POSITION_KEYS) == []

    def test_wheel_fields(self, source: str) -> None:
        assert self._missing(source, WHEEL_KEYS) == []

    def test_concentration_fields(self, source: str) -> None:
        assert self._missing(source, CONCENTRATION_KEYS) == []

    def test_storage_schema_version_is_one_we_support(self) -> None:
        from gammaledger_mcp.database import SUPPORTED_SCHEMA_VERSIONS

        config = (REPO_ROOT / "src" / "core" / "config.ts").read_text(encoding="utf-8")
        match = re.search(r"CURRENT_STORAGE_VERSION\s*=\s*'([^']+)'", config)
        assert match, "CURRENT_STORAGE_VERSION not found in src/core/config.ts"
        assert match.group(1) in SUPPORTED_SCHEMA_VERSIONS, (
            f"The app now writes schema {match.group(1)}; add it to SUPPORTED_SCHEMA_VERSIONS "
            "in gammaledger_mcp/database.py after checking the tools against it."
        )


# ── Every tool against awkward databases ────────────────────────────────────

TOOL_ARGS: dict[str, dict[str, Any]] = {"gammaledger_position": {"trade_id": "TRD-0001"}}

CONTEXT_VARIANTS: dict[str, Any] = {
    "absent": None,
    "empty": {},
    "only-timestamps": {"generatedAt": "2026-11-02T10:00:00Z", "asOfDate": "2026-11-02"},
    "future-app": {
        "generatedAt": "2027-06-01T00:00:00Z",
        "asOfDate": "2027-06-01",
        "portfolio": {"counts": {"totalTrades": 3}, "newSection": {"a": 1}},
        "activePositions": [{"id": "X", "someNewField": True}],
        "brandNewTopLevelKey": [1, 2, 3],
    },
    "nulls-everywhere": {
        "portfolio": None,
        "activePositions": None,
        "wheelPmccPositions": None,
        "concentration": None,
        "tickerExposure": None,
    },
}


@pytest.mark.parametrize("variant", list(CONTEXT_VARIANTS))
async def test_every_tool_survives_context_variants(configure, connect, full_db, variant) -> None:
    data = json.loads(full_db.read_text())
    context = CONTEXT_VARIANTS[variant]
    if context is None:
        data.pop("mcpContext")
    else:
        data["mcpContext"] = context
    full_db.write_text(json.dumps(data))
    configure(full_db)

    async with connect() as s:
        tools = [t.name for t in (await s.list_tools()).tools]
        for name in tools:
            result = await call(s, name, **TOOL_ARGS.get(name, {}))
            assert result.content, f"{name} returned nothing for variant {variant!r}"
            text = result.content[0].text  # type: ignore[union-attr]
            if result.isError:
                # A clean, explained failure - never a stack trace.
                assert "Traceback" not in text, name
                assert "Save Database" in text or "No trade" in text, (name, text)
            else:
                body = payload(result)
                assert not (
                    isinstance(body, dict)
                    and body.get("error")
                    and variant not in ("absent", "empty")
                ), (
                    name,
                    body,
                )


async def test_trade_tools_work_with_no_context_at_all(configure, connect, no_context_db) -> None:
    """``position`` and ``search_trades`` only need the raw trades (README promises this)."""
    configure(no_context_db)
    async with connect() as s:
        found = payload(await call(s, "gammaledger_search_trades", status="Expired"))
        assert [t["id"] for t in found["trades"]] == ["TRD-0003"]
        one = payload(await call(s, "gammaledger_position", trade_id="TRD-0004"))
        assert one["summary"]["pl"] == -23.9
        info = payload(await call(s, "gammaledger_database_info"))
        assert info["mcpContextPresent"] is False
        assert payload(await call(s, "gammaledger_watchlist"))["count"] == 1
