"""Database metadata, portfolio-level metrics, breakdowns and the watchlist."""

from __future__ import annotations

import copy
import logging
from typing import Any, TypeVar

from mcp.server.fastmcp import FastMCP
from pydantic import BaseModel, ValidationError

from .common import (
    as_dict,
    ctx,
    dict_rows,
    error_text,
    json_text,
    safe_db,
    tool_errors,
    with_warning,
)
from .database import DatabaseError
from .models import (
    DatabaseInfo,
    PLBreakdown,
    Portfolio,
    PortfolioPL,
    PortfolioSummary,
)

_M = TypeVar("_M", bound=BaseModel)
logger = logging.getLogger(__name__)


def _drop_path(payload: dict[str, Any], loc: tuple[Any, ...]) -> bool:
    """Delete the deepest key of ``loc`` that exists in ``payload``; False if nothing matched."""
    cur: Any = payload
    parent: dict[str, Any] | None = None
    last: Any = None
    for key in loc:
        if isinstance(cur, dict) and key in cur:
            parent, last, cur = cur, key, cur[key]
        else:
            break
    if parent is None:
        return False
    del parent[last]
    return True


def _lenient(model: type[_M], data: Any) -> _M:
    """Validate ``data`` into ``model``, omitting (and logging) any field of the wrong type.

    The file belongs to the GammaLedger app. The tool's output schema is a promise to the
    client, so a value that breaks it cannot be passed through - but one odd value must not
    fail the whole call either, so only that field is left out.
    """
    payload: dict[str, Any] = copy.deepcopy(data) if isinstance(data, dict) else {}
    for _ in range(25):
        try:
            return model.model_validate(payload)
        except ValidationError as exc:
            dropped = False
            for err in exc.errors():
                logger.warning(
                    "Ignoring unexpected mcpContext value at %s: %s", err["loc"], err["msg"]
                )
                dropped = _drop_path(payload, err["loc"]) or dropped
            if not dropped:
                break
    return model()


def register(mcp: FastMCP) -> None:
    @mcp.tool()
    def gammaledger_database_info() -> DatabaseInfo:
        """Return metadata about the loaded GammaLedger database.

        Includes file path, schema version, export date, trade count, whether the
        pre-computed `mcpContext` is present, and how fresh the data is: `dataAgeDays`
        (now minus the export date) and `isStale` (older than `staleAfterDays`, default 3).
        When `isStale` is true, positions, DTE and P&L describe the day of the export, not
        today - tell the user to re-save the database from the app. `warnings` lists
        anything else worth mentioning (failed refresh, unrecognised schema version).
        """
        with tool_errors():
            return DatabaseInfo.model_validate(safe_db().info())

    @mcp.tool()
    def gammaledger_portfolio_summary() -> PortfolioSummary:
        """Return the full portfolio snapshot — counts, P&L, performance ratios,
        risk metrics, fees, trading cadence, largest winner/loser.

        This is the headline dashboard view: total trades, win rate, profit
        factor, Sharpe/Sortino, max drawdown, expectancy, collateral at risk,
        realized vs unrealized P&L, current win/loss streak. `dataWarning` is set
        when the export is old or could not be refreshed.
        """
        with tool_errors():
            context = ctx()
            return PortfolioSummary(
                asOfDate=context.get("asOfDate"),
                generatedAt=context.get("generatedAt"),
                dataWarning=with_warning({}).get("dataWarning"),
                portfolio=_lenient(Portfolio, context.get("portfolio")),
            )

    @mcp.tool()
    def gammaledger_pl_breakdown() -> PLBreakdown:
        """Return time-windowed realised P&L: total, realized, unrealized,
        plus YTD, MTD, last 7d / 30d / 90d / 1y."""
        with tool_errors():
            context = ctx()
            pl = as_dict(context.get("portfolio")).get("pl")
            return PLBreakdown(
                asOfDate=context.get("asOfDate"),
                dataWarning=with_warning({}).get("dataWarning"),
                pl=_lenient(PortfolioPL, pl),
            )

    @mcp.tool(structured_output=False)
    def gammaledger_strategy_breakdown() -> str:
        """Return per-strategy statistics: counts (total/open/closed/assigned),
        wins, losses, total P&L, win rate, average P&L. Sorted by P&L magnitude.
        """
        try:
            return json_text({"strategies": dict_rows(ctx().get("strategyBreakdown"))})
        except DatabaseError as exc:
            return error_text(exc)

    @mcp.tool(structured_output=False)
    def gammaledger_ticker_exposure(top_n: int = 15) -> str:
        """Return per-ticker performance: P&L, trade count, wins, losses,
        win rate, average P&L per trade. Sorted by absolute P&L.

        Args:
            top_n: Limit to top N tickers (default 15; the saved database holds
                   at most 15).
        """
        try:
            top_n = max(1, min(int(top_n), 50))
            items = dict_rows(ctx().get("tickerExposure"))
            return json_text({"count": min(top_n, len(items)), "tickers": items[:top_n]})
        except DatabaseError as exc:
            return error_text(exc)

    @mcp.tool(structured_output=False)
    def gammaledger_underlying_breakdown() -> str:
        """Return breakdown by underlying instrument type (Stock / ETF /
        Index / Future): trade counts, total P&L, capital at risk."""
        try:
            return json_text({"underlyings": dict_rows(ctx().get("underlyingBreakdown"))})
        except DatabaseError as exc:
            return error_text(exc)

    @mcp.tool(structured_output=False)
    def gammaledger_watchlist(ticker: str = "") -> str:
        """Return the user's Watchlist: followed tickers with rating (1-5), notes,
        date added, and optional target price / direction. Databases saved before
        the Watchlist feature (schema < 2.6 / pre-2026-08) return an empty list.

        Args:
            ticker: Optional exact ticker filter (case-insensitive).
        """
        try:
            items = safe_db().watchlist
            if ticker:
                t = ticker.strip().upper()
                items = [i for i in items if str(i.get("ticker", "")).upper() == t]
            return json_text({"count": len(items), "watchlist": items})
        except DatabaseError as exc:
            return error_text(exc)

    @mcp.resource("gammaledger://portfolio/summary")
    def resource_portfolio_summary() -> str:
        """Current portfolio metrics snapshot (mirrors gammaledger_portfolio_summary)."""
        try:
            context = ctx()
            return json_text(
                {
                    "asOfDate": context.get("asOfDate"),
                    "portfolio": as_dict(context.get("portfolio")),
                }
            )
        except DatabaseError as exc:
            return error_text(exc)

    @mcp.resource("gammaledger://database/info")
    def resource_database_info() -> str:
        """Loaded database file metadata."""
        try:
            return json_text(safe_db().info())
        except DatabaseError as exc:
            return error_text(exc)
