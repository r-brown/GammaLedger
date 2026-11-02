"""Risk views and audits: concentration, expiring positions, risk and Wheel/PMCC audits."""

from __future__ import annotations

from typing import Any, TypeGuard

from mcp.server.fastmcp import FastMCP

from .common import as_dict, ctx, dict_rows, error_text, json_text, round2, with_warning
from .database import DatabaseError


def _is_number(value: Any) -> TypeGuard[float]:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def register(mcp: FastMCP) -> None:
    @mcp.tool(structured_output=False)
    def gammaledger_concentration_risk() -> str:
        """Return the top concentrated active positions by capital at risk,
        with each position's share of total collateral as a percentage.
        """
        try:
            context = ctx()
            return json_text(
                {
                    "collateralAtRisk": as_dict(as_dict(context.get("portfolio")).get("risk")).get(
                        "collateralAtRisk"
                    ),
                    "topPositions": dict_rows(context.get("concentration")),
                }
            )
        except DatabaseError as exc:
            return error_text(exc)

    @mcp.tool(structured_output=False)
    def gammaledger_expiring_positions(within_days: int = 7) -> str:
        """Return active positions expiring within N days, sorted by DTE ascending.

        DTE is as of the export date; check `dataWarning` when present.

        Args:
            within_days: Look-ahead window in days (default 7, max 365).
        """
        try:
            within = max(0, min(int(within_days), 365))
            positions = dict_rows(ctx().get("activePositions"))

            expiring = [
                p for p in positions if _is_number(p.get("dte")) and 0 <= p["dte"] <= within
            ]
            expiring.sort(key=lambda p: p.get("dte", 0))

            total_capital = sum(round2(p.get("capitalAtRisk")) or 0 for p in expiring)
            total_pl = sum(round2(p.get("pl")) or 0 for p in expiring)

            return json_text(
                with_warning(
                    {
                        "withinDays": within,
                        "count": len(expiring),
                        "totalCapitalAtRisk": round(total_capital, 2),
                        "totalUnrealizedPL": round(total_pl, 2),
                        "positions": expiring,
                    }
                )
            )
        except DatabaseError as exc:
            return error_text(exc)

    @mcp.tool(structured_output=False)
    def gammaledger_audit_risk() -> str:
        """Comprehensive risk audit: drawdown, concentration, expiring,
        underwater positions, Wheel/PMCC coverage gaps. Returns structured
        findings grouped by severity (high / watch / healthy).
        """
        try:
            context = ctx()
            portfolio = as_dict(context.get("portfolio"))
            risk_metrics = as_dict(portfolio.get("risk"))
            perf = as_dict(portfolio.get("performance"))

            findings_high: list[dict[str, Any]] = []
            findings_watch: list[dict[str, Any]] = []
            findings_healthy: list[str] = []

            # Concentration
            concentration = dict_rows(context.get("concentration"))
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
            active = dict_rows(context.get("activePositions"))
            expiring_7 = [p for p in active if _is_number(p.get("dte")) and 0 <= p["dte"] <= 7]
            expiring_30 = [p for p in active if _is_number(p.get("dte")) and 7 < p["dte"] <= 30]
            if expiring_7:
                findings_high.append(
                    {
                        "kind": "expiring_7d",
                        "count": len(expiring_7),
                        "totalCapitalAtRisk": round(
                            sum(round2(p.get("capitalAtRisk")) or 0 for p in expiring_7), 2
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
                findings_watch.append({"kind": "expiring_30d", "count": len(expiring_30)})

            # Still active but past expiration (negative DTE) — needs closing out in the app
            expired_active = [p for p in active if _is_number(p.get("dte")) and p["dte"] < 0]
            if expired_active:
                findings_watch.append(
                    {
                        "kind": "past_expiration_still_active",
                        "count": len(expired_active),
                        "positions": [
                            {
                                "trade_id": p.get("id"),
                                "ticker": p.get("ticker"),
                                "strategy": p.get("strategy"),
                                "dte": p.get("dte"),
                            }
                            for p in expired_active
                        ],
                    }
                )

            # Undefined-risk positions
            unlimited = [p for p in active if p.get("riskIsUnlimited")]
            if unlimited:
                findings_watch.append(
                    {
                        "kind": "unlimited_risk",
                        "count": len(unlimited),
                        "positions": [
                            {
                                "trade_id": p.get("id"),
                                "ticker": p.get("ticker"),
                                "strategy": p.get("strategy"),
                            }
                            for p in unlimited
                        ],
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
            for pos in dict_rows(context.get("wheelPmccPositions")):
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
            elif dict_rows(context.get("wheelPmccPositions")):
                findings_healthy.append("All Wheel/PMCC positions are fully covered.")

            # Drawdown context
            max_dd = perf.get("maxDrawdown")
            if _is_number(max_dd) and max_dd > 20:
                findings_watch.append({"kind": "high_max_drawdown", "maxDrawdownPct": max_dd})

            return json_text(
                with_warning(
                    {
                        "asOfDate": context.get("asOfDate"),
                        "summary": {
                            "collateralAtRisk": risk_metrics.get("collateralAtRisk"),
                            "totalMaxRisk": risk_metrics.get("totalMaxRisk"),
                            "maxDrawdown": perf.get("maxDrawdown"),
                            "sharpeRatio": perf.get("sharpeRatio"),
                            "activePositions": as_dict(portfolio.get("counts")).get("active"),
                            "expiringWithin7d": len(expiring_7),
                            "underwaterOpen": len(underwater),
                        },
                        "high": findings_high,
                        "watch": findings_watch,
                        "healthy": findings_healthy,
                    }
                )
            )
        except DatabaseError as exc:
            return error_text(exc)

    @mcp.tool(structured_output=False)
    def gammaledger_audit_wheel_pmcc() -> str:
        """Audit Wheel and PMCC positions — flags coverage gaps, cost-basis
        awareness, and premium-collection effectiveness.
        """
        try:
            positions = dict_rows(ctx().get("wheelPmccPositions"))

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
                    _is_number(strike)
                    and _is_number(effective_basis)
                    and effective_basis >= strike * 0.98
                ):
                    cost_basis_concerns.append(entry)
                    continue

                healthy.append(entry)

            return json_text(
                {
                    "totalPositions": len(positions),
                    "coverageGaps": gaps,
                    "costBasisConcerns": cost_basis_concerns,
                    "healthy": healthy,
                }
            )
        except DatabaseError as exc:
            return error_text(exc)
