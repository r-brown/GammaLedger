// src/calculations/leg-realization.ts — leg-level realization of option P&L.
// Uses the .call(this, …) delegation pattern.

import type { EnrichedTrade } from '@types-gl/trade'
import type { LegSummary } from '@types-gl/leg-summary'

export interface LegRealizationSummary {
    /** Total realized option P&L to date (terminated contract groups only). */
    realizedCashFlow: number
    /** 'YYYY-MM' → realized option cash flow attributed to that month. */
    realizedMonthly: Map<string, number>
    /** True when at least one contract group is still open (not terminated). */
    hasOpenGroups: boolean
}

export interface LegRealizationContext {
    readonly currentDate: Date
    isClosedStatus(status: unknown): boolean
    summarizeLegs(legs: unknown[]): LegSummary
    getNormalizedLegOrderType(leg: Record<string, unknown>): string
    buildLegLifecycleKey(leg: Record<string, unknown>): string
    calculateLegCashFlow(leg: Record<string, unknown>): number
    parseDateValue(value: unknown): Date | null
}

/**
 * Leg-level realization: an option leg's P&L is realized when its contract
 * group terminates. A contract group is all CALL/PUT legs sharing the
 * buildLegLifecycleKey (type|strike|expiration|multiplier). A group is
 * terminated when any of:
 *   1. the trade is Closed/Expired (everything is realized — keeps closed
 *      trades byte-identical to trade.pl accounting),
 *   2. net open quantity (STO/BTO minus BTC/STC) <= 0,
 *   3. expiration passed (21:00 UTC market-close cutoff),
 *   4. the trade has an assignment event and the group is a net-open short
 *      PUT (early assignment; short CALLs are excluded so an in-flight
 *      wheel's open covered call is not realized prematurely).
 *
 * Cash-event attribution: each realized leg lands in its executionDate
 * month. Legs without an executionDate contribute to realizedCashFlow but
 * not to realizedMonthly (consumers attribute the residual to close month).
 * STOCK and CASH legs are ignored here — consumers handle stock residuals.
 */
export function summarizeLegRealization(
    this: LegRealizationContext,
    trade: EnrichedTrade | null | undefined
): LegRealizationSummary {
    const result: LegRealizationSummary = {
        realizedCashFlow: 0,
        realizedMonthly: new Map<string, number>(),
        hasOpenGroups: false
    }
    if (!trade) return result

    const rawLegs = Array.isArray(trade.legs) ? trade.legs : []
    if (!rawLegs.length) return result
    const summary = this.summarizeLegs(rawLegs)
    const legs = Array.isArray(summary?.legs) ? summary.legs : []

    interface ContractGroup {
        type: string
        expiration: string
        netOpen: number
        hasShortOpen: boolean
        legs: Record<string, unknown>[]
    }
    const groups = new Map<string, ContractGroup>()

    for (const normalized of legs) {
        const leg = normalized as unknown as Record<string, unknown>
        const type = ((leg.type as string) || '').toString().trim().toUpperCase()
        if (type !== 'CALL' && type !== 'PUT') continue
        const key = this.buildLegLifecycleKey(leg)
        let group = groups.get(key)
        if (!group) {
            group = {
                type,
                expiration: ((leg.expirationDate as string) || '').toString(),
                netOpen: 0,
                hasShortOpen: false,
                legs: []
            }
            groups.set(key, group)
        }
        const quantity = Math.abs(Number(leg.quantity) || 0)
        const orderType = this.getNormalizedLegOrderType(leg)
        if (orderType === 'STO' || orderType === 'BTO') group.netOpen += quantity
        else if (orderType === 'BTC' || orderType === 'STC') group.netOpen -= quantity
        if (orderType === 'STO') group.hasShortOpen = true
        group.legs.push(leg)
    }
    if (!groups.size) return result

    const tradeClosed = this.isClosedStatus(trade.status)
    const hasAssignmentEvent = Boolean(trade.lifecycleMeta?.hasAssignmentEvent)

    const isExpired = (expiration: string): boolean => {
        if (!expiration) return false
        const expDate = this.parseDateValue(expiration)
        if (!expDate) return false
        const cutoff = new Date(expDate)
        cutoff.setUTCHours(21, 0, 0, 0)
        return cutoff < this.currentDate
    }

    let total = 0
    for (const group of groups.values()) {
        const terminated = tradeClosed
            || group.netOpen <= 0
            || isExpired(group.expiration)
            || (hasAssignmentEvent && group.type === 'PUT' && group.hasShortOpen && group.netOpen > 0)
        if (!terminated) {
            result.hasOpenGroups = true
            continue
        }
        for (const leg of group.legs) {
            const cashFlow = this.calculateLegCashFlow(leg)
            if (!Number.isFinite(cashFlow)) continue
            total += cashFlow
            const dateStr = ((leg.executionDate as string) || '').toString()
            if (!dateStr) continue
            const month = dateStr.slice(0, 7)
            result.realizedMonthly.set(month, (result.realizedMonthly.get(month) ?? 0) + cashFlow)
        }
    }
    result.realizedCashFlow = parseFloat(total.toFixed(2))
    return result
}
