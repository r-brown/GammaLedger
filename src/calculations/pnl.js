// src/calculations/pnl.js — Wave 3: P&L calculation helpers.
// Uses the .call(this, …) delegation pattern.

// Realized P&L derived from leg cash flows
export function calculatePL(trade) {
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

// Fixed ROI calculation
export function calculateROI(trade) {
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

// Enhanced Max Risk calculation
export function calculateMaxRisk(trade) {
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

export function getCapitalAtRisk(trade) {
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

// VERIFIED: Annualized ROI calculation
export function calculateAnnualizedROI(trade) {
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

// Weekly ROI calculation: (premium_received / collateral_used) × (7 / days_held)
export function calculateWeeklyROI(trade) {
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

// Monthly ROI calculation: (premium_received / collateral_used) × (30 / days_held)
export function calculateMonthlyROI(trade) {
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

export function calculateDTE(expirationDate, trade) {
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

export function calculateDaysHeld(trade) {
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
