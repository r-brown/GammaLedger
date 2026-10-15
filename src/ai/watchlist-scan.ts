// src/ai/watchlist-scan.ts — "Watchlist scan" quick prompt: an honest review of the whole list
// (quality, suggested priority, earnings, entry levels, adds and removals).
//
// Flow: (1) collect the market research each ticker is missing (rate-limited, with progress and a
// "Scan now" / "Cancel" choice, saved for next time), (2) JEV pre-grades every ticker it can,
// (3) the facts go to the Coach, which answers with a ```watchlist block the app merges with its
// own facts and renders as the table.
//
// The app computes every fact and flag per entry. Tickers without market data are listed as
// unscored instead of being sent as empty entries. The trader's own watch price, rating and thesis
// are NOT part of the entries: they go in a separate `traderInputs` block listed last, so they
// can't anchor the Coach's view of each ticker (it compares against them only at the end).

import type { WatchlistEntry } from '../types/watchlist.js'
import type { DriftView } from '../types/ai.js'
import type { LLMProvider } from '../integrations/llm/types.js'
import type { ConsentRequirement } from '../core/consent.js'
import { APP_CONFIG } from '../core/config.js'
import { safeLocalStorage } from '../core/storage.js'
import { WatchlistScanHistorySchema, type WatchlistScanHistory } from '../core/schema.js'
import { daysBetweenIso } from '../calculations/market-facts.js'
import { compactJson, gatherTickerContext, type TickerContext, type TickerHost } from './ticker-context.js'
import { driftCacheKey } from './watchlist-drift.js'
import {
    collectMarketResearch,
    formatDuration,
    planMarketResearch,
    researchQuote,
    researchStateOf,
    type ResearchHost,
    type ResearchPlan,
    type ResearchProgress
} from './market-research.js'
import { gradeWatchlist, isJevAvailable, scanGradeCacheKey, type GradeHost, type ScanGrade } from './watchlist-grade.js'
import { mergeScanTable, type MergeInput, type ScanRowFacts } from './scan-table.js'

export const WATCHLIST_SCAN_LABEL = 'Watchlist scan'
/** Cap on entries sent; the lowest-ranked ones are dropped and counted as omitted. */
export const MAX_SCAN_ENTRIES = 40
/** Earnings this close are worth flagging for an entry decision (IV crush / gap risk). */
export const EARNINGS_SOON_DAYS = 14
/** A typical new short put's life: earnings inside it are worth a flag too. */
export const TYPICAL_DTE_DAYS = 45
const MAX_SCAN_THESIS_CHARS = 240

export interface WatchlistScanInput {
    ctx: TickerContext
    earningsDate: string | null
    drift: DriftView | null
    /** Open trades on this ticker (the trader already has exposure). */
    openPositions: number
    /** JEV's calibrated pre-grade of the same market facts, when available. */
    grade?: ScanGrade | null
    /** True once the per-symbol calendar was checked (so a missing date means none in 90 days). */
    earningsChecked?: boolean
    hasSurprises?: boolean
}

/** Market and risk facts about one ticker: nothing the trader typed in. */
export interface WatchlistScanEntry {
    ticker: string
    price?: number
    sector?: string
    nextEarnings?: { date: string; daysAway: number }
    trend?: NonNullable<TickerContext['trend']>
    momentum?: TickerContext['momentum']
    range52w?: TickerContext['range52w']
    beta?: number
    /** 3-month volatility of daily returns, annualized, in %. */
    hv3mPct?: number
    vsSP500_13wPct?: number
    scores?: { risk: string; own: string; balanceSheet: string; valuation: string }
    /** The inputs behind each score, e.g. "β1.8 · HV62% · 5D -6.2%". */
    scoreNotes?: { risk: string; own: string; balanceSheet: string; valuation: string }
    analyst?: { buy: number; hold: number; sell: number }
    insiderNet90d?: 'buying' | 'selling' | 'mixed'
    earningsBeatsLast4?: number
    jev?: { quality: ScanGrade['quality']; confidence?: number }
    aiVerdict?: string
    thesisDrift?: { flagged: boolean; probability: number }
    openPositions?: number
    /** App-computed reasons this entry may need a look, strongest first. */
    flags: string[]
}

/** A ticker the app could not score: no market data, so the Coach must not judge it. */
export interface WatchlistUnscored {
    ticker: string
    missing: string[]
    price?: number
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

export interface WatchlistScanCoverage {
    /** Out of `watched`. */
    metrics: number
    signals: number
    earningsHistory: number
    earningsDateChecked: number
    price: number
    jevGraded: number
}

export interface WatchlistScanFacts {
    asOf: string
    summary: {
        watched: number
        sent: number
        unscored: number
        omitted: number
        earningsWithin14d: number
        earningsWithin45d: number
        thesisDriftFlagged: number
        noPrice: number
        coverage: WatchlistScanCoverage
    }
    entries: WatchlistScanEntry[]
    unscored: WatchlistUnscored[]
    /** Listed last on purpose. */
    traderInputs: WatchlistTraderInput[]
}

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text)
const finite = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

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

/** The app scores a ticker only when it has metrics (trend, range and the four scores come from them). */
export function isScorable(ctx: TickerContext): boolean {
    return ctx.scores !== null
}

export function missingResearch(input: WatchlistScanInput): string[] {
    const { ctx } = input
    const missing: string[] = []
    if (!ctx.scores) missing.push('metrics')
    if (ctx.price === null) missing.push('price')
    if (!ctx.signals) missing.push('analyst/insider')
    if (input.hasSurprises === false) missing.push('earnings history')
    if (!input.earningsDate && !input.earningsChecked) missing.push('earnings date')
    return missing
}

export function buildScanEntry(input: WatchlistScanInput): WatchlistScanEntry {
    const { ctx } = input
    const flags: string[] = []
    const entry: WatchlistScanEntry = { ticker: ctx.ticker, flags }
    if (ctx.price !== null) entry.price = ctx.price
    if (ctx.sector) entry.sector = ctx.sector

    if (input.drift) {
        entry.thesisDrift = { flagged: input.drift.drifted, probability: Math.round(input.drift.probability * 100) / 100 }
        if (input.drift.drifted) flags.push('thesis may no longer fit')
    }

    if (input.earningsDate && input.earningsDate >= ctx.asOf) {
        const daysAway = daysBetweenIso(ctx.asOf, input.earningsDate)
        entry.nextEarnings = { date: input.earningsDate, daysAway }
        if (daysAway <= EARNINGS_SOON_DAYS) flags.push(`earnings in ${daysAway}d`)
        else if (daysAway <= TYPICAL_DTE_DAYS) flags.push(`earnings inside a ${TYPICAL_DTE_DAYS}-DTE put (${daysAway}d)`)
    }

    if (ctx.trend) entry.trend = ctx.trend
    if (ctx.momentum) entry.momentum = ctx.momentum
    if (ctx.range52w) entry.range52w = ctx.range52w
    if (ctx.scores) {
        entry.scores = {
            risk: ctx.scores.risk.grade,
            own: ctx.scores.own.grade,
            balanceSheet: ctx.scores.balanceSheet.grade,
            valuation: ctx.scores.valuation.grade
        }
        entry.scoreNotes = {
            risk: ctx.scores.risk.detail,
            own: ctx.scores.own.detail,
            balanceSheet: ctx.scores.balanceSheet.detail,
            valuation: ctx.scores.valuation.detail
        }
    }
    if (ctx.risk) {
        if (ctx.risk.beta !== null) entry.beta = ctx.risk.beta
        if (ctx.risk.hv3mPct !== null) entry.hv3mPct = ctx.risk.hv3mPct
        if (ctx.risk.vsSP500_13wPct !== null) entry.vsSP500_13wPct = ctx.risk.vsSP500_13wPct
    }
    if (ctx.signals?.analyst) entry.analyst = ctx.signals.analyst
    if (ctx.signals && ctx.signals.insiderNet90d !== 'none') entry.insiderNet90d = ctx.signals.insiderNet90d
    if (ctx.signals?.earningsBeatsLast4 !== null && ctx.signals?.earningsBeatsLast4 !== undefined) {
        entry.earningsBeatsLast4 = ctx.signals.earningsBeatsLast4
    }
    if (input.grade) {
        entry.jev = input.grade.confidence !== null
            ? { quality: input.grade.quality, confidence: input.grade.confidence }
            : { quality: input.grade.quality }
    }
    if (ctx.aiRead) entry.aiVerdict = ctx.aiRead.display

    if (input.openPositions > 0) {
        entry.openPositions = input.openPositions
        flags.push(`already ${input.openPositions} open position${input.openPositions === 1 ? '' : 's'}`)
    }
    if (entry.price === undefined) flags.push('no current price')
    return entry
}

/** What JEV judges: the entry's market facts, without flags, exposure or other models' views. */
export function gradeStateOf(entry: WatchlistScanEntry, asOf: string): Record<string, unknown> {
    const { flags: _flags, openPositions: _open, thesisDrift: _drift, aiVerdict: _ai, jev: _jev, ...facts } = entry
    return { asOf, ...facts }
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
        return { input, entry, trader: buildTraderInput(input.ctx), index, rank: capRank(entry), scorable: isScorable(input.ctx) }
    })
    const scorable = built.filter(item => item.scorable)
    // The cap keeps the best-ranked entries, but they go out in the trader's own list order so the
    // order itself carries no opinion.
    const kept = [...scorable]
        .sort((a, b) => b.rank - a.rank || a.index - b.index)
        .slice(0, MAX_SCAN_ENTRIES)
        .sort((a, b) => a.index - b.index)
    const unscored = built.filter(item => !item.scorable).map((item): WatchlistUnscored => {
        const out: WatchlistUnscored = { ticker: item.entry.ticker, missing: missingResearch(item.input) }
        if (item.entry.price !== undefined) out.price = item.entry.price
        return out
    })
    const count = (pred: (item: typeof built[number]) => boolean) => built.filter(pred).length
    return {
        asOf,
        summary: {
            watched: built.length,
            sent: kept.length,
            unscored: unscored.length,
            omitted: scorable.length - kept.length,
            earningsWithin14d: count(i => Boolean(i.entry.nextEarnings && i.entry.nextEarnings.daysAway <= EARNINGS_SOON_DAYS)),
            earningsWithin45d: count(i => Boolean(i.entry.nextEarnings && i.entry.nextEarnings.daysAway <= TYPICAL_DTE_DAYS)),
            thesisDriftFlagged: count(i => Boolean(i.entry.thesisDrift?.flagged)),
            noPrice: count(i => i.entry.price === undefined),
            coverage: {
                metrics: count(i => i.scorable),
                signals: count(i => i.input.ctx.signals !== null),
                earningsHistory: count(i => i.input.hasSurprises !== false && i.input.ctx.signals?.earningsBeatsLast4 !== null && i.input.ctx.signals?.earningsBeatsLast4 !== undefined),
                earningsDateChecked: count(i => Boolean(i.input.earningsDate) || Boolean(i.input.earningsChecked)),
                price: count(i => i.entry.price !== undefined),
                jevGraded: count(i => Boolean(i.input.grade))
            }
        },
        entries: kept.map(item => item.entry),
        unscored,
        traderInputs: kept.map(item => item.trader)
    }
}

/** Compact JSON without nulls (same discipline as the Coach snapshot). */
export function watchlistScanJson(facts: WatchlistScanFacts): string {
    return compactJson(facts)
}

/** What the table merge needs from the facts that were sent. */
export function scanMergeInput(facts: WatchlistScanFacts, previous: WatchlistScanHistory | null): MergeInput {
    const traders = new Map(facts.traderInputs.map(input => [input.ticker, input]))
    const scored = new Map<string, ScanRowFacts>()
    facts.entries.forEach((entry, index) => {
        const trader = traders.get(entry.ticker)
        const row: ScanRowFacts = { index }
        if (entry.price !== undefined) row.price = entry.price
        const pos = finite(entry.range52w?.positionPct)
        if (pos !== null) row.rangePos = pos
        if (entry.trend) row.trend = entry.trend
        if (entry.nextEarnings) row.earnings = entry.nextEarnings
        if (entry.jev) row.jev = { quality: entry.jev.quality, confidence: entry.jev.confidence ?? null }
        if (trader?.rating !== undefined) row.myStars = trader.rating
        if (trader?.watchPrice) row.watchPrice = trader.watchPrice.level
        if (entry.openPositions) row.openPositions = entry.openPositions
        scored.set(entry.ticker, row)
    })
    return {
        asOf: facts.asOf,
        scored,
        unscored: facts.unscored.map(u => ({ ticker: u.ticker, missing: u.missing })),
        previous: previous && previous.asOf !== facts.asOf ? { asOf: previous.asOf, rows: previous.rows } : null
    }
}

export function parseScanHistory(raw: string | null): WatchlistScanHistory | null {
    if (!raw) return null
    try {
        const parsed = WatchlistScanHistorySchema.safeParse(JSON.parse(raw))
        return parsed.success ? parsed.data : null
    } catch {
        return null
    }
}

export function progressText(progress: ResearchProgress, rpm: number): string {
    const left = progress.total - progress.done
    const eta = left > 0 ? ` · about ${formatDuration(progress.etaMs)} left` : ''
    return `**Collecting market data** for the Watchlist scan: ${progress.done} of ${progress.total} tickers${eta}.\n\n`
        + `Finnhub allows ${rpm} requests a minute, shared with live quotes, so this takes a while the first time. `
        + 'Everything is saved, so later scans start right away. You can scan now with what has loaded or keep waiting.'
}

// ---------------------------------------------------------------------------
// Host adapter
// ---------------------------------------------------------------------------

type AnyRecord = Record<string, any>

export interface WatchlistScanHost extends Omit<TickerHost, 'metricsCache' | 'signalsCache' | 'earningsCache' | 'profileCache' | 'earningsMap' | 'schwab' | 'getCachedQuote'>, ResearchHost, GradeHost {
    schwab?: TickerHost['schwab'] & ResearchHost['schwab']
    getCachedQuote?(ticker: string): { value?: { price?: number; previousClose?: number } } | null
    watchlist: WatchlistEntry[]
    trades: AnyRecord[]
    driftCache: ReadonlyMap<string, DriftView | 'loading' | 'error'>
    watchlistScanRun: AbortController | null
    watchlistScanHistory: WatchlistScanHistory | null
    aiChatActionHandlers: Map<string, () => void>
    aiChatPendingRequest: boolean | Promise<unknown> | null
    currentView?: string
    watchlistGridApi?: { refreshCells(params?: { columns?: string[]; force?: boolean }): void } | null
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
        transformReply?: ((text: string) => string) | null
    }): Promise<void>
}

const asOfOf = (host: TickerHost) => (host.currentDate instanceof Date ? host.currentDate : new Date()).toISOString().slice(0, 10)

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
        const research = researchStateOf.call(this, entry.ticker)
        return {
            ctx: gatherTickerContext.call(this, entry.ticker, { watchlistEntry: entry, fallbackPrice: researchQuote(this, entry.ticker) }),
            earningsDate: this.earningsMap.get(entry.ticker)?.date ?? null,
            drift: cached && cached !== 'loading' && cached !== 'error' ? cached : null,
            openPositions: openByTicker.get(entry.ticker) ?? 0,
            grade: this.scanGradeCache.get(scanGradeCacheKey(entry.ticker, asOf)) ?? null,
            earningsChecked: research.stamps.earnings !== undefined,
            hasSurprises: research.status.surprises === 'ok'
        }
    })
    return buildWatchlistScanFacts(inputs, asOf)
}

export function loadWatchlistScanHistory(this: Pick<WatchlistScanHost, 'watchlistScanHistory'>): void {
    this.watchlistScanHistory = parseScanHistory(safeLocalStorage.getItem(APP_CONFIG.STORAGE.WATCHLIST_SCAN_HISTORY))
}

/** The last scan's verdict on one ticker (Watchlist grid "Coach ★" column). */
export function getWatchlistScanVerdict(this: Pick<WatchlistScanHost, 'watchlistScanHistory'>, ticker: string): { stars: number; quality: string; asOf: string } | null {
    const history = this.watchlistScanHistory
    const row = history?.rows.find(r => r.ticker === ticker.toUpperCase())
    return history && row ? { stars: row.stars, quality: row.quality, asOf: history.asOf } : null
}

function saveScanHistory(this: WatchlistScanHost, history: WatchlistScanHistory): void {
    this.watchlistScanHistory = history
    try {
        safeLocalStorage.setItem(APP_CONFIG.STORAGE.WATCHLIST_SCAN_HISTORY, JSON.stringify(history))
    } catch (error) {
        console.warn('Could not save the watchlist scan result:', error)
    }
    if (this.currentView === 'watchlist') this.watchlistGridApi?.refreshCells({ columns: ['coachStars'], force: true })
}

const ACTION_SCAN_NOW = 'watchlist-scan:now'
const ACTION_CANCEL = 'watchlist-scan:cancel'

/** Runs the collection with a live progress message. Resolves false when the user cancelled. */
async function collectWithProgress(this: WatchlistScanHost, plan: ResearchPlan): Promise<boolean> {
    const rpm = Number(this.finnhub?.maxRequestsPerMinute) || 60
    const actions = [
        { id: ACTION_SCAN_NOW, label: 'Scan now with what has loaded', variant: 'primary' },
        { id: ACTION_CANCEL, label: 'Cancel', variant: 'secondary' }
    ]
    const started = Date.now()
    const stop = new AbortController()
    const state: { choice: 'done' | 'now' | 'cancel' } = { choice: 'done' }
    const statusId = this.appendAIChatMessage('ai', progressText({ done: 0, total: plan.needs.size, callsLeft: plan.calls, etaMs: plan.etaMs, failed: [] }, rpm), { actions })
    const update = (text: string, withActions: boolean) => {
        if (statusId) this.appendAIChatMessage('ai', text, { replaceId: statusId, actions: withActions ? actions : null })
    }
    this.aiChatActionHandlers.set(ACTION_SCAN_NOW, () => {
        state.choice = 'now'
        stop.abort()
        update('Finishing the tickers already in flight, then scanning…', false)
    })
    this.aiChatActionHandlers.set(ACTION_CANCEL, () => {
        state.choice = 'cancel'
        stop.abort()
        update('Cancelling…', false)
    })
    try {
        const outcome = await collectMarketResearch.call(this, plan, {
            signal: stop.signal,
            onProgress: (progress) => { if (!stop.signal.aborted) update(progressText(progress, rpm), true) }
        })
        const took = formatDuration(Date.now() - started)
        const failed = outcome.failed.length
            ? ` Some data couldn't be loaded for ${outcome.failed.join(', ')}; it is retried on the next scan.`
            : ''
        if (state.choice === 'cancel') {
            update(`Data collection cancelled after ${outcome.done} of ${outcome.total} tickers (${took}). What loaded is saved; run the scan again to continue.`, false)
            return false
        }
        update(state.choice === 'now'
            ? `Collected market data for ${outcome.done} of ${outcome.total} tickers (${took}); scanning with what has loaded.${failed}`
            : `Collected market data for ${outcome.total} ticker${outcome.total === 1 ? '' : 's'} in ${took}.${failed}`, false)
        return true
    } finally {
        this.aiChatActionHandlers.delete(ACTION_SCAN_NOW)
        this.aiChatActionHandlers.delete(ACTION_CANCEL)
    }
}

export async function askCoachWatchlistScan(this: WatchlistScanHost): Promise<void> {
    if (!this.getActiveLLMProvider().isConfigured()) return
    // Asked before the data wait, so the consent dialog doesn't appear minutes after the click.
    if (!this.hasAICoachConsent({ minVersion: 2 })) {
        this.promptAICoachConsent(() => { void askCoachWatchlistScan.call(this) }, { minVersion: 2 })
        return
    }
    this.toggleAIChat(true)
    if (!this.watchlist.length) {
        this.appendAIChatMessage('user', WATCHLIST_SCAN_LABEL)
        this.appendAIChatMessage('ai', 'Your watchlist is empty. Add tickers on the Watchlist page (ideally with a watch price and a short thesis), then run the scan again.')
        return
    }
    if (this.watchlistScanRun) return
    const run = new AbortController()
    this.watchlistScanRun = run
    try {
        const tickers = this.watchlist.map(entry => entry.ticker)
        if (this.finnhub?.apiKey) {
            const plan = planMarketResearch.call(this, tickers)
            if (plan.calls > 0 && !(await collectWithProgress.call(this, plan))) return
        } else {
            this.appendAIChatMessage('ai', 'No Finnhub API key is set, so the scan can only see prices. Add a free key in Settings → Finnhub for trend, scores, analyst and earnings data.')
        }

        if (isJevAvailable.call(this)) {
            const asOf = asOfOf(this)
            const states = new Map<string, Record<string, unknown>>()
            for (const entry of gatherWatchlistScanFacts.call(this).entries) states.set(entry.ticker, gradeStateOf(entry, asOf))
            const statusId = this.appendAIChatMessage('ai', `Pre-grading ${states.size} tickers with JEV…`)
            const graded = await gradeWatchlist.call(this, states, asOf, {
                signal: run.signal,
                onProgress: (done, total) => {
                    if (statusId && total) this.appendAIChatMessage('ai', `Pre-grading with JEV: ${done} of ${total} tickers…`, { replaceId: statusId })
                }
            })
            if (statusId) this.appendAIChatMessage('ai', `JEV pre-graded ${graded} ticker${graded === 1 ? '' : 's'} (calibrated second opinion, shown in the table).`, { replaceId: statusId })
        }

        // A question typed while the data was collecting may still be answering: the chat takes one at a time.
        if (this.aiChatPendingRequest) {
            this.appendAIChatMessage('ai', 'The market data is ready, but another answer is still running. Run the Watchlist scan again once it finishes; it will start right away.')
            return
        }
        const facts = gatherWatchlistScanFacts.call(this)
        const merge = scanMergeInput(facts, this.watchlistScanHistory)
        const json = watchlistScanJson(facts)
        await this.handleAIQuickPrompt(`WATCHLIST FACTS (compact JSON computed by GammaLedger; the trader's own inputs are last):\n${json}`, {
            promptType: 'watchlist_scan',
            displayText: WATCHLIST_SCAN_LABEL,
            consent: { minVersion: 2 },
            groundingJson: json,
            transformReply: (text) => {
                const merged = mergeScanTable(text, merge)
                if (!merged) return text
                saveScanHistory.call(this, {
                    version: 1,
                    asOf: facts.asOf,
                    rows: merged.table.rows.map(row => ({ ticker: row.ticker, quality: row.quality, stars: row.stars }))
                })
                return merged.text
            }
        })
    } finally {
        this.watchlistScanRun = null
    }
}
