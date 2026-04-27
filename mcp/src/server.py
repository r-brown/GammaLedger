"""GammaLedger MCP Server.

Reads a local GammaLedger JSON database (saved via the app's "Save Database"
feature) and exposes its pre-computed metrics, positions, and audits as MCP
tools, prompts, and resources.

Usage:
    stdio (default):  gammaledger-mcp --db-path /path/to/gammaledger.json
    Inspector:        mcp dev src/server.py
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from pathlib import Path
from typing import Any

from gammaledger_mcp import __version__
from gammaledger_mcp.database import (
    DatabaseError,
    GammaLedgerDB,
    configure_db,
    get_db,
)
from gammaledger_mcp.prompts import register_analysis_prompts
from mcp.server.fastmcp import FastMCP

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stderr)],
)
logger = logging.getLogger(__name__)


mcp = FastMCP(
    "gammaledger-mcp",
    instructions="""
You are connected to a GammaLedger options trading journal — a privacy-first,
local-first record of the user's options trades, positions, and analytics.
The database is read-only from your perspective: you can query and analyse
but cannot create, modify, or delete trades.

## Data sources

- `mcpContext` — pre-computed dashboard metrics, position summaries, and
  breakdowns produced by the GammaLedger app on every save. This is the
  authoritative view of portfolio state. Prefer it over re-deriving from
  raw trades.
- `trades` — the underlying full trade objects with leg-level detail.
  Use `gammaledger_position` for per-trade drill-down.

## What the user typically wants

- A high-level snapshot: call `gammaledger_portfolio_summary`.
- Active positions overview: `gammaledger_open_positions`.
- Specific trade detail (legs, cash flows): `gammaledger_position`.
- Risk view: `gammaledger_audit_risk` for a comprehensive audit, plus
  `gammaledger_concentration_risk` and `gammaledger_expiring_positions`.
- Wheel/PMCC tracking: `gammaledger_wheel_pmcc_positions` or `gammaledger_audit_wheel_pmcc`.
- Per-strategy or per-ticker performance: `gammaledger_strategy_breakdown`,
  `gammaledger_ticker_exposure`.

## Conventions

- Trade IDs look like `TRD-0042`. Tickers are uppercase (e.g. SPY, AAPL).
- Strategies use display names like "Iron Condor", "Wheel", "Poor Man's
  Covered Call". Substring matching is case-insensitive.
- Status values: Open, Rolling, Closed, Expired, Assigned.
- Currency values are in the user's account currency (typically USD).
- Dates are ISO `YYYY-MM-DD`. P&L is realised for closed trades and
  marked-to-current for open trades.

## Safety

- This is informational data — the user's trading journal. Surface
  observations and flag risks, but do not provide financial advice or
  buy/sell recommendations.
- Always include a brief disclaimer when delivering analysis.
""",
)


# ── Helpers ───────────────────────────────────────────────────────────────


def _json(obj: object) -> str:
    """Serialise to a compact-but-readable JSON string."""
    return json.dumps(obj, indent=2, default=str)


def _error(exc: Exception) -> str:
    return _json(
        {
            "error": True,
            "type": type(exc).__name__,
            "detail": str(exc),
        }
    )


def _round2(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        n = float(value)
    except (TypeError, ValueError):
        return None
    if n != n or n in (float("inf"), float("-inf")):  # NaN / Inf
        return None
    return round(n, 2)


def _safe_db() -> GammaLedgerDB:
    return get_db()


# ═══════════════════════════════════════════════════════════════════════════
# DATABASE / META
# ═══════════════════════════════════════════════════════════════════════════


@mcp.tool()
def gammaledger_database_info() -> str:
    """Return metadata about the loaded GammaLedger database.

    Includes file path, schema version, export date, trade count, and
    whether the pre-computed `mcpContext` is present.
    """
    try:
        return _json(_safe_db().info())
    except DatabaseError as exc:
        return _error(exc)


# ═══════════════════════════════════════════════════════════════════════════
# PORTFOLIO SUMMARY
# ═══════════════════════════════════════════════════════════════════════════


@mcp.tool()
def gammaledger_portfolio_summary() -> str:
    """Return the full portfolio snapshot — counts, P&L, performance ratios,
    risk metrics, fees, trading cadence, largest winner/loser.

    This is the headline dashboard view: total trades, win rate, profit
    factor, Sharpe/Sortino, max drawdown, expectancy, collateral at risk,
    realized vs unrealized P&L, current win/loss streak.
    """
    try:
        ctx = _safe_db().mcp_context
        if not ctx:
            return _json(
                {
                    "error": True,
                    "detail": "mcpContext is missing from the database. Re-save "
                    "the database from the GammaLedger app (which writes "
                    "the mcpContext section) and try again.",
                }
            )
        return _json(
            {
                "asOfDate": ctx.get("asOfDate"),
                "generatedAt": ctx.get("generatedAt"),
                "portfolio": ctx.get("portfolio", {}),
            }
        )
    except DatabaseError as exc:
        return _error(exc)


@mcp.tool()
def gammaledger_pl_breakdown() -> str:
    """Return time-windowed realised P&L: total, realized, unrealized,
    plus YTD, MTD, last 7d / 30d / 90d / 1y."""
    try:
        ctx = _safe_db().mcp_context
        pl = ctx.get("portfolio", {}).get("pl", {})
        return _json(
            {
                "asOfDate": ctx.get("asOfDate"),
                "pl": pl,
            }
        )
    except DatabaseError as exc:
        return _error(exc)


# ═══════════════════════════════════════════════════════════════════════════
# POSITIONS
# ═══════════════════════════════════════════════════════════════════════════


@mcp.tool()
def gammaledger_open_positions(
    ticker: str = "",
    strategy: str = "",
    dte_max: int | None = None,
    underwater_only: bool = False,
) -> str:
    """Return all currently open (active) positions, with optional filters.

    Args:
        ticker: Filter by exact ticker (case-insensitive, e.g. 'SPY').
        strategy: Filter by strategy name (case-insensitive substring,
                  e.g. 'iron condor', 'wheel').
        dte_max: Only include positions expiring within this many days.
        underwater_only: When true, return only positions with negative P&L.
    """
    try:
        positions: list[dict[str, Any]] = list(
            _safe_db().mcp_context.get("activePositions", []) or []
        )

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

        return _json(
            {
                "count": len(positions),
                "positions": positions,
            }
        )
    except DatabaseError as exc:
        return _error(exc)


@mcp.tool()
def gammaledger_position(trade_id: str) -> str:
    """Return the full detail (including all legs) for a specific trade.

    Args:
        trade_id: Trade identifier, e.g. 'TRD-0042'.
    """
    try:
        if not trade_id or not trade_id.strip():
            return _json({"error": True, "detail": "trade_id is required"})

        trade = _safe_db().get_trade_by_id(trade_id)
        if trade is None:
            return _json(
                {
                    "error": True,
                    "detail": f"No trade found with id '{trade_id}'",
                }
            )
        return _json(trade)
    except DatabaseError as exc:
        return _error(exc)


@mcp.tool()
def gammaledger_wheel_pmcc_positions(position_type: str = "") -> str:
    """Return Wheel and PMCC tracker positions with cost basis, premium
    history summary, and coverage status.

    Args:
        position_type: Filter by 'wheel' or 'pmcc'. Empty returns both.
    """
    try:
        positions = list(_safe_db().mcp_context.get("wheelPmccPositions", []) or [])
        if position_type:
            t = position_type.strip().lower()
            positions = [p for p in positions if str(p.get("type", "")).lower() == t]
        return _json(
            {
                "count": len(positions),
                "positions": positions,
            }
        )
    except DatabaseError as exc:
        return _error(exc)


@mcp.tool()
def gammaledger_recent_closed_trades(limit: int = 10) -> str:
    """Return the most recently closed trades (sorted by close date).

    Args:
        limit: Maximum number of trades to return (default 10, max 50).
    """
    try:
        limit = max(1, min(int(limit), 50))
        recent = list(_safe_db().mcp_context.get("recentClosedTrades", []) or [])
        return _json(
            {
                "count": min(limit, len(recent)),
                "trades": recent[:limit],
            }
        )
    except DatabaseError as exc:
        return _error(exc)


# ═══════════════════════════════════════════════════════════════════════════
# ANALYTICS — breakdowns
# ═══════════════════════════════════════════════════════════════════════════


@mcp.tool()
def gammaledger_strategy_breakdown() -> str:
    """Return per-strategy statistics: counts (total/open/closed/assigned),
    wins, losses, total P&L, win rate, average P&L. Sorted by P&L magnitude.
    """
    try:
        return _json(
            {
                "strategies": _safe_db().mcp_context.get("strategyBreakdown", []) or [],
            }
        )
    except DatabaseError as exc:
        return _error(exc)


@mcp.tool()
def gammaledger_ticker_exposure(top_n: int = 15) -> str:
    """Return per-ticker performance: P&L, trade count, wins, losses,
    win rate, average P&L per trade. Sorted by absolute P&L.

    Args:
        top_n: Limit to top N tickers by |P&L| (default 15, max 50).
    """
    try:
        top_n = max(1, min(int(top_n), 50))
        items = list(_safe_db().mcp_context.get("tickerExposure", []) or [])
        return _json(
            {
                "count": min(top_n, len(items)),
                "tickers": items[:top_n],
            }
        )
    except DatabaseError as exc:
        return _error(exc)


@mcp.tool()
def gammaledger_underlying_breakdown() -> str:
    """Return breakdown by underlying instrument type (Stock / ETF /
    Index / Future): trade counts, total P&L, capital at risk."""
    try:
        return _json(
            {
                "underlyings": _safe_db().mcp_context.get("underlyingBreakdown", []) or [],
            }
        )
    except DatabaseError as exc:
        return _error(exc)


# ═══════════════════════════════════════════════════════════════════════════
# RISK / AUDITS
# ═══════════════════════════════════════════════════════════════════════════


@mcp.tool()
def gammaledger_concentration_risk() -> str:
    """Return the top concentrated active positions by capital at risk,
    with each position's share of total collateral as a percentage.
    """
    try:
        ctx = _safe_db().mcp_context
        return _json(
            {
                "collateralAtRisk": ctx.get("portfolio", {})
                .get("risk", {})
                .get("collateralAtRisk"),
                "topPositions": ctx.get("concentration", []) or [],
            }
        )
    except DatabaseError as exc:
        return _error(exc)


@mcp.tool()
def gammaledger_expiring_positions(within_days: int = 7) -> str:
    """Return active positions expiring within N days, sorted by DTE ascending.

    Args:
        within_days: Look-ahead window in days (default 7, max 365).
    """
    try:
        within = max(0, min(int(within_days), 365))
        positions = list(_safe_db().mcp_context.get("activePositions", []) or [])

        expiring = [
            p
            for p in positions
            if isinstance(p.get("dte"), (int, float)) and 0 <= p["dte"] <= within
        ]
        expiring.sort(key=lambda p: p.get("dte", 0))

        total_capital = sum(_round2(p.get("capitalAtRisk")) or 0 for p in expiring)
        total_pl = sum(_round2(p.get("pl")) or 0 for p in expiring)

        return _json(
            {
                "withinDays": within,
                "count": len(expiring),
                "totalCapitalAtRisk": round(total_capital, 2),
                "totalUnrealizedPL": round(total_pl, 2),
                "positions": expiring,
            }
        )
    except DatabaseError as exc:
        return _error(exc)


@mcp.tool()
def gammaledger_audit_risk() -> str:
    """Comprehensive risk audit: drawdown, concentration, expiring,
    underwater positions, Wheel/PMCC coverage gaps. Returns structured
    findings grouped by severity (high / watch / healthy).
    """
    try:
        db = _safe_db()
        ctx = db.mcp_context
        portfolio = ctx.get("portfolio", {})
        risk_metrics = portfolio.get("risk", {})
        perf = portfolio.get("performance", {})

        findings_high: list[dict[str, Any]] = []
        findings_watch: list[dict[str, Any]] = []
        findings_healthy: list[str] = []

        # Concentration
        concentration = ctx.get("concentration", []) or []
        for pos in concentration:
            share = pos.get("sharePct") or 0
            if share >= 20:
                findings_high.append(
                    {
                        "kind": "concentration",
                        "trade_id": pos.get("id"),
                        "ticker": pos.get("ticker"),
                        "strategy": pos.get("strategy"),
                        "sharePct": share,
                        "capitalAtRisk": pos.get("capitalAtRisk"),
                    }
                )
            elif share >= 10:
                findings_watch.append(
                    {
                        "kind": "concentration",
                        "trade_id": pos.get("id"),
                        "ticker": pos.get("ticker"),
                        "sharePct": share,
                    }
                )
        if not any(f["kind"] == "concentration" for f in findings_high + findings_watch):
            findings_healthy.append("No active position exceeds 10% of collateral at risk.")

        # Expiring soon
        active = ctx.get("activePositions", []) or []
        expiring_7 = [
            p for p in active if isinstance(p.get("dte"), (int, float)) and 0 <= p["dte"] <= 7
        ]
        expiring_30 = [
            p for p in active if isinstance(p.get("dte"), (int, float)) and 7 < p["dte"] <= 30
        ]
        if expiring_7:
            findings_high.append(
                {
                    "kind": "expiring_7d",
                    "count": len(expiring_7),
                    "totalCapitalAtRisk": round(
                        sum(_round2(p.get("capitalAtRisk")) or 0 for p in expiring_7), 2
                    ),
                    "positions": [
                        {
                            "trade_id": p.get("id"),
                            "ticker": p.get("ticker"),
                            "strategy": p.get("strategy"),
                            "dte": p.get("dte"),
                            "pl": p.get("pl"),
                        }
                        for p in expiring_7
                    ],
                }
            )
        if expiring_30:
            findings_watch.append(
                {
                    "kind": "expiring_30d",
                    "count": len(expiring_30),
                }
            )

        # Underwater positions
        underwater = [p for p in active if (p.get("pl") or 0) < 0]
        if underwater:
            total_loss = round(sum(p.get("pl") or 0 for p in underwater), 2)
            worst = sorted(underwater, key=lambda p: p.get("pl") or 0)[:3]
            entry = {
                "kind": "underwater_open",
                "count": len(underwater),
                "totalUnrealizedLoss": total_loss,
                "worstThree": [
                    {
                        "trade_id": p.get("id"),
                        "ticker": p.get("ticker"),
                        "strategy": p.get("strategy"),
                        "pl": p.get("pl"),
                    }
                    for p in worst
                ],
            }
            (findings_high if total_loss < -1000 else findings_watch).append(entry)

        # Wheel/PMCC coverage gaps
        wheel_gaps = []
        for pos in ctx.get("wheelPmccPositions", []) or []:
            uncovered = pos.get("uncoveredShares") or 0
            coverage = (pos.get("coverageStatus") or "").lower()
            if uncovered > 0 or coverage in ("partial", "none"):
                wheel_gaps.append(
                    {
                        "trade_id": pos.get("id"),
                        "ticker": pos.get("ticker"),
                        "type": pos.get("type"),
                        "shares": pos.get("shares"),
                        "uncoveredShares": uncovered,
                        "coverageStatus": pos.get("coverageStatus"),
                    }
                )
        if wheel_gaps:
            findings_watch.append({"kind": "wheel_pmcc_coverage_gap", "positions": wheel_gaps})
        elif ctx.get("wheelPmccPositions"):
            findings_healthy.append("All Wheel/PMCC positions are fully covered.")

        # Drawdown context
        max_dd = perf.get("maxDrawdown")
        if isinstance(max_dd, (int, float)) and max_dd > 20:
            findings_watch.append(
                {
                    "kind": "high_max_drawdown",
                    "maxDrawdownPct": max_dd,
                }
            )

        return _json(
            {
                "asOfDate": ctx.get("asOfDate"),
                "summary": {
                    "collateralAtRisk": risk_metrics.get("collateralAtRisk"),
                    "totalMaxRisk": risk_metrics.get("totalMaxRisk"),
                    "maxDrawdown": perf.get("maxDrawdown"),
                    "sharpeRatio": perf.get("sharpeRatio"),
                    "activePositions": portfolio.get("counts", {}).get("active"),
                    "expiringWithin7d": len(expiring_7),
                    "underwaterOpen": len(underwater),
                },
                "high": findings_high,
                "watch": findings_watch,
                "healthy": findings_healthy,
            }
        )
    except DatabaseError as exc:
        return _error(exc)


@mcp.tool()
def gammaledger_audit_wheel_pmcc() -> str:
    """Audit Wheel and PMCC positions — flags coverage gaps, cost-basis
    awareness, and premium-collection effectiveness.
    """
    try:
        positions = list(_safe_db().mcp_context.get("wheelPmccPositions", []) or [])

        gaps: list[dict[str, Any]] = []
        cost_basis_concerns: list[dict[str, Any]] = []
        healthy: list[dict[str, Any]] = []

        for pos in positions:
            uncovered = pos.get("uncoveredShares") or 0
            coverage = (pos.get("coverageStatus") or "").lower()
            strike = pos.get("strike")
            effective_basis = pos.get("effectiveCostBasis")

            entry = {
                "trade_id": pos.get("id"),
                "ticker": pos.get("ticker"),
                "type": pos.get("type"),
                "shares": pos.get("shares"),
                "strike": strike,
                "effectiveCostBasis": effective_basis,
                "premiumCollected": pos.get("premiumCollected"),
                "coverageStatus": pos.get("coverageStatus"),
                "uncoveredShares": uncovered,
                "coveredCallCount": pos.get("coveredCallCount"),
            }

            if uncovered > 0 or coverage in ("partial", "none"):
                gaps.append(entry)
                continue

            # Cost basis vs strike — for wheels, effectiveCostBasis above strike
            # means upside is capped on assignment.
            if (
                isinstance(strike, (int, float))
                and isinstance(effective_basis, (int, float))
                and effective_basis >= strike * 0.98
            ):
                cost_basis_concerns.append(entry)
                continue

            healthy.append(entry)

        return _json(
            {
                "totalPositions": len(positions),
                "coverageGaps": gaps,
                "costBasisConcerns": cost_basis_concerns,
                "healthy": healthy,
            }
        )
    except DatabaseError as exc:
        return _error(exc)


# ═══════════════════════════════════════════════════════════════════════════
# SEARCH
# ═══════════════════════════════════════════════════════════════════════════


@mcp.tool()
def gammaledger_search_trades(
    ticker: str = "",
    strategy: str = "",
    status: str = "",
    limit: int = 25,
) -> str:
    """Search across the full trades database with optional filters.

    Unlike `gammaledger_open_positions` (active only) or
    `gammaledger_recent_closed_trades` (closed only), this scans every
    trade — open, closed, expired, assigned.

    Args:
        ticker: Exact ticker match (case-insensitive).
        strategy: Substring match on strategy name (case-insensitive).
        status: Exact status match: Open, Rolling, Closed, Expired, Assigned.
        limit: Maximum trades to return (default 25, max 200).
    """
    try:
        limit = max(1, min(int(limit), 200))
        results = _safe_db().find_trades(
            ticker=ticker or None,
            strategy=strategy or None,
            status=status or None,
        )
        truncated = len(results) > limit
        return _json(
            {
                "matched": len(results),
                "returned": min(limit, len(results)),
                "truncated": truncated,
                "trades": [
                    {
                        "id": t.get("id"),
                        "ticker": t.get("ticker"),
                        "strategy": t.get("strategy"),
                        "status": t.get("status"),
                        "openedDate": t.get("openedDate"),
                        "closedDate": t.get("closedDate"),
                        "expirationDate": t.get("expirationDate"),
                        "pl": _round2(t.get("pl")),
                        "roi": _round2(t.get("roi")),
                    }
                    for t in results[:limit]
                ],
            }
        )
    except DatabaseError as exc:
        return _error(exc)


# ═══════════════════════════════════════════════════════════════════════════
# RESOURCES — read-only context surfaces
# ═══════════════════════════════════════════════════════════════════════════


@mcp.resource("gammaledger://portfolio/summary")
def resource_portfolio_summary() -> str:
    """Current portfolio metrics snapshot (mirrors gammaledger_portfolio_summary)."""
    try:
        ctx = _safe_db().mcp_context
        return _json(
            {
                "asOfDate": ctx.get("asOfDate"),
                "portfolio": ctx.get("portfolio", {}),
            }
        )
    except DatabaseError as exc:
        return _error(exc)


@mcp.resource("gammaledger://positions/active")
def resource_active_positions() -> str:
    """Current active positions (mirrors gammaledger_open_positions with no filters)."""
    try:
        return _json(_safe_db().mcp_context.get("activePositions", []) or [])
    except DatabaseError as exc:
        return _error(exc)


@mcp.resource("gammaledger://positions/wheel-pmcc")
def resource_wheel_pmcc() -> str:
    """Wheel and PMCC tracker positions."""
    try:
        return _json(_safe_db().mcp_context.get("wheelPmccPositions", []) or [])
    except DatabaseError as exc:
        return _error(exc)


@mcp.resource("gammaledger://database/info")
def resource_database_info() -> str:
    """Loaded database file metadata."""
    try:
        return _json(_safe_db().info())
    except DatabaseError as exc:
        return _error(exc)


# ═══════════════════════════════════════════════════════════════════════════
# PROMPTS
# ═══════════════════════════════════════════════════════════════════════════

register_analysis_prompts(mcp)


# ═══════════════════════════════════════════════════════════════════════════
# ENTRY POINT
# ═══════════════════════════════════════════════════════════════════════════


def main() -> None:
    parser = argparse.ArgumentParser(
        description=f"GammaLedger MCP Server v{__version__}",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Configuration:
  --db-path PATH               Path to GammaLedger JSON database file.
  GAMMALEDGER_DB_PATH env var  Same, used when --db-path is not given.
  Default                      ~/gammaledger.json

Save your database from the GammaLedger app (Settings → Save Database)
before launching this server.
""",
    )
    parser.add_argument(
        "--db-path",
        type=Path,
        default=None,
        help="Path to the GammaLedger JSON database file.",
    )
    parser.add_argument(
        "-v",
        "--verbose",
        action="store_true",
        default=None,
        help="Enable verbose debug logging on stderr.",
    )
    parser.add_argument(
        "--version",
        action="version",
        version=f"gammaledger-mcp {__version__}",
    )
    args = parser.parse_args()

    verbose = args.verbose or os.getenv("GAMMALEDGER_MCP_VERBOSE", "").lower() in (
        "1",
        "true",
        "yes",
    )
    if verbose:
        logging.getLogger().setLevel(logging.DEBUG)
        logger.debug("Verbose logging enabled")

    db_path = args.db_path or os.environ.get("GAMMALEDGER_DB_PATH")
    db = configure_db(db_path)

    logger.info(
        "Starting GammaLedger MCP server v%s (db=%s)",
        __version__,
        db.path,
    )
    if not db.path.exists():
        logger.warning(
            "Database file does not exist yet: %s — tools will return errors "
            "until you save your database from the GammaLedger app.",
            db.path,
        )

    mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
