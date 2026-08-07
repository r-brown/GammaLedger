// src/calculations/black-scholes.ts — rough Black-Scholes greeks for the
// portfolio strip. Dependency-free / unit-testable with tsx. Estimates only:
// no live IV feed exists, so sigma defaults to a flat 30%.

export const DEFAULT_SIGMA = 0.30
export const DEFAULT_RISK_FREE_RATE = 0.04

export interface BSInput {
  spot: number
  strike: number
  dteDays: number
  type: 'CALL' | 'PUT'
  sigma?: number
  riskFreeRate?: number
}

export interface BSGreeks {
  /** Per-share delta: call 0..1, put -1..0. */
  delta: number
  /** Per-share theta per calendar day (negative for long options). */
  thetaPerDay: number
  /** Per-share price change for a 1-point (0.01) move in sigma. */
  vega: number
}

/** Abramowitz & Stegun 7.1.26 erf approximation — |error| < 1.5e-7. */
function erf(x: number): number {
    const sign = x < 0 ? -1 : 1
    const ax = Math.abs(x)
    const t = 1 / (1 + 0.3275911 * ax)
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-ax * ax)
    return sign * y
}

function normCdf(x: number): number {
    return 0.5 * (1 + erf(x / Math.SQRT2))
}

function normPdf(x: number): number {
    return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI)
}

export function blackScholesGreeks(input: BSInput): BSGreeks {
    const { spot, strike, type } = input
    const sigma = input.sigma ?? DEFAULT_SIGMA
    const r = input.riskFreeRate ?? DEFAULT_RISK_FREE_RATE

    if (!(spot > 0) || !(strike > 0) || !(sigma > 0)) {
        return { delta: 0, thetaPerDay: 0, vega: 0 }
    }

    // Expired or same-day: intrinsic behaviour, no time value left.
    if (input.dteDays <= 0) {
        const itm = type === 'CALL' ? spot > strike : spot < strike
        return { delta: itm ? (type === 'CALL' ? 1 : -1) : 0, thetaPerDay: 0, vega: 0 }
    }

    const T = input.dteDays / 365
    const sqrtT = Math.sqrt(T)
    const d1 = (Math.log(spot / strike) + (r + (sigma * sigma) / 2) * T) / (sigma * sqrtT)
    const d2 = d1 - sigma * sqrtT

    const delta = type === 'CALL' ? normCdf(d1) : normCdf(d1) - 1
    const vega = (spot * normPdf(d1) * sqrtT) / 100

    const decay = -(spot * normPdf(d1) * sigma) / (2 * sqrtT)
    const carry = r * strike * Math.exp(-r * T)
    const thetaPerYear = type === 'CALL'
        ? decay - carry * normCdf(d2)
        : decay + carry * normCdf(-d2)

    return { delta, thetaPerDay: thetaPerYear / 365, vega }
}
