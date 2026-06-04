// src/ui/credit-playbook/data.ts — Wave 9: Credit playbook data extraction.
// Uses the .call(this, …) delegation pattern.

type TradeRecord = Record<string, unknown>

interface CreditPlaybookEntry {
  trade: TradeRecord
  [key: string]: unknown
}

interface LegPair {
  [key: string]: unknown
}

interface CreditPlaybookDataContext {
  currentDate: Date | unknown
  creditPlaybookSort?: { key: string; direction: string }
  isClosedStatus(status: unknown): boolean
  isAssignedStatus(status: unknown): boolean
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

function reconcileClosedTradePL(trade: TradeRecord, pairs: LegPair[]): void {
    if (!pairs.length) {
        return;
    }

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
    targetPair.pl = Number(nextPL.toFixed(2));

    const capital = getFiniteNumber(targetPair.capital);
    targetPair.roi = capital && capital > 0
        ? Number((((targetPair.pl as number) / capital) * 100).toFixed(2))
        : null;
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

        const tradePairsStart = pairs.length;

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
            this.extractSpreadPair(trade, legs, now, pairs);
        } else {
            this.extractIndividualLegPairs(trade, legs, now, pairs);
        }

        if (this.isClosedStatus(trade.status) || this.isAssignedStatus(trade.status)) {
            reconcileClosedTradePL(trade, pairs.slice(tradePairsStart));
        }
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
