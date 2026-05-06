// src/ui/charts/dashboard-charts.ts — Wave 9: Dashboard chart updates.
// Uses the .call(this, …) delegation pattern.

// Chart is loaded from CDN; declared in vendor.d.ts or the host app scope.
declare const Chart: { new(ctx: CanvasRenderingContext2D, config: Record<string, unknown>): { destroy(): void } };

type TradeRecord = Record<string, unknown>

interface TickerPerformanceResult {
  items: Array<{ ticker: string; totalPL: number; tradeCount: number; winRate: number }>
  maxMagnitude: number
}

interface DashboardChartsContext {
  charts: Record<string, { destroy(): void }>
  trades: TradeRecord[]
  latestStats: Record<string, unknown> | null
  isClosedStatus(status: unknown): boolean
  getClosedTradesInRange(): TradeRecord[]
  formatCurrency(value: unknown, opts?: Record<string, unknown>): string
  formatNumber(value: unknown, opts: Record<string, unknown>): string | null
  formatPercent(value: unknown, fallback: string, opts?: Record<string, unknown>): string
  calculateTickerPerformance(trades: TradeRecord[]): TickerPerformanceResult | null
  generateMonteCarloProjection(dailyReturns: number[], opts?: { periods?: number; simulations?: number }): Record<string, unknown> | null
  ensureMonteCarloBaseline(chart: Record<string, unknown>): void
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

    const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
    if (!canvas) {
        return;
    }

    if (!Number.isFinite(value)) {
        if (this.charts[chartKey]) {
            this.charts[chartKey].destroy();
            delete this.charts[chartKey];
        }
        return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return;
    }

    const numericValue = value as number;
    const clamped = Math.min(Math.max(numericValue, min), max);
    const range = Math.max(max - min, 1);
    const progress = (clamped - min) / range;
    const normalized = Number.isFinite(progress) ? Math.max(Math.min(progress, 1), 0) : 0;
    const remainder = Math.max(1 - normalized, 0);

    const primaryColor = numericValue >= 1.5
        ? '#1FB8CD'
        : numericValue >= 0.75
            ? '#FFC185'
            : '#B4413C';

    const formattedValue = this.formatNumber(numericValue, { decimals: 2, useGrouping: false })
        ?? (Number.isFinite(numericValue) ? numericValue.toFixed(2) : '—');

    if (this.charts[chartKey]) {
        this.charts[chartKey].destroy();
    }

    this.charts[chartKey] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Ratio', 'Remaining'],
            datasets: [{
                data: [normalized, remainder],
                backgroundColor: [primaryColor, 'rgba(148, 163, 184, 0.25)'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            rotation: -90,
            circumference: 180,
            cutout: '70%',
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: () => `Ratio: ${formattedValue}`
                    }
                }
            }
        }
    } as Record<string, unknown>);
}

export function updateCommissionImpactChart(this: DashboardChartsContext): void {
    const canvas = document.getElementById('commissionImpactChart') as HTMLCanvasElement | null;
    const summaryElement = document.getElementById('commissionImpactSummary');

    if (!canvas) {
        return;
    }

    const filteredTrades = this.getClosedTradesInRange();
    if (!filteredTrades.length) {
        if (summaryElement) {
            summaryElement.textContent = 'No closed trades in selected timeframe.';
        }
        if (this.charts.commissionImpact) {
            this.charts.commissionImpact.destroy();
            delete this.charts.commissionImpact;
        }
        return;
    }

    let totalFees = 0;
    let netPL = 0;
    let grossTurnover = 0;
    filteredTrades.forEach(trade => {
        totalFees += Number(trade.totalFees) || 0;
        netPL += Number(trade.pl) || 0;
        grossTurnover += Math.abs(Number(trade.pl) || 0) + (Number(trade.totalFees) || 0);
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

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return;
    }

    if (this.charts.commissionImpact) {
        this.charts.commissionImpact.destroy();
    }

    const formatCurrencyValue = (value: unknown, decimals = 2) => this.formatCurrency(value, { decimals });

    this.charts.commissionImpact = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Net P&L', 'Fees'],
            datasets: [{
                label: 'Amount',
                data: [netPL, totalFees],
                backgroundColor: [
                    netPL >= 0 ? '#1FB8CD' : '#B4413C',
                    '#B4413C'
                ],
                borderRadius: 8,
                borderSkipped: false
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    ticks: {
                        callback: (value: unknown) => formatCurrencyValue(value, 0)
                    },
                    grid: {
                        drawBorder: false
                    }
                },
                y: {
                    grid: {
                        display: false
                    }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context: { label: string; raw: unknown }) => `${context.label}: ${formatCurrencyValue(context.raw)}`
                    }
                }
            }
        }
    } as Record<string, unknown>);
}

export function renderTickerHeatmap(this: DashboardChartsContext): void {
    const container = document.getElementById('tickerHeatmap');
    if (!container) {
        return;
    }

    container.innerHTML = '';

    const filteredTrades = this.getClosedTradesInRange();
    const tickerPerformance = this.calculateTickerPerformance(filteredTrades);
    const items = tickerPerformance?.items || [];
    if (!items.length) {
        const empty = document.createElement('div');
        empty.className = 'heatmap-empty';
        empty.textContent = 'Add more closed trades to see per-ticker performance.';
        container.appendChild(empty);
        return;
    }

    const maxMagnitude = tickerPerformance?.maxMagnitude || 1;
    const subset = items.slice(0, 12);

    subset.forEach((item) => {
        const card = document.createElement('div');
        card.className = 'heatmap-card';

        const baseColor = item.totalPL >= 0 ? [31, 184, 205] : [180, 65, 60];
        const normalized = maxMagnitude > 0 ? Math.min(Math.abs(item.totalPL) / maxMagnitude, 1) : 0;
        const alpha = 0.15 + normalized * 0.55;
        const borderAlpha = Math.min(alpha + 0.1, 0.9);

        card.style.backgroundColor = `rgba(${baseColor[0]}, ${baseColor[1]}, ${baseColor[2]}, ${alpha.toFixed(2)})`;
        card.style.borderColor = `rgba(${baseColor[0]}, ${baseColor[1]}, ${baseColor[2]}, ${borderAlpha.toFixed(2)})`;

        const tickerEl = document.createElement('div');
        tickerEl.className = 'heatmap-card__ticker';
        tickerEl.textContent = item.ticker;

        const plEl = document.createElement('div');
        plEl.className = `heatmap-card__pl ${item.totalPL >= 0 ? 'pl-positive' : 'pl-negative'}`;
        plEl.textContent = this.formatCurrency(item.totalPL);

        const metaEl = document.createElement('div');
        metaEl.className = 'heatmap-card__meta';
        const tradeCountLabel = this.formatNumber(item.tradeCount, { decimals: 0, useGrouping: true }) ?? String(item.tradeCount ?? 0);
        const winRateLabel = this.formatPercent(item.winRate, '0%', { decimals: 0 });
        metaEl.textContent = `${tradeCountLabel} trades • Win ${winRateLabel}`;

        card.appendChild(tickerEl);
        card.appendChild(plEl);
        card.appendChild(metaEl);

        container.appendChild(card);
    });
}

export function updateTimeInTradeChart(this: DashboardChartsContext): void {
    const canvas = document.getElementById('timeInTradeChart') as HTMLCanvasElement | null;
    const stats = this.latestStats;

    if (!canvas) {
        return;
    }

    if (!stats || stats.closedTrades === 0 || (!Number.isFinite(stats.avgWinnerDays as number) && !Number.isFinite(stats.avgLoserDays as number))) {
        if (this.charts.timeInTrade) {
            this.charts.timeInTrade.destroy();
            delete this.charts.timeInTrade;
        }
        return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return;
    }

    if (this.charts.timeInTrade) {
        this.charts.timeInTrade.destroy();
    }

    const winners = Number.isFinite(stats.avgWinnerDays as number) ? stats.avgWinnerDays as number : 0;
    const losers = Number.isFinite(stats.avgLoserDays as number) ? stats.avgLoserDays as number : 0;
    const formatDayCount = (value: unknown, decimals = 1) => {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
            return '';
        }
        return this.formatNumber(numeric, { decimals, useGrouping: true }) ?? numeric.toFixed(decimals);
    };

    this.charts.timeInTrade = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Winners', 'Losers'],
            datasets: [{
                label: 'Average Days Held',
                data: [winners, losers],
                backgroundColor: ['#1FB8CD', '#B4413C'],
                borderRadius: 8,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: (value: unknown) => {
                            const label = formatDayCount(value, 0);
                            return label ? `${label}d` : `${value}d`;
                        }
                    },
                    grid: {
                        drawBorder: false
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context: { label: string; raw: unknown }) => {
                            const label = formatDayCount(context.raw, 1);
                            return `${context.label}: ${label || context.raw} days`;
                        }
                    }
                }
            }
        }
    } as Record<string, unknown>);
}

export function updateMonteCarloChart(this: DashboardChartsContext): void {
    const canvas = document.getElementById('monteCarloChart') as HTMLCanvasElement | null;
    const summaryElement = document.getElementById('monteCarloSummary');
    const stats = this.latestStats;

    if (!canvas) {
        return;
    }

    if (!stats || !Array.isArray(stats.dailyReturns) || (stats.dailyReturns as number[]).length < 2) {
        if (summaryElement) {
            summaryElement.textContent = 'Need more closed trades to run projections.';
        }
        if (this.charts.monteCarlo) {
            this.charts.monteCarlo.destroy();
            delete this.charts.monteCarlo;
        }
        return;
    }

    const projection = this.generateMonteCarloProjection(stats.dailyReturns as number[], { periods: 60, simulations: 400 });
    if (!projection) {
        if (summaryElement) {
            summaryElement.textContent = 'Need more closed trades to run projections.';
        }
        if (this.charts.monteCarlo) {
            this.charts.monteCarlo.destroy();
            delete this.charts.monteCarlo;
        }
        return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return;
    }

    if (this.charts.monteCarlo) {
        this.charts.monteCarlo.destroy();
    }

    const percentiles = projection.percentiles as Record<string, number[]>;
    const medianTerminal = percentiles.p50[percentiles.p50.length - 1] || 1;
    if (summaryElement) {
        const pctChange = (medianTerminal - 1) * 100;
        const formattedNumber = this.formatNumber(Math.abs(pctChange), { decimals: 1, useGrouping: true })
            ?? Math.abs(pctChange).toFixed(1);
        const prefix = pctChange >= 0 ? '+' : '-';
        summaryElement.textContent = `Median path suggests ${prefix}${formattedNumber}% over 60 trading days.`;
    }

    const formatPercent = (value: unknown) => {
        const percent = (Number(value) - 1) * 100;
        const formattedNumber = this.formatNumber(Math.abs(percent), { decimals: 1, useGrouping: true })
            ?? Math.abs(percent).toFixed(1);
        const prefix = percent >= 0 ? '+' : '-';
        return `${prefix}${formattedNumber}%`;
    };

    const zeroLinePlugin = {
        id: 'monteCarloBaseline',
        afterDatasetsDraw: (chartInstance: Record<string, unknown>) => {
            this.ensureMonteCarloBaseline(chartInstance);
        }
    };

    this.charts.monteCarlo = new Chart(ctx, {
        type: 'line',
        data: {
            labels: projection.labels,
            datasets: [
                {
                    label: '10th percentile',
                    data: percentiles.p10,
                    borderColor: 'rgba(180, 65, 60, 0.6)',
                    backgroundColor: 'rgba(180, 65, 60, 0.12)',
                    borderWidth: 1.5,
                    fill: false,
                    tension: 0.25
                },
                {
                    label: '90th percentile',
                    data: percentiles.p90,
                    borderColor: 'rgba(31, 184, 205, 0.6)',
                    backgroundColor: 'rgba(31, 184, 205, 0.12)',
                    borderWidth: 1.5,
                    fill: '-1',
                    tension: 0.25
                },
                {
                    label: 'Median',
                    data: percentiles.p50,
                    borderColor: '#1FB8CD',
                    borderWidth: 2,
                    tension: 0.25,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            scales: {
                y: {
                    ticks: {
                        callback: (value: unknown) => formatPercent(value)
                    },
                    grid: {
                        drawBorder: false
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        maxTicksLimit: 12
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'bottom'
                },
                tooltip: {
                    callbacks: {
                        label: (context: { dataset: { label?: string }; parsed: { y: unknown } }) => `${context.dataset.label}: ${formatPercent(context.parsed.y)}`
                    }
                }
            }
        },
        plugins: [zeroLinePlugin]
    } as Record<string, unknown>);
}

export function ensureMonteCarloBaseline(chart: Record<string, unknown>): void {
    if (!chart) {
        return;
    }

    const ctx = chart.ctx as CanvasRenderingContext2D | undefined;
    const yScale = (chart.scales as Record<string, unknown> | undefined)?.y as Record<string, unknown> | undefined;
    const area = chart.chartArea as Record<string, number> | undefined;
    if (!ctx || !yScale || !area) {
        return;
    }

    const zeroPixel = (yScale.getPixelForValue as (v: number) => number)(1);
    if (!Number.isFinite(zeroPixel)) {
        return;
    }

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(area.left, zeroPixel);
    ctx.lineTo(area.right, zeroPixel);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(146, 149, 152, 0.85)';
    ctx.setLineDash([]);
    ctx.stroke();
    ctx.restore();
}

export function generateMonteCarloProjection(
    dailyReturns: number[] = [],
    { periods = 60, simulations = 400 } = {}
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
    const canvas = document.getElementById('monthlyPLChart') as HTMLCanvasElement | null;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (this.charts.monthlyPL) {
        this.charts.monthlyPL.destroy();
    }

    const formatCurrencyValue = (value: unknown, decimals = 2) => this.formatCurrency(value, { decimals });

    const monthlyData: Record<string, number> = {};
    this.trades
        .filter(trade => this.isClosedStatus(trade.status) && trade.exitDate)
        .forEach(trade => {
            const monthKey = (trade.exitDate as string).substring(0, 7); // YYYY-MM
            if (!monthlyData[monthKey]) {
                monthlyData[monthKey] = 0;
            }
            monthlyData[monthKey] += trade.pl as number;
        });

    const sortedMonths = Object.keys(monthlyData).sort();
    const labels = sortedMonths.map(month => {
        const date = new Date(month + '-01');
        return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    });

    this.charts.monthlyPL = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Monthly P&L',
                data: sortedMonths.map(month => monthlyData[month]),
                backgroundColor: sortedMonths.map(month => monthlyData[month] >= 0 ? '#1FB8CD' : '#B4413C'),
                borderColor: sortedMonths.map(month => monthlyData[month] >= 0 ? '#1FB8CD' : '#B4413C'),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: (value: unknown) => formatCurrencyValue(value, 0)
                    }
                },
                x: {
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: (context: { raw: unknown }) => `P&L: ${formatCurrencyValue(context.raw)}`
                    }
                }
            }
        }
    } as Record<string, unknown>);
}

export function updateStrategyPerformanceChart(this: DashboardChartsContext): void {
    const canvas = document.getElementById('strategyChart') as HTMLCanvasElement | null;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (this.charts.strategy) {
        this.charts.strategy.destroy();
    }

    const filteredTrades = this.getClosedTradesInRange();
    const strategyPL: Record<string, number> = {};
    filteredTrades.forEach(trade => {
        const strategy = trade.strategy as string;
        if (!strategyPL[strategy]) {
            strategyPL[strategy] = 0;
        }
        strategyPL[strategy] += trade.pl as number;
    });

    const sortedStrategies = Object.entries(strategyPL)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 8);

    const formatCurrencyValue = (value: unknown, decimals = 2) => this.formatCurrency(value, { decimals });

    this.charts.strategy = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sortedStrategies.map(([strategy]) => strategy),
            datasets: [{
                label: 'Total P&L',
                data: sortedStrategies.map(([, pl]) => pl),
                backgroundColor: sortedStrategies.map(([, pl]) => pl >= 0 ? '#1FB8CD' : '#B4413C'),
                borderColor: sortedStrategies.map(([, pl]) => pl >= 0 ? '#1FB8CD' : '#B4413C'),
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        callback: (value: unknown) => formatCurrencyValue(value, 0)
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: (context: { raw: unknown }) => `P&L: ${formatCurrencyValue(context.raw)}`
                    }
                }
            }
        }
    } as Record<string, unknown>);
}

export function updateWinRateByStrategyChart(this: DashboardChartsContext): void {
    const canvas = document.getElementById('winRateChart') as HTMLCanvasElement | null;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (this.charts.winRate) {
        this.charts.winRate.destroy();
    }

    const filteredTrades = this.getClosedTradesInRange();
    const strategyStats: Record<string, { total: number; wins: number }> = {};
    filteredTrades.forEach(trade => {
        const strategy = trade.strategy as string;
        if (!strategyStats[strategy]) {
            strategyStats[strategy] = { total: 0, wins: 0 };
        }
        strategyStats[strategy].total++;
        if ((trade.pl as number) > 0) {
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

    const colors = ['#1FB8CD', '#FFC185', '#B4413C', '#ECEBD5', '#5D878F', '#DB4545', '#D2BA4C', '#964325', '#944454', '#13343B'];

    this.charts.winRate = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: validStrategies.map(s => `${s.strategy} (${s.total})`),
            datasets: [{
                data: validStrategies.map(s => s.winRate),
                backgroundColor: colors.slice(0, validStrategies.length),
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        boxWidth: 15,
                        padding: 15
                    }
                },
                tooltip: {
                    callbacks: {
                        label: (context: { label: string; raw: unknown }) => {
                            const percent = this.formatPercent(context.raw, '0%', { decimals: 2 });
                            return `${context.label}: ${percent}`;
                        }
                    }
                }
            }
        }
    } as Record<string, unknown>);
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


