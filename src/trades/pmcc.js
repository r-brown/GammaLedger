// src/trades/pmcc.js — Wave 3: PMCC strategy helpers.
// Uses the .call(this, …) delegation pattern.

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

/**
 * Extract the PMCC long LEAPS and short call legs from a trade.
 */
export function extractPmccLegs(trade = {}) {
    const legs = Array.isArray(trade?.legs) ? trade.legs : [];
    const longLegs = [];
    const shortLegs = [];

    legs.forEach((leg) => {
        const type = (leg.type || leg.optionType || '').toString().trim().toUpperCase();
        if (type !== 'CALL') return;
        const action = this.getLegAction(leg);
        const side = this.getLegSide(leg);
        if (action === 'BUY' && side === 'OPEN') {
            longLegs.push(leg);
        } else if (action === 'SELL' && (side === 'OPEN' || side === 'ROLL')) {
            shortLegs.push(leg);
        }
    });

    return { longLegs, shortLegs };
}
