// src/ai/ai-read.ts — the AI Read pill (roadmap 28): one typed choice over pre-computed facts.
// JEV when available (calibrated), else the LLM adapter; nothing without consent v2 (G2).

import type { AIReadView } from '../types/ai.js'
import type { DecisionContext } from '../integrations/decision/registry.js'
import { currentDecisionEngine, decideWithFallback } from '../integrations/decision/registry.js'
import { confidenceBand, type DecisionEngine, type DecisionQuestion, type DecisionResult } from '../integrations/decision/types.js'
import { gatherTickerContext, type TickerContext, type TickerHost } from './ticker-context.js'

export const AI_READ_QUESTIONS: { read: Extract<DecisionQuestion, { type: 'choice' }> } = {
    read: {
        type: 'choice',
        instructions: 'Given the pre-computed facts in state, how does this stock look for selling cash-secured puts or covered calls over the next 30–45 days?',
        criteria: {
            bullish: 'The facts mostly support selling premium here',
            neutral: 'The facts are mixed or thin',
            bearish: 'The facts mostly argue against selling premium here'
        }
    }
}

/** Only what the question needs (context rot): no position, watchlist or earlier read. */
export function buildAIReadState(ctx: TickerContext): Record<string, unknown> {
    return { ticker: ctx.ticker, asOf: ctx.asOf, price: ctx.price, momentum: ctx.momentum, scores: ctx.scores, signals: ctx.signals }
}

export function aiReadCacheKey(ticker: string, asOf: string, engine: DecisionEngine): string {
    return `${ticker.toUpperCase()}|${asOf}|${engine}`
}

export function toAIReadView(result: DecisionResult<'read'>, asOf: string): AIReadView {
    const answer = result.answers.read
    if (answer.type !== 'choice') throw new Error('AI Read expects a choice answer')
    const grade = answer.choice === 'bullish' || answer.choice === 'bearish' ? answer.choice : 'neutral'
    const confidence = result.calibrated ? answer.confidence : null
    return {
        grade,
        display: confidence !== null && confidence < 0.5 ? 'mixed' : grade,
        probabilities: answer.probabilities,
        confidence,
        band: confidenceBand(confidence),
        engine: result.engine,
        calibrated: result.calibrated,
        model: result.model,
        asOf
    }
}

export interface AIReadHost extends TickerHost, DecisionContext {
    aiReadCache: Map<string, AIReadView | 'loading' | 'error'>
    aiReadPromiseMap: Map<string, Promise<AIReadView | null>>
    metricsPromiseMap: ReadonlyMap<string, Promise<unknown>>
    signalsPromiseMap: ReadonlyMap<string, Promise<unknown>>
}

const today = (host: AIReadHost) => (host.currentDate instanceof Date ? host.currentDate : new Date()).toISOString().slice(0, 10)

export function getCachedAIRead(this: AIReadHost, ticker: string): AIReadView | null {
    const engine = currentDecisionEngine(this)
    if (!engine) return null
    const cached = this.aiReadCache.get(aiReadCacheKey(ticker, today(this), engine))
    return cached && cached !== 'loading' && cached !== 'error' ? cached : null
}

/** Starts once metrics and signals have resolved; one read per ticker, day and engine. */
export async function requestAIRead(this: AIReadHost, ticker: string): Promise<AIReadView | null> {
    const engine = currentDecisionEngine(this)
    if (!engine) return null
    const key = aiReadCacheKey(ticker, today(this), engine)
    const cached = this.aiReadCache.get(key)
    if (cached && cached !== 'loading') return cached === 'error' ? null : cached
    const inFlight = this.aiReadPromiseMap.get(key)
    if (inFlight) return inFlight

    const upper = ticker.toUpperCase()
    const run = (async () => {
        await Promise.allSettled([this.metricsPromiseMap.get(upper), this.signalsPromiseMap.get(upper)])
        const ctx = gatherTickerContext.call(this, upper)
        if (!ctx.scores) return null   // no fundamentals → nothing for the read to weigh
        const result = await decideWithFallback(this, { state: buildAIReadState(ctx), questions: AI_READ_QUESTIONS })
        return result ? toAIReadView(result, ctx.asOf) : null
    })()
    this.aiReadCache.set(key, 'loading')
    this.aiReadPromiseMap.set(key, run)
    try {
        const view = await run
        // The engine may have changed during the call (JEV unreachable): cache under the one that answered.
        if (view) this.aiReadCache.set(aiReadCacheKey(upper, view.asOf, view.engine), view)
        if (view?.engine !== engine) this.aiReadCache.delete(key)
        return view
    } catch (error) {
        console.warn(`AI Read failed for ${upper}:`, error)
        this.aiReadCache.set(key, 'error')
        return null
    } finally {
        this.aiReadPromiseMap.delete(key)
    }
}
