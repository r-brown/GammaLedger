// src/ui/charts/performance-trend.ts — Combined monthly+cumulative dual-axis chart.
// Uses the .call(this, …) delegation pattern.

import { renderEChart } from './echarts.js'

interface CumulativePLSeries {
  labels: string[]
  dataPoints: number[]
  dates: Date[]
}

interface TradeLike { status?: unknown; closedDate?: unknown; openedDate?: unknown; legs?: unknown }

interface PerformanceTrendContext {
  charts: Record<string, { destroy(): void }>
  cumulativePLRange: string
  trades: TradeLike[]
  computeCumulativePLSeries(range: string): CumulativePLSeries | null
  formatCurrency(value: unknown, opts?: Record<string, unknown>): string
  calculateLegCashFlow(leg: unknown): number
  calculateRealizedPL(trade: unknown): number
  isClosedStatus(status: unknown): boolean
}

function toFiniteNumber(v: unknown, fallback = 0): number {
    const n = Number(v)
    return Number.isFinite(n) ? n : fallback
}

function monthLabel(monthKey: string): string {
    const d = new Date(`${monthKey}-01T00:00:00Z`)
    return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' })
}

function computeMonthlyPL(this: PerformanceTrendContext): Map<string, number> {
    const monthly = new Map<string, number>()
    const add = (key: string, amount: number) => { monthly.set(key, (monthly.get(key) ?? 0) + amount) }

    for (const trade of this.trades) {
        const legs = Array.isArray(trade.legs) ? trade.legs as Record<string, unknown>[] : []
        const hasOptionLegs = legs.some(leg => {
            const t = String((leg.type ?? '') as string).toUpperCase().trim()
            return t === 'CALL' || t === 'PUT'
        })
        if (!hasOptionLegs) continue

        let totalOptionCF = 0
        for (const leg of legs) {
            const legType = String((leg.type ?? '') as string).toUpperCase().trim()
            if (legType === 'STOCK' || legType === 'CASH') continue
            const dateStr = String(leg.executionDate ?? '')
            if (!dateStr) continue
            const cf = this.calculateLegCashFlow(leg)
            if (Number.isFinite(cf)) {
                add(dateStr.slice(0, 7), cf)
                totalOptionCF += cf
            }
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

export function updatePerformanceTrendChart(this: PerformanceTrendContext): void {
    const root = document.getElementById('performanceTrendChart')
    if (!root) return

    const cumulative = this.computeCumulativePLSeries(this.cumulativePLRange)
    const monthlyMap: Map<string, number> = computeMonthlyPL.call(this)

    const toMonthKey = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

    let monthKeys: string[]
    if (cumulative && cumulative.dates.length) {
        const set = new Set<string>()
        for (const d of cumulative.dates) set.add(toMonthKey(d))
        monthKeys = Array.from(set).sort()
    } else {
        monthKeys = Array.from(monthlyMap.keys()).sort()
    }

    const labels = monthKeys.map(monthLabel)
    const monthlyValues = monthKeys.map(k => Number((monthlyMap.get(k) ?? 0).toFixed(2)))
    let running = 0
    const cumulativeValues = monthlyValues.map(v => { running += v; return Number(running.toFixed(2)) })

    const fmt = (v: unknown, decimals = 0) => this.formatCurrency(v, { decimals })

    this.charts.performanceTrend = renderEChart(root, this.charts.performanceTrend, {
        aria: { enabled: true },
        grid: { top: 24, right: 56, bottom: 56, left: 56, containLabel: true },
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
        legend: { show: false },
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
                barMaxWidth: 28
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
            }
        ]
    })
}
