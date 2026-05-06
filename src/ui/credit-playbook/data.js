// src/ui/credit-playbook/data.js — Wave 9: Credit playbook data extraction.
// Uses the .call(this, …) delegation pattern.

export function extractCreditPlaybookLegPairs(entries = []) {
    const pairs = [];
    const now = this.currentDate instanceof Date ? this.currentDate : new Date();

    entries.forEach((entry) => {
        const trade = entry.trade;
        const legs = trade?.legs || [];
        if (!legs.length) {
            return;
        }

        const strategy = trade.strategy || '';
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
            // Handle multi-leg strategies as a single combined position
            this.extractSpreadPair(trade, legs, now, pairs);
        } else {
            // Handle naked options individually by strike
            this.extractIndividualLegPairs(trade, legs, now, pairs);
        }
    });

    return pairs;
}

export function sortCreditPlaybook(sortKey) {
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
