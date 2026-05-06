// src/payoff/pricing.js — Wave 6: Payoff pricing helpers and option math.
// Uses the .call(this, …) delegation pattern.

export function analyzeMultiLegStrategy(trade, activeLegs, strategy) {
    // Parse legs to extract strikes and types
    const parsedLegs = activeLegs.map(leg => {
        const action = this.getLegAction(leg);
        const type = (leg.type || leg.optionType || '').toString().trim().toUpperCase();
        const strike = Number(leg.strike);
        const premium = Number(leg.premium) || 0;
        const quantity = Math.abs(Number(leg.quantity) || 1);
        
        return {
            type,
            action,
            strike,
            premium,
            quantity,
            raw: leg
        };
    }).filter(leg => 
        (leg.type === 'CALL' || leg.type === 'PUT') && 
        Number.isFinite(leg.strike) && 
        leg.strike > 0
    );

    if (parsedLegs.length < 2) {
        return null;
    }

    // Group by option type
    const calls = parsedLegs.filter(leg => leg.type === 'CALL');
    const puts = parsedLegs.filter(leg => leg.type === 'PUT');

    // Vertical spread detection (2 legs, same type, different strikes)
    if (parsedLegs.length === 2 && (calls.length === 2 || puts.length === 2)) {
        const legs = calls.length === 2 ? calls : puts;
        const optionType = calls.length === 2 ? 'call' : 'put';
        const [leg1, leg2] = legs;
        
        if (leg1.action !== leg2.action) { // One buy, one sell
            const longLeg = leg1.action === 'BUY' ? leg1 : leg2;
            const shortLeg = leg1.action === 'SELL' ? leg1 : leg2;
            
            const width = Math.abs(longLeg.strike - shortLeg.strike);
            const isDebit = longLeg.strike < shortLeg.strike;
            
            return {
                type: 'multi-leg',
                subtype: 'vertical',
                optionType,
                orientation: isDebit ? 'long' : 'short',
                legs: parsedLegs,
                strategy
            };
        }
    }

    // Generic multi-leg payoff (2+ legs)
    return {
        type: 'multi-leg',
        subtype: 'generic',
        legs: parsedLegs,
        strategy
    };
}

export function calculateSpreadBreakeven({ model, shortStrike, longStrike, entryPrice }) {
    if (model.orientation === 'short') {
        return model.optionType === 'call'
            ? shortStrike + entryPrice
            : shortStrike - entryPrice;
    }

    return model.optionType === 'call'
        ? longStrike + entryPrice
        : longStrike - entryPrice;
}

export function optionIntrinsic(optionType, price, strike) {
    if (!Number.isFinite(price) || !Number.isFinite(strike)) {
        return 0;
    }
    if (optionType === 'call') {
        return Math.max(price - strike, 0);
    }
    return Math.max(strike - price, 0);
}

export function extractPmccLegs(trade = {}) {
    const normalizeTicker = (value) => (value || '').toString().trim().toUpperCase();
    const ticker = normalizeTicker(trade.ticker);
    const candidates = ticker
        ? this.trades.filter(item => normalizeTicker(item.ticker) === ticker)
        : [];

    if (!candidates.includes(trade)) {
        candidates.push(trade);
    }

    const sortCandidates = (items = []) => {
        return [...items].sort((a, b) => {
            const statusA = this.normalizeStatus(a.status);
            const statusB = this.normalizeStatus(b.status);
            if (statusA === 'open' && statusB !== 'open') return -1;
            if (statusA !== 'open' && statusB === 'open') return 1;
            const dateA = new Date(a.entryDate || a.openDate || 0).getTime();
            const dateB = new Date(b.entryDate || b.openDate || 0).getTime();
            return dateB - dateA;
        });
    };

    const baseCandidates = sortCandidates(candidates.filter(item => this.isPmccBaseLeg(item)));
    let baseLeg = baseCandidates[0];
    if (!baseLeg) {
        const fallbackBase = sortCandidates(candidates.filter(item => this.inferTradeDirection(item) === 'long' && (item.strategy || '').toLowerCase().includes('call')));
        baseLeg = fallbackBase[0] || (this.inferTradeDirection(trade) === 'long' ? trade : null);
    }

    const shortCandidates = sortCandidates(candidates.filter(item => this.isPmccShortCall(item)));
    let shortLeg = shortCandidates[0];
    if (!shortLeg) {
        const fallbackShort = sortCandidates(candidates.filter(item => this.inferTradeDirection(item) === 'short' && (item.strategy || '').toLowerCase().includes('call')));
        shortLeg = fallbackShort[0] || (this.inferTradeDirection(trade) === 'short' ? trade : null);
    }

    if (baseLeg && shortLeg && baseLeg === shortLeg) {
        shortLeg = null;
    }

    return { baseLeg, shortLeg };
}

export function buildPriceRange({ strikeValues = [], spot = Number.NaN } = {}) {
    const values = strikeValues
        .map(value => Number(value))
        .filter(Number.isFinite);

    if (Number.isFinite(spot)) {
        values.push(spot);
    }

    if (values.length === 0) {
        return { minPrice: 0, maxPrice: 100 };
    }

    let minPrice = Math.max(Math.min(...values), 0);
    let maxPrice = Math.max(...values);

    if (minPrice === maxPrice) {
        minPrice = Math.max(0, minPrice * 0.7);
        maxPrice = maxPrice * 1.3 + 1;
    } else {
        const span = maxPrice - minPrice;
        minPrice = Math.max(0, minPrice - span * 0.3);
        maxPrice = maxPrice + span * 0.3;
    }

    if (maxPrice - minPrice < 5) {
        minPrice = Math.max(0, minPrice - 2.5);
        maxPrice = maxPrice + 2.5;
    }

    return { minPrice, maxPrice };
}
