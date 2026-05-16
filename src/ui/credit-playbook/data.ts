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
  extractSpreadPair(trade: TradeRecord, legs: unknown[], now: Date, pairs: LegPair[]): void
  extractIndividualLegPairs(trade: TradeRecord, legs: unknown[], now: Date, pairs: LegPair[]): void
  applyCreditPlaybookSortIndicators(): void
  updateCreditPlaybookView(): void
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

