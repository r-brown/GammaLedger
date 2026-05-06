// src/trades/positions.js — Wave 3: Trade position helpers and status normalization.
// Uses the .call(this, …) delegation pattern.

export function getPrimaryLeg(trade = {}) {
    if (trade.primaryLeg && trade.primaryLeg.id) {
        return this.normalizeLeg(trade.primaryLeg);
    }
    if (Array.isArray(trade.legs) && trade.legs.length > 0) {
        const candidates = trade.legs.map((leg, index) => this.normalizeLeg(leg, index));
        const firstOpen = candidates.find(leg => this.getLegSide(leg) === 'OPEN') || candidates[0];
        return firstOpen;
    }
    return null;
}

export function deriveTradeTypeFromLeg(leg) {
    if (!leg) {
        return 'BTO';
    }
    const action = this.getLegAction(leg);
    const side = this.getLegSide(leg);
    if (action === 'BUY' && side === 'OPEN') return 'BTO';
    if (action === 'SELL' && side === 'OPEN') return 'STO';
    if (action === 'SELL' && side === 'CLOSE') return 'STC';
    if (action === 'BUY' && side === 'CLOSE') return 'BTC';
    // ROLL legs inherit previous action semantics
    return action === 'SELL' ? 'STO' : 'BTO';
}

export function deriveTradeDirectionFromLeg(leg) {
    if (!leg) {
        return 'long';
    }
    const action = this.getLegAction(leg);
    if (action === 'SELL') {
        return 'short';
    }
    return 'long';
}

export function getTradeType(trade) {
    const primaryLeg = this.getPrimaryLeg(trade);
    return this.deriveTradeTypeFromLeg(primaryLeg);
}

export function inferTradeDirection(trade) {
    const primaryLeg = this.getPrimaryLeg(trade);
    return this.deriveTradeDirectionFromLeg(primaryLeg);
}

export function normalizeStatus(status) {
    return (status || '').toString().trim().toLowerCase();
}

export function normalizeTradeStatusInput(status) {
    const normalized = (status || '').toString().trim().toLowerCase();
    if (!normalized) return '';
    if (normalized === 'open') return 'Open';
    if (normalized === 'closed') return 'Closed';
    if (normalized === 'expired') return 'Expired';
    if (normalized === 'assigned') return 'Assigned';
    if (normalized === 'rolling' || normalized === 'rolled') return 'Rolling';
    return '';
}

export function isClosedStatus(status) {
    const normalized = this.normalizeStatus(status);
    return normalized === 'closed' || normalized === 'expired';
}

export function isAssignedStatus(status) {
    const normalized = this.normalizeStatus(status);
    return normalized === 'assigned';
}

export function isActiveStatus(status) {
    const normalized = this.normalizeStatus(status);
    return normalized === 'open' || normalized === 'rolling';
}

export function isAssignmentReason(reason) {
    const normalized = (reason || '').toString().trim().toLowerCase();
    return normalized.includes('assign') || normalized.includes('cash settlement');
}

/**
 * Returns true when the exit reason specifically describes a cash settlement
 * (as opposed to a physical-delivery assignment).
 */
export function isCashSettlementReason(reason) {
    const normalized = (reason || '').toString().trim().toLowerCase();
    return normalized.includes('cash settlement');
}

/**
 * Returns true when the trade contains one or more CASH settlement legs.
 */
export function isCashSettledTrade(trade = {}) {
    const legs = trade?.legs;
    if (!Array.isArray(legs)) {
        return false;
    }
    return legs.some((leg) => {
        if (this.normalizeLegType(leg?.type) !== 'CASH') {
            return false;
        }
        const orderType = this.getNormalizedLegOrderType(leg);
        return orderType === 'BTC' || orderType === 'STC';
    });
}

export function getDisplayStatus(trade) {
    if (!trade) {
        return 'Unknown';
    }

    const rawStatus = (trade.status || 'Unknown').toString().trim();
    if (!rawStatus) {
        return 'Unknown';
    }

    const normalized = rawStatus.toLowerCase();
    if (normalized === 'closed' && this.isAssignmentReason(trade.exitReason)) {
        const hasShares = this.getTradeOpenStockShares(trade) > 0;
        const hasLongCalls = this.getNetOpenLongCallContracts(trade) > 0;
        if (hasShares || hasLongCalls) {
            return 'Assigned';
        }
        return 'Closed';
    }

    if (normalized === 'assigned') return 'Assigned';
    if (normalized === 'expired') return 'Expired';
    if (normalized === 'rolling') return 'Rolling';

    return rawStatus;
}

export function normalizeUnderlyingType(type, { fallback = 'Stock' } = {}) {
    const normalized = (type || '').toString().trim().toLowerCase();
    if (['stock', 'etf', 'index', 'future'].includes(normalized)) {
        return normalized.charAt(0).toUpperCase() + normalized.slice(1);
    }
    return fallback;
}

export function isAssignmentTrade(trade = {}) {
    const status = this.normalizeStatus(trade.status);
    if (status === 'assigned') {
        return true;
    }
    return this.isAssignmentReason(trade.exitReason);
}

/**
 * Total open stock shares currently held in a trade (BUY-OPEN minus SELL legs).
 */
export function getTradeOpenStockShares(trade = {}) {
    const legs = Array.isArray(trade?.legs) ? trade.legs : [];
    if (!legs.length) return 0;
    let shares = 0;
    legs.forEach((leg) => {
        const type = (leg.type || leg.optionType || '').toString().trim().toUpperCase();
        if (type !== 'STOCK') return;
        const qty = Math.abs(Number(leg.quantity) || 0) * (this.getLegMultiplier(leg) || 1);
        if (!qty) return;
        const action = this.getLegAction(leg);
        const side = this.getLegSide(leg);
        if (action === 'BUY' && side === 'OPEN') {
            shares += qty;
        } else if (action === 'SELL') {
            shares -= qty;
        }
    });
    return Math.max(0, Math.round(shares));
}

/**
 * Net-open long call contracts (BTO open minus STC close).
 */
export function getNetOpenLongCallContracts(trade = {}) {
    const legs = Array.isArray(trade?.legs) ? trade.legs : [];
    let net = 0;
    legs.forEach((leg) => {
        const type = (leg.type || leg.optionType || '').toString().trim().toUpperCase();
        if (type !== 'CALL') return;
        const qty = Math.abs(Number(leg.quantity) || 0);
        if (!qty) return;
        const action = this.getLegAction(leg);
        const side = this.getLegSide(leg);
        if (action === 'BUY' && side === 'OPEN') net += qty;
        else if (action === 'SELL' && side === 'CLOSE') net -= qty;
    });
    return Math.max(0, net);
}

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
    // was closed via assignment.  Stock legs may live in a separate
    // trade entry when imported from Robinhood CSV, so don't require them.
    if (this.isAssignedStatus(trade.status)) {
        return true;
    }
    
    return false;
}

export function isCoveredCall(trade = {}) {
    const strategy = (trade.strategy || '').toLowerCase();
    return strategy.includes('covered call');
}

export function isPmccBaseLeg(trade = {}) {
    const strategy = (trade.strategy || '').toLowerCase();
    const direction = trade.tradeDirection || this.inferTradeDirection(trade);
    const tradeType = this.getTradeType(trade);
    return strategy.includes('poor man') && (direction === 'long' || tradeType === 'BTO');
}

export function isPmccShortCall(trade = {}) {
    const strategy = (trade.strategy || '').toLowerCase();
    const direction = trade.tradeDirection || this.inferTradeDirection(trade);
    const tradeType = this.getTradeType(trade);
    return strategy.includes('poor man') && (direction === 'short' || tradeType === 'STO');
}

export function isPmccTrade(trade = {}) {
    if (!trade) {
        return false;
    }

    const strategy = (trade.strategy || '').toLowerCase();
    if (strategy.includes('poor man') || strategy.includes('pmcc')) {
        return true;
    }

    return this.isPmccBaseLeg(trade) || this.isPmccShortCall(trade);
}

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

export function isAwaitingCoverage(trade = {}) {
    const cov = this.getTradeWheelCoverage(trade);
    return cov === 'uncovered' || cov === 'partial';
}

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
