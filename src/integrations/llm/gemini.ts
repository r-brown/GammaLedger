// src/integrations/llm/gemini.ts — Gemini generateContent adapter behind LLMProvider.

import {
    DEFAULT_GEMINI_ENDPOINT,
    DEFAULT_GEMINI_MODEL,
    GEMINI_ALLOWED_MODELS,
    GEMINI_MODELS,
    LLM_REQUEST_TIMEOUT_MS
} from '@core/config'
import {
    extractGeminiError,
    isGeminiApiCandidate,
    isGeminiApiResponse,
    type GeminiApiResponse
} from '@types-gl/integrations'
import { finiteOrNull, readJson, runWithTimeout } from './http.js'
import { readSSE } from './sse.js'
import {
    LLMError,
    type LLMContentPart,
    type LLMErrorKind,
    type LLMProvider,
    type LLMRequest,
    type LLMResponse,
    type LLMUsage
} from './types.js'

export interface GeminiProviderContext {
    gemini: { apiKey: string | null; model: string }
}

type TextPart = Extract<LLMContentPart, { type: 'text' }>

const isTextPart = (part: LLMContentPart): part is TextPart => part.type === 'text'

export function resolveGeminiModel(model: string | null | undefined): string {
    return model && GEMINI_ALLOWED_MODELS.includes(model) ? model : DEFAULT_GEMINI_MODEL
}

export function geminiModelLabel(model: string): string {
    const normalized = (model || '').toLowerCase()
    const known = GEMINI_MODELS.find(entry => entry.id === normalized)
    if (known) {
        return known.label
    }
    if (!normalized) {
        return ''
    }
    const pretty = normalized
        .replace(/^gemini[-\s]?/i, 'Gemini ')
        .replace(/-/g, ' ')
        .replace(/\b([a-z])/g, (_match, letter: string) => letter.toUpperCase())
        .trim()
    return pretty || 'Gemini'
}

export function buildGeminiBody(request: LLMRequest): Record<string, unknown> {
    const systemParts = request.messages
        .filter(message => message.role === 'system')
        .flatMap(message => message.content)
        .filter(isTextPart)
        .map(part => ({ text: part.text }))

    const contents = request.messages
        .filter(message => message.role !== 'system')
        .map(message => ({
            role: message.role === 'assistant' ? 'model' : 'user',
            parts: message.content.map(part => part.type === 'text'
                ? { text: part.text }
                : { inlineData: { mimeType: part.mimeType, data: part.base64 } })
        }))

    const generationConfig: Record<string, unknown> = {
        maxOutputTokens: request.maxOutputTokens,
        temperature: request.temperature
    }
    if (request.responseSchema) {
        generationConfig.responseMimeType = 'application/json'
        generationConfig.responseJsonSchema = request.responseSchema.schema
    }

    const body: Record<string, unknown> = { contents, generationConfig }
    if (systemParts.length) {
        body.systemInstruction = { parts: systemParts }
    }
    return body
}

function geminiErrorKind(status: number, response: GeminiApiResponse | null): LLMErrorKind {
    if (response?.promptFeedback?.blockReason) {
        return 'blocked'
    }
    const message = response?.error?.message ?? ''
    const apiStatus = response?.error?.status ?? ''
    if (status === 401 || status === 403 || apiStatus === 'UNAUTHENTICATED' || apiStatus === 'PERMISSION_DENIED' || /api key/i.test(message)) {
        return 'auth'
    }
    if (status === 429 || apiStatus === 'RESOURCE_EXHAUSTED') {
        return 'rate_limit'
    }
    if (status === 404 || apiStatus === 'NOT_FOUND') {
        return 'model_unavailable'
    }
    return status >= 400 ? 'http' : 'bad_response'
}

function toGeminiError(status: number, response: GeminiApiResponse | null): LLMError {
    const message = (response ? extractGeminiError(response, status) : null) ?? `HTTP ${status}`
    return new LLMError(geminiErrorKind(status, response), message, status >= 400 ? status : null)
}

/** Error bodies for streaming requests may be wrapped in a one-element array. */
function unwrapGeminiBody(raw: unknown): GeminiApiResponse | null {
    const candidate: unknown = Array.isArray(raw) ? raw[0] : raw
    return isGeminiApiResponse(candidate) ? candidate : null
}

/** Concatenates text parts without trimming — stream chunks carry meaningful leading spaces. */
function chunkText(response: GeminiApiResponse): string {
    const candidate = response.candidates?.[0]
    if (!candidate || !isGeminiApiCandidate(candidate)) {
        return ''
    }
    return candidate.content.parts
        .map(part => (typeof part?.text === 'string' ? part.text : ''))
        .join('')
}

function toUsage(response: GeminiApiResponse): LLMUsage | null {
    const meta = response.usageMetadata
    if (!meta) {
        return null
    }
    return {
        inputTokens: finiteOrNull(meta.promptTokenCount),
        outputTokens: finiteOrNull(meta.candidatesTokenCount),
        costUsd: null
    }
}

export function createGeminiProvider(ctx: GeminiProviderContext): LLMProvider {
    const apiKey = () => (ctx.gemini.apiKey || '').trim()
    const activeModel = () => resolveGeminiModel(ctx.gemini.model)
    const requireKey = () => {
        const key = apiKey()
        if (!key) {
            throw new LLMError('missing_key', 'Missing Gemini API key')
        }
        return key
    }
    const endpoint = (model: string, stream: boolean) => {
        const base = DEFAULT_GEMINI_ENDPOINT.replace(/\/+$/, '')
        const segment = encodeURIComponent(model.replace(/^models\//i, ''))
        return stream
            ? `${base}/${segment}:streamGenerateContent?alt=sse`
            : `${base}/${segment}:generateContent`
    }
    const post = (url: string, key: string, request: LLMRequest, signal: AbortSignal) => fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify(buildGeminiBody(request)),
        signal
    })

    return {
        id: 'gemini',
        displayName: 'Gemini',
        isConfigured: () => apiKey().length > 0,
        activeModel,
        modelLabel: geminiModelLabel,
        capabilities: () => ({ vision: true, structuredOutput: true, maxOutputTokens: null }),
        prepare: async () => undefined,

        async complete(request: LLMRequest): Promise<LLMResponse> {
            const key = requireKey()
            const model = activeModel()
            return runWithTimeout(LLM_REQUEST_TIMEOUT_MS, request.signal, async (signal) => {
                const response = await post(endpoint(model, false), key, request, signal)
                const raw = unwrapGeminiBody(await readJson(response))
                if (!raw) {
                    if (!response.ok) {
                        throw toGeminiError(response.status, null)
                    }
                    throw new LLMError('bad_response', 'unrecognised response body')
                }
                if (!response.ok || extractGeminiError(raw, response.status)) {
                    throw toGeminiError(response.status, raw)
                }
                return {
                    text: chunkText(raw).trim(),
                    provider: 'gemini',
                    model: raw.modelVersion || model,
                    usage: toUsage(raw)
                }
            })
        },

        async stream(request, onDelta): Promise<LLMResponse> {
            const key = requireKey()
            const model = activeModel()
            return runWithTimeout(LLM_REQUEST_TIMEOUT_MS, request.signal, async (signal) => {
                const response = await post(endpoint(model, true), key, request, signal)
                if (!response.ok) {
                    throw toGeminiError(response.status, unwrapGeminiBody(await readJson(response)))
                }
                if (!response.body) {
                    throw new LLMError('bad_response', 'empty stream body')
                }
                let text = ''
                let usage: LLMUsage | null = null
                let answeredModel = model
                await readSSE(response.body, (data) => {
                    let parsed: unknown
                    try {
                        parsed = JSON.parse(data)
                    } catch {
                        return
                    }
                    if (!isGeminiApiResponse(parsed)) {
                        return
                    }
                    if (extractGeminiError(parsed, 200)) {
                        throw toGeminiError(parsed.error?.code ?? 200, parsed)
                    }
                    const piece = chunkText(parsed)
                    if (piece) {
                        text += piece
                        onDelta(text)
                    }
                    usage = toUsage(parsed) ?? usage
                    if (parsed.modelVersion) {
                        answeredModel = parsed.modelVersion
                    }
                })
                return { text: text.trim(), provider: 'gemini', model: answeredModel, usage }
            })
        }
    }
}
