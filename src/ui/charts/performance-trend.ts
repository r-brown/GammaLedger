// src/ui/charts/performance-trend.ts — Combined monthly+cumulative dual-axis chart.
// Uses the .call(this, …) delegation pattern.

import { renderEChart } from './echarts.js'

interface TradeLike { status?: unknown; closedDate?: unknown; openedDate?: unknown; legs?: unknown }

interface LegRealizationLike { realizedMonthly: Map<string, number> }

interface PerformanceTrendContext {
  charts: Record<string, { destroy(): void }>
  cumulativePLRange: string
  trades: TradeLike[]
  getCumulativePLRangeWindow(range: string): { start: Date | null; end: Date | null }
  formatCurrency(value: unknown, opts?: Record<string, unknown>): string
  calculateRealizedPL(trade: unknown): number
  isClosedStatus(status: unknown): boolean
  summarizeLegRealization(trade: TradeLike): LegRealizationLike
  calculateLegCashFlow(leg: unknown): number
}

function toFiniteNumber(v: unknown, fallback = 0): number {
    const n = Number(v)
    return Number.isFinite(n) ? n : fallback
}

function toMonthKey(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(monthKey: string): string {
    const d = new Date(`${monthKey}-01T00:00:00Z`)
    return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' })
}

function computeMonthlyPL(this: PerformanceTrendContext): Map<string, number> {
    const monthly = new Map<string, number>()
    const add = (key: string, amount: number) => { monthly.set(key, (monthly.get(key) ?? 0) + amount) }

    for (const trade of this.trades) {
        // Leg-level realization gate: only cash flows from terminated contract
        // groups count — open debit legs, in-flight covered calls, and active
        // rolling puts contribute nothing until they terminate.
        const { realizedMonthly } = this.summarizeLegRealization(trade)
        let totalOptionCF = 0
        for (const [month, amount] of realizedMonthly) {
            add(month, amount)
            totalOptionCF += amount
        }

        if (this.isClosedStatus(trade.status)) {
            const tradePL = toFiniteNumber(this.calculateRealizedPL(trade))
            const stockPL = tradePL - totalOptionCF
            if (Math.abs(stockPL) > 0.01) {
                const closedDate = String(trade.closedDate ?? trade.openedDate ?? '')
                if (closedDate) add(closedDate.slice(0, 7), stockPL)
            }
        }
    }
    return monthly
}

// Net option premium cash flow per month (broker-cash view): every CALL/PUT
// leg's cash flow in its execution month, open legs included. Answers "what
// cash moved this month", not "what P&L was locked in" — rendered as a
// legend-toggled series, hidden by default.
function computeMonthlyPremiumFlow(this: PerformanceTrendContext): Map<string, number> {
    const monthly = new Map<string, number>()
    for (const trade of this.trades) {
        const legs = Array.isArray(trade.legs) ? trade.legs as Record<string, unknown>[] : []
        for (const leg of legs) {
            const type = String((leg.type ?? '') as string).toUpperCase().trim()
            if (type !== 'CALL' && type !== 'PUT') continue
            const month = String(leg.executionDate ?? '').slice(0, 7)
            if (!month) continue
            const cf = this.calculateLegCashFlow(leg)
            if (Number.isFinite(cf)) monthly.set(month, (monthly.get(month) ?? 0) + cf)
        }
    }
    return monthly
}

export function updatePerformanceTrendChart(this: PerformanceTrendContext): void {
    const root = document.getElementById('performanceTrendChart')
    if (!root) return

    const monthlyMap: Map<string, number> = computeMonthlyPL.call(this)
    const premiumMap: Map<string, number> = computeMonthlyPremiumFlow.call(this)

    // Apply range filter using the range window — always driven from monthlyMap,
    // never from computeCumulativePLSeries (which only processes Closed trades and
    // would drop months where terminated option groups exist on non-Closed trades).
    const { start, end } = this.getCumulativePLRangeWindow(this.cumulativePLRange)
    const startMonth = start ? toMonthKey(start) : null
    const endMonth = end ? toMonthKey(end) : null

    let monthKeys = Array.from(new Set([...monthlyMap.keys(), ...premiumMap.keys()])).sort()
    if (startMonth) monthKeys = monthKeys.filter(k => k >= startMonth)
    if (endMonth) monthKeys = monthKeys.filter(k => k <= endMonth)

    const labels = monthKeys.map(monthLabel)
    const monthlyValues = monthKeys.map(k => Number((monthlyMap.get(k) ?? 0).toFixed(2)))
    const premiumValues = monthKeys.map(k => Number((premiumMap.get(k) ?? 0).toFixed(2)))
    let running = 0
    const cumulativeValues = monthlyValues.map(v => { running += v; return Number(running.toFixed(2)) })

    const fmt = (v: unknown, decimals = 0) => this.formatCurrency(v, { decimals })

    // Default the premium-flow series to hidden, but only on first render —
    // renderEChart merges options, so omitting `selected` afterwards preserves
    // the user's legend toggle across dashboard refreshes.
    const isFirstRender = !this.charts.performanceTrend

    this.charts.performanceTrend = renderEChart(root, this.charts.performanceTrend, {
        aria: { enabled: true },
        grid: { top: 32, right: 56, bottom: 56, left: 56, containLabel: true },
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            formatter: (params: unknown) => {
                const arr = Array.isArray(params) ? params as Array<{ axisValueLabel?: string; seriesName?: string; value?: unknown }> : []
                const head = arr[0]?.axisValueLabel ?? ''
                const body = arr.map(p => `${p.seriesName}: ${fmt(p.value, 2)}`).join('<br>')
                return head ? `${head}<br>${body}` : body
            }
        },
        legend: {
            show: true,
            top: 0,
            left: 'center',
            itemWidth: 12,
            itemHeight: 8,
            textStyle: { color: 'rgba(100, 116, 139, 0.9)', fontSize: 11 },
            data: ['Monthly P&L', 'Premium flow', 'Cumulative'],
            ...(isFirstRender ? { selected: { 'Premium flow': false } } : {})
        },
        xAxis: {
            type: 'category',
            data: labels.length ? labels : ['No Data'],
            axisLabel: { color: 'rgba(100, 116, 139, 0.9)', rotate: 45 },
            axisTick: { show: false }
        },
        yAxis: [
            {
                type: 'value',
                name: 'Monthly',
                position: 'left',
                nameTextStyle: { color: 'rgba(100, 116, 139, 0.9)', fontSize: 10 },
                axisLabel: { color: 'rgba(100, 116, 139, 0.9)', formatter: (v: unknown) => fmt(v, 0) },
                splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.16)' } }
            },
            {
                type: 'value',
                name: 'Cumulative',
                position: 'right',
                nameTextStyle: { color: '#534AB7', fontSize: 10 },
                axisLabel: { color: '#534AB7', formatter: (v: unknown) => fmt(v, 0) },
                splitLine: { show: false }
            }
        ],
        series: [
            {
                type: 'bar',
                name: 'Monthly P&L',
                yAxisIndex: 0,
                data: monthlyValues.map(v => ({
                    value: v,
                    itemStyle: { color: v >= 0 ? '#1FB8CD' : '#B4413C' }
                })),
                barMaxWidth: 42
            },
            {
                type: 'line',
                name: 'Cumulative',
                yAxisIndex: 1,
                data: cumulativeValues,
                showSymbol: true,
                symbolSize: 5,
                smooth: 0.3,
                lineStyle: { color: '#534AB7', width: 2 },
                itemStyle: { color: '#534AB7' }
            },
            {
                type: 'bar',
                name: 'Premium flow',
                yAxisIndex: 0,
                data: premiumValues.map(v => ({
                    value: v,
                    itemStyle: { color: v >= 0 ? '#94A3B8' : '#E8A33D' }
                })),
                barMaxWidth: 42
            }
        ]
    })
}
