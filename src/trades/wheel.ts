// src/trades/wheel.ts — Wave 3: Wheel and PMCC strategy helpers.
// Uses the .call(this, …) delegation pattern.

interface WheelContext {
  isWheelTrade(trade: Record<string, unknown>): boolean
  isPmccTrade(trade: Record<string, unknown>): boolean
  isCashSettledTrade(trade: Record<string, unknown>): boolean
  isAssignmentTrade(trade: Record<string, unknown>): boolean
  getNetOpenLongCallContracts(trade: Record<string, unknown>): number
  getTradeOpenStockShares(trade: Record<string, unknown>): number
  getNetOpenShortCalls(legs: Record<string, unknown>[]): { contracts: number; details: unknown[] }
  getLegAction(leg: Record<string, unknown>): string
  getLegSide(leg: Record<string, unknown>): string
  getLegMultiplier(leg: Record<string, unknown>): number
  calculateLegCashFlow(leg: Record<string, unknown>): number
  inferTradeDirection(trade: Record<string, unknown>): string
  // Self-referential
  isWheelOrPmccTrade(trade: Record<string, unknown>): boolean
  getTradeWheelCoverage(trade: Record<string, unknown>): string
}

export function isWheelPut(this: WheelContext, trade: Record<string, unknown> = {}): boolean {
    const strategy = ((trade.strategy as string) || '').toLowerCase();
    return strategy.includes('cash-secured put');
}

export function isWheelTrade(this: WheelContext, trade: Record<string, unknown> = {}): boolean {
    const strategy = ((trade.strategy as string) || '').toString().trim().toLowerCase();
    return strategy.includes('wheel');
}

export function isWheelOrPmccTrade(this: WheelContext, trade: Record<string, unknown> = {}): boolean {
    if (this.isWheelTrade(trade) || this.isPmccTrade(trade)) {
        return true;
    }

    // Cash-settled trades (VIX, SPX, etc.) are never Wheel/PMCC —
    // they close via cash payment, not share delivery.
    if (this.isCashSettledTrade(trade)) {
        return false;
    }

    // Trades that had an assignment event are inherently wheel trades —
    // the short option was closed via share assignment. Read the lifecycle
    // event rather than the (possibly promoted) current status label.
    const meta = trade?.lifecycleMeta as { hasAssignmentEvent?: boolean } | undefined;
    if (meta?.hasAssignmentEvent) {
        return true;
    }

    return false;
}

export function isCoveredCall(this: WheelContext, trade: Record<string, unknown> = {}): boolean {
    const strategy = ((trade.strategy as string) || '').toLowerCase();
    return strategy.includes('covered call');
}

/**
 * Coverage status for a wheel/PMCC position.
 * Returns 'covered' | 'partial' | 'uncovered' | 'n/a'.
 */
export function getTradeWheelCoverage(
    this: WheelContext,
    trade: Record<string, unknown> = {}
): string {
    const isWheelPmcc = this.isWheelOrPmccTrade(trade) || this.isAssignmentTrade(trade);
    if (!isWheelPmcc) return 'n/a';

    const isPmcc = this.isPmccTrade(trade);
    const baseShares = isPmcc
        ? this.getNetOpenLongCallContracts(trade) * 100
        : this.getTradeOpenStockShares(trade);
    if (baseShares <= 0) return 'n/a';

    const legs = Array.isArray(trade?.legs) ? (trade.legs as Record<string, unknown>[]) : [];
    const shortInfo = this.getNetOpenShortCalls(legs);
    const coveredShares = (Number(shortInfo?.contracts) || 0) * 100;
    if (coveredShares >= baseShares) return 'covered';
    if (coveredShares > 0) return 'partial';
    return 'uncovered';
}

/**
 * True when a wheel/PMCC trade is assigned (shares held) but coverage is not full.
 */
export function isAwaitingCoverage(this: WheelContext, trade: Record<string, unknown> = {}): boolean {
    const cov = this.getTradeWheelCoverage(trade);
    return cov === 'uncovered' || cov === 'partial';
}

/**
 * True when a trade has an assignment event in its lifecycle AND still holds
 * the assigned shares. Independent of CC coverage — covered wheels still
 * count as "assigned inventory" for tables and risk views.
 */
export function hasAssignedInventory(
    this: WheelContext,
    trade: Record<string, unknown> = {}
): boolean {
    const meta = trade?.lifecycleMeta as { hasAssignmentEvent?: boolean } | undefined;
    if (!meta?.hasAssignmentEvent) return false;
    return this.getTradeOpenStockShares(trade) > 0;
}

/**
 * Lightweight per-trade cost-basis math for wheel/PMCC awaiting-coverage positions.
 */
export function computeWheelEffectiveCostBasis(
    this: WheelContext,
    trade: Record<string, unknown> = {}
): { shares: number; assignmentCostBasis: number; effectiveCostBasis: number } {
    const legs = Array.isArray(trade?.legs) ? (trade.legs as Record<string, unknown>[]) : [];
    const isPmcc = this.isPmccTrade(trade);

    let stockShares = 0;
    let stockCost = 0;
    let optionCashFlow = 0;
    let longCallCost = 0;
    let shortCallNet = 0;
    let longCallShares = 0;

    legs.forEach((leg) => {
        const type = ((leg.type as string) || (leg.optionType as string) || '').toString().trim().toUpperCase();
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

export function calculateOptionPremium(
    this: WheelContext,
    trade: Record<string, unknown> = {}
): number {
    const quantity = Math.abs(Number(trade.quantity) || 0);
    if (!quantity) {
        return 0;
    }
    const entryPrice = Number(trade.entryPrice) || 0;
    const exitPrice = Number(trade.exitPrice) || 0;
    const fees = Number(trade.fees) || 0;
    const gross = (entryPrice - exitPrice) * quantity * 100;
    const direction = (trade.tradeDirection as string) || this.inferTradeDirection(trade);
    if (direction === 'short') {
        return gross - fees;
    }
    return (exitPrice - entryPrice) * quantity * 100 - fees;
}
