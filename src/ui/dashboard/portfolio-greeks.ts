// src/ui/dashboard/portfolio-greeks.ts — aggregate net delta / daily theta /
// vega across open option positions. Rough Black-Scholes estimate (flat
// sigma, no live IV) — rendered as rows in grouped-metrics.ts's "Risk &
// Exposure" column, which discloses the assumptions in a popover.
// Uses the .call(this, …) delegation pattern.

import { computeNetOpenLegs, filterUnexpired, type NetLegInput } from '@calculations/net-open-legs.js'
import { blackScholesGreeks } from '@calculations/black-scholes.js'
import type { Stats } from '@types-gl/stats'
import type { NormalizedLeg } from '@types-gl/leg'
import type { CachedQuoteEntry } from '@types-gl/integrations'

type TradeRecord = Record<string, unknown>

export interface PortfolioGreeksContext {
  currentDate: Date
  summarizeLegs(legs: unknown[]): { legs: NormalizedLeg[] }
  getLegOrderDescriptor(leg: Record<string, unknown>): { action: string; side: string }
  getCachedQuote(ticker: string): CachedQuoteEntry | null
  formatCurrency(value: unknown, opts?: Record<string, unknown>): string
  formatNumber(value: unknown, opts: Record<string, unknown>): string | null
}

export interface PortfolioGreeksSummary {
  netDelta: number
  thetaPerDay: number
  vega: number
  pricedTrades: number
  unpricedTrades: number
  unpricedTickers: string[]
}

export function todayISO(date: Date): string {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
}

function daysUntil(iso: string, from: Date): number {
    const target = new Date(`${iso}T00:00:00`)
    if (Number.isNaN(target.getTime())) return 0
    return Math.max(0, Math.ceil((target.getTime() - from.getTime()) / 86_400_000))
}

/** Spot resolution: live Finnhub cache first, then the newest leg snapshot. */
export function resolveSpotForTrade(this: PortfolioGreeksContext, trade: TradeRecord): number | null {
    const ticker = String(trade?.ticker ?? '').toUpperCase()
    if (ticker) {
        const cached = this.getCachedQuote(ticker)
        // Cached quotes are normalized (`price`), not raw Finnhub keys (`c`).
        const live = Number(cached?.value?.price)
        if (Number.isFinite(live) && live > 0) return live
    }
    const legs = Array.isArray(trade?.legs) ? trade.legs as Record<string, unknown>[] : []
    for (let i = legs.length - 1; i >= 0; i--) {
        const snap = Number(legs[i]?.underlyingPrice)
        if (Number.isFinite(snap) && snap > 0) return snap
    }
    return null
}

/** Map a trade's normalized legs into the pure NetLegInput shape. */
export function tradeToNetLegInputs(this: PortfolioGreeksContext, trade: TradeRecord): NetLegInput[] {
    const rawLegs = Array.isArray(trade?.legs) ? trade.legs as unknown[] : []
    if (!rawLegs.length) return []
    const summary = this.summarizeLegs(rawLegs)
    return summary.legs.map((leg) => {
        const descriptor = this.getLegOrderDescriptor(leg as unknown as Record<string, unknown>)
        const isStock = (leg.type || '').toUpperCase() === 'STOCK'
        // STOCK legs with premium 0 store the per-share price in `strike`.
        const premium = isStock && !(Number(leg.premium) > 0)
            ? Number(leg.strike) || 0
            : Number(leg.premium) || 0
        return {
            type: leg.type,
            strike: leg.strike,
            expirationDate: leg.expirationDate || '',
            quantity: leg.quantity,
            multiplier: leg.multiplier,
            action: descriptor.action,
            side: descriptor.side,
            premium
        }
    })
}

/** Aggregates net delta/theta/vega across open + assigned positions. Returns
 *  null when there is nothing to show (no option legs and no share delta). */
export function computePortfolioGreeks(this: PortfolioGreeksContext, stats: Stats): PortfolioGreeksSummary | null {
    // Union of open + assigned lists (a covered wheel can appear in both).
    const byId = new Map<unknown, TradeRecord>()
    const source = [...(stats.openTradesList ?? []), ...(stats.assignedTradesList ?? [])] as unknown as TradeRecord[]
    source.forEach(trade => byId.set(trade.id, trade))

    const now = this.currentDate
    const iso = todayISO(now)
    let netDelta = 0
    let thetaPerDay = 0
    let vega = 0
    let optionLegCount = 0
    let pricedTrades = 0
    let unpricedTrades = 0
    const unpricedTickers = new Set<string>()

    byId.forEach((trade) => {
        const netLegs = filterUnexpired(computeNetOpenLegs(tradeToNetLegInputs.call(this, trade)), iso)
        if (!netLegs.length) return
        const spot = resolveSpotForTrade.call(this, trade)
        if (spot === null) {
            unpricedTrades += 1
            unpricedTickers.add(String(trade.ticker ?? ''))
            return
        }
        pricedTrades += 1
        for (const leg of netLegs) {
            const exposure = leg.netQuantity * leg.multiplier
            if (leg.type === 'STOCK') {
                netDelta += exposure
                continue
            }
            if (leg.strike === null) continue
            optionLegCount += 1
            const greeks = blackScholesGreeks({
                spot,
                strike: leg.strike,
                dteDays: daysUntil(leg.expirationDate, now),
                type: leg.type
            })
            netDelta += exposure * greeks.delta
            thetaPerDay += exposure * greeks.thetaPerDay
            vega += exposure * greeks.vega
        }
    })

    if (!optionLegCount && netDelta === 0) return null

    return {
        netDelta,
        thetaPerDay,
        vega,
        pricedTrades,
        unpricedTrades,
        unpricedTickers: [...unpricedTickers].filter(Boolean)
    }
}
