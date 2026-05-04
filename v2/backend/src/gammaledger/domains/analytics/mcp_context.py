"""Build the legacy-compatible MCP context surface.

This starts with the stable closed-trade fields covered by the AAPL/KO golden
fixtures. Wider portfolio, open-position, and strategy variants build on the
same primitives in later Phase 1/2 work.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import date
from typing import Any, cast

from ..pnl.calculations import LegLike, calculate_pl, from_orm, leg_cash_flow, total_fees


@dataclass(frozen=True, slots=True)
class EnrichedTrade:
    id: str
    ticker: str
    strategy: str
    status: str
    underlying_type: str
    opened_date: date
    closed_date: date | None
    expiration_date: date | None
    exit_reason: str | None
    notes: str | None
    legs: list[LegLike]
    entry_price: float
    exit_price: float
    cash_flow: float
    fees: float
    days_held: int
    capital_at_risk: float
    risk_is_unlimited: bool
    roi: float
    annualized_roi: float
    display_strike: str
    quantity: int
    dte: int
    wheel_coverage: str
    lifecycle_status: str | None
    shares: int
    effective_cost_basis: float


def build_mcp_context(trades: list[Any], *, as_of: date) -> dict[str, Any]:
    enriched = [_enrich_trade(trade, as_of=as_of) for trade in trades]
    closed = [trade for trade in enriched if trade.status in {"Closed", "Expired"}]
    active = [
        trade
        for trade in enriched
        if trade.status in {"Open", "Rolling", "Assigned"}
        and trade.lifecycle_status != "awaiting_coverage"
    ]
    wheel_pmcc = [
        trade
        for trade in enriched
        if trade.strategy in {"Wheel", "Poor Man's Covered Call"}
        and trade.status not in {"Closed", "Expired"}
        and trade.shares > 0
    ]
    winners = [trade for trade in closed if trade.cash_flow > 0]
    losers = [trade for trade in closed if trade.cash_flow < 0]
    total_pl = _r2(sum(trade.cash_flow for trade in closed))
    total_fees = _r2(sum(trade.fees for trade in enriched))
    gross = abs(total_pl) + total_fees
    total_capital_days = sum(trade.capital_at_risk * trade.days_held for trade in closed)
    annualized = (
        _r2(
            sum(trade.annualized_roi * trade.capital_at_risk * trade.days_held for trade in closed)
            / total_capital_days
        )
        if total_capital_days > 0
        else 0
    )
    largest_winner = max(closed, key=lambda trade: trade.cash_flow, default=None)
    largest_loser = min(closed, key=lambda trade: trade.cash_flow, default=None)

    return cast(
        dict[str, Any],
        _compact(
            {
                "asOfDate": as_of.isoformat(),
                "portfolio": {
                    "counts": {
                        "totalTrades": len(enriched),
                        "closed": len(closed),
                        "active": len(active),
                        "assigned": len([t for t in enriched if t.status == "Assigned"]),
                        "awaitingCoverage": len(
                            [t for t in enriched if t.lifecycle_status == "awaiting_coverage"]
                        ),
                    },
                    "pl": {
                        "total": total_pl,
                        "realized": total_pl,
                        "unrealized": 0,
                        "ytd": _sum_closed_since(closed, as_of.replace(month=1, day=1)),
                        "mtd": _sum_closed_since(closed, as_of.replace(day=1)),
                        "last7d": _sum_closed_since(closed, _days_before(as_of, 7)),
                        "last30d": _sum_closed_since(closed, _days_before(as_of, 30)),
                        "last90d": _sum_closed_since(closed, _days_before(as_of, 90)),
                        "last1y": _sum_closed_since(closed, _days_before(as_of, 365)),
                    },
                    "performance": {
                        "winRate": _r2((len(winners) / len(closed)) * 100) if closed else 0,
                        "wins": len(winners),
                        "losses": len(losers),
                        "avgWin": _r2(sum(t.cash_flow for t in winners) / len(winners))
                        if winners
                        else 0,
                        "avgLoss": _r2(abs(sum(t.cash_flow for t in losers) / len(losers)))
                        if losers
                        else 0,
                        "expectancy": _r2(total_pl / len(closed)) if closed else 0,
                        "totalROI": annualized,
                        "annualizedROI": annualized,
                        "maxDrawdown": 0,
                    },
                    "risk": {
                        "collateralAtRisk": _r2(sum(t.capital_at_risk for t in active)),
                        "totalMaxRisk": _r2(sum(t.capital_at_risk for t in enriched)),
                    },
                    "fees": {
                        "total": total_fees,
                        "shareOfGross": _r2((total_fees / gross) * 100) if gross > 0 else 0,
                    },
                    "trading": {
                        "avgWinnerDays": round(sum(t.days_held for t in winners) / len(winners))
                        if winners
                        else 0,
                        "avgLoserDays": round(sum(t.days_held for t in losers) / len(losers))
                        if losers
                        else 0,
                        "currentStreak": _current_streak(closed),
                        "daysSinceLastTrade": _days_between(
                            max(t.closed_date for t in closed if t.closed_date), as_of
                        )
                        if closed
                        else None,
                    },
                    "largestWinner": _winner_loser(largest_winner),
                    "largestLoser": _winner_loser(largest_loser),
                },
                "strategyBreakdown": _strategy_breakdown(enriched),
                "underlyingBreakdown": _underlying_breakdown(enriched),
                "dteDistribution": {
                    **_dte_distribution(active),
                },
                "concentration": _concentration(active),
                "activePositions": [_mcp_trade(trade, is_open=True) for trade in active],
                "wheelPmccPositions": [_wheel_pmcc_position(trade) for trade in wheel_pmcc],
                "tickerExposure": _ticker_exposure(enriched),
                "recentClosedTrades": [
                    _recent_closed(trade)
                    for trade in sorted(
                        closed, key=lambda item: item.closed_date or date.min, reverse=True
                    )
                ],
            },
        ),
    )


def _enrich_trade(trade: Any, *, as_of: date) -> EnrichedTrade:
    legs = [from_orm(leg) for leg in trade.legs]
    fees = total_fees(legs)
    opened = trade.opened_date
    stock_shares = _stock_shares(legs)
    status = _effective_status(
        trade.status_override or trade.status,
        legs=legs,
        expiration=trade.expiration_date,
        as_of=as_of,
    )
    closed = trade.closed_date or (trade.expiration_date if status == "Expired" else None)
    exit_reason = trade.exit_reason or ("Cash Settlement" if _has_cash_settlement(legs) else None)
    is_closed = status in {"Closed", "Expired"}
    days_held = _days_between(opened, closed if is_closed else as_of)
    active_options = _active_open_option_legs(legs)
    short_call_contracts = _active_short_call_contracts(legs)
    wheel_coverage = _wheel_coverage(
        strategy=trade.strategy,
        stock_shares=stock_shares,
        short_call_contracts=short_call_contracts,
    )
    lifecycle_status = "awaiting_coverage" if wheel_coverage == "uncovered" else None
    entry_price = _entry_price(active_options or _open_legs(legs))
    exit_price = _exit_price(legs)
    capital, risk_is_unlimited = _capital_at_risk(
        trade.strategy,
        legs,
        active_options,
        max_risk_override=trade.max_risk_override,
    )
    cash_flow = _pl_for_trade(legs, status=status)
    roi_base = _effective_cost_basis(legs) if stock_shares > 0 and status != "Closed" else capital
    roi = _r2((cash_flow / roi_base) * 100) if roi_base > 0 else 0
    annualized = _r2((365 * roi) / days_held) if is_closed and days_held > 0 else 0
    return EnrichedTrade(
        id=trade.id,
        ticker=trade.ticker,
        strategy=trade.strategy,
        status=status,
        underlying_type=trade.underlying_type,
        opened_date=opened,
        closed_date=closed,
        expiration_date=trade.expiration_date,
        exit_reason=exit_reason,
        notes=trade.notes,
        legs=legs,
        entry_price=entry_price,
        exit_price=exit_price,
        cash_flow=cash_flow,
        fees=fees,
        days_held=days_held,
        capital_at_risk=capital,
        risk_is_unlimited=risk_is_unlimited,
        roi=roi,
        annualized_roi=annualized,
        display_strike=_display_strike(active_options or _open_option_legs(legs)),
        quantity=_quantity(legs),
        dte=_calculate_dte(trade.expiration_date, as_of=as_of, status=status),
        wheel_coverage=wheel_coverage,
        lifecycle_status=lifecycle_status,
        shares=stock_shares,
        effective_cost_basis=_effective_cost_basis(legs),
    )


def _active_open_option_legs(legs: list[LegLike]) -> list[LegLike]:
    groups: dict[str, dict[str, Any]] = {}
    has_closed_out = False
    for leg in legs:
        if leg.type not in {"CALL", "PUT"}:
            continue
        key = _lifecycle_key(leg)
        group = groups.setdefault(key, {"open": 0.0, "close": 0.0, "open_legs": []})
        if leg.order_type in {"BTO", "STO"}:
            group["open"] += abs(leg.quantity)
            group["open_legs"].append(leg)
        else:
            group["close"] += abs(leg.quantity)

    active: list[LegLike] = []
    for group in groups.values():
        net = group["open"] - group["close"]
        if group["open"] > 0 and group["close"] > 0:
            has_closed_out = True
        if net <= 0:
            continue
        remaining = net
        for leg in reversed(group["open_legs"]):
            if remaining <= 0:
                break
            quantity = min(abs(leg.quantity), remaining)
            active.append(
                LegLike(
                    order_type=leg.order_type,
                    type=leg.type,
                    quantity=quantity,
                    multiplier=leg.multiplier,
                    strike=leg.strike,
                    premium=leg.premium,
                    fees=leg.fees,
                )
            )
            remaining -= quantity
    return active if has_closed_out and active else []


def _active_short_call_contracts(legs: list[LegLike]) -> int:
    net = 0.0
    for leg in legs:
        if leg.type != "CALL":
            continue
        if leg.order_type == "STO":
            net += abs(leg.quantity)
        elif leg.order_type == "BTC":
            net -= abs(leg.quantity)
    return max(0, int(round(net)))


def _active_short_call_details(legs: list[LegLike]) -> list[dict[str, Any]]:
    groups: dict[str, dict[str, Any]] = {}
    for leg in legs:
        if leg.type != "CALL" or leg.strike is None:
            continue
        key = f"{leg.strike}"
        entry = groups.setdefault(
            key,
            {"strike": leg.strike, "expiration": None, "contracts": 0.0},
        )
        if leg.order_type == "STO":
            entry["contracts"] += abs(leg.quantity)
        elif leg.order_type == "BTC":
            entry["contracts"] -= abs(leg.quantity)
    return [
        {
            "strike": _r2(entry["strike"]),
            "expiration": entry["expiration"],
            "contracts": int(entry["contracts"]),
        }
        for entry in groups.values()
        if entry["contracts"] > 0
    ]


def _stock_shares(legs: list[LegLike]) -> int:
    shares = 0.0
    for leg in legs:
        if leg.type != "STOCK":
            continue
        if leg.order_type == "BTO":
            shares += abs(leg.quantity) * leg.multiplier
        elif leg.order_type == "STC":
            shares -= abs(leg.quantity) * leg.multiplier
    return max(0, int(round(shares)))


def _wheel_coverage(*, strategy: str, stock_shares: int, short_call_contracts: int) -> str:
    if strategy not in {"Wheel", "Poor Man's Covered Call"} or stock_shares <= 0:
        return "n/a"
    covered = short_call_contracts * 100
    if covered >= stock_shares:
        return "covered"
    if covered > 0:
        return "partial"
    return "uncovered"


def _option_cash_flow(legs: list[LegLike]) -> float:
    return _r2(sum(leg_cash_flow(leg) for leg in legs if leg.type in {"CALL", "PUT"}))


def _stock_assignment_cost(legs: list[LegLike]) -> float:
    return _r2(
        sum(
            abs(leg_cash_flow(leg))
            for leg in legs
            if leg.type == "STOCK" and leg.order_type == "BTO"
        )
    )


def _stock_assignment_strike(legs: list[LegLike]) -> float:
    for leg in legs:
        if leg.type == "STOCK" and leg.order_type == "BTO" and leg.strike is not None:
            return _r2(leg.strike)
    return 0


def _first_stock_open_date(trade: EnrichedTrade) -> str | None:
    # LegLike intentionally omits execution_date, so fall back to the trade open
    # date until assignment-specific metadata is threaded through.
    return trade.opened_date.isoformat()


def _effective_cost_basis(legs: list[LegLike]) -> float:
    stock_cost = _stock_assignment_cost(legs)
    option_flow = _option_cash_flow(legs)
    return _r2(stock_cost - option_flow)


def _pl_for_trade(legs: list[LegLike], *, status: str) -> float:
    stock_shares = _stock_shares(legs)
    if stock_shares > 0 and status not in {"Closed", "Expired"}:
        fallback_price = _stock_assignment_strike(legs)
        market_value = stock_shares * fallback_price
        return _r2(market_value - _effective_cost_basis(legs))
    return calculate_pl(legs)


def _has_cash_settlement(legs: list[LegLike]) -> bool:
    return any(leg.type == "CASH" and leg.order_type in {"BTC", "STC"} for leg in legs)


def _has_close_activity(legs: list[LegLike]) -> bool:
    return any(leg.order_type in {"BTC", "STC"} for leg in legs)


def _unmatched_option_exposure(legs: list[LegLike]) -> float:
    groups: dict[str, dict[str, float]] = {}
    for leg in legs:
        if leg.type not in {"CALL", "PUT"}:
            continue
        key = _lifecycle_key(leg)
        group = groups.setdefault(
            key,
            {"long_open": 0, "long_close": 0, "short_open": 0, "short_close": 0},
        )
        if leg.order_type == "BTO":
            group["long_open"] += abs(leg.quantity)
        elif leg.order_type == "STC":
            group["long_close"] += abs(leg.quantity)
        elif leg.order_type == "STO":
            group["short_open"] += abs(leg.quantity)
        elif leg.order_type == "BTC":
            group["short_close"] += abs(leg.quantity)
    return sum(
        abs(group["long_open"] - group["long_close"])
        + abs(group["short_open"] - group["short_close"])
        for group in groups.values()
    )


def _capital_at_risk(
    strategy: str,
    legs: list[LegLike],
    active_options: list[LegLike],
    *,
    max_risk_override: float | None,
) -> tuple[float, bool]:
    if max_risk_override is not None and max_risk_override > 0:
        return _r2(max_risk_override), False
    if strategy == "Short Call":
        return 0, True
    if strategy in {"Wheel", "Cash-Secured Put"}:
        return _cash_secured_put_risk(legs, active_options), False
    if strategy == "Poor Man's Covered Call":
        return _pmcc_risk(legs), False
    if strategy == "Covered Call":
        return _covered_call_risk(legs), False
    if strategy in _DEBIT_RISK_STRATEGIES:
        return _r2(_total_debit(legs)), False
    if strategy in _CREDIT_WIDTH_RISK_STRATEGIES:
        return _credit_width_risk(legs, active_options), False
    return _fallback_risk(legs, active_options), False


_DEBIT_RISK_STRATEGIES = {
    "Bear Put Spread",
    "Bull Call Spread",
    "Calendar Call Spread",
    "Calendar Put Spread",
    "Calendar Straddle",
    "Calendar Strangle",
    "Covered Short Straddle",
    "Covered Short Strangle",
    "Diagonal Call Spread",
    "Diagonal Put Spread",
    "Double Diagonal",
    "Guts",
    "Long Call",
    "Long Put",
    "Long Call Butterfly",
    "Long Put Butterfly",
    "Long Call Condor",
    "Long Put Condor",
    "Long Straddle",
    "Long Strangle",
    "Protective Put",
    "Strap",
    "Strip",
    "Synthetic Long Stock",
    "Synthetic Short Stock",
    "Synthetic Put",
}


_CREDIT_WIDTH_RISK_STRATEGIES = {
    "Bear Call Ladder",
    "Bear Call Spread",
    "Box Spread",
    "Bull Put Ladder",
    "Bull Put Spread",
    "Call Broken Wing",
    "Call Ratio Backspread",
    "Call Ratio Spread",
    "Covered Put",
    "Inverse Call Broken Wing",
    "Inverse Iron Butterfly",
    "Inverse Iron Condor",
    "Inverse Put Broken Wing",
    "Iron Albatross",
    "Iron Butterfly",
    "Iron Condor",
    "Jade Lizard",
    "Put Broken Wing",
    "Put Ratio Backspread",
    "Put Ratio Spread",
    "Reverse Jade Lizard",
    "Short Call Butterfly",
    "Short Call Condor",
    "Short Guts",
    "Short Put",
    "Short Put Butterfly",
    "Short Put Condor",
    "Short Straddle",
    "Short Strangle",
}


def _cash_secured_put_risk(legs: list[LegLike], active_options: list[LegLike]) -> float:
    risk_legs = active_options or _open_option_legs(legs)
    short_puts = [leg.strike for leg in risk_legs if leg.type == "PUT" and leg.order_type == "STO"]
    short_calls = [
        leg.strike for leg in risk_legs if leg.type == "CALL" and leg.order_type == "STO"
    ]
    strike = max([s for s in short_puts if s is not None], default=None)
    if strike is None:
        strike = min([s for s in short_calls if s is not None], default=0)
    contract_value = _quantity(legs) or 100
    credit = sum(
        leg.premium * leg.multiplier * abs(leg.quantity)
        for leg in risk_legs
        if leg.order_type == "STO"
    )
    debit = sum(
        leg.premium * leg.multiplier * abs(leg.quantity)
        for leg in risk_legs
        if leg.order_type == "BTO"
    )
    net_credit = max((credit - debit) / contract_value, 0)
    return _r2(max((strike - net_credit) * contract_value, 0))


def _pmcc_risk(legs: list[LegLike]) -> float:
    long_call_cost = sum(
        abs(leg_cash_flow(leg)) for leg in legs if leg.type == "CALL" and leg.order_type == "BTO"
    )
    short_call_net = sum(
        leg_cash_flow(leg) for leg in legs if leg.type == "CALL" and leg.order_type != "BTO"
    )
    return _r2(max(long_call_cost - short_call_net, 0))


def _covered_call_risk(legs: list[LegLike]) -> float:
    stock_cost = _stock_assignment_cost(legs)
    if stock_cost > 0:
        return stock_cost
    return _r2(_total_debit(legs))


def _credit_width_risk(legs: list[LegLike], active_options: list[LegLike]) -> float:
    risk_legs = active_options or _open_option_legs(legs)
    strikes = sorted({leg.strike for leg in risk_legs if leg.strike is not None})
    if len(strikes) < 2:
        return _fallback_risk(legs, active_options)
    width = max(strikes) - min(strikes)
    notional = _contract_notional(risk_legs)
    net_credit = max((_total_credit(risk_legs) - _total_debit(risk_legs)) / notional, 0)
    return _r2(max((width - net_credit) * notional, 0))


def _fallback_risk(legs: list[LegLike], active_options: list[LegLike]) -> float:
    risk_legs = active_options or _open_option_legs(legs) or legs
    if any(leg.order_type == "STO" and leg.type == "PUT" for leg in risk_legs):
        return _cash_secured_put_risk(legs, active_options)
    debit = _total_debit(risk_legs)
    return _r2(debit if debit > 0 else _total_credit(risk_legs))


def _total_debit(legs: list[LegLike]) -> float:
    return sum(
        leg.premium * leg.multiplier * abs(leg.quantity) for leg in legs if leg.order_type == "BTO"
    )


def _total_credit(legs: list[LegLike]) -> float:
    return sum(
        leg.premium * leg.multiplier * abs(leg.quantity) for leg in legs if leg.order_type == "STO"
    )


def _contract_notional(legs: list[LegLike]) -> float:
    return max((leg.multiplier * abs(leg.quantity) for leg in legs), default=100) or 100


def _entry_price(legs: list[LegLike]) -> float:
    if not legs:
        return 0
    primary = _primary_leg(legs)
    multiplier = primary.multiplier or 1
    contracts = max((abs(leg.quantity) for leg in legs), default=1)
    open_cash = sum(leg_cash_flow(leg) for leg in legs if leg.order_type in {"BTO", "STO"})
    return _r2(abs(open_cash) / (contracts * multiplier))


def _exit_price(legs: list[LegLike]) -> float:
    close_legs = [leg for leg in legs if leg.order_type in {"BTC", "STC"}]
    if not close_legs:
        return 0
    primary = _primary_leg(_open_option_legs(legs) or legs)
    multiplier = primary.multiplier or 1
    contracts = sum(abs(leg.quantity) for leg in close_legs)
    close_cash = sum(leg_cash_flow(leg) for leg in close_legs)
    return _r2(abs(close_cash) / (contracts * multiplier))


def _recent_closed(trade: EnrichedTrade) -> dict[str, Any]:
    return cast(
        dict[str, Any],
        _compact(
            {
                "id": trade.id,
                "ticker": trade.ticker,
                "strategy": trade.strategy,
                "status": trade.status,
                "underlying": trade.underlying_type,
                "direction": "short",
                "opened": trade.opened_date.isoformat(),
                "expires": trade.expiration_date.isoformat() if trade.expiration_date else None,
                "quantity": trade.quantity,
                "strike": trade.display_strike,
                "entryPrice": trade.entry_price,
                "pl": trade.cash_flow,
                "roi": trade.roi,
                "annualizedROI": trade.annualized_roi,
                "capitalAtRisk": trade.capital_at_risk,
                "maxRiskLabel": "Unlimited"
                if trade.risk_is_unlimited
                else f"${trade.capital_at_risk:,.2f}",
                "cashFlow": trade.cash_flow,
                "fees": trade.fees,
                "daysHeld": trade.days_held,
                "closed": trade.closed_date.isoformat() if trade.closed_date else None,
                "exitPrice": trade.exit_price,
                "exitReason": trade.exit_reason,
                "notes": trade.notes,
            },
        ),
    )


def _mcp_trade(trade: EnrichedTrade, *, is_open: bool) -> dict[str, Any]:
    row = {
        "id": trade.id,
        "ticker": trade.ticker,
        "strategy": trade.strategy,
        "status": trade.status,
        "underlying": trade.underlying_type,
        "direction": "short",
        "opened": trade.opened_date.isoformat(),
        "expires": trade.expiration_date.isoformat() if trade.expiration_date else None,
        "quantity": trade.quantity,
        "strike": trade.display_strike,
        "entryPrice": trade.entry_price,
        "pl": trade.cash_flow,
        "roi": trade.roi,
        "annualizedROI": trade.annualized_roi,
        "capitalAtRisk": trade.capital_at_risk,
        "maxRiskLabel": "Unlimited"
        if trade.risk_is_unlimited
        else f"${trade.capital_at_risk:,.2f}",
        "cashFlow": trade.cash_flow,
        "fees": trade.fees,
        "daysHeld": trade.days_held,
    }
    if is_open:
        row["dte"] = trade.dte
    else:
        row["closed"] = trade.closed_date.isoformat() if trade.closed_date else None
        row["exitPrice"] = trade.exit_price
        row["exitReason"] = trade.exit_reason
    if trade.wheel_coverage != "n/a":
        row["wheelCoverage"] = trade.wheel_coverage
    if trade.lifecycle_status:
        row["lifecycleStatus"] = trade.lifecycle_status
    if trade.risk_is_unlimited:
        row["riskIsUnlimited"] = True
    return cast(dict[str, Any], _compact(row))


def _wheel_pmcc_position(trade: EnrichedTrade) -> dict[str, Any]:
    active_short_calls = _active_short_call_contracts(trade.legs)
    covered_shares = active_short_calls * 100
    uncovered_shares = max(0, trade.shares - covered_shares)
    coverage_status = (
        "full"
        if covered_shares >= trade.shares and trade.shares > 0
        else "partial"
        if covered_shares > 0
        else "none"
    )
    row = {
        "id": trade.id,
        "ticker": trade.ticker,
        "strategy": trade.strategy,
        "type": "wheel" if trade.strategy == "Wheel" else "pmcc",
        "status": trade.status,
        "opened": trade.opened_date.isoformat(),
        "assignedOn": _first_stock_open_date(trade),
        "shares": trade.shares,
        "strike": _stock_assignment_strike(trade.legs),
        "costBasis": _stock_assignment_cost(trade.legs),
        "costBasisPerShare": _r2(_stock_assignment_cost(trade.legs) / trade.shares)
        if trade.shares
        else 0,
        "effectiveCostBasis": trade.effective_cost_basis,
        "premiumCollected": _option_cash_flow(trade.legs),
        "coverageStatus": coverage_status,
        "wheelCoverage": trade.wheel_coverage,
        "lifecycleStatus": trade.lifecycle_status,
        "coveredShares": covered_shares,
        "uncoveredShares": uncovered_shares,
        "activeShortCalls": active_short_calls,
        "activeShortCallDetails": _active_short_call_details(trade.legs),
    }
    return cast(dict[str, Any], _compact(row))


def _strategy_breakdown(trades: list[EnrichedTrade]) -> list[dict[str, Any]]:
    rows = []
    for strategy, group in _group_by(trades, "strategy").items():
        closed = [trade for trade in group if trade.status in {"Closed", "Expired"}]
        wins = [trade for trade in closed if trade.cash_flow > 0]
        total_pl = _r2(sum(trade.cash_flow for trade in closed))
        rows.append(
            {
                "strategy": strategy,
                "total": len(group),
                "closed": len(closed),
                "wins": len(wins),
                "totalPL": total_pl,
                "winRate": _r2((len(wins) / len(closed)) * 100) if closed else 0,
                "avgPL": _r2(total_pl / len(closed)) if closed else 0,
            }
        )
    return rows


def _underlying_breakdown(trades: list[EnrichedTrade]) -> list[dict[str, Any]]:
    return [
        {
            "type": underlying,
            "count": len(group),
            "totalPL": _r2(sum(trade.cash_flow for trade in group)),
            "capitalAtRisk": _r2(
                sum(trade.capital_at_risk for trade in group if trade.status in {"Open", "Rolling"})
            ),
        }
        for underlying, group in _group_by(trades, "underlying_type").items()
    ]


def _dte_distribution(trades: list[EnrichedTrade]) -> dict[str, int]:
    buckets = {"expired": 0, "0-7d": 0, "8-30d": 0, "31-60d": 0, "61-90d": 0, "90d+": 0}
    for trade in trades:
        dte = trade.dte
        if dte < 0:
            buckets["expired"] += 1
        elif dte <= 7:
            buckets["0-7d"] += 1
        elif dte <= 30:
            buckets["8-30d"] += 1
        elif dte <= 60:
            buckets["31-60d"] += 1
        elif dte <= 90:
            buckets["61-90d"] += 1
        else:
            buckets["90d+"] += 1
    return buckets


def _concentration(trades: list[EnrichedTrade]) -> list[dict[str, Any]]:
    collateral = sum(trade.capital_at_risk for trade in trades)
    rows = sorted(trades, key=lambda trade: trade.capital_at_risk, reverse=True)[:5]
    return [
        {
            "id": trade.id,
            "ticker": trade.ticker,
            "strategy": trade.strategy,
            "capitalAtRisk": trade.capital_at_risk,
            "sharePct": _r2((trade.capital_at_risk / collateral) * 100) if collateral else 0,
        }
        for trade in rows
        if trade.capital_at_risk > 0
    ]


def _ticker_exposure(trades: list[EnrichedTrade]) -> list[dict[str, Any]]:
    rows = []
    for ticker, group in _group_by(trades, "ticker").items():
        wins = [trade for trade in group if trade.cash_flow > 0]
        losses = [trade for trade in group if trade.cash_flow < 0]
        total_pl = _r2(sum(trade.cash_flow for trade in group))
        rows.append(
            {
                "ticker": ticker,
                "totalPL": total_pl,
                "trades": len(group),
                "wins": len(wins),
                "losses": len(losses),
                "winRate": _r2((len(wins) / len(group)) * 100) if group else 0,
                "avgPL": _r2(total_pl / len(group)) if group else 0,
            }
        )
    return rows


def _winner_loser(trade: EnrichedTrade | None) -> dict[str, Any] | None:
    if trade is None:
        return None
    return {
        "id": trade.id,
        "ticker": trade.ticker,
        "strategy": trade.strategy,
        "pl": trade.cash_flow,
        "roi": trade.roi,
        "closedDate": trade.closed_date.isoformat() if trade.closed_date else None,
    }


def _current_streak(closed: list[EnrichedTrade]) -> dict[str, Any] | None:
    ordered = sorted(closed, key=lambda trade: trade.closed_date or date.min, reverse=True)
    if not ordered:
        return None
    first_type = "win" if ordered[0].cash_flow >= 0 else "loss"
    count = 0
    for trade in ordered:
        trade_type = "win" if trade.cash_flow >= 0 else "loss"
        if trade_type != first_type:
            break
        count += 1
    return {"type": first_type, "count": count}


def _group_by(trades: list[EnrichedTrade], attr: str) -> dict[str, list[EnrichedTrade]]:
    groups: dict[str, list[EnrichedTrade]] = defaultdict(list)
    for trade in trades:
        groups[str(getattr(trade, attr))].append(trade)
    return dict(groups)


def _open_legs(legs: list[LegLike]) -> list[LegLike]:
    return [leg for leg in legs if leg.order_type in {"BTO", "STO"}]


def _open_option_legs(legs: list[LegLike]) -> list[LegLike]:
    return [leg for leg in _open_legs(legs) if leg.type in {"CALL", "PUT"}]


def _primary_leg(legs: list[LegLike]) -> LegLike:
    for leg in legs:
        if leg.order_type == "STO" and leg.strike is not None:
            return leg
    return legs[0]


def _display_strike(legs: list[LegLike]) -> str:
    calls = sorted({leg.strike for leg in legs if leg.type == "CALL" and leg.strike is not None})
    puts = sorted({leg.strike for leg in legs if leg.type == "PUT" and leg.strike is not None})
    labels = [f"C{_fmt_strike(strike)}" for strike in calls]
    labels.extend(f"P{_fmt_strike(strike)}" for strike in sorted(puts, reverse=True))
    return " · ".join(labels)


def _fmt_strike(strike: float) -> str:
    return str(int(strike)) if float(strike).is_integer() else f"{strike:.2f}".rstrip("0")


def _quantity(legs: list[LegLike]) -> int:
    stock_shares = sum(
        leg.quantity * leg.multiplier
        for leg in legs
        if leg.type == "STOCK" and leg.order_type == "BTO"
    )
    return (
        int(abs(stock_shares))
        if stock_shares
        else int(max((leg.quantity * leg.multiplier for leg in legs), default=0))
    )


def _lifecycle_key(leg: LegLike) -> str:
    strike = f"{leg.strike:.4f}" if leg.strike is not None else ""
    return f"{leg.type}|{strike}|{leg.multiplier}"


def _sum_closed_since(trades: list[EnrichedTrade], start: date) -> float:
    return _r2(
        sum(trade.cash_flow for trade in trades if trade.closed_date and trade.closed_date >= start)
    )


def _days_before(value: date, days: int) -> date:
    return date.fromordinal(value.toordinal() - days)


def _days_between(start: date, end: date | None) -> int:
    if end is None:
        return 1
    return max(1, end.toordinal() - start.toordinal())


def _calculate_dte(expiration: date | None, *, as_of: date, status: str) -> int:
    if status in {"Closed", "Expired"} or expiration is None:
        return 0
    return max(0, expiration.toordinal() - as_of.toordinal())


def _effective_status(
    status: str, *, legs: list[LegLike], expiration: date | None, as_of: date
) -> str:
    if status not in {"Open", "Rolling"}:
        return status
    if _has_cash_settlement(legs):
        return "Closed"
    if _stock_shares(legs) > 0:
        return "Assigned"
    if _has_close_activity(legs) and _unmatched_option_exposure(legs) > 0:
        return "Rolling"
    if _unmatched_option_exposure(legs) == 0 and legs:
        return "Closed"
    if expiration is None:
        return status
    # Legacy uses 21:00 UTC on expiration day. With date-only API input, the
    # deterministic approximation is: expiration day remains active, the next
    # day becomes Expired.
    return "Expired" if expiration < as_of else status


def _r2(value: float) -> float:
    return round(float(value) + 0, 2)


def _compact(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            key: compacted
            for key, item in value.items()
            if (compacted := _compact(item)) not in (None, "")
        }
    if isinstance(value, list):
        return [_compact(item) for item in value]
    return value
