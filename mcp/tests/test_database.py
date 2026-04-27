"""Tests for the GammaLedgerDB loader."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from gammaledger_mcp.database import DatabaseError, GammaLedgerDB


def _sample_db() -> dict:
    return {
        "version": "2.5",
        "exportDate": "2026-04-26T10:00:00Z",
        "fileName": "test.json",
        "trades": [
            {
                "id": "TRD-0001",
                "ticker": "SPY",
                "strategy": "Iron Condor",
                "status": "Open",
                "pl": 45.12,
                "roi": 4.75,
            },
            {
                "id": "TRD-0002",
                "ticker": "AAPL",
                "strategy": "Wheel",
                "status": "Closed",
                "pl": -120.5,
                "roi": -12.0,
            },
        ],
        "mcpContext": {
            "generatedAt": "2026-04-26T10:00:00Z",
            "asOfDate": "2026-04-26",
            "portfolio": {
                "counts": {"totalTrades": 2, "active": 1, "closed": 1, "assigned": 0},
                "pl": {"total": -75.38, "ytd": -75.38},
            },
            "activePositions": [{"id": "TRD-0001", "ticker": "SPY"}],
            "wheelPmccPositions": [],
        },
    }


def _write(tmp_path: Path, payload: dict) -> Path:
    db_file = tmp_path / "gammaledger.json"
    db_file.write_text(json.dumps(payload), encoding="utf-8")
    return db_file


def test_loads_basic_db(tmp_path: Path) -> None:
    db = GammaLedgerDB(_write(tmp_path, _sample_db()))
    assert db.info()["tradeCount"] == 2
    assert db.info()["mcpContextPresent"] is True
    assert db.mcp_context["asOfDate"] == "2026-04-26"


def test_get_trade_by_id_hits(tmp_path: Path) -> None:
    db = GammaLedgerDB(_write(tmp_path, _sample_db()))
    trade = db.get_trade_by_id("TRD-0002")
    assert trade is not None
    assert trade["ticker"] == "AAPL"


def test_get_trade_by_id_misses(tmp_path: Path) -> None:
    db = GammaLedgerDB(_write(tmp_path, _sample_db()))
    assert db.get_trade_by_id("TRD-9999") is None


def test_find_trades_filters(tmp_path: Path) -> None:
    db = GammaLedgerDB(_write(tmp_path, _sample_db()))
    assert len(db.find_trades(ticker="spy")) == 1
    assert len(db.find_trades(status="Closed")) == 1
    assert len(db.find_trades(strategy="iron")) == 1
    assert len(db.find_trades(ticker="GOOG")) == 0


def test_missing_file_raises(tmp_path: Path) -> None:
    db = GammaLedgerDB(tmp_path / "nope.json")
    with pytest.raises(DatabaseError):
        _ = db.data


def test_invalid_json_raises(tmp_path: Path) -> None:
    bad = tmp_path / "bad.json"
    bad.write_text("{not valid json", encoding="utf-8")
    db = GammaLedgerDB(bad)
    with pytest.raises(DatabaseError):
        _ = db.data


def test_reloads_on_mtime_change(tmp_path: Path) -> None:
    db_file = _write(tmp_path, _sample_db())
    db = GammaLedgerDB(db_file)
    assert len(db.trades) == 2

    # Mutate file with a future mtime
    new_payload = _sample_db()
    new_payload["trades"].append({"id": "TRD-0003", "ticker": "QQQ", "strategy": "Wheel"})
    db_file.write_text(json.dumps(new_payload), encoding="utf-8")
    import os

    future = db_file.stat().st_mtime + 10
    os.utime(db_file, (future, future))

    assert len(db.trades) == 3


def test_missing_mcp_context_returns_empty_dict(tmp_path: Path) -> None:
    payload = _sample_db()
    del payload["mcpContext"]
    db = GammaLedgerDB(_write(tmp_path, payload))
    assert db.mcp_context == {}
    assert db.info()["mcpContextPresent"] is False
