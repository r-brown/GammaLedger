// src/trades/legs.ts — Wave 3: Leg normalisation and analysis helpers.
// All functions use the `.call(this, …)` delegation pattern.

import type { NormalizedLeg } from '@types-gl/leg'
import type { LegSummary } from '@types-gl/leg-summary'
import type { LegLifecycleResult } from '@types-gl/lifecycle'
import type { ExitReason } from '@types-gl/common'
import { NormalizedLegInputSchema } from '@core/schema'
import { toRiskValue } from './risk'

interface VerticalSpreadInfo {
    width: number
    multiplier: number
    contracts: number
}

interface OpenOptionGroupEntry {
    leg: NormalizedLeg
    action: string
    side: string
}

function isProvided(value: unknown): boolean {
    return value !== undefined && value !== null && value !== '';
}

function assertPositiveMultiplier(value: unknown, context: string): number {
    const multiplier = Number(value);
    if (!Number.isFinite(multiplier) || multiplier <= 0) {
        throw new Error(`Invalid ${context} multiplier: ${String(value)}`);
    }
    return multiplier;
}

/** All this.* dependencies required by legs.ts functions */
interface LegsContext {
    // Leg order / action helpers (self-referential)
    normalizeLegOrderType(orderType: unknown): string
    mapOrderTypeToActionSide(orderType: string): { action: string; side: string }
    getLegOrderDescriptor(leg: Record<string, unknown>): { action: string; side: string }
    getLegAction(leg: Record<string, unknown>): string
    getLegSide(leg: Record<string, unknown>): string
    deriveOrderTypeFromActionSide(action: unknown, side: unknown): string
    normalizeLegAction(action: unknown): string
    normalizeLegSide(side: unknown): string
    normalizeLegType(type: unknown): string
    getLegMultiplier(leg: Record<string, unknown>): number
    normalizeLeg(leg: Record<string, unknown>, index?: number): NormalizedLeg
    calculateLegCashFlow(leg: Record<string, unknown>): number
    summarizeLegs(legs: unknown[]): LegSummary
    buildLegLifecycleKey(leg: Record<string, unknown>): string
    getNormalizedLegOrderType(leg: Record<string, unknown>): string
    determineTradeLifecycleStatus(trade: Record<string, unknown>, summary: LegSummary): LegLifecycleResult
    enrichTradeData(trade: Record<string, unknown>): Record<string, unknown>
    getPrimaryLeg(trade: Record<string, unknown>): Record<string, unknown> | null
    deriveTradeTypeFromLeg(leg: Record<string, unknown> | null): string
    deriveTradeDirectionFromLeg(leg: Record<string, unknown> | null): string
    getTradeType(trade: Record<string, unknown>): string
    inferTradeDirection(trade: Record<string, unknown>): string
    hasNetOpenOptionLegs(trade: Record<string, unknown>): boolean
    hasNonExpiredOpenShortOptions(trade: Record<string, unknown>): boolean
    getNetOpenOptionContracts(legs: unknown[]): number
    getNetOpenShortCalls(legs: unknown[]): { contracts: number; details: unknown[] }
    // External helpers
    normalizeUnderlyingType(type: unknown, opts?: { fallback?: string }): string
    getDefaultMultiplierForLegType(type: string, underlyingType?: string): number
    computeMaxRiskUsingFormula(trade: Record<string, unknown>, summary: LegSummary): number
    parseDateValue(value: unknown): Date | null
    normalizeStatus(status: unknown): string
    isAssignmentTrade(trade: Record<string, unknown>): boolean
    normalizeTradeStatusInput(input: unknown): string
    isClosedStatus(status: unknown): boolean
    isWheelOrPmccTrade(trade: Record<string, unknown>): boolean
    isPmccTrade(trade: Record<string, unknown>): boolean
    getTradeWheelCoverage(trade: Record<string, unknown>): string
    getTradeOpenStockShares(trade: Record<string, unknown>): number
    getNetOpenLongCallContracts(trade: Record<string, unknown>): number
    computeWheelEffectiveCostBasis(trade: Record<string, unknown>): { shares: number; assignmentCostBasis: number; effectiveCostBasis: number }
    assessRisk(trade: Record<string, unknown>, summary: LegSummary): { maxRiskValue: number; maxRiskLabel: string; unlimited: boolean }
    getStrategyDisplayName(name: string): string
    derivePrimaryStrike(summary: LegSummary): number | null
    buildStrikeDisplay(trade: Record<string, unknown>, summary?: LegSummary | null): string
    getActiveStrikeForDisplay(summary: LegSummary): number | null
    formatCurrency(value: number): string
    calculatePL(trade: Record<string, unknown>): number
    calculateROI(trade: Record<string, unknown>): number
    calculateMaxRisk(trade: Record<string, unknown>): number
    calculateDaysHeld(trade: Record<string, unknown>): number
    calculateDTE(expirationDate: string, trade: Record<string, unknown>): number
    calculateWeeklyROI(trade: Record<string, unknown>): number
    calculateMonthlyROI(trade: Record<string, unknown>): number
    calculateAnnualizedROI(trade: Record<string, unknown>): number
    // Optional external helpers
    getCachedQuote?: (ticker: string) => { value?: { price?: number } } | null
    // Properties
    currentDate: Date | unknown
    _wheelPriceFallbackWarned?: boolean
}

export function normalizeLegOrderType(orderType: unknown): string {
    const value = ((orderType as string) || '').toString().trim().toUpperCase();
    if (['BTO', 'STO', 'BTC', 'STC'].includes(value)) {
        return value;
    }
    const normalized = value
        .replace('BUY TO OPEN', 'BTO')
        .replace('SELL TO OPEN', 'STO')
        .replace('BUY TO CLOSE', 'BTC')
        .replace('SELL TO CLOSE', 'STC');
    if (['BTO', 'STO', 'BTC', 'STC'].includes(normalized)) {
        return normalized;
    }
    if (value.startsWith('B')) {
        return value.includes('C') ? 'BTC' : 'BTO';
    }
    if (value.startsWith('S')) {
        return value.includes('C') ? 'STC' : 'STO';
    }
    return 'BTO';
}

export function mapOrderTypeToActionSide(
    this: LegsContext,
    orderType: unknown
): { action: string; side: string } {
    switch (this.normalizeLegOrderType(orderType)) {
        case 'BTO':
            return { action: 'BUY', side: 'OPEN' };
        case 'STO':
            return { action: 'SELL', side: 'OPEN' };
        case 'BTC':
            return { action: 'BUY', side: 'CLOSE' };
        case 'STC':
            return { action: 'SELL', side: 'CLOSE' };
        default:
            return { action: 'BUY', side: 'OPEN' };
    }
}

export function getLegOrderDescriptor(
    this: LegsContext,
    leg: Record<string, unknown> = {}
): { action: string; side: string } {
    const rawOrderType = (leg?.orderType as string) || (leg?.tradeType as string) || (leg?.order as string);
    if (rawOrderType) {
        return this.mapOrderTypeToActionSide(this.normalizeLegOrderType(rawOrderType));
    }

    const normalizedAction = this.normalizeLegAction(leg?.action);
    const normalizedSide = this.normalizeLegSide(leg?.side);
    if (normalizedAction || normalizedSide) {
        return this.mapOrderTypeToActionSide(
            this.deriveOrderTypeFromActionSide(normalizedAction || 'BUY', normalizedSide || 'OPEN')
        );
    }
    return { action: 'BUY', side: 'OPEN' };
}

export function getLegAction(
    this: LegsContext,
    leg: Record<string, unknown> = {}
): string {
    return this.getLegOrderDescriptor(leg).action;
}

export function getLegSide(
    this: LegsContext,
    leg: Record<string, unknown> = {}
): string {
    return this.getLegOrderDescriptor(leg).side;
}

export function deriveOrderTypeFromActionSide(
    this: LegsContext,
    action: unknown,
    side: unknown
): string {
    const normalizedAction = this.normalizeLegAction(action);
    const normalizedSide = this.normalizeLegSide(side);
    if (normalizedSide === 'ROLL') {
        return normalizedAction === 'SELL' ? 'STO' : 'BTO';
    }
    if (normalizedAction === 'BUY' && normalizedSide === 'OPEN') return 'BTO';
    if (normalizedAction === 'SELL' && normalizedSide === 'OPEN') return 'STO';
    if (normalizedAction === 'BUY' && normalizedSide === 'CLOSE') return 'BTC';
    if (normalizedAction === 'SELL' && normalizedSide === 'CLOSE') return 'STC';
    return 'BTO';
}

export function normalizeLegAction(action: unknown): string {
    const value = ((action as string) || '').toString().trim().toUpperCase();
    if (['SELL', 'SHORT', 'STO', 'STC'].includes(value)) {
        return 'SELL';
    }
    return 'BUY';
}

export function normalizeLegSide(side: unknown): string {
    const value = ((side as string) || '').toString().trim().toUpperCase();
    if (value.startsWith('ROL')) return 'ROLL';
    if (['CALL', 'PUT', 'STOCK'].includes(value)) return 'CLOSE';
    if (['CASH', 'FUTURE', 'ETF', 'SHARES', 'STK'].includes(value)) return 'STOCK';
    if (['BTO', 'STO'].includes(value)) return 'OPEN';
    if (['BTC', 'STC'].includes(value)) return 'CLOSE';
    return 'OPEN';
}

export function normalizeLegType(type: unknown): string {
    const value = ((type as string) || '').toString().trim().toUpperCase();
    if (['CALL', 'PUT', 'STOCK', 'CASH', 'FUTURE', 'ETF'].includes(value)) {
        return value;
    }
    if (value === 'SHARES') return 'STOCK';
    return value || 'UNKNOWN';
}

export function getLegMultiplier(
    this: LegsContext,
    leg: Record<string, unknown>
): number {
    if (isProvided(leg?.multiplier)) {
        return assertPositiveMultiplier(leg.multiplier, 'leg');
    }
    const type = this.normalizeLegType(leg?.type);
    if (type === 'STOCK' || type === 'CASH') {
        return 1;
    }
    // getDefaultMultiplierForLegType always returns 100 for option legs regardless of underlyingType
    return this.getDefaultMultiplierForLegType(type);
}

export function normalizeLeg(
    this: LegsContext,
    leg: Record<string, unknown>,
    index = 0
): NormalizedLeg {
    const parsedLeg = NormalizedLegInputSchema.parse(leg || {});
    const normalizedQuantity = parsedLeg.quantity ?? 0;

    const inferredOrderType = this.normalizeLegOrderType(
        parsedLeg.orderType ||
        parsedLeg.tradeType ||
        parsedLeg.order ||
        this.deriveOrderTypeFromActionSide(parsedLeg.action, parsedLeg.side)
    );
    const externalIdValue = parsedLeg.externalId;
    const importGroupIdValue = parsedLeg.importGroupId;
    const importSourceValue = parsedLeg.importSource;

    return {
        id: parsedLeg.id || `LEG-${Date.now()}-${index}`,
        orderType: inferredOrderType as NormalizedLeg['orderType'],
        type: this.normalizeLegType(parsedLeg.type) as NormalizedLeg['type'],
        quantity: normalizedQuantity,
        multiplier: this.getLegMultiplier(leg),
        executionDate: parsedLeg.executionDate,
        expirationDate: parsedLeg.expirationDate,
        strike: parsedLeg.strike ?? null,
        premium: parsedLeg.premium ?? 0,
        fees: parsedLeg.fees ?? 0,
        underlyingPrice: parsedLeg.underlyingPrice ?? null,
        externalId: externalIdValue ?? null,
        importGroupId: importGroupIdValue ?? null,
        importSource: importSourceValue ?? null
    };
}

export function calculateLegCashFlow(
    this: LegsContext,
    leg: Record<string, unknown>
): number {
    if (!leg) return 0;
    const quantity = Math.abs(Number(leg.quantity) || 0);
    if (!quantity) return -(Number(leg.fees) || 0);
    const multiplier = this.getLegMultiplier(leg);
    let premium = Number(leg.premium) || 0;
    const legType = this.normalizeLegType(leg.type);
    if (legType === 'STOCK' && premium === 0) {
        premium = Number(leg.strike) || 0;
    }
    const fees = Number(leg.fees) || 0;
    const direction = this.getLegAction(leg) === 'SELL' ? 1 : -1;
    return direction * premium * multiplier * quantity - fees;
}

export function summarizeLegs(
    this: LegsContext,
    legs: unknown[] = []
): LegSummary {
    const summary: LegSummary = {
        legs: [],
        legsCount: 0,
        openLegs: 0,
        closeLegs: 0,
        rollLegs: 0,
        totalFees: 0,
        totalDebit: 0,
        totalCredit: 0,
        cashFlow: 0,
        openCashFlow: 0,
        closeCashFlow: 0,
        openedDate: null,
        closedDate: null,
        earliestExpiration: null,
        latestExpiration: null,
        primaryLeg: null,
        openContracts: 0,
        closeContracts: 0,
        capitalAtRisk: 0,
        entryPrice: null,
        exitPrice: null,
        openCreditGross: 0,
        openDebitGross: 0,
        openFees: 0,
        openBaseContracts: 0,
        verticalSpread: null,
        nearestShortCallExpiration: null,
        nextShortCallExpiration: null,
        activeOpenLegs: [],
        hasClosedOutOpenLegs: false
    };

    if (!Array.isArray(legs) || legs.length === 0) {
        return summary;
    }

    const normalizedLegs = (legs as Record<string, unknown>[]).map((leg, index) => this.normalizeLeg(leg, index));
    summary.legs = normalizedLegs;
    summary.legsCount = normalizedLegs.length;
    const openOptionGroups = new Map<string, OpenOptionGroupEntry[]>();
    const now = this.currentDate instanceof Date ? this.currentDate : new Date();
    const shortCallPositions = new Map<string, number>();
    const openBaseContractsByKey = new Map<string, number>();

    normalizedLegs.forEach((leg, index) => {
        const originalLeg = Array.isArray(legs) ? legs[index] as Record<string, unknown> : null;
        const derivedAction = this.getLegAction(leg as unknown as Record<string, unknown>);
        const derivedSide = this.getLegSide(leg as unknown as Record<string, unknown>);
        const originalAction = this.normalizeLegAction(originalLeg?.action);
        const originalSide = this.normalizeLegSide(originalLeg?.side);
        const action = derivedAction || originalAction;
        const side = originalSide === 'ROLL' ? 'ROLL' : derivedSide;
        const cashFlow = this.calculateLegCashFlow(leg as unknown as Record<string, unknown>);
        summary.cashFlow += cashFlow;
        summary.totalFees += Number(leg.fees) || 0;

        const quantity = Math.abs(Number(leg.quantity) || 0);
        if (quantity) {
            if (side === 'OPEN') {
                summary.openLegs += 1;
                summary.openContracts += quantity;
                summary.openCashFlow += cashFlow;

                const multiplier = this.getLegMultiplier(leg as unknown as Record<string, unknown>);
                const grossPremium = Math.abs(Number(leg.premium) || 0) * multiplier * quantity;
                if (action === 'SELL') {
                    summary.openCreditGross += grossPremium;
                } else {
                    summary.openDebitGross += grossPremium;
                }
                summary.openFees += Number(leg.fees) || 0;
                const openLifecycleKey = this.buildLegLifecycleKey(leg as unknown as Record<string, unknown>);
                openBaseContractsByKey.set(openLifecycleKey, (openBaseContractsByKey.get(openLifecycleKey) || 0) + quantity);

                if (['CALL', 'PUT'].includes(leg.type) && Number.isFinite(Number(leg.strike))) {
                    const key = `${leg.type}|${leg.expirationDate || ''}`;
                    if (!openOptionGroups.has(key)) openOptionGroups.set(key, []);
                    openOptionGroups.get(key)!.push({ leg, action, side });
                }
            } else if (side === 'CLOSE') {
                summary.closeLegs += 1;
                summary.closeContracts += quantity;
                summary.closeCashFlow += cashFlow;
            } else if (side === 'ROLL') {
                summary.rollLegs += 1;
            }
        }

        if (action === 'BUY') {
            summary.totalDebit += Math.abs(cashFlow + (Number(leg.fees) || 0));
        } else {
            summary.totalCredit += Math.abs(cashFlow + (Number(leg.fees) || 0));
        }

        if (leg.executionDate) {
            const exec = new Date(leg.executionDate);
            if (!Number.isNaN(exec.getTime())) {
                if (!summary.openedDate || exec < summary.openedDate) summary.openedDate = exec;
                if (!summary.closedDate || exec > summary.closedDate) summary.closedDate = exec;
            }
        }

        if (leg.expirationDate) {
            const exp = new Date(leg.expirationDate);
            if (!Number.isNaN(exp.getTime())) {
                if (!summary.earliestExpiration || exp < summary.earliestExpiration) summary.earliestExpiration = exp;
                if (!summary.latestExpiration || exp > summary.latestExpiration) summary.latestExpiration = exp;

                if (action === 'SELL' && leg.type === 'CALL') {
                    const key = `${leg.strike}|${leg.expirationDate}`;
                    const qty = Math.abs(Number(leg.quantity) || 0);
                    if (side === 'OPEN') {
                        shortCallPositions.set(key, (shortCallPositions.get(key) || 0) + qty);
                    } else if (side === 'CLOSE') {
                        shortCallPositions.set(key, (shortCallPositions.get(key) || 0) - qty);
                    }
                } else if (action === 'BUY' && leg.type === 'CALL' && side === 'CLOSE') {
                    const key = `${leg.strike}|${leg.expirationDate}`;
                    const qty = Math.abs(Number(leg.quantity) || 0);
                    shortCallPositions.set(key, (shortCallPositions.get(key) || 0) - qty);
                }
            }
        }

        if (!summary.primaryLeg && side !== 'CLOSE') summary.primaryLeg = leg;
    });

    if (!summary.primaryLeg) summary.primaryLeg = normalizedLegs[0];

    shortCallPositions.forEach((netQuantity, key) => {
        if (netQuantity <= 0) return;
        const [, expirationStr] = key.split('|');
        const exp = expirationStr ? new Date(expirationStr) : null;
        if (!exp || Number.isNaN(exp.getTime())) return;
        if (!summary.nearestShortCallExpiration || exp < summary.nearestShortCallExpiration) {
            summary.nearestShortCallExpiration = exp;
        }
        const expWithMarketClose = new Date(Date.UTC(
            exp.getUTCFullYear(), exp.getUTCMonth(), exp.getUTCDate(), 21, 0, 0
        ));
        if (expWithMarketClose >= (now as Date)) {
            if (!summary.nextShortCallExpiration || exp < summary.nextShortCallExpiration) {
                summary.nextShortCallExpiration = exp;
            }
        }
    });

    openBaseContractsByKey.forEach((qty) => {
        if (qty > summary.openBaseContracts) summary.openBaseContracts = qty;
    });

    const netPositionMap = new Map<string, { openQty: number; closeQty: number; openLegs: NormalizedLeg[] }>();
    normalizedLegs.forEach((leg) => {
        const type = (leg.type || '').toUpperCase();
        if (!['CALL', 'PUT'].includes(type)) return;
        const quantity = Math.abs(Number(leg.quantity) || 0);
        if (!quantity) return;
        const key = this.buildLegLifecycleKey(leg as unknown as Record<string, unknown>);
        const side = this.getLegSide(leg as unknown as Record<string, unknown>);
        if (!netPositionMap.has(key)) netPositionMap.set(key, { openQty: 0, closeQty: 0, openLegs: [] });
        const entry = netPositionMap.get(key)!;
        if (side === 'OPEN') { entry.openQty += quantity; entry.openLegs.push(leg); }
        else if (side === 'CLOSE') { entry.closeQty += quantity; }
    });

    const activeOpenLegs: NormalizedLeg[] = [];
    let hasClosedOutOpenLegs = false;
    netPositionMap.forEach((entry) => {
        const net = entry.openQty - entry.closeQty;
        if (net <= 0) {
            if (entry.openQty > 0 && entry.closeQty > 0) hasClosedOutOpenLegs = true;
            return;
        }
        if (entry.closeQty > 0) hasClosedOutOpenLegs = true;
        let remaining = net;
        const reversedLegs = [...entry.openLegs].reverse();
        for (const leg of reversedLegs) {
            if (remaining <= 0) break;
            const legQty = Math.abs(Number(leg.quantity) || 0);
            const activeQty = Math.min(legQty, remaining);
            if (activeQty > 0) {
                activeOpenLegs.push({ ...leg, quantity: activeQty });
                remaining -= activeQty;
            }
        }
    });

    summary.activeOpenLegs = activeOpenLegs;
    summary.hasClosedOutOpenLegs = hasClosedOutOpenLegs;

    if (hasClosedOutOpenLegs && activeOpenLegs.length > 0) {
        const activeOptionGroups = new Map<string, OpenOptionGroupEntry[]>();
        let activeBaseContracts = 0;
        let activeCreditGross = 0;
        let activeDebitGross = 0;
        let activeFees = 0;
        let activeOpenCashFlow = 0;

        activeOpenLegs.forEach((leg) => {
            const action = this.getLegAction(leg as unknown as Record<string, unknown>);
            const quantity = Math.abs(Number(leg.quantity) || 0);
            const multiplier = this.getLegMultiplier(leg as unknown as Record<string, unknown>) || 1;
            const premium = Number(leg.premium) || 0;
            const fees = Number(leg.fees) || 0;
            const cashFlow = this.calculateLegCashFlow(leg as unknown as Record<string, unknown>);
            activeOpenCashFlow += cashFlow;
            activeFees += fees;
            const grossPremium = Math.abs(premium) * multiplier * quantity;
            if (action === 'SELL') activeCreditGross += grossPremium;
            else activeDebitGross += grossPremium;
            if (['CALL', 'PUT'].includes(leg.type) && Number.isFinite(Number(leg.strike))) {
                const key = `${leg.type}|${leg.expirationDate || ''}`;
                if (!activeOptionGroups.has(key)) activeOptionGroups.set(key, []);
                activeOptionGroups.get(key)!.push({ leg, action, side: 'OPEN' });
            }
        });

        const activeStrikeQty = new Map<string, number>();
        activeOpenLegs.forEach((leg) => {
            const quantity = Math.abs(Number(leg.quantity) || 0);
            if (!quantity) return;
            const key = this.buildLegLifecycleKey(leg as unknown as Record<string, unknown>);
            activeStrikeQty.set(key, (activeStrikeQty.get(key) || 0) + quantity);
        });
        activeStrikeQty.forEach((qty) => {
            if (qty > activeBaseContracts) activeBaseContracts = qty;
        });

        summary.openBaseContracts = activeBaseContracts || summary.openBaseContracts;
        summary.openCreditGross = activeCreditGross;
        summary.openDebitGross = activeDebitGross;
        summary.openFees = activeFees;
        summary.openCashFlow = activeOpenCashFlow;

        const activePrimaryLeg = activeOpenLegs.find(
            leg => this.getLegAction(leg as unknown as Record<string, unknown>) === 'SELL' && Number.isFinite(Number(leg.strike))
        );
        if (activePrimaryLeg) summary.primaryLeg = activePrimaryLeg;
        else if (activeOpenLegs.length > 0) summary.primaryLeg = activeOpenLegs[0];

        openOptionGroups.clear();
        activeOptionGroups.forEach((value, key) => openOptionGroups.set(key, value));
    }

    let verticalSpreadInfo: VerticalSpreadInfo | null = null;
    for (const legsGroup of openOptionGroups.values()) {
        if (!Array.isArray(legsGroup) || legsGroup.length < 2) continue;
        const hasBuy = legsGroup.some(({ action }) => action === 'BUY');
        const hasSell = legsGroup.some(({ action }) => action === 'SELL');
        if (!hasBuy || !hasSell) continue;
        const strikes = legsGroup.map(({ leg }) => Number(leg.strike)).filter(Number.isFinite);
        if (strikes.length < 2) continue;
        const spreadWidth = Math.abs(Math.max(...strikes) - Math.min(...strikes));
        if (!(spreadWidth > 0)) continue;
        const multiplier = this.getLegMultiplier(legsGroup[0]?.leg as unknown as Record<string, unknown>) || 1;
        const buyQty = legsGroup.filter(({ action }) => action === 'BUY').reduce((sum, { leg }) => sum + Math.abs(Number(leg.quantity) || 0), 0);
        const sellQty = legsGroup.filter(({ action }) => action === 'SELL').reduce((sum, { leg }) => sum + Math.abs(Number(leg.quantity) || 0), 0);
        const contracts = Math.min(buyQty || 1, sellQty || 1);
        verticalSpreadInfo = { width: spreadWidth, multiplier, contracts: contracts || 1 };
        break;
    }
    summary.verticalSpread = verticalSpreadInfo;

    const primaryMultiplier = this.getLegMultiplier(summary.primaryLeg as unknown as Record<string, unknown>) || 1;
    const contractsForEntryRaw = summary.openContracts || Math.abs(Number(summary.primaryLeg?.quantity) || 0);
    const fallbackContracts = contractsForEntryRaw || 1;
    const effectiveContractsForEntry = verticalSpreadInfo?.contracts || summary.openBaseContracts || fallbackContracts;
    const contractsForExit = summary.closeContracts || 0;

    const openEntryCash = Number(summary.openCashFlow);
    if (Number.isFinite(openEntryCash) && effectiveContractsForEntry > 0 && primaryMultiplier > 0) {
        summary.entryPrice = Math.abs(openEntryCash) / (effectiveContractsForEntry * primaryMultiplier);
    } else if (fallbackContracts > 0 && primaryMultiplier > 0) {
        summary.entryPrice = Math.abs(summary.openCashFlow) / (fallbackContracts * primaryMultiplier);
    }

    if (contractsForExit > 0) {
        summary.exitPrice = Math.abs(summary.closeCashFlow) / (contractsForExit * primaryMultiplier);
    }

    summary.capitalAtRisk = this.computeMaxRiskUsingFormula({ legs: normalizedLegs } as unknown as Record<string, unknown>, summary);

    return summary;
}

export function hasNetOpenOptionLegs(
    this: LegsContext,
    trade: Record<string, unknown> = {}
): boolean {
    const legs = Array.isArray(trade?.legs) ? trade.legs as unknown[] : [];
    if (!legs.length) return false;

    const summary = this.summarizeLegs(legs);
    const normalizedLegs = Array.isArray(summary?.legs) ? summary.legs : [];
    if (!normalizedLegs.length) return false;

    const optionNet = new Map<string, number>();
    normalizedLegs.forEach((leg) => {
        if (!leg || !['CALL', 'PUT'].includes((leg.type || '').toUpperCase())) return;
        const quantity = Math.abs(Number(leg.quantity) || 0);
        if (!quantity) return;
        const key = `${leg.type}|${leg.strike ?? ''}|${leg.expirationDate ?? ''}`;
        const side = this.getLegSide(leg as unknown as Record<string, unknown>);
        if (side === 'OPEN') optionNet.set(key, (optionNet.get(key) || 0) + quantity);
        else if (side === 'CLOSE') optionNet.set(key, (optionNet.get(key) || 0) - quantity);
    });

    if (!optionNet.size) return false;
    return Array.from(optionNet.values()).some(count => count > 0);
}

export function hasNonExpiredOpenShortOptions(
    this: LegsContext,
    trade: Record<string, unknown> = {}
): boolean {
    const legs = Array.isArray(trade?.legs) ? trade.legs as unknown[] : [];
    if (!legs.length) return false;

    const summary = this.summarizeLegs(legs);
    const normalizedLegs = Array.isArray(summary?.legs) ? summary.legs : [];
    if (!normalizedLegs.length) return false;

    const now = this.currentDate instanceof Date ? this.currentDate : new Date();
    const shortNet = new Map<string, { net: number; expiration: string }>();

    normalizedLegs.forEach((leg) => {
        if (!leg || !['CALL', 'PUT'].includes((leg.type || '').toUpperCase())) return;
        const quantity = Math.abs(Number(leg.quantity) || 0);
        if (!quantity) return;
        const orderType = this.getNormalizedLegOrderType(leg as unknown as Record<string, unknown>);
        if (orderType !== 'STO' && orderType !== 'BTC') return;
        const key = `${leg.type}|${leg.strike ?? ''}|${leg.expirationDate ?? ''}`;
        if (!shortNet.has(key)) shortNet.set(key, { net: 0, expiration: leg.expirationDate || '' });
        const entry = shortNet.get(key)!;
        if (orderType === 'STO') entry.net += quantity;
        else if (orderType === 'BTC') entry.net -= quantity;
    });

    if (!shortNet.size) return false;

    for (const [, entry] of shortNet) {
        if (entry.net <= 0) continue;
        if (!entry.expiration) return true;
        const expDate = this.parseDateValue(entry.expiration);
        if (!expDate) return true;
        const expWithMarketClose = new Date(Date.UTC(
            expDate.getUTCFullYear(), expDate.getUTCMonth(), expDate.getUTCDate(), 21, 0, 0
        ));
        if ((now as Date).getTime() <= expWithMarketClose.getTime()) return true;
    }
    return false;
}

export function getNetOpenOptionContracts(
    this: LegsContext,
    legs: unknown[] = []
): number {
    const normalizedLegs = Array.isArray(legs) ? legs as Record<string, unknown>[] : [];
    if (!normalizedLegs.length) return 0;

    const optionNet = new Map<string, number>();
    normalizedLegs.forEach((leg) => {
        if (!leg || !['CALL', 'PUT'].includes(((leg.type as string) || '').toUpperCase())) return;
        const quantity = Math.abs(Number(leg.quantity) || 0);
        if (!quantity) return;
        const key = `${leg.type}|${leg.strike ?? ''}|${leg.expirationDate ?? ''}`;
        const side = this.getLegSide(leg);
        if (side === 'OPEN') optionNet.set(key, (optionNet.get(key) || 0) + quantity);
        else if (side === 'CLOSE') optionNet.set(key, (optionNet.get(key) || 0) - quantity);
    });

    if (!optionNet.size) return 0;
    return Array.from(optionNet.values()).reduce((sum, count) => sum + Math.max(0, Number(count) || 0), 0);
}

export function getNetOpenShortCalls(
    this: LegsContext,
    legs: unknown[] = []
): { contracts: number; details: Array<{ strike: unknown; expiration: string; contracts: number }> } {
    const normalizedLegs = Array.isArray(legs) ? legs as Record<string, unknown>[] : [];
    if (!normalizedLegs.length) return { contracts: 0, details: [] };

    const now = this.currentDate instanceof Date ? this.currentDate : new Date();
    const shortCallNet = new Map<string, { net: number; strike: unknown; expiration: string }>();

    normalizedLegs.forEach((leg) => {
        const type = ((leg.type as string) || (leg.optionType as string) || '').toString().trim().toUpperCase();
        if (type !== 'CALL') return;
        const quantity = Math.abs(Number(leg.quantity) || 0);
        if (!quantity) return;
        const action = this.getLegAction(leg);
        const side = this.getLegSide(leg);
        const strike = leg.strike ?? '';
        const expiration = (leg.expirationDate as string) ?? '';
        const key = `${strike}|${expiration}`;

        if (action === 'SELL' && (side === 'OPEN' || side === 'ROLL')) {
            if (!shortCallNet.has(key)) shortCallNet.set(key, { net: 0, strike, expiration });
            shortCallNet.get(key)!.net += quantity;
        } else if (action === 'BUY' && side === 'CLOSE') {
            if (!shortCallNet.has(key)) shortCallNet.set(key, { net: 0, strike, expiration });
            shortCallNet.get(key)!.net -= quantity;
        } else if (action === 'SELL' && side === 'CLOSE') {
            if (!shortCallNet.has(key)) shortCallNet.set(key, { net: 0, strike, expiration });
            shortCallNet.get(key)!.net -= quantity;
        }
    });

    const openPositions: Array<{ strike: unknown; expiration: string; contracts: number }> = [];
    let totalContracts = 0;

    shortCallNet.forEach((data) => {
        if (data.net <= 0) return;
        if (data.expiration) {
            const expDate = this.parseDateValue(data.expiration);
            if (expDate) {
                const expWithMarketClose = new Date(expDate);
                expWithMarketClose.setUTCHours(21, 0, 0, 0);
                if (expWithMarketClose < (now as Date)) return;
            }
        }
        totalContracts += data.net;
        openPositions.push({ strike: data.strike, expiration: data.expiration, contracts: data.net });
    });

    return { contracts: totalContracts, details: openPositions };
}

export function buildLegLifecycleKey(
    this: LegsContext,
    leg: Record<string, unknown> = {}
): string {
    const type = this.normalizeLegType(leg.type);
    const strikeValue = Number(leg.strike);
    const strike = Number.isFinite(strikeValue) ? strikeValue.toFixed(4) : 'NA';
    const expiration = ((leg.expirationDate as string) || '').toString();
    const multiplier = this.getLegMultiplier(leg) || 1;
    return `${type}|${strike}|${expiration}|${multiplier}`;
}

export function getNormalizedLegOrderType(
    this: LegsContext,
    leg: Record<string, unknown> = {}
): string {
    const rawOrder = (leg.orderType as string) || (leg.tradeType as string) || (leg.order as string);
    const normalizedOrder = this.normalizeLegOrderType(rawOrder);
    if (normalizedOrder) return normalizedOrder;
    const { action, side } = this.getLegOrderDescriptor(leg);
    return this.normalizeLegOrderType(this.deriveOrderTypeFromActionSide(action, side));
}

export function determineTradeLifecycleStatus(
    this: LegsContext,
    trade: Record<string, unknown> = {},
    summary: LegSummary = {} as LegSummary
): LegLifecycleResult {
    const legs = Array.isArray(summary?.legs) ? summary.legs : [];
    const result: LegLifecycleResult = {
        status: 'Open',
        exitReason: null,
        effectiveClosedDate: null,
        openContractsOverride: undefined,
        meta: {
            matchedPairs: 0,
            unmatchedExposure: 0,
            expirationPassed: false,
            hasRollLegs: false,
            hasCloseActivity: false,
            hasAssignmentEvent: false,
            hasExpirationEvent: false,
            hasOpenStockPosition: false,
            hasCashSettlementEvent: false,
            activityAfterExpiration: false
        }
    };

    if (legs.length === 0) {
        return result;
    }

    const pairMap = new Map<string, { longOpen: number; longClose: number; shortOpen: number; shortClose: number }>();
    let hasRollLegs = false;
    let hasCloseActivity = false;
    let hasAssignmentEvent = false;
    let hasExpirationEvent = false;
    let hasCashSettlementEvent = false;

    // Track stock position separately (stocks don't expire)
    let stockBought = 0;
    let stockSold = 0;
    // Track assignment strikes from BTO STOCK legs (strike = assignment price)
    const assignmentStrikes = new Map<number, number>(); // strike → total shares

    legs.forEach((leg) => {
        const quantity = Math.abs(Number(leg.quantity) || 0);
        if (!quantity) {
            return;
        }

        const orderType = this.getNormalizedLegOrderType(leg as unknown as Record<string, unknown>);
        const legType = this.normalizeLegType(leg.type);

        // Track stock positions separately — do not add to pairMap.
        if (legType === 'STOCK') {
            const stockMultiplier = this.getLegMultiplier(leg as unknown as Record<string, unknown>);
            const shares = quantity * stockMultiplier;
            if (orderType === 'BTO') {
                stockBought += shares;
                const strike = Number(leg.strike);
                if (Number.isFinite(strike) && strike > 0) {
                    assignmentStrikes.set(strike, (assignmentStrikes.get(strike) || 0) + shares);
                }
            } else if (orderType === 'STC') {
                stockSold += shares;
                hasCloseActivity = true;
            }
            const rawOrder = (((leg as unknown as Record<string, unknown>).orderType as string) || ((leg as unknown as Record<string, unknown>).tradeType as string) || ((leg as unknown as Record<string, unknown>).order as string) || '').toString().toUpperCase();
            if (rawOrder.includes('ROLL')) hasRollLegs = true;
            if (rawOrder.includes('ASSIGN') || (leg as unknown as Record<string, unknown>).isAssignment) hasAssignmentEvent = true;
            if (rawOrder.includes('EXPIRE') || rawOrder.includes('EXPIRY')) hasExpirationEvent = true;
            return;
        }

        // Cash settlement legs
        if (legType === 'CASH' && (orderType === 'BTC' || orderType === 'STC')) {
            hasCashSettlementEvent = true;
            hasAssignmentEvent = true;
            hasCloseActivity = true;

            const cashStrike = Number(leg.strike);
            const hasStrike = Number.isFinite(cashStrike) && cashStrike > 0;

            pairMap.forEach((bucket, key) => {
                const parts = key.split('|');
                const keyStrike = parseFloat(parts[1]);
                if (hasStrike && Number.isFinite(keyStrike) && Math.abs(keyStrike - cashStrike) > 0.01) {
                    return;
                }
                if (orderType === 'BTC') {
                    const unmatched = bucket.shortOpen - bucket.shortClose;
                    if (unmatched > 0) {
                        bucket.shortClose += Math.min(unmatched, quantity);
                    }
                }
                if (orderType === 'STC') {
                    const unmatched = bucket.longOpen - bucket.longClose;
                    if (unmatched > 0) {
                        bucket.longClose += Math.min(unmatched, quantity);
                    }
                }
            });
            return;
        }

        const key = this.buildLegLifecycleKey(leg as unknown as Record<string, unknown>);
        if (!pairMap.has(key)) {
            pairMap.set(key, { longOpen: 0, longClose: 0, shortOpen: 0, shortClose: 0 });
        }

        const bucket = pairMap.get(key)!;

        switch (orderType) {
            case 'BTO': bucket.longOpen += quantity; break;
            case 'STC': bucket.longClose += quantity; hasCloseActivity = true; break;
            case 'STO': bucket.shortOpen += quantity; break;
            case 'BTC': bucket.shortClose += quantity; hasCloseActivity = true; break;
            default: break;
        }

        const rawOrder = (((leg as unknown as Record<string, unknown>).orderType as string) || ((leg as unknown as Record<string, unknown>).tradeType as string) || ((leg as unknown as Record<string, unknown>).order as string) || '').toString().toUpperCase();
        if (rawOrder.includes('ROLL')) hasRollLegs = true;
        if (rawOrder.includes('ASSIGN') || (leg as unknown as Record<string, unknown>).isAssignment) hasAssignmentEvent = true;
        if (rawOrder.includes('EXPIRE') || rawOrder.includes('EXPIRY')) hasExpirationEvent = true;
    });

    const hasOpenStockPosition = stockBought > stockSold;

    if (stockBought > 0) {
        hasAssignmentEvent = true;

        if (assignmentStrikes.size > 0) {
            assignmentStrikes.forEach((shares, strike) => {
                pairMap.forEach((bucket, key) => {
                    if (!key.startsWith('PUT|')) return;
                    const parts = key.split('|');
                    const keyStrike = parseFloat(parts[1]);
                    const multiplier = assertPositiveMultiplier(parts[3], 'lifecycle key');
                    if (!Number.isFinite(keyStrike) || Math.abs(keyStrike - strike) > 0.01) return;
                    const unmatched = bucket.shortOpen - bucket.shortClose;
                    if (unmatched <= 0) return;
                    const assignedContracts = Math.min(unmatched, Math.floor(shares / multiplier));
                    if (assignedContracts > 0) {
                        bucket.shortClose += assignedContracts;
                        hasCloseActivity = true;
                    }
                });
            });
        } else {
            let sharesRemaining = stockBought;
            for (const prefix of ['PUT|', 'CALL|']) {
                if (sharesRemaining <= 0) break;
                pairMap.forEach((bucket, key) => {
                    if (!key.startsWith(prefix) || sharesRemaining <= 0) return;
                    const parts = key.split('|');
                    const multiplier = assertPositiveMultiplier(parts[3], 'lifecycle key');
                    const unmatched = bucket.shortOpen - bucket.shortClose;
                    if (unmatched <= 0) return;
                    const assignedContracts = Math.min(unmatched, Math.floor(sharesRemaining / multiplier));
                    if (assignedContracts > 0) {
                        bucket.shortClose += assignedContracts;
                        sharesRemaining -= assignedContracts * multiplier;
                        hasCloseActivity = true;
                    }
                });
            }
        }
    }

    if (stockBought > 0 && stockSold >= stockBought) {
        let sharesRemaining = stockSold;
        pairMap.forEach((bucket, key) => {
            if (!key.startsWith('CALL|') || sharesRemaining <= 0) return;
            const parts = key.split('|');
            const multiplier = assertPositiveMultiplier(parts[3], 'lifecycle key');
            const unmatched = bucket.shortOpen - bucket.shortClose;
            if (unmatched <= 0) return;
            const contracts = Math.min(unmatched, Math.floor(sharesRemaining / multiplier));
            if (contracts > 0) {
                bucket.shortClose += contracts;
                sharesRemaining -= contracts * multiplier;
                hasCloseActivity = true;
            }
        });
    }

    let matchedPairs = 0;
    let allPairsMatched = true;
    let unmatchedExposure = 0;

    pairMap.forEach((bucket) => {
        const longDiff = Math.abs(bucket.longOpen - bucket.longClose);
        const shortDiff = Math.abs(bucket.shortOpen - bucket.shortClose);
        matchedPairs += Math.min(bucket.longOpen, bucket.longClose) + Math.min(bucket.shortOpen, bucket.shortClose);
        if (longDiff > 0 || shortDiff > 0) allPairsMatched = false;
        unmatchedExposure += longDiff + shortDiff;
    });

    const expirationDate = this.parseDateValue((trade.expirationDate as string) || summary.latestExpiration);
    const now = this.currentDate instanceof Date ? this.currentDate : new Date();
    const expirationWithMarketClose = expirationDate
        ? new Date(Date.UTC(
            expirationDate.getUTCFullYear(), expirationDate.getUTCMonth(), expirationDate.getUTCDate(), 21, 0, 0
          ))
        : null;
    const expirationPassed = expirationWithMarketClose ? (now as Date).getTime() > expirationWithMarketClose.getTime() : false;

    const lastActivityDate = summary.closedDate instanceof Date
        ? summary.closedDate
        : this.parseDateValue(trade.closedDate as string);
    const activityAfterExpiration = expirationPassed && lastActivityDate && expirationDate
        ? lastActivityDate.getTime() >= expirationDate.getTime()
        : false;

    result.meta = {
        matchedPairs,
        unmatchedExposure,
        expirationPassed,
        hasRollLegs,
        hasCloseActivity,
        hasAssignmentEvent,
        hasExpirationEvent,
        hasCashSettlementEvent,
        activityAfterExpiration: Boolean(activityAfterExpiration),
        hasOpenStockPosition
    };

    const normalizedStatus = this.normalizeStatus(trade.status);
    if (!hasAssignmentEvent && this.isAssignmentTrade(trade)) {
        hasAssignmentEvent = true;
    }

    if (hasCashSettlementEvent) {
        result.status = 'Closed';
        result.exitReason = ((trade.exitReason as string) || 'Cash Settlement') as ExitReason;
        result.openContractsOverride = 0;
        if (!result.effectiveClosedDate && lastActivityDate) {
            result.effectiveClosedDate = lastActivityDate.toISOString().slice(0, 10);
        }
        return result;
    }

    if (hasAssignmentEvent && !hasOpenStockPosition && stockBought > 0 && stockSold >= stockBought && (allPairsMatched || unmatchedExposure === 0)) {
        result.status = 'Closed';
        result.exitReason = ((trade.exitReason as string) || 'Assignment resolved') as ExitReason;
        result.openContractsOverride = 0;
        if (!result.effectiveClosedDate && lastActivityDate) {
            result.effectiveClosedDate = lastActivityDate.toISOString().slice(0, 10);
        }
        return result;
    }

    if (hasAssignmentEvent && !hasOpenStockPosition) {
        result.status = 'Assigned';
        result.exitReason = ((trade.exitReason as string) || 'Assigned') as ExitReason;
        result.openContractsOverride = 0;
        if (!result.effectiveClosedDate && lastActivityDate) {
            result.effectiveClosedDate = lastActivityDate.toISOString().slice(0, 10);
        }
        return result;
    }

    if (hasAssignmentEvent && hasOpenStockPosition) {
        const shortCallContracts = this.getNetOpenShortCalls(legs).contracts;
        if (shortCallContracts > 0) {
            result.status = 'Open';
            result.exitReason = null;
            return result;
        }
        result.status = 'Assigned';
        result.exitReason = null;
        return result;
    }

    if (allPairsMatched || unmatchedExposure === 0) {
        if (hasOpenStockPosition) {
            result.status = 'Open';
            return result;
        }
        result.status = 'Closed';
        if (hasExpirationEvent && !trade.exitReason) {
            result.exitReason = 'Expired OTM';
        }
        result.openContractsOverride = 0;
        if (!result.effectiveClosedDate && lastActivityDate) {
            result.effectiveClosedDate = lastActivityDate.toISOString().slice(0, 10);
        }
        return result;
    }

    if (expirationPassed && !hasAssignmentEvent && !hasOpenStockPosition) {
        result.status = 'Expired';
        if (!trade.exitReason) {
            result.exitReason = 'Expired OTM';
        }
        result.openContractsOverride = 0;
        if (expirationDate) {
            result.effectiveClosedDate = expirationDate.toISOString().slice(0, 10);
        }
        return result;
    }

    if (hasRollLegs || (hasCloseActivity && unmatchedExposure > 0)) {
        result.status = 'Rolling';
        return result;
    }

    if (activityAfterExpiration && !hasAssignmentEvent && !hasOpenStockPosition) {
        result.status = 'Closed';
        if (!trade.exitReason) {
            result.exitReason = 'Closed post-expiration';
        }
        result.openContractsOverride = 0;
        if (lastActivityDate) {
            result.effectiveClosedDate = lastActivityDate.toISOString().slice(0, 10);
        }
        return result;
    }

    if (normalizedStatus === 'expired' && expirationDate && !hasOpenStockPosition) {
        result.status = 'Expired';
        result.openContractsOverride = 0;
        if (!trade.exitReason) {
            result.exitReason = 'Expired OTM';
        }
        if (!result.effectiveClosedDate) {
            result.effectiveClosedDate = expirationDate.toISOString().slice(0, 10);
        }
        return result;
    }

    result.status = 'Open';
    return result;
}

export function enrichTradeData(
    this: LegsContext,
    trade: Record<string, unknown>
): Record<string, unknown> {
    const enriched: Record<string, unknown> = { ...trade };
    delete enriched.optionType;

    const rawStrategy = ((enriched.strategy as string) || '').toString().trim();
    enriched.strategy = this.getStrategyDisplayName(rawStrategy);

    enriched.underlyingType = this.normalizeUnderlyingType(trade.underlyingType, { fallback: 'Stock' });

    const legSummary = this.summarizeLegs((enriched.legs as unknown[]) || []);
    enriched.legs = legSummary.legs;
    enriched.legsCount = legSummary.legsCount;
    enriched.openContracts = Math.max(0, legSummary.openContracts - legSummary.closeContracts);
    enriched.closeContracts = legSummary.closeContracts;
    enriched.openLegs = Math.max(0, legSummary.openLegs - legSummary.closeLegs);
    enriched.rollLegs = legSummary.rollLegs;
    enriched.totalFees = Number(legSummary.totalFees.toFixed(4));
    enriched.totalDebit = Number(legSummary.totalDebit.toFixed(2));
    enriched.totalCredit = Number(legSummary.totalCredit.toFixed(2));
    enriched.cashFlow = Number(legSummary.cashFlow.toFixed(2));
    const initialCapitalAtRisk = Number(legSummary.capitalAtRisk);
    enriched.capitalAtRisk = Number.isFinite(initialCapitalAtRisk)
        ? Number(initialCapitalAtRisk.toFixed(2))
        : initialCapitalAtRisk;
    enriched.fees = enriched.totalFees;
    enriched.primaryLeg = legSummary.primaryLeg;

    const userRiskOverride = Number(trade.maxRiskOverride);
    if (Number.isFinite(userRiskOverride) && userRiskOverride > 0) {
        enriched.maxRiskOverride = userRiskOverride;
    } else {
        enriched.maxRiskOverride = null;
    }

    const primaryLeg = legSummary.primaryLeg;
    enriched.tradeType = this.deriveTradeTypeFromLeg(primaryLeg as unknown as Record<string, unknown>);
    enriched.tradeDirection = this.deriveTradeDirectionFromLeg(primaryLeg as unknown as Record<string, unknown>);

    // For trades with stock assignments, use total stock shares as quantity
    const openLegsForStock = legSummary.legs.filter(leg => this.getLegSide(leg as unknown as Record<string, unknown>) === 'OPEN');
    const stockLegs = openLegsForStock.filter(leg => leg.type === 'STOCK');

    if (stockLegs.length > 0) {
        const totalShares = stockLegs.reduce((sum, leg) => {
            const quantity = leg.quantity * this.getLegMultiplier(leg as unknown as Record<string, unknown>);
            return sum + (this.getLegAction(leg as unknown as Record<string, unknown>) === 'BUY' ? quantity : -quantity);
        }, 0);
        const absShares = Math.abs(Math.round(totalShares));
        if (absShares > 0) {
            enriched.quantity = absShares;
        } else {
            const normalizedQuantity = primaryLeg ? Math.abs(Number(primaryLeg.quantity) || 0) : 0;
            enriched.quantity = enriched.tradeDirection === 'short' ? -normalizedQuantity : normalizedQuantity;
        }
    } else {
        const primaryType = ((primaryLeg?.type as string) || '').toUpperCase();
        const primaryStrike = Number(primaryLeg?.strike) || 0;
        const primaryExpiration = (primaryLeg?.expirationDate as string) || '';

        const matchingOpenLegs = openLegsForStock.filter(leg => {
            const type = (leg.type || '').toUpperCase();
            const strike = Number(leg.strike) || 0;
            const expiration = (leg.expirationDate as string) || '';
            return type === primaryType && strike === primaryStrike && expiration === primaryExpiration;
        });

        let totalQuantity = 0;
        if (matchingOpenLegs.length > 0) {
            totalQuantity = matchingOpenLegs.reduce((sum, leg) => sum + Math.abs(Number(leg.quantity) || 0), 0);
        } else {
            totalQuantity = primaryLeg ? Math.abs(Number(primaryLeg.quantity) || 0) : 0;
        }

        enriched.quantity = enriched.tradeDirection === 'short' ? -totalQuantity : totalQuantity;
    }

    enriched.strikePrice = this.derivePrimaryStrike(legSummary);
    enriched.multiplier = this.getLegMultiplier(primaryLeg as unknown as Record<string, unknown>);
    enriched.displayStrike = this.buildStrikeDisplay(enriched, legSummary);

    const activeStrike = this.getActiveStrikeForDisplay(legSummary);
    enriched.activeStrikePrice = Number.isFinite(activeStrike as number) ? Number(activeStrike) : null;

    const entryPrice = legSummary.entryPrice;
    const exitPrice = legSummary.exitPrice;
    enriched.entryPrice = Number.isFinite(entryPrice as number) ? Number((entryPrice as number).toFixed(4)) : null;
    enriched.exitPrice = Number.isFinite(exitPrice as number) ? Number((exitPrice as number).toFixed(4)) : null;

    const riskInfo = this.assessRisk(enriched, legSummary);
    if (enriched.maxRiskOverride) {
        riskInfo.maxRiskValue = enriched.maxRiskOverride as number;
        riskInfo.maxRiskLabel = this.formatCurrency(enriched.maxRiskOverride as number);
        riskInfo.unlimited = false;
        legSummary.capitalAtRisk = enriched.maxRiskOverride as number;
    }

    enriched.capitalAtRisk = riskInfo.maxRiskValue;
    if (Number.isFinite(enriched.capitalAtRisk as number)) {
        enriched.capitalAtRisk = Number((enriched.capitalAtRisk as number).toFixed(2));
    }
    enriched.maxRiskLabel = riskInfo.maxRiskLabel;
    enriched.riskIsUnlimited = riskInfo.unlimited;
    // M3 — typed RiskValue alongside the legacy number sentinel
    enriched.riskValue = toRiskValue(riskInfo.maxRiskValue);

    const legacyEntryDate = (enriched as Record<string, unknown>).entryDate as string;
    const legacyExitDate = (enriched as Record<string, unknown>).exitDate as string;
    const openedDate = this.parseDateValue((enriched.openedDate as string) || legacyEntryDate || legSummary.openedDate);
    const closedDate = this.parseDateValue((enriched.closedDate as string) || legacyExitDate || (legSummary.closeLegs > 0 ? legSummary.closedDate : null));

    let expirationDate = this.parseDateValue(enriched.expirationDate as string);
    if (!expirationDate && legSummary.latestExpiration) {
        expirationDate = legSummary.latestExpiration;
    }

    const pmccShortExpiration = legSummary.nextShortCallExpiration || legSummary.nearestShortCallExpiration || null;
    if (this.isPmccTrade(enriched) && pmccShortExpiration) {
        expirationDate = pmccShortExpiration;
    }

    if (!this.isPmccTrade(enriched) && this.isWheelOrPmccTrade(enriched)) {
        // hasNetOpenOptionLegs would count an assignment-closed put as still
        // open (assignment terminates it via a stock leg, not a BTC leg), which
        // kept a bought-back covered call's expiration/DTE alive (issue #40).
        const hasActiveOptions = this.hasNonExpiredOpenShortOptions({ ...enriched, legs: legSummary.legs });
        if (hasActiveOptions && pmccShortExpiration) {
            expirationDate = pmccShortExpiration;
        } else if (!hasActiveOptions && this.getTradeOpenStockShares(enriched) > 0) {
            expirationDate = null;
        }
    }

    enriched.pmccShortExpiration = pmccShortExpiration ? pmccShortExpiration.toISOString().slice(0, 10) : '';
    enriched.longExpirationDate = legSummary.latestExpiration ? legSummary.latestExpiration.toISOString().slice(0, 10) : '';

    enriched.openedDate = openedDate ? openedDate.toISOString().slice(0, 10) : '';
    enriched.closedDate = closedDate ? closedDate.toISOString().slice(0, 10) : '';
    delete (enriched as Record<string, unknown>).entryDate;
    delete (enriched as Record<string, unknown>).exitDate;
    enriched.expirationDate = expirationDate ? expirationDate.toISOString().slice(0, 10) : '';

    enriched.pl = this.calculatePL(enriched);
    enriched.roi = this.calculateROI(enriched);
    enriched.maxRisk = this.calculateMaxRisk(enriched);
    if (!enriched.maxRiskLabel) {
        enriched.maxRiskLabel = Number.isFinite(enriched.maxRisk as number)
            ? this.formatCurrency(enriched.maxRisk as number)
            : enriched.maxRisk === Number.POSITIVE_INFINITY
                ? 'Unlimited'
                : '—';
    }

    const lifecycle = this.determineTradeLifecycleStatus(enriched, legSummary);
    enriched.lifecycleMeta = lifecycle.meta;
    enriched.lifecycleStatus = lifecycle.status;

    enriched.wheelCoverage = this.getTradeWheelCoverage(enriched);

    if (enriched.wheelCoverage === 'uncovered') {
        enriched.lifecycleStatus = 'awaiting_coverage';
    }

    const heldStockShares = this.getTradeOpenStockShares(enriched);
    const heldLongCallContracts = this.isPmccTrade(enriched)
        ? this.getNetOpenLongCallContracts(enriched)
        : 0;
    const hasHeldExposure = !this.isClosedStatus(enriched.status)
        && (heldStockShares > 0 || heldLongCallContracts > 0);

    if (hasHeldExposure) {
        const cb = this.computeWheelEffectiveCostBasis(enriched);
        enriched.shares = cb.shares;
        enriched.effectiveCostBasis = Number.isFinite(cb.effectiveCostBasis)
            ? Number(cb.effectiveCostBasis.toFixed(2))
            : null;

        let resolvedPrice = Number(trade.marketPriceSnapshot);
        let priceSource = 'snapshot';
        if (!Number.isFinite(resolvedPrice) || resolvedPrice <= 0) {
            const ticker = ((trade.ticker as string) || '').toString().trim().toUpperCase();
            const cachedQuote = this.getCachedQuote ? this.getCachedQuote(ticker) : null;
            const livePrice = Number(cachedQuote?.value?.price);
            if (Number.isFinite(livePrice) && livePrice > 0) {
                resolvedPrice = livePrice;
                priceSource = 'live';
            } else if (cb.shares > 0 && Number.isFinite(cb.assignmentCostBasis) && cb.assignmentCostBasis > 0) {
                resolvedPrice = cb.assignmentCostBasis / cb.shares;
                priceSource = 'fallback-strike';
                if (!this._wheelPriceFallbackWarned) {
                    console.warn('[GammaLedger] No market price for wheel/PMCC position(s); falling back to entry strike for unrealized P&L. Set Finnhub API key in Settings for live quotes.');
                    this._wheelPriceFallbackWarned = true;
                }
            }
        }

        if (Number.isFinite(resolvedPrice) && resolvedPrice > 0 && cb.shares > 0 && Number.isFinite(cb.effectiveCostBasis as number)) {
            const marketValue = resolvedPrice * cb.shares;
            const unrealizedPL = marketValue - (cb.effectiveCostBasis as number);
            enriched.marketValue = Number(marketValue.toFixed(2));
            enriched.unrealizedPL = Number(unrealizedPL.toFixed(2));
            enriched.marketPriceSource = priceSource;
            enriched.pl = enriched.unrealizedPL;
            enriched.roi = cb.effectiveCostBasis !== 0
                ? Number(((unrealizedPL / (cb.effectiveCostBasis as number)) * 100).toFixed(2))
                : 0;
        } else {
            enriched.marketValue = null;
            enriched.unrealizedPL = null;
            enriched.marketPriceSource = null;
            if (enriched.lifecycleStatus === 'awaiting_coverage') {
                enriched.pl = 0;
                enriched.roi = 0;
            }
        }
    } else {
        enriched.shares = null;
        enriched.effectiveCostBasis = null;
        enriched.marketValue = null;
        enriched.unrealizedPL = null;
    }

    if (typeof lifecycle.openContractsOverride === 'number') {
        enriched.openContracts = Math.max(0, lifecycle.openContractsOverride);
    }

    if (lifecycle.effectiveClosedDate) {
        enriched.closedDate = lifecycle.effectiveClosedDate;
        delete (enriched as Record<string, unknown>).exitDate;
    }

    if (lifecycle.exitReason && !enriched.exitReason) {
        enriched.exitReason = lifecycle.exitReason;
    }

    enriched.partialClose = Boolean(lifecycle.meta?.hasCloseActivity && lifecycle.meta?.unmatchedExposure > 0);
    enriched.rolledForward = Boolean(lifecycle.meta?.hasRollLegs);
    enriched.autoExpired = lifecycle.status === 'Expired' && Boolean(lifecycle.meta?.expirationPassed);

    const manualStatus = this.normalizeTradeStatusInput(trade.statusOverride);
    if (manualStatus) {
        enriched.statusOverride = manualStatus;
        enriched.status = manualStatus;
    } else {
        if ('statusOverride' in enriched) {
            delete enriched.statusOverride;
        }
        enriched.status = lifecycle.status;
    }

    enriched.daysHeld = this.calculateDaysHeld(enriched);
    enriched.dte = this.calculateDTE(enriched.expirationDate as string, enriched);
    enriched.weeklyROI = this.calculateWeeklyROI(enriched);
    enriched.monthlyROI = this.calculateMonthlyROI(enriched);
    enriched.annualizedROI = this.calculateAnnualizedROI(enriched);

    return enriched;
}

export function getPrimaryLeg(
    this: LegsContext,
    trade: Record<string, unknown> = {}
): Record<string, unknown> | null {
    if (trade.primaryLeg && (trade.primaryLeg as Record<string, unknown>).id) {
        return this.normalizeLeg(trade.primaryLeg as Record<string, unknown>) as unknown as Record<string, unknown>;
    }
    if (Array.isArray(trade.legs) && trade.legs.length > 0) {
        const candidates = (trade.legs as Record<string, unknown>[]).map((leg, index) => this.normalizeLeg(leg, index));
        const firstOpen = candidates.find(leg => this.getLegSide(leg as unknown as Record<string, unknown>) === 'OPEN') || candidates[0];
        return firstOpen as unknown as Record<string, unknown>;
    }
    return null;
}

export function deriveTradeTypeFromLeg(
    this: LegsContext,
    leg: Record<string, unknown> | null
): string {
    if (!leg) return 'BTO';
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
    this: LegsContext,
    leg: Record<string, unknown> | null
): string {
    if (!leg) return 'long';
    const action = this.getLegAction(leg);
    if (action === 'SELL') return 'short';
    return 'long';
}

export function getTradeType(
    this: LegsContext,
    trade: Record<string, unknown>
): string {
    const primaryLeg = this.getPrimaryLeg(trade);
    return this.deriveTradeTypeFromLeg(primaryLeg);
}

export function inferTradeDirection(
    this: LegsContext,
    trade: Record<string, unknown>
): string {
    const primaryLeg = this.getPrimaryLeg(trade);
    return this.deriveTradeDirectionFromLeg(primaryLeg);
}
