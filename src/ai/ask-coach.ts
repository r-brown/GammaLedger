// src/ai/ask-coach.ts — "Ask Coach" on a position or watchlist entry (roadmap 01/01a).
// Reachable from a grid row (research data may not be loaded yet) and from the detail card.
// Uses the .call(this, …) delegation pattern.

import type { AskCoachRequest } from '../types/ai.js'
import type { WatchlistEntry } from '../types/watchlist.js'
import type { EarningsSurprise, SignalsData, StockMetrics } from '../types/integrations.js'
import type { LLMProvider } from '../integrations/llm/types.js'
import type { ConsentRequirement } from '../core/consent.js'
import { buildPositionAskQuestion, buildWatchlistAskQuestion, gatherTickerContext, type TickerHost } from './ticker-context.js'

/** A row click shouldn't hang on a slow research fetch; the question then just omits what is missing. */
const RESEARCH_WAIT_MS = 8_000

type ResearchCache<T> = Map<string, T | 'loading' | 'error'>

export interface AskCoachHost extends TickerHost {
    watchlist?: WatchlistEntry[]
    finnhub?: { apiKey: string | null } | null
    metricsCache: ResearchCache<StockMetrics>
    signalsCache: ResearchCache<SignalsData>
    earningsCache: ResearchCache<EarningsSurprise[]>
    metricsPromiseMap: Map<string, Promise<StockMetrics | null>>
    signalsPromiseMap: Map<string, Promise<SignalsData | null>>
    earningsPromiseMap: Map<string, Promise<EarningsSurprise[] | null>>
    fetchStockMetrics(ticker: string): Promise<StockMetrics | null>
    fetchSignalsData(ticker: string): Promise<SignalsData | null>
    fetchEarningsSurprise(ticker: string): Promise<EarningsSurprise[] | null>
    getActiveLLMProvider(): LLMProvider
    handleAIQuickPrompt(prompt: string, options?: { promptType?: string | null; displayText?: string | null; consent?: ConsentRequirement }): Promise<void>
}

/** G2 for active surfaces: the button exists only when an LLM provider has a key. */
export function isAIConfigured(this: Pick<AskCoachHost, 'getActiveLLMProvider'>): boolean {
    return this.getActiveLLMProvider().isConfigured()
}

/** Same cache/promise discipline as the detail panel's fetches, so the two never double-fetch. */
function ensureLoaded<T>(
    cache: ResearchCache<T>,
    promises: Map<string, Promise<T | null>>,
    ticker: string,
    fetch: (ticker: string) => Promise<T | null>
): Promise<unknown> {
    const cached = cache.get(ticker)
    if (cached !== undefined && cached !== 'loading') return Promise.resolve()
    const inFlight = promises.get(ticker)
    if (inFlight) return inFlight.catch(() => null)
    if (cached === 'loading') return Promise.resolve()
    cache.set(ticker, 'loading')
    const promise = fetch(ticker)
    promises.set(ticker, promise)
    return promise.then(
        (data) => { promises.delete(ticker); cache.set(ticker, data ?? 'error') },
        () => { promises.delete(ticker); cache.set(ticker, 'error') }
    )
}

async function ensureResearch(this: AskCoachHost, ticker: string): Promise<void> {
    if (!this.finnhub?.apiKey) return
    const loads = Promise.all([
        ensureLoaded(this.metricsCache, this.metricsPromiseMap, ticker, t => this.fetchStockMetrics(t)),
        ensureLoaded(this.signalsCache, this.signalsPromiseMap, ticker, t => this.fetchSignalsData(t)),
        ensureLoaded(this.earningsCache, this.earningsPromiseMap, ticker, t => this.fetchEarningsSurprise(t))
    ])
    await Promise.race([loads, new Promise(resolve => setTimeout(resolve, RESEARCH_WAIT_MS))])
}

export async function askCoachAboutTicker(this: AskCoachHost, request: AskCoachRequest): Promise<void> {
    if (!this.getActiveLLMProvider().isConfigured()) return
    const ticker = request.ticker.trim().toUpperCase()
    await ensureResearch.call(this, ticker)
    // The caller captured the entry earlier; prefer the stored one so an edited thesis is sent.
    const entry = request.watchlistEntry
        ? this.watchlist?.find(candidate => candidate.ticker === ticker) ?? request.watchlistEntry
        : null
    const ctx = gatherTickerContext.call(this, ticker, { trade: request.trade ?? null, watchlistEntry: entry })
    const question = entry && !request.trade ? buildWatchlistAskQuestion(ctx) : buildPositionAskQuestion(ctx)
    void this.handleAIQuickPrompt(question.request, { promptType: null, displayText: question.display, consent: { minVersion: 2 } })
}
