// src/integrations/decision/llm-adapter.ts — the active LLM answers the same typed questions when
// JEV isn't available. Answers are forced into the declared sets; confidence is null (uncalibrated).

import { z } from 'zod'
import { parseJsonLenient } from '../llm/json.js'
import { LLMError, type LLMProvider, type LLMRequest, type LLMResponse } from '../llm/types.js'
import type { DecisionAnswer, DecisionProvider, DecisionQuestion, DecisionRequest, DecisionResult } from './types.js'

export const DECISION_SCHEMA_NAME = 'typed_decisions'

const keysOf = <K extends string>(questions: Record<K, DecisionQuestion>): K[] => Object.keys(questions) as K[]

export function buildDecisionSchema<K extends string>(questions: Record<K, DecisionQuestion>): Record<string, unknown> {
    const properties: Record<string, unknown> = {}
    for (const key of keysOf(questions)) {
        const q = questions[key]
        properties[key] = q.type === 'choice'
            ? { type: 'object', additionalProperties: false, required: ['choice'], properties: { choice: { type: 'string', enum: Object.keys(q.criteria) } } }
            : q.type === 'score'
                ? { type: 'object', additionalProperties: false, required: ['level'], properties: { level: { type: 'integer', minimum: 0, maximum: q.criteria.length - 1 } } }
                : { type: 'object', additionalProperties: false, required: ['answer'], properties: { answer: { type: 'boolean' } } }
    }
    return { type: 'object', additionalProperties: false, required: keysOf(questions), properties }
}

export function buildDecisionPrompt<K extends string>(request: DecisionRequest<K>): string {
    const lines = keysOf(request.questions).map((key) => {
        const q = request.questions[key]
        if (q.type === 'choice') {
            const options = Object.entries(q.criteria).map(([label, meaning]) => `"${label}" = ${meaning}`).join('; ')
            return `- ${key} (pick one): ${q.instructions} Options: ${options}. Answer {"choice": "<option>"}.`
        }
        if (q.type === 'score') {
            const levels = q.criteria.map((meaning, i) => `${i} = ${meaning}`).join('; ')
            return `- ${key} (level): ${q.instructions} Levels: ${levels}. Answer {"level": <integer>}.`
        }
        const yes = q.criteria?.true ? ` Yes means: ${q.criteria.true}.` : ''
        const no = q.criteria?.false ? ` No means: ${q.criteria.false}.` : ''
        return `- ${key} (yes/no): ${q.instructions}.${yes}${no} Answer {"answer": true|false}.`
    })
    return `Answer each question about STATE using only the facts in STATE. Return one JSON object with one key per question and nothing else.\n\nQUESTIONS\n${lines.join('\n')}\n\nSTATE\n${JSON.stringify(request.state)}`
}

const ChoiceOut = z.object({ choice: z.string() })
const LevelOut = z.object({ level: z.number().int() })
const YesNoOut = z.object({ answer: z.boolean() })
const ObjectOut = z.record(z.string(), z.unknown())

export function parseAdapterAnswers<K extends string>(questions: Record<K, DecisionQuestion>, text: string): Record<K, DecisionAnswer> {
    let json: unknown
    try {
        json = parseJsonLenient(text)
    } catch {
        throw new LLMError('bad_response', 'decision reply was not JSON')
    }
    const raw = ObjectOut.safeParse(json)
    if (!raw.success) throw new LLMError('bad_response', 'decision reply was not a JSON object')
    const out: Partial<Record<K, DecisionAnswer>> = {}
    for (const key of keysOf(questions)) {
        const q = questions[key]
        const value = raw.data[key]
        if (q.type === 'choice') {
            const p = ChoiceOut.safeParse(value)
            if (!p.success || !Object.prototype.hasOwnProperty.call(q.criteria, p.data.choice)) throw new LLMError('bad_response', `no valid choice for "${key}"`)
            const choice = p.data.choice
            out[key] = { type: 'choice', choice, confidence: null, probabilities: Object.fromEntries(Object.keys(q.criteria).map(label => [label, label === choice ? 1 : 0])) }
        } else if (q.type === 'score') {
            const p = LevelOut.safeParse(value)
            if (!p.success || p.data.level < 0 || p.data.level >= q.criteria.length) throw new LLMError('bad_response', `no valid level for "${key}"`)
            out[key] = { type: 'score', score: p.data.level, confidence: null, probabilities: { [String(p.data.level)]: 1 } }
        } else {
            const p = YesNoOut.safeParse(value)
            if (!p.success) throw new LLMError('bad_response', `no yes/no answer for "${key}"`)
            out[key] = { type: 'noul', noul: p.data.answer ? 1 : 0 }
        }
    }
    return out as Record<K, DecisionAnswer>
}

export function createLlmDecisionProvider(llm: LLMProvider): DecisionProvider {
    return {
        id: 'llm',
        displayName: llm.displayName,
        async decide<K extends string>(request: DecisionRequest<K>): Promise<DecisionResult<K>> {
            await llm.prepare()
            const base: LLMRequest = {
                messages: [{ role: 'user', content: [{ type: 'text', text: buildDecisionPrompt(request) }] }],
                maxOutputTokens: 1024,
                temperature: 0,
                signal: request.signal
            }
            const structured = llm.capabilities(llm.activeModel()).structuredOutput
            const withSchema: LLMRequest = structured
                ? { ...base, responseSchema: { name: DECISION_SCHEMA_NAME, schema: buildDecisionSchema(request.questions) } }
                : base
            let response: LLMResponse
            try {
                response = await llm.complete(withSchema)
            } catch (error) {
                if (!withSchema.responseSchema || !(error instanceof LLMError) || error.kind !== 'model_unavailable') throw error
                response = await llm.complete(base)
            }
            return {
                answers: parseAdapterAnswers(request.questions, response.text),
                engine: 'llm',
                calibrated: false,
                model: response.model,
                usage: { inputTokens: response.usage?.inputTokens ?? null, costUsd: response.usage?.costUsd ?? null }
            }
        }
    }
}
