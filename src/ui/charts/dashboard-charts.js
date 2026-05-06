// src/ui/charts/dashboard-charts.js — Wave 9: Dashboard chart updates.
// Uses the .call(this, …) delegation pattern.

export function updateAllCharts() {
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

export function updatePerformanceGauges() {
    const stats = this.latestStats;
    this.renderRatioGauge({
        chartKey: 'sharpeGauge',
        canvasId: 'sharpeGaugeChart',
        valueElementId: 'sharpeGaugeValue',
        value: stats?.sharpeRatio,
        min: -1,
        max: 3
    });

    this.renderRatioGauge({
        chartKey: 'sortinoGauge',
        canvasId: 'sortinoGaugeChart',
        valueElementId: 'sortinoGaugeValue',
        value: stats?.sortinoRatio,
        min: -1,
        max: 4
    });
}

export function renderRatioGauge({ chartKey, canvasId, valueElementId, value, min = 0, max = 1 }) {
    const valueElement = document.getElementById(valueElementId);
    if (valueElement) {
        valueElement.textContent = this.formatNumber(value, { decimals: 2, useGrouping: false }) ?? '—';
    }

    const canvas = document.getElementById(canvasId);
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

    const clamped = Math.min(Math.max(value, min), max);
    const range = Math.max(max - min, 1);
    const progress = (clamped - min) / range;
    const normalized = Number.isFinite(progress) ? Math.max(Math.min(progress, 1), 0) : 0;
    const remainder = Math.max(1 - normalized, 0);

    const primaryColor = value >= 1.5
        ? '#1FB8CD'
        : value >= 0.75
            ? '#FFC185'
            : '#B4413C';

    const formattedValue = this.formatNumber(value, { decimals: 2, useGrouping: false })
        ?? (Number.isFinite(value) ? value.toFixed(2) : '—');

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
    });
}

export function updateCommissionImpactChart() {
    const canvas = document.getElementById('commissionImpactChart');
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

const formatCurrencyValue = (value, decimals = 2) => this.formatCurrency(value, { decimals });

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
                        callback: (value) => formatCurrencyValue(value, 0)
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
                        label: (context) => `${context.label}: ${formatCurrencyValue(context.raw)}`
                    }
                }
            }
        }
    });
}

export function renderTickerHeatmap() {
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

export function updateTimeInTradeChart() {
    const canvas = document.getElementById('timeInTradeChart');
    const stats = this.latestStats;

    if (!canvas) {
        return;
    }

    if (!stats || stats.closedTrades === 0 || (!Number.isFinite(stats.avgWinnerDays) && !Number.isFinite(stats.avgLoserDays))) {
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

    const winners = Number.isFinite(stats.avgWinnerDays) ? stats.avgWinnerDays : 0;
    const losers = Number.isFinite(stats.avgLoserDays) ? stats.avgLoserDays : 0;
    const formatDayCount = (value, decimals = 1) => {
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
                        callback: (value) => {
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
                        label: (context) => {
                            const label = formatDayCount(context.raw, 1);
                            return `${context.label}: ${label || context.raw} days`;
                        }
                    }
                }
            }
        }
    });
}

export function updateMonteCarloChart() {
    const canvas = document.getElementById('monteCarloChart');
    const summaryElement = document.getElementById('monteCarloSummary');
    const stats = this.latestStats;

    if (!canvas) {
        return;
    }

    if (!stats || !Array.isArray(stats.dailyReturns) || stats.dailyReturns.length < 2) {
        if (summaryElement) {
            summaryElement.textContent = 'Need more closed trades to run projections.';
        }
        if (this.charts.monteCarlo) {
            this.charts.monteCarlo.destroy();
            delete this.charts.monteCarlo;
        }
        return;
    }

    const projection = this.generateMonteCarloProjection(stats.dailyReturns, { periods: 60, simulations: 400 });
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

    const medianTerminal = projection.percentiles.p50[projection.percentiles.p50.length - 1] || 1;
    if (summaryElement) {
        const pctChange = (medianTerminal - 1) * 100;
        const formattedNumber = this.formatNumber(Math.abs(pctChange), { decimals: 1, useGrouping: true })
            ?? Math.abs(pctChange).toFixed(1);
        const prefix = pctChange >= 0 ? '+' : '-';
        summaryElement.textContent = `Median path suggests ${prefix}${formattedNumber}% over 60 trading days.`;
    }

    const formatPercent = (value) => {
        const percent = (Number(value) - 1) * 100;
        const formattedNumber = this.formatNumber(Math.abs(percent), { decimals: 1, useGrouping: true })
            ?? Math.abs(percent).toFixed(1);
        const prefix = percent >= 0 ? '+' : '-';
        return `${prefix}${formattedNumber}%`;
    };

    const zeroLinePlugin = {
        id: 'monteCarloBaseline',
        afterDatasetsDraw: (chartInstance) => {
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
                    data: projection.percentiles.p10,
                    borderColor: 'rgba(180, 65, 60, 0.6)',
                    backgroundColor: 'rgba(180, 65, 60, 0.12)',
                    borderWidth: 1.5,
                    fill: false,
                    tension: 0.25
                },
                {
                    label: '90th percentile',
                    data: projection.percentiles.p90,
                    borderColor: 'rgba(31, 184, 205, 0.6)',
                    backgroundColor: 'rgba(31, 184, 205, 0.12)',
                    borderWidth: 1.5,
                    fill: '-1',
                    tension: 0.25
                },
                {
                    label: 'Median',
                    data: projection.percentiles.p50,
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
                        callback: (value) => formatPercent(value)
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
                        label: (context) => `${context.dataset.label}: ${formatPercent(context.parsed.y)}`
                    }
                }
            }
        },
        plugins: [zeroLinePlugin]
    });
}

export function ensureMonteCarloBaseline(chart) {
    if (!chart) {
        return;
    }

    const ctx = chart.ctx;
    const yScale = chart.scales?.y;
    const area = chart.chartArea;
    if (!ctx || !yScale || !area) {
        return;
    }

    const zeroPixel = yScale.getPixelForValue(1);
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

export function generateMonteCarloProjection(dailyReturns = [], { periods = 60, simulations = 400 } = {}) {
    if (!Array.isArray(dailyReturns) || dailyReturns.length === 0) {
        return null;
    }

    const sanitized = dailyReturns.filter(value => Number.isFinite(value));
    if (!sanitized.length) {
        return null;
    }

    const trajectory = Array.from({ length: periods }, () => []);

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
    const percentileSeries = percentilesList.map(() => []);

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

export function updateMonthlyPLChart() {
    const canvas = document.getElementById('monthlyPLChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    if (this.charts.monthlyPL) {
        this.charts.monthlyPL.destroy();
    }

    const formatCurrencyValue = (value, decimals = 2) => this.formatCurrency(value, { decimals });

    const monthlyData = {};
    this.trades
        .filter(trade => this.isClosedStatus(trade.status) && trade.exitDate)
        .forEach(trade => {
            const monthKey = trade.exitDate.substring(0, 7); // YYYY-MM
            if (!monthlyData[monthKey]) {
                monthlyData[monthKey] = 0;
            }
            monthlyData[monthKey] += trade.pl;
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
                        callback: (value) => formatCurrencyValue(value, 0)
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
                        label: (context) => `P&L: ${formatCurrencyValue(context.raw)}`
                    }
                }
            }
        }
    });
}

export function updateStrategyPerformanceChart() {
    const canvas = document.getElementById('strategyChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    if (this.charts.strategy) {
        this.charts.strategy.destroy();
    }

    const filteredTrades = this.getClosedTradesInRange();
    const strategyPL = {};
    filteredTrades.forEach(trade => {
        if (!strategyPL[trade.strategy]) {
            strategyPL[trade.strategy] = 0;
        }
        strategyPL[trade.strategy] += trade.pl;
    });

    const sortedStrategies = Object.entries(strategyPL)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 8);

    const formatCurrencyValue = (value, decimals = 2) => this.formatCurrency(value, { decimals });

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
                        callback: (value) => formatCurrencyValue(value, 0)
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: (context) => `P&L: ${formatCurrencyValue(context.raw)}`
                    }
                }
            }
        }
    });
}

export function updateWinRateByStrategyChart() {
    const canvas = document.getElementById('winRateChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    if (this.charts.winRate) {
        this.charts.winRate.destroy();
    }

    const filteredTrades = this.getClosedTradesInRange();
    const strategyStats = {};
    filteredTrades.forEach(trade => {
        if (!strategyStats[trade.strategy]) {
            strategyStats[trade.strategy] = { total: 0, wins: 0 };
        }
        strategyStats[trade.strategy].total++;
        if (trade.pl > 0) {
            strategyStats[trade.strategy].wins++;
        }
    });

    const validStrategies = Object.entries(strategyStats)
        .filter(([, stats]) => stats.total >= 1)
        .map(([strategy, stats]) => ({
            strategy,
            winRate: (stats.wins / stats.total) * 100,
            total: stats.total
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
                        label: (context) => {
                            const percent = this.formatPercent(context.raw, '0%', { decimals: 2 });
                            return `${context.label}: ${percent}`;
                        }
                    }
                }
            }
        }
    });
}

export function inferOptionFlavor(trade = {}) {
    const explicit = (trade.optionType || trade.optionFlavor || '').toString().trim().toLowerCase();
    if (explicit === 'call' || explicit === 'put') {
        return explicit;
    }

    const strategy = (trade.strategy || '').toLowerCase();
    const containsCall = strategy.includes('call');
    const containsPut = strategy.includes('put');

    if (containsCall && !containsPut) {
        return 'call';
    }
    if (containsPut && !containsCall) {
        return 'put';
    }

    const notes = (trade.notes || '').toLowerCase();
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
