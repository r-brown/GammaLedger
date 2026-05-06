// src/ui/share-card.js — Wave 10: Share card generation and cumulative P&L series.
// Uses the .call(this, …) delegation pattern.

export function normalizeCumulativePLRange(range) {
    const value = (range || '').toString().trim().toUpperCase();
    return CUMULATIVE_PL_RANGES.includes(value) ? value : 'ALL';
}

export function getCumulativePLRangeLabel(range = this.cumulativePLRange) {
    const normalized = this.normalizeCumulativePLRange(range);
    switch (normalized) {
        case '7D':
            return 'Last 7 Days';
        case 'MTD':
            return 'Month to Date';
        case '1M':
            return 'Last 30 Days';
        case '3M':
            return 'Last 3 Months';
        case 'YTD':
            return 'Year to Date';
        case '1Y':
            return 'Last 12 Months';
        case 'ALL':
        default:
            return 'All Time';
    }
}

export function getClosedTradesInRange(range = this.cumulativePLRange) {
    const { start, end } = this.getCumulativePLRangeWindow(range);
    const closedTrades = this.trades.filter(trade => this.isClosedStatus(trade.status));

    if (!start && !end) {
        return closedTrades;
    }

    return closedTrades.filter(trade => {
        const exitDateRaw = this.parseDateValue(trade.exitDate || trade.closedDate);
        if (!exitDateRaw) {
            return false;
        }
        const exitDate = new Date(exitDateRaw);
        exitDate.setHours(0, 0, 0, 0);

        if (start && exitDate < start) {
            return false;
        }
        if (end && exitDate > end) {
            return false;
        }
        return true;
    });
}

export function getCumulativePLRangeWindow(range) {
    const normalized = this.normalizeCumulativePLRange(range);
    if (normalized === 'ALL') {
        return { start: null, end: null };
    }

    const end = new Date(this.currentDate);
    end.setHours(23, 59, 59, 999);

    let start = new Date(this.currentDate);
    start.setHours(0, 0, 0, 0);

    switch (normalized) {
        case '7D':
            start = new Date(end);
            start.setDate(start.getDate() - 6);
            start.setHours(0, 0, 0, 0);
            break;
        case 'MTD':
            start = new Date(end.getFullYear(), end.getMonth(), 1);
            break;
        case '1M':
            start = new Date(end);
            start.setDate(start.getDate() - 30);
            start.setHours(0, 0, 0, 0);
            break;
        case '3M':
            start = new Date(end);
            start.setMonth(start.getMonth() - 3);
            start.setHours(0, 0, 0, 0);
            break;
        case 'YTD':
            start = new Date(end.getFullYear(), 0, 1);
            break;
        case '1Y':
            start = new Date(end);
            start.setFullYear(start.getFullYear() - 1);
            start.setHours(0, 0, 0, 0);
            break;
        default:
            start = null;
            break;
    }

    if (start && start > end) {
        return { start: null, end };
    }

    return { start, end };
}

export function initializeShareCard() {
    const button = document.getElementById('share-portfolio-card');
    const root = document.getElementById('share-card-root');
    const card = root?.querySelector('.share-card');
    const chartCanvas = document.getElementById('share-card-cumulative-chart');

    if (!button || !root || !card || !chartCanvas) {
        return;
    }

    if (button.dataset.initialized === 'true') {
        return;
    }

    this.shareCard.button = button;
    this.shareCard.root = root;
    this.shareCard.card = card;
    this.shareCard.chartCanvas = chartCanvas;
    this.shareCard.chartTitle = card?.querySelector('.share-card__chart-title') || null;
    this.shareCard.rangeLabel = document.getElementById('share-card-range');
    this.shareCard.metrics = {
        totalPL: document.getElementById('share-card-total-pl'),
        winRate: document.getElementById('share-card-win-rate'),
        profitFactor: document.getElementById('share-card-profit-factor'),
        totalROI: document.getElementById('share-card-total-roi')
    };
    this.shareCard.timestamp = document.getElementById('share-card-date');

    this.updateShareCardRangeLabel();

    button.dataset.initialized = 'true';
    button.addEventListener('click', async (event) => {
        event.preventDefault();
        await this.downloadShareCard();
    });

    // Populate once with current stats if available.
    if (this.latestStats) {
        this.updateShareCard(this.latestStats);
    }
}

export function updateShareCardRangeLabel(range = this.cumulativePLRange) {
    if (!this.shareCard) {
        return;
    }

    const label = this.getCumulativePLRangeLabel(range);
    if (this.shareCard.rangeLabel) {
        this.shareCard.rangeLabel.textContent = `Range: ${label}`;
    }
    if (this.shareCard.chartTitle) {
        this.shareCard.chartTitle.textContent = label
            ? `Cumulative P&L (${label})`
            : 'Cumulative P&L';
    }
    if (this.shareCard.chartCanvas) {
        const ariaLabel = label
            ? `Cumulative profit and loss chart for ${label.toLowerCase()}`
            : 'Cumulative profit and loss chart';
        this.shareCard.chartCanvas.setAttribute('aria-label', ariaLabel);
    }
}

export function computeCumulativePLSeries(range = this.cumulativePLRange) {
    const closedTrades = this.trades
        .filter(trade => this.isClosedStatus(trade.status) && trade.exitDate);

    if (closedTrades.length === 0) {
        return null;
    }

    const dayMs = 24 * 60 * 60 * 1000;
    const toStartOfDay = (date) => {
        if (!(date instanceof Date)) {
            return null;
        }
        const normalized = new Date(date);
        normalized.setHours(0, 0, 0, 0);
        return normalized;
    };
    const toISODate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const dailyPL = new Map();
    let earliestDate = null;
    let latestDate = null;

    closedTrades.forEach(trade => {
        const exitDateRaw = this.parseDateValue(trade.exitDate);
        if (!exitDateRaw) {
            return;
        }

        const exitDate = toStartOfDay(exitDateRaw);
        if (!exitDate) {
            return;
        }

        const plValue = this.parseDecimal(trade.pl, 0);
        const normalizedPL = Number.isFinite(plValue) ? plValue : 0;
        const key = toISODate(exitDate);
        dailyPL.set(key, (dailyPL.get(key) || 0) + normalizedPL);

        if (!earliestDate || exitDate < earliestDate) {
            earliestDate = new Date(exitDate);
        }
        if (!latestDate || exitDate > latestDate) {
            latestDate = new Date(exitDate);
        }
    });

    if (!earliestDate || !latestDate) {
        return null;
    }

    const cumulativeByDate = new Map();
    const fullDailySeries = [];
    let cumulativePL = 0;
    const cursor = new Date(earliestDate);

    while (cursor.getTime() <= latestDate.getTime()) {
        const current = new Date(cursor);
        const key = toISODate(current);
        const dayPL = dailyPL.get(key) || 0;
        cumulativePL += dayPL;
        cumulativeByDate.set(key, cumulativePL);
        fullDailySeries.push({ date: current, value: cumulativePL });
        cursor.setDate(cursor.getDate() + 1);
    }

    const normalizedRange = this.normalizeCumulativePLRange(range);
    let { start, end } = this.getCumulativePLRangeWindow(normalizedRange);

    start = start ? toStartOfDay(start) : null;
    end = end ? toStartOfDay(end) : null;

    if (!start || start < earliestDate) {
        start = new Date(earliestDate);
    }
    if (!end || end > latestDate) {
        end = new Date(latestDate);
    }

    if (start > end) {
        return null;
    }

    const includedDaily = fullDailySeries.filter(entry => entry.date >= start && entry.date <= end);
    if (!includedDaily.length) {
        return null;
    }

    const daySpan = Math.floor((end.getTime() - start.getTime()) / dayMs) + 1;
    const useDailyStep = daySpan < 7;

    const firstIncludedDate = includedDaily[0].date;
    const baselineProbe = new Date(firstIncludedDate);
    baselineProbe.setDate(baselineProbe.getDate() - 1);
    const baselineKey = toISODate(baselineProbe);
    const baseline = cumulativeByDate.get(baselineKey) ?? 0;

    if (useDailyStep) {
        const labels = includedDaily.map(entry => this.formatDayLabel(entry.date));
        const dataPoints = includedDaily.map(entry => {
            const adjusted = entry.value - baseline;
            return Math.abs(adjusted) < 1e-9 ? 0 : adjusted;
        });
        const dates = includedDaily.map(entry => new Date(entry.date));

        return { labels, dataPoints, dates };
    }

    const weeklyMap = new Map();
    includedDaily.forEach(entry => {
        const weekEnding = this.getWeekEndingFriday(entry.date);
        if (!weekEnding) {
            return;
        }

        const key = this.getWeekKey(weekEnding);
        const existing = weeklyMap.get(key);
        if (!existing || entry.date > existing.entry.date) {
            weeklyMap.set(key, { weekEnding: new Date(weekEnding), entry });
        }
    });

    const weeklyEntries = Array.from(weeklyMap.values())
        .sort((a, b) => a.entry.date.getTime() - b.entry.date.getTime());

    if (!weeklyEntries.length) {
        return null;
    }

    const labels = weeklyEntries.map(item => this.formatWeekLabel(item.weekEnding));
    const dataPoints = weeklyEntries.map(item => {
        const adjusted = item.entry.value - baseline;
        return Math.abs(adjusted) < 1e-9 ? 0 : adjusted;
    });
    const dates = weeklyEntries.map(item => new Date(item.weekEnding));

    return { labels, dataPoints, dates };
}

export function updateShareCard(stats) {
    if (!this.shareCard?.card) {
        return;
    }

    const metrics = this.shareCard.metrics || {};
    const safeStats = stats || this.latestStats || this.calculateAdvancedStats();

    const formatPercent = (value, decimals = 2) => {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
            return 'Infinite';
        }
        const formatted = this.formatNumber(numeric, { decimals, useGrouping: true });
        return formatted ? `${formatted}%` : `${numeric.toFixed(decimals)}%`;
    };

    if (metrics.totalPL) {
        metrics.totalPL.textContent = this.formatCurrency(safeStats.realizedPL || 0);
    }
    if (metrics.winRate) {
        metrics.winRate.textContent = formatPercent(safeStats.winRate, 1);
    }
    if (metrics.profitFactor) {
        const profitFactor = Number(safeStats.profitFactor);
        metrics.profitFactor.textContent = Number.isFinite(profitFactor)
            ? profitFactor.toFixed(2)
            : 'Infinite';
    }
    if (metrics.totalROI) {
        metrics.totalROI.textContent = formatPercent(safeStats.totalROI, 2);
    }
    if (this.shareCard.timestamp) {
        const now = new Date();
        this.shareCard.timestamp.textContent = now.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    this.updateShareCardRangeLabel();
}

export function refreshShareCardChart() {
    if (!this.shareCard?.chartCanvas) {
        return;
    }

    this.updateShareCardRangeLabel();

    const ctx = this.shareCard.chartCanvas.getContext('2d');
    if (!ctx) {
        return;
    }

    const exportSize = Number(this.shareCard?.exportSize) || SHARE_CARD_EXPORT_SIZE;
    const cardWidth = this.shareCard.card?.clientWidth || exportSize;
    const exportMode = this.shareCard.card?.dataset.exportMode === 'true';
    const baseSize = exportMode ? exportSize : cardWidth;

    const canvasWidth = Math.round(Math.max(320, baseSize * SHARE_CARD_CHART_WIDTH_RATIO));
    const canvasHeight = Math.round(Math.max(SHARE_CARD_CHART_MIN_HEIGHT, baseSize * SHARE_CARD_CHART_HEIGHT_RATIO));

    this.shareCard.chartCanvas.width = canvasWidth;
    this.shareCard.chartCanvas.height = canvasHeight;

    if (exportMode) {
        this.shareCard.chartCanvas.style.setProperty('min-height', `${canvasHeight}px`);
    } else {
        this.shareCard.chartCanvas.style.removeProperty('min-height');
    }

    if (this.shareCard.chart) {
        this.shareCard.chart.destroy();
        this.shareCard.chart = null;
    }

const series = this.computeCumulativePLSeries(this.cumulativePLRange);
    const hasData = Boolean(series?.labels?.length && series?.dataPoints?.length);
    const labels = hasData ? series.labels : ['No Data'];
    const dataPoints = hasData ? series.dataPoints : [0];

const gradient = ctx.createLinearGradient(0, 0, 0, canvasHeight);
    gradient.addColorStop(0, 'rgba(79, 195, 247, 0.38)');
    gradient.addColorStop(1, 'rgba(79, 195, 247, 0.05)');

const formatCurrencyValue = (value, decimals = 2) => this.formatCurrency(value, { decimals });

this.shareCard.chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Cumulative P&L',
                data: dataPoints,
                borderColor: '#4FC3F7',
                backgroundColor: gradient,
                fill: true,
                tension: 0.35,
                pointRadius: hasData ? 3 : 0,
                pointHoverRadius: hasData ? 5 : 0,
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.58)',
                        maxRotation: 0,
                        minRotation: 0,
                        font: {
                            size: 12
                        }
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.08)'
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.58)',
                        callback: (value) => formatCurrencyValue(value, 0),
                        font: {
                            size: 12
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: (context) => `Cumulative P&L: ${formatCurrencyValue(context.raw)}`
                    }
                }
            }
        }
    });
}
