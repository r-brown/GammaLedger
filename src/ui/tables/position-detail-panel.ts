import type { CandleData, StockMetrics, SignalsData } from '../../types/integrations.js'
import * as echarts from 'echarts'

// ---------------------------------------------------------------------------
// Context interface — structural typing over GammaLedger instance
// ---------------------------------------------------------------------------

export interface PositionDetailPanelContext {
  candleCache: Map<string, CandleData | 'loading' | 'error'>
  metricsCache: Map<string, StockMetrics | 'loading' | 'error'>
  signalsCache: Map<string, SignalsData | 'loading' | 'error'>
  fetchCandleData(ticker: string): Promise<CandleData | null>
  fetchSignalsData(ticker: string): Promise<SignalsData | null>
  fetchStockMetrics(ticker: string): Promise<StockMetrics | null>
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
// Panel skeleton — three-column DOM structure with loading placeholders
// ---------------------------------------------------------------------------

function buildPanelSkeleton(ticker: string): HTMLElement {
  const panel = el('div', 'position-detail-panel')

  // Chart column
  const chartCol = el('div', 'pdp-chart-col')
  const chartHeader = el('div', 'pdp-chart-header')
  const tickerSpan = el('span', 'pdp-chart-ticker')
  tickerSpan.appendChild(txt(ticker))
  chartHeader.appendChild(tickerSpan)
  const chartArea = el('div', 'pdp-chart-area')
  chartArea.dataset.role = 'chart'
  const chartLoading = el('div', 'pdp-loading')
  chartLoading.appendChild(txt('Loading chart…'))
  chartArea.appendChild(chartLoading)
  chartCol.appendChild(chartHeader)
  chartCol.appendChild(chartArea)

  // Fundamentals column
  const fundCol = el('div', 'pdp-fund-col')
  const fundCard = el('div', 'pdp-card')
  fundCard.dataset.role = 'fundamentals'
  const fundLoading = el('div', 'pdp-loading')
  fundLoading.appendChild(txt('Loading…'))
  fundCard.appendChild(fundLoading)
  fundCol.appendChild(fundCard)

  // Signals column
  const sigCol = el('div', 'pdp-signals-col')
  const sigCard = el('div', 'pdp-card')
  sigCard.dataset.role = 'signals'
  const sigLoading = el('div', 'pdp-loading')
  sigLoading.appendChild(txt('Loading…'))
  sigCard.appendChild(sigLoading)
  sigCol.appendChild(sigCard)

  panel.appendChild(chartCol)
  panel.appendChild(fundCol)
  panel.appendChild(sigCol)
  return panel
}

// ---------------------------------------------------------------------------
// Column renderers
// ---------------------------------------------------------------------------

function renderChartColumn(
  container: HTMLElement,
  ticker: string,
  candles: CandleData,
  livePrice: number | null
): echarts.ECharts | null {
  container.textContent = ''
  if (candles.s !== 'ok' || candles.t.length === 0) {
    const msg = el('div', 'pdp-error')
    msg.appendChild(txt('No price history available'))
    container.appendChild(msg)
    return null
  }

  const chartCol = container.parentElement
  const header = chartCol?.querySelector('.pdp-chart-header')
  if (header && livePrice !== null) {
    const priceEl = el('span', 'pdp-chart-price')
    priceEl.appendChild(txt(`$${livePrice.toFixed(2)}`))
    const prevClose = candles.c[candles.c.length - 2] ?? candles.c[candles.c.length - 1]
    if (prevClose) {
      const chg = ((livePrice - prevClose) / prevClose) * 100
      const chgEl = el('span', chg >= 0 ? 'pdp-chart-change--up' : 'pdp-chart-change--down')
      chgEl.appendChild(txt(`${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%`))
      header.appendChild(priceEl)
      header.appendChild(chgEl)
    } else {
      header.appendChild(priceEl)
    }
  }

  const chart = echarts.init(container)
  chart.setOption({
    grid: { top: 6, bottom: 22, left: 44, right: 8 },
    xAxis: {
      type: 'category',
      data: candles.t.map((ts: number) =>
        new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      ),
      axisLabel: { fontSize: 9, interval: Math.floor(candles.t.length / 6) },
      axisLine: { lineStyle: { color: '#e2e8f0' } },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      scale: true,
      axisLabel: { fontSize: 9, formatter: (v: number) => `$${v.toFixed(0)}` },
      axisLine: { show: false },
      splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } },
    },
    series: [{
      type: 'candlestick',
      data: candles.t.map((_: number, i: number) => [
        candles.o[i], candles.c[i], candles.l[i], candles.h[i]
      ]),
      itemStyle: {
        color: '#22c55e',
        color0: '#ef4444',
        borderColor: '#16a34a',
        borderColor0: '#dc2626',
      },
    }],
  })
  return chart
}

function renderFundamentalsColumn(
  container: HTMLElement,
  metrics: StockMetrics,
  livePrice: number | null
): void {
  container.textContent = ''

  const header = el('div', 'pdp-section-header')
  header.appendChild(txt('Fundamentals'))
  container.appendChild(header)

  const price = livePrice ?? metrics.currentPrice
  if (metrics.week52High !== null && metrics.week52Low !== null && price !== null) {
    const rng = metrics.week52High - metrics.week52Low
    const pct = rng > 0
      ? Math.min(100, Math.max(0, ((price - metrics.week52Low) / rng) * 100))
      : 50
    const rangeRow = el('div', 'pdp-range-row')
    const lowLabel = el('span', 'pdp-range-label')
    lowLabel.appendChild(txt(`$${metrics.week52Low.toFixed(0)}`))
    const track = el('div', 'pdp-range-track')
    const dot = el('div', 'pdp-range-dot')
    dot.style.left = `${pct}%`
    track.appendChild(dot)
    const highLabel = el('span', 'pdp-range-label')
    highLabel.appendChild(txt(`$${metrics.week52High.toFixed(0)}`))
    rangeRow.appendChild(lowLabel)
    rangeRow.appendChild(track)
    rangeRow.appendChild(highLabel)
    container.appendChild(rangeRow)
  }

  const grid = el('div', 'pdp-kv-grid')
  const kvRows: [string, string, boolean, boolean][] = [
    ['Beta', metrics.beta !== null ? metrics.beta.toFixed(2) : '—', false, false],
    ['Mkt Cap', fmtCap(metrics.marketCap), false, false],
    ['P/E TTM', metrics.peTTM !== null ? `${metrics.peTTM.toFixed(0)}×` : '—', false, false],
    ['Fwd P/E', metrics.forwardPE !== null ? `${metrics.forwardPE.toFixed(0)}×` : '—', false, false],
    ['Net Margin', fmtPct(metrics.netMarginTTM), (metrics.netMarginTTM ?? 0) > 0, (metrics.netMarginTTM ?? 0) < 0],
    ['Op Margin', fmtPct(metrics.operatingMarginTTM), (metrics.operatingMarginTTM ?? 0) > 0, (metrics.operatingMarginTTM ?? 0) < 0],
    ['Rev Growth', fmtPct(metrics.revenueGrowthYoY, true), (metrics.revenueGrowthYoY ?? 0) > 0, (metrics.revenueGrowthYoY ?? 0) < 0],
    ['EPS Growth', fmtPct(metrics.epsGrowthYoY, true), (metrics.epsGrowthYoY ?? 0) > 0, (metrics.epsGrowthYoY ?? 0) < 0],
  ]
  for (const [label, value, pos, neg] of kvRows) {
    grid.appendChild(makeKV(label, value, pos, neg))
  }
  container.appendChild(grid)

  if (metrics.epsAnnual.length >= 2) {
    const spRow = el('div', 'pdp-sparkline-row')
    const spLabel = el('div', 'pdp-sparkline-label')
    spLabel.appendChild(txt('EPS (annual)'))
    spRow.appendChild(spLabel)
    spRow.appendChild(buildSparklineSVG(metrics.epsAnnual.map(p => p.v)))
    container.appendChild(spRow)
  }
}

function renderSignalsColumn(
  container: HTMLElement,
  signals: SignalsData,
  livePrice: number | null
): void {
  container.textContent = ''

  const header = el('div', 'pdp-section-header')
  header.appendChild(txt('Signals'))
  container.appendChild(header)

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

  // Analyst consensus
  if (signals.recommendation) {
    const r = signals.recommendation
    const total = r.strongBuy + r.buy + r.hold + r.sell + r.strongSell || 1
    const label = r.strongBuy + r.buy > r.sell + r.strongSell + r.hold ? 'Buy consensus' :
                  r.sell + r.strongSell > r.strongBuy + r.buy + r.hold ? 'Sell consensus' : 'Hold consensus'
    const detail = `${r.strongBuy + r.buy} buy · ${r.hold} hold · ${r.sell + r.strongSell} sell`
    const row = el('div', 'pdp-signal-row')
    const iconEl = el('span', 'pdp-signal-icon')
    iconEl.appendChild(txt('📊'))
    const body = el('span')
    const labelEl = el('span', 'pdp-signal-label')
    labelEl.appendChild(txt(label))
    const detailEl = el('span', 'pdp-signal-detail')
    detailEl.appendChild(txt(detail))
    const bar = el('div', 'pdp-analyst-bar')
    const segments: [string, number][] = [
      ['pdp-analyst-bar__sb', r.strongBuy],
      ['pdp-analyst-bar__b', r.buy],
      ['pdp-analyst-bar__h', r.hold],
      ['pdp-analyst-bar__s', r.sell],
      ['pdp-analyst-bar__ss', r.strongSell],
    ]
    for (const [cls, count] of segments) {
      if (count > 0) {
        const seg = el('div', cls)
        seg.style.flex = String(count / total)
        bar.appendChild(seg)
      }
    }
    body.appendChild(labelEl)
    body.appendChild(detailEl)
    body.appendChild(bar)
    row.appendChild(iconEl)
    row.appendChild(body)
    container.appendChild(row)
  } else {
    addSignalRow('📊', 'Analyst consensus', '—')
  }

  // Price target
  if (signals.priceTarget?.targetMean !== null && signals.priceTarget?.targetMean !== undefined) {
    const pt = signals.priceTarget
    const upside = livePrice && pt.targetMean !== null
      ? ` (${((pt.targetMean - livePrice) / livePrice * 100) > 0 ? '+' : ''}${((pt.targetMean - livePrice) / livePrice * 100).toFixed(0)}%)`
      : ''
    const range = (pt.targetLow !== null && pt.targetHigh !== null)
      ? ` · $${pt.targetLow.toFixed(0)}–$${pt.targetHigh.toFixed(0)}`
      : ''
    addSignalRow('🎯', `Target $${pt.targetMean?.toFixed(2)}${upside}`, range)
  } else {
    addSignalRow('🎯', 'Price target', '—')
  }

  // News (first item)
  const newsToShow = signals.news.slice(0, 3)
  if (newsToShow.length > 0) {
    const first = newsToShow[0]
    const truncated = first.headline.length > 60
      ? first.headline.slice(0, 57) + '…'
      : first.headline
    addSignalRow('📰', truncated, `${first.source} · ${fmtRelTime(first.datetime)}`)
  } else {
    addSignalRow('📰', 'Recent news', '—')
  }

  // Insider transactions
  if (signals.insiderTransactions.length > 0) {
    const ins = signals.insiderTransactions[0]
    const valueStr = ins.value !== null ? ` · $${(ins.value / 1_000_000).toFixed(1)}M` : ''
    addSignalRow(
      ins.transactionType === 'Buy' ? '🟢' : '🔴',
      `Insider ${ins.transactionType.toLowerCase()} · ${ins.name.split(' ').slice(-1)[0]}`,
      `${ins.filingDate}${valueStr}`
    )
  } else {
    addSignalRow('👤', 'Insider activity', '—')
  }

  // Social sentiment
  if (signals.socialSentimentScore !== null) {
    const score = signals.socialSentimentScore
    const pillClass = score >= 20 ? 'pdp-sentiment--bull' : score <= -20 ? 'pdp-sentiment--bear' : 'pdp-sentiment--neut'
    const pillLabel = score >= 20 ? 'Bullish' : score <= -20 ? 'Bearish' : 'Neutral'
    const row = el('div', 'pdp-signal-row')
    const iconEl = el('span', 'pdp-signal-icon')
    iconEl.appendChild(txt('🌐'))
    const body = el('span')
    const pill = el('span', `pdp-sentiment ${pillClass}`)
    pill.appendChild(txt(`${pillLabel} ${score > 0 ? '+' : ''}${score.toFixed(0)}`))
    body.appendChild(pill)
    row.appendChild(iconEl)
    row.appendChild(body)
    container.appendChild(row)
  } else {
    addSignalRow('🌐', 'Social sentiment', '—')
  }
}

// ---------------------------------------------------------------------------
// Data fetch orchestration
// ---------------------------------------------------------------------------

function triggerDataFetch(
  context: PositionDetailPanelContext,
  ticker: string,
  panelEl: HTMLElement,
  getChart: () => echarts.ECharts | null,
  setChart: (c: echarts.ECharts | null) => void
): void {
  const chartArea = panelEl.querySelector('[data-role="chart"]') as HTMLElement | null
  const fundCard = panelEl.querySelector('[data-role="fundamentals"]') as HTMLElement | null
  const sigCard = panelEl.querySelector('[data-role="signals"]') as HTMLElement | null

  const livePrice = context.finnhub.cache.get(ticker)?.c ?? null

  // Candle chart
  const cachedCandle = context.candleCache.get(ticker)
  if (cachedCandle && cachedCandle !== 'loading' && cachedCandle !== 'error') {
    if (chartArea) {
      requestAnimationFrame(() => {
        const c = renderChartColumn(chartArea, ticker, cachedCandle, livePrice)
        setChart(c)
      })
    }
  } else if (cachedCandle !== 'loading') {
    context.candleCache.set(ticker, 'loading')
    context.fetchCandleData(ticker).then(data => {
      if (data) {
        context.candleCache.set(ticker, data)
        if (chartArea?.isConnected) {
          requestAnimationFrame(() => {
            const c = renderChartColumn(chartArea, ticker, data, livePrice)
            setChart(c)
          })
        }
      } else {
        context.candleCache.set(ticker, 'error')
        if (chartArea?.isConnected) {
          chartArea.textContent = ''
          const errEl = el('div', 'pdp-error')
          errEl.appendChild(txt('Unavailable'))
          chartArea.appendChild(errEl)
        }
      }
    })
  }

  // Fundamentals
  const cachedMetrics = context.metricsCache.get(ticker)
  if (cachedMetrics && cachedMetrics !== 'loading' && cachedMetrics !== 'error') {
    if (fundCard) renderFundamentalsColumn(fundCard, cachedMetrics, livePrice)
  } else if (!cachedMetrics || cachedMetrics === 'error') {
    context.metricsCache.set(ticker, 'loading')
    context.fetchStockMetrics(ticker).then(data => {
      if (data) {
        context.metricsCache.set(ticker, data)
        if (fundCard?.isConnected) renderFundamentalsColumn(fundCard, data, livePrice)
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

  // Signals
  const cachedSignals = context.signalsCache.get(ticker)
  if (cachedSignals && cachedSignals !== 'loading' && cachedSignals !== 'error') {
    if (sigCard) renderSignalsColumn(sigCard, cachedSignals, livePrice)
  } else if (!cachedSignals || cachedSignals === 'error') {
    context.signalsCache.set(ticker, 'loading')
    context.fetchSignalsData(ticker).then(data => {
      if (data) {
        context.signalsCache.set(ticker, data)
        if (sigCard?.isConnected) renderSignalsColumn(sigCard, data, livePrice)
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
}

// ---------------------------------------------------------------------------
// AG Grid full-width cell renderer factory
// ---------------------------------------------------------------------------

export function createPositionDetailPanelRenderer(
  context: PositionDetailPanelContext
) {
  return class {
    private container!: HTMLElement
    private echartsInstance: echarts.ECharts | null = null

    init(params: { node: { data: Record<string, unknown> } }) {
      const trade = params.node.data._parentTrade as Record<string, unknown>
      const ticker = String(trade.ticker ?? '').toUpperCase()
      this.container = buildPanelSkeleton(ticker)
      triggerDataFetch(
        context,
        ticker,
        this.container,
        () => this.echartsInstance,
        (c) => { this.echartsInstance = c }
      )
    }

    getGui(): HTMLElement {
      return this.container
    }

    destroy(): void {
      if (this.echartsInstance) {
        this.echartsInstance.dispose()
        this.echartsInstance = null
      }
    }
  }
}
