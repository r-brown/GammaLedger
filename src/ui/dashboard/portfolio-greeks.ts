// src/ui/dashboard/greeks-strip.ts — aggregate net delta / daily theta / vega
// across open option positions. Rough Black-Scholes estimate (flat sigma, no
// live IV) — the strip discloses its assumptions in a popover.
// Uses the .call(this, …) delegation pattern.

import { computeNetOpenLegs, filterUnexpired, type NetLegInput } from '@calculations/net-open-legs.js'
import { blackScholesGreeks, DEFAULT_SIGMA, DEFAULT_RISK_FREE_RATE } from '@calculations/black-scholes.js'
import { infoPopoverTrigger, setupInfoPopovers } from './popover.js'
import type { Stats } from '@types-gl/stats'
import type { NormalizedLeg } from '@types-gl/leg'

type TradeRecord = Record<string, unknown>

export interface GreeksStripContext {
  currentDate: Date
  summarizeLegs(legs: unknown[]): { legs: NormalizedLeg[] }
  getLegOrderDescriptor(leg: Record<string, unknown>): { action: string; side: string }
  getCachedQuote(ticker: string): { value?: { c?: number } } | null
  formatCurrency(value: unknown, opts?: Record<string, unknown>): string
  formatNumber(value: unknown, opts: Record<string, unknown>): string | null
}

function escapeHtml(s: string): string {
    return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
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
export function resolveSpotForTrade(this: GreeksStripContext, trade: TradeRecord): number | null {
    const ticker = String(trade?.ticker ?? '').toUpperCase()
    if (ticker) {
        const cached = this.getCachedQuote(ticker)
        const live = Number(cached?.value?.c)
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
export function tradeToNetLegInputs(this: GreeksStripContext, trade: TradeRecord): NetLegInput[] {
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

export function renderGreeksStrip(this: GreeksStripContext, stats: Stats): void {
    const root = document.getElementById('greeks-strip')
    if (!root) return

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

    if (!optionLegCount && netDelta === 0) {
        root.classList.add('hidden')
        return
    }
    root.classList.remove('hidden')

    const assumptions = `Rough Black-Scholes estimate — no live option quotes.\nAssumes a flat implied volatility of ${(DEFAULT_SIGMA * 100).toFixed(0)}% and a ${(DEFAULT_RISK_FREE_RATE * 100).toFixed(0)}% risk-free rate for every contract; spot comes from the Finnhub quote cache or the trade's last underlying-price snapshot.\nΘ/day is the estimated dollar time-decay earned (positive) or paid (negative) per calendar day. Net Δ is in share-equivalents. Vega is $ per 1-point IV move.${unpricedTrades > 0 ? `\nExcluded (no price available): ${[...unpricedTickers].filter(Boolean).join(', ')}` : ''}`

    const deltaText = escapeHtml(this.formatNumber(netDelta, { decimals: 1 }) ?? '0')
    const thetaText = escapeHtml(this.formatCurrency(thetaPerDay))
    const vegaText = escapeHtml(this.formatCurrency(vega))
    const coverage = unpricedTrades > 0
        ? `${pricedTrades}/${pricedTrades + unpricedTrades} priced`
        : `${pricedTrades} priced`

    root.innerHTML = `
      <div class="greeks-strip__tile"><span class="greeks-strip__label">Net Δ</span><span class="greeks-strip__value">${deltaText}</span></div>
      <div class="greeks-strip__tile"><span class="greeks-strip__label">Θ / day</span><span class="greeks-strip__value ${thetaPerDay >= 0 ? 'rv-pos' : 'rv-neg'}">${thetaText}</span></div>
      <div class="greeks-strip__tile"><span class="greeks-strip__label">Vega / 1pt</span><span class="greeks-strip__value">${vegaText}</span></div>
      <div class="greeks-strip__tile greeks-strip__tile--meta">${infoPopoverTrigger(`est. σ ${(DEFAULT_SIGMA * 100).toFixed(0)}% · ${coverage}`, assumptions, 'chip')}</div>
    `
    setupInfoPopovers(root)
}
