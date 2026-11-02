"""Tools exercised end to end through an in-memory MCP client."""

from __future__ import annotations

import pytest
from gammaledger_mcp import __version__
from gammaledger_mcp.server import create_server

from .conftest import STALE_NOW, call, payload

TYPED_TOOLS = {
    "gammaledger_database_info",
    "gammaledger_portfolio_summary",
    "gammaledger_pl_breakdown",
    "gammaledger_open_positions",
    "gammaledger_position",
    "gammaledger_search_trades",
}


# ── Registration / schemas ──────────────────────────────────────────────────


async def test_all_tools_registered_with_schemas_on_typed_tools(configure, connect, full_db):
    configure(full_db)
    async with connect() as s:
        tools = {t.name: t for t in (await s.list_tools()).tools}
    assert len(tools) == 16
    assert {n for n, t in tools.items() if t.outputSchema} == TYPED_TOOLS
    assert "pl_min" in tools["gammaledger_search_trades"].inputSchema["properties"]
    assert "fields" in tools["gammaledger_open_positions"].inputSchema["properties"]


async def test_output_schemas_describe_the_documented_keys(configure, connect, full_db):
    configure(full_db)
    async with connect() as s:
        tools = {t.name: t for t in (await s.list_tools()).tools}
    info = tools["gammaledger_database_info"].outputSchema
    assert {"dataAgeDays", "isStale", "warnings", "tradeCount"} <= set(info["properties"])
    assert "dataAgeDays" not in info["required"]  # null when the export date is unknown
    search = tools["gammaledger_search_trades"].outputSchema
    assert {"matched", "matchedTotalPL", "trades"} <= set(search["properties"])


def test_server_reports_its_own_version():
    assert create_server()._mcp_server.version == __version__


# ── database_info / freshness ───────────────────────────────────────────────


async def test_database_info_fresh(configure, connect, full_db):
    configure(full_db)
    async with connect() as s:
        info = payload(await call(s, "gammaledger_database_info"))
    assert info["tradeCount"] == 7
    assert info["version"] == "2.6"
    assert info["isStale"] is False
    assert info["stale"] is False
    assert info["dataAgeDays"] == pytest.approx(0.1, abs=0.05)
    assert info["warnings"] == []


async def test_old_export_is_flagged_everywhere_it_matters(configure, connect, full_db):
    configure(full_db, now=STALE_NOW)  # six days after the export
    async with connect() as s:
        info = payload(await call(s, "gammaledger_database_info"))
        assert info["isStale"] is True
        assert info["stale"] is False  # no refresh error - the export is just old
        assert info["dataAgeDays"] == pytest.approx(6.1, abs=0.1)
        assert "Settings → Save Database" in info["warnings"][0]

        for name in ("gammaledger_open_positions", "gammaledger_portfolio_summary"):
            assert "exported 6.1 days ago" in payload(await call(s, name))["dataWarning"]
        for name in ("gammaledger_expiring_positions", "gammaledger_audit_risk"):
            assert "dataWarning" in payload(await call(s, name))
        assert "dataWarning" in payload(await call(s, "gammaledger_search_trades"))


async def test_no_warning_key_when_data_is_fresh(configure, connect, full_db):
    configure(full_db)
    async with connect() as s:
        assert "dataWarning" not in payload(await call(s, "gammaledger_open_positions"))
        assert "dataWarning" not in payload(await call(s, "gammaledger_audit_risk"))


# ── Portfolio ───────────────────────────────────────────────────────────────


async def test_portfolio_summary_is_structured_and_sparse(configure, connect, full_db):
    configure(full_db)
    async with connect() as s:
        result = await call(s, "gammaledger_portfolio_summary")
    data = payload(result)
    assert data["asOfDate"] == "2026-11-02"
    assert data["portfolio"]["counts"]["totalTrades"] == 7
    assert data["portfolio"]["pl"]["ytd"] == 420.55
    assert data["portfolio"]["performance"]["profitFactor"] == 3.1
    assert data["portfolio"]["trading"]["currentStreak"] == {"type": "win", "count": 1}
    assert data["portfolio"]["largestWinner"]["id"] == "TRD-0002"
    assert "largestLoser" not in data["portfolio"]  # absent in the file -> absent, not null


async def test_pl_breakdown(configure, connect, full_db):
    configure(full_db)
    async with connect() as s:
        data = payload(await call(s, "gammaledger_pl_breakdown"))
    assert data["pl"]["mtd"] == 198.7
    assert data["pl"]["last1y"] == 420.55


async def test_missing_mcp_context_is_a_clear_error(configure, connect, no_context_db):
    configure(no_context_db)
    async with connect() as s:
        result = await call(s, "gammaledger_portfolio_summary")
        assert result.isError is True
        assert "Save Database" in result.content[0].text
        # untyped tools keep their JSON error payload
        legacy = payload(await call(s, "gammaledger_strategy_breakdown"))
    assert legacy["error"] is True
    assert legacy["type"] == "MissingContextError"


async def test_one_unexpected_app_value_does_not_fail_the_call(configure, connect, full_db):
    """The file belongs to the app: a value that breaks the schema is omitted, the rest served."""
    import json

    data = json.loads(full_db.read_text())
    data["mcpContext"]["portfolio"]["pl"]["ytd"] = "n/a"  # wrong type
    data["mcpContext"]["portfolio"]["brandNewSection"] = {"x": 1}  # unknown key
    full_db.write_text(json.dumps(data))
    configure(full_db)
    async with connect() as s:
        result = await call(s, "gammaledger_portfolio_summary")
    assert result.isError is False
    data = payload(result)
    assert "ytd" not in data["portfolio"]["pl"]  # the bad value is left out ...
    assert data["portfolio"]["pl"]["mtd"] == 198.7  # ... its neighbours are intact
    assert data["portfolio"]["brandNewSection"] == {"x": 1}  # and new keys pass straight through


# ── Open positions: slim by default ─────────────────────────────────────────


async def test_open_positions_slim_by_default(configure, connect, full_db):
    configure(full_db)
    async with connect() as s:
        data = payload(await call(s, "gammaledger_open_positions"))
    assert data["count"] == 2
    spy = next(p for p in data["positions"] if p["id"] == "TRD-0001")
    assert spy == {
        "id": "TRD-0001",
        "ticker": "SPY",
        "strategy": "Iron Condor",
        "status": "Open",
        "strike": "555/560/620/625",
        "quantity": -1,
        "expires": "2026-11-20",
        "dte": 18,
        "pl": 20.55,
        "roi": 6.04,
        "capitalAtRisk": 340.0,
    }
    assert "entryPrice" not in spy
    assert "notes" not in next(p for p in data["positions"] if p["id"] == "TRD-0005")


async def test_open_positions_fields_selector_and_all(configure, connect, full_db):
    configure(full_db)
    async with connect() as s:
        picked = payload(await call(s, "gammaledger_open_positions", fields="ticker, dte ,pl"))
        assert picked["fields"] == ["ticker", "dte", "pl"]
        assert picked["positions"][0] == {"ticker": "SPY", "dte": 18, "pl": 20.55}

        full = payload(await call(s, "gammaledger_open_positions", fields="all"))
    assert "fields" not in full
    spy = next(p for p in full["positions"] if p["id"] == "TRD-0001")
    assert spy["entryPrice"] == 1.1
    assert spy["maxRiskLabel"] == "$340.00"


async def test_open_positions_filters(configure, connect, full_db):
    configure(full_db)
    async with connect() as s:
        assert payload(await call(s, "gammaledger_open_positions", ticker="spy"))["count"] == 1
        assert payload(await call(s, "gammaledger_open_positions", strategy="wheel"))["count"] == 1
        assert payload(await call(s, "gammaledger_open_positions", dte_max=15))["count"] == 1
        under = payload(await call(s, "gammaledger_open_positions", underwater_only=True))
    assert [p["id"] for p in under["positions"]] == ["TRD-0005"]


# ── gammaledger_position ────────────────────────────────────────────────────


async def test_position_app_vs_derived_vs_unknown(configure, connect, full_db):
    configure(full_db)
    async with connect() as s:
        app = payload(await call(s, "gammaledger_position", trade_id="TRD-0002"))
        assert app["summary"]["plSource"] == "app"
        assert app["summary"]["pl"] == 198.7
        assert len(app["trade"]["legs"]) == 2

        old = payload(await call(s, "gammaledger_position", trade_id="TRD-0004"))
        assert old["summary"]["plSource"] == "derived"
        assert old["summary"]["pl"] == -23.9
        assert old["summary"]["totalCredit"] == 330.0  # 100 + 110 + 120 gross, fees excluded
        assert old["summary"]["totalDebit"] == 350.0  # 20 + 30 + 300

        no_legs = payload(await call(s, "gammaledger_position", trade_id="TRD-0007"))
        assert no_legs["summary"] is None

        missing = await call(s, "gammaledger_position", trade_id="TRD-9999")
        assert missing.isError is True
        assert "TRD-9999" in missing.content[0].text

        blank = await call(s, "gammaledger_position", trade_id="  ")
    assert blank.isError is True


async def test_position_derived_roi_uses_max_risk_override(configure, connect, full_db):
    import json

    data = json.loads(full_db.read_text())
    next(t for t in data["trades"] if t["id"] == "TRD-0003")["maxRiskOverride"] = 95_000
    full_db.write_text(json.dumps(data))
    configure(full_db)
    async with connect() as s:
        result = payload(await call(s, "gammaledger_position", trade_id="TRD-0003"))
    assert result["summary"]["roi"] == 0.25  # 238.70 / 95,000


# ── gammaledger_search_trades ───────────────────────────────────────────────


async def test_search_covers_the_whole_history_with_pl_source(configure, connect, full_db):
    configure(full_db)
    async with connect() as s:
        data = payload(await call(s, "gammaledger_search_trades", status="Closed"))
    rows = {r["id"]: r for r in data["trades"]}
    assert rows["TRD-0002"]["plSource"] == "app"
    assert rows["TRD-0002"]["roi"] == 1.05
    assert rows["TRD-0004"]["plSource"] == "derived"
    assert rows["TRD-0004"]["pl"] == -23.9
    assert rows["TRD-0004"]["roi"] is None  # ROI is not guessed
    assert rows["TRD-0006"]["pl"] == 1499.35
    assert rows["TRD-0007"]["pl"] is None
    assert rows["TRD-0007"]["plSource"] is None
    assert data["matched"] == 4
    assert data["matchedWithPL"] == 3
    assert data["matchedTotalPL"] == pytest.approx(198.7 - 23.9 + 1499.35)


async def test_search_works_without_mcp_context(configure, connect, no_context_db):
    configure(no_context_db)
    async with connect() as s:
        data = payload(await call(s, "gammaledger_search_trades", ticker="QQQ"))
    assert data["trades"][0]["pl"] == 238.7
    assert data["trades"][0]["plSource"] == "derived"


async def test_search_date_ranges(configure, connect, full_db):
    configure(full_db)

    async def ids(s, **args):
        return [
            r["id"] for r in payload(await call(s, "gammaledger_search_trades", **args))["trades"]
        ]

    async with connect() as s:
        assert await ids(s, opened_after="2026-10-01") == ["TRD-0001", "TRD-0002"]
        assert await ids(s, closed_after="2026-02-01", closed_before="2026-03-31") == [
            "TRD-0003",
            "TRD-0004",
        ]
        assert await ids(s, opened_before="2026-01-31") == ["TRD-0006", "TRD-0007"]


async def test_search_pl_range(configure, connect, full_db):
    configure(full_db)

    async def ids(s, **args):
        return [
            r["id"] for r in payload(await call(s, "gammaledger_search_trades", **args))["trades"]
        ]

    async with connect() as s:
        assert await ids(s, pl_max=0) == ["TRD-0004", "TRD-0005"]  # losers (wheel is marked -150)
        assert await ids(s, pl_min=200) == ["TRD-0003", "TRD-0006"]
        assert await ids(s, pl_min=0, pl_max=200) == ["TRD-0001", "TRD-0002"]
        assert await ids(s, status="Closed", pl_min=-1e9) == ["TRD-0002", "TRD-0004", "TRD-0006"]


async def test_search_pl_filters_exclude_unknown_pl(configure, connect, full_db):
    configure(full_db)
    async with connect() as s:
        everything = payload(await call(s, "gammaledger_search_trades", pl_min=-1e9, limit=200))
    assert "TRD-0007" not in [r["id"] for r in everything["trades"]]  # closed, no legs: pl unknown


async def test_search_sorting_limit_and_truncation(configure, connect, full_db):
    configure(full_db)
    async with connect() as s:
        best = payload(await call(s, "gammaledger_search_trades", sort_by="pl", limit=2))
        assert [r["id"] for r in best["trades"]] == ["TRD-0006", "TRD-0003"]
        assert best["truncated"] is True
        assert best["matched"] == 7
        assert best["returned"] == 2
        # the total spans every match, not just the rows that fit
        assert best["matchedTotalPL"] == pytest.approx(20.55 + 198.7 + 238.7 - 23.9 - 150 + 1499.35)

        worst = payload(
            await call(s, "gammaledger_search_trades", sort_by="pl", descending=False, limit=1)
        )
        assert worst["trades"][0]["id"] == "TRD-0005"

        newest = payload(await call(s, "gammaledger_search_trades", sort_by="closed", limit=2))
    assert [r["id"] for r in newest["trades"]] == ["TRD-0002", "TRD-0004"]


async def test_search_field_selection(configure, connect, full_db):
    configure(full_db)
    async with connect() as s:
        slim = payload(await call(s, "gammaledger_search_trades", ticker="QQQ", fields="id,pl"))
        assert slim["trades"] == [{"id": "TRD-0003", "pl": 238.7}]
        assert slim["fields"] == ["id", "pl"]

        full = payload(await call(s, "gammaledger_search_trades", ticker="QQQ", fields="all"))
        row = full["trades"][0]
        assert row["legsCount"] == 1
        assert row["totalCredit"] == 240.0
        assert row["totalFees"] == 1.3
        assert row["hasComputedSummary"] is False

        default = payload(await call(s, "gammaledger_search_trades", ticker="QQQ"))
    assert "legsCount" not in default["trades"][0]


@pytest.mark.parametrize(
    "args",
    [
        {"opened_after": "11/02/2026"},
        {"closed_before": "yesterday"},
        {"sort_by": "banana"},
    ],
)
async def test_search_rejects_bad_arguments(configure, connect, full_db, args):
    configure(full_db)
    async with connect() as s:
        result = await call(s, "gammaledger_search_trades", **args)
    assert result.isError is True


async def test_search_limit_is_clamped(configure, connect, full_db):
    configure(full_db)
    async with connect() as s:
        assert payload(await call(s, "gammaledger_search_trades", limit=0))["returned"] == 1
        assert payload(await call(s, "gammaledger_search_trades", limit=10_000))["returned"] == 7


# ── The rest keep their behaviour ───────────────────────────────────────────


async def test_untyped_tools_still_return_json_text(configure, connect, full_db):
    configure(full_db)
    async with connect() as s:
        wheel = await call(s, "gammaledger_wheel_pmcc_positions", position_type="wheel")
        assert wheel.structuredContent is None  # no duplicate copy of the payload
        assert payload(wheel)["count"] == 1
        expiring = payload(await call(s, "gammaledger_expiring_positions", within_days=15))
        assert [p["id"] for p in expiring["positions"]] == ["TRD-0005"]
        audit = payload(await call(s, "gammaledger_audit_risk"))
        assert audit["high"][0]["kind"] == "concentration"
        assert payload(await call(s, "gammaledger_watchlist"))["count"] == 1
        recent = payload(await call(s, "gammaledger_recent_closed_trades"))
    assert recent["count"] == 1


async def test_prompts_and_resources_are_registered(configure, connect, full_db):
    configure(full_db)
    async with connect() as s:
        prompts = {p.name for p in (await s.list_prompts()).prompts}
        resources = {str(r.uri) for r in (await s.list_resources()).resources}
    assert "analyze_portfolio" in prompts
    assert "gammaledger://database/info" in resources
