// src/trades/risk.ts — Wave 3: Risk formula context, max-risk computation, and tooltip helpers.
// Uses the .call(this, …) delegation pattern.

import type { RiskValue } from '../types/common'

// ---------------------------------------------------------------------------
// M3 helpers — RiskValue tagged union conversions
// ---------------------------------------------------------------------------

/** Singleton for the "unlimited risk" variant. Safe to re-use. */
export const UNLIMITED_RISK: RiskValue = { kind: 'unlimited' }

/** Construct a finite RiskValue from a dollar amount. */
export function finiteRisk(amount: number): RiskValue {
    return { kind: 'finite', amount }
}

/**
 * Convert a raw `maxRisk` number (which may be Infinity) to a RiskValue.
 * Use this to populate `enriched.riskValue` in enrichTradeData.
 */
export function toRiskValue(maxRisk: number): RiskValue {
    return maxRisk === Number.POSITIVE_INFINITY ? UNLIMITED_RISK : finiteRisk(maxRisk)
}

/**
 * Type guard — narrows RiskValue to the finite variant.
 *
 * ```ts
 * if (isFiniteRisk(trade.riskValue)) {
 *   const dollars: number = trade.riskValue.amount
 * }
 * ```
 */
export function isFiniteRisk(v: RiskValue): v is { kind: 'finite'; amount: number } {
    return v.kind === 'finite'
}

interface RiskFormulaContext {
    trade: Record<string, unknown>
    details: Record<string, unknown>
    referenceStrike: number | null
    contracts: number
    multiplier: number
    contractValue: number
    netPremium: number
    netCredit: number
    netDebit: number
    premiumPaid: number
    premiumReceived: number
    totalFeesPerShare: number
    strikes: number[]
    K: number | null
    K1: number | null
    K2: number | null
    K3: number | null
    K4: number | null
    lowerWidth: number | null
    middleWidth: number | null
    upperWidth: number | null
    minStrikeDiff: number | null
    maxStrikeDiff: number | null
    maxWingWidth: number | null
    defaultWidth: number | null
    shortCallStrike: number | null
    shortCallStrikeHigh: number | null
    longCallStrike: number | null
    longCallStrikeLow: number | null
    shortPutStrike: number | null
    shortPutStrikeLow: number | null
    longPutStrike: number | null
    longPutStrikeLow: number | null
    verticalSpreadWidth: number | null
    S: number | null
    hasStockExposure: boolean
    shortPutsCollateralDollars: number | null
    shortPutDistinctStrikeCount: number
    netCreditDollars: number
    toNotional: (perShare: number | null | undefined) => number | undefined
    contractCount: number
    multiplierValue: number
}

interface RiskContext {
    summarizeLegs(legs: unknown[]): Record<string, unknown>
    getLegSide(leg: Record<string, unknown>): string
    getLegAction(leg: Record<string, unknown>): string
    getLegMultiplier(leg: Record<string, unknown>): number
    derivePrimaryStrike(summary: Record<string, unknown>): number | null
    buildRiskFormulaContext(trade: Record<string, unknown>, details: Record<string, unknown>): RiskFormulaContext | null
    getStrategyRiskHandlers(): Record<string, (ctx: RiskFormulaContext) => number | undefined>
    evaluateStrategyMaxRisk(strategyName: string, context: RiskFormulaContext): number | undefined
    computeDefaultMaxRisk(context: RiskFormulaContext): number
    computeMaxRiskUsingFormula(trade: Record<string, unknown>, summary: Record<string, unknown> | null): number
    assessRisk(trade: Record<string, unknown>, summary: Record<string, unknown>): { maxRiskValue: number; maxRiskLabel: string; unlimited: boolean }
    buildFormulaTooltipContent(trade: Record<string, unknown>, metricType: string): string | null
    buildMaxRiskTooltip(strategyName: string, strategyInfo: Record<string, string>, context: RiskFormulaContext | null, trade: Record<string, unknown>): string
    buildPLTooltip(trade: Record<string, unknown>, details: Record<string, unknown>, context: RiskFormulaContext | null): string
    buildVariablesWithExplanations(context: RiskFormulaContext, formulaData: Record<string, unknown>, trade: Record<string, unknown>): Array<{ displayName: string; value: string }>
    buildPLVariables(trade: Record<string, unknown>, details: Record<string, unknown>): Array<{ displayName: string; value: string }>
    getFormulaData(): Record<string, unknown>
    positionFormulaTooltip(wrapper: HTMLElement, tooltip: HTMLElement): void
    getStrategyDisplayName(name: string): string
    formatCurrency(value: number): string
    isClosedStatus(status: unknown): boolean
    escapeHtml(text: string): string
    strategyRiskHandlersCache: Record<string, (ctx: RiskFormulaContext) => number | undefined> | null
    formulaDataCache: Record<string, unknown> | null
}

export function buildRiskFormulaContext(
    this: RiskContext,
    trade: Record<string, unknown> = {},
    details: Record<string, unknown> | null = null
): RiskFormulaContext | null {
    const summary = details || this.summarizeLegs((trade?.legs as unknown[]) || []);
    if (!summary) {
        return null;
    }

    let referenceStrike = Number(trade?.strikePrice);
    if (!(Number.isFinite(referenceStrike) && referenceStrike > 0)) {
        const activeStrike = Number(trade?.activeStrikePrice);
        if (Number.isFinite(activeStrike) && activeStrike > 0) {
            referenceStrike = activeStrike;
        }
    }
    if (!(Number.isFinite(referenceStrike) && referenceStrike > 0)) {
        const primaryStrike = Number((summary?.primaryLeg as Record<string, unknown>)?.strike);
        if (Number.isFinite(primaryStrike) && primaryStrike > 0) {
            referenceStrike = primaryStrike;
        } else {
            const derivedStrike = this.derivePrimaryStrike(summary);
            if (Number.isFinite(derivedStrike) && (derivedStrike as number) > 0) {
                referenceStrike = derivedStrike as number;
            }
        }
    }

    let contracts = Math.abs(Number(trade?.quantity)) || 0;
    if (!(contracts > 0)) {
        const summaryContracts = Number(summary?.openBaseContracts);
        if (Number.isFinite(summaryContracts) && summaryContracts > 0) {
            contracts = summaryContracts;
        }
    }
    if (!(contracts > 0)) {
        const primaryQuantity = Number((summary?.primaryLeg as Record<string, unknown>)?.quantity);
        if (Number.isFinite(primaryQuantity) && primaryQuantity !== 0) {
            contracts = Math.abs(primaryQuantity);
        }
    }
    if (!(contracts > 0)) {
        return null;
    }

    let multiplier = Math.abs(Number(trade?.multiplier)) || 0;
    if (!(multiplier > 0) && summary?.primaryLeg) {
        const primaryMultiplier = this.getLegMultiplier(summary.primaryLeg as Record<string, unknown>);
        if (Number.isFinite(primaryMultiplier) && primaryMultiplier > 0) {
            multiplier = primaryMultiplier;
        }
    }
    if (!(multiplier > 0) && Array.isArray(summary?.legs)) {
        const legWithMultiplier = (summary.legs as Record<string, unknown>[]).find((leg) => Number.isFinite(Number(leg?.multiplier)) && Number(leg.multiplier) > 0);
        if (legWithMultiplier) {
            multiplier = Math.abs(Number(this.getLegMultiplier(legWithMultiplier)));
        }
    }

    const openLegsForRisk = Array.isArray(summary?.legs)
        ? (summary.legs as Record<string, unknown>[]).filter((leg) => leg && this.getLegSide(leg) === 'OPEN')
        : [];
    const stockLegsForRisk = openLegsForRisk.filter((leg) => leg.type === 'STOCK');

    if (stockLegsForRisk.length > 0) {
        const totalStockShares = stockLegsForRisk.reduce((sum, leg) => {
            const quantity = (leg.quantity as number) * this.getLegMultiplier(leg);
            return sum + (this.getLegAction(leg) === 'BUY' ? quantity : -quantity);
        }, 0);
        const absStockShares = Math.abs(Math.round(totalStockShares));
        if (absStockShares > 0) {
            contracts = absStockShares;
            multiplier = 1;
        } else if (!(multiplier > 0)) {
            multiplier = 100;
        }
    } else if (!(multiplier > 0)) {
        multiplier = 100;
    }

    const contractValue = contracts * multiplier;
    if (!(contractValue > 0)) {
        return null;
    }

    const creditDollars = Number(summary?.openCreditGross) || 0;
    const debitDollars = Number(summary?.openDebitGross) || 0;
    const feesDollars = Number(summary?.openFees) || 0;

    const premiumReceivedPerShare = contractValue > 0 ? creditDollars / contractValue : 0;
    const premiumPaidPerShare = contractValue > 0 ? debitDollars / contractValue : 0;
    const netPremiumPerShare = premiumReceivedPerShare - premiumPaidPerShare;
    const netCreditPerShare = Math.max(netPremiumPerShare, 0);
    const netDebitPerShare = Math.max(-netPremiumPerShare, 0);
    const totalFeesPerShare = contractValue > 0 ? feesDollars / contractValue : 0;

    const activeLegs = Array.isArray(summary?.activeOpenLegs) && (summary.activeOpenLegs as unknown[]).length > 0 && summary.hasClosedOutOpenLegs
        ? (summary.activeOpenLegs as Record<string, unknown>[])
        : null;
    const allOpenLegs = Array.isArray(summary?.legs)
        ? (summary.legs as Record<string, unknown>[]).filter((leg) => leg && this.getLegSide(leg) === 'OPEN')
        : [];
    const openLegs = activeLegs
        ? [...activeLegs, ...allOpenLegs.filter(leg => !['CALL', 'PUT'].includes(((leg.type as string) || '').toUpperCase()))]
        : allOpenLegs;
    const optionLegs = openLegs.filter((leg) => ['CALL', 'PUT'].includes(leg.type as string) && Number.isFinite(Number(leg.strike)));

    const strikeValues = optionLegs.map((leg) => Number(leg.strike)).filter((value) => Number.isFinite(value));
    const uniqueStrikes = Array.from(new Set(strikeValues)).sort((a, b) => a - b);
    const K1 = uniqueStrikes[0] ?? null;
    const K2 = uniqueStrikes[1] ?? null;
    const K3 = uniqueStrikes[2] ?? null;
    const K4 = uniqueStrikes[3] ?? null;

    const strikeDiffs: number[] = [];
    for (let i = 1; i < uniqueStrikes.length; i += 1) {
        const diff = uniqueStrikes[i] - uniqueStrikes[i - 1];
        if (Number.isFinite(diff) && diff > 0) strikeDiffs.push(diff);
    }
    const minStrikeDiff = strikeDiffs.length ? Math.min(...strikeDiffs) : null;
    const maxStrikeDiff = strikeDiffs.length ? Math.max(...strikeDiffs) : null;

    const selectStrikes = (predicate: (leg: Record<string, unknown>) => boolean) => optionLegs
        .filter(predicate)
        .map((leg) => Number(leg.strike))
        .filter((value) => Number.isFinite(value))
        .sort((a, b) => a - b);

    const shortCalls = selectStrikes((leg) => leg.type === 'CALL' && this.getLegAction(leg) === 'SELL');
    const longCalls = selectStrikes((leg) => leg.type === 'CALL' && this.getLegAction(leg) === 'BUY');
    const shortPuts = selectStrikes((leg) => leg.type === 'PUT' && this.getLegAction(leg) === 'SELL');
    const longPuts = selectStrikes((leg) => leg.type === 'PUT' && this.getLegAction(leg) === 'BUY');

    const shortCallStrike = shortCalls.length ? shortCalls[0] : null;
    const shortCallStrikeHigh = shortCalls.length ? shortCalls[shortCalls.length - 1] : null;
    const longCallStrikeLow = longCalls.length ? longCalls[0] : null;
    const longCallStrike = longCalls.length ? longCalls[longCalls.length - 1] : null;
    const shortPutStrikeLow = shortPuts.length ? shortPuts[0] : null;
    const shortPutStrike = shortPuts.length ? shortPuts[shortPuts.length - 1] : null;

    // Aggregate per-leg collateral across all open short put legs so multi-CSP
    // positions (e.g. one trade holding P160 + P185) do not collapse to a single
    // strike. Use leg-level quantity × multiplier instead of trade-level
    // contractValue, which can underrepresent positions with stacked strikes.
    const shortPutLegs = optionLegs.filter((leg) => leg.type === 'PUT' && this.getLegAction(leg) === 'SELL');
    let shortPutsCollateralDollars: number | null = null;
    let shortPutDistinctStrikeCount = 0;
    if (shortPutLegs.length > 0) {
        const seenStrikes = new Set<number>();
        let total = 0;
        for (const leg of shortPutLegs) {
            const strike = Number(leg.strike);
            const qty = Math.abs(Number(leg.quantity)) || 0;
            const legMult = Math.abs(Number(this.getLegMultiplier(leg))) || 100;
            if (!(Number.isFinite(strike) && strike > 0) || qty <= 0) continue;
            total += strike * qty * legMult;
            seenStrikes.add(strike);
        }
        if (total > 0) {
            shortPutsCollateralDollars = total;
            shortPutDistinctStrikeCount = seenStrikes.size;
        }
    }

    const netCreditDollars = Math.max(creditDollars - debitDollars, 0);
    const longPutStrikeLow = longPuts.length ? longPuts[0] : null;
    const longPutStrike = longPuts.length ? longPuts[longPuts.length - 1] : null;

    const lowerWidth = Number.isFinite(K1) && Number.isFinite(K2) ? Math.max((K2 as number) - (K1 as number), 0) : null;
    const middleWidth = Number.isFinite(K2) && Number.isFinite(K3) ? Math.max((K3 as number) - (K2 as number), 0) : null;
    const upperWidth = Number.isFinite(K3) && Number.isFinite(K4) ? Math.max((K4 as number) - (K3 as number), 0) : null;
    const maxWingWidth = Math.max(
        Number.isFinite(lowerWidth) ? (lowerWidth as number) : 0,
        Number.isFinite(upperWidth) ? (upperWidth as number) : 0
    ) || null;
    const defaultWidth = Number.isFinite(maxWingWidth) && (maxWingWidth as number) > 0
        ? maxWingWidth
        : Number.isFinite(middleWidth) && (middleWidth as number) > 0
            ? middleWidth
            : Number.isFinite(minStrikeDiff) && (minStrikeDiff as number) > 0
                ? minStrikeDiff
                : null;

    const stockLegs = openLegs.filter((leg) => leg.type === 'STOCK');

    const underlyingCandidates: number[] = [];
    const addCandidate = (value: unknown) => {
        const numeric = Number(value);
        if (Number.isFinite(numeric) && numeric > 0) underlyingCandidates.push(numeric);
    };

    addCandidate(trade?.entryUnderlyingPrice);
    addCandidate(trade?.underlyingEntryPrice);
    addCandidate(trade?.underlyingPrice);
    addCandidate(trade?.underlyingPriceAtEntry);
    openLegs.forEach((leg) => addCandidate(leg?.underlyingPrice));

    if (!underlyingCandidates.length && stockLegs.length) {
        stockLegs.map((leg) => Number(leg?.premium))
            .filter((value) => Number.isFinite(value) && value > 0)
            .forEach((value) => underlyingCandidates.push(value));
    }

    let S: number | null = null;
    if (underlyingCandidates.length) {
        const total = underlyingCandidates.reduce((sum, value) => sum + value, 0);
        const average = total / underlyingCandidates.length;
        if (Number.isFinite(average) && average > 0) S = average;
    }

    const effectiveStrike: number | null = Number.isFinite(referenceStrike) && referenceStrike > 0
        ? referenceStrike
        : (shortCallStrike ?? shortPutStrike ?? K1 ?? null);

    const toNotional = (perShare: number | null | undefined): number | undefined => {
        if (perShare === null || perShare === undefined) return undefined;
        if (perShare === Number.POSITIVE_INFINITY) return Number.POSITIVE_INFINITY;
        const numeric = Number(perShare);
        if (!Number.isFinite(numeric)) return undefined;
        return Math.max(numeric, 0) * contractValue;
    };

    const verticalSpreadWidth = Number.isFinite((summary?.verticalSpread as Record<string, unknown>)?.width) && (summary?.verticalSpread as Record<string, unknown>)?.width as number > 0
        ? (summary?.verticalSpread as Record<string, unknown>)?.width as number
        : null;

    return {
        trade, details: summary, referenceStrike: effectiveStrike,
        contracts, multiplier, contractValue,
        netPremium: netPremiumPerShare, netCredit: netCreditPerShare, netDebit: netDebitPerShare,
        premiumPaid: premiumPaidPerShare, premiumReceived: premiumReceivedPerShare, totalFeesPerShare,
        strikes: uniqueStrikes, K: effectiveStrike, K1, K2, K3, K4,
        lowerWidth, middleWidth, upperWidth, minStrikeDiff, maxStrikeDiff, maxWingWidth, defaultWidth,
        shortCallStrike, shortCallStrikeHigh, longCallStrike, longCallStrikeLow,
        shortPutStrike, shortPutStrikeLow, longPutStrike, longPutStrikeLow,
        verticalSpreadWidth, S,
        hasStockExposure: stockLegs.length > 0,
        shortPutsCollateralDollars, shortPutDistinctStrikeCount, netCreditDollars,
        toNotional, contractCount: contracts, multiplierValue: multiplier
    };
}

export function computeDefaultMaxRisk(
    this: RiskContext,
    context: RiskFormulaContext
): number {
    if (!context || !(context.contractValue > 0)) return 0;
    const netDebitPerShare = Number(context.netDebit);
    if (Number.isFinite(netDebitPerShare) && netDebitPerShare > 0) {
        const value = context.toNotional(netDebitPerShare);
        return Number.isFinite(value) ? (value as number) : 0;
    }
    return 0;
}

export function getStrategyRiskHandlers(
    this: RiskContext
): Record<string, (ctx: RiskFormulaContext) => number | undefined> {
    if (!this.strategyRiskHandlersCache) {
        const width = (lower: number | null, upper: number | null) => {
            if (!Number.isFinite(lower) || !Number.isFinite(upper)) return null;
            return Math.max((upper as number) - (lower as number), 0);
        };
        const pickStrike = (...values: (number | null | undefined)[]) => {
            for (const value of values) {
                const numeric = Number(value);
                if (Number.isFinite(numeric) && numeric > 0) return numeric;
            }
            return null;
        };
        const handlers: Record<string, (ctx: RiskFormulaContext) => number | undefined> = {};
        const register = (name: string, fn: (ctx: RiskFormulaContext) => number | undefined) => {
            if (name) handlers[name] = fn;
            return fn;
        };

        const debitRisk = (ctx: RiskFormulaContext) => {
            const debit = Number(ctx.netDebit);
            if (Number.isFinite(debit) && debit > 0) return ctx.toNotional(debit);
            const paid = Number(ctx.premiumPaid);
            if (Number.isFinite(paid) && paid > 0) return ctx.toNotional(paid);
            return undefined;
        };
        const spreadWidthRisk = (ctx: RiskFormulaContext, diff: number | null) => {
            const widthValue = Number.isFinite(ctx.verticalSpreadWidth) && (ctx.verticalSpreadWidth as number) > 0
                ? ctx.verticalSpreadWidth as number : diff;
            if (!Number.isFinite(widthValue) || (widthValue as number) <= 0) return undefined;
            if (ctx.netCredit > 0) return ctx.toNotional((widthValue as number) - ctx.netCredit);
            if (ctx.netDebit > 0) return ctx.toNotional((widthValue as number) + ctx.netDebit);
            return ctx.toNotional(widthValue as number);
        };
        const creditWidthRisk = (ctx: RiskFormulaContext, lower: number | null, upper: number | null) => {
            const diff = width(lower, upper);
            if (diff === null) return undefined;
            return spreadWidthRisk(ctx, diff);
        };
        const widthMinusDebit = (ctx: RiskFormulaContext, lower: number | null, upper: number | null) => {
            const diff = width(lower, upper);
            if (diff === null) return undefined;
            return ctx.toNotional(diff - ctx.netDebit);
        };
        const condorWidthRisk = (ctx: RiskFormulaContext) => {
            const diff = Number.isFinite(ctx.defaultWidth) && (ctx.defaultWidth as number) > 0
                ? ctx.defaultWidth as number : width(ctx.K1, ctx.K2);
            if (!Number.isFinite(diff) || (diff as number) <= 0) return undefined;
            return spreadWidthRisk(ctx, diff as number);
        };

        register('Bear Call Ladder', (ctx) => creditWidthRisk(ctx, ctx.K1, ctx.K2));
        register('Bear Call Spread', (ctx) => creditWidthRisk(ctx, ctx.K1, ctx.K2));
        register('Bear Put Ladder', (ctx) => { const w = width(ctx.K2, ctx.K3); return w === null ? undefined : ctx.toNotional(ctx.netDebit - w); });
        register('Bear Put Spread', debitRisk);
        register('Box Spread', (ctx) => creditWidthRisk(ctx, ctx.K1, ctx.K2));
        register('Bull Call Ladder', (ctx) => { const w = width(ctx.K1, ctx.K2); return w === null ? undefined : ctx.toNotional(ctx.netDebit + w); });
        register('Bull Call Spread', debitRisk);
        register('Bull Put Ladder', (ctx) => creditWidthRisk(ctx, ctx.K1, ctx.K2));
        register('Bull Put Spread', (ctx) => creditWidthRisk(ctx, ctx.K1, ctx.K2));
        register('Calendar Call Spread', debitRisk);
        register('Calendar Put Spread', debitRisk);
        register('Calendar Straddle', debitRisk);
        register('Calendar Strangle', debitRisk);
        register('Call Broken Wing', (ctx) => creditWidthRisk(ctx, ctx.K1, ctx.K2));
        register('Call Ratio Backspread', (ctx) => creditWidthRisk(ctx, ctx.K1, ctx.K2));
        register('Call Ratio Spread', (ctx) => creditWidthRisk(ctx, ctx.K1, ctx.K2));
        register('Cash-Secured Put', (ctx) => {
            if (ctx.shortPutDistinctStrikeCount >= 2 && ctx.shortPutsCollateralDollars !== null) {
                return Math.max(ctx.shortPutsCollateralDollars - ctx.netCreditDollars, 0);
            }
            const strike = pickStrike(ctx.shortPutStrike, ctx.shortPutStrikeLow, ctx.K, ctx.K1);
            return Number.isFinite(strike) ? ctx.toNotional((strike as number) - ctx.netCredit) : undefined;
        });
        register('Collar', (ctx) => {
            const underlying = pickStrike(ctx.S, ctx.referenceStrike);
            const putStrike = pickStrike(ctx.longPutStrike, ctx.shortPutStrike, ctx.K1);
            return (underlying === null || putStrike === null) ? undefined : ctx.toNotional(underlying - putStrike - ctx.netCredit);
        });
        register('Covered Call', (ctx) => {
            const underlying = pickStrike(ctx.S, ctx.referenceStrike);
            return underlying === null ? undefined : ctx.toNotional(underlying - ctx.netCredit);
        });
        register('Covered Put', () => Number.POSITIVE_INFINITY);
        register('Covered Short Straddle', () => Number.POSITIVE_INFINITY);
        register('Covered Short Strangle', () => Number.POSITIVE_INFINITY);
        register('Diagonal Call Spread', debitRisk);
        register('Diagonal Put Spread', debitRisk);
        register('Double Diagonal', debitRisk);
        register('Guts', debitRisk);
        register('Inverse Call Broken Wing', (ctx) => widthMinusDebit(ctx, ctx.K2, ctx.K3));
        register('Inverse Iron Butterfly', (ctx) => { const w = width(ctx.K1, ctx.K2); return w === null ? undefined : ctx.toNotional(ctx.netDebit - w); });
        register('Inverse Iron Condor', debitRisk);
        register('Inverse Put Broken Wing', (ctx) => widthMinusDebit(ctx, ctx.K1, ctx.K2));
        register('Iron Albatross', condorWidthRisk);
        register('Iron Butterfly', (ctx) => creditWidthRisk(ctx, ctx.K1, ctx.K2));
        register('Iron Condor', condorWidthRisk);
        register('Jade Lizard', (ctx) => {
            const callStrike = pickStrike(ctx.shortCallStrike, ctx.shortCallStrikeHigh, ctx.K2, ctx.K3);
            return Number.isFinite(callStrike) ? ctx.toNotional((callStrike as number) - ctx.netCredit) : undefined;
        });
        register('Long Call', debitRisk);
        register('Long Call Butterfly', debitRisk);
        register('Long Call Condor', debitRisk);
        register('Long Put', debitRisk);
        register('Long Put Butterfly', debitRisk);
        register('Long Put Condor', debitRisk);
        register('Long Straddle', debitRisk);
        register('Long Strangle', debitRisk);
        register("Poor Man's Covered Call", debitRisk);
        register('Protective Put', (ctx) => {
            const underlying = pickStrike(ctx.S, ctx.referenceStrike);
            const putStrike = pickStrike(ctx.longPutStrike, ctx.longPutStrikeLow, ctx.K1);
            return (underlying === null || putStrike === null) ? undefined : ctx.toNotional(underlying - putStrike + ctx.netDebit);
        });
        register('Put Broken Wing', (ctx) => creditWidthRisk(ctx, ctx.K1, ctx.K2));
        register('Put Ratio Backspread', (ctx) => creditWidthRisk(ctx, ctx.K1, ctx.K2));
        register('Put Ratio Spread', (ctx) => creditWidthRisk(ctx, ctx.K1, ctx.K2));
        register('Reverse Jade Lizard', (ctx) => {
            const putStrike = pickStrike(ctx.shortPutStrike, ctx.shortPutStrikeLow, ctx.K1);
            return Number.isFinite(putStrike) ? ctx.toNotional((putStrike as number) - ctx.netCredit) : undefined;
        });
        register('Short Call', () => Number.POSITIVE_INFINITY);
        register('Short Call Butterfly', (ctx) => creditWidthRisk(ctx, ctx.K1, ctx.K2));
        register('Short Call Condor', condorWidthRisk);
        register('Short Guts', () => Number.POSITIVE_INFINITY);
        register('Short Put', (ctx) => {
            if (ctx.shortPutDistinctStrikeCount >= 2 && ctx.shortPutsCollateralDollars !== null) {
                return Math.max(ctx.shortPutsCollateralDollars - ctx.netCreditDollars, 0);
            }
            const strike = pickStrike(ctx.shortPutStrike, ctx.shortPutStrikeLow, ctx.K, ctx.K1);
            return Number.isFinite(strike) ? ctx.toNotional((strike as number) - ctx.netCredit) : undefined;
        });
        register('Short Put Butterfly', (ctx) => creditWidthRisk(ctx, ctx.K1, ctx.K2));
        register('Short Put Condor', condorWidthRisk);
        register('Short Straddle', () => Number.POSITIVE_INFINITY);
        register('Short Strangle', () => Number.POSITIVE_INFINITY);
        register('Strap', debitRisk);
        register('Strip', debitRisk);
        register('Synthetic Long Stock', () => Number.POSITIVE_INFINITY);
        register('Synthetic Short Stock', () => Number.POSITIVE_INFINITY);
        register('Synthetic Put', () => Number.POSITIVE_INFINITY);
        register('Wheel', (ctx) => {
            if (ctx.shortPutDistinctStrikeCount >= 2 && ctx.shortPutsCollateralDollars !== null) {
                return Math.max(ctx.shortPutsCollateralDollars - ctx.netCreditDollars, 0);
            }
            const strike = pickStrike(ctx.shortPutStrike, ctx.shortPutStrikeLow, ctx.K1);
            return Number.isFinite(strike) ? ctx.toNotional((strike as number) - ctx.netCredit) : undefined;
        });

        if (handlers['Calendar Call Spread']) register('Calendar Spread', handlers['Calendar Call Spread']);
        if (handlers['Call Broken Wing']) {
            register('Call Broken Wing Butterfly', handlers['Call Broken Wing']);
            register('Broken Wing Butterfly', handlers['Call Broken Wing']);
        }
        if (handlers['Put Broken Wing']) register('Put Broken Wing Butterfly', handlers['Put Broken Wing']);
        if (handlers['Wheel']) register('Wheel Strategy', handlers['Wheel']);
        if (handlers['Cash-Secured Put']) register('Cash Secured Put', handlers['Cash-Secured Put']);
        if (handlers["Poor Man's Covered Call"]) register('Poor Mans Covered Call', handlers["Poor Man's Covered Call"]);

        this.strategyRiskHandlersCache = handlers;
    }
    return this.strategyRiskHandlersCache as Record<string, (ctx: RiskFormulaContext) => number | undefined>;
}

export function evaluateStrategyMaxRisk(
    this: RiskContext,
    strategyName: string,
    context: RiskFormulaContext
): number | undefined {
    if (!context) return undefined;
    const handlers = this.getStrategyRiskHandlers();
    const key = (strategyName || '').toString().trim();
    if (!key) return undefined;
    const handler = handlers[key];
    if (typeof handler !== 'function') return undefined;
    return handler(context);
}

export function computeMaxRiskUsingFormula(
    this: RiskContext,
    trade: Record<string, unknown> = {},
    summary: Record<string, unknown> | null = null
): number {
    const details = summary || this.summarizeLegs((trade?.legs as unknown[]) || []);
    if (!details) return 0;
    const context = this.buildRiskFormulaContext(trade, details);
    if (!context) return 0;
    const strategyName = this.getStrategyDisplayName((trade?.strategy as string) || '');
    let maxRisk: number | undefined = strategyName ? this.evaluateStrategyMaxRisk(strategyName, context) : undefined;
    if (maxRisk === undefined) maxRisk = this.computeDefaultMaxRisk(context);
    if (maxRisk === Number.POSITIVE_INFINITY) return Number.POSITIVE_INFINITY;
    if (!Number.isFinite(maxRisk) || maxRisk <= 0) return 0;
    return parseFloat(maxRisk.toFixed(2));
}

export function assessRisk(
    this: RiskContext,
    trade: Record<string, unknown>,
    summary: Record<string, unknown>
): { maxRiskValue: number; maxRiskLabel: string; unlimited: boolean } {
    const details = summary || this.summarizeLegs((trade?.legs as unknown[]) || []);
    const maxRisk = this.computeMaxRiskUsingFormula(trade, details);
    const result = { maxRiskValue: 0, maxRiskLabel: '$0.00', unlimited: false };
    if (maxRisk === Number.POSITIVE_INFINITY) {
        result.maxRiskValue = Number.POSITIVE_INFINITY;
        result.maxRiskLabel = 'Unlimited';
        result.unlimited = true;
        (details as Record<string, unknown>).capitalAtRisk = Number.POSITIVE_INFINITY;
        return result;
    }
    if (Number.isFinite(maxRisk) && maxRisk > 0) {
        result.maxRiskValue = maxRisk;
        result.maxRiskLabel = this.formatCurrency(maxRisk);
    }
    (details as Record<string, unknown>).capitalAtRisk = result.maxRiskValue;
    return result;
}

export function getFormulaData(this: RiskContext): Record<string, unknown> {
    if (!this.formulaDataCache) {
        this.formulaDataCache = {
            "variableExplanations": {
                "S_0": "Underlying price at entry", "S_T": "Underlying price at expiry",
                "K": "Strike price", "K1": "Lower strike price", "K2": "Mid strike price",
                "K3": "Upper strike price", "K4": "Highest strike price",
                "K_put": "Put strike", "K_call": "Call strike",
                "D_spread": "Strike width (K2 - K1)", "netDebit": "Net debit paid",
                "netCredit": "Net credit received", "M": "Contract multiplier (×100)",
                "∞": "Unlimited (profit/loss)", "maxRisk": "Max loss", "maxGain": "Max gain"
            },
            "strategies": {
                "Bear Call Ladder": { "maxRiskFormula": "∞", "maxGainFormula": "(K2 - K1 + netCredit) * M", "explanation": "Unlimited upside risk; max gain at K2." },
                "Bear Call Spread": { "maxRiskFormula": "(K2 - K1 - netCredit) * M", "maxGainFormula": "netCredit * M", "explanation": "Limited risk and limited profit; bearish strategy. (Sell K1, Buy K2)" },
                "Bear Put Ladder": { "maxRiskFormula": "∞", "maxGainFormula": "(K2 - K1 + netCredit) * M", "explanation": "Unlimited downside risk; max gain at K1." },
                "Bear Put Spread": { "maxRiskFormula": "netDebit * M", "maxGainFormula": "(K2 - K1 - netDebit) * M", "explanation": "Defined-risk bearish spread. (Buy K2, Sell K1)" },
                "Box Spread": { "maxRiskFormula": "(netDebit - (K2 - K1)) * M", "maxGainFormula": "(K2 - K1 - netDebit) * M", "explanation": "Arbitrage strategy." },
                "Bull Call Ladder": { "maxRiskFormula": "(K2 - K1 - netCredit) * M", "maxGainFormula": "∞", "explanation": "Unlimited upside gain; risk limited at K2." },
                "Bull Call Spread": { "maxRiskFormula": "netDebit * M", "maxGainFormula": "(K2 - K1 - netDebit) * M", "explanation": "Limited risk, limited reward bullish spread. (Buy K1, Sell K2)" },
                "Bull Put Ladder": { "maxRiskFormula": "∞", "maxGainFormula": "(K2 - K1 + netCredit) * M", "explanation": "Unlimited downside risk; max gain at K1." },
                "Bull Put Spread": { "maxRiskFormula": "(K2 - K1 - netCredit) * M", "maxGainFormula": "netCredit * M", "explanation": "Defined-risk bullish spread. (Sell K2, Buy K1)" },
                "Calendar Call Spread": { "maxRiskFormula": "netDebit * M", "maxGainFormula": "Variable, typically near short strike at expiry", "explanation": "Limited loss; profit depends on volatility and timing." },
                "Calendar Put Spread": { "maxRiskFormula": "netDebit * M", "maxGainFormula": "Variable, near short strike at expiry", "explanation": "Neutral to bearish position with limited loss." },
                "Calendar Straddle": { "maxRiskFormula": "netDebit * M", "maxGainFormula": "Variable, peaks when stock stays near middle strike", "explanation": "Limited loss; profit from time decay and volatility." },
                "Calendar Strangle": { "maxRiskFormula": "netDebit * M", "maxGainFormula": "Variable; profit from time decay", "explanation": "Limited loss; profit depends on implied volatility." },
                "Call Broken Wing": { "maxRiskFormula": "netDebit * M", "maxGainFormula": "(K2 - K1 - netDebit) * M", "explanation": "Variant of butterfly." },
                "Call Ratio Backspread": { "maxRiskFormula": "(K2 - K1 - netCredit) * M", "maxGainFormula": "∞", "explanation": "Unlimited upside profit; limited downside loss." },
                "Call Ratio Spread": { "maxRiskFormula": "∞", "maxGainFormula": "(K2 - K1 + netCredit) * M", "explanation": "Neutral to slightly bearish; unlimited risk, limited gain." },
                "Cash-Secured Put": { "maxRiskFormula": "(K - netCredit) * M", "maxGainFormula": "netCredit * M", "explanation": "Limited profit (premium); risk if assigned and stock drops." },
                "Collar": { "maxRiskFormula": "(S_0 - K_put + netDebit) * M", "maxGainFormula": "(K_call - S_0 - netDebit) * M", "explanation": "Stock-protection strategy with capped loss and gain." },
                "Covered Call": { "maxRiskFormula": "(S_0 - netCredit) * M", "maxGainFormula": "(K_call - S_0 + netCredit) * M", "explanation": "Income from premium; capped upside." },
                "Covered Put": { "maxRiskFormula": "∞", "maxGainFormula": "(S_0 - K_put + netCredit) * M", "explanation": "Unlimited risk if stock rises." },
                "Covered Short Straddle": { "maxRiskFormula": "∞", "maxGainFormula": "(S_0 - K + netCredit) * M", "explanation": "Unlimited risk if stock rises." },
                "Covered Short Strangle": { "maxRiskFormula": "∞", "maxGainFormula": "(S_0 - K1 + netCredit) * M", "explanation": "Unlimited risk if stock rises." },
                "Diagonal Call Spread": { "maxRiskFormula": "netDebit * M", "maxGainFormula": "Variable near short strike", "explanation": "Limited loss; profit from time and direction." },
                "Diagonal Put Spread": { "maxRiskFormula": "netDebit * M", "maxGainFormula": "Variable near short strike", "explanation": "Limited risk and profit potential." },
                "Double Diagonal": { "maxRiskFormula": "netDebit * M", "maxGainFormula": "Variable near short strikes", "explanation": "Limited loss, volatility-driven profit." },
                "Guts": { "maxRiskFormula": "(netDebit - (K2 - K1)) * M", "maxGainFormula": "∞", "explanation": "Buy ITM call (K1) and ITM put (K2). Max loss between strikes." },
                "Inverse Call Broken Wing": { "maxRiskFormula": "(K2 - K1 - netCredit) * M", "maxGainFormula": "netCredit * M", "explanation": "Same as Short Call Butterfly." },
                "Inverse Iron Butterfly": { "maxRiskFormula": "netDebit * M", "maxGainFormula": "(K2 - K1 - netDebit) * M", "explanation": "Same as Long Iron Butterfly." },
                "Inverse Iron Condor": { "maxRiskFormula": "netDebit * M", "maxGainFormula": "(K2 - K1 - netDebit) * M", "explanation": "Same as Long Iron Condor." },
                "Inverse Put Broken Wing": { "maxRiskFormula": "(K2 - K1 - netCredit) * M", "maxGainFormula": "netCredit * M", "explanation": "Same as Short Put Butterfly." },
                "Iron Albatross": { "maxRiskFormula": "(D_spread - netCredit) * M", "maxGainFormula": "netCredit * M", "explanation": "Wide iron condor variant; low reward and risk." },
                "Iron Butterfly": { "maxRiskFormula": "(K2 - K1 - netCredit) * M", "maxGainFormula": "netCredit * M", "explanation": "Limited loss and gain; centered around middle strike." },
                "Iron Condor": { "maxRiskFormula": "(D_spread - netCredit) * M", "maxGainFormula": "netCredit * M", "explanation": "Neutral strategy; max loss at either wing." },
                "Jade Lizard": { "maxRiskFormula": "(K_call - netCredit) * M", "maxGainFormula": "netCredit * M", "explanation": "No upside risk if net credit. Short Put + Short Call Spread." },
                "Long Call": { "maxRiskFormula": "netDebit * M", "maxGainFormula": "∞", "explanation": "Max loss is premium paid." },
                "Long Call Butterfly": { "maxRiskFormula": "netDebit * M", "maxGainFormula": "(K2 - K1 - netDebit) * M", "explanation": "Limited loss and gain." },
                "Long Call Condor": { "maxRiskFormula": "netDebit * M", "maxGainFormula": "(K2 - K1 - netDebit) * M", "explanation": "Limited loss." },
                "Long Put": { "maxRiskFormula": "netDebit * M", "maxGainFormula": "(K - netDebit) * M", "explanation": "Max loss is premium paid; bearish." },
                "Long Put Butterfly": { "maxRiskFormula": "netDebit * M", "maxGainFormula": "(K2 - K1 - netDebit) * M", "explanation": "Limited loss and gain." },
                "Long Put Condor": { "maxRiskFormula": "netDebit * M", "maxGainFormula": "(K2 - K1 - netDebit) * M", "explanation": "Limited loss." },
                "Long Straddle": { "maxRiskFormula": "netDebit * M", "maxGainFormula": "∞", "explanation": "Profit from big move in either direction." },
                "Long Strangle": { "maxRiskFormula": "netDebit * M", "maxGainFormula": "∞", "explanation": "Profit from big move; lower cost than straddle." },
                "Poor Man's Covered Call": { "maxRiskFormula": "netDebit * M", "maxGainFormula": "(K_call - K_leap - netDebit) * M", "explanation": "LEAPS-backed covered call. Risk is net debit paid." },
                "Protective Put": { "maxRiskFormula": "(S_0 - K_put + netDebit) * M", "maxGainFormula": "∞", "explanation": "Stock protection." },
                "Put Broken Wing": { "maxRiskFormula": "netDebit * M", "maxGainFormula": "(K2 - K1 - netDebit) * M", "explanation": "Variant of butterfly." },
                "Put Ratio Backspread": { "maxRiskFormula": "(K2 - K1 - netCredit) * M", "maxGainFormula": "(K1 - netCredit) * M", "explanation": "Unlimited downside profit; limited upside loss." },
                "Put Ratio Spread": { "maxRiskFormula": "∞", "maxGainFormula": "(K2 - K1 + netCredit) * M", "explanation": "Neutral to slightly bullish; unlimited downside risk." },
                "Reverse Jade Lizard": { "maxRiskFormula": "(K_put - netCredit) * M", "maxGainFormula": "netCredit * M", "explanation": "No downside risk if net credit covers put strike." },
                "Short Call": { "maxRiskFormula": "∞", "maxGainFormula": "netCredit * M", "explanation": "Unlimited risk if stock rises." },
                "Short Call Butterfly": { "maxRiskFormula": "(K2 - K1 - netCredit) * M", "maxGainFormula": "netCredit * M", "explanation": "Limited loss and gain." },
                "Short Call Condor": { "maxRiskFormula": "(D_spread - netCredit) * M", "maxGainFormula": "netCredit * M", "explanation": "Limited loss and profit." },
                "Short Guts": { "maxRiskFormula": "∞", "maxGainFormula": "(netCredit - (K2 - K1)) * M", "explanation": "Unlimited risk, limited reward between strikes." },
                "Short Put": { "maxRiskFormula": "(K - netCredit) * M", "maxGainFormula": "netCredit * M", "explanation": "Income from selling put; risk if stock drops." },
                "Short Put Butterfly": { "maxRiskFormula": "(K2 - K1 - netCredit) * M", "maxGainFormula": "netCredit * M", "explanation": "Limited loss and gain." },
                "Short Put Condor": { "maxRiskFormula": "(D_spread - netCredit) * M", "maxGainFormula": "netCredit * M", "explanation": "Limited loss and profit." },
                "Short Straddle": { "maxRiskFormula": "∞", "maxGainFormula": "netCredit * M", "explanation": "Unlimited risk on both sides." },
                "Short Strangle": { "maxRiskFormula": "∞", "maxGainFormula": "netCredit * M", "explanation": "Unlimited loss; limited gain from credit." },
                "Strap": { "maxRiskFormula": "netDebit * M", "maxGainFormula": "∞", "explanation": "Bullish volatility play (Buy 2 Calls, Buy 1 Put)." },
                "Strip": { "maxRiskFormula": "netDebit * M", "maxGainFormula": "∞", "explanation": "Bearish volatility play (Buy 1 Call, Buy 2 Puts)." },
                "Synthetic Long Stock": { "maxRiskFormula": "∞", "maxGainFormula": "∞", "explanation": "Replicates long stock; unlimited gain and loss." },
                "Synthetic Short Stock": { "maxRiskFormula": "∞", "maxGainFormula": "∞", "explanation": "Replicates short stock; unlimited risk both ways." },
                "Synthetic Put": { "maxRiskFormula": "(K_call - S_0 + netDebit) * M", "maxGainFormula": "(S_0 - netDebit) * M", "explanation": "Replicates a long put." },
                "Wheel": { "maxRiskFormula": "(K_put - netCredit) * M", "maxGainFormula": "netCredit * M", "explanation": "Multi-step strategy. Formulas for Step 1 (selling the put)." }
            }
        };
    }
    return this.formulaDataCache as Record<string, unknown>;
}

export function buildFormulaTooltipContent(
    this: RiskContext,
    trade: Record<string, unknown>,
    metricType: string
): string | null {
    if (!trade || !metricType) return null;
    const strategyName = this.getStrategyDisplayName((trade.strategy as string) || '');
    const formulaData = this.getFormulaData();
    const strategyInfo = (formulaData.strategies as Record<string, Record<string, string>>)[strategyName];
    if (!strategyInfo) return null;
    const details = this.summarizeLegs((trade.legs as unknown[]) || []);
    const context = this.buildRiskFormulaContext(trade, details);
    if (metricType === 'maxRisk') return this.buildMaxRiskTooltip(strategyName, strategyInfo, context, trade);
    if (metricType === 'pl') return this.buildPLTooltip(trade, details, context);
    return null;
}

export function buildMaxRiskTooltip(
    this: RiskContext,
    strategyName: string,
    strategyInfo: Record<string, string>,
    context: RiskFormulaContext | null,
    trade: Record<string, unknown>
): string {
    const html: string[] = [];
    const formulaData = this.getFormulaData();
    html.push(`<div class="formula-tooltip__title"><span class="formula-tooltip__strategy">${this.escapeHtml(strategyName)}</span>Max Risk</div>`);
    if (strategyInfo.explanation) {
        html.push(`<div class="formula-tooltip__section"><div class="formula-tooltip__explanation">${this.escapeHtml(strategyInfo.explanation)}</div></div>`);
    }
    html.push(`<div class="formula-tooltip__section"><div class="formula-tooltip__label">Formula</div><div class="formula-tooltip__formula">${this.escapeHtml(strategyInfo.maxRiskFormula)}</div></div>`);
    if (context) {
        const variables = this.buildVariablesWithExplanations(context, formulaData, trade);
        if (variables.length > 0) {
            html.push(`<div class="formula-tooltip__section"><div class="formula-tooltip__label">Calculation</div><div class="formula-tooltip__variables">`);
            variables.forEach(v => {
                html.push(`<div class="formula-tooltip__variable"><span class="formula-tooltip__variable-name">${this.escapeHtml(v.displayName)}</span><span class="formula-tooltip__variable-value">${this.escapeHtml(v.value)}</span></div>`);
            });
            html.push(`</div></div>`);
        }
    }
    return html.join('');
}

export function buildPLTooltip(
    this: RiskContext,
    trade: Record<string, unknown>,
    details: Record<string, unknown>,
    context: RiskFormulaContext | null
): string {
    const html: string[] = [];
    html.push(`<div class="formula-tooltip__title">P&L Calculation</div>`);
    if (!this.isClosedStatus(trade.status)) {
        html.push(`<div class="formula-tooltip__section"><div class="formula-tooltip__explanation">This position is currently open. P&L shown is unrealized.</div></div>`);
    }
    html.push(`<div class="formula-tooltip__section"><div class="formula-tooltip__label">Formula</div><div class="formula-tooltip__formula">P&L = Total Credits - Total Debits - Fees</div></div>`);
    const plVariables = this.buildPLVariables(trade, details);
    if (plVariables.length > 0) {
        html.push(`<div class="formula-tooltip__section"><div class="formula-tooltip__label">Calculation</div><div class="formula-tooltip__variables">`);
        plVariables.forEach(v => {
            html.push(`<div class="formula-tooltip__variable"><span class="formula-tooltip__variable-name">${this.escapeHtml(v.displayName)}</span><span class="formula-tooltip__variable-value">${this.escapeHtml(v.value)}</span></div>`);
        });
        html.push(`</div></div>`);
    }
    return html.join('');
}

export function buildVariablesWithExplanations(
    this: RiskContext,
    context: RiskFormulaContext,
    formulaData: Record<string, unknown>,
    trade: Record<string, unknown>
): Array<{ displayName: string; value: string }> {
    const variables: Array<{ displayName: string; value: string }> = [];
    const explanations = formulaData.variableExplanations as Record<string, string>;
    const maxRiskValue = Number(trade.maxRisk);

    if (context.S) {
        variables.push({ displayName: `${explanations.S_0 || 'Underlying stock price at entry'} (S_0)`, value: `$${context.S.toFixed(2)}` });
    }

    const strikeMapping = [
        { contextKey: 'K', formulaKey: 'K', shouldShow: () => context.K && !context.K1 },
        { contextKey: 'K1', formulaKey: 'K1' }, { contextKey: 'K2', formulaKey: 'K2' },
        { contextKey: 'K3', formulaKey: 'K3' }, { contextKey: 'K4', formulaKey: 'K4' },
        { contextKey: 'shortPutStrike', formulaKey: 'K_put', shouldShow: () => context.shortPutStrike && !context.K1 },
        { contextKey: 'longPutStrike', formulaKey: 'K_put', shouldShow: () => context.longPutStrike && !context.K1 && !context.shortPutStrike },
        { contextKey: 'shortCallStrike', formulaKey: 'K_call', shouldShow: () => context.shortCallStrike && !context.K1 },
        { contextKey: 'longCallStrike', formulaKey: 'K_call', shouldShow: () => context.longCallStrike && !context.K1 && !context.shortCallStrike }
    ];

    strikeMapping.forEach(mapping => {
        const value = (context as unknown as Record<string, unknown>)[mapping.contextKey] as number;
        if (value && Number.isFinite(value)) {
            const shouldShow = mapping.shouldShow ? mapping.shouldShow() : true;
            if (shouldShow && !variables.some(v => v.displayName.includes(mapping.formulaKey))) {
                const explanation = explanations[mapping.formulaKey] || 'Strike price';
                variables.push({ displayName: `${explanation} (${mapping.formulaKey})`, value: `$${value.toFixed(2)}` });
            }
        }
    });

    if (context.K1 && context.K2) {
        variables.push({ displayName: `${explanations.D_spread || 'Distance between strikes'} (D_spread)`, value: `$${Math.abs(context.K2 - context.K1).toFixed(2)}` });
    } else if (context.defaultWidth && Number.isFinite(context.defaultWidth)) {
        variables.push({ displayName: `${explanations.D_spread || 'Distance between strikes'} (D_spread)`, value: `$${context.defaultWidth.toFixed(2)}` });
    }

    if (context.netCredit > 0) variables.push({ displayName: `${explanations.netCredit || 'Net credit received'} (netCredit)`, value: `$${context.netCredit.toFixed(2)}` });
    if (context.netDebit > 0) variables.push({ displayName: `${explanations.netDebit || 'Net debit paid'} (netDebit)`, value: `$${context.netDebit.toFixed(2)}` });

    if (context.contractValue) {
        const multiplierValue = context.multiplier || 100;
        const totalContracts = context.contracts || 1;
        variables.push({ displayName: `${explanations.M || 'Contract multiplier'} (M)`, value: `${multiplierValue} × ${totalContracts} = ${context.contractValue}` });
    }

    if (!trade.riskIsUnlimited && Number.isFinite(maxRiskValue) && maxRiskValue > 0) {
        variables.push({ displayName: 'Max Risk (Result)', value: `$${maxRiskValue.toFixed(2)}` });
    } else if (trade.riskIsUnlimited || maxRiskValue === Number.POSITIVE_INFINITY) {
        variables.push({ displayName: 'Max Risk (Result)', value: '∞ (Unlimited)' });
    }

    return variables;
}

export function buildPLVariables(
    this: RiskContext,
    trade: Record<string, unknown>,
    details: Record<string, unknown>
): Array<{ displayName: string; value: string }> {
    const variables: Array<{ displayName: string; value: string }> = [];
    if (details && Number.isFinite(details.totalCredit as number)) variables.push({ displayName: 'Total Credits', value: `$${(details.totalCredit as number).toFixed(2)}` });
    if (details && Number.isFinite(details.totalDebit as number)) variables.push({ displayName: 'Total Debits', value: `$${(details.totalDebit as number).toFixed(2)}` });
    if (details && Number.isFinite(details.totalFees as number)) variables.push({ displayName: 'Fees', value: `$${(details.totalFees as number).toFixed(2)}` });
    const plValue = Number(trade.pl);
    if (Number.isFinite(plValue)) variables.push({ displayName: 'P&L (Result)', value: `$${plValue.toFixed(2)}` });
    return variables;
}

export function createFormulaIcon(
    this: RiskContext,
    trade: Record<string, unknown>,
    metricType: string
): HTMLElement | null {
    const wrapper = document.createElement('span');
    wrapper.className = 'formula-value-wrapper';
    const icon = document.createElement('span');
    icon.className = 'formula-info-icon';
    icon.textContent = 'i';
    icon.setAttribute('aria-label', `View ${metricType === 'maxRisk' ? 'max risk' : 'P&L'} calculation`);
    const tooltip = document.createElement('div');
    tooltip.className = 'formula-tooltip';
    tooltip.setAttribute('role', 'tooltip');
    const content = this.buildFormulaTooltipContent(trade, metricType);
    if (content) {
        tooltip.innerHTML = content;

        // Append to <body> so the tooltip is never clipped by AG Grid's transform
        // stacking context. A unique ID links wrapper → tooltip for external callers.
        const tooltipId = `gl-ft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
        tooltip.id = tooltipId;
        wrapper.dataset.tooltipId = tooltipId;
        document.body.appendChild(tooltip);

        const showTooltip = () => {
            this.positionFormulaTooltip(wrapper, tooltip);
            tooltip.classList.add('is-visible');
        };
        const hideTooltip = () => {
            tooltip.classList.remove('is-visible');
        };

        wrapper.appendChild(icon);
        wrapper.addEventListener('mouseenter', showTooltip);
        wrapper.addEventListener('mouseleave', hideTooltip);

        const handleScroll = () => {
            if (tooltip.classList.contains('is-visible')) {
                this.positionFormulaTooltip(wrapper, tooltip);
            }
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        wrapper.addEventListener('mouseleave', () => window.removeEventListener('scroll', handleScroll), { once: true });

        return wrapper;
    }
    return null;
}

export function positionFormulaTooltip(
    this: RiskContext,
    wrapper: HTMLElement,
    tooltip: HTMLElement
): void {
    if (!wrapper || !tooltip) return;
    const iconRect = wrapper.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    let top = iconRect.top - tooltipRect.height - 12;
    let left = iconRect.left + (iconRect.width / 2) - (tooltipRect.width / 2);
    if (top < 10) top = iconRect.bottom + 12;
    if (left < 10) left = 10;
    else if (left + tooltipRect.width > viewportWidth - 10) left = viewportWidth - tooltipRect.width - 10;
    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
}

export function formatStrikeValue(value: unknown): string {
    const strike = Number(value);
    if (!Number.isFinite(strike)) return '—';
    if (Math.abs(strike) >= 1000) return strike.toFixed(0);
    return Number.isInteger(strike) ? strike.toString() : strike.toFixed(2).replace(/\.00$/, '');
}

export function derivePrimaryStrike(
    this: RiskContext,
    summary: Record<string, unknown>
): number | null {
    if (!summary || !Array.isArray(summary.legs)) return null;
    const activeLegs = Array.isArray(summary?.activeOpenLegs) && (summary.activeOpenLegs as unknown[]).length > 0 && summary.hasClosedOutOpenLegs
        ? (summary.activeOpenLegs as Record<string, unknown>[]) : null;
    const openLegs = activeLegs || (summary.legs as Record<string, unknown>[]).filter(leg => this.getLegSide(leg) === 'OPEN');
    const relevantLegs = openLegs.length ? openLegs : (summary.legs as Record<string, unknown>[]);
    const shortOption = relevantLegs.find(leg => this.getLegAction(leg) === 'SELL' && Number.isFinite(Number(leg.strike)));
    if (shortOption) return Number(shortOption.strike);
    const anyOption = relevantLegs.find(leg => Number.isFinite(Number(leg.strike)));
    return anyOption ? Number(anyOption.strike) : null;
}

export function getActiveStrikeForDisplay(
    this: RiskContext,
    summary: Record<string, unknown>
): number | null {
    if (!summary || !Array.isArray(summary.legs) || (summary.legs as unknown[]).length === 0) return null;
    const legsWithStrike = (summary.legs as Record<string, unknown>[]).filter((leg) => Number.isFinite(Number(leg?.strike)));
    if (legsWithStrike.length === 0) return null;
    const optionLegs = legsWithStrike.filter((leg) => ['CALL', 'PUT'].includes(((leg.type as string) || '').toUpperCase()));
    const openOptionLegs = optionLegs.filter((leg) => this.getLegSide(leg) === 'OPEN');
    const openLegs = legsWithStrike.filter((leg) => this.getLegSide(leg) === 'OPEN');
    const candidates = openOptionLegs.length ? openOptionLegs : optionLegs.length ? optionLegs : openLegs.length ? openLegs : legsWithStrike;

    let chosenLeg: Record<string, unknown> | null = null, chosenTimestamp = Number.NEGATIVE_INFINITY, chosenPriority = Number.NEGATIVE_INFINITY, chosenIndex = -1;
    candidates.forEach((leg, index) => {
        const executionDate = leg.executionDate ? new Date(leg.executionDate as string) : null;
        const timestamp = executionDate && !Number.isNaN(executionDate.getTime()) ? executionDate.getTime() : Number.NEGATIVE_INFINITY;
        const actionPriority = this.getLegAction(leg) === 'SELL' ? 1 : 0;
        if (timestamp > chosenTimestamp || (timestamp === chosenTimestamp && actionPriority > chosenPriority) ||
            (timestamp === chosenTimestamp && actionPriority === chosenPriority && index > chosenIndex)) {
            chosenLeg = leg; chosenTimestamp = timestamp; chosenPriority = actionPriority; chosenIndex = index;
        }
    });
    return chosenLeg ? Number((chosenLeg as Record<string, unknown>).strike) : null;
}

export function buildStrikeDisplay(
    this: RiskContext,
    trade: Record<string, unknown>,
    summary: Record<string, unknown> | null = null
): string {
    const legSummary = summary || this.summarizeLegs((trade?.legs as unknown[]) || []);
    const legs = (legSummary?.legs as Record<string, unknown>[]) || [];
    if (legs.length === 0) return '—';
    const activeLegs = Array.isArray(legSummary?.activeOpenLegs) && (legSummary.activeOpenLegs as unknown[]).length > 0 && legSummary.hasClosedOutOpenLegs
        ? (legSummary.activeOpenLegs as Record<string, unknown>[]) : null;
    const openLegs = activeLegs || legs.filter(leg => this.getLegSide(leg) === 'OPEN');
    const relevantLegs = openLegs.length ? openLegs : legs;
    const optionLegs = relevantLegs.filter(leg => ['CALL', 'PUT'].includes(leg.type as string) && Number.isFinite(Number(leg.strike)));

    if (optionLegs.length > 0) {
        const grouped = optionLegs.reduce((acc: Record<string, Set<number>>, leg) => {
            const key = leg.type === 'CALL' ? 'C' : 'P';
            if (!acc[key]) acc[key] = new Set();
            acc[key].add(Number(leg.strike));
            return acc;
        }, {});
        const segments = Object.entries(grouped)
            .map(([label, strikes]) => `${label}${Array.from(strikes as Set<number>).sort((a, b) => a - b).map(s => formatStrikeValue(s)).join('/')}`)
            .sort();
        return segments.join(' · ') || '—';
    }

    const stockLegs = relevantLegs.filter(leg => leg.type === 'STOCK');
    if (stockLegs.length > 0) {
        const shares = stockLegs.reduce((sum, leg) => {
            const quantity = (leg.quantity as number) * this.getLegMultiplier(leg);
            return sum + (this.getLegAction(leg) === 'BUY' ? quantity : -quantity);
        }, 0);
        const totalShares = Math.abs(Math.round(shares));
        if (totalShares > 0) return `${totalShares} sh`;
    }
    return '—';
}
