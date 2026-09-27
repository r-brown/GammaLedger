// src/integrations/decision/types.ts — provider-neutral typed decisions (JEV-shaped: choice, score, noul).

import type { ConfidenceBand } from '@types-gl/ai'

export type DecisionEngine = 'jev' | 'llm'

export type DecisionQuestion =
    | { type: 'choice'; instructions: string; criteria: Record<string, string> }
    | { type: 'score'; instructions: string; criteria: string[] }
    | { type: 'noul'; instructions: string; criteria?: { true?: string; false?: string } }

export type DecisionAnswer =
    | { type: 'choice'; choice: string; probabilities: Record<string, number>; confidence: number | null }
    | { type: 'score'; score: number; probabilities: Record<string, number>; confidence: number | null }
    | { type: 'noul'; noul: number }

export interface DecisionRequest<K extends string> {
    state: Record<string, unknown>
    questions: Record<K, DecisionQuestion>
    signal?: AbortSignal
}

export interface DecisionResult<K extends string> {
    answers: Record<K, DecisionAnswer>
    engine: DecisionEngine
    /** True only for JEV (RL-calibrated); LLM adapter confidences are null. */
    calibrated: boolean
    model: string
    usage: { inputTokens: number | null; costUsd: number | null }
}

export interface DecisionProvider {
    readonly id: DecisionEngine
    readonly displayName: string
    decide<K extends string>(request: DecisionRequest<K>): Promise<DecisionResult<K>>
}

/** TypeSafe's bands: > 0.9 act, 0.5–0.9 act with care, < 0.5 escalate. */
export function confidenceBand(confidence: number | null): ConfidenceBand | null {
    if (confidence === null || !Number.isFinite(confidence)) return null
    if (confidence > 0.9) return 'high'
    if (confidence >= 0.5) return 'medium'
    return 'low'
}
