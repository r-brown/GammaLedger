// src/ui/charts/ticker-pl.ts — per-ticker realized vs unrealized bars.
// Uses the .call(this, …) delegation pattern.
//
// ENCODING: hue carries POLARITY only (profit/loss) — each bar is colored by
// its own sign. Realized vs unrealized is carried by row position within the
// group plus a direct label. Grouped, not stacked: a stacked encoding needs
// four fills, and two steps of one hue cannot both sit inside the dark
// lightness band at >=3:1 contrast (see the palette tokens in app.css).
//
// The signed direct label on every bar is LOAD-BEARING, not decoration: the
// profit/loss pair sits in the CVD warn band (deutan dE 7.5), which is only
// permissible because polarity is also encoded by bar direction and by that
// label. Do not remove it.

import { renderEChart } from './echarts.js'
import type { Stats, TickerPLRow } from '@types-gl/stats'

interface TickerPLChartContext {
  charts: Record<string, { destroy(): void }>
  formatCurrency(value: unknown, opts?: Record<string, unknown>): string
  openTradesFilteredByTicker(ticker: unknown): void
}

const MAX_ROWS = 10

function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

function cssVar(name: string, fallback: string): string {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    return value || fallback
}

/** Panel-level disclosure: how many open positions carry a real mark, plus the
 *  standing caveat that unrealized is always "now" whatever range is selected.
 *  Mirrors the chip in grouped-metrics.ts so both surfaces tell the same story. */
function renderCoverageDisclosure(stats: Stats): void {
    const header = document.getElementById('tickerpl-coverage')
    if (!header) return

    const coverage = stats.unrealizedQuoteCoverage ?? { marked: 0, total: 0, unmarkedTickers: [] }
    const unquoted = coverage.total - coverage.marked
    const caveat = 'Unrealized is always current — GammaLedger does not store historical position marks.'

    header.textContent = coverage.total > 0 && unquoted > 0
        ? `MTM ${coverage.marked}/${coverage.total} · ${unquoted} @ full credit — ${caveat}`
        : caveat
    header.className = unquoted > 0 ? 'chart-subtext chip-warn' : 'chart-subtext'
}

export function renderTickerPLChart(this: TickerPLChartContext, stats: Stats): void {
    renderCoverageDisclosure(stats)

    const root = document.getElementById('tickerPLChart')
    if (!root) return

    const rows: TickerPLRow[] = (stats.tickerPL ?? []).slice(0, MAX_ROWS)
    if (!rows.length) {
        root.innerHTML = '<div class="heatmap-empty">No ticker activity yet.</div>'
        return
    }

    const profit = cssVar('--color-ticker-pl-profit', '#0F8A63')
    const loss = cssVar('--color-ticker-pl-loss', '#C0392B')
    const paint = (value: number) => (value >= 0 ? profit : loss)

    // ECharts renders a category axis bottom-up; reverse so the largest is on top.
    const ordered = [...rows].reverse()
    const categories = ordered.map(row => row.ticker)
    const fmt = (value: number) => this.formatCurrency(value, { decimals: 0 })

    // Unrealized bars carry a diagonal decal. Hue is spoken for by polarity, so
    // texture is the only channel left to separate the two series — and unlike
    // a second hue it survives every CVD type. The legend swatches reuse it, so
    // the legend describes what is actually drawn instead of asserting a
    // series->color mapping that does not exist.
    const UNREALIZED_DECAL = {
        symbol: 'rect',
        color: 'rgba(255, 255, 255, 0.55)',
        dashArrayX: [1, 0],
        dashArrayY: [3, 4],
        rotation: -Math.PI / 4,
    } as const

    const bar = (pick: (row: TickerPLRow) => number, decal = false) => ordered.map(row => {
        const value = pick(row)
        return {
            value: Number(value.toFixed(2)),
            itemStyle: {
                color: paint(value),
                // 4px rounded data-end only; square at the zero baseline.
                borderRadius: value >= 0 ? [0, 4, 4, 0] : [4, 0, 0, 4],
                ...(decal ? { decal: UNREALIZED_DECAL } : {}),
            },
        }
    })

    // Symmetric axis with headroom so an `outside` data label always has room
    // between its bar end and the plot edge. Without it the longest negative
    // bar's label overprints the ticker axis labels.
    const maxAbs = rows.reduce(
        (max, row) => Math.max(max, Math.abs(row.realizedPL), Math.abs(row.unrealizedPL)),
        0,
    )
    const axisBound = maxAbs > 0 ? Math.ceil(maxAbs * 1.3) : 1

    // Neutral legend swatches: colour means polarity, never series.
    const legendSwatch = cssVar('--color-text-secondary', '#64748B')

    this.charts.tickerPL = renderEChart(root, this.charts.tickerPL, {
        aria: { enabled: true },
        grid: { top: 28, right: 96, bottom: 24, left: 64, containLabel: true },
        legend: {
            top: 0,
            data: [
                { name: 'Realized', itemStyle: { color: legendSwatch } },
                { name: 'Unrealized', itemStyle: { color: legendSwatch, decal: UNREALIZED_DECAL } },
            ],
        },
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            formatter: (params: unknown) => {
                const list = Array.isArray(params)
                    ? params as Array<{ axisValue?: string; seriesName?: string; value?: unknown }>
                    : []
                const ticker = list[0]?.axisValue ?? ''
                const row = rows.find(r => r.ticker === ticker)
                if (!row) return ''
                const roc = row.returnOnCapital === null
                    ? '—'
                    : `${(row.returnOnCapital * 100).toFixed(1)}%`
                const warn = row.unmarkedPositions > 0
                    ? `<br><em>${row.unmarkedPositions} position(s) unquoted — valued at full credit</em>`
                    : ''
                return [
                    `<strong>${escapeHtml(ticker)}</strong>`,
                    `Realized: ${this.formatCurrency(row.realizedPL)}`,
                    `Unrealized: ${this.formatCurrency(row.unrealizedPL)}`,
                    `Total: ${this.formatCurrency(row.totalPL)}`,
                    `Capital deployed: ${this.formatCurrency(row.capitalDeployed, { decimals: 0 })}`,
                    `RoC: ${roc}`,
                ].join('<br>') + warn
            },
        },
        xAxis: {
            type: 'value',
            min: -axisBound,
            max: axisBound,
            axisLabel: { formatter: (value: number) => fmt(value) },
            splitLine: { show: true, lineStyle: { color: cssVar('--color-border', '#ccc'), type: 'dashed' } },
            axisLine: { show: true, onZero: true, lineStyle: { color: cssVar('--color-text-secondary', '#888'), width: 1 } },
        },
        yAxis: {
            type: 'category',
            data: categories,
            axisTick: { show: false },
            axisLine: { show: false },
        },
        series: [
            {
                id: 'realized',
                name: 'Realized',
                type: 'bar',
                barGap: '10%',
                barCategoryGap: '38%',
                data: bar(row => row.realizedPL),
                label: {
                    show: true,
                    position: 'outside',
                    formatter: (p: { value?: unknown }) => {
                        const val = Number(p.value);
                        return val === 0 ? '' : fmt(val);
                    },
                },
            },
            {
                id: 'unrealized',
                name: 'Unrealized',
                type: 'bar',
                data: bar(row => row.unrealizedPL, true),
                label: {
                    show: true,
                    position: 'outside',
                    formatter: (p: { value?: unknown }) => {
                        const val = Number(p.value);
                        return val === 0 ? '' : fmt(val);
                    },
                },
            },
        ],
    })

    const chart = this.charts.tickerPL as {
        off?: (event: string) => void
        on?: (event: string, handler: (params: { name?: string }) => void) => void
    }
    chart.off?.('click')
    chart.on?.('click', (params: { name?: string }) => {
        if (params?.name) this.openTradesFilteredByTicker(params.name)
    })
}
