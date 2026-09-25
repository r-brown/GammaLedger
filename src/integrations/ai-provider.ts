// src/integrations/ai-provider.ts — active AI provider: selection, persistence, selector UI.
// Uses the .call(this, …) delegation pattern.

import type { LLMProvider } from './llm/types.js'

interface AIProviderDisplayContext {
    getActiveLLMProvider(): LLMProvider
}

export function getAIChatDisplayName(this: AIProviderDisplayContext): string {
    const provider = this.getActiveLLMProvider()
    return provider.modelLabel(provider.activeModel()) || provider.displayName
}
