// src/ui/charts/cumulative-pl.ts — Wave 9: Cumulative P&L chart.
// Uses the .call(this, …) delegation pattern.

import { renderEChart } from './echarts.js'

interface CumulativePLSeries {
  labels: string[]
  dataPoints: number[]
  dates: Date[]
}

interface CumulativePLContext {
  charts: Record<string, { destroy(): void }>
  cumulativePLRange: string
  normalizeCumulativePLRange(range: string): string
  setCumulativePLRange(range: string): void
  syncCumulativePLControls(): void
  computeCumulativePLSeries(range: string): CumulativePLSeries | null
  formatCurrency(value: unknown, opts?: Record<string, unknown>): string
  updateStrategyPerformanceChart(): void
  updateWinRateByStrategyChart(): void
  updateCommissionImpactChart(): void
  renderTickerHeatmap(): void
  refreshShareCardChart(): void
  updateCumulativePLChart(): void
}

export function initializeCumulativePLControls(this: CumulativePLContext): void {
    const controls = document.getElementById('cumulative-pl-controls');
    if (!controls) {
        return;
    }

    if (controls.dataset.initialized === 'true') {
        this.syncCumulativePLControls();
        return;
    }

    controls.addEventListener('click', (event) => {
        const target = event.target instanceof HTMLElement
            ? event.target.closest('button[data-range]')
            : null;
        if (!target) {
            return;
        }

        const { range } = (target as HTMLElement).dataset;
        if (!range) {
            return;
        }

        this.setCumulativePLRange(range);
    });

    controls.dataset.initialized = 'true';
    this.syncCumulativePLControls();
}

export function setCumulativePLRange(this: CumulativePLContext, range: string): void {
    const normalized = this.normalizeCumulativePLRange(range);
    if (normalized === this.cumulativePLRange) {
        return;
    }

    this.cumulativePLRange = normalized;
    this.syncCumulativePLControls();
    this.updateCumulativePLChart();
    this.refreshShareCardChart();
    this.updateStrategyPerformanceChart();
    this.updateWinRateByStrategyChart();
    this.updateCommissionImpactChart();
    this.renderTickerHeatmap();
}

export function syncCumulativePLControls(this: CumulativePLContext): void {
    const controls = document.getElementById('cumulative-pl-controls');
    if (!controls) {
        return;
    }

    const currentRange = this.normalizeCumulativePLRange(this.cumulativePLRange);
    controls.querySelectorAll('button[data-range]').forEach((button) => {
        const buttonRange = this.normalizeCumulativePLRange((button as HTMLElement).dataset.range ?? '');
        const isActive = buttonRange === currentRange;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', String(isActive));
    });
}

export function updateCumulativePLChart(this: CumulativePLContext): void {
    const root = document.getElementById('cumulativePLChart');
    if (!root) {
        console.error('Cumulative P&L chart root not found');
        return;
    }

    const formatCurrencyValue = (value: unknown, decimals = 2) => this.formatCurrency(value, { decimals });
    const series = this.computeCumulativePLSeries(this.cumulativePLRange);

    if (!series || !series.labels.length || !series.dataPoints.length) {
        this.charts.cumulativePL = renderEChart(root, this.charts.cumulativePL, {
            aria: { enabled: true },
            grid: { top: 12, right: 18, bottom: 42, left: 10, containLabel: true },
            tooltip: { show: false },
            xAxis: {
                type: 'category',
                data: ['No Data'],
                axisTick: { show: false },
                axisLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.16)' } },
                axisLabel: { color: 'rgba(100, 116, 139, 0.9)' }
            },
            yAxis: {
                type: 'value',
                axisLabel: { color: 'rgba(100, 116, 139, 0.9)', formatter: (value: unknown) => formatCurrencyValue(value, 0) },
                splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.16)' } }
            },
            series: [{
                type: 'line',
                name: 'Cumulative P&L',
                data: [0],
                showSymbol: false,
                lineStyle: { color: '#1FB8CD', width: 2 },
                areaStyle: { color: 'rgba(31, 184, 205, 0.1)' }
            }]
        });
        return;
    }

    this.charts.cumulativePL = renderEChart(root, this.charts.cumulativePL, {
        aria: { enabled: true },
        grid: { top: 12, right: 18, bottom: 54, left: 10, containLabel: true },
        tooltip: {
            trigger: 'axis',
            formatter: (params: unknown) => {
                const item = Array.isArray(params) ? params[0] as { axisValueLabel?: string; value?: unknown } : null;
                return item ? `${item.axisValueLabel || ''}<br>Cumulative P&L: ${formatCurrencyValue(item.value)}` : '';
            }
        },
        xAxis: {
            type: 'category',
            data: series.labels,
            axisTick: { show: false },
            axisLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.16)' } },
            axisLabel: { color: 'rgba(100, 116, 139, 0.9)', rotate: 45 }
        },
        yAxis: {
            type: 'value',
            axisLabel: { color: 'rgba(100, 116, 139, 0.9)', formatter: (value: unknown) => formatCurrencyValue(value, 0) },
            splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.16)' } }
        },
        series: [{
            type: 'line',
            name: 'Cumulative P&L',
            data: series.dataPoints,
            showSymbol: true,
            symbolSize: 6,
            smooth: 0.35,
            lineStyle: { color: '#1FB8CD', width: 2 },
            itemStyle: { color: '#1FB8CD' },
            areaStyle: { color: 'rgba(31, 184, 205, 0.1)' }
        }]
    });
}
