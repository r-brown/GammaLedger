// src/payoff/pricing.js — Wave 6: Payoff pricing helpers and option math.
// Uses the .call(this, …) delegation pattern.

type AnyRecord = Record<string, any>

interface ParsedPayoffLeg {
    type: string
    action: string
    strike: number
    premium: number
    quantity: number
    raw: AnyRecord
}

interface SpreadBreakevenInput {
    model: AnyRecord
    shortStrike: number
    longStrike: number
    entryPrice: number
}

interface PriceRangeInput {
    strikeValues?: unknown[]
    spot?: number
}

export function analyzeMultiLegStrategy(this: any, trade: AnyRecord, activeLegs: AnyRecord[], strategy: string) {
    // Parse legs to extract strikes and types
    const parsedLegs = activeLegs.map((leg: AnyRecord): ParsedPayoffLeg => {
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
    }).filter((leg: ParsedPayoffLeg) =>
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

export function calculateSpreadBreakeven(this: any, { model, shortStrike, longStrike, entryPrice }: SpreadBreakevenInput) {
    if (model.orientation === 'short') {
        return model.optionType === 'call'
            ? shortStrike + entryPrice
            : shortStrike - entryPrice;
    }

    return model.optionType === 'call'
        ? longStrike + entryPrice
        : longStrike - entryPrice;
}

export function optionIntrinsic(this: any, optionType: string, price: number, strike: number) {
    if (!Number.isFinite(price) || !Number.isFinite(strike)) {
        return 0;
    }
    if (optionType === 'call') {
        return Math.max(price - strike, 0);
    }
    return Math.max(strike - price, 0);
}

export function extractPmccLegs(this: any, trade: AnyRecord = {}) {
    const normalizeTicker = (value: unknown) => (value || '').toString().trim().toUpperCase();
    const ticker = normalizeTicker(trade.ticker);
    const candidates: AnyRecord[] = ticker
        ? this.trades.filter((item: AnyRecord) => normalizeTicker(item.ticker) === ticker)
        : [];

    if (!candidates.includes(trade)) {
        candidates.push(trade);
    }

    const sortCandidates = (items: AnyRecord[] = []): AnyRecord[] => {
        return [...items].sort((a, b) => {
            const statusA = this.normalizeStatus(a.status);
            const statusB = this.normalizeStatus(b.status);
            if (statusA === 'open' && statusB !== 'open') return -1;
            if (statusA !== 'open' && statusB === 'open') return 1;
            const dateA = new Date(a.openedDate || a.openDate || 0).getTime();
            const dateB = new Date(b.openedDate || b.openDate || 0).getTime();
            return dateB - dateA;
        });
    };

    const baseCandidates = sortCandidates(candidates.filter((item: AnyRecord) => this.isPmccBaseLeg(item)));
    let baseLeg: AnyRecord | null = baseCandidates[0] || null;
    if (!baseLeg) {
        const fallbackBase = sortCandidates(candidates.filter((item: AnyRecord) => this.inferTradeDirection(item) === 'long' && (item.strategy || '').toLowerCase().includes('call')));
        baseLeg = fallbackBase[0] || (this.inferTradeDirection(trade) === 'long' ? trade : null);
    }

    const shortCandidates = sortCandidates(candidates.filter((item: AnyRecord) => this.isPmccShortCall(item)));
    let shortLeg: AnyRecord | null = shortCandidates[0] || null;
    if (!shortLeg) {
        const fallbackShort = sortCandidates(candidates.filter((item: AnyRecord) => this.inferTradeDirection(item) === 'short' && (item.strategy || '').toLowerCase().includes('call')));
        shortLeg = fallbackShort[0] || (this.inferTradeDirection(trade) === 'short' ? trade : null);
    }

    if (baseLeg && shortLeg && baseLeg === shortLeg) {
        shortLeg = null;
    }

    return { baseLeg, shortLeg };
}

export function buildPriceRange(this: any, { strikeValues = [], spot = Number.NaN }: PriceRangeInput = {}) {
    const values = strikeValues
        .map((value: unknown) => Number(value))
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

export async function getUnderlyingPriceForPayoff(this: any, trade: Record<string, unknown> = {}) {
    const ticker = ((trade?.ticker as string) || '').toString().trim().toUpperCase();

    if (ticker) {
        const cached = this.getCachedQuote(ticker);
        if (cached?.value && Number.isFinite(Number(cached.value.price))) {
            return Number(cached.value.price);
        }

        if (this.finnhub.apiKey) {
            try {
                const quote = await this.getCurrentPrice(ticker);
                const livePrice = Number(quote?.price);
                if (Number.isFinite(livePrice) && livePrice > 0) {
                    return livePrice;
                }
            } catch (error) {
                console.warn('Live price lookup failed for payoff chart:', error);
            }
        }
    }

    return this.getFallbackUnderlyingPrice(trade);
}
