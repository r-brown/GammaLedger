"""Prompt templates that guide the AI through GammaLedger portfolio analysis."""

from __future__ import annotations

from mcp.server.fastmcp import FastMCP
from mcp.types import PromptMessage, TextContent

_DISCLAIMER = (
    "Reminder: GammaLedger is an informational journal — outputs are not "
    "financial advice. Surface observations, never recommendations to buy/sell."
)


def _user_msg(text: str) -> list[PromptMessage]:
    return [PromptMessage(role="user", content=TextContent(type="text", text=text))]


def register_analysis_prompts(mcp: FastMCP) -> None:
    """Register all analysis / audit prompt templates on the MCP server."""

    # ── 1. Full portfolio analysis ──────────────────────────────────────

    @mcp.prompt()
    def analyze_portfolio() -> list[PromptMessage]:
        """Comprehensive portfolio review covering performance, risk, and exposure."""
        return _user_msg(
            f"""
You are reviewing a GammaLedger options trading portfolio. Walk through the
data systematically — call each tool, then synthesise findings.

## Step 1 — Snapshot
Call `gammaledger_database_info` and `gammaledger_portfolio_summary`. Report the as-of date,
trade counts, and headline metrics (total P&L, win rate, profit factor,
Sharpe, max drawdown, expectancy).

## Step 2 — Time-windowed performance
Call `gammaledger_pl_breakdown`. Compare YTD vs MTD vs last 30 days vs last 7 days.
Note any acceleration or stalling in realised P&L.

## Step 3 — Active book
Call `gammaledger_open_positions`. For each, note ticker, strategy, DTE, capital
at risk, and current P&L. Group by strategy for readability.

## Step 4 — Strategy effectiveness
Call `gammaledger_strategy_breakdown`. Identify the top 2 most profitable
strategies and any strategy with negative expectancy.

## Step 5 — Concentration & exposure
Call `gammaledger_concentration_risk`, `gammaledger_ticker_exposure`, and
`gammaledger_underlying_breakdown`. Flag any single position > 20% of collateral
and any ticker dominating P&L.

## Step 6 — Wheel/PMCC health
Call `gammaledger_wheel_pmcc_positions`. For each: cost basis, premium collected,
and coverage status. Flag uncovered shares.

## Step 7 — Synthesis
Produce three short paragraphs:
1. **Performance** — what's working, with specific numbers.
2. **Risk** — concentrations, drawdown trend, expiring positions.
3. **Observations** — patterns worth surfacing (no buy/sell advice).

{_DISCLAIMER}
""".strip()
        )

    # ── 2. Risk audit ───────────────────────────────────────────────────

    @mcp.prompt()
    def risk_audit() -> list[PromptMessage]:
        """Risk-focused audit — concentration, drawdown, expiring, uncovered."""
        return _user_msg(
            f"""
Run a risk audit on the GammaLedger portfolio. Be specific and quote numbers.

## Step 1 — Risk metrics
Call `gammaledger_portfolio_summary`. Extract: maxDrawdown, sharpeRatio,
sortinoRatio, collateralAtRisk, totalMaxRisk.

## Step 2 — Concentration
Call `gammaledger_concentration_risk`. List positions with sharePct > 20% as
🔴 high-concentration; 10-20% as 🟡 moderate.

## Step 3 — Expiring positions
Call `gammaledger_expiring_positions` with within_days=7, then with within_days=30.
Group as 🔴 ≤ 7 days, 🟡 8-30 days. Report capital at risk per bucket.

## Step 4 — Wheel/PMCC coverage gaps
Call `gammaledger_audit_wheel_pmcc`. List any position with uncoveredShares > 0 or
coverageStatus other than 'full'. These are passive equity positions
without protective income.

## Step 5 — Underwater open trades
Call `gammaledger_open_positions`, filter where pl < 0. Report count, total
unrealised loss, and the worst three by absolute loss.

## Step 6 — Audit Report
Produce a markdown report:

### 🔴 High Risk
- Specific findings — quote numbers.

### 🟡 Watchlist
- Items to monitor.

### 🟢 Healthy
- Areas without notable risk.

### 📊 Summary table
| Metric | Value |
|---|---|
| Active positions | |
| Capital at risk | |
| Max drawdown | |
| Positions > 20% concentration | |
| Expiring ≤ 7d | |
| Uncovered Wheel/PMCC shares | |

{_DISCLAIMER}
""".strip()
        )

    # ── 3. Wheel / PMCC review ──────────────────────────────────────────

    @mcp.prompt()
    def wheel_pmcc_review() -> list[PromptMessage]:
        """Deep-dive on Wheel and PMCC positions — premium, coverage, cost basis."""
        return _user_msg(
            f"""
Review every Wheel and PMCC (Poor Man's Covered Call) position in the
GammaLedger journal.

## Step 1
Call `gammaledger_wheel_pmcc_positions`.

## Step 2 — Per position, report:
- Ticker, type (wheel | pmcc), shares, strike, status.
- Cost basis: `assignmentCostBasis` and `effectiveCostBasis` (after
  premiums collected). Note the gap.
- Total premium collected (`premiumCollected`) and number of covered
  calls written (`coveredCallCount`).
- Coverage: `coverageStatus`, `coveredShares` vs `uncoveredShares`,
  active short call strikes/expiries.
- Recent premium events from `premiumHistorySummary.recent`.

## Step 3 — Findings
Group output:

### 🔴 Coverage gaps
Positions with uncoveredShares > 0 — passive equity, no income.

### 🟡 Cost basis vs strike awareness
Positions where effectiveCostBasis is close to or above strike — limited
upside on assignment.

### 🟢 Healthy income generators
Positions with full coverage and steady premium collection.

### 📊 Summary
| Ticker | Type | Shares | Cost basis | Effective | Premium total | Coverage |
|---|---|---|---|---|---|---|

{_DISCLAIMER}
""".strip()
        )

    # ── 4. Weekly review ────────────────────────────────────────────────

    @mcp.prompt()
    def weekly_review() -> list[PromptMessage]:
        """Short weekly check-in — what changed, what's expiring, where to look."""
        return _user_msg(
            f"""
Produce a tight weekly review of the GammaLedger portfolio.

## Step 1 — Weekly P&L
Call `gammaledger_pl_breakdown`. Report `last7d` and compare to `last30d / 4`
(rough weekly average). Note if this week is above/below average.

## Step 2 — Recently closed
Call `gammaledger_recent_closed_trades` with limit=10. List each: ticker,
strategy, P&L, days held. Flag any losers and any unusually large wins.

## Step 3 — What's expiring this week
Call `gammaledger_expiring_positions` with within_days=7. List with DTE and P&L.

## Step 4 — Streak & cadence
From `gammaledger_portfolio_summary`, surface `currentStreak` and
`daysSinceLastTrade`.

## Step 5 — Output (target: ~200 words)
Three sections, terse:
1. **This week's P&L:** $X realised, vs ~$Y typical.
2. **Closed:** what worked, what didn't.
3. **Coming up:** N positions expire within 7 days, total capital $Z.

{_DISCLAIMER}
""".strip()
        )

    # ── 5. Single-position deep dive ────────────────────────────────────

    @mcp.prompt()
    def position_inspect(trade_id: str) -> list[PromptMessage]:
        """Deep dive on one specific position by trade ID.

        Args:
            trade_id: The trade identifier (e.g. 'TRD-0042').
        """
        return _user_msg(
            f"""
Inspect GammaLedger position **{trade_id}** in detail.

## Step 1 — Fetch
Call `gammaledger_position` with trade_id="{trade_id}".

## Step 2 — Report
- Header: ticker, strategy, status, opened → expires (DTE).
- Legs: one line per leg — orderType, type, qty, strike, premium, fees.
- Cash flow: totalCredit, totalDebit, cashFlow, totalFees.
- Risk: capitalAtRisk, maxRisk, maxRiskLabel, riskIsUnlimited?
- P&L: pl, roi, annualizedROI, daysHeld.
- Lifecycle flags: partialClose, rolledForward, autoExpired.
- Notes: full text if present.

## Step 3 — Context
- If the position is a Wheel/PMCC, also call `gammaledger_wheel_pmcc_positions`
  and surface cost basis, coverage status, premium history.
- Place P&L in context: how does its ROI compare to the portfolio
  `annualizedROI` from `gammaledger_portfolio_summary`?

{_DISCLAIMER}
""".strip()
        )
