// src/calculations/pnl.ts — Wave 3: P&L calculation helpers.
// Uses the .call(this, …) delegation pattern.

import type { DollarAmount } from '@types-gl/common'
import type { EnrichedTrade } from '@types-gl/trade'
import type { NormalizedLeg } from '@types-gl/leg'
import type { LegSummary } from '@types-gl/leg-summary'

/**
 * Minimum GammaLedger context surface required by P&L calculations.
 * GammaLedger fulfils this interface at runtime via .call(this, …).
 * TODO Phase 3: replace with typed GammaLedger reference once src/index.ts is converted.
 */
interface PnlContext {
    summarizeLegs(legs: NormalizedLeg[]): LegSummary
    computeMaxRiskUsingFormula(trade: EnrichedTrade, summary: LegSummary): number
    getCapitalAtRisk(trade: EnrichedTrade): number
    calculatePL(trade: EnrichedTrade): DollarAmount
    calculateROI(trade: EnrichedTrade): number
    calculateDaysHeld(trade: EnrichedTrade): number
    isClosedStatus(status: string | null | undefined): boolean
    isAssignedStatus(status: string | null | undefined): boolean
    hasAssignedInventory(trade: Record<string, unknown>): boolean
    parseDateValue(value: unknown): Date | null
    isPmccTrade(trade: EnrichedTrade): boolean
    calculateLegCashFlow(leg: Record<string, unknown>): number
    readonly currentDate: Date
}

/** Realized P&L derived from leg cash flows. */
export function calculatePL(this: PnlContext, trade: EnrichedTrade | null | undefined): DollarAmount {
    if (!trade) {
        return 0;
    }

    const summary = this.summarizeLegs(trade.legs || []);
    const cashFlowValue = Number.isFinite(Number(trade.cashFlow)) ? Number(trade.cashFlow) : Number(summary.cashFlow);
    if (!Number.isFinite(cashFlowValue)) {
        return 0;
    }

    return parseFloat(cashFlowValue.toFixed(2));
}

/**
 * Realized P&L for spec §4 / §10 purposes. Differs from calculatePL for
 * assigned-in-flight trades:
 *
 *   - Closed / Expired (full cycle done, including any stock leg sale):
 *     trade.pl is the canonical realized number — includes both option and
 *     stock realized P&L for closed wheels.
 *   - Assigned (option leg realized, stock still held):
 *     return only the OPTION-leg cashflows. The stock leg's debit is the
 *     cost basis of held shares, not a realized loss.
 *   - Open / Rolling: 0 (nothing realized).
 *
 * This is the value that should feed Monthly P&L charts, win-rate buckets,
 * and the realizedPL portfolio total.
 */
export function calculateRealizedPL(
    this: PnlContext,
    trade: EnrichedTrade | null | undefined
): DollarAmount {
    if (!trade) return 0;

    if (this.isClosedStatus(trade.status)) {
        const pl = Number(trade.pl);
        return Number.isFinite(pl) ? pl : 0;
    }

    if (!this.hasAssignedInventory(trade as unknown as Record<string, unknown>)) {
        return 0;
    }

    // Assigned: sum cashflows from option legs only (exclude STOCK / CASH legs).
    // The stock leg cashflow represents capital deployed into shares, not a
    // realized loss against the option premium.
    const legs = Array.isArray(trade.legs) ? trade.legs : [];
    let optionCashFlow = 0;
    for (const leg of legs) {
        const legType = ((leg?.type as string) || '').toString().trim().toUpperCase();
        if (legType === 'STOCK' || legType === 'CASH') continue;
        const cashFlow = this.calculateLegCashFlow(leg as unknown as Record<string, unknown>);
        if (Number.isFinite(cashFlow)) {
            optionCashFlow += cashFlow;
        }
    }
    return parseFloat(optionCashFlow.toFixed(2));
}

/** Return on investment as a percentage (e.g. 15.5 = 15.5%). */
export function calculateROI(this: PnlContext, trade: EnrichedTrade): number {
    const pl = this.calculatePL(trade);
    const capital = this.getCapitalAtRisk(trade);

    if (!(capital > 0)) {
        return 0;
    }

    const roiPercent = (pl / capital) * 100;
    if (!Number.isFinite(roiPercent)) {
        return 0;
    }

    return parseFloat(roiPercent.toFixed(2));
}

/** Maximum capital at risk in dollars (or Infinity for unlimited-risk strategies). */
export function calculateMaxRisk(this: PnlContext, trade: EnrichedTrade | null | undefined): DollarAmount {
    if (!trade) {
        return 0;
    }

    const overrideValue = Number(trade.maxRiskOverride);
    if (Number.isFinite(overrideValue) && overrideValue > 0) {
        return overrideValue;
    }

    const summary = this.summarizeLegs(trade.legs || []);
    const computed = this.computeMaxRiskUsingFormula(trade, summary);
    if (computed === Number.POSITIVE_INFINITY) {
        return Number.POSITIVE_INFINITY;
    }
    if (Number.isFinite(computed) && computed > 0) {
        return computed;
    }

    const stored = Number(trade.capitalAtRisk);
    if (stored === Number.POSITIVE_INFINITY) {
        return Number.POSITIVE_INFINITY;
    }
    if (Number.isFinite(stored) && stored > 0) {
        return stored;
    }

    const legacy = Number(trade.maxRisk);
    if (legacy === Number.POSITIVE_INFINITY) {
        return Number.POSITIVE_INFINITY;
    }
    if (Number.isFinite(legacy) && legacy > 0) {
        return legacy;
    }

    return 0;
}

/** Effective capital at risk — mirrors calculateMaxRisk with identical fallback logic. */
export function getCapitalAtRisk(this: PnlContext, trade: EnrichedTrade | null | undefined): DollarAmount {
    if (!trade) {
        return 0;
    }

    const overrideValue = Number(trade.maxRiskOverride);
    if (Number.isFinite(overrideValue) && overrideValue > 0) {
        return overrideValue;
    }

    const summary = this.summarizeLegs(trade.legs || []);
    const computed = this.computeMaxRiskUsingFormula(trade, summary);
    if (computed === Number.POSITIVE_INFINITY) {
        return Number.POSITIVE_INFINITY;
    }
    if (Number.isFinite(computed) && computed > 0) {
        return computed;
    }

    const stored = Number(trade.capitalAtRisk);
    if (stored === Number.POSITIVE_INFINITY) {
        return Number.POSITIVE_INFINITY;
    }
    if (Number.isFinite(stored) && stored > 0) {
        return stored;
    }

    const legacy = Number(trade.maxRisk);
    if (legacy === Number.POSITIVE_INFINITY) {
        return Number.POSITIVE_INFINITY;
    }
    if (Number.isFinite(legacy) && legacy > 0) {
        return legacy;
    }

    return 0;
}

/** Annualized ROI as a percentage (annualized over 365 days). */
export function calculateAnnualizedROI(this: PnlContext, trade: EnrichedTrade | null | undefined): number {
    if (!trade || !this.isClosedStatus(trade.status)) {
        return 0;
    }

    const roiPercent = Number.isFinite(Number(trade.roi)) ? Number(trade.roi) : this.calculateROI(trade);
    if (!Number.isFinite(roiPercent)) {
        return 0;
    }

    const daysHeldValue = Number(trade.daysHeld) || this.calculateDaysHeld(trade) || 0;
    const daysHeld = Math.max(1, daysHeldValue);
    const annualizedROI = (365 * roiPercent) / daysHeld;

    if (!Number.isFinite(annualizedROI)) {
        return 0;
    }

    return parseFloat(annualizedROI.toFixed(2));
}

/** ROI normalized to a 7-day period. */
export function calculateWeeklyROI(this: PnlContext, trade: EnrichedTrade | null | undefined): number {
    if (!trade || !this.isClosedStatus(trade.status)) {
        return 0;
    }

    const roiPercent = Number.isFinite(Number(trade.roi)) ? Number(trade.roi) : this.calculateROI(trade);
    if (!Number.isFinite(roiPercent)) {
        return 0;
    }

    const daysHeldValue = Number(trade.daysHeld) || this.calculateDaysHeld(trade) || 0;
    const daysHeld = Math.max(1, daysHeldValue);
    const weeklyROI = (7 * roiPercent) / daysHeld;

    if (!Number.isFinite(weeklyROI)) {
        return 0;
    }

    return parseFloat(weeklyROI.toFixed(2));
}

/** ROI normalized to a 30-day period. */
export function calculateMonthlyROI(this: PnlContext, trade: EnrichedTrade | null | undefined): number {
    if (!trade || !this.isClosedStatus(trade.status)) {
        return 0;
    }

    const roiPercent = Number.isFinite(Number(trade.roi)) ? Number(trade.roi) : this.calculateROI(trade);
    if (!Number.isFinite(roiPercent)) {
        return 0;
    }

    const daysHeldValue = Number(trade.daysHeld) || this.calculateDaysHeld(trade) || 0;
    const daysHeld = Math.max(1, daysHeldValue);
    const monthlyROI = (30 * roiPercent) / daysHeld;

    if (!Number.isFinite(monthlyROI)) {
        return 0;
    }

    return parseFloat(monthlyROI.toFixed(2));
}

/** Days to expiration from today. Returns 0 if already expired or trade is closed. */
export function calculateDTE(
    this: PnlContext,
    expirationDate: string | null | undefined,
    trade: EnrichedTrade
): number {
    let expDate = this.parseDateValue(expirationDate);

    if (!expDate && this.isPmccTrade(trade)) {
        const pmccExpiration = this.parseDateValue(trade?.pmccShortExpiration);
        if (pmccExpiration) {
            expDate = pmccExpiration;
        }
    }

    if (!expDate) {
        return 0;
    }

    if (this.isClosedStatus(trade.status)) {
        return 0;
    }

    const diffTime = expDate.getTime() - this.currentDate.getTime();
    if (!Number.isFinite(diffTime)) {
        return 0;
    }

    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
}

/** Days between a trade's entry date and its exit date (or today if still open). */
export function calculateDaysHeld(this: PnlContext, trade: EnrichedTrade | null | undefined): number {
    if (!trade) {
        return 0;
    }

    const entryDate = this.parseDateValue(trade.openedDate);
    if (!entryDate) {
        return 0;
    }

    const exitCandidate = this.parseDateValue(trade.closedDate);
    const endDate = (this.isClosedStatus(trade.status) && exitCandidate) ? exitCandidate : this.currentDate;

    const diffTime = endDate.getTime() - entryDate.getTime();
    if (!Number.isFinite(diffTime) || diffTime < 0) {
        return 0;
    }

    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(1, diffDays);
}
