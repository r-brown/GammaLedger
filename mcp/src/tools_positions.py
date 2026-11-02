"""Positions, single-trade detail, trade search, Wheel/PMCC tracker."""

from __future__ import annotations

import re
from typing import Any

from mcp.server.fastmcp import FastMCP
from mcp.server.fastmcp.exceptions import ToolError

from .common import (
    ctx,
    dict_rows,
    error_text,
    is_all_fields,
    json_text,
    parse_field_list,
    project,
    round2,
    safe_db,
    tool_errors,
    with_warning,
)
from .database import DatabaseError, GammaLedgerDB
from .models import OpenPositions, PositionDetail, SearchResult

# Keep default answers small: a position dict carries ~30 keys, an agent usually needs ~11.
OPEN_POSITION_DEFAULT_FIELDS = [
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
]

SEARCH_DEFAULT_FIELDS = [
    "id",
    "ticker",
    "strategy",
    "status",
    "openedDate",
    "closedDate",
    "expirationDate",
    "pl",
    "roi",
    "plSource",
    "dte",
]
SEARCH_ALL_FIELDS = [
    *SEARCH_DEFAULT_FIELDS,
    "underlyingType",
    "legsCount",
    "cashFlow",
    "totalCredit",
    "totalDebit",
    "totalFees",
    "hasComputedSummary",
]

_ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_SORT_KEYS = {"opened": "openedDate", "closed": "closedDate", "pl": "pl"}


def _check_date(name: str, value: str) -> str | None:
    value = (value or "").strip()
    if not value:
        return None
    if not _ISO_DATE.match(value):
        raise ToolError(f"{name} must be an ISO date like 2026-01-31, got '{value}'")
    return value


def _search_row(db: GammaLedgerDB, trade: dict[str, Any]) -> dict[str, Any]:
    """One search result: persisted fields plus the best available P&L (app, else derived)."""
    summary = db.trade_pl_summary(trade) or {}
    legs = trade.get("legs")
    return {
        "id": trade.get("id"),
        "ticker": trade.get("ticker"),
        "strategy": trade.get("strategy"),
        "status": trade.get("status"),
        "openedDate": trade.get("openedDate"),
        "closedDate": trade.get("closedDate"),
        "expirationDate": trade.get("expirationDate"),
        "pl": round2(summary.get("pl")),
        "roi": round2(summary.get("roi")),
        "plSource": summary.get("plSource"),
        "dte": summary.get("dte"),
        "underlyingType": trade.get("underlyingType"),
        "legsCount": len(legs) if isinstance(legs, list) else None,
        "cashFlow": round2(summary.get("cashFlow")),
        "totalCredit": round2(summary.get("totalCredit")),
        "totalDebit": round2(summary.get("totalDebit")),
        "totalFees": round2(summary.get("totalFees", summary.get("fees"))),
        "hasComputedSummary": summary.get("plSource") == "app",
    }


def register(mcp: FastMCP) -> None:
    @mcp.tool()
    def gammaledger_open_positions(
        ticker: str = "",
        strategy: str = "",
        dte_max: int | None = None,
        underwater_only: bool = False,
        fields: str = "",
    ) -> OpenPositions:
        """Return all currently open (active) positions, with optional filters.

        Each position is slimmed to the essentials by default (id, ticker, strategy,
        status, strike, quantity, expires, dte, pl, roi, capitalAtRisk) to save context.
        Pass `fields` to choose others, or `fields='all'` for the full record (adds
        entryPrice, daysHeld, cashFlow, fees, wheelCoverage, unrealizedPL, notes, ...).
        DTE and P&L are as of the export date; check `dataWarning` when present.

        Args:
            ticker: Filter by exact ticker (case-insensitive, e.g. 'SPY').
            strategy: Filter by strategy name (case-insensitive substring,
                      e.g. 'iron condor', 'wheel').
            dte_max: Only include positions expiring within this many days.
            underwater_only: When true, return only positions with negative P&L.
            fields: Comma-separated keys to return, e.g. 'id,ticker,dte,pl,notes'.
                    Empty = the slim default; 'all' = every key.
        """
        with tool_errors():
            positions = dict_rows(ctx().get("activePositions"))

            if ticker:
                t = ticker.strip().upper()
                positions = [p for p in positions if str(p.get("ticker", "")).upper() == t]
            if strategy:
                s = strategy.strip().lower()
                positions = [p for p in positions if s in str(p.get("strategy", "")).lower()]
            if dte_max is not None:
                positions = [
                    p
                    for p in positions
                    if isinstance(p.get("dte"), (int, float)) and p["dte"] <= dte_max
                ]
            if underwater_only:
                positions = [p for p in positions if (p.get("pl") or 0) < 0]

            requested = parse_field_list(fields)
            if is_all_fields(requested):
                selected: list[str] | None = None
                rows = positions
            else:
                selected = requested or OPEN_POSITION_DEFAULT_FIELDS
                rows = [project(p, selected) for p in positions]

            return OpenPositions(
                count=len(rows),
                fields=selected,
                dataWarning=with_warning({}).get("dataWarning"),
                positions=rows,
            )

    @mcp.tool()
    def gammaledger_position(trade_id: str) -> PositionDetail:
        """Return the full detail (including all legs) for a specific trade.

        The result has two parts: `trade` is the persisted record (legs, dates,
        notes) and `summary` is the computed view (P&L, ROI, DTE, capital at risk,
        Wheel/PMCC basis). `summary.plSource` says where the numbers came from:
        'app' = embedded by the GammaLedger app (active positions, Wheel/PMCC
        positions, the 10 most recent closed trades); 'derived' = realized P&L
        recomputed from the legs of an older Closed/Expired trade (same rules as
        the app: credits minus debits minus fees; no ROI unless the trade has an
        explicit max-risk override). `summary` is null for open trades that the
        app did not embed.

        Args:
            trade_id: Trade identifier, e.g. 'TRD-0042'.
        """
        with tool_errors():
            if not trade_id or not trade_id.strip():
                raise ToolError("trade_id is required")
            db = safe_db()
            trade = db.get_trade_by_id(trade_id)
            if trade is None:
                raise ToolError(f"No trade found with id '{trade_id}'")
            return PositionDetail(trade=trade, summary=db.trade_pl_summary(trade))

    @mcp.tool(structured_output=False)
    def gammaledger_wheel_pmcc_positions(position_type: str = "") -> str:
        """Return Wheel and PMCC tracker positions with cost basis, premium
        history summary, and coverage status.

        Args:
            position_type: Filter by 'wheel' or 'pmcc'. Empty returns both.
        """
        try:
            positions = dict_rows(ctx().get("wheelPmccPositions"))
            if position_type:
                t = position_type.strip().lower()
                positions = [p for p in positions if str(p.get("type", "")).lower() == t]
            return json_text({"count": len(positions), "positions": positions})
        except DatabaseError as exc:
            return error_text(exc)

    @mcp.tool(structured_output=False)
    def gammaledger_recent_closed_trades(limit: int = 10) -> str:
        """Return the most recently closed trades (sorted by close date).

        The GammaLedger app embeds only its 10 most recent closed trades in the
        saved database, so that is the most this can return. Use
        `gammaledger_search_trades` (status='Closed', optionally with
        `closed_after`) to list older ones - their P&L is derived from the legs.

        Args:
            limit: Maximum number of trades to return (default 10, max 10).
        """
        try:
            limit = max(1, min(int(limit), 10))
            recent = dict_rows(ctx().get("recentClosedTrades"))
            return json_text({"count": min(limit, len(recent)), "trades": recent[:limit]})
        except DatabaseError as exc:
            return error_text(exc)

    @mcp.tool()
    def gammaledger_search_trades(
        ticker: str = "",
        strategy: str = "",
        status: str = "",
        limit: int = 25,
        opened_after: str = "",
        opened_before: str = "",
        closed_after: str = "",
        closed_before: str = "",
        pl_min: float | None = None,
        pl_max: float | None = None,
        sort_by: str = "",
        descending: bool = True,
        fields: str = "",
    ) -> SearchResult:
        """Search across the full trade history with optional filters.

        Unlike `gammaledger_open_positions` (active only) or
        `gammaledger_recent_closed_trades` (the last 10 closed), this scans every
        trade - open, closed, expired, assigned.

        `pl` covers the whole history. `plSource` tells you where it came from:
        'app' (computed by GammaLedger) or 'derived' (recomputed from the trade's legs
        for Closed/Expired trades the app did not embed - same arithmetic as the app).
        `pl` is null for open trades the app did not embed; those are left out whenever a
        `pl_min` / `pl_max` filter is used. `roi` is only known for 'app' trades.
        `matchedTotalPL` sums P&L over ALL matches (not just the returned rows), which
        answers "how did I do on X between A and B" in one call.

        Rows are slim by default; pass `fields` to pick others (also available:
        underlyingType, legsCount, cashFlow, totalCredit, totalDebit, totalFees,
        hasComputedSummary) or `fields='all'`.

        Args:
            ticker: Exact ticker match (case-insensitive).
            strategy: Substring match on strategy name (case-insensitive).
            status: Exact status match: Open, Rolling, Closed, Expired, Assigned.
            limit: Maximum trades to return (default 25, max 200).
            opened_after: Keep trades opened on/after this date (YYYY-MM-DD).
            opened_before: Keep trades opened on/before this date (YYYY-MM-DD).
            closed_after: Keep trades closed on/after this date (YYYY-MM-DD).
            closed_before: Keep trades closed on/before this date (YYYY-MM-DD).
            pl_min: Keep trades with P&L >= this amount.
            pl_max: Keep trades with P&L <= this amount (e.g. 0 for losers only).
            sort_by: 'opened', 'closed' or 'pl'. Empty keeps the file order.
            descending: Sort direction when sort_by is set (default newest/largest first).
            fields: Comma-separated row keys to return. Empty = slim default; 'all' = every key.
        """
        with tool_errors():
            limit = max(1, min(int(limit), 200))
            dates = {
                "opened_after": _check_date("opened_after", opened_after),
                "opened_before": _check_date("opened_before", opened_before),
                "closed_after": _check_date("closed_after", closed_after),
                "closed_before": _check_date("closed_before", closed_before),
            }
            sort_key = sort_by.strip().lower()
            if sort_key and sort_key not in _SORT_KEYS:
                raise ToolError("sort_by must be one of: opened, closed, pl")

            requested = parse_field_list(fields)
            selected = (
                SEARCH_ALL_FIELDS
                if is_all_fields(requested)
                else (requested or SEARCH_DEFAULT_FIELDS)
            )

            db = safe_db()
            matches = db.find_trades(
                ticker=ticker or None,
                strategy=strategy or None,
                status=status or None,
                **dates,
            )
            rows = [_search_row(db, t) for t in matches]

            if pl_min is not None or pl_max is not None:
                rows = [
                    r
                    for r in rows
                    if r["pl"] is not None
                    and (pl_min is None or r["pl"] >= pl_min)
                    and (pl_max is None or r["pl"] <= pl_max)
                ]

            known = [r["pl"] for r in rows if r["pl"] is not None]

            if sort_key:
                column = _SORT_KEYS[sort_key]
                present = [r for r in rows if r.get(column) not in (None, "")]
                missing = [r for r in rows if r.get(column) in (None, "")]
                present.sort(key=lambda r: r[column], reverse=descending)
                rows = present + missing

            return SearchResult(
                matched=len(rows),
                returned=min(len(rows), limit),
                truncated=len(rows) > limit,
                matchedWithPL=len(known),
                matchedTotalPL=round(sum(known), 2) if known else None,
                fields=selected,
                dataWarning=with_warning({}).get("dataWarning"),
                trades=[project(r, selected) for r in rows[:limit]],
            )

    @mcp.resource("gammaledger://positions/active")
    def resource_active_positions() -> str:
        """Current active positions (mirrors gammaledger_open_positions with fields='all')."""
        try:
            return json_text(dict_rows(ctx().get("activePositions")))
        except DatabaseError as exc:
            return error_text(exc)

    @mcp.resource("gammaledger://positions/wheel-pmcc")
    def resource_wheel_pmcc() -> str:
        """Wheel and PMCC tracker positions."""
        try:
            return json_text(dict_rows(ctx().get("wheelPmccPositions")))
        except DatabaseError as exc:
            return error_text(exc)
