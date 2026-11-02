"""GammaLedger database loader.

Reads the JSON file produced by the GammaLedger web app's "Save Database"
feature. The file contains a `trades` array (persisted trade objects) and an
`mcpContext` section (pre-computed dashboard metrics, breakdowns, and
position summaries) that we use as the single source of truth for the AI.

The database can live in any of these places:

* a local file                      ``/home/me/gammaledger.json``
* a local folder                    ``/home/me/GammaLedger/`` (newest ``*.json`` that
                                    looks like a GammaLedger database wins)
* a ``file://`` URL
* a remote ``http(s)://`` URL       (optional bearer token / extra headers,
                                    conditional GET, stale-cache fallback)

Local files are re-read whenever their mtime changes. Remote files are
re-checked at most every ``refresh_seconds`` using ETag / Last-Modified.

NOTE: the app strips runtime-computed fields (``pl``, ``roi``, ``dte``,
``capitalAtRisk`` ...) from persisted trades, so per-trade P&L is only
available through ``mcpContext`` summaries. See ``trade_summary()``.
"""

from __future__ import annotations

import json
import logging
import os
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

DEFAULT_DB_PATH = Path.home() / "gammaledger.json"
DEFAULT_REFRESH_SECONDS = 60.0
DEFAULT_TIMEOUT_SECONDS = 20.0
MAX_REMOTE_BYTES = 256 * 1024 * 1024  # refuse to buffer anything bigger than this
_LOOPBACK_HOSTS = {"localhost", "127.0.0.1", "::1"}


class DatabaseError(RuntimeError):
    """Raised when the GammaLedger database is missing, unreadable or invalid."""


class MissingContextError(DatabaseError):
    """Raised when a tool needs ``mcpContext`` but the saved database has none."""


@dataclass(frozen=True)
class Source:
    """Where the database lives. ``kind`` is one of: file, dir, url."""

    kind: str
    path: Path | None = None
    url: str | None = None

    @property
    def display(self) -> str:
        """Location safe to log / show to a model (no credentials, no query string)."""
        if self.url:
            parts = urllib.parse.urlsplit(self.url)
            host = parts.hostname or ""
            if parts.port:
                host = f"{host}:{parts.port}"
            return urllib.parse.urlunsplit((parts.scheme, host, parts.path, "", ""))
        return str(self.path)


def parse_source(value: Path | str | None) -> Source:
    """Classify a user-supplied location (path, folder, file:// or http(s):// URL)."""
    raw = os.fspath(value) if value is not None else ""
    raw = raw.strip()
    if not raw:
        raw = os.environ.get("GAMMALEDGER_DB_URL") or os.environ.get("GAMMALEDGER_DB_PATH") or ""
        raw = raw.strip()
    if not raw:
        return Source(kind="file", path=DEFAULT_DB_PATH.resolve())

    scheme = urllib.parse.urlsplit(raw).scheme.lower()
    # A single letter scheme is a Windows drive ("C:\\...") rather than a URL.
    if len(scheme) > 1:
        if scheme in ("http", "https"):
            return Source(kind="url", url=raw)
        if scheme == "file":
            parsed = urllib.parse.urlsplit(raw)
            local = Path(urllib.request.url2pathname(urllib.parse.unquote(parsed.path)))
            return _local_source(local)
        raise DatabaseError(
            f"Unsupported database location scheme '{scheme}://'. "
            "Use a local path, file://, http:// or https://."
        )
    return _local_source(Path(raw))


def _local_source(path: Path) -> Source:
    resolved = path.expanduser().resolve()
    return Source(kind="dir" if resolved.is_dir() else "file", path=resolved)


class _SafeRedirectHandler(urllib.request.HTTPRedirectHandler):
    """Follow redirects, but never leak credentials to a different host."""

    def redirect_request(  # type: ignore[no-untyped-def]
        self, req, fp, code, msg, headers, newurl
    ):
        new_req = super().redirect_request(req, fp, code, msg, headers, newurl)
        if new_req is None:
            return None
        if urllib.parse.urlsplit(newurl).scheme.lower() not in ("http", "https"):
            return None
        old_host = urllib.parse.urlsplit(req.full_url).netloc.lower()
        new_host = urllib.parse.urlsplit(newurl).netloc.lower()
        if old_host != new_host:
            for name in list(new_req.headers):
                if name.lower() in ("authorization", "cookie") or name.lower().startswith("x-"):
                    del new_req.headers[name]
            for name in list(new_req.unredirected_hdrs):
                if name.lower() in ("authorization", "cookie"):
                    del new_req.unredirected_hdrs[name]
        return new_req


class GammaLedgerDB:
    """Lazy, cached reader for a GammaLedger JSON database (local or remote)."""

    def __init__(
        self,
        db_path: Path | str | None = None,
        *,
        token: str | None = None,
        headers: dict[str, str] | None = None,
        refresh_seconds: float | None = None,
        timeout: float = DEFAULT_TIMEOUT_SECONDS,
    ) -> None:
        self._source = parse_source(db_path)
        self._token = token if token is not None else os.environ.get("GAMMALEDGER_DB_TOKEN")
        self._headers = dict(headers or {})
        if refresh_seconds is None:
            refresh_seconds = _env_float("GAMMALEDGER_DB_REFRESH_SECONDS", DEFAULT_REFRESH_SECONDS)
        self._refresh_seconds = max(0.0, refresh_seconds)
        self._timeout = timeout

        if self._source.kind == "url" and self._token:
            host = (urllib.parse.urlsplit(self._source.url or "").hostname or "").lower()
            if (self._source.url or "").lower().startswith("http://") and (
                host not in _LOOPBACK_HOSTS
            ):
                raise DatabaseError(
                    "Refusing to send GAMMALEDGER_DB_TOKEN over plain http://. Use an https:// URL."
                )

        self._data: dict[str, Any] | None = None
        self._loaded_from: str | None = None  # concrete file / URL actually read
        self._mtime: float | None = None  # local sources
        self._etag: str | None = None  # remote sources
        self._last_modified: str | None = None
        self._checked_at: float | None = None  # monotonic time of last remote check
        self._loaded_at: str | None = None
        self._last_error: str | None = None
        self._index: dict[str, dict[str, Any]] | None = None
        self._lock = threading.RLock()

    # ── Properties ──────────────────────────────────────────────────────

    @property
    def source(self) -> Source:
        return self._source

    @property
    def path(self) -> Path:
        """Local path of the database (file or folder). Raises for remote sources."""
        if self._source.path is None:
            raise DatabaseError("The database is remote; it has no local path.")
        return self._source.path

    @property
    def location(self) -> str:
        return self._source.display

    @property
    def data(self) -> dict[str, Any]:
        self._reload_if_needed()
        return self._data or {}

    @property
    def mcp_context(self) -> dict[str, Any]:
        ctx = self.data.get("mcpContext")
        return ctx if isinstance(ctx, dict) else {}

    def require_mcp_context(self) -> dict[str, Any]:
        """Return ``mcpContext`` or raise ``MissingContextError`` with a helpful hint."""
        ctx = self.mcp_context
        if not ctx:
            raise MissingContextError(
                "mcpContext is missing from the database. Re-save the database from the "
                "GammaLedger app (Settings → Save Database), which writes the mcpContext "
                "section, and try again."
            )
        return ctx

    @property
    def trades(self) -> list[dict[str, Any]]:
        trades = self.data.get("trades")
        return trades if isinstance(trades, list) else []

    @property
    def watchlist(self) -> list[dict[str, Any]]:
        items = self.data.get("watchlist")
        return [i for i in items if isinstance(i, dict)] if isinstance(items, list) else []

    # ── Loading / refresh ───────────────────────────────────────────────

    def _reload_if_needed(self) -> None:
        with self._lock:
            if self._source.kind == "url":
                self._refresh_remote()
            else:
                self._refresh_local()

    def _refresh_local(self) -> None:
        target = self._resolve_local_file()
        try:
            current_mtime = target.stat().st_mtime
        except OSError as exc:
            raise DatabaseError(f"Cannot stat database file: {exc}") from exc

        if (
            self._data is not None
            and self._mtime == current_mtime
            and self._loaded_from == str(target)
        ):
            return
        try:
            with target.open("r", encoding="utf-8") as f:
                payload = json.load(f)
        except json.JSONDecodeError as exc:
            raise DatabaseError(f"Database file is not valid JSON: {exc}") from exc
        except (OSError, UnicodeDecodeError) as exc:
            raise DatabaseError(f"Cannot read database file: {exc}") from exc
        self._install(payload, str(target))
        self._mtime = current_mtime

    def _resolve_local_file(self) -> Path:
        path = self.path
        if not path.exists():
            raise DatabaseError(
                f"GammaLedger database not found: {path}. "
                "Save your database from the GammaLedger app "
                "(Settings → Save Database) and point GAMMALEDGER_DB_PATH at the JSON "
                "file (or its folder)."
            )
        if path.is_file():
            return path

        candidates = sorted(
            (p for p in path.glob("*.json") if p.is_file()),
            key=lambda p: p.stat().st_mtime,
            reverse=True,
        )
        # Prefer the conventional name, then the newest file that looks like a database.
        preferred = [p for p in candidates if p.name == "gammaledger.json"]
        for candidate in preferred + candidates:
            if _looks_like_database(candidate):
                return candidate
        raise DatabaseError(
            f"No GammaLedger database (*.json with a 'trades' list) in folder: {path}"
        )

    def _refresh_remote(self) -> None:
        now = time.monotonic()
        if (
            self._data is not None
            and self._checked_at is not None
            and now - self._checked_at < self._refresh_seconds
        ):
            return

        request = urllib.request.Request(self._source.url or "", method="GET")
        request.add_header("Accept", "application/json")
        request.add_header("User-Agent", "gammaledger-mcp")
        for name, value in self._headers.items():
            request.add_header(name, value)
        if self._token:
            request.add_header("Authorization", f"Bearer {self._token}")
        if self._data is not None:
            if self._etag:
                request.add_header("If-None-Match", self._etag)
            if self._last_modified:
                request.add_header("If-Modified-Since", self._last_modified)

        opener = urllib.request.build_opener(_SafeRedirectHandler)
        try:
            with opener.open(request, timeout=self._timeout) as resp:
                body = resp.read(MAX_REMOTE_BYTES + 1)
                if len(body) > MAX_REMOTE_BYTES:
                    raise DatabaseError("Remote database is larger than the 256 MB safety limit.")
                etag = resp.headers.get("ETag")
                last_modified = resp.headers.get("Last-Modified")
        except urllib.error.HTTPError as exc:
            if exc.code == 304 and self._data is not None:
                self._checked_at = now
                self._last_error = None
                return
            self._remote_failure(f"HTTP {exc.code} {exc.reason}", now)
            return
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            reason = getattr(exc, "reason", exc)
            self._remote_failure(f"{type(exc).__name__}: {reason}", now)
            return

        try:
            payload = json.loads(body.decode("utf-8-sig"))
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            self._remote_failure(f"Remote database is not valid JSON: {exc}", now)
            return
        try:
            self._install(payload, self._source.display)
        except DatabaseError as exc:
            self._remote_failure(str(exc), now)
            return
        self._etag = etag
        self._last_modified = last_modified
        self._checked_at = now

    def _remote_failure(self, reason: str, now: float) -> None:
        """Serve stale data if we have any; otherwise surface the failure."""
        message = f"Could not refresh {self._source.display}: {reason}"
        if self._data is not None:
            logger.warning("%s — serving previously loaded copy", message)
            self._last_error = message
            self._checked_at = now  # back off for refresh_seconds
            return
        raise DatabaseError(message)

    def _install(self, payload: Any, loaded_from: str) -> None:
        if not isinstance(payload, dict) or not isinstance(payload.get("trades"), list):
            raise DatabaseError(
                "File is not a GammaLedger database (expected a JSON object with a 'trades' list)."
            )
        self._data = payload
        self._loaded_from = loaded_from
        self._index = None
        self._last_error = None
        self._loaded_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        ctx = payload.get("mcpContext")
        logger.info(
            "Loaded GammaLedger DB from %s: %d trades, mcpContext=%s, version=%s",
            loaded_from if self._source.kind != "url" else self._source.display,
            len(payload["trades"]),
            "present" if isinstance(ctx, dict) and ctx else "missing",
            payload.get("version", "unknown"),
        )

    # ── Convenience queries ─────────────────────────────────────────────

    def info(self) -> dict[str, Any]:
        d = self.data
        ctx = self.mcp_context
        return {
            "source": self._source.kind,
            "location": self.location,
            "loadedFrom": self._loaded_from if self._source.kind != "url" else self._source.display,
            "version": d.get("version"),
            "exportDate": d.get("exportDate") or d.get("timestamp"),
            "fileName": d.get("fileName"),
            "tradeCount": len(self.trades),
            "watchlistCount": len(self.watchlist),
            "mcpContextPresent": bool(ctx),
            "mcpContextGeneratedAt": ctx.get("generatedAt"),
            "asOfDate": ctx.get("asOfDate"),
            "loadedAt": self._loaded_at,
            "stale": self._last_error is not None,
            "lastRefreshError": self._last_error,
        }

    def get_trade_by_id(self, trade_id: str) -> dict[str, Any] | None:
        if not trade_id:
            return None
        target = trade_id.strip()
        for t in self.trades:
            if str(t.get("id", "")) == target:
                return t
        return None

    def trade_summary(self, trade_id: str) -> dict[str, Any] | None:
        """Computed per-trade summary (pl, roi, dte, capitalAtRisk, ...) from ``mcpContext``.

        The app does not persist these runtime fields on ``trades``; they only
        exist for active positions, Wheel/PMCC positions and the most recent
        closed trades inside ``mcpContext``.
        """
        return self._summary_index().get(str(trade_id).strip())

    def _summary_index(self) -> dict[str, dict[str, Any]]:
        _ = self.data  # make sure we are fresh (resets the index on reload)
        with self._lock:
            if self._index is None:
                index: dict[str, dict[str, Any]] = {}
                ctx = self.mcp_context
                # Later sources are richer (Wheel/PMCC adds basis/coverage) so they overlay.
                for key in ("recentClosedTrades", "activePositions", "wheelPmccPositions"):
                    for item in ctx.get(key) or []:
                        if isinstance(item, dict) and item.get("id") is not None:
                            merged = index.setdefault(str(item["id"]), {})
                            merged.update(item)
                            merged.setdefault("summarySources", []).append(key)
                self._index = index
            return self._index

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


def _looks_like_database(path: Path) -> bool:
    try:
        with path.open("r", encoding="utf-8") as f:
            payload = json.load(f)
    except (OSError, ValueError):
        return False
    return isinstance(payload, dict) and isinstance(payload.get("trades"), list)


def _env_float(name: str, default: float) -> float:
    raw = os.environ.get(name)
    if not raw:
        return default
    try:
        return float(raw)
    except ValueError:
        logger.warning("Ignoring invalid %s=%r", name, raw)
        return default


# ── Module-level singleton ──────────────────────────────────────────────

_db: GammaLedgerDB | None = None
_db_lock = threading.Lock()


def configure_db(db_path: Path | str | None, **kwargs: Any) -> GammaLedgerDB:
    """Initialise the module-level DB singleton (called once from main)."""
    global _db
    with _db_lock:
        _db = GammaLedgerDB(db_path, **kwargs)
    return _db


def get_db() -> GammaLedgerDB:
    """Return the configured DB singleton, creating a default one if needed."""
    global _db
    if _db is None:
        with _db_lock:
            if _db is None:
                _db = GammaLedgerDB()
    return _db
