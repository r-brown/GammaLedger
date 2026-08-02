// src/ui/charts/payoff.ts — P&L-at-expiration risk graph.
// Rendered via renderEChart (never a raw ECharts init on an existing root).

import { renderEChart } from './echarts.js'
import type { PayoffResult } from '@calculations/payoff.js'

interface PayoffChartContext {
  charts: Record<string, unknown>
  formatCurrency(value: unknown, opts?: Record<string, unknown>): string
}

function cssVar(name: string, fallback: string): string {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    return value || fallback
}

export function renderPayoffChart(
    this: PayoffChartContext,
    targetId: string,
    chartKey: string,
    payoff: PayoffResult,
    opts: { spot?: number | null; title?: string } = {}
): void {
    const target = document.getElementById(targetId)
    if (!target) return

    const profitColor = cssVar('--color-ticker-pl-profit', '#0F8A63')
    const lossColor = cssVar('--color-ticker-pl-loss', '#C0392B')
    const textColor = cssVar('--color-text-secondary', '#666')

    const markLines: Record<string, unknown>[] = payoff.breakevens.map(be => ({
        xAxis: be,
        label: { formatter: `BE ${be.toFixed(2)}`, color: textColor, fontSize: 10 },
        lineStyle: { type: 'dashed', color: textColor }
    }))
    if (typeof opts.spot === 'number' && opts.spot > 0) {
        markLines.push({
            xAxis: opts.spot,
            label: { formatter: `now ${opts.spot.toFixed(2)}`, color: textColor, fontSize: 10 },
            lineStyle: { type: 'solid', width: 1.5 }
        })
    }

    const option = {
        aria: { enabled: true },
        grid: { left: 64, right: 24, top: 32, bottom: 40 },
        tooltip: {
            trigger: 'axis',
            valueFormatter: (value: unknown) => this.formatCurrency(value)
        },
        xAxis: {
            type: 'value',
            min: payoff.points[0]?.[0],
            max: payoff.points[payoff.points.length - 1]?.[0],
            axisLabel: { color: textColor },
            name: opts.title ?? 'Underlying at expiration',
            nameLocation: 'middle',
            nameGap: 28,
            nameTextStyle: { color: textColor, fontSize: 11 }
        },
        yAxis: {
            type: 'value',
            axisLabel: {
                color: textColor,
                formatter: (value: number) => this.formatCurrency(value, { decimals: 0 })
            },
            splitLine: { lineStyle: { opacity: 0.3 } }
        },
        visualMap: {
            show: false,
            dimension: 1,
            pieces: [
                { gt: 0, color: profitColor },
                { lte: 0, color: lossColor }
            ]
        },
        series: [{
            type: 'line',
            data: payoff.points,
            showSymbol: false,
            lineStyle: { width: 2 },
            areaStyle: { opacity: 0.12 },
            markLine: {
                symbol: 'none',
                silent: true,
                data: markLines
            }
        }]
    }

    this.charts[chartKey] = renderEChart(target, this.charts[chartKey], option, { notMerge: true })
}
