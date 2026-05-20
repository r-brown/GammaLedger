// src/trades/pmcc.ts — Wave 3: PMCC strategy helpers.
// Uses the .call(this, …) delegation pattern.

interface PmccContext {
  inferTradeDirection(trade: Record<string, unknown>): string
  getTradeType(trade: Record<string, unknown>): string
  getLegAction(leg: Record<string, unknown>): string
  getLegSide(leg: Record<string, unknown>): string
  isPmccBaseLeg(trade: Record<string, unknown>): boolean
  isPmccShortCall(trade: Record<string, unknown>): boolean
}

export function isPmccBaseLeg(this: PmccContext, trade: Record<string, unknown> = {}): boolean {
    const strategy = ((trade.strategy as string) || '').toLowerCase();
    const direction = (trade.tradeDirection as string) || this.inferTradeDirection(trade);
    const tradeType = this.getTradeType(trade);
    return strategy.includes('poor man') && (direction === 'long' || tradeType === 'BTO');
}

export function isPmccShortCall(this: PmccContext, trade: Record<string, unknown> = {}): boolean {
    const strategy = ((trade.strategy as string) || '').toLowerCase();
    const direction = (trade.tradeDirection as string) || this.inferTradeDirection(trade);
    const tradeType = this.getTradeType(trade);
    return strategy.includes('poor man') && (direction === 'short' || tradeType === 'STO');
}

export function isPmccTrade(this: PmccContext, trade: Record<string, unknown> = {}): boolean {
    if (!trade) {
        return false;
    }

    const strategy = ((trade.strategy as string) || '').toLowerCase();
    if (strategy.includes('poor man') || strategy.includes('pmcc')) {
        return true;
    }

    return this.isPmccBaseLeg(trade) || this.isPmccShortCall(trade);
}

/**
 * Extract the PMCC long LEAPS and short call legs from a trade.
 */
export function extractPmccLegs(
    this: PmccContext,
    trade: Record<string, unknown> = {}
): { longLegs: Record<string, unknown>[]; shortLegs: Record<string, unknown>[] } {
    const legs = Array.isArray(trade?.legs) ? (trade.legs as Record<string, unknown>[]) : [];
    const longLegs: Record<string, unknown>[] = [];
    const shortLegs: Record<string, unknown>[] = [];

    legs.forEach((leg) => {
        const type = ((leg.type as string) || (leg.optionType as string) || '').toString().trim().toUpperCase();
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
