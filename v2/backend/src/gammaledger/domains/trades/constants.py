"""Canonical enum-like vocabularies. Mirrored from legacy app.js so persisted
shapes remain interchangeable in both directions."""

from typing import Final

# Persisted statuses. `awaiting_coverage` is a runtime-derived lifecycle
# sub-status only and is NOT a valid persisted value (see DOMAIN_MODEL_MAP §6).
TRADE_STATUSES: Final[tuple[str, ...]] = (
    "Open",
    "Closed",
    "Expired",
    "Assigned",
    "Rolling",
)

ORDER_TYPES: Final[tuple[str, ...]] = ("BTO", "STO", "BTC", "STC")

LEG_TYPES: Final[tuple[str, ...]] = ("CALL", "PUT", "STOCK", "CASH", "FUTURE", "ETF")

UNDERLYING_TYPES: Final[tuple[str, ...]] = ("Stock", "ETF", "Index", "Future")
