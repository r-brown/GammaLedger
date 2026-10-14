// src/ai/watchlist-scan.ts — "Watchlist scan" quick prompt: an honest review of the whole list
// (quality, suggested priority, earnings, entry levels, adds and removals). The app computes every
// fact and flag per entry. The trader's own watch price, rating and thesis are NOT part of the
// entries: they go in a separate `traderInputs` block listed last, so they can't anchor the
// Coach's view of each ticker (it compares against them only at the end).

import type { WatchlistEntry } from '../types/watchlist.js'
import type { DriftView } from '../types/ai.js'
import type { EarningsSurprise, SignalsData, StockMetrics } from '../types/integrations.js'
import type { LLMProvider } from '../integrations/llm/types.js'
import type { ConsentRequirement } from '../core/consent.js'
import { daysBetweenIso } from '../calculations/market-facts.js'
import { compactJson, gatherTickerContext, type TickerContext, type TickerHost } from './ticker-context.js'
import { driftCacheKey } from './watchlist-drift.js'

export const WATCHLIST_SCAN_LABEL = 'Watchlist scan'
/** Cap on entries sent; the lowest-ranked ones are dropped and counted as omitted. */
export const MAX_SCAN_ENTRIES = 40
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

/** Market and risk facts about one ticker: nothing the trader typed in. */
export interface WatchlistScanEntry {
    ticker: string
    price?: number
    nextEarnings?: { date: string; daysAway: number }
    momentum?: TickerContext['momentum']
    range52w?: TickerContext['range52w']
    scores?: { risk: string; own: string; balanceSheet: string; valuation: string }
    analyst?: { buy: number; hold: number; sell: number }
    insiderNet90d?: 'buying' | 'selling' | 'mixed'
    earningsBeatsLast4?: number
    aiVerdict?: string
    thesisDrift?: { flagged: boolean; probability: number }
    openPositions?: number
    /** App-computed reasons this entry may need a look, strongest first. */
    flags: string[]
}

/** What the trader set on the entry: their view, to be compared against, never to be judged from. */
export interface WatchlistTraderInput {
    ticker: string
    rating?: number
    watchPrice?: NonNullable<TickerContext['watchlist']>['watchPrice']
    thesis?: string
    tags?: string[]
    daysSinceAdded?: number
    /** Missing inputs: 'rating', 'watch price', 'thesis'. */
    gaps?: string[]
}

export interface WatchlistScanFacts {
    asOf: string
    summary: {
        watched: number
        sent: number
        omitted: number
        earningsWithin14d: number
        thesisDriftFlagged: number
        noPrice: number
    }
    entries: WatchlistScanEntry[]
    /** Listed last on purpose. */
    traderInputs: WatchlistTraderInput[]
}

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text)

/**
 * Decides only what the cap drops. Deliberately blind to the watch price and the rating: the
 * trader's own numbers must not decide which entries the Coach gets to judge.
 */
function capRank(entry: WatchlistScanEntry): number {
    let rank = 0
    if (entry.thesisDrift?.flagged) rank += 12
    if (entry.nextEarnings && entry.nextEarnings.daysAway <= EARNINGS_SOON_DAYS) rank += 8
    if (entry.price === undefined) rank -= 5
    return rank
}

export function buildScanEntry(input: WatchlistScanInput): WatchlistScanEntry {
    const { ctx } = input
    const flags: string[] = []
    const entry: WatchlistScanEntry = { ticker: ctx.ticker, flags }
    if (ctx.price !== null) entry.price = ctx.price

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
    if (ctx.range52w) entry.range52w = ctx.range52w
    if (ctx.scores) {
        entry.scores = {
            risk: ctx.scores.risk.grade,
            own: ctx.scores.own.grade,
            balanceSheet: ctx.scores.balanceSheet.grade,
            valuation: ctx.scores.valuation.grade
        }
    }
    if (ctx.signals?.analyst) entry.analyst = ctx.signals.analyst
    if (ctx.signals && ctx.signals.insiderNet90d !== 'none') entry.insiderNet90d = ctx.signals.insiderNet90d
    if (ctx.signals?.earningsBeatsLast4 !== null && ctx.signals?.earningsBeatsLast4 !== undefined) {
        entry.earningsBeatsLast4 = ctx.signals.earningsBeatsLast4
    }
    if (ctx.aiRead) entry.aiVerdict = ctx.aiRead.display

    if (input.openPositions > 0) {
        entry.openPositions = input.openPositions
        flags.push(`already ${input.openPositions} open position${input.openPositions === 1 ? '' : 's'}`)
    }
    if (entry.price === undefined) flags.push('no current price')
    return entry
}

export function buildTraderInput(ctx: TickerContext): WatchlistTraderInput {
    const w = ctx.watchlist
    const out: WatchlistTraderInput = { ticker: ctx.ticker }
    const gaps: string[] = []
    if (w?.rating !== null && w?.rating !== undefined) out.rating = w.rating
    else gaps.push('rating')
    if (w?.watchPrice) out.watchPrice = w.watchPrice
    else gaps.push('watch price')
    if (w?.thesis) out.thesis = clip(w.thesis, MAX_SCAN_THESIS_CHARS)
    else gaps.push('thesis')
    if (w?.tags.length) out.tags = w.tags
    if (w?.daysSinceAdded !== null && w?.daysSinceAdded !== undefined) out.daysSinceAdded = w.daysSinceAdded
    if (gaps.length) out.gaps = gaps
    return out
}

export function buildWatchlistScanFacts(inputs: WatchlistScanInput[], asOf: string): WatchlistScanFacts {
    const built = inputs.map((input, index) => {
        const entry = buildScanEntry(input)
        return { entry, trader: buildTraderInput(input.ctx), index, rank: capRank(entry) }
    })
    // The cap keeps the best-ranked entries, but they go out in the trader's own list order so the
    // order itself carries no opinion.
    const kept = [...built]
        .sort((a, b) => b.rank - a.rank || a.index - b.index)
        .slice(0, MAX_SCAN_ENTRIES)
        .sort((a, b) => a.index - b.index)
    const count = (pred: (e: WatchlistScanEntry) => boolean) => built.filter(item => pred(item.entry)).length
    return {
        asOf,
        summary: {
            watched: built.length,
            sent: kept.length,
            omitted: built.length - kept.length,
            earningsWithin14d: count(e => Boolean(e.nextEarnings && e.nextEarnings.daysAway <= EARNINGS_SOON_DAYS)),
            thesisDriftFlagged: count(e => Boolean(e.thesisDrift?.flagged)),
            noPrice: count(e => e.price === undefined)
        },
        entries: kept.map(item => item.entry),
        traderInputs: kept.map(item => item.trader)
    }
}

/** Compact JSON without nulls (same discipline as the Coach snapshot). */
export function watchlistScanJson(facts: WatchlistScanFacts): string {
    return compactJson(facts)
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
    void this.handleAIQuickPrompt(`WATCHLIST FACTS (compact JSON computed by GammaLedger; the trader's own inputs are last):\n${json}`, {
        promptType: 'watchlist_scan',
        displayText: WATCHLIST_SCAN_LABEL,
        consent: { minVersion: 2 },
        groundingJson: json
    })
}
