// src/integrations/decision/jev.ts — TypeSafe AI's JEV (System One model) behind DecisionProvider.
// POST /v1/systemone {state, questions, model}; answers are typed and Zod-validated.

import { z } from 'zod'
import { JEV_DEFAULT_MODEL, JEV_ENDPOINT, JEV_INPUT_USD_PER_MILLION, JEV_REQUEST_TIMEOUT_MS } from '@core/config'
import { readJson, runWithTimeout } from '../llm/http.js'
import { LLMError, type LLMErrorKind } from '../llm/types.js'
import type { DecisionAnswer, DecisionProvider, DecisionQuestion, DecisionRequest, DecisionResult } from './types.js'

export interface JevProviderContext {
    jev: { apiKey: string | null }
}

const Probabilities = z.record(z.string(), z.number())
const AnswerSchema = z.discriminatedUnion('type', [
    z.object({ type: z.literal('choice'), choice: z.string(), confidence: z.number(), probabilities: Probabilities }),
    z.object({ type: z.literal('score'), score: z.number(), confidence: z.number(), probabilities: Probabilities }),
    z.object({ type: z.literal('noul'), noul: z.number().min(0).max(1) })
])
const ResponseSchema = z.object({
    model: z.string(),
    answers: z.record(z.string(), AnswerSchema),
    usage: z.object({ input_tokens: z.number().nullish(), output_tokens: z.number().nullish() }).nullish()
})
const ErrorBodySchema = z.object({
    error: z.union([z.string(), z.object({ message: z.string() })]).nullish(),
    message: z.string().nullish(),
    detail: z.string().nullish()
})

export function jevErrorKind(status: number): LLMErrorKind {
    if (status === 401 || status === 403) return 'auth'
    if (status === 402) return 'insufficient_credits'
    if (status === 408) return 'timeout'
    if (status === 429) return 'rate_limit'
    return 'http'
}

function errorMessage(body: unknown, status: number): string {
    const parsed = ErrorBodySchema.safeParse(body)
    if (!parsed.success) return `HTTP ${status}`
    const e = parsed.data.error
    return (typeof e === 'string' ? e : e?.message) || parsed.data.message || parsed.data.detail || `HTTP ${status}`
}

export function buildJevBody<K extends string>(request: DecisionRequest<K>, model: string = JEV_DEFAULT_MODEL): Record<string, unknown> {
    return { state: request.state, questions: request.questions, model }
}

/** Every question must come back, typed as it was asked. */
export function toDecisionAnswers<K extends string>(
    questions: Record<K, DecisionQuestion>,
    answers: Record<string, DecisionAnswer>
): Record<K, DecisionAnswer> {
    const out: Partial<Record<K, DecisionAnswer>> = {}
    for (const key of Object.keys(questions) as K[]) {
        const answer = answers[key]
        if (!answer || answer.type !== questions[key].type) {
            throw new LLMError('bad_response', `JEV did not answer "${key}" as ${questions[key].type}`)
        }
        out[key] = answer
    }
    return out as Record<K, DecisionAnswer>
}

export function createJevProvider(ctx: JevProviderContext): DecisionProvider {
    return {
        id: 'jev',
        displayName: 'JEV',
        async decide<K extends string>(request: DecisionRequest<K>): Promise<DecisionResult<K>> {
            const key = (ctx.jev.apiKey || '').trim()
            if (!key) throw new LLMError('missing_key', 'Missing JEV API key')
            return runWithTimeout(JEV_REQUEST_TIMEOUT_MS, request.signal, async (signal) => {
                const response = await fetch(JEV_ENDPOINT, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Accept: 'application/json' },
                    body: JSON.stringify(buildJevBody(request)),
                    signal
                })
                const body = await readJson(response)
                if (!response.ok) throw new LLMError(jevErrorKind(response.status), errorMessage(body, response.status), response.status)
                const parsed = ResponseSchema.safeParse(body)
                if (!parsed.success) throw new LLMError('bad_response', 'unrecognised JEV response')
                const inputTokens = parsed.data.usage?.input_tokens ?? null
                return {
                    answers: toDecisionAnswers(request.questions, parsed.data.answers),
                    engine: 'jev',
                    calibrated: true,
                    model: parsed.data.model,
                    usage: { inputTokens, costUsd: inputTokens === null ? null : (inputTokens * JEV_INPUT_USD_PER_MILLION) / 1_000_000 }
                }
            })
        }
    }
}
