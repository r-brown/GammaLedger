// src/ai/watchlist-drift.ts — does a watchlist thesis still fit today's facts? (roadmap 29)
// One yes/no decision per entry with a thesis. With JEV it runs automatically when the watchlist
// opens; with only an LLM it runs on "Check theses". Nothing without consent v2 (G2).

import type { DriftView } from '../types/ai.js'
import type { WatchlistEntry } from '../types/watchlist.js'
import type { ConsentRequirement } from '../core/consent.js'
import { currentDecisionEngine, decideWithFallback, type DecisionContext } from '../integrations/decision/registry.js'
import { confidenceBand, type DecisionQuestion, type DecisionResult } from '../integrations/decision/types.js'
import { gatherTickerContext, type TickerContext, type TickerHost } from './ticker-context.js'

export const DRIFT_THRESHOLD = 0.7
const DRIFT_CONCURRENCY = 4

export const DRIFT_QUESTIONS: { drift: Extract<DecisionQuestion, { type: 'noul' }> } = {
    drift: {
        type: 'noul',
        instructions: 'The thesis in state.watchlist.thesis no longer fits the current facts in state',
        criteria: {
            true: 'The price, target status or scores contradict what the thesis waits for or assumes',
            false: 'The facts are consistent with the thesis, or it cannot be judged'
        }
    }
}

export function buildDriftState(ctx: TickerContext): Record<string, unknown> | null {
    if (!ctx.watchlist || !ctx.watchlist.thesis.trim()) return null
    const state: Record<string, unknown> = { ticker: ctx.ticker, asOf: ctx.asOf, price: ctx.price, watchlist: ctx.watchlist }
    if (ctx.scores) state.scores = ctx.scores
    return state
}

/** FNV-1a 32-bit: an edited thesis gets a new cache key immediately. */
export function notesHash(notes: string): string {
    let hash = 0x811c9dc5
    for (let i = 0; i < notes.length; i += 1) {
        hash ^= notes.charCodeAt(i)
        hash = Math.imul(hash, 0x01000193) >>> 0
    }
    return hash.toString(16).padStart(8, '0')
}

export function driftCacheKey(ticker: string, notes: string, asOf: string): string {
    return `${ticker.toUpperCase()}|${notesHash(notes.trim())}|${asOf}`
}

export function toDriftView(result: DecisionResult<'drift'>, asOf: string): DriftView {
    const answer = result.answers.drift
    if (answer.type !== 'noul') throw new Error('Thesis drift expects a yes/no answer')
    const confidence = result.calibrated ? Math.abs(answer.noul - 0.5) * 2 : null
    return {
        drifted: answer.noul >= DRIFT_THRESHOLD,
        probability: answer.noul,
        confidence,
        band: confidenceBand(confidence),
        engine: result.engine,
        calibrated: result.calibrated,
        model: result.model,
        asOf
    }
}

export interface DriftHost extends TickerHost, DecisionContext {
    watchlist: WatchlistEntry[]
    driftCache: Map<string, DriftView | 'loading' | 'error'>
    hasAICoachConsent(requirement?: ConsentRequirement): boolean
    promptAICoachConsent(nextAction?: (() => void) | null, requirement?: ConsentRequirement): boolean
    currentView?: string
    renderWatchlistView?(): void
}

const asOfOf = (host: DriftHost) => (host.currentDate instanceof Date ? host.currentDate : new Date()).toISOString().slice(0, 10)

/** 'auto' with JEV (cheap), 'manual' with only an LLM provider, null when no AI is configured. */
export function getDriftMode(this: DriftHost): 'auto' | 'manual' | null {
    if (currentDecisionEngine(this) === 'jev') return 'auto'
    return this.getActiveLLMProvider().isConfigured() ? 'manual' : null
}

export function getWatchlistDrift(this: DriftHost, ticker: string): DriftView | null {
    const entry = this.watchlist.find(e => e.ticker === ticker.toUpperCase())
    if (!entry || !entry.notes?.trim()) return null
    const cached = this.driftCache.get(driftCacheKey(entry.ticker, entry.notes, asOfOf(this)))
    return cached && cached !== 'loading' && cached !== 'error' ? cached : null
}

export async function checkWatchlistDrift(this: DriftHost, mode: 'auto' | 'manual'): Promise<number> {
    if (mode === 'manual' && !this.hasAICoachConsent({ minVersion: 2 })) {
        this.promptAICoachConsent(() => {
            void checkWatchlistDrift.call(this, 'manual').then(() => {
                if (this.currentView === 'watchlist') this.renderWatchlistView?.()
            })
        }, { minVersion: 2 })
        return 0
    }
    if (mode === 'auto' && getDriftMode.call(this) !== 'auto') return 0
    const asOf = asOfOf(this)
    const pending = this.watchlist.filter(entry => {
        if (!entry.notes?.trim()) return false
        const cached = this.driftCache.get(driftCacheKey(entry.ticker, entry.notes, asOf))
        return !cached || cached === 'error'
    })
    let checked = 0
    for (let i = 0; i < pending.length; i += DRIFT_CONCURRENCY) {
        await Promise.all(pending.slice(i, i + DRIFT_CONCURRENCY).map(async (entry) => {
            const key = driftCacheKey(entry.ticker, entry.notes, asOf)
            const state = buildDriftState(gatherTickerContext.call(this, entry.ticker, { watchlistEntry: entry }))
            if (!state) return
            this.driftCache.set(key, 'loading')
            try {
                const result = await decideWithFallback(this, { state, questions: DRIFT_QUESTIONS })
                if (result) { this.driftCache.set(key, toDriftView(result, asOf)); checked += 1 }
                else this.driftCache.delete(key)
            } catch (error) {
                console.warn(`Thesis check failed for ${entry.ticker}:`, error)
                this.driftCache.set(key, 'error')
            }
        }))
    }
    return checked
}
