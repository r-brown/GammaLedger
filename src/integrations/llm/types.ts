// src/integrations/llm/types.ts — provider-neutral LLM request/response types.
// The AI Coach builds these shapes; each provider adapter translates them to its
// own wire format, so nothing outside src/integrations/llm sees vendor payloads.

import type { AIProviderId } from '@core/config'

export type LLMProviderId = AIProviderId

export type LLMContentPart =
    | { type: 'text'; text: string }
    | { type: 'image'; mimeType: string; base64: string }

export interface LLMMessage {
    role: 'system' | 'user' | 'assistant'
    content: LLMContentPart[]
}

export interface LLMJsonSchema {
    /** Schema name; OpenRouter requires one for json_schema response formats. */
    name: string
    schema: Record<string, unknown>
}

export interface LLMRequest {
    messages: LLMMessage[]
    maxOutputTokens: number
    temperature: number
    responseSchema?: LLMJsonSchema
    signal?: AbortSignal
}

export interface LLMUsage {
    inputTokens: number | null
    outputTokens: number | null
    /** USD as reported by the provider; null when the provider does not report cost. */
    costUsd: number | null
}

export interface LLMResponse {
    text: string
    provider: LLMProviderId
    /** The model that actually answered — may differ from the requested one after a fallback. */
    model: string
    usage: LLMUsage | null
}

export type LLMErrorKind =
    | 'missing_key'
    | 'auth'
    | 'rate_limit'
    | 'insufficient_credits'
    | 'blocked'
    | 'model_unavailable'
    | 'bad_response'
    | 'timeout'
    | 'network'
    | 'aborted'
    | 'http'

export class LLMError extends Error {
    readonly kind: LLMErrorKind
    readonly status: number | null

    constructor(kind: LLMErrorKind, message: string, status: number | null = null) {
        super(message)
        this.name = 'LLMError'
        this.kind = kind
        this.status = status
    }
}

export interface LLMModelCapabilities {
    vision: boolean
    structuredOutput: boolean
    maxOutputTokens: number | null
}

export type LLMDeltaHandler = (textSoFar: string) => void

export interface LLMProvider {
    readonly id: LLMProviderId
    readonly displayName: string
    isConfigured(): boolean
    activeModel(): string
    modelLabel(model: string): string
    capabilities(model: string): LLMModelCapabilities
    /** Loads anything the provider needs before a request (OpenRouter: model catalogue). Never throws. */
    prepare(): Promise<void>
    complete(request: LLMRequest): Promise<LLMResponse>
    stream(request: LLMRequest, onDelta: LLMDeltaHandler): Promise<LLMResponse>
}

/** Turns any thrown value into one user-facing sentence. */
export function describeLLMError(error: unknown, providerName: string): string {
    if (!(error instanceof LLMError)) {
        return error instanceof Error && error.message ? error.message : 'Unknown error'
    }
    switch (error.kind) {
        case 'missing_key': return `Add your ${providerName} API key in Settings.`
        case 'auth': return `${providerName} rejected the API key. Check it in Settings.`
        case 'insufficient_credits': return `Your ${providerName} account is out of credits. Add credits and try again.`
        case 'rate_limit': return `Rate-limited by ${providerName}. Try again in a minute.`
        case 'blocked': return `${providerName} blocked the request (${error.message}).`
        case 'model_unavailable': return error.message
        case 'timeout': return `${providerName} did not answer in time. Try again.`
        case 'network': return `Could not reach ${providerName}. Check your connection.`
        case 'aborted': return 'Request cancelled.'
        case 'bad_response': return `${providerName} returned an unexpected response (${error.message}).`
        case 'http': return `${providerName} returned an error: ${error.message}`
    }
}

// ---------------------------------------------------------------------------
// OpenRouter state shared by the provider and the settings UI
// ---------------------------------------------------------------------------

export interface OpenRouterModel {
    id: string
    name: string
    contextLength: number | null
    vision: boolean
    structuredOutput: boolean
    maxOutputTokens: number | null
    promptPricePerMillion: number | null
    completionPricePerMillion: number | null
}

export type OpenRouterDataCollection = 'deny' | 'allow'

export interface OpenRouterCatalogueState {
    /** Loaded catalogue; null until a successful fetch (the curated list is used meanwhile). */
    models: OpenRouterModel[] | null
    modelsLoading: Promise<OpenRouterModel[]> | null
    modelsError: string | null
}

export interface OpenRouterProviderState extends OpenRouterCatalogueState {
    apiKey: string | null
    model: string
    fallbackModels: string[]
    dataCollection: OpenRouterDataCollection
}
