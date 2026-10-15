// src/ai/watchlist-grade.ts — JEV pre-grade for the Watchlist scan: one calibrated typed choice per
// ticker (Strong / Decent / Mixed / Weak premium-selling candidate) over the app-computed market
// facts, before the big model sees the list. JEV only (cheap and calibrated); without JEV the scan
// simply goes out without grades rather than paying an LLM call per ticker.

import type { DecisionContext } from '../integrations/decision/registry.js'
import { currentDecisionEngine, decideWithFallback } from '../integrations/decision/registry.js'
import type { DecisionQuestion, DecisionResult } from '../integrations/decision/types.js'

export const SCAN_QUALITIES = ['strong', 'decent', 'mixed', 'weak'] as const
export type ScanQuality = typeof SCAN_QUALITIES[number]

export const SCAN_GRADE_QUESTIONS: { quality: Extract<DecisionQuestion, { type: 'choice' }> } = {
    quality: {
        type: 'choice',
        instructions: 'Given the pre-computed market facts in state, how good a candidate is this stock for selling cash-secured puts (and being assigned) over the next 30–45 days?',
        criteria: {
            strong: 'Would be glad to own it at the strike: trend, balance sheet and valuation support it',
            decent: 'Acceptable, with one clear caveat',
            mixed: 'The facts conflict or are too thin to call',
            weak: 'Poor fit: broken trend, weak balance sheet, red risk score or stretched valuation with no cushion'
        }
    }
}

export interface ScanGrade {
    quality: ScanQuality
    /** Calibrated confidence in the choice (0–1). */
    confidence: number | null
}

const GRADE_CONCURRENCY = 4

export function scanGradeCacheKey(ticker: string, asOf: string): string {
    return `${ticker.toUpperCase()}|${asOf}`
}

export const isScanQuality = (value: unknown): value is ScanQuality =>
    typeof value === 'string' && (SCAN_QUALITIES as readonly string[]).includes(value)

export function toScanGrade(result: DecisionResult<'quality'>): ScanGrade | null {
    const answer = result.answers.quality
    if (answer.type !== 'choice' || !isScanQuality(answer.choice)) return null
    const confidence = result.calibrated && answer.confidence !== null ? Math.round(answer.confidence * 100) / 100 : null
    return { quality: answer.choice, confidence }
}

export interface GradeHost extends DecisionContext {
    scanGradeCache: Map<string, ScanGrade>
}

export function isJevAvailable(this: GradeHost): boolean {
    return currentDecisionEngine(this) === 'jev'
}

/**
 * Grades every ticker that has market facts and no grade today. `states` maps ticker → the facts
 * JEV judges (market facts only, never the trader's inputs). Returns the number graded now.
 */
export async function gradeWatchlist(
    this: GradeHost,
    states: Map<string, Record<string, unknown>>,
    asOf: string,
    options: { signal?: AbortSignal; onProgress?: (done: number, total: number) => void } = {}
): Promise<number> {
    if (!isJevAvailable.call(this)) return 0
    const queue = [...states.entries()].filter(([ticker]) => !this.scanGradeCache.has(scanGradeCacheKey(ticker, asOf)))
    const total = queue.length
    let done = 0
    let graded = 0
    options.onProgress?.(done, total)
    const worker = async () => {
        while (queue.length && !options.signal?.aborted && isJevAvailable.call(this)) {
            const next = queue.shift()
            if (!next) return
            const [ticker, state] = next
            try {
                const result = await decideWithFallback(this, { state, questions: SCAN_GRADE_QUESTIONS, signal: options.signal }, { jevOnly: true })
                const grade = result ? toScanGrade(result) : null
                if (grade) {
                    this.scanGradeCache.set(scanGradeCacheKey(ticker, asOf), grade)
                    graded += 1
                }
            } catch (error) {
                console.warn(`JEV pre-grade failed for ${ticker}:`, error)
            }
            done += 1
            options.onProgress?.(done, total)
        }
    }
    await Promise.all(Array.from({ length: Math.min(GRADE_CONCURRENCY, total) }, worker))
    return graded
}
