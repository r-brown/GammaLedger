"""Typed results for the tools that publish an MCP ``outputSchema``.

Strict clients can parse ``structuredContent`` against these schemas instead of guessing at
free-form text. Fields that come straight from the GammaLedger file are typed loosely
(``Any`` / ``extra="allow"``): the app owns that data, and a new field or an unexpected value
must never turn a working tool call into a validation error.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, model_serializer


class _Model(BaseModel):
    model_config = ConfigDict(extra="allow")


class _Sparse(_Model):
    """Like the app's ``compact()``: ``None`` fields are left out of the serialized result."""

    @model_serializer(mode="wrap")
    def _drop_none(self, handler: Any) -> dict[str, Any]:
        data: dict[str, Any] = handler(self)
        return {k: v for k, v in data.items() if v is not None}


# ── gammaledger_database_info ──────────────────────────────────────────────


class DatabaseInfo(_Model):
    source: str  # file | dir | url
    location: str
    loadedFrom: str | None = None
    version: Any = None
    exportDate: Any = None
    fileName: Any = None
    tradeCount: int
    watchlistCount: int
    mcpContextPresent: bool
    mcpContextGeneratedAt: Any = None
    asOfDate: Any = None
    loadedAt: str | None = None
    dataAgeDays: float | None = None  # now - exportDate, in days
    isStale: bool  # export older than staleAfterDays
    staleAfterDays: float
    stale: bool  # the last refresh failed and a previous copy is being served
    lastRefreshError: str | None = None
    warnings: list[str]


# ── portfolio ──────────────────────────────────────────────────────────────


class PortfolioCounts(_Sparse):
    totalTrades: int | None = None
    closed: int | None = None
    active: int | None = None
    assigned: int | None = None
    awaitingCoverage: int | None = None


class PortfolioPL(_Sparse):
    total: float | None = None
    realized: float | None = None
    unrealized: float | None = None
    pendingPremium: float | None = None
    ytd: float | None = None
    mtd: float | None = None
    last7d: float | None = None
    last30d: float | None = None
    last90d: float | None = None
    last1y: float | None = None


class PortfolioPerformance(_Sparse):
    winRate: float | None = None
    wins: int | None = None
    losses: int | None = None
    profitFactor: float | None = None
    avgWin: float | None = None
    avgLoss: float | None = None
    expectancy: float | None = None
    totalROI: float | None = None
    annualizedROI: float | None = None
    maxDrawdown: float | None = None
    maxDrawdownDollars: float | None = None
    sharpeRatio: float | None = None
    sortinoRatio: float | None = None


class PortfolioRisk(_Sparse):
    collateralAtRisk: float | None = None
    totalMaxRisk: float | None = None


class PortfolioFees(_Sparse):
    total: float | None = None
    shareOfGross: float | None = None


class PortfolioTrading(_Sparse):
    avgWinnerDays: float | None = None
    avgLoserDays: float | None = None
    currentStreak: dict[str, Any] | None = None  # {"type": "win" | "loss", "count": n}
    daysSinceLastTrade: int | None = None


class TradeBrief(_Sparse):
    id: str | None = None
    ticker: str | None = None
    strategy: str | None = None
    pl: float | None = None
    roi: float | None = None
    closedDate: str | None = None


class Portfolio(_Sparse):
    counts: PortfolioCounts | None = None
    pl: PortfolioPL | None = None
    performance: PortfolioPerformance | None = None
    risk: PortfolioRisk | None = None
    fees: PortfolioFees | None = None
    trading: PortfolioTrading | None = None
    largestWinner: TradeBrief | None = None
    largestLoser: TradeBrief | None = None


class PortfolioSummary(_Sparse):
    asOfDate: str | None = None
    generatedAt: str | None = None
    dataWarning: str | None = None
    portfolio: Portfolio


class PLBreakdown(_Sparse):
    asOfDate: str | None = None
    dataWarning: str | None = None
    pl: PortfolioPL


# ── positions & search ─────────────────────────────────────────────────────


class OpenPositions(_Sparse):
    count: int
    fields: list[str] | None = None  # projection applied; None means every field
    dataWarning: str | None = None
    positions: list[dict[str, Any]]


class PositionDetail(_Model):
    """``trade`` is the persisted record (legs, dates, notes); ``summary`` is the computed view.

    ``summary.plSource`` is ``"app"`` (embedded by the GammaLedger app) or ``"derived"``
    (recomputed from the legs of a closed trade). ``summary`` is null when neither exists.
    """

    trade: dict[str, Any]
    summary: dict[str, Any] | None = None


class SearchResult(_Sparse):
    matched: int
    returned: int
    truncated: bool
    matchedWithPL: int  # matched trades whose P&L is known (app or derived)
    matchedTotalPL: float | None = None  # sum of P&L over those trades (all matches, not just rows)
    fields: list[str]
    dataWarning: str | None = None
    trades: list[dict[str, Any]]
