// src/ai/watchlist-scan.ts — "Watchlist scan" quick prompt: which watched tickers need a close look
// now. The app computes every fact and flag per entry (watch-price distance, earnings, scores,
// thesis drift, held positions); the Coach only prioritises and explains.

import type { WatchlistEntry } from '../types/watchlist.js'
import type { DriftView } from '../types/ai.js'
import type { EarningsSurprise, SignalsData, StockMetrics } from '../types/integrations.js'
import type { LLMProvider } from '../integrations/llm/types.js'
import type { ConsentRequirement } from '../core/consent.js'
import { daysBetweenIso } from '../calculations/market-facts.js'
import { gatherTickerContext, type TickerContext, type TickerHost } from './ticker-context.js'
import { driftCacheKey } from './watchlist-drift.js'

export const WATCHLIST_SCAN_LABEL = 'Watchlist scan'
/** Cap on entries sent; the lowest-ranked ones are dropped and counted as omitted. */
export const MAX_SCAN_ENTRIES = 40
/** "Near" the watch price: within this % of the level without having reached it. */
export const NEAR_WATCH_PCT = 3
/** Earnings this close are worth flagging for an entry decision (IV crush / gap risk). */
export const EARNINGS_SOON_DAYS = 14
const MAX_SCAN_THESIS_CHARS = 240
const SCAN_WAIT_MS = 8_000

export interface WatchlistScanInput {
    ctx: TickerContext
    earningsDate: string | null
    drift: DriftView | null
    /** Open trades on this ticker (the trader already has exposure). */
    openPositions: number
}

export interface WatchlistScanEntry {
    ticker: string
    price?: number
    rating?: number
    tags?: string[]
    daysSinceAdded?: number
    thesis?: string
    watchPrice?: NonNullable<TickerContext['watchlist']>['watchPrice']
    nextEarnings?: { date: string; daysAway: number }
    momentum?: TickerContext['momentum']
    scores?: { risk: string; own: string; balanceSheet: string; valuation: string }
    analyst?: { buy: number; hold: number; sell: number }
    aiVerdict?: string
    thesisDrift?: { flagged: boolean; probability: number }
    openPositions?: number
    /** App-computed reasons this entry may need a look, strongest first. */
    flags: string[]
}

export interface WatchlistScanFacts {
    asOf: string
    summary: {
        watched: number
        sent: number
        omitted: number
        watchPriceReached: number
        nearWatchPrice: number
        earningsWithin14d: number
        thesisDriftFlagged: number
        noPrice: number
    }
    entries: WatchlistScanEntry[]
}

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text)

/** Rough deterministic order (the Coach may re-order); also decides what the cap drops. */
function rankOf(entry: WatchlistScanEntry): number {
    const w = entry.watchPrice
    let rank = 0
    // Being at or near the entry trigger outweighs every other signal combined.
    if (w?.reachedToday) rank += 60
    else if (w?.reached) rank += 50
    else if (w && w.priceVsLevelPct !== null && Math.abs(w.priceVsLevelPct) <= NEAR_WATCH_PCT) rank += 40
    if (entry.thesisDrift?.flagged) rank += 12
    if (entry.nextEarnings && entry.nextEarnings.daysAway <= EARNINGS_SOON_DAYS) rank += 8
    rank += (entry.rating ?? 0) * 2
    if (entry.price === undefined) rank -= 5
    return rank
}

export function buildScanEntry(input: WatchlistScanInput): WatchlistScanEntry {
    const { ctx } = input
    const w = ctx.watchlist
    const flags: string[] = []
    const entry: WatchlistScanEntry = { ticker: ctx.ticker, flags }
    if (ctx.price !== null) entry.price = ctx.price
    if (w?.rating !== null && w?.rating !== undefined) entry.rating = w.rating
    if (w?.tags.length) entry.tags = w.tags
    if (w?.daysSinceAdded !== null && w?.daysSinceAdded !== undefined) entry.daysSinceAdded = w.daysSinceAdded
    if (w?.thesis) entry.thesis = clip(w.thesis, MAX_SCAN_THESIS_CHARS)
    if (w?.watchPrice) entry.watchPrice = w.watchPrice

    const watch = w?.watchPrice
    if (watch?.reachedToday) flags.push('watch price reached today')
    else if (watch?.reached) flags.push('at or past watch price')
    else if (watch && watch.priceVsLevelPct !== null && Math.abs(watch.priceVsLevelPct) <= NEAR_WATCH_PCT) {
        flags.push(`within ${Math.abs(watch.priceVsLevelPct)}% of watch price`)
    }

    if (input.drift) {
        entry.thesisDrift = { flagged: input.drift.drifted, probability: Math.round(input.drift.probability * 100) / 100 }
        if (input.drift.drifted) flags.push('thesis may no longer fit')
    }

    if (input.earningsDate && input.earningsDate >= ctx.asOf) {
        const daysAway = daysBetweenIso(ctx.asOf, input.earningsDate)
        entry.nextEarnings = { date: input.earningsDate, daysAway }
        if (daysAway <= EARNINGS_SOON_DAYS) flags.push(`earnings in ${daysAway}d`)
    }

    if (ctx.momentum) entry.momentum = ctx.momentum
    if (ctx.scores) {
        entry.scores = {
            risk: ctx.scores.risk.grade,
            own: ctx.scores.own.grade,
            balanceSheet: ctx.scores.balanceSheet.grade,
            valuation: ctx.scores.valuation.grade
        }
    }
    if (ctx.signals?.analyst) entry.analyst = ctx.signals.analyst
    if (ctx.aiRead) entry.aiVerdict = ctx.aiRead.display

    if (input.openPositions > 0) {
        entry.openPositions = input.openPositions
        flags.push(`already ${input.openPositions} open position${input.openPositions === 1 ? '' : 's'}`)
    }
    if (!watch) flags.push('no watch price set')
    if (entry.price === undefined) flags.push('no current price')
    if (w && !w.thesis) flags.push('no thesis')
    return entry
}

export function buildWatchlistScanFacts(inputs: WatchlistScanInput[], asOf: string): WatchlistScanFacts {
    const all = inputs
        .map((input, index) => ({ entry: buildScanEntry(input), index }))
        .map(item => ({ ...item, rank: rankOf(item.entry) }))
        .sort((a, b) => b.rank - a.rank || a.index - b.index)
        .map(item => item.entry)
    const sent = all.slice(0, MAX_SCAN_ENTRIES)
    const count = (pred: (e: WatchlistScanEntry) => boolean) => all.filter(pred).length
    return {
        asOf,
        summary: {
            watched: all.length,
            sent: sent.length,
            omitted: all.length - sent.length,
            watchPriceReached: count(e => Boolean(e.watchPrice?.reached)),
            nearWatchPrice: count(e => e.flags.some(f => f.startsWith('within '))),
            earningsWithin14d: count(e => Boolean(e.nextEarnings && e.nextEarnings.daysAway <= EARNINGS_SOON_DAYS)),
            thesisDriftFlagged: count(e => Boolean(e.thesisDrift?.flagged)),
            noPrice: count(e => e.price === undefined)
        },
        entries: sent
    }
}

/** Compact JSON without nulls (same discipline as the Coach snapshot). */
export function watchlistScanJson(facts: WatchlistScanFacts): string {
    return JSON.stringify(facts, (_key, value) => (value === null || value === undefined ? undefined : value))
}

// ---------------------------------------------------------------------------
// Host adapter
// ---------------------------------------------------------------------------

type ResearchCache<T> = Map<string, T | 'loading' | 'error'>
type AnyRecord = Record<string, any>

export interface WatchlistScanHost extends TickerHost {
    watchlist: WatchlistEntry[]
    trades: AnyRecord[]
    driftCache: ReadonlyMap<string, DriftView | 'loading' | 'error'>
    finnhub?: { apiKey: string | null } | null
    metricsCache: ResearchCache<StockMetrics>
    signalsCache: ResearchCache<SignalsData>
    earningsCache: ResearchCache<EarningsSurprise[]>
    metricsPromiseMap: Map<string, Promise<StockMetrics | null>>
    earningsMap: ReadonlyMap<string, { date?: string }>
    fetchStockMetrics(ticker: string): Promise<StockMetrics | null>
    fetchEarningsCalendar(tickers: string[], toDate: string): Promise<unknown>
    getCurrentPrice(ticker: string, opts?: { forceRefresh?: boolean; scope?: string; priority?: number }): Promise<unknown>
    getActiveLLMProvider(): LLMProvider
    appendAIChatMessage(sender: string, text: string, options?: Record<string, unknown>): string | null
    toggleAIChat(forceOpen?: boolean | null): void
    hasAICoachConsent(requirement?: ConsentRequirement): boolean
    promptAICoachConsent(nextAction?: (() => void) | null, requirement?: ConsentRequirement): boolean
    handleAIQuickPrompt(prompt: string, options?: {
        promptType?: string | null
        displayText?: string | null
        consent?: ConsentRequirement
        groundingJson?: string | null
    }): Promise<void>
}

const asOfOf = (host: TickerHost) => (host.currentDate instanceof Date ? host.currentDate : new Date()).toISOString().slice(0, 10)

/** Missing prices, scores and earnings dates are fetched (rate-limited), but never waited on for long. */
async function primeScanData(this: WatchlistScanHost, tickers: string[]): Promise<void> {
    if (!this.finnhub?.apiKey || !tickers.length) return
    const loads: Promise<unknown>[] = []
    for (const ticker of tickers) {
        if (!this.getCachedQuote?.(ticker)?.value && !this.schwab?.quoteCache?.get(ticker)) {
            loads.push(this.getCurrentPrice(ticker, { priority: 10 }).catch(() => null))
        }
        const cached = this.metricsCache.get(ticker)
        if (cached === undefined) {
            this.metricsCache.set(ticker, 'loading')
            const promise = this.fetchStockMetrics(ticker)
            this.metricsPromiseMap.set(ticker, promise)
            loads.push(promise.then(
                (data) => { this.metricsPromiseMap.delete(ticker); this.metricsCache.set(ticker, data ?? 'error') },
                () => { this.metricsPromiseMap.delete(ticker); this.metricsCache.set(ticker, 'error') }
            ))
        } else if (cached === 'loading') {
            const inFlight = this.metricsPromiseMap.get(ticker)
            if (inFlight) loads.push(inFlight.catch(() => null))
        }
    }
    if (tickers.some(ticker => !this.earningsMap.has(ticker))) {
        const now = this.currentDate instanceof Date ? this.currentDate : new Date()
        const toDate = new Date(now.getTime() + 90 * 86_400_000).toISOString().slice(0, 10)
        loads.push(this.fetchEarningsCalendar(tickers, toDate).catch(() => null))
    }
    await Promise.race([Promise.allSettled(loads), new Promise(resolve => setTimeout(resolve, SCAN_WAIT_MS))])
}

export function gatherWatchlistScanFacts(this: WatchlistScanHost): WatchlistScanFacts {
    const asOf = asOfOf(this)
    const openByTicker = new Map<string, number>()
    for (const trade of this.trades ?? []) {
        if (!trade || this.isClosedStatus(trade.status)) continue
        const ticker = String(trade.ticker ?? '').toUpperCase()
        openByTicker.set(ticker, (openByTicker.get(ticker) ?? 0) + 1)
    }
    const inputs = this.watchlist.map((entry): WatchlistScanInput => {
        const cached = entry.notes?.trim() ? this.driftCache.get(driftCacheKey(entry.ticker, entry.notes, asOf)) : undefined
        return {
            ctx: gatherTickerContext.call(this, entry.ticker, { watchlistEntry: entry }),
            earningsDate: this.earningsMap.get(entry.ticker)?.date ?? null,
            drift: cached && cached !== 'loading' && cached !== 'error' ? cached : null,
            openPositions: openByTicker.get(entry.ticker) ?? 0
        }
    })
    return buildWatchlistScanFacts(inputs, asOf)
}

export async function askCoachWatchlistScan(this: WatchlistScanHost): Promise<void> {
    if (!this.getActiveLLMProvider().isConfigured()) return
    // Asked before the data wait, so the consent dialog doesn't appear seconds after the click.
    if (!this.hasAICoachConsent({ minVersion: 2 })) {
        this.promptAICoachConsent(() => { void askCoachWatchlistScan.call(this) }, { minVersion: 2 })
        return
    }
    if (!this.watchlist.length) {
        this.toggleAIChat(true)
        this.appendAIChatMessage('user', WATCHLIST_SCAN_LABEL)
        this.appendAIChatMessage('ai', 'Your watchlist is empty. Add tickers on the Watchlist page (ideally with a watch price and a short thesis), then run the scan again.')
        return
    }
    await primeScanData.call(this, this.watchlist.map(entry => entry.ticker))
    const json = watchlistScanJson(gatherWatchlistScanFacts.call(this))
    void this.handleAIQuickPrompt(`WATCHLIST FACTS (compact JSON computed by GammaLedger):\n${json}`, {
        promptType: 'watchlist_scan',
        displayText: WATCHLIST_SCAN_LABEL,
        consent: { minVersion: 2 },
        groundingJson: json
    })
}
