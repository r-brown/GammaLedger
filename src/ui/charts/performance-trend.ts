// src/ui/charts/performance-trend.ts — Combined monthly+cumulative dual-axis chart.
// Uses the .call(this, …) delegation pattern.

import { renderEChart } from './echarts.js'
import {
    bucketKeyOf,
    bucketLabel,
    enumerateBuckets,
    rollUpBuckets,
    rollUpNestedBuckets,
    type Granularity
} from '@calculations/time-buckets.js'

interface TradeLike {
  ticker?: unknown
  status?: unknown
  closedDate?: unknown
  openedDate?: unknown
  legs?: unknown
}

interface LegRealizationLike {
  realizedByDate: Map<string, number>
  openByExpiryDate: Map<string, number>
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
  resolveGranularity(): Granularity
}

function toFiniteNumber(v: unknown, fallback = 0): number {
    const n = Number(v)
    return Number.isFinite(n) ? n : fallback
}

function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

// getCumulativePLRangeWindow builds LOCAL-time boundaries; enumerateBuckets and
// bucketKeyOf read UTC fields. Re-anchor the local calendar day at UTC midnight so
// a UTC+N timezone cannot shift the window a day (and, at month grain, a month).
function toUtcAnchoredDay(d: Date): Date {
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return new Date(`${iso}T00:00:00Z`)
}

/** UTC midnight of a bucket key — month keys ('2026-07') anchor on the 1st.
 *  Defense in depth for Finding 1: `bucketKeyOf` now guarantees every key
 *  reaching this module is a valid calendar date, but a future caller could
 *  still hand this an unvalidated string — falling back to today (rather
 *  than letting an Invalid Date reach `.toISOString()`, which throws and
 *  used to abort every chart after this one in `updateAllCharts`) keeps a
 *  bad key from taking down the whole dashboard. */
function bucketKeyToDate(key: string): Date {
    const iso = key.length === 7 ? `${key}-01` : key
    const parsed = new Date(`${iso}T00:00:00Z`)
    if (Number.isNaN(parsed.getTime())) {
        console.error(`performance-trend: unparseable bucket key "${key}", falling back to today`)
        return toUtcAnchoredDay(new Date())
    }
    return parsed
}

function computeRealizedByDate(this: PerformanceTrendContext): {
    realized: Map<string, number>
    pending: Map<string, number>
    realizedByTicker: Map<string, Map<string, number>>
} {
    const realized = new Map<string, number>()
    const pending = new Map<string, number>()
    // Per-date, per-ticker attribution of the SAME amounts that land in
    // `realized`. Written from the same loop iterations so the breakdown can
    // never drift from the total it explains — there is no second pass that
    // could apply a different realization gate.
    const realizedByTicker = new Map<string, Map<string, number>>()
    const add = (map: Map<string, number>, key: string, amount: number) => {
        map.set(key, (map.get(key) ?? 0) + amount)
    }
    const attribute = (date: string, ticker: string, amount: number) => {
        let perTicker = realizedByTicker.get(date)
        if (!perTicker) {
            perTicker = new Map<string, number>()
            realizedByTicker.set(date, perTicker)
        }
        perTicker.set(ticker, (perTicker.get(ticker) ?? 0) + amount)
    }

    for (const trade of this.trades) {
        const ticker = String(trade.ticker ?? '').trim().toUpperCase() || 'UNKNOWN'

        // Leg-level realization gate: only cash flows from terminated contract
        // groups count — open debit legs, in-flight covered calls, and active
        // rolling puts contribute nothing until they terminate.
        const { realizedByDate, openByExpiryDate } = this.summarizeLegRealization(trade)
        let totalOptionCF = 0
        for (const [date, amount] of realizedByDate) {
            add(realized, date, amount)
            attribute(date, ticker, amount)
            totalOptionCF += amount
        }

        // Pending premium: cash booked on open option groups, shown on the
        // date those contracts expire — the forward-looking "premium
        // calendar" a CSP/wheel seller works against.
        for (const [date, amount] of openByExpiryDate) {
            add(pending, date, amount)
        }

        if (this.isClosedStatus(trade.status)) {
            const tradePL = toFiniteNumber(this.calculateRealizedPL(trade))
            const stockPL = tradePL - totalOptionCF
            if (Math.abs(stockPL) > 0.01) {
                const closedDate = String(trade.closedDate ?? trade.openedDate ?? '').slice(0, 10)
                if (closedDate) {
                    add(realized, closedDate, stockPL)
                    attribute(closedDate, ticker, stockPL)
                }
            }
        }
    }
    return { realized, pending, realizedByTicker }
}

// Net option premium cash flow per date (broker-cash view): every CALL/PUT
// leg's cash flow on its execution date, open legs included. Answers "what
// cash moved", not "what P&L was locked in" — rendered as a legend-toggled
// series, hidden by default.
function computePremiumFlowByDate(this: PerformanceTrendContext): Map<string, number> {
    const byDate = new Map<string, number>()
    for (const trade of this.trades) {
        const legs = Array.isArray(trade.legs) ? trade.legs as Record<string, unknown>[] : []
        for (const leg of legs) {
            const type = String((leg.type ?? '') as string).toUpperCase().trim()
            if (type !== 'CALL' && type !== 'PUT') continue
            const date = String(leg.executionDate ?? '').slice(0, 10)
            if (!date) continue
            const cf = this.calculateLegCashFlow(leg)
            if (Number.isFinite(cf)) byDate.set(date, (byDate.get(date) ?? 0) + cf)
        }
    }
    return byDate
}

export function updatePerformanceTrendChart(this: PerformanceTrendContext): void {
    const root = document.getElementById('performanceTrendChart')
    if (!root) return

    const granularity: Granularity = this.resolveGranularity()
    const grainLabel = granularity === 'day' ? 'Daily'
        : granularity === 'week' ? 'Weekly'
        : 'Monthly'
    const realizedSeriesName = `${grainLabel} P&L`
    const {
        realized: realizedByDate,
        pending: pendingByDate,
        realizedByTicker
    } = computeRealizedByDate.call(this)
    const premiumByDate: Map<string, number> = computePremiumFlowByDate.call(this)

    const monthlyMap = rollUpBuckets(realizedByDate, granularity)
    const pendingMap = rollUpBuckets(pendingByDate, granularity)
    const premiumMap = rollUpBuckets(premiumByDate, granularity)
    // Same key derivation as monthlyMap above, so each ticker's contribution
    // lands in the bucket whose bar it is part of.
    const tickerMap = rollUpNestedBuckets(realizedByTicker, granularity)

    // Apply range filter using the range window — always driven from monthlyMap,
    // never from computeCumulativePLSeries (which only processes Closed trades and
    // would drop months where terminated option groups exist on non-Closed trades).
    const { start, end } = this.getCumulativePLRangeWindow(this.cumulativePLRange)

    // ALL range yields { start: null, end: null } — substitute the data extent.
    const historyKeys = [...new Set([...monthlyMap.keys(), ...premiumMap.keys()])].sort()
    // Genuinely no data (no realized history, no premium history, no pending
    // premium) — e.g. a freshly started blank database. Restore the explicit
    // empty state instead of fabricating an axis around today's bucket.
    const hasData = historyKeys.length > 0 || pendingMap.size > 0
    const firstKey = historyKeys[0] ?? bucketKeyOf(new Date().toISOString().slice(0, 10), granularity)
    const lastKey = historyKeys[historyKeys.length - 1] ?? firstKey

    const windowStart = start ? toUtcAnchoredDay(start) : bucketKeyToDate(firstKey)
    const windowEnd = end ? toUtcAnchoredDay(end) : bucketKeyToDate(lastKey)

    const startKey = bucketKeyOf(windowStart.toISOString().slice(0, 10), granularity)
    const endKey = bucketKeyOf(windowEnd.toISOString().slice(0, 10), granularity)

    // Enumerate every bucket in the window so empty periods render as real gaps.
    let bucketKeys = hasData ? enumerateBuckets(windowStart, windowEnd, granularity) : []

    // Last bucket carrying realized/premium history. Restricted to enumerated
    // buckets so a weekend-dated key (dropped at day grain) cannot yield -1.
    const enumerated = new Set(bucketKeys)
    const lastHistoryKey = historyKeys
        .filter(k => k >= startKey && k <= endKey && enumerated.has(k))
        .pop() ?? null

    // Pending premium is "now" state keyed by future expirations — it bypasses
    // the lookback end filter so upcoming expiry months always stay visible. At
    // day/week grain that would stretch the axis months into the future, so the
    // whole series is month-only.
    if (granularity === 'month') {
        bucketKeys = [...new Set([...bucketKeys, ...pendingMap.keys()])].sort()
    }

    const labels = bucketKeys.map(key => bucketLabel(key, granularity))
    // Index of the last bucket with realized/premium history — pending-only
    // future buckets sit past it and carry no bars, cumulative, or MTM point.
    const lastHistoryIdx = lastHistoryKey ? bucketKeys.indexOf(lastHistoryKey) : -1
    const monthlyValues = bucketKeys.map((k, i) =>
        i <= lastHistoryIdx ? Number((monthlyMap.get(k) ?? 0).toFixed(2)) : null)
    const premiumValues = bucketKeys.map((k, i) =>
        i <= lastHistoryIdx ? Number((premiumMap.get(k) ?? 0).toFixed(2)) : null)
    const pendingValues = bucketKeys.map(k => {
        const v = pendingMap.get(k)
        return v === undefined ? null : Number(v.toFixed(2))
    })

    // Carry the pre-range balance into the cumulative line: "Cumulative" keeps
    // broker-statement semantics (all-time running realized P&L) instead of
    // resetting to zero at the window start when a range filter is active.
    //
    // Finding 3: the sweep walks EVERY key in monthlyMap in chronological
    // order, not just the ones enumerateBuckets chose to display as a bar.
    // At day granularity a weekend-dated realization stays in monthlyMap
    // (rollUpBuckets does not filter it) but enumerateBuckets omits it from
    // bucketKeys/monthlyValues, so summing monthlyValues alone would drop
    // that amount from the running total forever. Sweeping monthlyMap
    // directly, keyed to each displayed bucket's own key, folds it in as
    // soon as its chronological position is passed — money is never read
    // from monthlyValues for the cumulative line, only from monthlyMap.
    const monthlyEntries = [...monthlyMap.entries()]
    let running = 0
    let sweepIdx = 0
    if (startKey) {
        while (sweepIdx < monthlyEntries.length && monthlyEntries[sweepIdx][0] < startKey) {
            running += monthlyEntries[sweepIdx][1]
            sweepIdx++
        }
    }
    const cumulativeValues: Array<number | null> = monthlyValues.map((v, i) => {
        if (v === null) return null
        const key = bucketKeys[i]
        while (
            sweepIdx < monthlyEntries.length &&
            monthlyEntries[sweepIdx][0] <= key &&
            (!endKey || monthlyEntries[sweepIdx][0] <= endKey)
        ) {
            running += monthlyEntries[sweepIdx][1]
            sweepIdx++
        }
        return Number(running.toFixed(2))
    })

    // A weekend-dated (or otherwise unenumerated) key chronologically AFTER
    // the last displayed bucket but still inside the window has no bucket
    // index to be swept into above — the map() above stops at the last
    // non-null index. Sweep any such leftover into the running total and
    // fold it into the final displayed cumulative point, so the window's
    // last "Cumulative" value always equals the true sum of every in-window
    // realized amount, not just the ones that landed on a displayed bar.
    while (sweepIdx < monthlyEntries.length && (!endKey || monthlyEntries[sweepIdx][0] <= endKey)) {
        running += monthlyEntries[sweepIdx][1]
        sweepIdx++
    }
    if (lastHistoryIdx >= 0 && cumulativeValues[lastHistoryIdx] !== null) {
        cumulativeValues[lastHistoryIdx] = Number(running.toFixed(2))
    }

    // Mark-to-market exists only for "now" — historical quotes are not stored —
    // so the incl.-unrealized overlay is a single point on the latest history
    // month (cumulative realized + current open-position MTM), not a fabricated series.
    const unrealizedNow = toFiniteNumber(this.latestStats?.unrealizedPL)
    const inclUnrealizedValues: Array<number | null> = bucketKeys.map(() => null)
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
            // The per-ticker breakdown can outgrow the tooltip on a busy month,
            // so the tooltip must be reachable by the mouse to be scrolled.
            // `confine` keeps it inside the chart box and `hideDelay` leaves
            // time to travel into it without the tooltip vanishing en route.
            enterable: true,
            confine: true,
            hideDelay: 240,
            extraCssText: 'max-height: 320px; overflow-y: auto; overflow-x: hidden;',
            formatter: (params: unknown) => {
                const arr = Array.isArray(params) ? params as Array<{ axisValueLabel?: string; seriesName?: string; value?: unknown; dataIndex?: unknown }> : []
                const rows = arr.filter(p => Number.isFinite(Number(p.value)))
                const head = rows[0]?.axisValueLabel ?? arr[0]?.axisValueLabel ?? ''
                const body = rows.map(p => `${p.seriesName}: ${fmt(p.value, 2)}`).join('<br>')
                const summary = head ? `${head}<br>${body}` : body

                // Attribute the realized bar only. Requiring that series to be
                // present with a real number covers, in one gate, a bucket with
                // no realized activity, a pending-only future bucket past
                // `lastHistoryIdx`, and the user toggling the series off.
                const realizedRow = arr.find(p =>
                    p.seriesName === realizedSeriesName &&
                    p.value !== null && p.value !== undefined &&
                    Number.isFinite(Number(p.value)))
                if (!realizedRow) return summary

                const key = bucketKeys[Number(realizedRow.dataIndex)]
                const contributions = key ? tickerMap.get(key) : undefined
                if (!contributions) return summary

                // Already sorted by descending magnitude by rollUpNestedBuckets.
                // Sub-cent contributions are noise from rolled-up rounding.
                const detail = [...contributions.entries()]
                    .filter(([, amount]) => Math.abs(amount) >= 0.005)
                    .map(([ticker, amount]) => {
                        const tone = amount > 0 ? ' gl-tt__amt--pos' : amount < 0 ? ' gl-tt__amt--neg' : ''
                        // Ticker is imported/user data reaching innerHTML.
                        return `<div class="gl-tt__row"><span class="gl-tt__sym">${escapeHtml(ticker)}</span>`
                            + `<span class="gl-tt__amt${tone}">${escapeHtml(fmt(amount, 2))}</span></div>`
                    })
                if (!detail.length) return summary

                return `${summary}<div class="gl-tt__break">`
                    + `<div class="gl-tt__head">Realized by ticker</div>${detail.join('')}</div>`
            }
        },
        legend: {
            show: true,
            top: 0,
            left: 'center',
            itemWidth: 12,
            itemHeight: 8,
            textStyle: { color: 'rgba(100, 116, 139, 0.9)', fontSize: 11 },
            data: [
                realizedSeriesName,
                ...(granularity === 'month' ? ['Pending by expiry'] : []),
                'Premium flow', 'Cumulative', 'Incl. unrealized',
            ],
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
                name: grainLabel,
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
                id: 'realized',
                type: 'bar',
                name: realizedSeriesName,
                yAxisIndex: 0,
                data: monthlyValues.map(v => (v === null ? null : {
                    value: v,
                    itemStyle: { color: v >= 0 ? '#1FB8CD' : '#B4413C' }
                })),
                barMaxWidth: 42
            },
            {
                id: 'cumulative',
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
                id: 'premium',
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
                id: 'inclUnrealized',
                type: 'line',
                name: 'Incl. unrealized',
                yAxisIndex: 1,
                data: inclUnrealizedValues,
                showSymbol: true,
                symbol: 'diamond',
                symbolSize: 10,
                lineStyle: { width: 0 },
                itemStyle: { color: '#E8A33D' }
            },
            // Kept last in the array: when this conditional series is absent,
            // `getOption()` only trims a *trailing* hole left by replaceMerge
            // (ECharts nulls out — but does not splice — a removed id-matched
            // component; only a contiguous run of trailing nulls shortens the
            // returned array). Placed before another always-present series,
            // the hole would sit mid-array and getOption().series would
            // contain a stray `null` entry instead of 4 clean series.
            ...(granularity === 'month' ? [{
                // Forward-looking premium calendar: net cash booked on open
                // option groups, in their expiration month. Dashed outline +
                // translucent fill signal "not yet earned".
                id: 'pending',
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
            }] : [])
        ]
    // The pending series exists only at month grain. ECharts merges series by
    // index, so a shrinking array would otherwise leave the stale bar on the
    // canvas — replaceMerge drops components absent from the new option. Each
    // series carries a stable `id` so replaceMerge matches the four persistent
    // series by identity (keeping their update animations) and only adds/removes
    // the pending one — without ids, replaceMerge treats every series as brand
    // new on every call, killing bar/line transition animations chart-wide.
    }, { replaceMerge: ['series'] })
}
