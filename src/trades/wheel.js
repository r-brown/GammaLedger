// src/trades/wheel.js — Wave 3: Wheel and PMCC strategy helpers.
// Uses the .call(this, …) delegation pattern.

export function isWheelPut(trade = {}) {
    const strategy = (trade.strategy || '').toLowerCase();
    return strategy.includes('cash-secured put');
}

export function isWheelTrade(trade = {}) {
    const strategy = (trade.strategy || '').toString().trim().toLowerCase();
    return strategy.includes('wheel');
}

export function isWheelOrPmccTrade(trade = {}) {
    if (this.isWheelTrade(trade) || this.isPmccTrade(trade)) {
        return true;
    }

    // Cash-settled trades (VIX, SPX, etc.) are never Wheel/PMCC —
    // they close via cash payment, not share delivery.
    if (this.isCashSettledTrade(trade)) {
        return false;
    }

    // Assigned trades are inherently wheel trades — the short option
    // was closed via assignment.
    if (this.isAssignedStatus(trade.status)) {
        return true;
    }

    return false;
}

export function isCoveredCall(trade = {}) {
    const strategy = (trade.strategy || '').toLowerCase();
    return strategy.includes('covered call');
}

/**
 * Coverage status for a wheel/PMCC position.
 * Returns 'covered' | 'partial' | 'uncovered' | 'n/a'.
 */
export function getTradeWheelCoverage(trade = {}) {
    const isWheelPmcc = this.isWheelOrPmccTrade(trade) || this.isAssignmentTrade(trade);
    if (!isWheelPmcc) return 'n/a';

    const isPmcc = this.isPmccTrade(trade);
    const baseShares = isPmcc
        ? this.getNetOpenLongCallContracts(trade) * 100
        : this.getTradeOpenStockShares(trade);
    if (baseShares <= 0) return 'n/a';

    const legs = Array.isArray(trade?.legs) ? trade.legs : [];
    const shortInfo = this.getNetOpenShortCalls(legs);
    const coveredShares = (Number(shortInfo?.contracts) || 0) * 100;
    if (coveredShares >= baseShares) return 'covered';
    if (coveredShares > 0) return 'partial';
    return 'uncovered';
}

/**
 * True when a wheel/PMCC trade is assigned (shares held) but coverage is not full.
 */
export function isAwaitingCoverage(trade = {}) {
    const cov = this.getTradeWheelCoverage(trade);
    return cov === 'uncovered' || cov === 'partial';
}

/**
 * Lightweight per-trade cost-basis math for wheel/PMCC awaiting-coverage positions.
 */
export function computeWheelEffectiveCostBasis(trade = {}) {
    const legs = Array.isArray(trade?.legs) ? trade.legs : [];
    const isPmcc = this.isPmccTrade(trade);

    let stockShares = 0;
    let stockCost = 0;
    let optionCashFlow = 0;
    let longCallCost = 0;
    let shortCallNet = 0;
    let longCallShares = 0;

    legs.forEach((leg) => {
        const type = (leg.type || leg.optionType || '').toString().trim().toUpperCase();
        const action = this.getLegAction(leg);
        const side = this.getLegSide(leg);
        const qty = Math.abs(Number(leg.quantity) || 0);
        const mult = this.getLegMultiplier(leg) || 1;
        const cashFlow = Number(this.calculateLegCashFlow(leg)) || 0;

        if (type === 'STOCK') {
            if (action === 'BUY' && side === 'OPEN') {
                stockShares += qty * mult;
                stockCost += Math.abs(cashFlow);
            } else if (action === 'SELL') {
                stockShares -= qty * mult;
            }
            return;
        }

        if (type !== 'CALL' && type !== 'PUT') return;

        if (isPmcc && type === 'CALL' && action === 'BUY' && side === 'OPEN') {
            longCallCost += Math.abs(cashFlow);
            longCallShares += qty * (mult || 100);
            return;
        }
        if (isPmcc && type === 'CALL') {
            shortCallNet += cashFlow;
            return;
        }
        optionCashFlow += cashFlow;
    });

    if (isPmcc) {
        // Prefer net-open long call count (× 100) so a closed LEAP zeroes out.
        const netLongShares = this.getNetOpenLongCallContracts(trade) * 100;
        const shares = netLongShares > 0
            ? netLongShares
            : (stockShares > 0 ? stockShares : longCallShares);
        const effectiveCostBasis = longCallCost - shortCallNet;
        return {
            shares: Math.max(0, Math.round(shares)),
            assignmentCostBasis: longCallCost,
            effectiveCostBasis
        };
    }

    const shares = Math.max(0, Math.round(stockShares));
    return {
        shares,
        assignmentCostBasis: stockCost,
        effectiveCostBasis: stockCost - optionCashFlow
    };
}

export function calculateOptionPremium(trade = {}) {
    const quantity = Math.abs(Number(trade.quantity) || 0);
    if (!quantity) {
        return 0;
    }
    const entryPrice = Number(trade.entryPrice) || 0;
    const exitPrice = Number(trade.exitPrice) || 0;
    const fees = Number(trade.fees) || 0;
    const gross = (entryPrice - exitPrice) * quantity * 100;
    const direction = trade.tradeDirection || this.inferTradeDirection(trade);
    if (direction === 'short') {
        return gross - fees;
    }
    return (exitPrice - entryPrice) * quantity * 100 - fees;
}
