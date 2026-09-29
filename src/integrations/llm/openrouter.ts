// src/integrations/llm/openrouter.ts — OpenRouter chat/completions adapter behind LLMProvider.

import { z } from 'zod'
import {
    DEFAULT_OPENROUTER_MODEL,
    LLM_REQUEST_TIMEOUT_MS,
    OPENROUTER_ATTRIBUTION_HEADERS,
    OPENROUTER_CHAT_ENDPOINT
} from '@core/config'
import { finiteOrNull, readJson, runWithTimeout } from './http.js'
import { ensureOpenRouterCatalogue, findOpenRouterModel, isValidOpenRouterModelId } from './openrouter-models.js'
import { readSSE } from './sse.js'
import {
    LLMError,
    type LLMErrorKind,
    type LLMMessage,
    type LLMProvider,
    type LLMRequest,
    type LLMResponse,
    type LLMUsage,
    type OpenRouterCatalogueState,
    type OpenRouterDataCollection,
    type OpenRouterProviderState
} from './types.js'

export interface OpenRouterProviderContext {
    openRouter: OpenRouterProviderState
}

export interface OpenRouterRequestSettings {
    model: string
    fallbackModels: readonly string[]
    dataCollection: OpenRouterDataCollection
    /** The catalogue's max_completion_tokens for `model`, when known. */
    modelMaxOutputTokens: number | null
    /** The catalogue's context window for `model`, when known. */
    modelContextLength: number | null
}

const ErrorSchema = z.object({
    code: z.union([z.number(), z.string()]).nullish(),
    message: z.string().nullish()
})

const UsageSchema = z.object({
    prompt_tokens: z.number().nullish(),
    completion_tokens: z.number().nullish(),
    cost: z.number().nullish()
})

const ChoiceSchema = z.object({
    message: z.object({ content: z.string().nullish() }).nullish(),
    delta: z.object({ content: z.string().nullish() }).nullish(),
    finish_reason: z.string().nullish(),
    error: ErrorSchema.nullish()
})

/** Covers full completions and stream chunks alike. */
const CompletionSchema = z.object({
    model: z.string().nullish(),
    choices: z.array(ChoiceSchema).nullish(),
    usage: UsageSchema.nullish(),
    error: ErrorSchema.nullish()
})

type Completion = z.infer<typeof CompletionSchema>

export function resolveOpenRouterModel(model: string | null | undefined): string {
    const trimmed = (model || '').trim()
    return trimmed && isValidOpenRouterModelId(trimmed) ? trimmed : DEFAULT_OPENROUTER_MODEL
}

/** "Anthropic: Claude Sonnet 5" → "Claude Sonnet 5"; unknown IDs → the part after the vendor slash. */
export function openRouterModelLabel(state: OpenRouterCatalogueState, model: string): string {
    const known = findOpenRouterModel(state, model)
    if (known) {
        return known.name.replace(/^[^:]+:\s+/, '')
    }
    return model.slice(model.indexOf('/') + 1)
}

function toOpenRouterMessage(message: LLMMessage): Record<string, unknown> {
    const needsParts = message.content.some(part => part.type === 'image' || part.cache)
    if (!needsParts) {
        return {
            role: message.role,
            content: message.content.map(part => (part.type === 'text' ? part.text : '')).join('\n\n')
        }
    }
    return {
        role: message.role,
        content: message.content.map(part => part.type === 'text'
            ? (part.cache
                ? { type: 'text', text: part.text, cache_control: { type: 'ephemeral' } }
                : { type: 'text', text: part.text })
            : { type: 'image_url', image_url: { url: `data:${part.mimeType};base64,${part.base64}` } })
    }
}

/** Smallest reply budget we send, so a nearly full context still gets a usable (not zero/negative) cap. */
const MIN_OUTPUT_TOKENS = 256
const CHARS_PER_TOKEN_ESTIMATE = 3
const TOKENS_PER_IMAGE_ESTIMATE = 1500
const TOKENS_PER_MESSAGE_OVERHEAD = 4

/** Deliberately pessimistic prompt size, used only to keep prompt + reply inside the context window. */
export function estimatePromptTokens(messages: readonly LLMMessage[]): number {
    let tokens = 0
    for (const message of messages) {
        tokens += TOKENS_PER_MESSAGE_OVERHEAD
        for (const part of message.content) {
            tokens += part.type === 'text'
                ? Math.ceil(part.text.length / CHARS_PER_TOKEN_ESTIMATE)
                : TOKENS_PER_IMAGE_ESTIMATE
        }
    }
    return tokens
}

/** The user's cap, reduced to the model's own output limit and to what is left of its context window. */
function fitMaxTokens(request: LLMRequest, settings: OpenRouterRequestSettings): number {
    let tokens = request.maxOutputTokens
    if (settings.modelMaxOutputTokens && settings.modelMaxOutputTokens > 0) {
        tokens = Math.min(tokens, settings.modelMaxOutputTokens)
    }
    if (settings.modelContextLength && settings.modelContextLength > 0) {
        const room = settings.modelContextLength - estimatePromptTokens(request.messages)
        tokens = Math.min(tokens, Math.max(room, MIN_OUTPUT_TOKENS))
    }
    return tokens
}

export function buildOpenRouterBody(request: LLMRequest, settings: OpenRouterRequestSettings, stream: boolean): Record<string, unknown> {
    const body: Record<string, unknown> = {
        model: settings.model,
        messages: request.messages.map(toOpenRouterMessage),
        max_tokens: fitMaxTokens(request, settings),
        temperature: request.temperature,
        usage: { include: true }
    }
    const fallbacks = settings.fallbackModels.filter(id => id && id !== settings.model)
    if (fallbacks.length) {
        body.models = [settings.model, ...fallbacks]
    }
    const provider: Record<string, unknown> = { data_collection: settings.dataCollection }
    if (request.responseSchema) {
        provider.require_parameters = true
        body.response_format = {
            type: 'json_schema',
            json_schema: { name: request.responseSchema.name, strict: true, schema: request.responseSchema.schema }
        }
    }
    body.provider = provider
    if (stream) {
        body.stream = true
    }
    return body
}

export function openRouterErrorKind(status: number, message: string): LLMErrorKind {
    if (status === 401) return 'auth'
    if (status === 402) return 'insufficient_credits'
    if (status === 403) return 'blocked'
    if (status === 404 || /no endpoints|no allowed providers|not a valid model/i.test(message)) return 'model_unavailable'
    if (status === 408) return 'timeout'
    if (status === 429) return 'rate_limit'
    return 'http'
}

function toOpenRouterError(status: number, message: string | null | undefined, settings: OpenRouterRequestSettings): LLMError {
    const text = message?.trim() || `HTTP ${status}`
    const kind = openRouterErrorKind(status, text)
    if (kind !== 'model_unavailable') {
        return new LLMError(kind, text, status >= 400 ? status : null)
    }
    const hint = settings.dataCollection === 'deny'
        ? ' If "Only use providers that don\'t train on my data" is on, this model may have no eligible provider — turn it off or pick another model.'
        : ''
    return new LLMError(kind, `The model "${settings.model}" is unavailable: ${text}${hint}`, status >= 400 ? status : null)
}

const errorStatus = (code: number | string | null | undefined, fallback: number) => (typeof code === 'number' ? code : fallback)

function toUsage(usage: Completion['usage']): LLMUsage | null {
    if (!usage) {
        return null
    }
    return {
        inputTokens: finiteOrNull(usage.prompt_tokens),
        outputTokens: finiteOrNull(usage.completion_tokens),
        costUsd: finiteOrNull(usage.cost)
    }
}

export function createOpenRouterProvider(ctx: OpenRouterProviderContext): LLMProvider {
    const state = ctx.openRouter
    const apiKey = () => (state.apiKey || '').trim()
    const activeModel = () => resolveOpenRouterModel(state.model)
    const requireKey = () => {
        const key = apiKey()
        if (!key) {
            throw new LLMError('missing_key', 'Missing OpenRouter API key')
        }
        return key
    }
    const settingsFor = (model: string): OpenRouterRequestSettings => {
        const known = findOpenRouterModel(state, model)
        return {
            model,
            fallbackModels: state.fallbackModels.filter(isValidOpenRouterModelId),
            dataCollection: state.dataCollection,
            modelMaxOutputTokens: known?.maxOutputTokens ?? null,
            modelContextLength: known?.contextLength ?? null
        }
    }
    const post = (key: string, body: Record<string, unknown>, signal: AbortSignal) => fetch(OPENROUTER_CHAT_ENDPOINT, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
            ...OPENROUTER_ATTRIBUTION_HEADERS
        },
        body: JSON.stringify(body),
        signal
    })

    return {
        id: 'openrouter',
        displayName: 'OpenRouter',
        isConfigured: () => apiKey().length > 0,
        activeModel,
        modelLabel: (model) => openRouterModelLabel(state, model),
        capabilities(model) {
            const known = findOpenRouterModel(state, model)
            // Unknown (custom) IDs are optimistic: let OpenRouter return the real error.
            return known
                ? { vision: known.vision, structuredOutput: known.structuredOutput, maxOutputTokens: known.maxOutputTokens }
                : { vision: true, structuredOutput: true, maxOutputTokens: null }
        },
        async prepare() {
            await ensureOpenRouterCatalogue(state)
        },

        async complete(request: LLMRequest): Promise<LLMResponse> {
            const key = requireKey()
            const settings = settingsFor(activeModel())
            return runWithTimeout(LLM_REQUEST_TIMEOUT_MS, request.signal, async (signal) => {
                const response = await post(key, buildOpenRouterBody(request, settings, false), signal)
                const parsed = CompletionSchema.safeParse(await readJson(response))
                if (!parsed.success) {
                    if (!response.ok) {
                        throw toOpenRouterError(response.status, null, settings)
                    }
                    throw new LLMError('bad_response', 'unrecognised response body')
                }
                const data = parsed.data
                const error = data.error ?? data.choices?.[0]?.error
                if (error || !response.ok) {
                    throw toOpenRouterError(errorStatus(error?.code, response.status), error?.message, settings)
                }
                return {
                    text: (data.choices?.[0]?.message?.content ?? '').trim(),
                    provider: 'openrouter',
                    model: data.model || settings.model,
                    usage: toUsage(data.usage)
                }
            })
        },

        async stream(request, onDelta): Promise<LLMResponse> {
            const key = requireKey()
            const settings = settingsFor(activeModel())
            return runWithTimeout(LLM_REQUEST_TIMEOUT_MS, request.signal, async (signal) => {
                const response = await post(key, buildOpenRouterBody(request, settings, true), signal)
                if (!response.ok) {
                    const parsed = CompletionSchema.safeParse(await readJson(response))
                    const error = parsed.success ? parsed.data.error : null
                    throw toOpenRouterError(errorStatus(error?.code, response.status), error?.message, settings)
                }
                if (!response.body) {
                    throw new LLMError('bad_response', 'empty stream body')
                }
                let text = ''
                let usage: LLMUsage | null = null
                let answeredModel = settings.model
                await readSSE(response.body, (data) => {
                    if (data.trim() === '[DONE]') {
                        return
                    }
                    let json: unknown
                    try {
                        json = JSON.parse(data)
                    } catch {
                        return
                    }
                    const chunk = CompletionSchema.safeParse(json)
                    if (!chunk.success) {
                        return
                    }
                    const choice = chunk.data.choices?.[0]
                    const error = chunk.data.error ?? choice?.error
                    if (error || choice?.finish_reason === 'error') {
                        throw toOpenRouterError(errorStatus(error?.code, 200), error?.message ?? 'stream ended with an error', settings)
                    }
                    const piece = choice?.delta?.content ?? ''
                    if (piece) {
                        text += piece
                        onDelta(text)
                    }
                    if (chunk.data.model) {
                        answeredModel = chunk.data.model
                    }
                    usage = toUsage(chunk.data.usage) ?? usage
                })
                return { text: text.trim(), provider: 'openrouter', model: answeredModel, usage }
            })
        }
    }
}
