// src/trades/assignment.ts — which short puts were closed by buying the shares.

import type { NormalizedLeg } from '@types-gl/leg'

// Slack between an expiration or $0 buyback and the share booking: weekend plus holiday.
const BOOKING_WINDOW_MS = 4 * 24 * 60 * 60 * 1000;

function dayTime(value: string | null | undefined): number {
    return Date.parse((value || '').slice(0, 10));
}

/**
 * Short PUT contracts closed by share purchases, per lifecycle key, on top of
 * the closing legs already recorded. Each share counts once, and only against
 * puts open on the purchase date. A purchase without a strike matches any put,
 * but only when no purchase in the trade has one. A leg without a date is not
 * ruled out by the date tests.
 */
export function matchAssignedPuts(
    legs: NormalizedLeg[],
    keyOf: (leg: NormalizedLeg) => string
): Map<string, number> {
    const buys = legs.filter(leg => leg.type === 'STOCK' && leg.orderType === 'BTO');
    const pricedBuys = buys.filter(leg => Number(leg.strike) > 0);

    // Partial fills of one purchase are added up before counting whole contracts.
    const purchases = new Map<string, { strike: number; date: number; shares: number }>();
    for (const leg of pricedBuys.length ? pricedBuys : buys) {
        const strike = pricedBuys.length ? Number(leg.strike) : 0;
        const id = `${strike}|${leg.executionDate}`;
        const purchase = purchases.get(id) ?? { strike, date: dayTime(leg.executionDate), shares: 0 };
        purchase.shares += Math.abs(leg.quantity) * leg.multiplier;
        purchases.set(id, purchase);
    }

    const puts = legs.filter(leg => leg.type === 'PUT');
    const usedBuybacks = new Set<NormalizedLeg>();
    const assigned = new Map<string, number>();

    for (const { strike, date, shares } of [...purchases.values()].sort((a, b) => a.date - b.date)) {
        const matching = puts.filter(leg => !strike || Math.abs(Number(leg.strike) - strike) <= 0.01);
        let sharesLeft = shares;

        for (const leg of matching) {
            if (leg.orderType !== 'BTC' || Number(leg.premium) || usedBuybacks.has(leg)) continue;
            if (Math.abs(dayTime(leg.executionDate) - date) > BOOKING_WINDOW_MS) continue;
            sharesLeft -= Math.abs(leg.quantity) * leg.multiplier;
            usedBuybacks.add(leg);
        }

        const contracts = new Map<string, NormalizedLeg[]>();
        for (const leg of matching) {
            const key = keyOf(leg);
            contracts.set(key, [...(contracts.get(key) ?? []), leg]);
        }
        // Unexpired puts first (nearest expiration), then expired ones (latest first).
        const rank = (group: NormalizedLeg[]) => {
            const gap = dayTime(group[0].expirationDate) - date;
            return gap < -BOOKING_WINDOW_MS ? [1, -gap] : [0, gap || 0];
        };
        const ordered = [...contracts].sort(([, a], [, b]) => rank(a)[0] - rank(b)[0] || rank(a)[1] - rank(b)[1]);

        for (const [key, group] of ordered) {
            let openThen = 0;
            let openNow = 0;
            for (const leg of group) {
                if (leg.orderType !== 'STO' && leg.orderType !== 'BTC') continue;
                const change = (leg.orderType === 'STO' ? 1 : -1) * Math.abs(leg.quantity);
                openNow += change;
                if (!(dayTime(leg.executionDate) > date)) openThen += change;
            }
            const taken = assigned.get(key) ?? 0;
            const multiplier = group[0].multiplier;
            const count = Math.min(openThen - taken, openNow - taken, Math.floor(sharesLeft / multiplier));
            if (count <= 0) continue;
            assigned.set(key, taken + count);
            sharesLeft -= count * multiplier;
        }
    }
    return assigned;
}
