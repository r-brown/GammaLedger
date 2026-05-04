"""Consistent response shapes.

Success: { "data": ..., "meta": {...} }
Error:   { "error": { "code": ..., "message": ..., "detail": {...} } }

The router layer raises domain exceptions; an exception handler maps them to
the error envelope. Routers themselves wrap success returns via `envelope()`.
"""

from typing import Any


def envelope(data: Any, meta: dict[str, Any] | None = None) -> dict[str, Any]:
    out: dict[str, Any] = {"data": data}
    if meta is not None:
        out["meta"] = meta
    return out


def error(code: str, message: str, detail: dict[str, Any] | None = None) -> dict[str, Any]:
    body: dict[str, Any] = {"code": code, "message": message}
    if detail:
        body["detail"] = detail
    return {"error": body}
