import type { StockMetrics, SignalsData, CompanyProfile, EarningsSurprise } from '../../types/integrations.js'

// ---------------------------------------------------------------------------
// Context interface — structural typing over GammaLedger instance
// ---------------------------------------------------------------------------

export interface PositionDetailPanelContext {
  metricsCache: Map<string, StockMetrics | 'loading' | 'error'>
  signalsCache: Map<string, SignalsData | 'loading' | 'error'>
  profileCache: Map<string, CompanyProfile | 'loading' | 'error'>
  earningsCache: Map<string, EarningsSurprise[] | 'loading' | 'error'>
  metricsPromiseMap: Map<string, Promise<StockMetrics | null>>
  signalsPromiseMap: Map<string, Promise<SignalsData | null>>
  profilePromiseMap: Map<string, Promise<CompanyProfile | null>>
  earningsPromiseMap: Map<string, Promise<EarningsSurprise[] | null>>
  fetchSignalsData(ticker: string): Promise<SignalsData | null>
  fetchStockMetrics(ticker: string): Promise<StockMetrics | null>
  fetchCompanyProfile(ticker: string): Promise<CompanyProfile | null>
  fetchEarningsSurprise(ticker: string): Promise<EarningsSurprise[] | null>
  finnhub: { apiKey: string | null; cache: Map<string, { c?: number }> }
  formatCurrency(v: unknown): string
  formatDate(v: unknown): string
  formatNumber(v: unknown, opts?: { decimals?: number }): string | null
}

// ---------------------------------------------------------------------------
// Row data helper — inserts synthetic detail row below the expanded trade
// ---------------------------------------------------------------------------

export function buildRowsWithDetail(
  trades: Record<string, unknown>[],
  expandedId: string | null
): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = []
  for (const trade of trades) {
    rows.push(trade)
    if (expandedId !== null && trade.id === expandedId) {
      rows.push({ _isDetailRow: true, _parentTrade: trade })
    }
  }
  return rows
}

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------

function el(tag: string, className?: string): HTMLElement {
  const e = document.createElement(tag)
  if (className) e.className = className
  return e
}

function txt(text: string): Text {
  return document.createTextNode(text)
}

function fmtPct(v: number | null, showSign = false): string {
  if (v === null) return '—'
  const sign = showSign && v > 0 ? '+' : ''
  return `${sign}${v.toLocaleString('en-US', { maximumFractionDigits: 1 })}%`
}

function fmtCap(millions: number | null): string {
  if (millions === null) return '—'
  if (millions >= 1000) return `$${(millions / 1000).toFixed(1)}B`
  return `$${millions.toFixed(0)}M`
}

function fmtRelTime(unixSec: number): string {
  const diffMs = Date.now() - unixSec * 1000
  const days = Math.floor(diffMs / 86_400_000)
  if (days === 0) return 'today'
  if (days === 1) return '1d ago'
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

function makeKV(label: string, value: string, pos = false, neg = false): HTMLElement {
  const wrap = el('div', 'pdp-kv')
  const l = el('div', 'pdp-kv-label')
  l.appendChild(txt(label))
  const v = el('div', `pdp-kv-value${pos ? ' pdp-kv-value--pos' : neg ? ' pdp-kv-value--neg' : ''}`)
  v.appendChild(txt(value))
  wrap.appendChild(l)
  wrap.appendChild(v)
  return wrap
}

function buildSparklineSVG(dataPoints: number[]): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(ns, 'svg') as SVGSVGElement
  svg.setAttribute('viewBox', '0 0 120 20')
  svg.setAttribute('preserveAspectRatio', 'none')
  svg.style.cssText = 'width:100%;height:20px;display:block'
  const pts = dataPoints.slice(-10)
  if (pts.length < 2) return svg
  const minV = Math.min(...pts)
  const maxV = Math.max(...pts)
  const range = maxV - minV || 1
  const pad = 2
  const coords = pts.map((v, i) => {
    const x = (i / (pts.length - 1)) * 120
    const y = 20 - pad - ((v - minV) / range) * (20 - 2 * pad)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const polyline = document.createElementNS(ns, 'polyline')
  polyline.setAttribute('points', coords)
  polyline.setAttribute('fill', 'none')
  polyline.setAttribute('stroke', 'rgba(33,128,141,0.7)')
  polyline.setAttribute('stroke-width', '1.5')
  polyline.setAttribute('stroke-linejoin', 'round')
  svg.appendChild(polyline)
  return svg
}

// ---------------------------------------------------------------------------
// Score computation — pure functions, no DOM access
// ---------------------------------------------------------------------------

type RiskTrafficLight = 'green' | 'yellow' | 'red'
type ConvictionGrade = 'safe' | 'caution' | 'avoid'
type HealthGrade = 'healthy' | 'ok' | 'weak'
type ValuationGrade = 'cheap' | 'fair' | 'expensive'

/** Pre-trade Risk Score: combines beta + realized vol + short-term momentum into 🔴/🟡/🟢. */
function computePreTradeRiskScore(m: StockMetrics): { grade: RiskTrafficLight; detail: string } {
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
function computeAssignmentConvictionScore(m: StockMetrics): { grade: ConvictionGrade; detail: string } {
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

function computeBalanceSheetScore(m: StockMetrics): { grade: HealthGrade; detail: string } {
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

function computeValuationScore(m: StockMetrics): { grade: ValuationGrade; detail: string } {
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

// ---------------------------------------------------------------------------
// Earnings dot-plot SVG (actual ● vs estimate ○ per quarter)
// ---------------------------------------------------------------------------

function buildEarningsDotPlot(earnings: EarningsSurprise[]): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg'
  const N = earnings.length
  const W = Math.max(240, N * 68)
  const H = 118
  const chartTop = 8
  const chartBottom = 75
  const chartH = chartBottom - chartTop

  // Y scale — all actual + estimate values
  const allVals: number[] = []
  for (const q of earnings) {
    if (q.actual !== null) allVals.push(q.actual)
    if (q.estimate !== null) allVals.push(q.estimate)
  }
  if (allVals.length === 0) allVals.push(0, 1)
  let yMin = Math.min(...allVals)
  let yMax = Math.max(...allVals)
  const yRange = yMax - yMin || Math.abs(yMax) * 0.4 || 1
  yMin -= yRange * 0.28
  yMax += yRange * 0.28

  function yPos(val: number): number {
    return chartBottom - ((val - yMin) / (yMax - yMin)) * chartH
  }

  function xPos(i: number): number {
    return N === 1 ? W / 2 : 34 + (i / (N - 1)) * (W - 68)
  }

  const svg = document.createElementNS(ns, 'svg') as SVGSVGElement
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`)
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet')
  svg.style.cssText = 'width:100%;height:auto;display:block;overflow:visible'

  // Subtle horizontal grid lines
  for (let gi = 0; gi <= 3; gi++) {
    const gy = chartTop + (gi / 3) * chartH
    const line = document.createElementNS(ns, 'line')
    line.setAttribute('x1', '10')
    line.setAttribute('x2', String(W - 10))
    line.setAttribute('y1', gy.toFixed(1))
    line.setAttribute('y2', gy.toFixed(1))
    line.style.stroke = 'var(--color-border, #e2e8f0)'
    line.setAttribute('stroke-width', '0.8')
    svg.appendChild(line)
  }

  for (let i = 0; i < N; i++) {
    const q = earnings[i]
    const x = xPos(i)
    const isBeat = q.surprisePercent !== null && q.surprisePercent >= 0
    const fillColor  = isBeat ? '#16a34a' : '#dc2626'
    const labelColor = isBeat ? '#16a34a' : '#dc2626'

    // Dashed connector between estimate and actual
    if (q.actual !== null && q.estimate !== null) {
      const yA = yPos(q.actual)
      const yE = yPos(q.estimate)
      const conn = document.createElementNS(ns, 'line')
      conn.setAttribute('x1', x.toFixed(1))
      conn.setAttribute('x2', x.toFixed(1))
      conn.setAttribute('y1', Math.min(yA, yE).toFixed(1))
      conn.setAttribute('y2', Math.max(yA, yE).toFixed(1))
      conn.setAttribute('stroke', fillColor)
      conn.setAttribute('stroke-width', '1.5')
      conn.setAttribute('stroke-dasharray', '3,2')
      conn.setAttribute('opacity', '0.45')
      svg.appendChild(conn)
    }

    // Estimate — hollow circle (draw first so actual renders on top)
    if (q.estimate !== null) {
      const yE = yPos(q.estimate)
      const circ = document.createElementNS(ns, 'circle')
      circ.setAttribute('cx', x.toFixed(1))
      circ.setAttribute('cy', yE.toFixed(1))
      circ.setAttribute('r', '4.9')
      circ.style.fill = 'var(--color-surface, #fff)'
      circ.setAttribute('stroke', '#94a3b8')
      circ.setAttribute('stroke-width', '1.5')
      svg.appendChild(circ)
    }

    // Actual — filled circle
    if (q.actual !== null) {
      const yA = yPos(q.actual)
      const circ = document.createElementNS(ns, 'circle')
      circ.setAttribute('cx', x.toFixed(1))
      circ.setAttribute('cy', yA.toFixed(1))
      circ.setAttribute('r', '5.25')
      circ.setAttribute('fill', fillColor)
      svg.appendChild(circ)
    }

    // Quarter label  e.g. "Q1'25"
    const periodLbl = document.createElementNS(ns, 'text')
    periodLbl.setAttribute('x', x.toFixed(1))
    periodLbl.setAttribute('y', String(chartBottom + 14))
    periodLbl.setAttribute('text-anchor', 'middle')
    periodLbl.setAttribute('font-size', '7.5')
    periodLbl.style.fill = 'var(--color-text-secondary, #64748b)'
    periodLbl.textContent = `Q${q.quarter}'${String(q.year).slice(-2)}`
    svg.appendChild(periodLbl)

    // Beat / Miss label
    if (q.surprisePercent !== null) {
      const bmLbl = document.createElementNS(ns, 'text')
      bmLbl.setAttribute('x', x.toFixed(1))
      bmLbl.setAttribute('y', String(chartBottom + 25))
      bmLbl.setAttribute('text-anchor', 'middle')
      bmLbl.setAttribute('font-size', '7')
      bmLbl.setAttribute('font-weight', 'bold')
      bmLbl.setAttribute('fill', labelColor)
      bmLbl.textContent = isBeat ? 'Beat' : 'Miss'
      svg.appendChild(bmLbl)

      // Dollar difference below beat/miss
      if (q.actual !== null && q.estimate !== null) {
        const diff = q.actual - q.estimate
        const sign = diff >= 0 ? '+' : ''
        const diffLbl = document.createElementNS(ns, 'text')
        diffLbl.setAttribute('x', x.toFixed(1))
        diffLbl.setAttribute('y', String(chartBottom + 35))
        diffLbl.setAttribute('text-anchor', 'middle')
        diffLbl.setAttribute('font-size', '6.5')
        diffLbl.setAttribute('fill', labelColor)
        diffLbl.textContent = `${sign}$${Math.abs(diff).toFixed(2)}`
        svg.appendChild(diffLbl)
      }
    }
  }

  return svg
}

// ---------------------------------------------------------------------------
// Score pill tooltip — reuses .formula-tooltip CSS (same as Wheel/PMCC tracker)
// ---------------------------------------------------------------------------

interface TooltipRow { label: string; value: string }

function attachScorePillTooltip(
  pill: HTMLElement,
  title: string,
  explanation: string,
  inputs: TooltipRow[],
  gradeRows: TooltipRow[]
): void {
  function d(tag: string, cls?: string): HTMLElement {
    const e = document.createElement(tag)
    if (cls) e.className = cls
    return e
  }

  const tooltip = d('div', 'formula-tooltip')
  tooltip.setAttribute('role', 'tooltip')

  const titleEl = d('div', 'formula-tooltip__title')
  titleEl.textContent = title
  tooltip.appendChild(titleEl)

  const expSec = d('div', 'formula-tooltip__section')
  const expEl = d('div', 'formula-tooltip__explanation')
  expEl.textContent = explanation
  expSec.appendChild(expEl)
  tooltip.appendChild(expSec)

  if (inputs.length > 0) {
    const inputSec = d('div', 'formula-tooltip__section')
    const inputLbl = d('div', 'formula-tooltip__label')
    inputLbl.textContent = 'Inputs'
    inputSec.appendChild(inputLbl)
    const vars = d('div', 'formula-tooltip__variables')
    for (const r of inputs) {
      const row = d('div', 'formula-tooltip__variable')
      const name = d('span', 'formula-tooltip__variable-name')
      name.textContent = r.label
      const val = d('span', 'formula-tooltip__variable-value')
      val.textContent = r.value
      row.appendChild(name)
      row.appendChild(val)
      vars.appendChild(row)
    }
    inputSec.appendChild(vars)
    tooltip.appendChild(inputSec)
  }

  if (gradeRows.length > 0) {
    const gradeSec = d('div', 'formula-tooltip__section')
    const gradeLbl = d('div', 'formula-tooltip__label')
    gradeLbl.textContent = 'Grade thresholds'
    gradeSec.appendChild(gradeLbl)
    const vars = d('div', 'formula-tooltip__variables')
    for (const r of gradeRows) {
      const row = d('div', 'formula-tooltip__variable')
      const name = d('span', 'formula-tooltip__variable-name')
      name.textContent = r.label
      const val = d('span', 'formula-tooltip__variable-value')
      val.textContent = r.value
      row.appendChild(name)
      row.appendChild(val)
      vars.appendChild(row)
    }
    gradeSec.appendChild(vars)
    tooltip.appendChild(gradeSec)
  }

  document.body.appendChild(tooltip)

  const show = (): void => {
    const rect = pill.getBoundingClientRect()
    const ttRect = tooltip.getBoundingClientRect()
    let top = rect.top - ttRect.height - 10
    if (top < 8) top = rect.bottom + 10
    let left = rect.left
    if (left + 420 > window.innerWidth - 8) left = window.innerWidth - 428
    if (left < 8) left = 8
    tooltip.style.top = `${top}px`
    tooltip.style.left = `${left}px`
    tooltip.classList.add('is-visible')
  }
  const hide = (): void => tooltip.classList.remove('is-visible')
  pill.style.cursor = 'help'
  pill.addEventListener('mouseenter', show)
  pill.addEventListener('mouseleave', hide)
}

// ---------------------------------------------------------------------------
// Panel skeleton — three-column DOM structure with loading placeholders
// ---------------------------------------------------------------------------

function buildPanelSkeleton(ticker: string, threeCol = false): HTMLElement {
  const panel = el('div', 'position-detail-panel')

  const header = el('div', 'pdp-header')
  const identity = el('div', 'pdp-header-identity')
  identity.dataset.role = 'identity'
  const tickerSpan = el('span', 'pdp-header-ticker')
  tickerSpan.appendChild(txt(ticker))
  identity.appendChild(tickerSpan)
  const scores = el('div', 'pdp-header-scores')
  scores.dataset.role = 'scores'
  header.appendChild(identity)
  header.appendChild(scores)

  const fundCol = el('div', 'pdp-fund-col')
  const fundCard = el('div', 'pdp-card')
  fundCard.dataset.role = 'fundamentals'
  const fundLoading = el('div', 'pdp-loading')
  fundLoading.appendChild(txt('Loading…'))
  fundCard.appendChild(fundLoading)
  fundCol.appendChild(fundCard)

  const sigCol = el('div', 'pdp-signals-col')
  const sigCard = el('div', 'pdp-card')
  sigCard.dataset.role = 'signals'
  const sigLoading = el('div', 'pdp-loading')
  sigLoading.appendChild(txt('Loading…'))
  sigCard.appendChild(sigLoading)
  sigCol.appendChild(sigCard)

  panel.appendChild(header)
  panel.appendChild(fundCol)
  panel.appendChild(sigCol)

  if (threeCol) {
    const newsCol = el('div', 'pdp-news-col')
    const newsCard = el('div', 'pdp-card')
    newsCard.dataset.role = 'news'
    const newsLoading = el('div', 'pdp-loading')
    newsLoading.appendChild(txt('Loading…'))
    newsCard.appendChild(newsLoading)
    newsCol.appendChild(newsCard)
    panel.appendChild(newsCol)
  }

  return panel
}

// ---------------------------------------------------------------------------
// Column renderers
// ---------------------------------------------------------------------------

function renderFundamentalsColumn(
  container: HTMLElement,
  metrics: StockMetrics,
  livePrice: number | null,
  activeStrike: number | null = null
): void {
  container.textContent = ''

  const header = el('div', 'pdp-section-header')
  header.appendChild(txt('Fundamentals'))
  container.appendChild(header)

  // ── § Price & Volatility ───────────────────────────────────
  const pvHead = el('div', 'pdp-sub-header')
  pvHead.appendChild(txt('Price & Volatility'))
  container.appendChild(pvHead)

  const price = livePrice ?? metrics.currentPrice
  if (metrics.week52High !== null && metrics.week52Low !== null) {
    const rng = metrics.week52High - metrics.week52Low
    if (price !== null) {
      const priceLabel = el('div', 'pdp-range-price-label')
      priceLabel.appendChild(txt(`$${price.toFixed(2)}`))
      container.appendChild(priceLabel)
    }
    const rangeRow = el('div', 'pdp-range-row')
    const lowLabel = el('span', 'pdp-range-label')
    lowLabel.appendChild(txt(`$${metrics.week52Low.toFixed(0)}`))
    const track = el('div', 'pdp-range-track')
    if (price !== null && rng > 0) {
      const pct = Math.min(100, Math.max(0, ((price - metrics.week52Low) / rng) * 100))
      const dot = el('div', 'pdp-range-dot')
      dot.style.left = `${pct}%`
      track.appendChild(dot)
    }
    if (activeStrike !== null && rng > 0) {
      const strikePct = ((activeStrike - metrics.week52Low) / rng) * 100
      if (strikePct >= -5 && strikePct <= 105) {
        const clampedPct = Math.min(100, Math.max(0, strikePct))
        const strikeMarker = el('div', 'pdp-range-strike')
        strikeMarker.style.left = `${clampedPct}%`
        strikeMarker.title = `Strike: $${activeStrike.toFixed(2)}`
        track.appendChild(strikeMarker)
      }
    }
    const highLabel = el('span', 'pdp-range-label')
    highLabel.appendChild(txt(`$${metrics.week52High.toFixed(0)}`))
    rangeRow.appendChild(lowLabel)
    rangeRow.appendChild(track)
    rangeRow.appendChild(highLabel)
    container.appendChild(rangeRow)
  }

  const pvGrid = el('div', 'pdp-kv-grid')
  pvGrid.appendChild(makeKV('Beta', metrics.beta !== null ? metrics.beta.toFixed(2) : '—'))
  pvGrid.appendChild(makeKV('HV30', metrics.vol3MonthStd !== null ? `${metrics.vol3MonthStd.toFixed(0)}%` : '—'))
  if (metrics.vol10DayAvg !== null && metrics.vol3MonthAvg !== null && metrics.vol3MonthAvg > 0) {
    const ratio = metrics.vol10DayAvg / metrics.vol3MonthAvg
    const cls = ratio > 1.3 ? ' pdp-kv-value--warn' : ratio < 0.7 ? ' pdp-kv-value--muted' : ''
    const wrap = el('div', 'pdp-kv')
    const l = el('div', 'pdp-kv-label'); l.appendChild(txt('Vol 10D/3M'))
    const v = el('div', `pdp-kv-value${cls}`); v.appendChild(txt(`${ratio.toFixed(2)}× avg`))
    wrap.appendChild(l); wrap.appendChild(v); pvGrid.appendChild(wrap)
  }
  if (metrics.priceRelToSP500_13W !== null) {
    const v = metrics.priceRelToSP500_13W
    pvGrid.appendChild(makeKV('vs SPX 13W', fmtPct(v, true), v > 0, v < 0))
  }
  container.appendChild(pvGrid)

  // ── § Valuation ────────────────────────────────────────────
  const valHead = el('div', 'pdp-sub-header')
  valHead.appendChild(txt('Valuation'))
  container.appendChild(valHead)

  const valGrid = el('div', 'pdp-kv-grid')
  valGrid.appendChild(makeKV('P/E TTM', metrics.peTTM !== null ? `${metrics.peTTM.toFixed(0)}×` : '—'))
  valGrid.appendChild(makeKV('Fwd P/E', metrics.forwardPE !== null ? `${metrics.forwardPE.toFixed(0)}×` : '—'))
  valGrid.appendChild(makeKV('P/FCF', metrics.pfcfTTM !== null ? `${metrics.pfcfTTM.toFixed(0)}×` : '—'))
  valGrid.appendChild(makeKV('EV/EBITDA', metrics.evEbitda !== null ? `${metrics.evEbitda.toFixed(0)}×` : '—'))
  valGrid.appendChild(makeKV('Mkt Cap', fmtCap(metrics.marketCap)))
  valGrid.appendChild(makeKV('ROE', fmtPct(metrics.roeTTM), (metrics.roeTTM ?? 0) > 0, false))
  container.appendChild(valGrid)

  // ── § Quality ──────────────────────────────────────────────
  const qualHead = el('div', 'pdp-sub-header')
  qualHead.appendChild(txt('Quality'))
  container.appendChild(qualHead)

  const qualGrid = el('div', 'pdp-kv-grid')
  qualGrid.appendChild(makeKV('Net Margin', fmtPct(metrics.netMarginTTM), (metrics.netMarginTTM ?? 0) > 0, (metrics.netMarginTTM ?? 0) < 0))
  qualGrid.appendChild(makeKV('Op Margin', fmtPct(metrics.operatingMarginTTM), (metrics.operatingMarginTTM ?? 0) > 0, (metrics.operatingMarginTTM ?? 0) < 0))
  qualGrid.appendChild(makeKV('Rev Growth', fmtPct(metrics.revenueGrowthYoY, true), (metrics.revenueGrowthYoY ?? 0) > 0, (metrics.revenueGrowthYoY ?? 0) < 0))
  qualGrid.appendChild(makeKV('EPS Growth', fmtPct(metrics.epsGrowthYoY, true), (metrics.epsGrowthYoY ?? 0) > 0, (metrics.epsGrowthYoY ?? 0) < 0))
  qualGrid.appendChild(makeKV('Curr Ratio', metrics.currentRatio !== null ? metrics.currentRatio.toFixed(1) : '—'))
  qualGrid.appendChild(makeKV('D/E', metrics.debtToEquity !== null ? metrics.debtToEquity.toFixed(1) : '—'))
  container.appendChild(qualGrid)

  // ── § Trend Sparklines ─────────────────────────────────────
  const hasSparklines = metrics.epsAnnual.length >= 2 || metrics.grossMarginSeries.length >= 2 || metrics.fcfPerShareSeries.length >= 2
  if (hasSparklines) {
    const spHead = el('div', 'pdp-sub-header')
    spHead.appendChild(txt('Trends (annual)'))
    container.appendChild(spHead)

    if (metrics.epsAnnual.length >= 2) {
      const spRow = el('div', 'pdp-sparkline-row')
      const spLabel = el('div', 'pdp-sparkline-label'); spLabel.appendChild(txt('EPS'))
      spRow.appendChild(spLabel)
      spRow.appendChild(buildSparklineSVG(metrics.epsAnnual.map(p => p.v)))
      container.appendChild(spRow)
    }
    if (metrics.grossMarginSeries.length >= 2) {
      const spRow = el('div', 'pdp-sparkline-row')
      const spLabel = el('div', 'pdp-sparkline-label'); spLabel.appendChild(txt('Gross Margin'))
      spRow.appendChild(spLabel)
      spRow.appendChild(buildSparklineSVG(metrics.grossMarginSeries.map(p => p.v)))
      container.appendChild(spRow)
    }
    if (metrics.fcfPerShareSeries.length >= 2) {
      const spRow = el('div', 'pdp-sparkline-row')
      const spLabel = el('div', 'pdp-sparkline-label'); spLabel.appendChild(txt('FCF/Share'))
      spRow.appendChild(spLabel)
      spRow.appendChild(buildSparklineSVG(metrics.fcfPerShareSeries.map(p => p.v)))
      container.appendChild(spRow)
    }
  }
}

function renderSignalsColumn(
  container: HTMLElement,
  signals: SignalsData,
  livePrice: number | null,
  earnings: EarningsSurprise[] | null = null,
  opts: { skipNews?: boolean; skipInsiders?: boolean } = {}
): void {
  container.textContent = ''

  const header = el('div', 'pdp-section-header')
  header.appendChild(txt('Signals'))
  container.appendChild(header)

  // ── Earnings block — built here, appended after analyst sentiment ─
  let earningsBlock: HTMLElement | null = null
  if (earnings && earnings.length > 0) {
    const beats = earnings.filter(q => (q.surprisePercent ?? 0) >= 0).length
    const validPcts = earnings.map(q => q.surprisePercent).filter((v): v is number => v !== null)
    const avgSurprise = validPcts.length > 0
      ? validPcts.reduce((a, b) => a + b, 0) / validPcts.length : null

    const block = el('div', 'pdp-earn-block')
    const headerRow = el('div', 'pdp-earn-header')
    const lbl = el('span', 'pdp-earn-title')
    lbl.appendChild(txt('📅 Earnings History'))
    headerRow.appendChild(lbl)
    const sumEl = el('span', 'pdp-earn-summary')
    const avgStr = avgSurprise !== null
      ? `avg ${avgSurprise >= 0 ? '+' : ''}${avgSurprise.toFixed(1)}%` : ''
    sumEl.appendChild(txt(`${beats} of ${earnings.length} beats${avgStr ? ' · ' + avgStr : ''}`))
    headerRow.appendChild(sumEl)
    block.appendChild(headerRow)
    block.appendChild(buildEarningsDotPlot(earnings))
    const legend = el('div', 'pdp-earn-legend')
    const actDot = el('span', 'pdp-earn-legend-dot pdp-earn-legend-dot--actual')
    legend.appendChild(actDot)
    legend.appendChild(txt('Actual'))
    const estDot = el('span', 'pdp-earn-legend-dot pdp-earn-legend-dot--estimate')
    legend.appendChild(estDot)
    legend.appendChild(txt('Estimate'))
    block.appendChild(legend)
    earningsBlock = block
  }

  function addSignalRow(icon: string, label: string, detail: string): void {
    const row = el('div', 'pdp-signal-row')
    const iconEl = el('span', 'pdp-signal-icon')
    iconEl.appendChild(txt(icon))
    const body = el('span')
    const labelEl = el('span', 'pdp-signal-label')
    labelEl.appendChild(txt(label))
    const detailEl = el('span', 'pdp-signal-detail')
    detailEl.appendChild(txt(detail))
    body.appendChild(labelEl)
    body.appendChild(detailEl)
    row.appendChild(iconEl)
    row.appendChild(body)
    container.appendChild(row)
  }

  // ── Analyst Sentiment ────────────────────────────────────────
  if (signals.recommendation) {
    const r = signals.recommendation
    const total = r.strongBuy + r.buy + r.hold + r.sell + r.strongSell || 1
    const weightedScore = (2 * r.strongBuy + r.buy - r.sell - 2 * r.strongSell) / total
    const sentimentLabel =
      weightedScore > 1.0  ? 'Strong Buy' :
      weightedScore > 0.4  ? 'Buy' :
      weightedScore > -0.4 ? 'Neutral' :
      weightedScore > -1.0 ? 'Sell' : 'Strong Sell'
    const sentimentCls =
      weightedScore > 0.4  ? 'pdp-sentiment--bull' :
      weightedScore < -0.4 ? 'pdp-sentiment--bear' : 'pdp-sentiment--neut'
    const bullishPct = Math.round(((r.strongBuy + r.buy) / total) * 100)

    const block = el('div', 'pdp-sentiment-block')
    const topRow = el('div', 'pdp-sentiment-top')
    const labelEl = el('span', `pdp-sentiment-label ${sentimentCls}`)
    labelEl.appendChild(txt(`📊 ${sentimentLabel.toUpperCase()}`))
    const metaEl = el('span', 'pdp-sentiment-meta')
    metaEl.appendChild(txt(`${total} analysts · ${bullishPct}% bullish`))
    topRow.appendChild(labelEl)
    topRow.appendChild(metaEl)
    block.appendChild(topRow)

    const bar = el('div', 'pdp-analyst-bar pdp-analyst-bar--tall')
    const segments: [string, number, string][] = [
      ['pdp-analyst-bar__sb', r.strongBuy, `Strong Buy: ${r.strongBuy}`],
      ['pdp-analyst-bar__b',  r.buy,       `Buy: ${r.buy}`],
      ['pdp-analyst-bar__h',  r.hold,      `Hold: ${r.hold}`],
      ['pdp-analyst-bar__s',  r.sell,      `Sell: ${r.sell}`],
      ['pdp-analyst-bar__ss', r.strongSell,`Strong Sell: ${r.strongSell}`],
    ]
    for (const [cls, count, title] of segments) {
      if (count > 0) {
        const seg = el('div', cls)
        seg.style.flex = String(count / total)
        seg.title = title
        bar.appendChild(seg)
      }
    }
    block.appendChild(bar)

    const countRow = el('div', 'pdp-sentiment-counts')
    countRow.appendChild(txt(
      `${r.strongBuy > 0 ? `SB:${r.strongBuy} ` : ''}B:${r.buy}  H:${r.hold}  S:${r.sell}${r.strongSell > 0 ? `  SS:${r.strongSell}` : ''}`
    ))
    block.appendChild(countRow)
    container.appendChild(block)
  } else {
    const block = el('div', 'pdp-sentiment-block')
    const labelEl = el('span', 'pdp-sentiment-label pdp-sentiment--neut')
    labelEl.appendChild(txt('📊 Analyst consensus'))
    const metaEl = el('span', 'pdp-sentiment-meta')
    metaEl.appendChild(txt('—'))
    const topRow = el('div', 'pdp-sentiment-top')
    topRow.appendChild(labelEl)
    topRow.appendChild(metaEl)
    block.appendChild(topRow)
    container.appendChild(block)
  }

  // Earnings history appears after analyst sentiment
  if (earningsBlock) container.appendChild(earningsBlock)

  // ── News (3 latest) ──────────────────────────────────────────
  if (!opts.skipNews) {
  const news3 = signals.news.slice(0, 3)
  const newsHeader = el('div', 'pdp-news-header')
  newsHeader.appendChild(txt('📰 Latest News'))
  container.appendChild(newsHeader)
  if (news3.length > 0) {
    for (const item of news3) {
      // Entire card is a link when URL is available
      const card = item.url
        ? (() => {
            const a = document.createElement('a')
            a.href = item.url
            a.target = '_blank'
            a.rel = 'noopener noreferrer'
            a.className = 'pdp-news-card'
            return a
          })()
        : el('div', 'pdp-news-card pdp-news-card--nolink')

      // Source + relative time
      const meta = el('div', 'pdp-news-meta')
      const srcEl = el('span', 'pdp-news-source')
      srcEl.appendChild(txt(item.source || 'News'))
      const timeEl = el('span', 'pdp-news-time')
      timeEl.appendChild(txt(fmtRelTime(item.datetime)))
      meta.appendChild(srcEl)
      meta.appendChild(timeEl)
      card.appendChild(meta)

      // Headline
      const hl = el('div', 'pdp-news-headline')
      hl.appendChild(txt(item.headline))
      card.appendChild(hl)

      // Summary (truncated)
      if (item.summary) {
        const smry = el('div', 'pdp-news-summary')
        smry.appendChild(txt(item.summary.length > 130 ? item.summary.slice(0, 127) + '…' : item.summary))
        card.appendChild(smry)
      }

      container.appendChild(card)
    }
  } else {
    const empty = el('div', 'pdp-news-empty')
    empty.appendChild(txt('No recent news'))
    container.appendChild(empty)
  }
  } // end !skipNews

  // ── Insider Activity ─────────────────────────────────────────
  if (!opts.skipInsiders) {
  const insiders = signals.insiderTransactions
  const insiderHeader = el('div', 'pdp-insider-header')
  insiderHeader.appendChild(txt('👤 Insider Activity'))
  container.appendChild(insiderHeader)

  if (insiders.length > 0) {
    // Classify: open-market (P/S) vs mechanical (awards, exercises, tax)
    const codeLabel: Record<string, string> = {
      P: 'Open Market Buy', S: 'Open Market Sale',
      A: 'Award/Grant', M: 'Exercise', F: 'Tax Withholding',
      D: 'Disposition', C: 'Conversion', W: 'Gift/Will', I: 'Discretionary',
    }
    const openMarket = insiders.filter(t => t.transactionCode === 'P' || t.transactionCode === 'S')
    const mechanical = insiders.filter(t => t.transactionCode !== 'P' && t.transactionCode !== 'S')

    // Summary — open-market buys/sells only (highest conviction)
    const omBuys = openMarket.filter(t => t.transactionCode === 'P')
    const omSells = openMarket.filter(t => t.transactionCode === 'S')
    const netValue = openMarket.reduce((sum, t) => {
      const sign = t.transactionCode === 'P' ? 1 : -1
      return sum + sign * (t.value ?? 0)
    }, 0)

    const summaryRow = el('div', 'pdp-insider-summary')
    if (openMarket.length > 0) {
      if (omBuys.length > 0) {
        const b = el('span', 'pdp-insider-buy')
        b.appendChild(txt(`${omBuys.length} open-mkt buy`))
        summaryRow.appendChild(b)
      }
      if (omBuys.length > 0 && omSells.length > 0) {
        const sep = el('span', 'pdp-insider-sep'); sep.appendChild(txt(' · '))
        summaryRow.appendChild(sep)
      }
      if (omSells.length > 0) {
        const s = el('span', 'pdp-insider-sell')
        s.appendChild(txt(`${omSells.length} open-mkt sell`))
        summaryRow.appendChild(s)
      }
      if (netValue !== 0) {
        const sep2 = el('span', 'pdp-insider-sep'); sep2.appendChild(txt(' · '))
        summaryRow.appendChild(sep2)
        const netEl = el('span', netValue > 0 ? 'pdp-insider-net-buy' : 'pdp-insider-net-sell')
        const absM = Math.abs(netValue) / 1_000_000
        netEl.appendChild(txt(`Net ${netValue > 0 ? '+' : '−'}${absM >= 0.1 ? `$${absM.toFixed(1)}M` : `$${Math.round(Math.abs(netValue) / 1000)}K`}`))
        summaryRow.appendChild(netEl)
      }
    } else {
      const mech = el('span', 'pdp-insider-muted')
      mech.appendChild(txt(`${insiders.length} mechanical transactions (awards/exercises)`))
      summaryRow.appendChild(mech)
    }
    container.appendChild(summaryRow)

    // Individual rows — open-market first (up to 3), then mechanical (up to 2)
    const toShow = [
      ...openMarket.slice(0, 3),
      ...mechanical.slice(0, Math.max(0, 4 - openMarket.slice(0, 3).length)),
    ].slice(0, 4)

    for (const t of toShow) {
      const isBuy = t.transactionCode === 'P' || (t.transactionCode === null && t.transactionType === 'Buy')
      const isMech = t.transactionCode !== 'P' && t.transactionCode !== 'S'
      const row = el('div', 'pdp-insider-row')

      const dot = el('span',
        isMech ? 'pdp-insider-dot pdp-insider-dot--mech' :
        isBuy  ? 'pdp-insider-dot pdp-insider-dot--buy' :
                 'pdp-insider-dot pdp-insider-dot--sell')
      row.appendChild(dot)

      const nameEl = el('span', 'pdp-insider-name')
      const parts = t.name.trim().split(/\s+/)
      nameEl.appendChild(txt(parts.length > 1 ? `${parts[0][0]}. ${parts[parts.length - 1]}` : (parts[0] ?? t.name)))
      row.appendChild(nameEl)

      // Transaction type label
      const typeEl = el('span', isMech ? 'pdp-insider-type-mech' : isBuy ? 'pdp-insider-type-buy' : 'pdp-insider-type-sell')
      typeEl.appendChild(txt(t.transactionCode ? (codeLabel[t.transactionCode] ?? t.transactionCode) : t.transactionType))
      row.appendChild(typeEl)

      // Shares + value
      if (t.share !== null) {
        const shrEl = el('span', 'pdp-insider-shares')
        shrEl.appendChild(txt(`${t.share >= 1000 ? `${(t.share / 1000).toFixed(1)}K` : String(t.share)} sh`))
        row.appendChild(shrEl)
      }
      if (t.value !== null && t.value > 0) {
        const valEl = el('span', isMech ? 'pdp-insider-val-mech' : isBuy ? 'pdp-insider-val-buy' : 'pdp-insider-val-sell')
        const absM = Math.abs(t.value) / 1_000_000
        valEl.appendChild(txt(absM >= 0.1 ? `$${absM.toFixed(1)}M` : `$${Math.round(Math.abs(t.value) / 1000)}K`))
        row.appendChild(valEl)
      }
      if (t.isDerivative) {
        const derEl = el('span', 'pdp-insider-derivative')
        derEl.appendChild(txt('deriv.'))
        row.appendChild(derEl)
      }

      const dateEl = el('span', 'pdp-insider-date')
      dateEl.appendChild(txt(t.filingDate))
      row.appendChild(dateEl)

      container.appendChild(row)
    }
  } else {
    const empty = el('div', 'pdp-insider-empty')
    empty.appendChild(txt('No recent insider activity'))
    container.appendChild(empty)
  }
  } // end !skipInsiders

}

// ---------------------------------------------------------------------------
// News column renderer (3-col layout — News gets its own card)
// ---------------------------------------------------------------------------

function renderNewsColumn(container: HTMLElement, signals: SignalsData): void {
  container.textContent = ''

  const header = el('div', 'pdp-section-header')
  header.appendChild(txt('News & Insider Activity'))
  container.appendChild(header)

  // ── News ──────────────────────────────────────────────────────
  const newsHeader = el('div', 'pdp-news-header')
  newsHeader.appendChild(txt('📰 Latest News'))
  container.appendChild(newsHeader)

  const newsItems = signals.news.slice(0, 5)
  if (newsItems.length > 0) {
    for (const item of newsItems) {
      const card = item.url
        ? (() => {
            const a = document.createElement('a')
            a.href = item.url
            a.target = '_blank'
            a.rel = 'noopener noreferrer'
            a.className = 'pdp-news-card'
            return a
          })()
        : el('div', 'pdp-news-card pdp-news-card--nolink')

      const meta = el('div', 'pdp-news-meta')
      const srcEl = el('span', 'pdp-news-source')
      srcEl.appendChild(txt(item.source || 'News'))
      const timeEl = el('span', 'pdp-news-time')
      timeEl.appendChild(txt(fmtRelTime(item.datetime)))
      meta.appendChild(srcEl)
      meta.appendChild(timeEl)
      card.appendChild(meta)

      const hl = el('div', 'pdp-news-headline')
      hl.appendChild(txt(item.headline))
      card.appendChild(hl)

      if (item.summary) {
        const smry = el('div', 'pdp-news-summary')
        smry.appendChild(txt(item.summary.length > 160 ? item.summary.slice(0, 157) + '…' : item.summary))
        card.appendChild(smry)
      }

      container.appendChild(card)
    }
  } else {
    const empty = el('div', 'pdp-news-empty')
    empty.appendChild(txt('No recent news'))
    container.appendChild(empty)
  }

  // ── Insider Activity ─────────────────────────────────────────
  const insiders = signals.insiderTransactions
  const insiderHeader = el('div', 'pdp-insider-header')
  insiderHeader.appendChild(txt('👤 Insider Activity'))
  container.appendChild(insiderHeader)

  if (insiders.length > 0) {
    const codeLabel: Record<string, string> = {
      P: 'Open Market Buy', S: 'Open Market Sale',
      A: 'Award/Grant', M: 'Exercise', F: 'Tax Withholding',
      D: 'Disposition', C: 'Conversion', W: 'Gift/Will', I: 'Discretionary',
    }
    const openMarket = insiders.filter(t => t.transactionCode === 'P' || t.transactionCode === 'S')
    const mechanical = insiders.filter(t => t.transactionCode !== 'P' && t.transactionCode !== 'S')
    const omBuys = openMarket.filter(t => t.transactionCode === 'P')
    const omSells = openMarket.filter(t => t.transactionCode === 'S')
    const netValue = openMarket.reduce((sum, t) => {
      const sign = t.transactionCode === 'P' ? 1 : -1
      return sum + sign * (t.value ?? 0)
    }, 0)

    const summaryRow = el('div', 'pdp-insider-summary')
    if (openMarket.length > 0) {
      if (omBuys.length > 0) {
        const b = el('span', 'pdp-insider-buy')
        b.appendChild(txt(`${omBuys.length} open-mkt buy`))
        summaryRow.appendChild(b)
      }
      if (omBuys.length > 0 && omSells.length > 0) {
        const sep = el('span', 'pdp-insider-sep'); sep.appendChild(txt(' · '))
        summaryRow.appendChild(sep)
      }
      if (omSells.length > 0) {
        const s = el('span', 'pdp-insider-sell')
        s.appendChild(txt(`${omSells.length} open-mkt sell`))
        summaryRow.appendChild(s)
      }
      if (netValue !== 0) {
        const sep2 = el('span', 'pdp-insider-sep'); sep2.appendChild(txt(' · '))
        summaryRow.appendChild(sep2)
        const netEl = el('span', netValue > 0 ? 'pdp-insider-net-buy' : 'pdp-insider-net-sell')
        const absM = Math.abs(netValue) / 1_000_000
        netEl.appendChild(txt(`Net ${netValue > 0 ? '+' : '−'}${absM >= 0.1 ? `$${absM.toFixed(1)}M` : `$${Math.round(Math.abs(netValue) / 1000)}K`}`))
        summaryRow.appendChild(netEl)
      }
    } else {
      const mech = el('span', 'pdp-insider-muted')
      mech.appendChild(txt(`${insiders.length} mechanical transactions (awards/exercises)`))
      summaryRow.appendChild(mech)
    }
    container.appendChild(summaryRow)

    const toShow = [
      ...openMarket.slice(0, 3),
      ...mechanical.slice(0, Math.max(0, 4 - openMarket.slice(0, 3).length)),
    ].slice(0, 4)

    for (const t of toShow) {
      const isBuy = t.transactionCode === 'P' || (t.transactionCode === null && t.transactionType === 'Buy')
      const isMech = t.transactionCode !== 'P' && t.transactionCode !== 'S'
      const row = el('div', 'pdp-insider-row')
      const dot = el('span',
        isMech ? 'pdp-insider-dot pdp-insider-dot--mech' :
        isBuy  ? 'pdp-insider-dot pdp-insider-dot--buy' :
                 'pdp-insider-dot pdp-insider-dot--sell')
      row.appendChild(dot)
      const nameEl = el('span', 'pdp-insider-name')
      const parts = t.name.trim().split(/\s+/)
      nameEl.appendChild(txt(parts.length > 1 ? `${parts[0][0]}. ${parts[parts.length - 1]}` : (parts[0] ?? t.name)))
      row.appendChild(nameEl)
      const typeEl = el('span', isMech ? 'pdp-insider-type-mech' : isBuy ? 'pdp-insider-type-buy' : 'pdp-insider-type-sell')
      typeEl.appendChild(txt(t.transactionCode ? (codeLabel[t.transactionCode] ?? t.transactionCode) : t.transactionType))
      row.appendChild(typeEl)
      if (t.share !== null) {
        const shrEl = el('span', 'pdp-insider-shares')
        shrEl.appendChild(txt(`${t.share >= 1000 ? `${(t.share / 1000).toFixed(1)}K` : String(t.share)} sh`))
        row.appendChild(shrEl)
      }
      if (t.value !== null && t.value > 0) {
        const valEl = el('span', isMech ? 'pdp-insider-val-mech' : isBuy ? 'pdp-insider-val-buy' : 'pdp-insider-val-sell')
        const absM = Math.abs(t.value) / 1_000_000
        valEl.appendChild(txt(absM >= 0.1 ? `$${absM.toFixed(1)}M` : `$${Math.round(Math.abs(t.value) / 1000)}K`))
        row.appendChild(valEl)
      }
      if (t.isDerivative) {
        const derEl = el('span', 'pdp-insider-derivative')
        derEl.appendChild(txt('deriv.'))
        row.appendChild(derEl)
      }
      const dateEl = el('span', 'pdp-insider-date')
      dateEl.appendChild(txt(t.filingDate))
      row.appendChild(dateEl)
      container.appendChild(row)
    }
  } else {
    const empty = el('div', 'pdp-insider-empty')
    empty.appendChild(txt('No recent insider activity'))
    container.appendChild(empty)
  }
}

// ---------------------------------------------------------------------------
// Header helpers — profile identity and score pills
// ---------------------------------------------------------------------------

function renderProfileHeader(identityEl: HTMLElement, ticker: string, profile: CompanyProfile): void {
  identityEl.textContent = ''
  if (profile.logo) {
    const img = document.createElement('img')
    img.src = profile.logo
    img.className = 'pdp-company-logo'
    img.alt = ''
    img.width = 20
    img.height = 20
    // Silently remove the logo if the URL fails (prevents bubbling error event → window)
    img.onerror = () => img.remove()
    identityEl.appendChild(img)
  }
  const nameSpan = el('span', 'pdp-company-name')
  nameSpan.appendChild(txt(profile.name || ticker))
  identityEl.appendChild(nameSpan)
  if (profile.industry) {
    const badge = el('span', 'pdp-industry-badge')
    badge.appendChild(txt(profile.industry))
    identityEl.appendChild(badge)
  }
}

/** Momentum Traffic Light: three colored dots — 5D · 13W · 52W with return % labels. */
function buildMomentumDots(metrics: StockMetrics): HTMLElement {
  const wrap = el('span', 'pdp-momentum-dots')
  const periods: [string, number | null][] = [
    ['5D', metrics.return5Day],
    ['13W', metrics.return13Week],
    ['52W', metrics.return52Week],
  ]
  let hasAny = false
  for (const [label, val] of periods) {
    if (val === null) continue
    hasAny = true
    const item = el('span', 'pdp-momentum-item')
    const dot = el('span', val > 0 ? 'pdp-momentum-dot pdp-momentum-dot--pos'
      : val < 0 ? 'pdp-momentum-dot pdp-momentum-dot--neg'
      : 'pdp-momentum-dot pdp-momentum-dot--neut')
    const lbl = el('span', 'pdp-momentum-label')
    lbl.appendChild(txt(`${label}: ${fmtPct(val, true)}`))
    item.appendChild(dot)
    item.appendChild(lbl)
    wrap.appendChild(item)
  }
  if (!hasAny) {
    const lbl = el('span', 'pdp-momentum-label')
    lbl.appendChild(txt('Momentum: —'))
    wrap.appendChild(lbl)
  }
  return wrap
}

function renderScorePills(scoresEl: HTMLElement, metrics: StockMetrics): void {
  scoresEl.textContent = ''

  // 1. Momentum Traffic Light — individual colored period dots
  scoresEl.appendChild(buildMomentumDots(metrics))

  // 2. Pre-trade Risk Score
  const risk = computePreTradeRiskScore(metrics)
  const riskEmoji = risk.grade === 'green' ? '🟢' : risk.grade === 'yellow' ? '🟡' : '🔴'
  const riskCls = risk.grade === 'green' ? 'pdp-score-pill pdp-score-pill--bull pdp-score-pill--risk'
    : risk.grade === 'yellow' ? 'pdp-score-pill pdp-score-pill--neut pdp-score-pill--risk'
    : 'pdp-score-pill pdp-score-pill--bear pdp-score-pill--risk'
  const riskPill = el('span', riskCls)
  riskPill.appendChild(txt(`${riskEmoji} Risk`))
  scoresEl.appendChild(riskPill)
  attachScorePillTooltip(
    riskPill,
    'Pre-trade Risk Score',
    'Traffic light combining market sensitivity, realized volatility and short-term momentum. Helps identify when selling new premium is too dangerous.',
    [
      { label: 'Beta', value: 'Market sensitivity vs S&P 500. Values > 1.5 flag elevated systemic risk.' },
      { label: 'HV30 (3-Month Realized Vol)', value: 'Annualized historical volatility from 3MonthADReturnStd. Values > 50% = extreme.' },
      { label: '5D Return', value: 'Recent short-term price momentum. Drop < −3% is a yellow flag.' },
      { label: '52W Return', value: 'Long-term trend direction. Confirms short-term drop is a downtrend.' },
    ],
    [
      { label: '🔴 Red', value: 'Beta > 1.5, or HV30 > 50%, or 5D < −5% AND 52W < −15%' },
      { label: '🟡 Yellow', value: 'Beta > 1.2, or HV30 > 30%, or 5D < −3%' },
      { label: '🟢 Green', value: 'All inputs within safe thresholds' },
    ]
  )

  // 3. Assignment Conviction Score ("Own?" — Wheel traders)
  const conviction = computeAssignmentConvictionScore(metrics)
  const convEmoji = conviction.grade === 'safe' ? '✅' : conviction.grade === 'caution' ? '⚠️' : '❌'
  const convCls = conviction.grade === 'safe' ? 'pdp-score-pill pdp-score-pill--bull'
    : conviction.grade === 'caution' ? 'pdp-score-pill pdp-score-pill--neut'
    : 'pdp-score-pill pdp-score-pill--bear'
  const convPill = el('span', convCls)
  convPill.appendChild(txt(`${convEmoji} Own?`))
  scoresEl.appendChild(convPill)
  attachScorePillTooltip(
    convPill,
    'Assignment Conviction Score (Wheel)',
    'Answers: "Would I be comfortable owning this stock at this strike?" Designed for Wheel strategy traders evaluating cash-secured puts and potential assignment.',
    [
      { label: 'Forward P/E', value: 'Forward Price-to-Earnings ratio. < 15 = attractive, > 25 = stretched.' },
      { label: 'P/FCF (TTM)', value: 'Price-to-Free-Cash-Flow. < 15 = strong cash generation, > 25 = expensive.' },
      { label: 'Current Ratio', value: 'Current assets / current liabilities. ≥ 2.0 = strong liquidity.' },
      { label: 'Debt / Equity', value: 'Total debt / total equity (annual). < 0.5 = conservative leverage.' },
      { label: 'ROE (TTM)', value: 'Return on Equity, trailing 12 months. > 20% = excellent capital efficiency.' },
    ],
    [
      { label: '✅ Safe', value: 'Normalized score ≥ 18 — strong fundamentals for assignment' },
      { label: '⚠️ Caution', value: 'Normalized score 11–17 — mixed signals, review carefully' },
      { label: '❌ Avoid', value: 'Normalized score < 11 — significant fundamental risk' },
    ]
  )

  // 4. Balance Sheet health
  const health = computeBalanceSheetScore(metrics)
  const healthConfig: Record<HealthGrade, { label: string; cls: string }> = {
    healthy: { label: '✅ Balance Sheet', cls: 'pdp-score-pill pdp-score-pill--bull' },
    ok: { label: '⚠️ Balance Sheet', cls: 'pdp-score-pill pdp-score-pill--neut' },
    weak: { label: '❌ Balance Sheet', cls: 'pdp-score-pill pdp-score-pill--bear' },
  }
  const healthPill = el('span', healthConfig[health.grade].cls)
  healthPill.appendChild(txt(healthConfig[health.grade].label))
  scoresEl.appendChild(healthPill)
  attachScorePillTooltip(
    healthPill,
    'Balance Sheet Health',
    'Assesses the financial strength and solvency of the company. Weak balance sheets increase assignment risk in Wheel strategies.',
    [
      { label: 'Current Ratio', value: 'Current assets ÷ current liabilities. ≥ 1.5 = healthy, < 1.0 = weak.' },
      { label: 'Debt / Equity Ratio', value: 'Total debt ÷ total equity (annual). < 0.5 = healthy, > 2.0 = leveraged.' },
      { label: 'Interest Coverage', value: 'EBIT ÷ interest expense. > 5× = strong, near 1× = at risk.' },
    ],
    [
      { label: '✅ Healthy', value: 'Current Ratio ≥ 1.5 AND D/E < 0.5 AND Interest Coverage > 5×' },
      { label: '⚠️ OK', value: 'No critical weakness detected but not all metrics are strong' },
      { label: '❌ Weak', value: 'Current Ratio < 1.0 OR Debt/Equity > 2.0' },
    ]
  )

  // 5. Valuation
  const valuation = computeValuationScore(metrics)
  const valConfig: Record<ValuationGrade, { label: string; cls: string }> = {
    cheap: { label: '💚 Cheap', cls: 'pdp-score-pill pdp-score-pill--bull' },
    fair: { label: '🟡 Fair Value', cls: 'pdp-score-pill pdp-score-pill--neut' },
    expensive: { label: '🔴 Expensive', cls: 'pdp-score-pill pdp-score-pill--bear' },
  }
  const valPill = el('span', valConfig[valuation.grade].cls)
  valPill.appendChild(txt(valConfig[valuation.grade].label))
  scoresEl.appendChild(valPill)
  attachScorePillTooltip(
    valPill,
    'Valuation Score',
    'Uses the historical P/E percentile rank (5-year range) when available, otherwise falls back to Forward P/E. Lower percentile = historically cheap.',
    [
      { label: 'P/E TTM', value: 'Trailing 12-month Price-to-Earnings ratio.' },
      { label: 'Forward P/E', value: 'Next 12-month consensus P/E estimate.' },
      { label: 'Historical Percentile', value: 'Where current P/E sits in the 5-year annual P/E range (preferred method).' },
    ],
    [
      { label: '💚 Cheap', value: 'P/E ≤ 25th percentile of 5-year range, or Fwd P/E < 13×' },
      { label: '🟡 Fair Value', value: 'P/E between 25th and 75th percentile, or Fwd P/E 13–25×' },
      { label: '🔴 Expensive', value: 'P/E ≥ 75th percentile of 5-year range, or Fwd P/E > 25×' },
    ]
  )
}

// ---------------------------------------------------------------------------
// Data fetch orchestration
// ---------------------------------------------------------------------------

function triggerDataFetch(
  context: PositionDetailPanelContext,
  ticker: string,
  panelEl: HTMLElement,
  activeStrike: number | null,
  threeCol = false
): void {
  const fundCard = panelEl.querySelector('[data-role="fundamentals"]') as HTMLElement | null
  const sigCard = panelEl.querySelector('[data-role="signals"]') as HTMLElement | null
  const newsCard = threeCol ? panelEl.querySelector('[data-role="news"]') as HTMLElement | null : null
  const identityEl = panelEl.querySelector('[data-role="identity"]') as HTMLElement | null
  const scoresEl = panelEl.querySelector('[data-role="scores"]') as HTMLElement | null

  const livePrice = context.finnhub.cache.get(ticker)?.c ?? null

  function reRenderSignals(signals: SignalsData): void {
    if (!sigCard?.isConnected) return
    const earned = context.earningsCache.get(ticker)
    const earnings = (earned && earned !== 'loading' && earned !== 'error') ? earned : null
    renderSignalsColumn(sigCard, signals, livePrice, earnings, { skipNews: threeCol, skipInsiders: threeCol })
    if (threeCol && newsCard?.isConnected) renderNewsColumn(newsCard, signals)
  }

  // ── Fundamentals (metrics) ────────────────────────────────
  const cachedMetrics = context.metricsCache.get(ticker)
  if (cachedMetrics && cachedMetrics !== 'loading' && cachedMetrics !== 'error') {
    if (fundCard) renderFundamentalsColumn(fundCard, cachedMetrics, livePrice, activeStrike)
    if (scoresEl) renderScorePills(scoresEl, cachedMetrics)
  } else if (cachedMetrics === 'loading') {
    context.metricsPromiseMap.get(ticker)?.then(data => {
      if (fundCard?.isConnected && data) renderFundamentalsColumn(fundCard, data, livePrice, activeStrike)
      if (scoresEl?.isConnected && data) renderScorePills(scoresEl, data)
    })
  } else {
    context.metricsCache.set(ticker, 'loading')
    const promise = context.fetchStockMetrics(ticker)
    context.metricsPromiseMap.set(ticker, promise)
    promise.then(data => {
      context.metricsPromiseMap.delete(ticker)
      if (data) {
        context.metricsCache.set(ticker, data)
        if (fundCard?.isConnected) renderFundamentalsColumn(fundCard, data, livePrice, activeStrike)
        if (scoresEl?.isConnected) renderScorePills(scoresEl, data)
      } else {
        context.metricsCache.set(ticker, 'error')
        if (fundCard?.isConnected) {
          fundCard.textContent = ''
          const errEl = el('div', 'pdp-error')
          errEl.appendChild(txt('Unavailable'))
          fundCard.appendChild(errEl)
        }
      }
    })
  }

  // ── Signals ───────────────────────────────────────────────
  const cachedSignals = context.signalsCache.get(ticker)
  if (cachedSignals && cachedSignals !== 'loading' && cachedSignals !== 'error') {
    if (sigCard) reRenderSignals(cachedSignals)
  } else if (cachedSignals === 'loading') {
    context.signalsPromiseMap.get(ticker)?.then(data => {
      if (sigCard?.isConnected && data) reRenderSignals(data)
    })
  } else {
    context.signalsCache.set(ticker, 'loading')
    const promise = context.fetchSignalsData(ticker)
    context.signalsPromiseMap.set(ticker, promise)
    promise.then(data => {
      context.signalsPromiseMap.delete(ticker)
      if (data) {
        context.signalsCache.set(ticker, data)
        if (sigCard?.isConnected) reRenderSignals(data)
      } else {
        context.signalsCache.set(ticker, 'error')
        if (sigCard?.isConnected) {
          sigCard.textContent = ''
          const errEl = el('div', 'pdp-error')
          errEl.appendChild(txt('Unavailable'))
          sigCard.appendChild(errEl)
        }
      }
    })
  }

  // ── Company profile ───────────────────────────────────────
  const cachedProfile = context.profileCache.get(ticker)
  if (cachedProfile && cachedProfile !== 'loading' && cachedProfile !== 'error') {
    if (identityEl) renderProfileHeader(identityEl, ticker, cachedProfile)
  } else if (cachedProfile === 'loading') {
    context.profilePromiseMap.get(ticker)?.then(data => {
      if (identityEl?.isConnected && data) renderProfileHeader(identityEl, ticker, data)
    })
  } else {
    context.profileCache.set(ticker, 'loading')
    const promise = context.fetchCompanyProfile(ticker)
    context.profilePromiseMap.set(ticker, promise)
    promise.then(data => {
      context.profilePromiseMap.delete(ticker)
      if (data) {
        context.profileCache.set(ticker, data)
        if (identityEl?.isConnected) renderProfileHeader(identityEl, ticker, data)
      } else {
        context.profileCache.set(ticker, 'error')
      }
    })
  }

  // ── Earnings surprises ────────────────────────────────────
  const cachedEarnings = context.earningsCache.get(ticker)
  if (cachedEarnings && cachedEarnings !== 'loading' && cachedEarnings !== 'error') {
    const cs = context.signalsCache.get(ticker)
    if (cs && cs !== 'loading' && cs !== 'error' && sigCard?.isConnected) {
      reRenderSignals(cs)
    }
  } else if (cachedEarnings === 'loading') {
    context.earningsPromiseMap.get(ticker)?.then(data => {
      if (!data || !sigCard?.isConnected) return
      const cs = context.signalsCache.get(ticker)
      if (cs && cs !== 'loading' && cs !== 'error') reRenderSignals(cs)
    })
  } else {
    context.earningsCache.set(ticker, 'loading')
    const promise = context.fetchEarningsSurprise(ticker)
    context.earningsPromiseMap.set(ticker, promise)
    promise.then(data => {
      context.earningsPromiseMap.delete(ticker)
      const result = data ?? 'error'
      context.earningsCache.set(ticker, result)
      if (data && sigCard?.isConnected) {
        const cs = context.signalsCache.get(ticker)
        if (cs && cs !== 'loading' && cs !== 'error') reRenderSignals(cs)
      }
    })
  }
}

// ---------------------------------------------------------------------------
// AG Grid full-width cell renderer factory
// ---------------------------------------------------------------------------

export function createPositionDetailPanelRenderer(
  context: PositionDetailPanelContext,
  opts: { threeCol?: boolean } = {}
) {
  const { threeCol = false } = opts
  return class {
    private container!: HTMLElement
    private ro: ResizeObserver | null = null

    init(params: { node: { data: Record<string, unknown>; rowHeight?: number; setRowHeight(h: number): void }; api: { onRowHeightChanged(): void } }) {
      const trade = params.node.data._parentTrade as Record<string, unknown>
      const ticker = String(trade.ticker ?? '').toUpperCase()
      this.container = buildPanelSkeleton(ticker, threeCol)
      const activeStrike = typeof trade.activeStrikePrice === 'number'
        ? trade.activeStrikePrice
        : (typeof trade.strikePrice === 'number' ? trade.strikePrice : null)
      triggerDataFetch(context, ticker, this.container, activeStrike, threeCol)

      // Auto-size row height to actual rendered content.
      // The panel has no fixed height (min-height only), so offsetHeight = actual content height.
      this.ro = new ResizeObserver((entries) => {
        const h = entries[0]?.contentRect.height ?? this.container.offsetHeight
        if (h > 0) {
          params.node.setRowHeight(Math.ceil(h))
          params.api.onRowHeightChanged()
        }
      })
      this.ro.observe(this.container)
    }

    getGui(): HTMLElement {
      return this.container
    }

    destroy(): void {
      this.ro?.disconnect()
    }
  }
}
