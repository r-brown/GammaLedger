// src/integrations/decision/jev.ts — TypeSafe AI's JEV (System One model) behind DecisionProvider,
// served by OpenRouter's Decisions API (POST /api/alpha/decisions {model, state, questions}) with the
// user's OpenRouter key. Answers are Zod-validated against the type each question was asked as.

import { z } from 'zod'
import {
    JEV_INPUT_USD_PER_MILLION,
    JEV_OPENROUTER_MODEL,
    JEV_REQUEST_TIMEOUT_MS,
    OPENROUTER_ATTRIBUTION_HEADERS,
    OPENROUTER_DECISIONS_ENDPOINT
} from '@core/config'
import { readJson, runWithTimeout } from '../llm/http.js'
import { LLMError, type LLMErrorKind } from '../llm/types.js'
import type { DecisionAnswer, DecisionProvider, DecisionQuestion, DecisionRequest, DecisionResult } from './types.js'

export interface JevProviderContext {
    openRouter: { apiKey: string | null }
}

const Probabilities = z.record(z.string(), z.number())
const Confidence = z.number().min(0).max(1).nullish()
// OpenRouter returns a superset of TypeSafe's body; unknown fields are ignored, the answers are not.
const ChoiceAnswer = z.object({ choice: z.string(), probabilities: Probabilities.nullish(), confidence: Confidence })
const ScoreAnswer = z.object({ score: z.number(), probabilities: Probabilities.nullish(), confidence: Confidence })
const NoulAnswer = z.union([z.number().min(0).max(1), z.object({ noul: z.number().min(0).max(1) })])
const ResponseSchema = z.object({
    model: z.string().nullish(),
    answers: z.record(z.string(), z.unknown()),
    usage: z.object({
        input_tokens: z.number().nullish(),
        prompt_tokens: z.number().nullish(),
        cost: z.number().nullish()
    }).nullish()
})
const ErrorBodySchema = z.object({
    error: z.union([z.string(), z.object({ message: z.string() })]).nullish(),
    message: z.string().nullish(),
    detail: z.string().nullish()
})

export function jevErrorKind(status: number): LLMErrorKind {
    if (status === 401 || status === 403) return 'auth'
    if (status === 402) return 'insufficient_credits'
    if (status === 404) return 'model_unavailable'
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

export function buildJevBody<K extends string>(request: DecisionRequest<K>, model: string = JEV_OPENROUTER_MODEL): Record<string, unknown> {
    return { model, state: request.state, questions: request.questions }
}

/** Every question must come back, in the shape of the type it was asked as. */
export function toDecisionAnswers<K extends string>(
    questions: Record<K, DecisionQuestion>,
    answers: Record<string, unknown>
): Record<K, DecisionAnswer> {
    const out: Partial<Record<K, DecisionAnswer>> = {}
    for (const key of Object.keys(questions) as K[]) {
        const question = questions[key]
        const raw = answers[key]
        const fail = () => new LLMError('bad_response', `JEV did not answer "${key}" as ${question.type}`)
        if (question.type === 'choice') {
            const p = ChoiceAnswer.safeParse(raw)
            if (!p.success || !Object.prototype.hasOwnProperty.call(question.criteria, p.data.choice)) throw fail()
            out[key] = { type: 'choice', choice: p.data.choice, probabilities: p.data.probabilities ?? {}, confidence: p.data.confidence ?? null }
        } else if (question.type === 'score') {
            const p = ScoreAnswer.safeParse(raw)
            if (!p.success) throw fail()
            out[key] = { type: 'score', score: p.data.score, probabilities: p.data.probabilities ?? {}, confidence: p.data.confidence ?? null }
        } else {
            const p = NoulAnswer.safeParse(raw)
            if (!p.success) throw fail()
            out[key] = { type: 'noul', noul: typeof p.data === 'number' ? p.data : p.data.noul }
        }
    }
    return out as Record<K, DecisionAnswer>
}

export function createJevProvider(ctx: JevProviderContext): DecisionProvider {
    return {
        id: 'jev',
        displayName: 'JEV (via OpenRouter)',
        async decide<K extends string>(request: DecisionRequest<K>): Promise<DecisionResult<K>> {
            const key = (ctx.openRouter.apiKey || '').trim()
            if (!key) throw new LLMError('missing_key', 'Missing OpenRouter API key')
            return runWithTimeout(JEV_REQUEST_TIMEOUT_MS, request.signal, async (signal) => {
                const response = await fetch(OPENROUTER_DECISIONS_ENDPOINT, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${key}`,
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                        ...OPENROUTER_ATTRIBUTION_HEADERS
                    },
                    body: JSON.stringify(buildJevBody(request)),
                    signal
                })
                const body = await readJson(response)
                if (!response.ok) throw new LLMError(jevErrorKind(response.status), errorMessage(body, response.status), response.status)
                const parsed = ResponseSchema.safeParse(body)
                if (!parsed.success) throw new LLMError('bad_response', 'unrecognised JEV response')
                const usage = parsed.data.usage
                const inputTokens = usage?.input_tokens ?? usage?.prompt_tokens ?? null
                return {
                    answers: toDecisionAnswers(request.questions, parsed.data.answers),
                    engine: 'jev',
                    calibrated: true,
                    model: parsed.data.model || JEV_OPENROUTER_MODEL,
                    usage: {
                        inputTokens,
                        costUsd: usage?.cost ?? (inputTokens === null ? null : (inputTokens * JEV_INPUT_USD_PER_MILLION) / 1_000_000)
                    }
                }
            })
        }
    }
}
