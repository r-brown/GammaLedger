// src/calculations/daysheld.ts — Wave 3: Days held and DTE helpers.
// Uses the .call(this, …) delegation pattern.

import type { EnrichedTrade } from '@types-gl/trade'

/**
 * Minimum GammaLedger context surface required by daysheld calculations.
 * GammaLedger fulfils this interface at runtime via .call(this, …).
 * TODO Phase 3: replace with typed GammaLedger reference once src/index.ts is converted.
 */
interface DaysHeldContext {
    parseDateValue(value: unknown): Date | null
    isClosedStatus(status: string | null | undefined): boolean
    isPmccTrade(trade: EnrichedTrade): boolean
    readonly currentDate: Date
}

/** Days between a trade's entry date and its exit date (or today if still open). */
export function calculateDaysHeld(this: DaysHeldContext, trade: EnrichedTrade | null | undefined): number {
    if (!trade) {
        return 0;
    }

    const entryDate = this.parseDateValue(trade.entryDate || trade.openedDate);
    if (!entryDate) {
        return 0;
    }

    const exitCandidate = this.parseDateValue(trade.exitDate || trade.closedDate);
    const endDate = (this.isClosedStatus(trade.status) && exitCandidate) ? exitCandidate : this.currentDate;

    const diffTime = endDate.getTime() - entryDate.getTime();
    if (!Number.isFinite(diffTime) || diffTime < 0) {
        return 0;
    }

    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(1, diffDays);
}

/** Days to expiration from today. Returns 0 if already expired or trade is closed. */
export function calculateDTE(
    this: DaysHeldContext,
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

