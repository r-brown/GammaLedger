// src/calculations/payoff.ts — P&L at expiration for a set of net open legs.
// Piecewise-linear: exact kink evaluation at strikes, exact breakevens.
// Unbounded max profit/loss is expressed as null — never Infinity (project rule).

import type { NetOpenLeg } from './net-open-legs.js'

export interface PayoffResult {
  /** [underlyingPrice, pl] samples for charting, ascending price. */
  points: Array<[number, number]>
  breakevens: number[]
  /** null = unbounded (net long calls / stock upside). */
  maxProfit: number | null
  /** null = unbounded (net short calls). Losses are negative numbers. */
  maxLoss: number | null
}

function plAt(legs: NetOpenLeg[], price: number): number {
    let total = 0
    for (const leg of legs) {
        const qty = leg.netQuantity * leg.multiplier
        if (leg.type === 'STOCK') {
            total += qty * (price - leg.avgOpenPremium)
        } else if (leg.strike !== null) {
            const intrinsic = leg.type === 'CALL'
                ? Math.max(0, price - leg.strike)
                : Math.max(0, leg.strike - price)
            total += qty * (intrinsic - leg.avgOpenPremium)
        }
    }
    return total
}

/** dP&L/dS as S → ∞: calls + stock contribute, puts flatten out. */
function slopeRight(legs: NetOpenLeg[]): number {
    let slope = 0
    for (const leg of legs) {
        if (leg.type === 'CALL' || leg.type === 'STOCK') {
            slope += leg.netQuantity * leg.multiplier
        }
    }
    return slope
}

const EPSILON = 1e-6

export function computePayoff(
    legs: NetOpenLeg[],
    opts: { spot?: number | null } = {}
): PayoffResult | null {
    const active = legs.filter(leg => leg.netQuantity !== 0
        && (leg.type === 'STOCK' || leg.strike !== null))
    if (!active.length) return null

    const strikes = [...new Set(active
        .filter(leg => leg.type !== 'STOCK')
        .map(leg => leg.strike as number))].sort((a, b) => a - b)

    const refs = strikes.slice()
    if (typeof opts.spot === 'number' && opts.spot > 0) refs.push(opts.spot)
    for (const leg of active) {
        if (leg.type === 'STOCK' && leg.avgOpenPremium > 0) refs.push(leg.avgOpenPremium)
    }
    if (!refs.length) return null

    // Kinks: exact P&L is linear between adjacent entries of [0, ...strikes]
    // and on the right tail beyond the last strike.
    const hi = Math.max(...refs) * 1.3
    const lo = Math.max(0, Math.min(...refs) * 0.7)
    const kinks = [0, ...strikes]
    const rightSlope = slopeRight(active)

    // Extremes over S >= 0: evaluate every kink; the right tail adds
    // unboundedness when its slope is non-zero.
    const kinkValues = kinks.map(k => plAt(active, k))
    let maxProfit: number | null = Math.max(...kinkValues)
    let maxLoss: number | null = Math.min(...kinkValues)
    if (rightSlope > 0) maxProfit = null
    if (rightSlope < 0) maxLoss = null

    // Breakevens: zero crossings on each linear segment, plus the right tail.
    const breakevens: number[] = []
    const nodes = [...kinks].sort((a, b) => a - b)
    for (let i = 0; i < nodes.length - 1; i++) {
        const a = nodes[i], b = nodes[i + 1]
        if (b - a < EPSILON) continue
        const fa = plAt(active, a), fb = plAt(active, b)
        if (Math.abs(fa) < EPSILON) breakevens.push(a)
        if ((fa < 0 && fb > 0) || (fa > 0 && fb < 0)) {
            breakevens.push(a + (-fa) * (b - a) / (fb - fa))
        }
    }
    const lastKink = nodes[nodes.length - 1]
    const fLast = plAt(active, lastKink)
    if (Math.abs(fLast) < EPSILON) {
        breakevens.push(lastKink)
    } else if (rightSlope !== 0 && Math.sign(fLast) !== Math.sign(rightSlope)) {
        breakevens.push(lastKink - fLast / rightSlope)
    }
    const uniqueBreakevens = [...new Set(breakevens.map(b => Math.round(b * 100) / 100))]
        .filter(b => b >= 0)
        .sort((a, b) => a - b)

    // Chart samples: even grid plus exact kinks and breakevens.
    const sampleSet = new Set<number>()
    const steps = 120
    for (let i = 0; i <= steps; i++) sampleSet.add(lo + ((hi - lo) * i) / steps)
    strikes.forEach(s => { if (s >= lo && s <= hi) sampleSet.add(s) })
    uniqueBreakevens.forEach(b => { if (b >= lo && b <= hi) sampleSet.add(b) })
    const points: Array<[number, number]> = [...sampleSet]
        .sort((a, b) => a - b)
        .map(price => [Math.round(price * 100) / 100, Math.round(plAt(active, price) * 100) / 100])

    return {
        points,
        breakevens: uniqueBreakevens,
        maxProfit: maxProfit === null ? null : Math.round(maxProfit * 100) / 100,
        maxLoss: maxLoss === null ? null : Math.round(maxLoss * 100) / 100
    }
}
