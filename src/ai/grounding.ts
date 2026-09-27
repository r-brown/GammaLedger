// src/ai/grounding.ts — deterministic check that the numbers a Coach answer states exist in the
// snapshot it was generated from. No model call (JEV can't do arithmetic; an LLM would grade itself).

import type { GroundingResult } from '../types/ai.js'
import { splitChartBlocks } from './chart-blocks.js'

export interface NumericClaim {
    raw: string
    value: number
    unit: '$' | '%' | 'dte' | 'chart'
    /** Digits after the decimal point as written (drives the tolerance). */
    decimals: number
    /** Multiplier applied for k/M suffixes (1 when none). */
    scale: number
    sentence: string
}

const MONEY = /([+\-−]?)\$\s?((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?)\s?([kKmM])?(?![\w])/g
const PERCENT = /([+\-−]?)(\d+(?:\.(\d+))?)\s?%/g
const DTE = /\b(\d+)\s?DTE\b/g
const FENCED = /```[\s\S]*?```/g

/** The sentence containing `index`. Boundaries are ". ", "! ", "? " or a newline, so decimals like 9,311.55 don't split it. */
function sentenceAround(text: string, index: number): string {
    const before = text.slice(0, index)
    const start = Math.max(before.lastIndexOf('. '), before.lastIndexOf('! '), before.lastIndexOf('? '), before.lastIndexOf('\n')) + 1
    const rest = text.slice(index)
    const offset = rest.search(/[.!?](?:\s|$)|\n/)
    const end = offset === -1 ? text.length : index + offset + 1
    return text.slice(start, end).trim().slice(0, 200)
}

export function extractClaims(answer: string): NumericClaim[] {
    const claims: Array<NumericClaim & { at: number }> = []
    const prose = answer.replace(FENCED, block => ' '.repeat(block.length))
    for (const m of prose.matchAll(MONEY)) {
        const scale = m[4] ? (m[4].toLowerCase() === 'k' ? 1_000 : 1_000_000) : 1
        claims.push({ at: m.index ?? 0, raw: m[0].trim(), value: Number(m[2].replace(/,/g, '')) * scale, unit: '$', decimals: m[3]?.length ?? 0, scale, sentence: sentenceAround(prose, m.index ?? 0) })
    }
    for (const m of prose.matchAll(PERCENT)) {
        claims.push({ at: m.index ?? 0, raw: m[0].trim(), value: Number(m[2]), unit: '%', decimals: m[3]?.length ?? 0, scale: 1, sentence: sentenceAround(prose, m.index ?? 0) })
    }
    for (const m of prose.matchAll(DTE)) {
        claims.push({ at: m.index ?? 0, raw: m[0].trim(), value: Number(m[1]), unit: 'dte', decimals: 0, scale: 1, sentence: sentenceAround(prose, m.index ?? 0) })
    }
    claims.sort((a, b) => a.at - b.at)
    const out: NumericClaim[] = claims.map(({ at: _at, ...claim }) => claim)
    for (const segment of splitChartBlocks(answer)) {
        if (segment.kind !== 'chart') continue
        for (const value of segment.spec.values) {
            const decimals = (String(value).split('.')[1] ?? '').length
            out.push({ raw: String(value), value, unit: 'chart', decimals, scale: 1, sentence: segment.spec.title })
        }
    }
    return out
}

export function collectSnapshotNumbers(snapshotJson: string): number[] {
    const numbers: number[] = []
    const visit = (value: unknown): void => {
        if (typeof value === 'number' && Number.isFinite(value)) numbers.push(value)
        else if (typeof value === 'string') for (const m of value.matchAll(/-?\d+(?:\.\d+)?/g)) numbers.push(Number(m[0]))
        else if (Array.isArray(value)) value.forEach(visit)
        else if (value && typeof value === 'object') Object.values(value).forEach(visit)
    }
    try { visit(JSON.parse(snapshotJson)) } catch { /* unreadable snapshot → nothing matches */ }
    return numbers
}

function matches(claim: NumericClaim, candidate: number): boolean {
    const v = Math.abs(claim.value)
    const n = Math.abs(candidate)
    const written = 0.5 * 10 ** -claim.decimals * claim.scale
    if (claim.unit === 'dte') return Number.isInteger(candidate) && v === n
    if (claim.unit === '$') return Math.abs(v - n) <= Math.max(1, 0.005 * n, written)
    const tolerance = Math.max(0.15, written)
    return Math.abs(v - n) <= tolerance || Math.abs(v - n * 100) <= tolerance
}

export function groundClaims(claims: NumericClaim[], snapshotNumbers: number[]): GroundingResult {
    const unmatched = claims.filter(claim => !snapshotNumbers.some(n => matches(claim, n)))
    return {
        checked: claims.length,
        matched: claims.length - unmatched.length,
        unmatched: unmatched.map(c => ({ raw: c.raw, sentence: c.sentence }))
    }
}

export function groundAnswer(answer: string, snapshotJson: string): GroundingResult {
    return groundClaims(extractClaims(answer), collectSnapshotNumbers(snapshotJson))
}
