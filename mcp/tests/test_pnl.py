"""Derived P&L must reproduce the app's arithmetic (``calculateLegCashFlow``)."""

from __future__ import annotations

from typing import Any

import pytest
from gammaledger_mcp.pnl import derive_trade_pl, leg_cash_flow, round2

from .conftest import load_fixture


def _leg(
    order: str, typ: str = "PUT", qty: float = 1, prem: float = 1.0, fees: float = 0.0, **kw: Any
):
    return {"orderType": order, "type": typ, "quantity": qty, "premium": prem, "fees": fees, **kw}


@pytest.mark.parametrize(
    ("leg", "expected"),
    [
        (_leg("STO", qty=2, prem=1.2, fees=1.3), 238.7),  # credit: 2 * 1.2 * 100 - fees
        (_leg("BTO", prem=0.5, fees=0.65), -50.65),  # debit
        (_leg("BTC", prem=0.5), -50.0),
        (_leg("STC", prem=0.5), 50.0),
        (_leg("STO", prem=-2.0), 200.0),  # a negative stored price never flips a sale
        (_leg("STO", qty=-3, prem=1.0), 300.0),  # quantity sign is ignored
        (_leg("STO", qty=0, fees=0.65), -0.65),  # no contracts: only the fee remains
        (_leg("BTO", "STOCK", qty=100, prem=50.0, multiplier=1), -5000.0),
        (
            _leg("BTO", "STOCK", qty=100, prem=0, strike=48.5, multiplier=1),
            -4850.0,
        ),  # strike fallback
        (_leg("STO", "CALL", prem=1.0, multiplier=None), 100.0),  # missing multiplier -> 100
        (_leg("BTO", "STOCK", qty=10, prem=5.0, multiplier=None), -50.0),  # ... 1 for stock
        (_leg("STO", prem=1.0, multiplier=0), 100.0),  # invalid multiplier -> default
        (_leg("Sell to Open", prem=1.0), 100.0),  # long-form order text
        ({"action": "SELL", "side": "OPEN", "type": "PUT", "quantity": 1, "premium": 1.0}, 100.0),
        ({"action": "BUY", "side": "CLOSE", "type": "PUT", "quantity": 1, "premium": 1.0}, -100.0),
        ({"action": "SELL", "side": "ROLL", "type": "PUT", "quantity": 1, "premium": 1.0}, 100.0),
        ({"type": "PUT", "quantity": 1, "premium": 1.0}, -100.0),  # nothing says "sell" -> buy
    ],
)
def test_leg_cash_flow(leg: dict[str, Any], expected: float) -> None:
    assert round2(leg_cash_flow(leg)) == pytest.approx(expected)


def test_round2_matches_js_to_fixed() -> None:
    assert round2(0.125) == 0.13  # JS: (0.125).toFixed(2) === "0.13"; Python round() gives 0.12
    assert round2(-0.125) == -0.13
    assert round2(float("nan")) == 0.0


def test_derive_closed_trade_fields() -> None:
    trade = {
        "status": "Closed",
        "legs": [_leg("STO", prem=2.5, fees=0.65), _leg("BTC", prem=0.5, fees=0.65)],
    }
    derived = derive_trade_pl(trade)
    assert derived is not None
    assert derived["pl"] == 198.7
    assert derived["cashFlow"] == 198.7
    assert derived["totalCredit"] == 250.0
    assert derived["totalDebit"] == 50.0
    assert derived["totalFees"] == 1.3
    assert derived["plSource"] == "derived"
    assert derived["roi"] is None


def test_roi_only_with_explicit_max_risk() -> None:
    trade = {"status": "Expired", "maxRiskOverride": 1000, "legs": [_leg("STO", prem=2.0)]}
    derived = derive_trade_pl(trade)
    assert derived is not None
    assert derived["roi"] == 20.0  # 200 / 1000


@pytest.mark.parametrize("status", ["Open", "Rolling", "Assigned", "", None])
def test_not_derived_unless_closed_or_expired(status: Any) -> None:
    assert derive_trade_pl({"status": status, "legs": [_leg("STO")]}) is None


def test_not_derived_without_legs() -> None:
    assert derive_trade_pl({"status": "Closed", "legs": []}) is None
    assert derive_trade_pl({"status": "Closed"}) is None
    assert derive_trade_pl({"status": "Closed", "legs": "junk"}) is None


def test_status_is_case_insensitive() -> None:
    assert derive_trade_pl({"status": " closed ", "legs": [_leg("STO")]}) is not None


@pytest.mark.parametrize(
    ("trade_id", "expected_pl"),
    [
        ("TRD-0002", 198.7),  # also embedded by the app with the same number
        ("TRD-0003", 238.7),  # expired, two contracts
        ("TRD-0004", -23.9),  # iron condor closed early at a loss
        ("TRD-0006", 1499.35),  # stock round trip + covered call, legacy action/side legs
    ],
)
def test_fixture_trades(trade_id: str, expected_pl: float) -> None:
    trades = {t["id"]: t for t in load_fixture("db_v26_full.json")["trades"]}
    derived = derive_trade_pl(trades[trade_id])
    assert derived is not None
    assert derived["pl"] == pytest.approx(expected_pl)


def test_derivation_agrees_with_the_apps_own_number() -> None:
    """TRD-0002 is in ``recentClosedTrades``; deriving it must give what the app computed."""
    data = load_fixture("db_v26_full.json")
    app_pl = next(
        t["pl"] for t in data["mcpContext"]["recentClosedTrades"] if t["id"] == "TRD-0002"
    )
    trade = next(t for t in data["trades"] if t["id"] == "TRD-0002")
    derived = derive_trade_pl(trade)
    assert derived is not None
    assert derived["pl"] == app_pl
