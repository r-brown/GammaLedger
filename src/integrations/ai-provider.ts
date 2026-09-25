// src/integrations/ai-provider.ts — active AI provider: selection, persistence, selector UI.
// Uses the .call(this, …) delegation pattern.

import { z } from 'zod'
import { AI_PROVIDER_IDS, AI_PROVIDER_STORAGE_KEY, type AIProviderId } from '@core/config'
import { AIProviderSelectionSchema } from '@core/schema'
import { safeLocalStorage } from '@core/storage'
import type { LLMProvider } from './llm/types.js'

interface AIProviderDisplayContext {
    getActiveLLMProvider(): LLMProvider
}

export function isAIProviderId(value: unknown): value is AIProviderId {
    return typeof value === 'string' && (AI_PROVIDER_IDS as readonly string[]).includes(value)
}

export function parseAIProviderSelection(raw: string | null): AIProviderId | null {
    if (!raw) {
        return null
    }
    try {
        const parsed = AIProviderSelectionSchema.safeParse(JSON.parse(raw))
        return parsed.success ? parsed.data.active : null
    } catch {
        return null
    }
}

const GeminiKeyPresenceSchema = z.object({
    payload: z.unknown().optional(),
    apiKey: z.string().optional(),
    fallback: z.string().optional()
})

/** True when the stored Gemini config carries a key (encrypted, plaintext or base64 backup). */
export function geminiConfigHasKey(raw: string | null): boolean {
    if (!raw) {
        return false
    }
    try {
        const parsed = GeminiKeyPresenceSchema.safeParse(JSON.parse(raw))
        return parsed.success && Boolean(parsed.data.payload || parsed.data.apiKey?.trim() || parsed.data.fallback?.trim())
    } catch {
        return false
    }
}

/** Existing Gemini users stay on Gemini; everyone else starts on OpenRouter. */
export function resolveAIProviderSelection(
    storedSelection: string | null,
    storedGeminiConfig: string | null
): { active: AIProviderId; persist: boolean } {
    const stored = parseAIProviderSelection(storedSelection)
    if (stored) {
        return { active: stored, persist: false }
    }
    return { active: geminiConfigHasKey(storedGeminiConfig) ? 'gemini' : 'openrouter', persist: true }
}

export function saveActiveAIProvider(active: AIProviderId): void {
    safeLocalStorage.setItem(AI_PROVIDER_STORAGE_KEY, JSON.stringify({ version: 1, active }))
}

export function getAIChatDisplayName(this: AIProviderDisplayContext): string {
    const provider = this.getActiveLLMProvider()
    return provider.modelLabel(provider.activeModel()) || provider.displayName
}
