// src/ui/charts/dashboard-charts.ts — Dashboard chart updates.
// Uses the .call(this, …) delegation pattern.

import {
    disposeChartInstance,
    renderEChart,
    type GammaChartOption
} from './echarts.js'

type TradeRecord = Record<string, unknown>

interface TickerPerformanceResult {
  items: Array<{ ticker: string; totalPL: number; tradeCount: number; winRate: number }>
  maxMagnitude: number
}

interface DashboardChartsContext {
  charts: Record<string, unknown>
  trades: TradeRecord[]
  latestStats: Record<string, unknown> | null
  isClosedStatus(status: unknown): boolean
  isFullyRealizedTrade(trade: TradeRecord): boolean
  isWheelOrPmccTrade(trade: TradeRecord): boolean
  calculateRealizedPL(trade: TradeRecord): number
  calculateLegCashFlow(leg: Record<string, unknown>): number
  getClosedTradesInRange(): TradeRecord[]
  formatCurrency(value: unknown, opts?: Record<string, unknown>): string
  formatNumber(value: unknown, opts: Record<string, unknown>): string | null
  formatPercent(value: unknown, fallback: string, opts?: Record<string, unknown>): string
  calculateTickerPerformance(trades: TradeRecord[]): TickerPerformanceResult | null
  generateMonteCarloProjection(dailyReturns: number[], opts?: { periods?: number; simulations?: number }): Record<string, unknown> | null
  openTradesFilteredByTicker(ticker: unknown): void
  openTradesFilteredByStrategy(strategy: unknown): void
  renderRatioGauge(opts: RatioGaugeOptions): void
  updateMonthlyPLChart(): void
  updateCumulativePLChart(): void
  updateStrategyPerformanceChart(): void
  updateWinRateByStrategyChart(): void
  updatePerformanceGauges(): void
  updateCommissionImpactChart(): void
  updateTimeInTradeChart(): void
  updateMonteCarloChart(): void
  renderTickerHeatmap(): void
}

interface RatioGaugeOptions {
  chartKey: string
  canvasId: string
  valueElementId: string
  value: number | undefined
  min?: number
  max?: number
}

interface MonteCarloOptions {
  periods?: number
  simulations?: number
}

const AXIS_TEXT_COLOR = 'rgba(100, 116, 139, 0.9)';
const GRID_LINE_COLOR = 'rgba(148, 163, 184, 0.16)';
const PROFIT_COLOR = '#1FB8CD';
const WARNING_COLOR = '#FFC185';
const LOSS_COLOR = '#B4413C';
const MUTED_BAR_COLOR = 'rgba(148, 163, 184, 0.25)';

function getChartRoot(id: string): HTMLElement | null {
    return document.getElementById(id);
}

function disposeStoredChart(charts: Record<string, unknown>, chartKey: string): void {
    disposeChartInstance(charts[chartKey]);
    delete charts[chartKey];
}

function renderStoredChart(
    charts: Record<string, unknown>,
    chartKey: string,
    root: HTMLElement,
    option: GammaChartOption
): void {
    charts[chartKey] = renderEChart(root, charts[chartKey], option);
}

function axisCurrencyFormatter(formatCurrency: (value: unknown, opts?: Record<string, unknown>) => string) {
    return (value: unknown): string => formatCurrency(value, { decimals: 0 });
}

function toFiniteNumber(value: unknown, fallback = 0): number {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
}

export function updateAllCharts(this: DashboardChartsContext): void {
    this.updateMonthlyPLChart();
    this.updateCumulativePLChart();
    this.updateStrategyPerformanceChart();
    this.updateWinRateByStrategyChart();
    this.updatePerformanceGauges();
    this.updateCommissionImpactChart();
    this.updateTimeInTradeChart();
    this.updateMonteCarloChart();
    this.renderTickerHeatmap();
}

export function updatePerformanceGauges(this: DashboardChartsContext): void {
    const stats = this.latestStats;
    this.renderRatioGauge({
        chartKey: 'sharpeGauge',
        canvasId: 'sharpeGaugeChart',
        valueElementId: 'sharpeGaugeValue',
        value: stats?.sharpeRatio as number | undefined,
        min: -1,
        max: 3
    });

    this.renderRatioGauge({
        chartKey: 'sortinoGauge',
        canvasId: 'sortinoGaugeChart',
        valueElementId: 'sortinoGaugeValue',
        value: stats?.sortinoRatio as number | undefined,
        min: -1,
        max: 4
    });
}

export function renderRatioGauge(this: DashboardChartsContext, { chartKey, canvasId, valueElementId, value, min = 0, max = 1 }: RatioGaugeOptions): void {
    const valueElement = document.getElementById(valueElementId);
    if (valueElement) {
        valueElement.textContent = this.formatNumber(value, { decimals: 2, useGrouping: false }) ?? '—';
    }

    const root = getChartRoot(canvasId);
    if (!root) {
        return;
    }

    if (!Number.isFinite(value)) {
        disposeStoredChart(this.charts, chartKey);
        return;
    }

    const numericValue = value as number;
    const clamped = Math.min(Math.max(numericValue, min), max);
    const primaryColor = numericValue >= 1.5
        ? PROFIT_COLOR
        : numericValue >= 0.75
            ? WARNING_COLOR
            : LOSS_COLOR;
    const formattedValue = this.formatNumber(numericValue, { decimals: 2, useGrouping: false })
        ?? numericValue.toFixed(2);

    renderStoredChart(this.charts, chartKey, root, {
        aria: { enabled: true },
        tooltip: {
            trigger: 'item',
            formatter: () => `Ratio: ${formattedValue}`
        },
        series: [{
            type: 'gauge',
            min,
            max,
            startAngle: 180,
            endAngle: 0,
            radius: '96%',
            center: ['50%', '70%'],
            progress: {
                show: true,
                width: 14,
                itemStyle: { color: primaryColor }
            },
            axisLine: {
                lineStyle: {
                    width: 14,
                    color: [[1, MUTED_BAR_COLOR]]
                }
            },
            pointer: { show: false },
            axisTick: { show: false },
            splitLine: { show: false },
            axisLabel: { show: false },
            detail: { show: false },
            data: [{ value: clamped, name: 'Ratio' }]
        }]
    });
}

export function updateCommissionImpactChart(this: DashboardChartsContext): void {
    const root = getChartRoot('commissionImpactChart');
    const summaryElement = document.getElementById('commissionImpactSummary');

    if (!root) {
        return;
    }

    const filteredTrades = this.getClosedTradesInRange();
    if (!filteredTrades.length) {
        if (summaryElement) {
            summaryElement.textContent = 'No closed trades in selected timeframe.';
        }
        disposeStoredChart(this.charts, 'commissionImpact');
        return;
    }

    let totalFees = 0;
    let netPL = 0;
    let grossTurnover = 0;
    filteredTrades.forEach(trade => {
        const fees = toFiniteNumber(trade.totalFees);
        const pl = toFiniteNumber(this.calculateRealizedPL(trade));
        totalFees += fees;
        netPL += pl;
        grossTurnover += Math.abs(pl) + fees;
    });
    const feeShare = grossTurnover > 0 ? (totalFees / grossTurnover) * 100 : 0;

    if (summaryElement) {
        if (totalFees === 0 && netPL === 0) {
            summaryElement.textContent = 'No closed trades yet.';
        } else {
            const shareText = this.formatNumber(feeShare, { decimals: 1, useGrouping: true }) ?? '0.0';
            summaryElement.textContent = `${this.formatCurrency(totalFees)} in fees (${shareText}% of realized turnover).`;
        }
    }

    const formatCurrencyValue = (value: unknown, decimals = 2) => this.formatCurrency(value, { decimals });
    renderStoredChart(this.charts, 'commissionImpact', root, {
        aria: { enabled: true },
        grid: { top: 8, right: 18, bottom: 22, left: 10, containLabel: true },
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            formatter: (params: unknown) => {
                const item = Array.isArray(params) ? params[0] as { name?: string; value?: unknown } : null;
                return item ? `${item.name}: ${formatCurrencyValue(item.value)}` : '';
            }
        },
        xAxis: {
            type: 'value',
            axisLabel: { color: AXIS_TEXT_COLOR, formatter: axisCurrencyFormatter(this.formatCurrency.bind(this)) },
            splitLine: { lineStyle: { color: GRID_LINE_COLOR } }
        },
        yAxis: {
            type: 'category',
            data: ['Net P&L', 'Fees'],
            axisTick: { show: false },
            axisLine: { show: false },
            axisLabel: { color: AXIS_TEXT_COLOR }
        },
        series: [{
            type: 'bar',
            barWidth: '55%',
            data: [
                { value: netPL, itemStyle: { color: netPL >= 0 ? PROFIT_COLOR : LOSS_COLOR } },
                { value: totalFees, itemStyle: { color: LOSS_COLOR } }
            ]
        }]
    });
}

export function renderTickerHeatmap(this: DashboardChartsContext): void {
    const root = getChartRoot('tickerHeatmap');
    if (!root) {
        return;
    }

    const filteredTrades = this.getClosedTradesInRange();
    const tickerPerformance = this.calculateTickerPerformance(filteredTrades);
    const items = tickerPerformance?.items || [];
    if (!items.length) {
        disposeStoredChart(this.charts, 'tickerHeatmap');
        root.innerHTML = '';
        const empty = document.createElement('div');
        empty.className = 'heatmap-empty';
        empty.textContent = 'Add more closed trades to see per-ticker performance.';
        root.appendChild(empty);
        return;
    }

    if (!this.charts.tickerHeatmap) {
        root.innerHTML = '';
    }
    const subset = items.slice(0, 12);
    const maxMagnitude = tickerPerformance?.maxMagnitude || 1;
    const rowCount = Math.min(3, subset.length);
    const columnCount = Math.ceil(subset.length / rowCount);
    const xCategories = Array.from({ length: columnCount }, (_, idx) => String(idx + 1));
    const yCategories = Array.from({ length: rowCount }, (_, idx) => String(idx + 1));
    const heatmapData = subset.map((item, index) => [
        Math.floor(index / rowCount),
        index % rowCount,
        item.totalPL
    ]);

    const formatItemLabel = (index: number): string => {
        const item = subset[index];
        if (!item) {
            return '';
        }
        const tradeCountLabel = this.formatNumber(item.tradeCount, { decimals: 0, useGrouping: true }) ?? String(item.tradeCount ?? 0);
        const winRateLabel = this.formatPercent(item.winRate, '0%', { decimals: 0 });
        const plTag = item.totalPL >= 0 ? 'plPos' : 'plNeg';
        return `{ticker|${item.ticker}}\n{${plTag}|${this.formatCurrency(item.totalPL)}}\n{meta|${tradeCountLabel} trades • Win ${winRateLabel}}`;
    };

    const heatmapClickHandler = (params: { dataIndex?: number }) => {
        const item = subset[params.dataIndex ?? -1];
        if (item?.ticker) {
            this.openTradesFilteredByTicker(item.ticker);
        }
    };

    renderStoredChart(this.charts, 'tickerHeatmap', root, {
        aria: { enabled: true },
        grid: { top: 8, right: 8, bottom: 8, left: 8, containLabel: false },
        tooltip: {
            formatter: (params: unknown) => {
                const dataIndex = Number((params as { dataIndex?: unknown }).dataIndex);
                const item = subset[dataIndex];
                if (!item) {
                    return '';
                }
                const winRateLabel = this.formatPercent(item.winRate, '0%', { decimals: 1 });
                return [
                    `<strong>${item.ticker}</strong>`,
                    `P&L: ${this.formatCurrency(item.totalPL)}`,
                    `Trades: ${item.tradeCount}`,
                    `Win rate: ${winRateLabel}`
                ].join('<br>');
            }
        },
        xAxis: {
            type: 'category',
            data: xCategories,
            show: false,
            splitArea: { show: true }
        },
        yAxis: {
            type: 'category',
            data: yCategories,
            show: false,
            inverse: true,
            splitArea: { show: true }
        },
        visualMap: {
            show: false,
            min: -maxMagnitude,
            max: maxMagnitude,
            inRange: {
                color: ['#c0392b', '#e8ecef', '#0fa8c0']
            }
        },
        series: [{
            type: 'heatmap',
            data: heatmapData,
            label: {
                show: true,
                overflow: 'break',
                formatter: (params: { dataIndex?: number }) => formatItemLabel(params.dataIndex ?? 0),
                rich: {
                    ticker: {
                        color: '#111827',
                        fontWeight: 700,
                        fontSize: 15,
                        lineHeight: 20
                    },
                    plPos: {
                        color: '#065f46',
                        fontWeight: 700,
                        fontSize: 16,
                        lineHeight: 22
                    },
                    plNeg: {
                        color: '#7f1d1d',
                        fontWeight: 700,
                        fontSize: 16,
                        lineHeight: 22
                    },
                    meta: {
                        color: '#374151',
                        fontSize: 12,
                        lineHeight: 17
                    }
                }
            },
            itemStyle: {
                borderColor: 'rgba(255, 255, 255, 0.85)',
                borderWidth: 3,
                borderRadius: 8
            },
            emphasis: {
                itemStyle: {
                    shadowBlur: 12,
                    shadowColor: 'rgba(15, 23, 42, 0.18)'
                }
            }
        }]
    });

    const heatmapChart = this.charts.tickerHeatmap as { off?: (e: string) => void; on?: (e: string, h: unknown) => void; getDom?: () => HTMLElement } | undefined;
    if (heatmapChart?.on) {
        heatmapChart.off?.('click');
        heatmapChart.on('click', heatmapClickHandler);
        const dom = heatmapChart.getDom?.();
        if (dom) dom.style.cursor = 'pointer';
    }
}

export function updateTimeInTradeChart(this: DashboardChartsContext): void {
    const root = getChartRoot('timeInTradeChart');
    const stats = this.latestStats;

    if (!root) {
        return;
    }

    if (!stats || stats.closedTrades === 0 || (!Number.isFinite(stats.avgWinnerDays as number) && !Number.isFinite(stats.avgLoserDays as number))) {
        disposeStoredChart(this.charts, 'timeInTrade');
        return;
    }

    const winners = Number.isFinite(stats.avgWinnerDays as number) ? stats.avgWinnerDays as number : 0;
    const losers = Number.isFinite(stats.avgLoserDays as number) ? stats.avgLoserDays as number : 0;
    const formatDayCount = (value: unknown, decimals = 1): string => {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
            return '';
        }
        return this.formatNumber(numeric, { decimals, useGrouping: true }) ?? numeric.toFixed(decimals);
    };

    renderStoredChart(this.charts, 'timeInTrade', root, {
        aria: { enabled: true },
        grid: { top: 12, right: 14, bottom: 24, left: 12, containLabel: true },
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            formatter: (params: unknown) => {
                const item = Array.isArray(params) ? params[0] as { name?: string; value?: unknown } : null;
                const label = item ? formatDayCount(item.value, 1) : '';
                return item ? `${item.name}: ${label || item.value} days` : '';
            }
        },
        xAxis: {
            type: 'category',
            data: ['Winners', 'Losers'],
            axisTick: { show: false },
            axisLine: { show: false },
            axisLabel: { color: AXIS_TEXT_COLOR }
        },
        yAxis: {
            type: 'value',
            min: 0,
            axisLabel: {
                color: AXIS_TEXT_COLOR,
                formatter: (value: unknown) => {
                    const label = formatDayCount(value, 0);
                    return label ? `${label}d` : `${value}d`;
                }
            },
            splitLine: { lineStyle: { color: GRID_LINE_COLOR } }
        },
        series: [{
            type: 'bar',
            name: 'Average Days Held',
            barWidth: '55%',
            data: [
                { value: winners, itemStyle: { color: PROFIT_COLOR } },
                { value: losers, itemStyle: { color: LOSS_COLOR } }
            ]
        }]
    });
}

export function updateMonteCarloChart(this: DashboardChartsContext): void {
    const root = getChartRoot('monteCarloChart');
    const summaryElement = document.getElementById('monteCarloSummary');
    const stats = this.latestStats;

    if (!root) {
        return;
    }

    if (!stats || !Array.isArray(stats.dailyReturns) || (stats.dailyReturns as number[]).length < 2) {
        if (summaryElement) {
            summaryElement.textContent = 'Need more closed trades to run projections.';
        }
        disposeStoredChart(this.charts, 'monteCarlo');
        return;
    }

    const projection = this.generateMonteCarloProjection(stats.dailyReturns as number[], { periods: 60, simulations: 400 });
    if (!projection) {
        if (summaryElement) {
            summaryElement.textContent = 'Need more closed trades to run projections.';
        }
        disposeStoredChart(this.charts, 'monteCarlo');
        return;
    }

    const percentiles = projection.percentiles as Record<string, number[]>;
    const labels = projection.labels as string[];
    const medianTerminal = percentiles.p50[percentiles.p50.length - 1] || 1;
    if (summaryElement) {
        const pctChange = (medianTerminal - 1) * 100;
        const formattedNumber = this.formatNumber(Math.abs(pctChange), { decimals: 1, useGrouping: true })
            ?? Math.abs(pctChange).toFixed(1);
        const prefix = pctChange >= 0 ? '+' : '-';
        summaryElement.textContent = `Median path suggests ${prefix}${formattedNumber}% over 60 trading days.`;
    }

    const formatProjectedPercent = (value: unknown): string => {
        const percent = (Number(value) - 1) * 100;
        const formattedNumber = this.formatNumber(Math.abs(percent), { decimals: 1, useGrouping: true })
            ?? Math.abs(percent).toFixed(1);
        const prefix = percent >= 0 ? '+' : '-';
        return `${prefix}${formattedNumber}%`;
    };

    renderStoredChart(this.charts, 'monteCarlo', root, {
        aria: { enabled: true },
        color: ['rgba(180, 65, 60, 0.75)', 'rgba(31, 184, 205, 0.4)', PROFIT_COLOR],
        grid: { top: 16, right: 18, bottom: 42, left: 10, containLabel: true },
        legend: { bottom: 0, textStyle: { color: AXIS_TEXT_COLOR } },
        tooltip: {
            trigger: 'axis',
            formatter: (params: unknown) => {
                if (!Array.isArray(params)) {
                    return '';
                }
                return params
                    .map(item => {
                        const point = item as { marker?: string; seriesName?: string; value?: unknown };
                        return `${point.marker ?? ''}${point.seriesName}: ${formatProjectedPercent(point.value)}`;
                    })
                    .join('<br>');
            }
        },
        xAxis: {
            type: 'category',
            data: labels,
            axisLabel: { color: AXIS_TEXT_COLOR, interval: 5 },
            axisTick: { show: false },
            axisLine: { lineStyle: { color: GRID_LINE_COLOR } }
        },
        yAxis: {
            type: 'value',
            axisLabel: { color: AXIS_TEXT_COLOR, formatter: formatProjectedPercent },
            splitLine: { lineStyle: { color: GRID_LINE_COLOR } }
        },
        series: [
            {
                type: 'line',
                name: '10th percentile',
                data: percentiles.p10,
                showSymbol: false,
                smooth: 0.2,
                lineStyle: { width: 1.5 }
            },
            {
                type: 'line',
                name: '90th percentile',
                data: percentiles.p90,
                showSymbol: false,
                smooth: 0.2,
                lineStyle: { width: 1.5 },
                areaStyle: { color: 'rgba(31, 184, 205, 0.08)' }
            },
            {
                type: 'line',
                name: 'Median',
                data: percentiles.p50,
                showSymbol: false,
                smooth: 0.2,
                lineStyle: { width: 2.25, color: PROFIT_COLOR },
                markLine: {
                    silent: true,
                    symbol: 'none',
                    label: { show: false },
                    lineStyle: { color: 'rgba(146, 149, 152, 0.85)', width: 1.5 },
                    data: [{ yAxis: 1 }]
                }
            }
        ]
    });
}

export function ensureMonteCarloBaseline(): void {
    // Baseline is now rendered declaratively via ECharts markLine.
}

export function generateMonteCarloProjection(
    dailyReturns: number[] = [],
    { periods = 60, simulations = 400 }: MonteCarloOptions = {}
): Record<string, unknown> | null {
    if (!Array.isArray(dailyReturns) || dailyReturns.length === 0) {
        return null;
    }

    const sanitized = dailyReturns.filter(value => Number.isFinite(value));
    if (!sanitized.length) {
        return null;
    }

    const trajectory: number[][] = Array.from({ length: periods }, () => []);

    for (let sim = 0; sim < simulations; sim += 1) {
        let equity = 1;
        for (let step = 0; step < periods; step += 1) {
            const randomIndex = Math.floor(Math.random() * sanitized.length);
            let sample = sanitized[randomIndex];
            if (!Number.isFinite(sample)) {
                sample = 0;
            }
            sample = Math.max(-0.95, Math.min(sample, 5));
            equity *= 1 + sample;
            equity = Math.max(equity, 0);
            trajectory[step].push(Number(equity.toFixed(6)));
        }
    }

    const percentilesList = [0.1, 0.25, 0.5, 0.75, 0.9];
    const percentileSeries: number[][] = percentilesList.map(() => []);

    trajectory.forEach(stepValues => {
        if (!stepValues.length) {
            percentilesList.forEach((_, idx) => percentileSeries[idx].push(1));
            return;
        }

        const sorted = stepValues.slice().sort((a, b) => a - b);
        percentilesList.forEach((percentile, index) => {
            const target = (sorted.length - 1) * percentile;
            const lowerIndex = Math.floor(target);
            const upperIndex = Math.ceil(target);
            if (lowerIndex === upperIndex) {
                percentileSeries[index].push(sorted[lowerIndex]);
                return;
            }
            const lower = sorted[lowerIndex];
            const upper = sorted[upperIndex];
            const weight = target - lowerIndex;
            const interpolated = lower + (upper - lower) * weight;
            percentileSeries[index].push(Number(interpolated.toFixed(6)));
        });
    });

    return {
        labels: Array.from({ length: periods }, (_, idx) => `Day ${idx + 1}`),
        percentiles: {
            p10: percentileSeries[0],
            p25: percentileSeries[1],
            p50: percentileSeries[2],
            p75: percentileSeries[3],
            p90: percentileSeries[4]
        }
    };
}

export function updateMonthlyPLChart(this: DashboardChartsContext): void {
    const root = getChartRoot('monthlyPLChart');
    if (!root) return;

    const formatCurrencyValue = (value: unknown, decimals = 2) => this.formatCurrency(value, { decimals });
    const monthlyData: Record<string, number> = {};

    const addToMonth = (monthKey: string, amount: number): void => {
        if (!monthlyData[monthKey]) monthlyData[monthKey] = 0;
        monthlyData[monthKey] += amount;
    };

    this.trades.forEach(trade => {
        const legs = Array.isArray(trade.legs) ? trade.legs as Record<string, unknown>[] : [];
        const hasOptionLegs = legs.some(leg => {
            const t = String(leg.type || '').toUpperCase().trim();
            return t === 'CALL' || t === 'PUT';
        });
        if (!hasOptionLegs) return;

        // Step 1: Attribute each option leg's cashflow to its execution month (cash-basis).
        // STO credit lands in the month the option was sold; BTC debit in the month
        // it was bought back. Expired options have only an STO leg — credit stays there.
        let totalOptionCashFlow = 0;
        legs.forEach(leg => {
            const legType = String(leg.type || '').toUpperCase().trim();
            if (legType === 'STOCK' || legType === 'CASH') return;

            const dateStr = String(leg.executionDate || '');
            if (!dateStr) return;
            const monthKey = dateStr.substring(0, 7);

            const cashFlow = this.calculateLegCashFlow(leg);
            if (Number.isFinite(cashFlow)) {
                addToMonth(monthKey, cashFlow);
                totalOptionCashFlow += cashFlow;
            }
        });

        // Step 2: Attribute net stock P&L to the close month (closed trades only).
        // Stock purchase is capital deployment, not a P&L event — excluded.
        // Stock gain/loss = total trade P&L minus all option-leg cashflows.
        if (this.isClosedStatus(trade.status)) {
            const tradePL = toFiniteNumber(this.calculateRealizedPL(trade));
            const stockPL = tradePL - totalOptionCashFlow;
            if (Math.abs(stockPL) > 0.01) {
                const closedDate = String(trade.closedDate || trade.openedDate || '');
                if (closedDate) {
                    addToMonth(closedDate.substring(0, 7), stockPL);
                }
            }
        }
    });

    const sortedMonths = Object.keys(monthlyData).sort();
    const labels = sortedMonths.map(month => {
        const date = new Date(`${month}-01`);
        return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    });

    renderStoredChart(this.charts, 'monthlyPL', root, {
        aria: { enabled: true },
        grid: { top: 12, right: 18, bottom: 54, left: 10, containLabel: true },
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            formatter: (params: unknown) => {
                const item = Array.isArray(params) ? params[0] as { value?: unknown } : null;
                return item ? `P&L: ${formatCurrencyValue(item.value)}` : '';
            }
        },
        xAxis: {
            type: 'category',
            data: labels,
            axisLabel: { color: AXIS_TEXT_COLOR, rotate: 45 },
            axisTick: { show: false },
            axisLine: { lineStyle: { color: GRID_LINE_COLOR } }
        },
        yAxis: {
            type: 'value',
            axisLabel: { color: AXIS_TEXT_COLOR, formatter: (value: unknown) => formatCurrencyValue(value, 0) },
            splitLine: { lineStyle: { color: GRID_LINE_COLOR } }
        },
        series: [{
            type: 'bar',
            name: 'Monthly P&L',
            data: sortedMonths.map(month => ({
                value: monthlyData[month],
                itemStyle: { color: monthlyData[month] >= 0 ? PROFIT_COLOR : LOSS_COLOR }
            }))
        }]
    });
}

export function updateStrategyPerformanceChart(this: DashboardChartsContext): void {
    const root = getChartRoot('strategyChart');
    if (!root) return;

    const filteredTrades = this.getClosedTradesInRange();
    const strategyPL: Record<string, number> = {};
    filteredTrades.forEach(trade => {
        const strategy = (trade.strategy as string) || 'Unknown';
        if (!strategyPL[strategy]) {
            strategyPL[strategy] = 0;
        }
        strategyPL[strategy] += toFiniteNumber(this.calculateRealizedPL(trade));
    });

    const sortedStrategies = Object.entries(strategyPL)
        .sort(([, a], [, b]) => a - b)
        .slice(-8);

    const formatCurrencyValue = (value: unknown, decimals = 2) => this.formatCurrency(value, { decimals });

    const strategyClickHandler = (params: { name?: string }) => {
        if (params.name) {
            this.openTradesFilteredByStrategy(params.name);
        }
    };

    renderStoredChart(this.charts, 'strategy', root, {
        aria: { enabled: true },
        grid: { top: 10, right: 18, bottom: 22, left: 10, containLabel: true },
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            formatter: (params: unknown) => {
                const item = Array.isArray(params) ? params[0] as { value?: unknown } : null;
                return item ? `P&L: ${formatCurrencyValue(item.value)}` : '';
            }
        },
        xAxis: {
            type: 'value',
            axisLabel: { color: AXIS_TEXT_COLOR, formatter: (value: unknown) => formatCurrencyValue(value, 0) },
            splitLine: { lineStyle: { color: GRID_LINE_COLOR } }
        },
        yAxis: {
            type: 'category',
            data: sortedStrategies.map(([strategy]) => strategy),
            axisTick: { show: false },
            axisLine: { show: false },
            axisLabel: { color: AXIS_TEXT_COLOR }
        },
        series: [{
            type: 'bar',
            name: 'Total P&L',
            barMaxWidth: 30,
            data: sortedStrategies.map(([, pl]) => ({
                value: pl,
                itemStyle: { color: pl >= 0 ? PROFIT_COLOR : LOSS_COLOR }
            }))
        }]
    });

    const strategyChart = this.charts.strategy as { off?: (e: string) => void; on?: (e: string, h: unknown) => void; getDom?: () => HTMLElement } | undefined;
    if (strategyChart?.on) {
        strategyChart.off?.('click');
        strategyChart.on('click', strategyClickHandler);
        const dom = strategyChart.getDom?.();
        if (dom) dom.style.cursor = 'pointer';
    }
}

export function updateWinRateByStrategyChart(this: DashboardChartsContext): void {
    const root = getChartRoot('winRateChart');
    if (!root) return;

    const filteredTrades = this.getClosedTradesInRange();
    const strategyStats: Record<string, { total: number; wins: number }> = {};
    filteredTrades.forEach(trade => {
        const strategy = (trade.strategy as string) || 'Unknown';
        if (!strategyStats[strategy]) {
            strategyStats[strategy] = { total: 0, wins: 0 };
        }
        strategyStats[strategy].total++;
        if (toFiniteNumber(this.calculateRealizedPL(trade)) > 0) {
            strategyStats[strategy].wins++;
        }
    });

    const validStrategies = Object.entries(strategyStats)
        .filter(([, s]) => s.total >= 1)
        .map(([strategy, s]) => ({
            strategy,
            winRate: (s.wins / s.total) * 100,
            total: s.total
        }))
        .sort((a, b) => b.winRate - a.winRate);

    const winRateClickHandler = (params: { name?: string }) => {
        // slice name format: "Strategy Name (N)" — strip the count suffix
        const rawName = (params.name ?? '').replace(/\s*\(\d+\)$/, '').trim();
        if (rawName && validStrategies.length) {
            this.openTradesFilteredByStrategy(rawName);
        }
    };

    const colors = [PROFIT_COLOR, WARNING_COLOR, LOSS_COLOR, '#ECEBD5', '#5D878F', '#DB4545', '#D2BA4C', '#964325', '#944454', '#13343B'];
    const data = validStrategies.length
        ? validStrategies.map((item, index) => ({
            name: `${item.strategy} (${item.total})`,
            value: item.winRate,
            itemStyle: { color: colors[index % colors.length] }
        }))
        : [{ name: 'No closed trades', value: 1, itemStyle: { color: MUTED_BAR_COLOR } }];

    renderStoredChart(this.charts, 'winRate', root, {
        aria: { enabled: true },
        legend: validStrategies.length
            ? { orient: 'vertical', right: 0, top: 'middle', textStyle: { color: AXIS_TEXT_COLOR }, type: 'scroll' }
            : { show: false },
        tooltip: {
            formatter: (params: unknown) => {
                if (!validStrategies.length) {
                    return 'No closed trades';
                }
                const item = params as { name?: string; value?: unknown };
                const percent = this.formatPercent(item.value, '0%', { decimals: 2 });
                return `${item.name}: ${percent}`;
            }
        },
        series: [{
            type: 'pie',
            radius: ['30%', '76%'],
            center: validStrategies.length ? ['38%', '50%'] : ['50%', '50%'],
            avoidLabelOverlap: true,
            label: { show: false },
            emphasis: {
                label: {
                    show: true,
                    formatter: (params: { value?: unknown }) => this.formatPercent(params.value, '0%', { decimals: 1 })
                }
            },
            data
        }]
    });

    const winRateChart = this.charts.winRate as { off?: (e: string) => void; on?: (e: string, h: unknown) => void; getDom?: () => HTMLElement } | undefined;
    if (winRateChart?.on) {
        winRateChart.off?.('click');
        winRateChart.on('click', winRateClickHandler);
        const dom = winRateChart.getDom?.();
        if (dom) dom.style.cursor = 'pointer';
    }
}

export function inferOptionFlavor(trade: TradeRecord = {}): 'call' | 'put' | null {
    const explicit = ((trade.optionType || trade.optionFlavor || '') as string).toString().trim().toLowerCase();
    if (explicit === 'call' || explicit === 'put') {
        return explicit as 'call' | 'put';
    }

    const strategy = ((trade.strategy || '') as string).toLowerCase();
    const containsCall = strategy.includes('call');
    const containsPut = strategy.includes('put');

    if (containsCall && !containsPut) {
        return 'call';
    }
    if (containsPut && !containsCall) {
        return 'put';
    }

    const notes = ((trade.notes || '') as string).toLowerCase();
    const noteCall = notes.includes('call');
    const notePut = notes.includes('put');
    if (noteCall && !notePut) {
        return 'call';
    }
    if (notePut && !noteCall) {
        return 'put';
    }

    return null;
}
