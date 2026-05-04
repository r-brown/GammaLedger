"""Port of the load-bearing pnl primitives from legacy app.js.

These four functions are the foundation every other metric builds on —
they MUST produce numerically identical output to the JS originals.
Golden parity tests live in tests/test_parity.py.

References (legacy):
- calculateLegCashFlow → app.js:1935
- summarizeLegs       → app.js:1958 (partial port — Phase 2 adds the rest)
- calculatePL         → app.js:4880
- totalFees           → derived from summarizeLegs
"""

from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any, cast


@dataclass(frozen=True, slots=True)
class LegLike:
    """Plain-data leg view used by the calc functions, decoupled from
    SQLModel and Pydantic. Build from either source via from_*() helpers."""

    order_type: str
    type: str
    quantity: float
    multiplier: float
    strike: float | None
    premium: float
    fees: float


def leg_cash_flow(leg: LegLike) -> float:
    """Port of calculateLegCashFlow (app.js:1935):

    direction = (action === 'SELL') ? +1 : -1     # STO/STC = +1, BTO/BTC = -1
    if type==STOCK and premium==0: premium = strike
    return direction * premium * multiplier * quantity - fees
    """
    direction = 1 if leg.order_type in ("STO", "STC") else -1
    premium = leg.premium
    if leg.type == "STOCK" and premium == 0 and leg.strike is not None:
        premium = leg.strike
    return direction * premium * leg.multiplier * leg.quantity - leg.fees


@dataclass(frozen=True, slots=True)
class LegSummary:
    cash_flow: float
    total_fees: float
    total_credit: float  # gross opening credit (STO opens)
    total_debit: float  # gross opening debit (BTO opens)
    open_contracts: float
    close_contracts: float
    open_cash_flow: float
    close_cash_flow: float
    entry_price: float | None  # openCreditGross / openBaseContracts
    exit_price: float | None  # closeCashFlow / closeContracts


def summarize_legs(legs: Iterable[LegLike]) -> LegSummary:
    """Partial port of summarizeLegs (app.js:1958).

    Phase 1 covers cashflow, fees, credit/debit grosses, contract counts,
    and entry/exit prices — enough for calculate_pl() and the parity tests.

    Phase 2 will add: nearestShortCallExpiration, nextShortCallExpiration
    (LIFO via shortCallPositions), latestExpiration, openedDate, closedDate.
    """
    cash_flow = 0.0
    total_fees = 0.0
    total_credit = 0.0  # opening credits (STO opens) gross of fees
    total_debit = 0.0  # opening debits (BTO opens) gross of fees
    open_contracts = 0.0
    close_contracts = 0.0
    open_cash_flow = 0.0
    close_cash_flow = 0.0
    open_credit_gross = 0.0  # gross cash for STO opens, fees-excluded
    open_base_contracts = 0.0  # contracts on the opening side, normalized

    for leg in legs:
        cf = leg_cash_flow(leg)
        cash_flow += cf
        total_fees += leg.fees

        is_open = leg.order_type in ("BTO", "STO")
        is_close = leg.order_type in ("BTC", "STC")
        is_sell = leg.order_type in ("STO", "STC")

        # gross-of-fees magnitude on this leg
        premium = leg.premium
        if leg.type == "STOCK" and premium == 0 and leg.strike is not None:
            premium = leg.strike
        gross = premium * leg.multiplier * leg.quantity

        if is_open:
            open_contracts += leg.quantity
            open_cash_flow += cf
            if is_sell:
                total_credit += gross
                open_credit_gross += gross
                open_base_contracts += leg.quantity
            else:
                total_debit += gross
                # debit opens still anchor entry_price for long strategies
                open_credit_gross += gross
                open_base_contracts += leg.quantity
        elif is_close:
            close_contracts += leg.quantity
            close_cash_flow += cf

    entry_price = (
        open_credit_gross / open_base_contracts / _multiplier_or_1(legs)
        if open_base_contracts > 0
        else None
    )
    # Note: legacy entry_price uses per-contract-credit semantics. For
    # multi-leg trades with mixed multipliers this is approximate; the
    # legacy code uses the same approximation. Parity is what we need.
    exit_price = (
        close_cash_flow / close_contracts / _multiplier_or_1(legs) if close_contracts > 0 else None
    )

    return LegSummary(
        cash_flow=cash_flow,
        total_fees=total_fees,
        total_credit=total_credit,
        total_debit=total_debit,
        open_contracts=open_contracts,
        close_contracts=close_contracts,
        open_cash_flow=open_cash_flow,
        close_cash_flow=close_cash_flow,
        entry_price=entry_price,
        exit_price=exit_price,
    )


def _multiplier_or_1(legs: Iterable[LegLike]) -> float:
    """The legacy entry_price formula divides by multiplier per the JS
    semantics. We mirror that: pick the first opening leg's multiplier
    or default to 1."""
    for leg in legs:
        if leg.order_type in ("BTO", "STO"):
            return leg.multiplier or 1.0
    return 1.0


def calculate_pl(legs: Iterable[LegLike]) -> float:
    """Port of calculatePL (app.js:4880).

    Returns the realized P&L rounded to 2 decimal places. Mark-to-market
    override for held Wheel/PMCC positions (DOMAIN_MODEL_MAP §7) lives in
    a separate higher-level function in Phase 2 — this is just the raw
    cashflow number.
    """
    summary = summarize_legs(legs)
    return round(summary.cash_flow, 2)


def total_fees(legs: Iterable[LegLike]) -> float:
    return round(summarize_legs(legs).total_fees, 2)


# --- adapters --------------------------------------------------------------


def from_dict(d: dict[str, object]) -> LegLike:
    """Build a LegLike from a v2.5 JSON leg dict (camelCase)."""
    return LegLike(
        order_type=str(d["orderType"]),
        type=str(d["type"]),
        quantity=_float(d["quantity"]),
        multiplier=_float(d["multiplier"]),
        strike=None if d.get("strike") in (None, "") else _float(d["strike"]),
        premium=_float(d.get("premium"), default=0.0),
        fees=_float(d.get("fees"), default=0.0),
    )


def _float(value: object, *, default: float | None = None) -> float:
    if value in (None, "") and default is not None:
        return default
    return float(cast(Any, value))


def from_orm(leg: object) -> LegLike:
    """Build a LegLike from a SQLModel Leg instance."""
    return LegLike(
        order_type=leg.order_type,  # type: ignore[attr-defined]
        type=leg.type,  # type: ignore[attr-defined]
        quantity=float(leg.quantity),  # type: ignore[attr-defined]
        multiplier=float(leg.multiplier),  # type: ignore[attr-defined]
        strike=leg.strike,  # type: ignore[attr-defined]
        premium=float(leg.premium),  # type: ignore[attr-defined]
        fees=float(leg.fees),  # type: ignore[attr-defined]
    )
