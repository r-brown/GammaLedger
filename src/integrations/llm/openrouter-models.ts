// src/integrations/llm/openrouter-models.ts — OpenRouter model catalogue: fetch, validate,
// normalise, cache on app state, and a curated fallback for offline use.

import { z } from 'zod'
import { OPENROUTER_MODELS_ENDPOINT } from '@core/config'
import type { OpenRouterCatalogueState, OpenRouterModel } from './types.js'

const OPENROUTER_MODEL_ID_PATTERN = /^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._:-]*$/i

/** Validates the provider/model form; callers trim user input first. */
export function isValidOpenRouterModelId(value: string): boolean {
    return OPENROUTER_MODEL_ID_PATTERN.test(value)
}

/** Known-good models used until (or instead of, when offline) the live catalogue. As of 2026-09-25. */
export const OPENROUTER_CURATED_MODELS: readonly OpenRouterModel[] = Object.freeze([
    { id: 'google/gemini-3.8-flash', name: 'Google: Gemini 3.8 Flash', contextLength: 1048576, vision: true, structuredOutput: true, maxOutputTokens: 65536, promptPricePerMillion: 0.75, completionPricePerMillion: 3.75 },
    { id: 'anthropic/claude-sonnet-5', name: 'Anthropic: Claude Sonnet 5', contextLength: 1000000, vision: true, structuredOutput: true, maxOutputTokens: 128000, promptPricePerMillion: 2, completionPricePerMillion: 10 },
    { id: 'anthropic/claude-opus-5.5', name: 'Anthropic: Claude Opus 5.5', contextLength: 1000000, vision: true, structuredOutput: true, maxOutputTokens: 128000, promptPricePerMillion: 4, completionPricePerMillion: 20 },
    { id: 'openai/gpt-6-sol', name: 'OpenAI: GPT-6 Sol', contextLength: 1050000, vision: true, structuredOutput: true, maxOutputTokens: 128000, promptPricePerMillion: 2, completionPricePerMillion: 10 },
    { id: 'openai/gpt-6-luna', name: 'OpenAI: GPT-6 Luna', contextLength: 1050000, vision: true, structuredOutput: true, maxOutputTokens: 128000, promptPricePerMillion: 0.1, completionPricePerMillion: 0.5 }
])

const PriceSchema = z.union([z.string(), z.number()]).nullish()

const RawModelSchema = z.object({
    id: z.string().min(1),
    name: z.string().nullish(),
    context_length: z.number().nullish(),
    architecture: z.object({ input_modalities: z.array(z.string()).nullish() }).nullish(),
    supported_parameters: z.array(z.string()).nullish(),
    pricing: z.object({ prompt: PriceSchema, completion: PriceSchema }).nullish(),
    top_provider: z.object({ max_completion_tokens: z.number().nullish() }).nullish()
})

const CatalogueEnvelopeSchema = z.object({ data: z.array(z.unknown()) })

/** USD-per-token string → USD per million tokens; negative (variable-price routers) → null. */
function perMillion(value: string | number | null | undefined): number | null {
    if (value === null || value === undefined || value === '') {
        return null
    }
    const perToken = typeof value === 'number' ? value : Number.parseFloat(value)
    if (!Number.isFinite(perToken) || perToken < 0) {
        return null
    }
    return Math.round(perToken * 1_000_000 * 1e6) / 1e6
}

export function parseOpenRouterModels(raw: unknown): OpenRouterModel[] {
    const envelope = CatalogueEnvelopeSchema.safeParse(raw)
    if (!envelope.success) {
        throw new Error('OpenRouter model list had an unexpected shape')
    }
    const models: OpenRouterModel[] = []
    for (const entry of envelope.data.data) {
        const parsed = RawModelSchema.safeParse(entry)
        if (!parsed.success) {
            continue
        }
        const model = parsed.data
        // :batch variants are OpenRouter's asynchronous batch API, not usable for chat.
        if (model.id.endsWith(':batch') || !isValidOpenRouterModelId(model.id)) {
            continue
        }
        const params = model.supported_parameters ?? []
        models.push({
            id: model.id,
            name: model.name?.trim() || model.id,
            contextLength: model.context_length ?? null,
            vision: (model.architecture?.input_modalities ?? []).includes('image'),
            structuredOutput: params.includes('structured_outputs') || params.includes('response_format'),
            maxOutputTokens: model.top_provider?.max_completion_tokens ?? null,
            promptPricePerMillion: perMillion(model.pricing?.prompt),
            completionPricePerMillion: perMillion(model.pricing?.completion)
        })
    }
    return models
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

const defaultFetch: FetchLike = (input, init) => fetch(input, init)

export async function fetchOpenRouterModels(fetchImpl: FetchLike = defaultFetch): Promise<OpenRouterModel[]> {
    const response = await fetchImpl(OPENROUTER_MODELS_ENDPOINT, { headers: { Accept: 'application/json' } })
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
    }
    return parseOpenRouterModels(await response.json())
}

/**
 * Loads the catalogue into `state` once. Concurrent callers share one request.
 * On failure it resolves with the curated list and leaves `state.models` null so a later call retries.
 */
export function ensureOpenRouterCatalogue(state: OpenRouterCatalogueState, fetchImpl: FetchLike = defaultFetch): Promise<OpenRouterModel[]> {
    if (state.models) {
        return Promise.resolve(state.models)
    }
    if (!state.modelsLoading) {
        state.modelsLoading = fetchOpenRouterModels(fetchImpl)
            .then((models) => {
                state.models = models
                state.modelsError = null
                return models
            })
            .catch((error: unknown) => {
                state.modelsError = error instanceof Error ? error.message : String(error)
                console.warn('OpenRouter model list unavailable, using defaults:', error)
                return [...OPENROUTER_CURATED_MODELS]
            })
            .finally(() => {
                state.modelsLoading = null
            })
    }
    return state.modelsLoading
}

export function availableOpenRouterModels(state: OpenRouterCatalogueState): readonly OpenRouterModel[] {
    return state.models ?? OPENROUTER_CURATED_MODELS
}

export function findOpenRouterModel(state: OpenRouterCatalogueState, id: string): OpenRouterModel | null {
    return availableOpenRouterModels(state).find(model => model.id === id) ?? null
}

function formatTokenCount(count: number): string {
    if (count >= 1_000_000) {
        return `${Number((count / 1_000_000).toFixed(2))}M`
    }
    if (count >= 1000) {
        return `${Math.round(count / 1000)}K`
    }
    return String(count)
}

function formatPricePerMillion(price: number): string {
    if (price === 0) {
        return '$0'
    }
    return `$${price < 0.1 ? price.toFixed(3) : price.toFixed(2)}`
}

/** "Google: Gemini 3.8 Flash · 1.05M context · $0.75/M in · $3.75/M out · reads images · structured output" */
export function describeOpenRouterModel(model: OpenRouterModel): string {
    const parts = [model.name]
    if (model.contextLength) {
        parts.push(`${formatTokenCount(model.contextLength)} context`)
    }
    if (model.promptPricePerMillion !== null) {
        parts.push(`${formatPricePerMillion(model.promptPricePerMillion)}/M in`)
    }
    if (model.completionPricePerMillion !== null) {
        parts.push(`${formatPricePerMillion(model.completionPricePerMillion)}/M out`)
    }
    if (model.vision) {
        parts.push('reads images')
    }
    if (model.structuredOutput) {
        parts.push('structured output')
    }
    return parts.join(' · ')
}
