// src/integrations/decision/registry.ts — which engine answers typed decisions (spec D3), with the
// JEV → LLM fallback when JEV can't answer this session (R4).

import type { AIProviderId } from '@core/config'
import type { AICoachConsentRecord } from '@core/schema'
import { consentSatisfies } from '@core/consent'
import { LLMError, type LLMProvider } from '../llm/types.js'
import { createJevProvider } from './jev.js'
import { createLlmDecisionProvider } from './llm-adapter.js'
import type { DecisionEngine, DecisionProvider, DecisionRequest, DecisionResult } from './types.js'

export interface DecisionResolutionInput {
    consent: AICoachConsentRecord | null
    activeLlm: AIProviderId
    llmConfigured: boolean
    jevReachable: boolean
}

/** Spec D3, with JEV served by OpenRouter: JEV whenever OpenRouter is the active, configured provider. */
export function resolveDecisionEngine(input: DecisionResolutionInput): DecisionEngine | null {
    if (!input.llmConfigured || !consentSatisfies(input.consent, input.activeLlm, { minVersion: 2 })) return null
    return input.activeLlm === 'openrouter' && input.jevReachable ? 'jev' : 'llm'
}

export interface DecisionContext {
    aiProvider: { active: AIProviderId }
    openRouter: { apiKey: string | null }
    jev: { reachable: boolean }
    getActiveLLMProvider(): LLMProvider
    getAICoachConsent(): AICoachConsentRecord | null
    /** Called once JEV has been marked unreachable, so the settings status can say why. */
    onJevUnreachable?(): void
}

export function currentDecisionEngine(ctx: DecisionContext): DecisionEngine | null {
    return resolveDecisionEngine({
        consent: ctx.getAICoachConsent(),
        activeLlm: ctx.aiProvider.active,
        llmConfigured: ctx.getActiveLLMProvider().isConfigured(),
        jevReachable: ctx.jev.reachable
    })
}

export function getDecisionProvider(ctx: DecisionContext): DecisionProvider | null {
    const engine = currentDecisionEngine(ctx)
    if (engine === 'jev') return createJevProvider(ctx)
    if (engine === 'llm') return createLlmDecisionProvider(ctx.getActiveLLMProvider())
    return null
}

/**
 * JEV failures that the same OpenRouter key can still work around: the route or model is missing
 * (the Decisions API is alpha), the network/CORS failed, or the reply didn't parse. Auth, credits
 * and rate limits would fail the LLM call too, so those are thrown as they are.
 */
const JEV_UNAVAILABLE: ReadonlySet<string> = new Set(['network', 'timeout', 'http', 'model_unavailable', 'bad_response'])

/**
 * Decides with the current engine; when JEV is unavailable it is disabled for the session and the
 * question is retried once on the LLM. With `jevOnly`, nothing but JEV is ever called (digest order).
 */
export async function decideWithFallback<K extends string>(
    ctx: DecisionContext,
    request: DecisionRequest<K>,
    options: { jevOnly?: boolean } = {}
): Promise<DecisionResult<K> | null> {
    const provider = getDecisionProvider(ctx)
    if (!provider || (options.jevOnly && provider.id !== 'jev')) return null
    try {
        return await provider.decide(request)
    } catch (error) {
        if (provider.id !== 'jev' || !(error instanceof LLMError) || !JEV_UNAVAILABLE.has(error.kind)) throw error
        console.warn('JEV is unavailable this session; typed decisions fall back to the active model:', error)
        ctx.jev.reachable = false
        ctx.onJevUnreachable?.()
        if (options.jevOnly) return null
        const fallback = getDecisionProvider(ctx)
        return fallback ? fallback.decide(request) : null
    }
}
