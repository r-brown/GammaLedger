"""GammaLedger database loader.

Reads the JSON file produced by the GammaLedger web app's "Save Database"
feature. The file contains a `trades` array (raw trade objects) and an
`mcpContext` section (pre-computed dashboard metrics, breakdowns, and
position summaries) that we use as the single source of truth for the AI.

Reload-on-mtime keeps the AI's view fresh without restarting the server.
"""

from __future__ import annotations

import json
import logging
import os
import threading
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

DEFAULT_DB_PATH = Path.home() / "gammaledger.json"


class DatabaseError(RuntimeError):
    """Raised when the GammaLedger database file is missing or unreadable."""


class GammaLedgerDB:
    """Lazy, mtime-cached reader for a GammaLedger JSON database file."""

    def __init__(self, db_path: Path | str | None = None) -> None:
        resolved = (
            Path(db_path)
            if db_path is not None
            else Path(os.environ.get("GAMMALEDGER_DB_PATH") or DEFAULT_DB_PATH)
        )
        self._db_path: Path = resolved.expanduser().resolve()
        self._data: dict[str, Any] | None = None
        self._mtime: float | None = None
        self._lock = threading.Lock()

    # ── Properties ──────────────────────────────────────────────────────

    @property
    def path(self) -> Path:
        return self._db_path

    @property
    def data(self) -> dict[str, Any]:
        self._reload_if_needed()
        return self._data or {}

    @property
    def mcp_context(self) -> dict[str, Any]:
        ctx = self.data.get("mcpContext")
        return ctx if isinstance(ctx, dict) else {}

    @property
    def trades(self) -> list[dict[str, Any]]:
        trades = self.data.get("trades")
        return trades if isinstance(trades, list) else []

    # ── Loading / refresh ───────────────────────────────────────────────

    def _reload_if_needed(self) -> None:
        if not self._db_path.exists():
            raise DatabaseError(
                f"GammaLedger database file not found: {self._db_path}. "
                "Save your database from the GammaLedger app "
                "(Settings → Save Database) and set GAMMALEDGER_DB_PATH "
                "to the resulting JSON file."
            )

        try:
            current_mtime = self._db_path.stat().st_mtime
        except OSError as exc:
            raise DatabaseError(f"Cannot stat database file: {exc}") from exc

        with self._lock:
            if self._data is not None and self._mtime == current_mtime:
                return
            try:
                with self._db_path.open("r", encoding="utf-8") as f:
                    self._data = json.load(f)
            except json.JSONDecodeError as exc:
                raise DatabaseError(f"Database file is not valid JSON: {exc}") from exc
            except OSError as exc:
                raise DatabaseError(f"Cannot read database file: {exc}") from exc
            self._mtime = current_mtime
            trades = self._data.get("trades") if isinstance(self._data, dict) else None
            ctx = self._data.get("mcpContext") if isinstance(self._data, dict) else None
            logger.info(
                "Loaded GammaLedger DB: %d trades, mcpContext=%s, version=%s",
                len(trades) if isinstance(trades, list) else 0,
                "present" if isinstance(ctx, dict) and ctx else "missing",
                self._data.get("version", "unknown") if isinstance(self._data, dict) else "unknown",
            )

    # ── Convenience queries ─────────────────────────────────────────────

    def info(self) -> dict[str, Any]:
        d = self.data
        ctx = self.mcp_context
        return {
            "path": str(self._db_path),
            "version": d.get("version"),
            "exportDate": d.get("exportDate") or d.get("timestamp"),
            "fileName": d.get("fileName"),
            "tradeCount": len(self.trades),
            "mcpContextPresent": bool(ctx),
            "mcpContextGeneratedAt": ctx.get("generatedAt"),
            "asOfDate": ctx.get("asOfDate"),
        }

    def get_trade_by_id(self, trade_id: str) -> dict[str, Any] | None:
        if not trade_id:
            return None
        target = trade_id.strip()
        for t in self.trades:
            if str(t.get("id", "")) == target:
                return t
        return None

    def find_trades(
        self,
        ticker: str | None = None,
        strategy: str | None = None,
        status: str | None = None,
    ) -> list[dict[str, Any]]:
        ticker_q = ticker.strip().upper() if ticker else None
        strategy_q = strategy.strip().lower() if strategy else None
        status_q = status.strip().lower() if status else None

        results: list[dict[str, Any]] = []
        for t in self.trades:
            if ticker_q and str(t.get("ticker", "")).upper() != ticker_q:
                continue
            if strategy_q and strategy_q not in str(t.get("strategy", "")).lower():
                continue
            if status_q and status_q != str(t.get("status", "")).lower():
                continue
            results.append(t)
        return results


# ── Module-level singleton ──────────────────────────────────────────────

_db: GammaLedgerDB | None = None
_db_lock = threading.Lock()


def configure_db(db_path: Path | str | None) -> GammaLedgerDB:
    """Initialise the module-level DB singleton (called once from main)."""
    global _db
    with _db_lock:
        _db = GammaLedgerDB(db_path)
    return _db


def get_db() -> GammaLedgerDB:
    """Return the configured DB singleton, creating a default one if needed."""
    global _db
    if _db is None:
        with _db_lock:
            if _db is None:
                _db = GammaLedgerDB()
    return _db
