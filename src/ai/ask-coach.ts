// src/ai/ask-coach.ts — "Ask Coach" on a position or watchlist entry (roadmap 01/01a).
// Uses the .call(this, …) delegation pattern.

import type { AskCoachRequest } from '../types/ai.js'
import type { WatchlistEntry } from '../types/watchlist.js'
import type { LLMProvider } from '../integrations/llm/types.js'
import type { ConsentRequirement } from '../core/consent.js'
import { buildPositionAskQuestion, buildWatchlistAskQuestion, gatherTickerContext, type TickerHost } from './ticker-context.js'

export interface AskCoachHost extends TickerHost {
    watchlist?: WatchlistEntry[]
    getActiveLLMProvider(): LLMProvider
    handleAIQuickPrompt(prompt: string, options?: { promptType?: string | null; displayText?: string | null; consent?: ConsentRequirement }): Promise<void>
}

/** G2 for active surfaces: the button exists only when an LLM provider has a key. */
export function isAIConfigured(this: Pick<AskCoachHost, 'getActiveLLMProvider'>): boolean {
    return this.getActiveLLMProvider().isConfigured()
}

export function askCoachAboutTicker(this: AskCoachHost, request: AskCoachRequest): void {
    if (!this.getActiveLLMProvider().isConfigured()) return
    const ticker = request.ticker.trim().toUpperCase()
    // The panel captured the entry when it opened; prefer the stored one so an edited thesis is sent.
    const entry = request.watchlistEntry
        ? this.watchlist?.find(candidate => candidate.ticker === ticker) ?? request.watchlistEntry
        : null
    const ctx = gatherTickerContext.call(this, ticker, { trade: request.trade ?? null, watchlistEntry: entry })
    const question = entry && !request.trade ? buildWatchlistAskQuestion(ctx) : buildPositionAskQuestion(ctx)
    void this.handleAIQuickPrompt(question.request, { promptType: null, displayText: question.display, consent: { minVersion: 2 } })
}
