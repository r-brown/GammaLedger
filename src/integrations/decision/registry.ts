// src/integrations/decision/registry.ts — which engine answers typed decisions (spec D3), with the
// JEV → LLM fallback for browsers JEV can't be reached from (R4).

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
    jevConfigured: boolean
    jevReachable: boolean
}

export function resolveDecisionEngine(input: DecisionResolutionInput): DecisionEngine | null {
    if (!consentSatisfies(input.consent, input.activeLlm, { minVersion: 2 })) return null
    if (input.jevConfigured && input.jevReachable && input.consent?.decision === 'jev') return 'jev'
    return input.llmConfigured ? 'llm' : null
}

export interface DecisionContext {
    aiProvider: { active: AIProviderId }
    jev: { apiKey: string | null; reachable: boolean }
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
        jevConfigured: Boolean(ctx.jev.apiKey?.trim()),
        jevReachable: ctx.jev.reachable
    })
}

export function getDecisionProvider(ctx: DecisionContext): DecisionProvider | null {
    const engine = currentDecisionEngine(ctx)
    if (engine === 'jev') return createJevProvider(ctx)
    if (engine === 'llm') return createLlmDecisionProvider(ctx.getActiveLLMProvider())
    return null
}

/** Decides with the current engine; a JEV network/CORS failure disables JEV for the session and retries once on the LLM. */
export async function decideWithFallback<K extends string>(ctx: DecisionContext, request: DecisionRequest<K>): Promise<DecisionResult<K> | null> {
    const provider = getDecisionProvider(ctx)
    if (!provider) return null
    try {
        return await provider.decide(request)
    } catch (error) {
        if (provider.id !== 'jev' || !(error instanceof LLMError) || error.kind !== 'network') throw error
        ctx.jev.reachable = false
        ctx.onJevUnreachable?.()
        const fallback = getDecisionProvider(ctx)
        return fallback ? fallback.decide(request) : null
    }
}
