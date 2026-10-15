// src/ai/market-research.ts — the per-ticker research the Watchlist scan and Ask Coach read
// (metrics, analyst/insider signals, earnings history, next earnings date, company profile):
// what is missing or stale, how many Finnhub calls fetching it costs, a rate-limited collector
// with progress, and a localStorage copy with fetch times so a reload doesn't refetch everything.
// The pure helpers (researchNeeds, estimate*, serialize/parse) are unit-tested without a browser.

import type { CompanyProfile, EarningsCalendarEntry, EarningsSurprise, SignalsData, StockMetrics } from '../types/integrations.js'
import { APP_CONFIG } from '../core/config.js'
import { safeLocalStorage } from '../core/storage.js'
import { MarketResearchCacheSchema, type MarketResearchCache, type MarketResearchEntry } from '../core/schema.js'
import { PRIORITY } from '../integrations/request-scheduler.js'

export type ResearchKind = 'metrics' | 'signals' | 'surprises' | 'earnings' | 'profile'
export const RESEARCH_KINDS: readonly ResearchKind[] = ['metrics', 'signals', 'surprises', 'earnings', 'profile']

const HOUR = 3_600_000
const DAY = 24 * HOUR

/** How long fetched research stays fresh. Fundamentals move slowly; the earnings date is re-checked every few days. */
export const RESEARCH_TTL_MS: Record<ResearchKind, number> = {
    metrics: DAY,
    signals: 3 * DAY,
    surprises: 14 * DAY,
    earnings: 3 * DAY,
    profile: 30 * DAY
}

/** Finnhub requests each kind costs (signals = recommendation + news + insider transactions). */
export const RESEARCH_CALLS: Record<ResearchKind | 'quote', number> = {
    quote: 1,
    metrics: 1,
    signals: 3,
    surprises: 1,
    earnings: 1,
    profile: 1
}

export const EARNINGS_LOOKAHEAD_DAYS = 90
/**
 * Prices fetched while collecting stay usable this long. The live quote cache keeps a price only a
 * minute, which a multi-minute collection outlasts; the scan only needs a recent price, not a tick.
 */
export const RESEARCH_QUOTE_TTL_MS = 15 * 60_000
const MAX_PERSISTED_TICKERS = 200
const MAX_PERSISTED_NEWS_SUMMARY = 280
/** Tickers researched at once; each fans out into several requests, and the scheduler paces them all. */
const COLLECT_CONCURRENCY = 2

export type ResearchStatus = 'ok' | 'loading' | 'error' | 'missing'

export interface ResearchState {
    status: Record<ResearchKind, ResearchStatus>
    /** When each kind was fetched (ms); absent = fetched this session by another view, so fresh. */
    stamps: Partial<Record<ResearchKind, number>>
    /** Known next earnings date (from the per-symbol or the market-wide calendar). */
    earningsDate: string | null
    hasPrice: boolean
}

/**
 * Kinds to (re)fetch for one ticker: missing, failed, past their TTL, or an earnings date that has
 * already passed. `quote` is included when there is no price at all.
 */
export function researchNeeds(state: ResearchState, now: number, today: string): Array<ResearchKind | 'quote'> {
    const needs: Array<ResearchKind | 'quote'> = []
    if (!state.hasPrice) needs.push('quote')
    for (const kind of RESEARCH_KINDS) {
        const status = state.status[kind]
        const stamp = state.stamps[kind]
        if (status === 'missing' || status === 'error') needs.push(kind)
        else if (status === 'ok' && stamp !== undefined && now - stamp > RESEARCH_TTL_MS[kind]) needs.push(kind)
        else if (kind === 'earnings' && status === 'ok' && state.earningsDate !== null && state.earningsDate < today) needs.push(kind)
    }
    return needs
}

export function estimateCalls(needs: ReadonlyArray<ResearchKind | 'quote'>): number {
    return needs.reduce((sum, kind) => sum + RESEARCH_CALLS[kind], 0)
}

/** Lower bound: the dashboard's quote polling shares the same per-minute budget. */
export function estimateDurationMs(calls: number, requestsPerMinute: number): number {
    const rpm = Number.isFinite(requestsPerMinute) && requestsPerMinute > 0 ? requestsPerMinute : 60
    return Math.ceil((calls / rpm) * 60_000)
}

export function formatDuration(ms: number): string {
    const seconds = Math.max(1, Math.round(ms / 1000))
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const rest = seconds % 60
    return rest ? `${minutes}m ${rest}s` : `${minutes}m`
}

// ---------------------------------------------------------------------------
// localStorage copy
// ---------------------------------------------------------------------------

export interface ResearchSnapshotEntry {
    metrics?: { at: number; data: StockMetrics }
    signals?: { at: number; data: SignalsData }
    surprises?: { at: number; data: EarningsSurprise[] }
    /** data null = checked, none in the look-ahead window. */
    earnings?: { at: number; data: EarningsCalendarEntry | null }
    profile?: { at: number; data: CompanyProfile }
}

/** Keeps the most recently fetched tickers, trims news bodies; never stores anything older than its TTL × 4. */
export function serializeResearch(entries: Map<string, ResearchSnapshotEntry>, now: number): MarketResearchCache {
    const fresh: Array<[string, MarketResearchEntry, number]> = []
    for (const [ticker, entry] of entries) {
        const keep = <S extends { at: number }>(kind: ResearchKind, slot: S | undefined): slot is S =>
            Boolean(slot) && now - (slot as S).at <= RESEARCH_TTL_MS[kind] * 4
        const out: MarketResearchEntry = {}
        if (keep('metrics', entry.metrics)) out.metrics = entry.metrics
        if (keep('surprises', entry.surprises)) out.surprises = entry.surprises
        if (keep('profile', entry.profile)) out.profile = entry.profile
        if (keep('signals', entry.signals)) {
            const s = entry.signals.data
            out.signals = { at: entry.signals.at, data: { ...s, news: s.news.map(n => ({ ...n, summary: n.summary.slice(0, MAX_PERSISTED_NEWS_SUMMARY) })) } }
        }
        if (keep('earnings', entry.earnings)) {
            const e = entry.earnings.data
            out.earnings = {
                at: entry.earnings.at,
                data: e
                    ? { date: e.date, hour: e.hour, quarter: e.quarter, year: e.year, epsEstimate: e.epsEstimate }
                    : { date: null, hour: '', quarter: null, year: null, epsEstimate: null }
            }
        }
        const newest = Math.max(0, ...Object.values(out).map(slot => slot.at))
        if (newest > 0) fresh.push([ticker, out, newest])
    }
    fresh.sort((a, b) => b[2] - a[2])
    return { version: 1, tickers: Object.fromEntries(fresh.slice(0, MAX_PERSISTED_TICKERS).map(([ticker, out]) => [ticker, out])) }
}

/** Unreadable or foreign data → empty (the cache is only an optimisation). */
export function parseResearch(raw: string | null): Map<string, ResearchSnapshotEntry> {
    const out = new Map<string, ResearchSnapshotEntry>()
    if (!raw) return out
    let parsed: MarketResearchCache
    try {
        const result = MarketResearchCacheSchema.safeParse(JSON.parse(raw))
        if (!result.success) return out
        parsed = result.data
    } catch {
        return out
    }
    for (const [ticker, entry] of Object.entries(parsed.tickers)) {
        const snapshot: ResearchSnapshotEntry = {}
        if (entry.metrics) snapshot.metrics = entry.metrics
        if (entry.signals) snapshot.signals = entry.signals
        if (entry.surprises) snapshot.surprises = entry.surprises
        if (entry.profile) snapshot.profile = entry.profile
        if (entry.earnings) {
            const e = entry.earnings.data
            snapshot.earnings = { at: entry.earnings.at, data: e.date ? { date: e.date, hour: e.hour, quarter: e.quarter, year: e.year, epsEstimate: e.epsEstimate } : null }
        }
        out.set(ticker.toUpperCase(), snapshot)
    }
    return out
}

// ---------------------------------------------------------------------------
// Host adapter
// ---------------------------------------------------------------------------

type Cache<T> = Map<string, T | 'loading' | 'error'>

export interface ResearchHost {
    currentDate: Date | unknown
    finnhub?: { apiKey: string | null; maxRequestsPerMinute?: number } | null
    schwab?: { quoteCache?: ReadonlyMap<string, { price: number }> }
    metricsCache: Cache<StockMetrics>
    signalsCache: Cache<SignalsData>
    earningsCache: Cache<EarningsSurprise[]>
    profileCache: Cache<CompanyProfile>
    metricsPromiseMap: Map<string, Promise<StockMetrics | null>>
    signalsPromiseMap: Map<string, Promise<SignalsData | null>>
    earningsPromiseMap: Map<string, Promise<EarningsSurprise[] | null>>
    profilePromiseMap: Map<string, Promise<CompanyProfile | null>>
    earningsMap: Map<string, EarningsCalendarEntry>
    /** Fetch times per ticker and kind (ms). */
    researchStamps: Map<string, Partial<Record<ResearchKind, number>>>
    /** Prices fetched during collection (session only, see RESEARCH_QUOTE_TTL_MS). */
    researchQuotes: Map<string, { price: number; at: number }>
    getCachedQuote?(ticker: string): { value?: { price?: number } } | null
    getCurrentPrice(ticker: string, opts?: { forceRefresh?: boolean; scope?: string; priority?: number }): Promise<unknown>
    fetchStockMetrics(ticker: string): Promise<StockMetrics | null>
    fetchSignalsData(ticker: string): Promise<SignalsData | null>
    fetchEarningsSurprise(ticker: string): Promise<EarningsSurprise[] | null>
    fetchCompanyProfile(ticker: string): Promise<CompanyProfile | null>
    fetchEarningsDate(ticker: string, toDate: string): Promise<EarningsCalendarEntry | null>
}

const nowDate = (host: ResearchHost) => (host.currentDate instanceof Date ? host.currentDate : new Date())

const statusOf = (value: unknown): ResearchStatus =>
    value === undefined ? 'missing' : value === 'loading' ? 'loading' : value === 'error' ? 'error' : 'ok'

/** A price fetched during collection, while it is recent enough to use. */
export function researchQuote(host: Pick<ResearchHost, 'researchQuotes'>, ticker: string, now: number = Date.now()): number | null {
    const quote = host.researchQuotes.get(ticker.toUpperCase())
    return quote && now - quote.at <= RESEARCH_QUOTE_TTL_MS ? quote.price : null
}

export function hasPrice(host: Pick<ResearchHost, 'getCachedQuote' | 'schwab' | 'researchQuotes'>, ticker: string): boolean {
    const finnhub = Number(host.getCachedQuote?.(ticker)?.value?.price)
    const schwab = Number(host.schwab?.quoteCache?.get(ticker)?.price)
    return (Number.isFinite(finnhub) && finnhub > 0) || (Number.isFinite(schwab) && schwab > 0) || researchQuote(host, ticker) !== null
}

export function researchStateOf(this: ResearchHost, ticker: string): ResearchState {
    const key = ticker.toUpperCase()
    const stamps = this.researchStamps.get(key) ?? {}
    const earningsDate = this.earningsMap.get(key)?.date ?? null
    return {
        status: {
            metrics: statusOf(this.metricsCache.get(key)),
            signals: statusOf(this.signalsCache.get(key)),
            surprises: statusOf(this.earningsCache.get(key)),
            // A date from either calendar counts; "none found" only counts once the per-symbol query said so.
            earnings: earningsDate !== null || stamps.earnings !== undefined ? 'ok' : 'missing',
            profile: statusOf(this.profileCache.get(key))
        },
        stamps,
        earningsDate,
        hasPrice: hasPrice(this, key)
    }
}

export interface ResearchPlan {
    needs: Map<string, Array<ResearchKind | 'quote'>>
    calls: number
    etaMs: number
}

export function planMarketResearch(this: ResearchHost, tickers: string[]): ResearchPlan {
    const now = nowDate(this)
    const today = now.toISOString().slice(0, 10)
    const needs = new Map<string, Array<ResearchKind | 'quote'>>()
    let calls = 0
    for (const raw of tickers) {
        const ticker = raw.toUpperCase()
        const list = researchNeeds(researchStateOf.call(this, ticker), now.getTime(), today)
        if (!list.length) continue
        needs.set(ticker, list)
        calls += estimateCalls(list)
    }
    return { needs, calls, etaMs: estimateDurationMs(calls, Number(this.finnhub?.maxRequestsPerMinute)) }
}

/** Fills empty or failed in-memory slots from localStorage. Call once the Finnhub key is known. */
export function hydrateMarketResearch(this: ResearchHost): void {
    const stored = parseResearch(safeLocalStorage.getItem(APP_CONFIG.STORAGE.MARKET_RESEARCH_CACHE))
    const today = nowDate(this).toISOString().slice(0, 10)
    const fill = <T>(cache: Cache<T>, ticker: string, slot: { at: number; data: T } | undefined, kind: ResearchKind, stamps: Partial<Record<ResearchKind, number>>) => {
        if (!slot) return
        const current = cache.get(ticker)
        if (current !== undefined && current !== 'error') return
        cache.set(ticker, slot.data)
        stamps[kind] = slot.at
    }
    for (const [ticker, entry] of stored) {
        const stamps = { ...(this.researchStamps.get(ticker) ?? {}) }
        fill(this.metricsCache, ticker, entry.metrics, 'metrics', stamps)
        fill(this.signalsCache, ticker, entry.signals, 'signals', stamps)
        fill(this.earningsCache, ticker, entry.surprises, 'surprises', stamps)
        fill(this.profileCache, ticker, entry.profile, 'profile', stamps)
        if (entry.earnings && !this.earningsMap.has(ticker)) {
            const e = entry.earnings.data
            if (e === null) stamps.earnings = entry.earnings.at
            else if (e.date >= today) {
                this.earningsMap.set(ticker, e)
                stamps.earnings = entry.earnings.at
            }
        }
        this.researchStamps.set(ticker, stamps)
    }
}

/** Writes every stamped ticker's research (the detail panel's unstamped fetches stay session-only). */
export function persistMarketResearch(this: ResearchHost): void {
    const entries = new Map<string, ResearchSnapshotEntry>()
    const loaded = <T>(value: T | 'loading' | 'error' | undefined): T | undefined =>
        value === undefined || value === 'loading' || value === 'error' ? undefined : value
    for (const [ticker, stamps] of this.researchStamps) {
        const entry: ResearchSnapshotEntry = {}
        const metrics = loaded(this.metricsCache.get(ticker))
        const signals = loaded(this.signalsCache.get(ticker))
        const surprises = loaded(this.earningsCache.get(ticker))
        const profile = loaded(this.profileCache.get(ticker))
        if (metrics && stamps.metrics) entry.metrics = { at: stamps.metrics, data: metrics }
        if (signals && stamps.signals) entry.signals = { at: stamps.signals, data: signals }
        if (surprises && stamps.surprises) entry.surprises = { at: stamps.surprises, data: surprises }
        if (profile && stamps.profile) entry.profile = { at: stamps.profile, data: profile }
        if (stamps.earnings) entry.earnings = { at: stamps.earnings, data: this.earningsMap.get(ticker) ?? null }
        entries.set(ticker, entry)
    }
    try {
        safeLocalStorage.setItem(APP_CONFIG.STORAGE.MARKET_RESEARCH_CACHE, JSON.stringify(serializeResearch(entries, Date.now())))
    } catch (error) {
        console.warn('Could not save the market research cache:', error)
    }
}

/**
 * Refreshes one cache slot. A stale value stays visible while the refresh runs and is kept if the
 * refresh fails, so a rate-limited retry never wipes data that was there before.
 */
async function refreshSlot<T>(
    host: ResearchHost,
    cache: Cache<T>,
    promises: Map<string, Promise<T | null>>,
    ticker: string,
    kind: ResearchKind,
    fetch: () => Promise<T | null>
): Promise<boolean> {
    const inFlight = promises.get(ticker)
    if (inFlight) {
        const data = await inFlight.catch(() => null)
        return data !== null
    }
    const previous = cache.get(ticker)
    const hadData = previous !== undefined && previous !== 'loading' && previous !== 'error'
    if (!hadData) cache.set(ticker, 'loading')
    const promise = fetch()
    promises.set(ticker, promise)
    try {
        const data = await promise.catch(() => null)
        if (data !== null) {
            cache.set(ticker, data)
            host.researchStamps.set(ticker, { ...(host.researchStamps.get(ticker) ?? {}), [kind]: Date.now() })
            return true
        }
        if (!hadData) cache.set(ticker, 'error')
        return false
    } finally {
        promises.delete(ticker)
    }
}

async function fetchKind(this: ResearchHost, ticker: string, kind: ResearchKind | 'quote', toDate: string): Promise<boolean> {
    switch (kind) {
        case 'quote':
            try {
                const quote = await this.getCurrentPrice(ticker, { priority: PRIORITY.IMMEDIATE })
                const price = typeof quote === 'object' && quote !== null && 'price' in quote ? Number(quote.price) : Number.NaN
                if (!Number.isFinite(price) || price <= 0) return false
                this.researchQuotes.set(ticker, { price, at: Date.now() })
                return true
            } catch {
                return false
            }
        case 'metrics':
            return refreshSlot(this, this.metricsCache, this.metricsPromiseMap, ticker, kind, () => this.fetchStockMetrics(ticker))
        case 'signals':
            return refreshSlot(this, this.signalsCache, this.signalsPromiseMap, ticker, kind, () => this.fetchSignalsData(ticker))
        case 'surprises':
            return refreshSlot(this, this.earningsCache, this.earningsPromiseMap, ticker, kind, () => this.fetchEarningsSurprise(ticker))
        case 'profile':
            return refreshSlot(this, this.profileCache, this.profilePromiseMap, ticker, kind, () => this.fetchCompanyProfile(ticker))
        case 'earnings':
            try {
                await this.fetchEarningsDate(ticker, toDate)
                this.researchStamps.set(ticker, { ...(this.researchStamps.get(ticker) ?? {}), earnings: Date.now() })
                return true
            } catch {
                return false
            }
    }
}

export interface ResearchProgress {
    done: number
    total: number
    /** Requests still to go (estimate) and the matching lower-bound time. */
    callsLeft: number
    etaMs: number
    failed: string[]
}

export interface ResearchOutcome {
    done: number
    total: number
    failed: string[]
    stopped: boolean
}

/** Fetches what a single ticker is missing (Ask Coach); returns once everything settled. */
export async function ensureTickerResearch(this: ResearchHost, ticker: string): Promise<void> {
    if (!this.finnhub?.apiKey) return
    const plan = planMarketResearch.call(this, [ticker])
    const needs = plan.needs.get(ticker.toUpperCase())
    if (!needs) return
    const toDate = new Date(nowDate(this).getTime() + EARNINGS_LOOKAHEAD_DAYS * DAY).toISOString().slice(0, 10)
    await Promise.all(needs.map(kind => fetchKind.call(this, ticker.toUpperCase(), kind, toDate)))
    persistMarketResearch.call(this)
}

/**
 * Collects what each ticker is missing, a couple of tickers at a time (the shared scheduler keeps
 * the whole thing inside the Finnhub per-minute budget). Aborting stops starting new tickers; the
 * ones in flight finish. Saved to localStorage as it goes, so an interrupted run isn't wasted.
 */
export async function collectMarketResearch(
    this: ResearchHost,
    plan: ResearchPlan,
    options: { signal?: AbortSignal; onProgress?: (progress: ResearchProgress) => void } = {}
): Promise<ResearchOutcome> {
    const queue = [...plan.needs.entries()]
    const total = queue.length
    const failed: string[] = []
    const rpm = Number(this.finnhub?.maxRequestsPerMinute)
    let callsLeft = plan.calls
    let done = 0
    const toDate = new Date(nowDate(this).getTime() + EARNINGS_LOOKAHEAD_DAYS * DAY).toISOString().slice(0, 10)
    const report = () => options.onProgress?.({ done, total, callsLeft, etaMs: estimateDurationMs(callsLeft, rpm), failed: [...failed] })
    report()

    const worker = async () => {
        while (queue.length && !options.signal?.aborted) {
            const next = queue.shift()
            if (!next) return
            const [ticker, needs] = next
            const results = await Promise.all(needs.map(kind => fetchKind.call(this, ticker, kind, toDate)))
            if (results.some(ok => !ok)) failed.push(ticker)
            callsLeft = Math.max(0, callsLeft - estimateCalls(needs))
            done += 1
            if (done % 5 === 0) persistMarketResearch.call(this)
            report()
        }
    }
    await Promise.all(Array.from({ length: Math.min(COLLECT_CONCURRENCY, total) }, worker))
    persistMarketResearch.call(this)
    return { done, total, failed, stopped: Boolean(options.signal?.aborted) && done < total }
}
