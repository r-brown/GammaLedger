// src/calculations/leg-realization.ts — leg-level realization of option P&L.
// Uses the .call(this, …) delegation pattern.

import type { EnrichedTrade } from '@types-gl/trade'
import type { LegSummary } from '@types-gl/leg-summary'

export interface LegRealizationSummary {
    /** Total realized option P&L to date (terminated contract groups only). */
    realizedCashFlow: number
    /** 'YYYY-MM' → realized option P&L attributed to the month each contract group terminated. */
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
 * Termination-month attribution: a terminated group's NET P&L lands in the
 * month the group terminated — last closing execution for fully-closed
 * groups, expiration month for expired/assigned groups, trade close month
 * as the fallback for groups swept in by a Closed/Expired trade. This keeps
 * each roll cycle atomic in the bars: a buyback debit never lands in a
 * different month than the credit it closes out. Groups with no resolvable
 * month contribute to realizedCashFlow but not to realizedMonthly
 * (consumers attribute the residual to the trade close month).
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
        lastCloseDate: string
        lastExecDate: string
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
                lastCloseDate: '',
                lastExecDate: '',
                legs: []
            }
            groups.set(key, group)
        }
        const quantity = Math.abs(Number(leg.quantity) || 0)
        const orderType = this.getNormalizedLegOrderType(leg)
        if (orderType === 'STO' || orderType === 'BTO') group.netOpen += quantity
        else if (orderType === 'BTC' || orderType === 'STC') group.netOpen -= quantity
        if (orderType === 'STO') group.hasShortOpen = true
        const executionDate = ((leg.executionDate as string) || '').toString()
        if (executionDate > group.lastExecDate) group.lastExecDate = executionDate
        if ((orderType === 'BTC' || orderType === 'STC') && executionDate > group.lastCloseDate) {
            group.lastCloseDate = executionDate
        }
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
        const fullyClosed = group.netOpen <= 0
        const expired = isExpired(group.expiration)
        const assigned = hasAssignmentEvent && group.type === 'PUT'
            && group.hasShortOpen && group.netOpen > 0
        const terminated = tradeClosed || fullyClosed || expired || assigned
        if (!terminated) {
            result.hasOpenGroups = true
            continue
        }

        let groupTotal = 0
        for (const leg of group.legs) {
            const cashFlow = this.calculateLegCashFlow(leg)
            if (Number.isFinite(cashFlow)) groupTotal += cashFlow
        }
        total += groupTotal

        // Termination month: prefer the group's own lifecycle event over the
        // trade-closed sweep, so a roll cycle stays in the month it ended.
        let month = ''
        if (fullyClosed) month = (group.lastCloseDate || group.lastExecDate).slice(0, 7)
        else if (expired) month = group.expiration.slice(0, 7)
        else if (assigned) month = (group.expiration || group.lastExecDate).slice(0, 7)
        else month = String(trade.closedDate ?? trade.openedDate ?? '').slice(0, 7) || group.lastExecDate.slice(0, 7)
        if (month) {
            result.realizedMonthly.set(month, (result.realizedMonthly.get(month) ?? 0) + groupTotal)
        }
    }
    result.realizedCashFlow = parseFloat(total.toFixed(2))
    return result
}
