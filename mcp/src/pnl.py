"""Server-side P&L derivation from raw trade legs.

The GammaLedger app only embeds computed per-trade P&L in ``mcpContext`` for
active positions, Wheel/PMCC positions and the 10 most recent closed trades.
The persisted ``trades`` do carry every leg (premium, quantity, multiplier,
fees), so for *closed* trades we can recompute the same number the app shows.

This is a port of the app's leg cash-flow rules (``calculateLegCashFlow`` in
``src/trades/legs.ts``). For a Closed / Expired trade the app's ``pl`` is the
net cash flow of all of its legs::

    cashFlow(leg) = (+1 if the leg sells, -1 if it buys) * |premium| * multiplier * |qty| - fees

Anything the app computes with more context (ROI needs capital-at-risk, open
and Wheel/PMCC positions need marks and cost basis) is deliberately *not*
derived here - those stay ``None`` rather than being guessed.
"""

from __future__ import annotations

import math
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

PL_SOURCE_APP = "app"
PL_SOURCE_DERIVED = "derived"

_ORDER_TYPES = ("BTO", "STO", "BTC", "STC")
_SELL_WORDS = {"SELL", "SHORT", "STO", "STC"}
_CLOSED_STATUSES = {"closed", "expired"}


def _num(value: Any) -> float:
    """JS ``Number(x) || 0``: non-numeric, NaN and infinite values become 0."""
    if value is None or isinstance(value, bool):
        return 0.0
    try:
        n = float(value)
    except (TypeError, ValueError):
        return 0.0
    return n if math.isfinite(n) else 0.0


def round2(value: float) -> float:
    """Round like JS ``Number(x.toFixed(2))`` (exact binary value, ties away from zero)."""
    if not math.isfinite(value):
        return 0.0
    return float(Decimal(value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def _normalize_order_type(raw: Any) -> str:
    value = str(raw or "").strip().upper()
    if value in _ORDER_TYPES:
        return value
    value = (
        value.replace("BUY TO OPEN", "BTO")
        .replace("SELL TO OPEN", "STO")
        .replace("BUY TO CLOSE", "BTC")
        .replace("SELL TO CLOSE", "STC")
    )
    if value in _ORDER_TYPES:
        return value
    if value.startswith("B"):
        return "BTC" if "C" in value else "BTO"
    if value.startswith("S"):
        return "STC" if "C" in value else "STO"
    return "BTO"


def _order_type_from_action_side(action: Any, side: Any) -> str:
    """Legacy legs carry ``action`` / ``side`` instead of ``orderType``."""
    act = "SELL" if str(action or "").strip().upper() in _SELL_WORDS else "BUY"
    s = str(side or "").strip().upper()
    if s.startswith("ROL"):
        return "STO" if act == "SELL" else "BTO"
    if s in ("CASH", "FUTURE", "ETF", "SHARES", "STK"):
        return "BTO"  # the app maps this "STOCK" side to its BTO default
    if s in ("CALL", "PUT", "STOCK", "BTC", "STC"):
        return "STC" if act == "SELL" else "BTC"
    return "STO" if act == "SELL" else "BTO"


def _leg_is_sell(leg: dict[str, Any]) -> bool:
    raw = leg.get("orderType") or leg.get("tradeType") or leg.get("order")
    if not raw:
        raw = _order_type_from_action_side(leg.get("action"), leg.get("side"))
    return _normalize_order_type(raw) in ("STO", "STC")


def _leg_type(leg: dict[str, Any]) -> str:
    value = str(leg.get("type") or "").strip().upper()
    return "STOCK" if value == "SHARES" else value


def _leg_multiplier(leg: dict[str, Any]) -> float:
    provided = leg.get("multiplier")
    if provided not in (None, ""):
        m = _num(provided)
        if m > 0:
            return m
    return 1.0 if _leg_type(leg) in ("STOCK", "CASH") else 100.0


def leg_cash_flow(leg: dict[str, Any]) -> float:
    """Signed cash flow of one leg (credit positive, debit negative, fees deducted)."""
    quantity = abs(_num(leg.get("quantity")))
    fees = _num(leg.get("fees"))
    if not quantity:
        return -fees
    # The order type carries the sign; a negative stored price must not flip a sale into a debit.
    premium = abs(_num(leg.get("premium")))
    if _leg_type(leg) == "STOCK" and premium == 0:
        premium = _num(leg.get("strike"))
    direction = 1.0 if _leg_is_sell(leg) else -1.0
    return direction * premium * _leg_multiplier(leg) * quantity - fees


def is_closed_status(status: Any) -> bool:
    return str(status or "").strip().lower() in _CLOSED_STATUSES


def derive_trade_pl(trade: dict[str, Any]) -> dict[str, Any] | None:
    """Realized P&L for a Closed / Expired trade, computed from its legs.

    Returns ``None`` when the number cannot be derived faithfully: the trade is
    not closed (open and Wheel/PMCC P&L depend on marks and cost basis) or it
    has no legs. The result mirrors the fields the app reports for a trade.
    """
    if not is_closed_status(trade.get("status")):
        return None
    raw_legs = trade.get("legs")
    legs = [leg for leg in raw_legs if isinstance(leg, dict)] if isinstance(raw_legs, list) else []
    if not legs:
        return None

    cash_flow = fees = debit = credit = 0.0
    for leg in legs:
        flow = leg_cash_flow(leg)
        leg_fees = _num(leg.get("fees"))
        cash_flow += flow
        fees += leg_fees
        if _leg_is_sell(leg):
            credit += abs(flow + leg_fees)
        else:
            debit += abs(flow + leg_fees)

    out: dict[str, Any] = {
        "pl": round2(cash_flow),
        "cashFlow": round2(cash_flow),
        "totalCredit": round2(credit),
        "totalDebit": round2(debit),
        "totalFees": round(fees, 4),
        "roi": None,
        "plSource": PL_SOURCE_DERIVED,
    }
    # ROI = pl / capital at risk. The app's capital-at-risk formula is strategy-specific, so we
    # only reproduce it when the user pinned an explicit maximum risk on the trade.
    override = _num(trade.get("maxRiskOverride"))
    if override > 0:
        out["roi"] = round2(out["pl"] / override * 100)
    return out
