// src/ai/ask-coach.ts — "Ask Coach" on a position or watchlist entry (roadmap 01/01a).
// Reachable from a grid row (research data may not be loaded yet) and from the detail card.
// Uses the .call(this, …) delegation pattern.

import type { AskCoachRequest } from '../types/ai.js'
import type { WatchlistEntry } from '../types/watchlist.js'
import type { LLMProvider } from '../integrations/llm/types.js'
import type { ConsentRequirement } from '../core/consent.js'
import { buildPositionAskQuestion, buildWatchlistAskQuestion, gatherTickerContext, type TickerHost } from './ticker-context.js'
import { ensureTickerResearch, type ResearchHost } from './market-research.js'

/** A row click shouldn't hang on a slow research fetch; the question then just omits what is missing. */
const RESEARCH_WAIT_MS = 8_000

export interface AskCoachHost extends Omit<TickerHost, 'metricsCache' | 'signalsCache' | 'earningsCache' | 'profileCache' | 'earningsMap' | 'schwab' | 'getCachedQuote'>, ResearchHost {
    schwab?: TickerHost['schwab'] & ResearchHost['schwab']
    getCachedQuote?(ticker: string): { value?: { price?: number; previousClose?: number } } | null
    watchlist?: WatchlistEntry[]
    getActiveLLMProvider(): LLMProvider
    handleAIQuickPrompt(prompt: string, options?: { promptType?: string | null; displayText?: string | null; consent?: ConsentRequirement }): Promise<void>
}

/** G2 for active surfaces: the button exists only when an LLM provider has a key. */
export function isAIConfigured(this: Pick<AskCoachHost, 'getActiveLLMProvider'>): boolean {
    return this.getActiveLLMProvider().isConfigured()
}

/** Missing or stale research is fetched (and saved) the same way the Watchlist scan collects it. */
async function ensureResearch(this: AskCoachHost, ticker: string): Promise<void> {
    if (!this.finnhub?.apiKey) return
    await Promise.race([ensureTickerResearch.call(this, ticker), new Promise(resolve => setTimeout(resolve, RESEARCH_WAIT_MS))])
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
