// src/ui/charts/performance-trend.ts — Combined monthly+cumulative dual-axis chart.
// Uses the .call(this, …) delegation pattern.

import { renderEChart } from './echarts.js'

interface TradeLike { status?: unknown; closedDate?: unknown; openedDate?: unknown; legs?: unknown }

interface LegRealizationLike {
  realizedMonthly: Map<string, number>
  openByExpiryMonth: Map<string, number>
}

interface PerformanceTrendContext {
  charts: Record<string, { destroy(): void }>
  cumulativePLRange: string
  trades: TradeLike[]
  latestStats: { unrealizedPL?: unknown } | null
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

function computeMonthlyPL(this: PerformanceTrendContext): { realized: Map<string, number>; pending: Map<string, number> } {
    const realized = new Map<string, number>()
    const pending = new Map<string, number>()
    const add = (map: Map<string, number>, key: string, amount: number) => {
        map.set(key, (map.get(key) ?? 0) + amount)
    }

    for (const trade of this.trades) {
        // Leg-level realization gate: only cash flows from terminated contract
        // groups count — open debit legs, in-flight covered calls, and active
        // rolling puts contribute nothing until they terminate.
        const { realizedMonthly, openByExpiryMonth } = this.summarizeLegRealization(trade)
        let totalOptionCF = 0
        for (const [month, amount] of realizedMonthly) {
            add(realized, month, amount)
            totalOptionCF += amount
        }

        // Pending premium: cash booked on open option groups, shown in the
        // month those contracts expire — the forward-looking "premium
        // calendar" a CSP/wheel seller works against.
        for (const [month, amount] of openByExpiryMonth) {
            add(pending, month, amount)
        }

        if (this.isClosedStatus(trade.status)) {
            const tradePL = toFiniteNumber(this.calculateRealizedPL(trade))
            const stockPL = tradePL - totalOptionCF
            if (Math.abs(stockPL) > 0.01) {
                const closedDate = String(trade.closedDate ?? trade.openedDate ?? '')
                if (closedDate) add(realized, closedDate.slice(0, 7), stockPL)
            }
        }
    }
    return { realized, pending }
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

    const { realized: monthlyMap, pending: pendingMap } = computeMonthlyPL.call(this)
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

    // Pending premium is "now" state keyed by future expirations — it bypasses
    // the lookback end filter so upcoming expiry months always stay visible.
    const lastHistoryKey = monthKeys.length ? monthKeys[monthKeys.length - 1] : null
    monthKeys = Array.from(new Set([...monthKeys, ...pendingMap.keys()])).sort()

    const labels = monthKeys.map(monthLabel)
    // Index of the last month with realized/premium history — pending-only
    // future months sit past it and carry no bars, cumulative, or MTM point.
    const lastHistoryIdx = lastHistoryKey ? monthKeys.indexOf(lastHistoryKey) : -1
    const monthlyValues = monthKeys.map((k, i) =>
        i <= lastHistoryIdx ? Number((monthlyMap.get(k) ?? 0).toFixed(2)) : null)
    const premiumValues = monthKeys.map((k, i) =>
        i <= lastHistoryIdx ? Number((premiumMap.get(k) ?? 0).toFixed(2)) : null)
    const pendingValues = monthKeys.map(k => {
        const v = pendingMap.get(k)
        return v === undefined ? null : Number(v.toFixed(2))
    })

    // Carry the pre-range balance into the cumulative line: "Cumulative" keeps
    // broker-statement semantics (all-time running realized P&L) instead of
    // resetting to zero at the window start when a range filter is active.
    let running = 0
    if (startMonth) {
        for (const [month, amount] of monthlyMap) {
            if (month < startMonth) running += amount
        }
    }
    const cumulativeValues: Array<number | null> = monthlyValues.map(v => {
        if (v === null) return null
        running += v
        return Number(running.toFixed(2))
    })

    // Mark-to-market exists only for "now" — historical quotes are not stored —
    // so the incl.-unrealized overlay is a single point on the latest history
    // month (cumulative realized + current open-position MTM), not a fabricated series.
    const unrealizedNow = toFiniteNumber(this.latestStats?.unrealizedPL)
    const inclUnrealizedValues: Array<number | null> = monthKeys.map(() => null)
    if (lastHistoryIdx >= 0) {
        const cumAtLast = cumulativeValues[lastHistoryIdx]
        if (cumAtLast !== null) {
            inclUnrealizedValues[lastHistoryIdx] = Number((cumAtLast + unrealizedNow).toFixed(2))
        }
    }

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
                const rows = arr.filter(p => Number.isFinite(Number(p.value)))
                const head = rows[0]?.axisValueLabel ?? arr[0]?.axisValueLabel ?? ''
                const body = rows.map(p => `${p.seriesName}: ${fmt(p.value, 2)}`).join('<br>')
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
            data: ['Monthly P&L', 'Pending by expiry', 'Premium flow', 'Cumulative', 'Incl. unrealized'],
            ...(isFirstRender ? { selected: { 'Premium flow': false, 'Incl. unrealized': false } } : {})
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
                data: monthlyValues.map(v => (v === null ? null : {
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
                data: premiumValues.map(v => (v === null ? null : {
                    value: v,
                    itemStyle: { color: v >= 0 ? '#94A3B8' : '#E8A33D' }
                })),
                barMaxWidth: 42
            },
            {
                // Forward-looking premium calendar: net cash booked on open
                // option groups, in their expiration month. Dashed outline +
                // translucent fill signal "not yet earned".
                type: 'bar',
                name: 'Pending by expiry',
                yAxisIndex: 0,
                data: pendingValues.map(v => (v === null ? null : {
                    value: v,
                    itemStyle: {
                        color: v >= 0 ? 'rgba(31, 184, 205, 0.25)' : 'rgba(180, 65, 60, 0.25)',
                        borderColor: v >= 0 ? '#1FB8CD' : '#B4413C',
                        borderWidth: 1,
                        borderType: 'dashed'
                    }
                })),
                barMaxWidth: 42
            },
            {
                type: 'line',
                name: 'Incl. unrealized',
                yAxisIndex: 1,
                data: inclUnrealizedValues,
                showSymbol: true,
                symbol: 'diamond',
                symbolSize: 10,
                lineStyle: { width: 0 },
                itemStyle: { color: '#E8A33D' }
            }
        ]
    })
}
