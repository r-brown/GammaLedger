"""AI assistant service.

External Gemini calls are feature-flagged. With the flag off or without a
server-side key, responses are produced by a deterministic local analyst so
local mode never leaks portfolio data.
"""

from __future__ import annotations

import json
from typing import Any

import httpx

from ... import config

GEMINI_TEMPERATURE = 0.25


def feature_flags() -> dict[str, bool]:
    return {
        "externalCallsEnabled": config.AI_EXTERNAL_CALLS_ENABLED,
        "geminiConfigured": bool(config.GEMINI_API_KEY),
    }


async def analyze_with_ai(
    *,
    user_message: str,
    context: dict[str, Any],
    history: list[dict[str, str]],
) -> tuple[str, str, bool]:
    if config.AI_EXTERNAL_CALLS_ENABLED and config.GEMINI_API_KEY:
        return await _gemini_response(user_message=user_message, context=context, history=history)
    return _local_response(user_message=user_message, context=context), "local", False


async def _gemini_response(
    *, user_message: str, context: dict[str, Any], history: list[dict[str, str]]
) -> tuple[str, str, bool]:
    contents = [
        {
            "role": "user" if item["role"] == "user" else "model",
            "parts": [{"text": item["content"]}],
        }
        for item in history[-8:]
    ]
    prompt = _prompt(user_message=user_message, context=context)
    contents.append({"role": "user", "parts": [{"text": prompt}]})
    url = f"{config.GEMINI_ENDPOINT}/{config.GEMINI_MODEL}:generateContent"
    payload = {
        "contents": contents,
        "generationConfig": {
            "maxOutputTokens": config.GEMINI_MAX_TOKENS,
            "temperature": GEMINI_TEMPERATURE,
        },
    }
    async with httpx.AsyncClient(timeout=120) as client:
        response = await client.post(
            url,
            params={"key": config.GEMINI_API_KEY},
            headers={"x-goog-api-key": config.GEMINI_API_KEY},
            json=payload,
        )
        response.raise_for_status()
    data = response.json()
    if data.get("promptFeedback", {}).get("blockReason"):
        raise ValueError(f"Gemini blocked prompt: {data['promptFeedback']['blockReason']}")
    parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
    text = "\n".join(str(part.get("text", "")) for part in parts).strip()
    return text or "No Gemini response text returned.", "gemini", True


def _prompt(*, user_message: str, context: dict[str, Any]) -> str:
    return (
        "You are GammaLedger's portfolio coach. Use only the supplied portfolio data. "
        "Be concise, practical, and include risk caveats when relevant.\n\n"
        f"# USER REQUEST\n{user_message}\n\n"
        f"# PORTFOLIO DATA\n{json.dumps(context, indent=2, sort_keys=True)}"
    )


def _local_response(*, user_message: str, context: dict[str, Any]) -> str:
    portfolio = context.get("portfolio", {})
    counts = portfolio.get("counts", {})
    pl = portfolio.get("pl", {})
    risk = portfolio.get("risk", {})
    performance = portfolio.get("performance", {})
    concentration = context.get("concentration", [])
    expiring = [
        row
        for row in context.get("activePositions", [])
        if row.get("dte") is not None and row["dte"] <= 14
    ]
    lines = [
        "Local AI review",
        f"- Trades: {counts.get('totalTrades', 0)} total, {counts.get('active', 0)} active, {counts.get('awaitingCoverage', 0)} awaiting coverage.",
        f"- P&L: total ${pl.get('total', 0):,.2f}, YTD ${pl.get('ytd', 0):,.2f}, MTD ${pl.get('mtd', 0):,.2f}.",
        f"- Win rate: {performance.get('winRate', 0)}%; collateral at risk ${risk.get('collateralAtRisk', 0):,.2f}.",
    ]
    if concentration:
        top = concentration[0]
        lines.append(
            f"- Largest concentration: {top.get('ticker')} {top.get('strategy')} at {top.get('sharePct', 0)}% of collateral."
        )
    if expiring:
        tickers = ", ".join(f"{row['ticker']} ({row.get('dte')}d)" for row in expiring[:5])
        lines.append(f"- Near-term expirations to inspect: {tickers}.")
    if "risk" in user_message.lower():
        lines.append(
            "- Risk focus: check concentration, uncovered Wheel shares, and positions inside 14 DTE first."
        )
    else:
        lines.append(
            "- Next step: review open positions by DTE and update notes for any trade without a clear exit plan."
        )
    return "\n".join(lines)
