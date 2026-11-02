"""Helpers shared by the tool modules."""

from __future__ import annotations

import json
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any

from mcp.server.fastmcp.exceptions import ToolError

from .database import DatabaseError, GammaLedgerDB, get_db


def json_text(obj: object) -> str:
    """Serialise to a compact-but-readable JSON string."""
    return json.dumps(obj, indent=2, default=str)


def error_text(exc: Exception) -> str:
    return json_text({"error": True, "type": type(exc).__name__, "detail": str(exc)})


def round2(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        n = float(value)
    except (TypeError, ValueError):
        return None
    if n != n or n in (float("inf"), float("-inf")):  # NaN / Inf
        return None
    return round(n, 2)


def as_dict(value: Any) -> dict[str, Any]:
    """``value`` if it is a JSON object, else ``{}`` (a section written as null / wrong type)."""
    return value if isinstance(value, dict) else {}


def dict_rows(value: Any) -> list[dict[str, Any]]:
    """The objects in a JSON array; ``[]`` if the section is missing, null or not an array."""
    return [row for row in value if isinstance(row, dict)] if isinstance(value, list) else []


def safe_db() -> GammaLedgerDB:
    return get_db()


def ctx() -> dict[str, Any]:
    """The saved ``mcpContext``; raises MissingContextError (a DatabaseError) if absent."""
    context: dict[str, Any] = safe_db().require_mcp_context()
    return context


def data_warning() -> str | None:
    """One line telling the agent the data is old / degraded, or ``None`` when it is fine.

    Tools that answer "what is open / expiring / at risk *now*" include this so a week-old
    export is not mistaken for today's book.
    """
    try:
        found = safe_db().warnings()
    except DatabaseError:
        return None
    return " ".join(found) if found else None


def with_warning(payload: dict[str, Any]) -> dict[str, Any]:
    """Add ``dataWarning`` to a payload when there is one."""
    warning = data_warning()
    if warning:
        payload["dataWarning"] = warning
    return payload


@contextmanager
def tool_errors() -> Iterator[None]:
    """Turn database problems into an MCP error result (``isError``) for typed tools.

    Tools with a structured output schema cannot also return an ad-hoc error object, so
    they signal failure the protocol way instead.
    """
    try:
        yield
    except DatabaseError as exc:
        raise ToolError(f"{type(exc).__name__}: {exc}") from exc


def parse_field_list(fields: str) -> list[str]:
    """``"id, ticker ,pl"`` -> ``["id", "ticker", "pl"]`` (order kept, duplicates dropped)."""
    seen: dict[str, None] = {}
    for part in fields.replace(";", ",").split(","):
        name = part.strip()
        if name:
            seen.setdefault(name, None)
    return list(seen)


def is_all_fields(names: list[str]) -> bool:
    return any(n.lower() in ("*", "all") for n in names)


def project(row: dict[str, Any], names: list[str]) -> dict[str, Any]:
    """Keep only ``names`` (in that order) that exist on ``row``."""
    return {n: row[n] for n in names if n in row}
