// src/integrations/llm/registry.ts — picks the LLM provider for the active setting.

import { createGeminiProvider, type GeminiProviderContext } from './gemini.js'
import type { LLMProvider, LLMProviderId } from './types.js'

export interface LLMContext extends GeminiProviderContext {
    aiProvider: { active: LLMProviderId }
}

/** Providers are cheap closures over app state, so a fresh one per call is fine. */
export function getActiveLLMProvider(ctx: LLMContext): LLMProvider {
    switch (ctx.aiProvider.active) {
        case 'gemini':
        default:
            return createGeminiProvider(ctx)
    }
}
