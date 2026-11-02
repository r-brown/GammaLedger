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
``capitalAtRisk`` ...) from persisted trades. Per-trade summaries therefore come
from ``mcpContext`` where the app embedded one (``trade_summary()``); for closed
trades the app did not embed, realized P&L is re-derived from the trade's legs
(``trade_pl_summary()``, tagged ``plSource: "derived"``).
"""

from __future__ import annotations

import json
import logging
import os
import re
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .pnl import PL_SOURCE_APP, derive_trade_pl

logger = logging.getLogger(__name__)

DEFAULT_DB_PATH = Path.home() / "gammaledger.json"
DEFAULT_REFRESH_SECONDS = 60.0
DEFAULT_TIMEOUT_SECONDS = 20.0
MAX_REMOTE_BYTES = 256 * 1024 * 1024  # refuse to buffer anything bigger than this
_LOOPBACK_HOSTS = {"localhost", "127.0.0.1", "::1"}

# A database whose export is older than this is reported as ``isStale`` (the book it
# describes - positions, DTE, P&L - may no longer match the account).
DEFAULT_STALE_DAYS = 3.0
# Schema versions this server has been tested against. Others still load, with a warning.
SUPPORTED_SCHEMA_VERSIONS = ("2.5", "2.6")

_HEAD_BYTES = 4096  # enough to find the top-level "trades" key without parsing the file
_TRADES_KEY = re.compile(rb'"trades"\s*:\s*\[')


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
        stale_days: float | None = None,
        clock: Callable[[], datetime] | None = None,
    ) -> None:
        self._source = parse_source(db_path)
        self._token = token if token is not None else os.environ.get("GAMMALEDGER_DB_TOKEN")
        self._headers = dict(headers or {})
        if refresh_seconds is None:
            refresh_seconds = _env_float("GAMMALEDGER_DB_REFRESH_SECONDS", DEFAULT_REFRESH_SECONDS)
        self._refresh_seconds = max(0.0, refresh_seconds)
        self._timeout = timeout
        if stale_days is None:
            stale_days = _env_float("GAMMALEDGER_STALE_DAYS", DEFAULT_STALE_DAYS)
        self._stale_days = max(0.0, stale_days)
        self._clock = clock or (lambda: datetime.now(timezone.utc))

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
        self._schema_warning: str | None = None
        # (path, mtime_ns, size) -> "is this JSON file a GammaLedger database?"
        self._looks_cache: dict[tuple[str, int, int], bool] = {}
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
        """Re-read the local file if it changed; on failure keep serving the last good copy.

        A sync client or the app can be mid-write when a tool call lands, so a transient
        parse / read error must not turn into a tool error when we already hold good data.
        """
        try:
            self._load_local()
        except DatabaseError as exc:
            if self._data is None:
                raise
            message = f"Could not refresh {self._source.display}: {exc}"
            if message != self._last_error:  # don't repeat the warning on every tool call
                logger.warning("%s — serving previously loaded copy", message)
            self._last_error = message  # _mtime is unchanged, so the next call retries

    def _load_local(self) -> None:
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
            self._last_error = None  # the file matches the copy we hold again
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
            if self._is_database_file(candidate):
                return candidate
        raise DatabaseError(
            f"No GammaLedger database (*.json with a 'trades' list) in folder: {path}"
        )

    def _is_database_file(self, path: Path) -> bool:
        """``_looks_like_database`` memoised on (path, mtime, size); folder mode runs per call."""
        try:
            st = path.stat()
        except OSError:
            return False
        key = (str(path), st.st_mtime_ns, st.st_size)
        cached = self._looks_cache.get(key)
        if cached is None:
            cached = _looks_like_database(path)
            if len(self._looks_cache) > 256:
                self._looks_cache.clear()
            self._looks_cache[key] = cached
        return cached

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
        self._schema_warning = _schema_warning(payload.get("version"))
        if self._schema_warning:
            logger.warning("%s", self._schema_warning)
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
        export_date = d.get("exportDate") or d.get("timestamp")
        age_days = self.data_age_days()
        is_stale = age_days is not None and age_days > self._stale_days
        warnings = self.warnings()
        return {
            "source": self._source.kind,
            "location": self.location,
            "loadedFrom": self._loaded_from if self._source.kind != "url" else self._source.display,
            "version": d.get("version"),
            "exportDate": export_date,
            "fileName": d.get("fileName"),
            "tradeCount": len(self.trades),
            "watchlistCount": len(self.watchlist),
            "mcpContextPresent": bool(ctx),
            "mcpContextGeneratedAt": ctx.get("generatedAt"),
            "asOfDate": ctx.get("asOfDate"),
            "loadedAt": self._loaded_at,
            "dataAgeDays": round(age_days, 1) if age_days is not None else None,
            "isStale": is_stale,
            "staleAfterDays": self._stale_days,
            "stale": self._last_error is not None,
            "lastRefreshError": self._last_error,
            "warnings": warnings,
        }

    def data_age_days(self) -> float | None:
        """Days between the database export (``exportDate``) and now; ``None`` if unknown."""
        d = self.data
        ctx = self.mcp_context
        exported = parse_timestamp(
            d.get("exportDate") or d.get("timestamp") or ctx.get("generatedAt")
        )
        if exported is None:
            return None
        return max(0.0, (self._clock() - exported).total_seconds() / 86400.0)

    def is_data_stale(self) -> bool:
        age = self.data_age_days()
        return age is not None and age > self._stale_days

    def warnings(self) -> list[str]:
        """Human-readable caveats an agent should surface before trusting the numbers."""
        found: list[str] = []
        age = self.data_age_days()
        if age is not None and age > self._stale_days:
            found.append(
                f"The database was exported {age:.1f} days ago. Positions, DTE and P&L reflect "
                "that moment, not today - re-save the database from the GammaLedger app "
                "(Settings → Save Database) before relying on them."
            )
        if self._last_error:
            found.append(f"{self._last_error} (serving the last good copy).")
        if self._schema_warning:
            found.append(self._schema_warning)
        return found

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

    def trade_pl_summary(self, trade: dict[str, Any]) -> dict[str, Any] | None:
        """Best available computed summary for a persisted trade, tagged with ``plSource``.

        ``"app"``     - the summary the app embedded in ``mcpContext`` (authoritative);
        ``"derived"`` - realized P&L recomputed from the trade's legs (closed trades only).
        ``None``      - neither is available (e.g. an open trade missing from ``mcpContext``).
        """
        tid = str(trade.get("id", "")).strip()
        app = self.trade_summary(tid) if tid and self.mcp_context else None
        if app is not None and app.get("pl") is not None:
            return {**app, "plSource": PL_SOURCE_APP}
        derived = derive_trade_pl(trade)
        if derived is None:
            return {**app, "plSource": PL_SOURCE_APP} if app is not None else None
        return {**app, **derived} if app is not None else derived

    def _summary_index(self) -> dict[str, dict[str, Any]]:
        _ = self.data  # make sure we are fresh (resets the index on reload)
        with self._lock:
            if self._index is None:
                index: dict[str, dict[str, Any]] = {}
                ctx = self.mcp_context
                # Later sources are richer (Wheel/PMCC adds basis/coverage) so they overlay.
                for key in ("recentClosedTrades", "activePositions", "wheelPmccPositions"):
                    items = ctx.get(key)
                    for item in items if isinstance(items, list) else []:
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
        opened_after: str | None = None,
        opened_before: str | None = None,
        closed_after: str | None = None,
        closed_before: str | None = None,
    ) -> list[dict[str, Any]]:
        """Filter persisted trades. Date bounds are inclusive ``YYYY-MM-DD`` strings."""
        ticker_q = ticker.strip().upper() if ticker else None
        strategy_q = strategy.strip().lower() if strategy else None
        status_q = status.strip().lower() if status else None
        date_filters = (
            ("openedDate", opened_after, opened_before),
            ("closedDate", closed_after, closed_before),
        )

        results: list[dict[str, Any]] = []
        for t in self.trades:
            if ticker_q and str(t.get("ticker", "")).upper() != ticker_q:
                continue
            if strategy_q and strategy_q not in str(t.get("strategy", "")).lower():
                continue
            if status_q and status_q != str(t.get("status", "")).lower():
                continue
            if any(
                (lo or hi) and not _in_date_range(t.get(field), lo, hi)
                for field, lo, hi in date_filters
            ):
                continue
            results.append(t)
        return results


def _looks_like_database(path: Path) -> bool:
    """Cheap check that ``path`` is a GammaLedger database (a JSON object with ``trades``).

    The app writes ``trades`` near the top of the file, so a small read usually settles it
    without parsing megabytes of JSON. If the key is not in the head (re-serialised file with
    sorted keys, huge leading section) fall back to a full parse.
    """
    try:
        with path.open("rb") as f:
            head = f.read(_HEAD_BYTES)
    except OSError:
        return False
    if not head.lstrip(b"\xef\xbb\xbf \t\r\n").startswith(b"{"):
        return False
    if _TRADES_KEY.search(head):
        return True
    try:
        with path.open("r", encoding="utf-8-sig") as f:
            payload = json.load(f)
    except (OSError, ValueError):
        return False
    return isinstance(payload, dict) and isinstance(payload.get("trades"), list)


def parse_timestamp(value: Any) -> datetime | None:
    """Parse an ISO-8601 date/time (or epoch seconds/millis) to an aware UTC datetime."""
    if value is None or value == "" or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        seconds = value / 1000.0 if value > 1e11 else float(value)
        try:
            return datetime.fromtimestamp(seconds, tz=timezone.utc)
        except (OverflowError, OSError, ValueError):
            return None
    text = str(value).strip()
    if text.endswith(("Z", "z")):
        text = text[:-1] + "+00:00"
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _in_date_range(value: Any, lo: str | None, hi: str | None) -> bool:
    day = str(value or "")[:10]
    if not day:
        return False
    return not ((lo and day < lo) or (hi and day > hi))


def _schema_warning(version: Any) -> str | None:
    if version is None or str(version) in SUPPORTED_SCHEMA_VERSIONS:
        return None
    return (
        f"Database schema version '{version}' is not one this server was tested with "
        f"({', '.join(SUPPORTED_SCHEMA_VERSIONS)}). It was loaded anyway, but fields may be "
        "missing or renamed - upgrade gammaledger-mcp if the app is newer."
    )


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
