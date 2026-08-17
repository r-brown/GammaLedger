// src/ui/credit-playbook/data.ts — Wave 9: Credit playbook data extraction.
// Uses the .call(this, …) delegation pattern.

import type { NormalizedLeg } from '@types-gl/leg'

type TradeRecord = Record<string, unknown>

interface CreditPlaybookEntry {
  trade: TradeRecord
  [key: string]: unknown
}

interface LegPair {
  tradeId?: string
  ticker?: string
  strategy?: string
  type?: string
  strike?: number | string
  quantity?: number
  pricePerContract?: number
  fees?: number
  premium?: number
  optionPL?: number
  realizedOptionPL?: number
  unrealizedOptionPL?: number
  hasRealizedOptionActivity?: boolean
  stockPL?: number
  realizedStockPL?: number
  unrealizedStockPL?: number
  allInPL?: number
  pl?: number
  roi?: number | null
  capital?: number
  dte?: number | null
  entryDate?: Date | null
  expirationDate?: unknown
  exitDate?: Date | null
  daysHeld?: number | null
  isOpen?: boolean
  isAssigned?: boolean
  wasAssigned?: boolean
  isExpired?: boolean
  expiredWithoutClose?: boolean
  isRolling?: boolean
  isCreditAggregate?: boolean
  aggregateKind?: 'wheel' | 'covered-call' | 'cash-secured-put'
  heldShares?: number
  openCallContracts?: number
  childPairs?: LegPair[]
  trade?: TradeRecord
  [key: string]: unknown
}

interface CreditPlaybookDataContext {
  currentDate: Date | unknown
  schwab?: {
    tradeQuoteCache: Map<string, { unrealizedPL: number | null }>
  }
  getSchwabTradeQuoteKey(trade: TradeRecord): string
  creditPlaybookSort?: { key: string; direction: string }
  isClosedStatus(status: unknown): boolean
  isAssignedStatus(status: unknown): boolean
  isWheelPut(trade: Record<string, unknown>): boolean
  isWheelTrade(trade: Record<string, unknown>): boolean
  isCoveredCall(trade: Record<string, unknown>): boolean
  isPmccTrade(trade: Record<string, unknown>): boolean
  hasAssignedInventory(trade: Record<string, unknown>): boolean
  getTradeOpenStockShares(trade: Record<string, unknown>): number
  getNetOpenShortCalls(legs: unknown[]): {
    contracts: number
    details: Array<{ strike: unknown; expiration: string; contracts: number }>
  }
  summarizeLegRealization(trade: Record<string, unknown>): {
    realizedCashFlow: number
    realizedByDate: Map<string, number>
    hasOpenGroups: boolean
    openGroupKeys: Set<string>
  }
  summarizeLegs(legs: unknown[]): { activeOpenLegs: NormalizedLeg[] }
  buildLegLifecycleKey(leg: Record<string, unknown>): string
  getLegAction(leg: Record<string, unknown>): string
  extractSpreadPair(trade: TradeRecord, legs: unknown[], now: Date, pairs: LegPair[]): void
  extractIndividualLegPairs(trade: TradeRecord, legs: unknown[], now: Date, pairs: LegPair[]): void
  applyCreditPlaybookSortIndicators(): void
  updateCreditPlaybookView(): void
}

function getFiniteNumber(value: unknown): number | null {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
}

function getPairSortTimestamp(pair: LegPair): number {
    const dateCandidate = pair.exitDate || pair.expirationDate || pair.entryDate;
    if (dateCandidate instanceof Date && !Number.isNaN(dateCandidate.getTime())) {
        return dateCandidate.getTime();
    }

    if (typeof dateCandidate === 'string' && dateCandidate) {
        const parsed = Date.parse(dateCandidate);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }

    return Number.NEGATIVE_INFINITY;
}

function reconcileClosedTradePL(trade: TradeRecord, pairs: LegPair[], hasHeldStock: boolean): void {
    if (!pairs.length) {
        return;
    }

    pairs.forEach((pair) => {
        const optionPL = getFiniteNumber(pair.premium) ?? 0;
        pair.optionPL = optionPL;
        pair.stockPL = 0;
        pair.realizedStockPL = 0;
        pair.unrealizedStockPL = 0;
        pair.allInPL = getFiniteNumber(pair.pl) ?? optionPL;
    });

    const tradePL = getFiniteNumber(trade.pl);
    if (tradePL === null) {
        return;
    }

    const legs = Array.isArray(trade.legs) ? trade.legs as TradeRecord[] : [];
    const hasRealizedStockLegs = legs.some((leg) => {
        const type = ((leg?.type as string) || '').toString().trim().toUpperCase();
        return type === 'STOCK' || type === 'CASH';
    });
    const exitReason = ((trade.exitReason as string) || '').toString().trim().toLowerCase();
    const isAssignmentCycle = exitReason.includes('assign') || exitReason.includes('cash settlement');

    if (!hasRealizedStockLegs && !isAssignmentCycle) {
        return;
    }

    const optionPL = pairs.reduce((sum, pair) => sum + (getFiniteNumber(pair.premium) ?? 0), 0);
    const stockAdjustment = Number((tradePL - optionPL).toFixed(2));
    if (Math.abs(stockAdjustment) < 0.005) {
        return;
    }

    let targetIndex = 0;
    let bestTimestamp = Number.NEGATIVE_INFINITY;
    pairs.forEach((pair, index) => {
        const timestamp = getPairSortTimestamp(pair);
        if (timestamp >= bestTimestamp) {
            bestTimestamp = timestamp;
            targetIndex = index;
        }
    });

    const targetPair = pairs[targetIndex];
    const nextPL = (getFiniteNumber(targetPair.pl) ?? getFiniteNumber(targetPair.premium) ?? 0) + stockAdjustment;
    targetPair.stockPL = stockAdjustment;
    if (hasHeldStock) {
        targetPair.unrealizedStockPL = stockAdjustment;
    } else {
        targetPair.realizedStockPL = stockAdjustment;
    }
    targetPair.allInPL = Number(nextPL.toFixed(2));
    targetPair.pl = Number(nextPL.toFixed(2));

    const capital = getFiniteNumber(targetPair.capital);
    targetPair.roi = capital && capital > 0
        ? Number((((targetPair.pl as number) / capital) * 100).toFixed(2))
        : null;
}

function getPairDate(value: unknown): Date | null {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
    if (typeof value !== 'string' || !value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildCreditStrategyAggregate(
    context: CreditPlaybookDataContext,
    trade: TradeRecord,
    childPairs: LegPair[],
    now: Date,
    aggregateKind: 'wheel' | 'covered-call' | 'cash-secured-put'
): LegPair {
    const legs = Array.isArray(trade.legs) ? trade.legs : [];
    const heldShares = context.getTradeOpenStockShares(trade);
    const isAssigned = context.hasAssignedInventory(trade);
    const realization = context.summarizeLegRealization(trade);
    const activeOpenLegs = context.summarizeLegs(legs).activeOpenLegs
        .filter((leg) => realization.openGroupKeys.has(
            context.buildLegLifecycleKey(leg as unknown as Record<string, unknown>)
        ));
    const shortCalls = context.getNetOpenShortCalls(legs);
    const usesCurrentCall = aggregateKind === 'covered-call' || (aggregateKind === 'wheel' && isAssigned);
    const currentOptionType = usesCurrentCall ? 'CALL' : 'PUT';
    const currentShortLegs = activeOpenLegs.filter((leg) => {
        return leg.type === currentOptionType
            && context.getLegAction(leg as unknown as Record<string, unknown>) === 'SELL';
    });
    const currentShortQuantity = currentShortLegs.reduce(
        (sum, leg) => sum + Math.abs(Number(leg.quantity) || 0),
        0
    );
    const currentEntryPrice = currentShortQuantity > 0
        ? currentShortLegs.reduce(
            (sum, leg) => sum + (Number(leg.premium) || 0) * Math.abs(Number(leg.quantity) || 0),
            0
        ) / currentShortQuantity
        : null;
    const currentCall = usesCurrentCall
        ? shortCalls.details
            .slice()
            .sort((a, b) => (getPairDate(a.expiration)?.getTime() ?? Number.MAX_SAFE_INTEGER)
                - (getPairDate(b.expiration)?.getTime() ?? Number.MAX_SAFE_INTEGER))[0]
        : undefined;
    const normalizedChildPairs = childPairs.map((pair) => {
        if (!usesCurrentCall) {
            return {
                ...pair,
                isOpen: isAssigned ? false : pair.isOpen,
                isAssigned: false,
                wasAssigned: isAssigned && pair.type === 'PUT'
            };
        }
        const isCurrentCall = pair.isOpen && pair.type === 'CALL' && shortCalls.details.some((detail) => {
            return String(detail.strike ?? '') === String(pair.strike ?? '')
                && String(detail.expiration ?? '') === String(pair.expirationDate ?? '');
        });
        return {
            ...pair,
            isOpen: Boolean(isCurrentCall),
            isAssigned: false,
            wasAssigned: aggregateKind === 'wheel' && pair.type === 'PUT' && !isCurrentCall
        };
    });
    const openPairs = normalizedChildPairs.filter((pair) => pair.isOpen);
    const isActive = openPairs.length > 0 || heldShares > 0;
    const currentPair = openPairs
        .slice()
        .sort((a, b) => (getPairDate(a.expirationDate)?.getTime() ?? Number.MAX_SAFE_INTEGER)
            - (getPairDate(b.expirationDate)?.getTime() ?? Number.MAX_SAFE_INTEGER))[0];
    const currentCallStrike = typeof currentCall?.strike === 'number' || typeof currentCall?.strike === 'string'
        ? currentCall.strike
        : null;
    const currentExpiration = currentCall?.expiration || currentPair?.expirationDate || null;
    const currentExpirationDate = getPairDate(currentExpiration);
    const dte = currentExpirationDate
        ? Math.max(0, Math.ceil((currentExpirationDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
        : null;

    const entryDates = normalizedChildPairs
        .map((pair) => getPairDate(pair.entryDate))
        .filter((date): date is Date => date !== null)
        .sort((a, b) => a.getTime() - b.getTime());
    const exitDates = normalizedChildPairs
        .map((pair) => getPairDate(pair.exitDate))
        .filter((date): date is Date => date !== null)
        .sort((a, b) => b.getTime() - a.getTime());
    const entryDate = entryDates[0] ?? null;
    const exitDate = isActive ? null : (exitDates[0] ?? null);
    const daysHeld = entryDate
        ? Math.max(0, Math.ceil(((exitDate ?? now).getTime() - entryDate.getTime()) / (24 * 60 * 60 * 1000)))
        : null;

    const premium = normalizedChildPairs.reduce((sum, pair) => sum + (getFiniteNumber(pair.premium) ?? 0), 0);
    const realizedOptionPL = getFiniteNumber(realization.realizedCashFlow) ?? 0;
    const realizedStockPL = normalizedChildPairs.reduce((sum, pair) => sum + (getFiniteNumber(pair.realizedStockPL) ?? 0), 0);
    const unrealizedStockPL = normalizedChildPairs.reduce((sum, pair) => sum + (getFiniteNumber(pair.unrealizedStockPL) ?? 0), 0);
    const stockPL = realizedStockPL + unrealizedStockPL;
    const allInPL = realizedOptionPL + stockPL;
    const capital = openPairs.reduce((sum, pair) => sum + (getFiniteNumber(pair.capital) ?? 0), 0);

    return {
        tradeId: trade.id as string,
        ticker: trade.ticker as string,
        strategy: trade.strategy as string,
        type: currentCall ? 'CALL' : (currentPair?.type || (heldShares > 0
            ? 'STOCK'
            : aggregateKind === 'wheel' ? 'WHEEL' : aggregateKind === 'cash-secured-put' ? 'PUT' : 'CALL')),
        strike: currentCallStrike ?? currentPair?.strike ?? '—',
        quantity: currentCall?.contracts ?? currentPair?.quantity ?? 0,
        pricePerContract: currentEntryPrice ?? currentPair?.pricePerContract,
        fees: normalizedChildPairs.reduce((sum, pair) => sum + (getFiniteNumber(pair.fees) ?? 0), 0),
        premium,
        optionPL: realizedOptionPL,
        realizedOptionPL,
        hasRealizedOptionActivity: realization.realizedByDate.size > 0
            || (normalizedChildPairs.length > 0 && !realization.hasOpenGroups),
        stockPL,
        realizedStockPL,
        unrealizedStockPL,
        allInPL,
        pl: allInPL,
        roi: capital > 0 ? (allInPL / capital) * 100 : null,
        capital,
        entryDate,
        expirationDate: currentExpiration,
        exitDate,
        daysHeld,
        dte,
        isOpen: isActive,
        isAssigned,
        isRolling: openPairs.some((pair) => pair.isRolling),
        isCreditAggregate: true,
        aggregateKind,
        heldShares,
        openCallContracts: shortCalls.contracts,
        childPairs: normalizedChildPairs,
        trade
    };
}

export function extractCreditPlaybookLegPairs(
    this: CreditPlaybookDataContext,
    entries: CreditPlaybookEntry[] = []
): LegPair[] {
    const pairs: LegPair[] = [];
    const now = this.currentDate instanceof Date ? this.currentDate : new Date();

    entries.forEach((entry) => {
        const trade = entry.trade;
        const legs = (trade?.legs as unknown[]) || [];
        if (!legs.length) {
            return;
        }

        const tradePairs: LegPair[] = [];

        const strategy = (trade.strategy as string) || '';
        const strategyLower = strategy.toLowerCase();
        const isMultiLeg = strategyLower.includes('spread')
            || strategyLower.includes('condor')
            || strategyLower.includes('butterfly')
            || strategyLower.includes('iron')
            || strategyLower.includes('straddle')
            || strategyLower.includes('strangle')
            || strategyLower.includes('collar')
            || strategyLower.includes('albatross')
            || strategyLower.includes('diagonal')
            || strategyLower.includes('jade lizard')
            || strategyLower.includes('reverse jade')
            || strategyLower.includes('broken wing')
            || strategyLower.includes('box')
            || strategyLower.includes('guts')
            || strategyLower.includes('synthetic');

        if (isMultiLeg) {
            this.extractSpreadPair(trade, legs, now, tradePairs);
        } else {
            this.extractIndividualLegPairs(trade, legs, now, tradePairs);
        }

        reconcileClosedTradePL(trade, tradePairs, this.getTradeOpenStockShares(trade) > 0);
        let addedPairs: LegPair[];
        if (this.isWheelTrade(trade)) {
            addedPairs = [buildCreditStrategyAggregate(this, trade, tradePairs, now, 'wheel')];
        } else if (this.isCoveredCall(trade) && !this.isPmccTrade(trade)) {
            addedPairs = [buildCreditStrategyAggregate(this, trade, tradePairs, now, 'covered-call')];
        } else if (this.isWheelPut(trade)) {
            addedPairs = [buildCreditStrategyAggregate(this, trade, tradePairs, now, 'cash-secured-put')];
        } else {
            addedPairs = tradePairs;
        }

        if (!addedPairs.some(pair => pair.isCreditAggregate) && addedPairs.length > 0) {
            // Non-aggregate rows historically treated every opening credit or
            // debit as option P&L. Reclassify that amount: terminated groups
            // are realized; the still-open group is valued by Schwab below.
            const realization = this.summarizeLegRealization(trade);
            const realizedOptionPL = getFiniteNumber(realization.realizedCashFlow) ?? 0;
            for (const pair of addedPairs) {
                pair.realizedOptionPL = 0;
                pair.optionPL = 0;
                pair.hasRealizedOptionActivity = false;
                pair.allInPL = getFiniteNumber(pair.stockPL) ?? 0;
                pair.pl = pair.allInPL;
            }
            const realizedPair = addedPairs.find(pair => pair.isOpen) || addedPairs[addedPairs.length - 1];
            realizedPair.realizedOptionPL = realizedOptionPL;
            realizedPair.optionPL = realizedOptionPL;
            realizedPair.hasRealizedOptionActivity = realization.realizedByDate.size > 0;
            realizedPair.allInPL = (getFiniteNumber(realizedPair.allInPL) ?? 0) + realizedOptionPL;
            realizedPair.pl = realizedPair.allInPL;
        }

        const currentOptionPL = this.schwab?.tradeQuoteCache.get(this.getSchwabTradeQuoteKey(trade))?.unrealizedPL;
        if (Number.isFinite(currentOptionPL) && addedPairs.length > 0) {
            // A Schwab trade quote values every active option leg together, so
            // attach it to exactly one displayed parent/strategy row.
            const markedPair = addedPairs.find(pair => pair.isOpen) || addedPairs[0];
            markedPair.unrealizedOptionPL = Number(currentOptionPL);
            markedPair.allInPL = (Number(markedPair.allInPL ?? markedPair.pl) || 0) + Number(currentOptionPL);
            markedPair.pl = markedPair.allInPL;
            const capital = Number(markedPair.capital);
            markedPair.roi = Number.isFinite(capital) && capital > 0
                ? (Number(markedPair.allInPL) / capital) * 100
                : null;
        }
        for (const pair of addedPairs) {
            const capital = Number(pair.capital);
            pair.roi = Number.isFinite(capital) && capital > 0
                ? ((Number(pair.allInPL ?? pair.pl) || 0) / capital) * 100
                : null;
        }
        pairs.push(...addedPairs);
    });

    return pairs;
}

export function sortCreditPlaybook(this: CreditPlaybookDataContext, sortKey: string): void {
    if (!sortKey) {
        return;
    }

    const currentKey = this.creditPlaybookSort?.key;
    const currentDirection = this.creditPlaybookSort?.direction || 'desc';
    const isSameKey = currentKey === sortKey;
    const nextDirection = isSameKey && currentDirection === 'asc' ? 'desc' : 'asc';

    this.creditPlaybookSort = {
        key: sortKey,
        direction: isSameKey ? nextDirection : (sortKey === 'openedDate' ? 'desc' : 'asc')
    };

    this.applyCreditPlaybookSortIndicators();
    this.updateCreditPlaybookView();
}
