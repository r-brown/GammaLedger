// src/calculations/stock-scores.ts — the four position-detail score grades (Risk, Own?, Balance
// Sheet, Cheap?). Pure functions of StockMetrics; shared by the panel and the AI fact builders.

import type { StockMetrics } from '../types/integrations.js'

function fmtPct(v: number | null, showSign = false): string {
  if (v === null) return '—'
  const sign = showSign && v > 0 ? '+' : ''
  return `${sign}${v.toLocaleString('en-US', { maximumFractionDigits: 1 })}%`
}


export type RiskTrafficLight = 'green' | 'yellow' | 'red'
export type ConvictionGrade = 'safe' | 'caution' | 'avoid'
export type HealthGrade = 'healthy' | 'ok' | 'weak'
export type ValuationGrade = 'cheap' | 'fair' | 'expensive'

/** Pre-trade Risk Score: combines beta + realized vol + short-term momentum into 🔴/🟡/🟢. */
export function computePreTradeRiskScore(m: StockMetrics): { grade: RiskTrafficLight; detail: string } {
  const beta = m.beta ?? 0
  const hv30 = m.vol3MonthStd ?? 0
  const r5d = m.return5Day ?? 0
  const r52w = m.return52Week ?? 0
  const detail = [
    m.beta !== null ? `β${m.beta.toFixed(1)}` : null,
    m.vol3MonthStd !== null ? `HV${m.vol3MonthStd.toFixed(0)}%` : null,
    m.return5Day !== null ? `5D ${fmtPct(m.return5Day, true)}` : null,
  ].filter(Boolean).join(' · ')
  if (beta > 1.5 || hv30 > 50 || (r5d < -5 && r52w < -15)) return { grade: 'red', detail }
  if (beta > 1.2 || hv30 > 30 || r5d < -3) return { grade: 'yellow', detail }
  return { grade: 'green', detail }
}

/**
 * Assignment Conviction Score (Wheel): "Would I want to own this at this strike?"
 * Combines forwardPE + pfcfTTM + currentRatio + debtToEquity + roeTTM → Safe/Caution/Avoid.
 */
export function computeAssignmentConvictionScore(m: StockMetrics): { grade: ConvictionGrade; detail: string } {
  let score = 0
  let count = 0
  if (m.forwardPE !== null && m.forwardPE > 0) {
    score += m.forwardPE < 15 ? 25 : m.forwardPE < 25 ? 15 : 5
    count++
  }
  if (m.pfcfTTM !== null && m.pfcfTTM > 0) {
    score += m.pfcfTTM < 15 ? 25 : m.pfcfTTM < 25 ? 15 : 5
    count++
  }
  if (m.currentRatio !== null) {
    score += m.currentRatio >= 2 ? 25 : m.currentRatio >= 1.5 ? 20 : m.currentRatio >= 1 ? 10 : 0
    count++
  }
  if (m.debtToEquity !== null) {
    score += m.debtToEquity < 0.5 ? 25 : m.debtToEquity < 1 ? 18 : m.debtToEquity < 2 ? 10 : 2
    count++
  }
  if (m.roeTTM !== null) {
    score += m.roeTTM > 20 ? 25 : m.roeTTM > 10 ? 18 : m.roeTTM > 0 ? 10 : 0
    count++
  }
  const detail = [
    m.forwardPE !== null ? `P/E ${m.forwardPE.toFixed(0)}×` : null,
    m.currentRatio !== null ? `CR ${m.currentRatio.toFixed(1)}` : null,
    m.roeTTM !== null ? `ROE ${m.roeTTM.toFixed(0)}%` : null,
  ].filter(Boolean).join(' · ')
  if (count === 0) return { grade: 'caution', detail: '—' }
  const normalized = score / count
  if (normalized >= 18) return { grade: 'safe', detail }
  if (normalized >= 11) return { grade: 'caution', detail }
  return { grade: 'avoid', detail }
}

export function computeBalanceSheetScore(m: StockMetrics): { grade: HealthGrade; detail: string } {
  const cr = m.currentRatio
  const de = m.debtToEquity
  const ic = m.interestCoverage
  if (cr === null && de === null) return { grade: 'ok', detail: '—' }
  const weak = (cr !== null && cr < 1.0) || (de !== null && de > 2.0)
  const healthy = (cr === null || cr >= 1.5) && (de === null || de < 0.5) && (ic === null || ic > 5)
  const detail = [
    cr !== null ? `CR ${cr.toFixed(1)}` : null,
    de !== null ? `D/E ${de.toFixed(1)}` : null,
    ic !== null ? `IC ${ic.toFixed(0)}×` : null,
  ].filter(Boolean).join(' · ')
  if (weak) return { grade: 'weak', detail }
  if (healthy) return { grade: 'healthy', detail }
  return { grade: 'ok', detail }
}

export function computeValuationScore(m: StockMetrics): { grade: ValuationGrade; detail: string } {
  const series = m.peAnnualSeries
  const currentPE = m.peTTM
  if (series.length >= 4 && currentPE !== null && currentPE > 0) {
    const vals = series.map(s => s.v).filter(v => v > 0).sort((a, b) => a - b)
    if (vals.length >= 4) {
      const rank = vals.filter(v => v <= currentPE).length
      const pct = rank / vals.length
      const pctLabel = `${Math.round(pct * 100)}th %ile`
      const detail = `PE ${currentPE.toFixed(0)}× · ${pctLabel}`
      if (pct <= 0.25) return { grade: 'cheap', detail }
      if (pct >= 0.75) return { grade: 'expensive', detail }
      return { grade: 'fair', detail }
    }
  }
  const fpe = m.forwardPE
  if (fpe === null || fpe <= 0) return { grade: 'fair', detail: '—' }
  const detail = `Fwd P/E ${fpe.toFixed(0)}×`
  if (fpe < 13) return { grade: 'cheap', detail }
  if (fpe > 25) return { grade: 'expensive', detail }
  return { grade: 'fair', detail }
}
