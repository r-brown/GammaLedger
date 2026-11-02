"""Tests for the GammaLedgerDB loader."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import pytest
from gammaledger_mcp.database import (
    DatabaseError,
    GammaLedgerDB,
    _looks_like_database,
    parse_timestamp,
)


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


# ── Resilience: a failed local re-read serves the last good copy ─────────────


def _bump_mtime(path: Path, seconds: float = 10) -> None:
    import os

    t = path.stat().st_mtime + seconds
    os.utime(path, (t, t))


def test_local_parse_failure_serves_stale_copy(tmp_path: Path) -> None:
    db_file = _write(tmp_path, _sample_db())
    db = GammaLedgerDB(db_file)
    assert len(db.trades) == 2

    db_file.write_text('{"version": "2.6", "trades": [', encoding="utf-8")  # sync mid-write
    _bump_mtime(db_file)

    assert len(db.trades) == 2  # still the previous copy, no exception
    info = db.info()
    assert info["stale"] is True
    assert "not valid JSON" in info["lastRefreshError"]
    assert any("serving the last good copy" in w for w in info["warnings"])


def test_local_recovers_when_the_file_settles(tmp_path: Path) -> None:
    db_file = _write(tmp_path, _sample_db())
    db = GammaLedgerDB(db_file)
    _ = db.trades
    db_file.write_text("{broken", encoding="utf-8")
    _bump_mtime(db_file)
    assert db.info()["stale"] is True

    newer = _sample_db()
    newer["trades"].append({"id": "TRD-0003", "ticker": "QQQ", "strategy": "Wheel"})
    db_file.write_text(json.dumps(newer), encoding="utf-8")
    _bump_mtime(db_file, 20)

    assert len(db.trades) == 3
    info = db.info()
    assert info["stale"] is False
    assert info["lastRefreshError"] is None


def test_local_file_vanishing_serves_stale_copy(tmp_path: Path) -> None:
    db_file = _write(tmp_path, _sample_db())
    db = GammaLedgerDB(db_file)
    _ = db.trades
    db_file.unlink()  # sync clients replace files by delete + rename
    assert len(db.trades) == 2
    assert db.info()["stale"] is True


def test_wrong_shape_on_reload_serves_stale_copy(tmp_path: Path) -> None:
    db_file = _write(tmp_path, _sample_db())
    db = GammaLedgerDB(db_file)
    _ = db.trades
    db_file.write_text(json.dumps({"hello": "world"}), encoding="utf-8")
    _bump_mtime(db_file)
    assert len(db.trades) == 2
    assert db.info()["stale"] is True


def test_first_load_failure_still_raises(tmp_path: Path) -> None:
    bad = tmp_path / "gammaledger.json"
    bad.write_text("{nope", encoding="utf-8")
    with pytest.raises(DatabaseError):
        _ = GammaLedgerDB(bad).data


# ── Data age ────────────────────────────────────────────────────────────────


def _clock(day: str):
    when = datetime.fromisoformat(day).replace(tzinfo=timezone.utc)
    return lambda: when


def test_data_age_and_is_stale(tmp_path: Path) -> None:
    payload = _sample_db()
    payload["exportDate"] = "2026-10-26T10:00:00.000Z"  # a Monday
    db_file = _write(tmp_path, payload)

    fresh = GammaLedgerDB(db_file, clock=_clock("2026-10-27T10:00:00")).info()
    assert fresh["dataAgeDays"] == 1.0
    assert fresh["isStale"] is False
    assert fresh["warnings"] == []

    week_old = GammaLedgerDB(db_file, clock=_clock("2026-11-02T10:00:00")).info()
    assert week_old["dataAgeDays"] == 7.0
    assert week_old["isStale"] is True
    assert week_old["stale"] is False  # nothing failed to refresh; the export is just old
    assert "7.0 days ago" in week_old["warnings"][0]


def test_stale_threshold_is_configurable(tmp_path: Path) -> None:
    payload = _sample_db()
    payload["exportDate"] = "2026-10-26T10:00:00Z"
    db_file = _write(tmp_path, payload)
    now = _clock("2026-10-29T12:00:00")  # 3.08 days
    assert GammaLedgerDB(db_file, clock=now).info()["isStale"] is True
    assert GammaLedgerDB(db_file, clock=now, stale_days=5).info()["isStale"] is False


def test_stale_days_env_var(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GAMMALEDGER_STALE_DAYS", "30")
    payload = _sample_db()
    payload["exportDate"] = "2026-09-01T00:00:00Z"
    info = GammaLedgerDB(_write(tmp_path, payload), clock=_clock("2026-10-01T00:00:00")).info()
    assert info["staleAfterDays"] == 30.0
    assert info["isStale"] is False


def test_data_age_falls_back_to_mcp_context_timestamp(tmp_path: Path) -> None:
    payload = _sample_db()
    del payload["exportDate"]
    payload["mcpContext"]["generatedAt"] = "2026-10-20T00:00:00.000Z"
    info = GammaLedgerDB(_write(tmp_path, payload), clock=_clock("2026-11-02T00:00:00")).info()
    assert info["dataAgeDays"] == 13.0
    assert info["isStale"] is True


def test_unknown_export_date_is_not_reported_stale(tmp_path: Path) -> None:
    payload = _sample_db()
    del payload["exportDate"]
    del payload["mcpContext"]
    info = GammaLedgerDB(_write(tmp_path, payload)).info()
    assert info["dataAgeDays"] is None
    assert info["isStale"] is False


def test_future_export_date_is_clamped(tmp_path: Path) -> None:
    payload = _sample_db()
    payload["exportDate"] = "2030-01-01T00:00:00Z"
    info = GammaLedgerDB(_write(tmp_path, payload), clock=_clock("2026-11-02T00:00:00")).info()
    assert info["dataAgeDays"] == 0.0


@pytest.mark.parametrize(
    "value",
    ["2026-11-02T10:00:00.000Z", "2026-11-02T10:00:00+00:00", "2026-11-02T10:00:00", "2026-11-02"],
)
def test_parse_timestamp_formats(value: str) -> None:
    parsed = parse_timestamp(value)
    assert parsed is not None
    assert parsed.tzinfo is not None
    assert parsed.date().isoformat() == "2026-11-02"


def test_parse_timestamp_epoch_and_garbage() -> None:
    assert parse_timestamp(1_793_000_000_000) == parse_timestamp(1_793_000_000)  # ms vs s
    assert parse_timestamp("not a date") is None
    assert parse_timestamp(None) is None
    assert parse_timestamp(True) is None


# ── Folder mode ─────────────────────────────────────────────────────────────


def test_folder_prefers_conventional_name_then_newest(tmp_path: Path) -> None:
    older = tmp_path / "backup-2026-10.json"
    older.write_text(json.dumps(_sample_db()), encoding="utf-8")
    newer_payload = _sample_db()
    newer_payload["trades"].append({"id": "TRD-0003"})
    newest = tmp_path / "backup-2026-11.json"
    newest.write_text(json.dumps(newer_payload), encoding="utf-8")
    _bump_mtime(newest, 100)

    db = GammaLedgerDB(tmp_path)
    assert len(db.trades) == 3  # newest *.json that looks like a database

    (tmp_path / "gammaledger.json").write_text(json.dumps(_sample_db()), encoding="utf-8")
    assert len(GammaLedgerDB(tmp_path).trades) == 2  # the conventional name wins


def test_folder_skips_files_that_are_not_databases(tmp_path: Path) -> None:
    (tmp_path / "settings.json").write_text('{"theme": "dark"}', encoding="utf-8")
    (tmp_path / "list.json").write_text("[1, 2, 3]", encoding="utf-8")
    (tmp_path / "broken.json").write_text("{oops", encoding="utf-8")
    good = tmp_path / "export.json"
    good.write_text(json.dumps(_sample_db()), encoding="utf-8")
    for name in ("settings.json", "list.json", "broken.json"):
        _bump_mtime(tmp_path / name, 100)  # newer than the real one

    assert len(GammaLedgerDB(tmp_path).trades) == 2


def test_folder_with_no_database_raises(tmp_path: Path) -> None:
    (tmp_path / "settings.json").write_text('{"theme": "dark"}', encoding="utf-8")
    with pytest.raises(DatabaseError, match="No GammaLedger database"):
        _ = GammaLedgerDB(tmp_path).data


def test_looks_like_database_reads_only_the_head_when_it_can(tmp_path: Path) -> None:
    big = tmp_path / "big.json"
    payload = {"version": "2.6", "trades": [], "padding": "x" * 5_000_000}
    big.write_text(json.dumps(payload), encoding="utf-8")
    assert _looks_like_database(big) is True


def test_looks_like_database_handles_sorted_keys(tmp_path: Path) -> None:
    """A re-serialised file can put a huge mcpContext before ``trades``; still recognised."""
    payload = {"mcpContext": {"blob": "y" * 20_000}, "trades": [{"id": "T"}], "version": "2.6"}
    path = tmp_path / "sorted.json"
    path.write_text(json.dumps(payload), encoding="utf-8")
    assert _looks_like_database(path) is True
    nope = tmp_path / "nope.json"
    nope.write_text(
        json.dumps({"mcpContext": {"blob": "y" * 20_000}, "other": []}), encoding="utf-8"
    )
    assert _looks_like_database(nope) is False


def test_folder_scan_is_memoised(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    from gammaledger_mcp import database as dbmod

    (tmp_path / "settings.json").write_text('{"theme": "dark"}', encoding="utf-8")
    _write(tmp_path, _sample_db())
    _bump_mtime(tmp_path / "settings.json", 100)
    calls: list[str] = []
    real = dbmod._looks_like_database
    monkeypatch.setattr(dbmod, "_looks_like_database", lambda p: calls.append(p.name) or real(p))

    db = GammaLedgerDB(tmp_path)
    for _ in range(5):
        _ = db.trades
    # Each candidate is inspected at most once, not on every tool call.
    assert len(calls) == len(set(calls)) <= 2


# ── Schema version ──────────────────────────────────────────────────────────


def test_supported_schema_has_no_warning(tmp_path: Path) -> None:
    payload = _sample_db()
    payload["version"] = "2.6"
    info = GammaLedgerDB(_write(tmp_path, payload), clock=_clock("2026-04-26T12:00:00")).info()
    assert info["warnings"] == []


def test_unknown_schema_warns_but_loads(tmp_path: Path, caplog: pytest.LogCaptureFixture) -> None:
    payload = _sample_db()
    payload["version"] = "3.1"
    with caplog.at_level("WARNING"):
        db = GammaLedgerDB(_write(tmp_path, payload), clock=_clock("2026-04-26T12:00:00"))
        info = db.info()
    assert info["tradeCount"] == 2  # not a failure
    assert any("schema version '3.1'" in w for w in info["warnings"])
    assert any("schema version '3.1'" in r.getMessage() for r in caplog.records)


# ── Trade summaries and filters ─────────────────────────────────────────────


def test_trade_pl_summary_prefers_app_then_derives(full_db: Path) -> None:
    db = GammaLedgerDB(full_db)
    app = db.trade_pl_summary(db.get_trade_by_id("TRD-0002") or {})
    assert app is not None
    assert app["plSource"] == "app"
    assert app["pl"] == 198.7
    assert app["roi"] == 1.05

    derived = db.trade_pl_summary(db.get_trade_by_id("TRD-0003") or {})
    assert derived is not None
    assert derived["plSource"] == "derived"
    assert derived["pl"] == 238.7

    assert db.trade_pl_summary(db.get_trade_by_id("TRD-0007") or {}) is None  # closed, no legs


def test_trade_pl_summary_does_not_mutate_the_index(full_db: Path) -> None:
    db = GammaLedgerDB(full_db)
    trade = db.get_trade_by_id("TRD-0002") or {}
    first = db.trade_pl_summary(trade)
    assert first is not None
    first["pl"] = 999
    again = db.trade_pl_summary(trade)
    assert again is not None
    assert again["pl"] == 198.7


def test_trade_pl_summary_works_without_mcp_context(no_context_db: Path) -> None:
    db = GammaLedgerDB(no_context_db)
    closed = db.trade_pl_summary(db.get_trade_by_id("TRD-0004") or {})
    assert closed is not None
    assert closed["pl"] == -23.9
    assert closed["plSource"] == "derived"
    assert db.trade_pl_summary(db.get_trade_by_id("TRD-0001") or {}) is None  # open: unknown


def test_find_trades_date_filters(full_db: Path) -> None:
    db = GammaLedgerDB(full_db)

    def ids(**kw: str) -> list[str]:
        return [t["id"] for t in db.find_trades(**kw)]

    assert ids(opened_after="2026-10-01") == ["TRD-0001", "TRD-0002"]
    assert ids(opened_before="2026-02-28") == ["TRD-0003", "TRD-0006", "TRD-0007"]
    assert ids(closed_after="2026-03-01", closed_before="2026-03-31") == ["TRD-0004"]
    assert ids(closed_after="2026-10-15") == ["TRD-0002"]  # inclusive bound; open trades excluded
    assert ids(opened_after="2026-10-01", ticker="AAPL") == ["TRD-0002"]
