// src/trades/positions.ts — Wave 3: Trade position helpers and status normalization.
// Uses the .call(this, …) delegation pattern.

interface PositionsContext {
  normalizeLeg(leg: Record<string, unknown>, index?: number): Record<string, unknown>
  getLegSide(leg: Record<string, unknown>): string
  getLegAction(leg: Record<string, unknown>): string
  getLegMultiplier(leg: Record<string, unknown>): number
  normalizeLegType(type: unknown): string
  getNormalizedLegOrderType(leg: Record<string, unknown>): string
  isPmccTrade(trade: Record<string, unknown>): boolean
  isPmccBaseLeg(trade: Record<string, unknown>): boolean
  isPmccShortCall(trade: Record<string, unknown>): boolean
  getTradeOpenStockShares(trade: Record<string, unknown>): number
  getNetOpenLongCallContracts(trade: Record<string, unknown>): number
  getNetOpenShortCalls(legs: Record<string, unknown>[]): { contracts: number; details: unknown[] }
  isWheelTrade(trade: Record<string, unknown>): boolean
  isWheelOrPmccTrade(trade: Record<string, unknown>): boolean
  isCashSettledTrade(trade: Record<string, unknown>): boolean
  isClosedStatus(status: unknown): boolean
  isAssignedStatus(status: unknown): boolean
  normalizeStatus(status: unknown): string
  hasNetOpenOptionLegs(trade: Record<string, unknown>): boolean
  isAssignmentReason(reason: unknown): boolean
  inferTradeDirection(trade: Record<string, unknown>): string
  getTradeType(trade: Record<string, unknown>): string
  isWheelPut(trade: Record<string, unknown>): boolean
  isCoveredCall(trade: Record<string, unknown>): boolean
  isAwaitingCoverage(trade: Record<string, unknown>): boolean
  // Self-referential
  getPrimaryLeg(trade: Record<string, unknown>): Record<string, unknown> | null
  deriveTradeTypeFromLeg(leg: Record<string, unknown> | null): string
  deriveTradeDirectionFromLeg(leg: Record<string, unknown> | null): string
  isAssignmentTrade(trade: Record<string, unknown>): boolean
  getTradeWheelCoverage(trade: Record<string, unknown>): string
  calculateLegCashFlow(leg: Record<string, unknown>): number
}

export function getPrimaryLeg(
    this: PositionsContext,
    trade: Record<string, unknown> = {}
): Record<string, unknown> | null {
    if (trade.primaryLeg && (trade.primaryLeg as Record<string, unknown>).id) {
        return this.normalizeLeg(trade.primaryLeg as Record<string, unknown>);
    }
    if (Array.isArray(trade.legs) && trade.legs.length > 0) {
        const candidates = (trade.legs as Record<string, unknown>[]).map((leg, index) => this.normalizeLeg(leg, index));
        const firstOpen = candidates.find(leg => this.getLegSide(leg) === 'OPEN') || candidates[0];
        return firstOpen;
    }
    return null;
}

export function deriveTradeTypeFromLeg(
    this: PositionsContext,
    leg: Record<string, unknown> | null
): string {
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

export function deriveTradeDirectionFromLeg(
    this: PositionsContext,
    leg: Record<string, unknown> | null
): string {
    if (!leg) {
        return 'long';
    }
    const action = this.getLegAction(leg);
    if (action === 'SELL') {
        return 'short';
    }
    return 'long';
}

export function getTradeType(
    this: PositionsContext,
    trade: Record<string, unknown>
): string {
    const primaryLeg = this.getPrimaryLeg(trade);
    return this.deriveTradeTypeFromLeg(primaryLeg);
}

export function inferTradeDirection(
    this: PositionsContext,
    trade: Record<string, unknown>
): string {
    const primaryLeg = this.getPrimaryLeg(trade);
    return this.deriveTradeDirectionFromLeg(primaryLeg);
}

export function normalizeStatus(status: unknown): string {
    return ((status as string) || '').toString().trim().toLowerCase();
}

export function normalizeTradeStatusInput(status: unknown): string {
    const normalized = ((status as string) || '').toString().trim().toLowerCase();
    if (!normalized) return '';
    if (normalized === 'open') return 'Open';
    if (normalized === 'closed') return 'Closed';
    if (normalized === 'expired') return 'Expired';
    if (normalized === 'assigned') return 'Assigned';
    if (normalized === 'rolling' || normalized === 'rolled') return 'Rolling';
    return '';
}

export function isClosedStatus(
    this: PositionsContext,
    status: unknown
): boolean {
    const normalized = this.normalizeStatus(status);
    return normalized === 'closed' || normalized === 'expired';
}

export function isAssignedStatus(
    this: PositionsContext,
    status: unknown
): boolean {
    const normalized = this.normalizeStatus(status);
    return normalized === 'assigned';
}

export function isActiveStatus(
    this: PositionsContext,
    status: unknown
): boolean {
    const normalized = this.normalizeStatus(status);
    return normalized === 'open' || normalized === 'rolling';
}

/**
 * True when a trade's option-leg P&L is fully realized — closed, expired, or
 * assigned without remaining open option exposure.
 *
 * Returns true for:
 *   - Closed / Expired (option premium locked in)
 *   - Assigned non-wheel/PMCC trades (vanilla CSP-then-stock; option premium
 *     realized at assignment)
 *   - Assigned wheel/PMCC trades that are awaiting_coverage (no covered calls
 *     written yet) — option premium from the assigned put is realized
 *   - Assigned wheel/PMCC trades with no net open option legs
 *
 * Returns false for:
 *   - Open / Rolling (option premium still mark-to-market)
 *   - Assigned wheel/PMCC trades with active short calls (cycle still in
 *     flight; tracked in unrealized via the open-trades promotion path)
 *
 * This is the canonical predicate for routing a trade to realized P&L,
 * monthly P&L buckets, win rate, drawdown, etc.
 */
export function isFullyRealizedTrade(
    this: PositionsContext,
    trade: Record<string, unknown>
): boolean {
    if (!trade) return false;
    if (this.isClosedStatus(trade.status)) return true;
    if (!this.isAssignedStatus(trade.status)) return false;
    const isPromotedToOpen = this.isWheelOrPmccTrade(trade)
        && trade.lifecycleStatus !== 'awaiting_coverage'
        && this.hasNetOpenOptionLegs(trade);
    return !isPromotedToOpen;
}

export function isAssignmentReason(reason: unknown): boolean {
    const normalized = ((reason as string) || '').toString().trim().toLowerCase();
    return normalized.includes('assign') || normalized.includes('cash settlement');
}

/**
 * Returns true when the exit reason specifically describes a cash settlement
 * (as opposed to a physical-delivery assignment).
 */
export function isCashSettlementReason(reason: unknown): boolean {
    const normalized = ((reason as string) || '').toString().trim().toLowerCase();
    return normalized.includes('cash settlement');
}

/**
 * Returns true when the trade contains one or more CASH settlement legs.
 */
export function isCashSettledTrade(
    this: PositionsContext,
    trade: Record<string, unknown> = {}
): boolean {
    const legs = trade?.legs;
    if (!Array.isArray(legs)) {
        return false;
    }
    return (legs as Record<string, unknown>[]).some((leg) => {
        if (this.normalizeLegType(leg?.type) !== 'CASH') {
            return false;
        }
        const orderType = this.getNormalizedLegOrderType(leg);
        return orderType === 'BTC' || orderType === 'STC';
    });
}

export function getDisplayStatus(
    this: PositionsContext,
    trade: Record<string, unknown> | null
): string {
    if (!trade) {
        return 'Unknown';
    }

    const rawStatus = ((trade.status as string) || 'Unknown').toString().trim();
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

export function normalizeUnderlyingType(
    type: unknown,
    { fallback = 'Stock' }: { fallback?: string } = {}
): string {
    const normalized = ((type as string) || '').toString().trim().toLowerCase();
    if (['stock', 'etf', 'index', 'future'].includes(normalized)) {
        return normalized.charAt(0).toUpperCase() + normalized.slice(1);
    }
    return fallback;
}

export function isAssignmentTrade(
    this: PositionsContext,
    trade: Record<string, unknown> = {}
): boolean {
    const status = this.normalizeStatus(trade.status);
    if (status === 'assigned') {
        return true;
    }
    return this.isAssignmentReason(trade.exitReason);
}

/**
 * Total open stock shares currently held in a trade (BUY-OPEN minus SELL legs).
 */
export function getTradeOpenStockShares(
    this: PositionsContext,
    trade: Record<string, unknown> = {}
): number {
    const legs = Array.isArray(trade?.legs) ? (trade.legs as Record<string, unknown>[]) : [];
    if (!legs.length) return 0;
    let shares = 0;
    legs.forEach((leg) => {
        const type = ((leg.type as string) || (leg.optionType as string) || '').toString().trim().toUpperCase();
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
export function getNetOpenLongCallContracts(
    this: PositionsContext,
    trade: Record<string, unknown> = {}
): number {
    const legs = Array.isArray(trade?.legs) ? (trade.legs as Record<string, unknown>[]) : [];
    let net = 0;
    legs.forEach((leg) => {
        const type = ((leg.type as string) || (leg.optionType as string) || '').toString().trim().toUpperCase();
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

export function isWheelPut(trade: Record<string, unknown> = {}): boolean {
    const strategy = ((trade.strategy as string) || '').toLowerCase();
    return strategy.includes('cash-secured put');
}

export function isWheelTrade(trade: Record<string, unknown> = {}): boolean {
    const strategy = ((trade.strategy as string) || '').toString().trim().toLowerCase();
    return strategy.includes('wheel');
}

export function isWheelOrPmccTrade(
    this: PositionsContext,
    trade: Record<string, unknown> = {}
): boolean {
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

export function isCoveredCall(trade: Record<string, unknown> = {}): boolean {
    const strategy = ((trade.strategy as string) || '').toLowerCase();
    return strategy.includes('covered call');
}

export function isPmccBaseLeg(
    this: PositionsContext,
    trade: Record<string, unknown> = {}
): boolean {
    const strategy = ((trade.strategy as string) || '').toLowerCase();
    const direction = (trade.tradeDirection as string) || this.inferTradeDirection(trade);
    const tradeType = this.getTradeType(trade);
    return strategy.includes('poor man') && (direction === 'long' || tradeType === 'BTO');
}

export function isPmccShortCall(
    this: PositionsContext,
    trade: Record<string, unknown> = {}
): boolean {
    const strategy = ((trade.strategy as string) || '').toLowerCase();
    const direction = (trade.tradeDirection as string) || this.inferTradeDirection(trade);
    const tradeType = this.getTradeType(trade);
    return strategy.includes('poor man') && (direction === 'short' || tradeType === 'STO');
}

export function isPmccTrade(
    this: PositionsContext,
    trade: Record<string, unknown> = {}
): boolean {
    if (!trade) {
        return false;
    }

    const strategy = ((trade.strategy as string) || '').toLowerCase();
    if (strategy.includes('poor man') || strategy.includes('pmcc')) {
        return true;
    }

    return this.isPmccBaseLeg(trade) || this.isPmccShortCall(trade);
}

export function getTradeWheelCoverage(
    this: PositionsContext,
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

export function isAwaitingCoverage(
    this: PositionsContext,
    trade: Record<string, unknown> = {}
): boolean {
    const cov = this.getTradeWheelCoverage(trade);
    return cov === 'uncovered' || cov === 'partial';
}

export function computeWheelEffectiveCostBasis(
    this: PositionsContext,
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
        const cashFlow = Number((this as unknown as { calculateLegCashFlow: (leg: Record<string, unknown>) => number }).calculateLegCashFlow(leg)) || 0;

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
    this: PositionsContext,
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
