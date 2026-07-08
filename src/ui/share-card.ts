// src/ui/share-card.ts — Wave 10: Share card generation and cumulative P&L series.
// Uses the .call(this, …) delegation pattern.

import {
    CUMULATIVE_PL_RANGES,
    SHARE_CARD_CHART_HEIGHT_RATIO,
    SHARE_CARD_CHART_MIN_HEIGHT,
    SHARE_CARD_CHART_WIDTH_RATIO,
    SHARE_CARD_EXPORT_SIZE
} from '@core/config'
import { disposeChartInstance, renderEChart } from './charts/echarts.js'

type TradeRecord = Record<string, unknown>

interface CumulativePLSeries {
  labels: string[]
  dataPoints: number[]
  dates: Date[]
}

interface ShareCardElements {
  button: HTMLElement | null
  root: HTMLElement | null
  card: HTMLElement | null
  chartCanvas: HTMLElement | null
  chartTitle: HTMLElement | null
  rangeLabel: HTMLElement | null
  chart: unknown | null
  exportSize?: number
  metrics: {
    totalPL: HTMLElement | null
    winRate: HTMLElement | null
    profitFactor: HTMLElement | null
    totalROI: HTMLElement | null
  }
  timestamp: HTMLElement | null
}

interface DashboardStats {
  realizedPL: number
  winRate: number
  profitFactor: number
  totalROI: number
  [key: string]: unknown
}

interface ShareCardContext {
  currentDate: Date
  cumulativePLRange: string
  shareCard: ShareCardElements
  trades: TradeRecord[]
  latestStats: DashboardStats | null
  normalizeCumulativePLRange(range: string): string
  getCumulativePLRangeLabel(range?: string): string
  getCumulativePLRangeWindow(range: string): { start: Date | null; end: Date | null }
  computeCumulativePLSeries(range: string): CumulativePLSeries | null
  getClosedTradesInRange(range?: string): TradeRecord[]
  isClosedStatus(status: unknown): boolean
  isFullyRealizedTrade(trade: TradeRecord): boolean
  parseDateValue(value: unknown): Date | null
  parseDecimal(value: unknown, fallback: number): number
  formatCurrency(value: unknown, opts?: Record<string, unknown>): string
  formatNumber(value: unknown, opts: Record<string, unknown>): string | null
  formatDayLabel(date: Date): string
  formatWeekLabel(date: Date): string
  getWeekEndingFriday(date: Date): Date | null
  getWeekKey(date: Date): string
  updateShareCard(stats: DashboardStats): void
  updateShareCardRangeLabel(range?: string): void
  refreshShareCardChart(): void
  waitForShareCardChartRender(): Promise<void>
  calculateAdvancedStats(): DashboardStats
  downloadShareCard(): Promise<void>
  syncCumulativePLControls(): void
  showNotification(message: string, variant?: string): void
}

export function normalizeCumulativePLRange(range: unknown): string {
    const value = ((range || '') as string).toString().trim().toUpperCase();
    return CUMULATIVE_PL_RANGES.includes(value) ? value : 'ALL';
}

export function getCumulativePLRangeLabel(this: ShareCardContext, range: string = this.cumulativePLRange): string {
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

export function getClosedTradesInRange(this: ShareCardContext, range: string = this.cumulativePLRange): TradeRecord[] {
    const { start, end } = this.getCumulativePLRangeWindow(range);
    const closedTrades = this.trades.filter(trade => this.isFullyRealizedTrade(trade));

    if (!start && !end) {
        return closedTrades;
    }

    return closedTrades.filter(trade => {
        // Assigned trades may have closedDate empty — fall back to openedDate so
        // the realized option premium still lands in the correct time bucket.
        const exitDateRaw = this.parseDateValue(trade.closedDate as unknown)
            ?? this.parseDateValue(trade.openedDate as unknown);
        if (!exitDateRaw) {
            return false;
        }
        // Date-only strings ('YYYY-MM-DD') parse as UTC midnight; flooring
        // with local setHours would shift them to the previous day in
        // UTC-negative timezones. Rebuild the calendar date from UTC parts so
        // it compares correctly against the local-midnight range window.
        const exitDate = new Date(
            exitDateRaw.getUTCFullYear(), exitDateRaw.getUTCMonth(), exitDateRaw.getUTCDate());

        if (start && exitDate < start) {
            return false;
        }
        if (end && exitDate > end) {
            return false;
        }
        return true;
    });
}

export function getCumulativePLRangeWindow(this: ShareCardContext, range: string): { start: Date | null; end: Date | null } {
    const normalized = this.normalizeCumulativePLRange(range);
    if (normalized === 'ALL') {
        return { start: null, end: null };
    }

    const end = new Date(this.currentDate);
    end.setHours(23, 59, 59, 999);

    let start: Date | null = new Date(this.currentDate);
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

export function initializeShareCard(this: ShareCardContext): void {
    const button = document.getElementById('share-portfolio-card');
    const root = document.getElementById('share-card-root');
    const card = root?.querySelector('.share-card') as HTMLElement | null;
    const chartCanvas = document.getElementById('share-card-cumulative-chart');

    if (!button || !root || !card || !chartCanvas) {
        return;
    }

    if ((button as HTMLElement & { dataset: DOMStringMap }).dataset.initialized === 'true') {
        return;
    }

    this.shareCard.button = button;
    this.shareCard.root = root;
    this.shareCard.card = card;
    this.shareCard.chartCanvas = chartCanvas;
    this.shareCard.chartTitle = (card?.querySelector('.share-card__chart-title') as HTMLElement | null) || null;
    this.shareCard.rangeLabel = document.getElementById('share-card-range');
    this.shareCard.metrics = {
        totalPL: document.getElementById('share-card-total-pl'),
        winRate: document.getElementById('share-card-win-rate'),
        profitFactor: document.getElementById('share-card-profit-factor'),
        totalROI: document.getElementById('share-card-total-roi')
    };
    this.shareCard.timestamp = document.getElementById('share-card-date');

    this.updateShareCardRangeLabel();

    (button as HTMLElement & { dataset: DOMStringMap }).dataset.initialized = 'true';
    button.addEventListener('click', async (event) => {
        event.preventDefault();
        await this.downloadShareCard();
    });

    if (this.latestStats) {
        this.updateShareCard(this.latestStats);
    }
}

export function updateShareCardRangeLabel(this: ShareCardContext, range: string = this.cumulativePLRange): void {
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

export function computeCumulativePLSeries(this: ShareCardContext, range: string = this.cumulativePLRange): CumulativePLSeries | null {
    const closedTrades = this.trades
        .filter(trade => this.isClosedStatus(trade.status) && trade.closedDate);

    if (closedTrades.length === 0) {
        return null;
    }

    const dayMs = 24 * 60 * 60 * 1000;
    const toStartOfDay = (date: Date): Date | null => {
        if (!(date instanceof Date)) {
            return null;
        }
        const normalized = new Date(date);
        normalized.setHours(0, 0, 0, 0);
        return normalized;
    };
    const toISODate = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const dailyPL = new Map<string, number>();
    let earliestDate: Date | null = null;
    let latestDate: Date | null = null;

    closedTrades.forEach(trade => {
        const exitDateRaw = this.parseDateValue(trade.closedDate as unknown);
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

    const cumulativeByDate = new Map<string, number>();
    const fullDailySeries: Array<{ date: Date; value: number }> = [];
    let cumulativePL = 0;
    const cursor = new Date(earliestDate);

    while (cursor.getTime() <= (latestDate as Date).getTime()) {
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

    let startDay = start ? toStartOfDay(start) : null;
    let endDay = end ? toStartOfDay(end) : null;

    if (!startDay || startDay < (earliestDate as Date)) {
        startDay = new Date(earliestDate as Date);
    }
    if (!endDay || endDay > (latestDate as Date)) {
        endDay = new Date(latestDate as Date);
    }

    if (startDay > endDay) {
        return null;
    }

    const includedDaily = fullDailySeries.filter(entry => entry.date >= startDay! && entry.date <= endDay!);
    if (!includedDaily.length) {
        return null;
    }

    const daySpan = Math.floor((endDay.getTime() - startDay.getTime()) / dayMs) + 1;
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

    const weeklyMap = new Map<string, { weekEnding: Date; entry: { date: Date; value: number } }>();
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

export function updateShareCard(this: ShareCardContext, stats: DashboardStats): void {
    if (!this.shareCard?.card) {
        return;
    }

    const metrics = this.shareCard.metrics || { totalPL: null, winRate: null, profitFactor: null, totalROI: null };
    const safeStats = stats || this.latestStats || this.calculateAdvancedStats();

    const formatPercent = (value: unknown, decimals = 2) => {
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

export function refreshShareCardChart(this: ShareCardContext): void {
    const chartRoot = this.shareCard?.chartCanvas;
    if (!chartRoot) {
        return;
    }

    this.updateShareCardRangeLabel();

    const exportSize = Number(this.shareCard?.exportSize) || SHARE_CARD_EXPORT_SIZE;
    const cardWidth = (this.shareCard.card as HTMLElement | null)?.clientWidth || exportSize;
    const exportMode = (this.shareCard.card as HTMLElement & { dataset: DOMStringMap } | null)?.dataset.exportMode === 'true';
    const baseSize = exportMode ? exportSize : cardWidth;

    const canvasWidth = Math.round(Math.max(320, baseSize * SHARE_CARD_CHART_WIDTH_RATIO));
    const canvasHeight = Math.round(Math.max(SHARE_CARD_CHART_MIN_HEIGHT, baseSize * SHARE_CARD_CHART_HEIGHT_RATIO));

    chartRoot.style.setProperty('width', `${canvasWidth}px`, 'important');
    chartRoot.style.setProperty('height', `${canvasHeight}px`, 'important');

    if (exportMode) {
        chartRoot.style.setProperty('min-height', `${canvasHeight}px`);
    } else {
        chartRoot.style.removeProperty('min-height');
    }

    const series = this.computeCumulativePLSeries(this.cumulativePLRange);
    const hasData = Boolean(series?.labels?.length && series?.dataPoints?.length);
    const labels = hasData ? (series as CumulativePLSeries).labels : ['No Data'];
    const dataPoints = hasData ? (series as CumulativePLSeries).dataPoints : [0];
    const formatCurrencyValue = (value: unknown, decimals = 2) => this.formatCurrency(value, { decimals });

    this.shareCard.chart = renderEChart(chartRoot, this.shareCard.chart, {
        animation: false,
        aria: { enabled: true },
        grid: { top: 10, right: 16, bottom: 26, left: 8, containLabel: true },
        tooltip: {
            trigger: 'axis',
            formatter: (params: unknown) => {
                const item = Array.isArray(params) ? params[0] as { value?: unknown } : null;
                return item ? `Cumulative P&L: ${formatCurrencyValue(item.value)}` : '';
            }
        },
        xAxis: {
            type: 'category',
            data: labels,
            axisTick: { show: false },
            axisLine: { show: false },
            axisLabel: {
                color: 'rgba(255, 255, 255, 0.58)',
                rotate: 0,
                fontSize: 12
            },
            splitLine: { show: false }
        },
        yAxis: {
            type: 'value',
            axisLine: { show: false },
            axisLabel: {
                color: 'rgba(255, 255, 255, 0.58)',
                formatter: (value: unknown) => formatCurrencyValue(value, 0),
                fontSize: 12
            },
            splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.08)' } }
        },
        series: [{
            type: 'line',
            name: 'Cumulative P&L',
            data: dataPoints,
            showSymbol: hasData,
            symbolSize: hasData ? 6 : 0,
            smooth: 0.35,
            lineStyle: { color: '#4FC3F7', width: 2 },
            itemStyle: { color: '#4FC3F7' },
            areaStyle: {
                color: {
                    type: 'linear',
                    x: 0,
                    y: 0,
                    x2: 0,
                    y2: 1,
                    colorStops: [
                        { offset: 0, color: 'rgba(79, 195, 247, 0.38)' },
                        { offset: 1, color: 'rgba(79, 195, 247, 0.05)' }
                    ]
                }
            }
        }]
    });
}

export async function waitForShareCardChartRender(): Promise<void> {
    const raf = typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame
        : null;

    if (!raf) {
        await new Promise(resolve => setTimeout(resolve, 200));
        return;
    }

    await new Promise<void>(resolve => {
        raf(() => {
            raf(() => resolve());
        });
    });
}

function formatShareCardPercent(this: ShareCardContext, value: unknown, decimals = 2): string {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return 'Infinite';
    }
    const formatted = this.formatNumber(numeric, { decimals, useGrouping: true });
    return formatted ? `${formatted}%` : `${numeric.toFixed(decimals)}%`;
}

function drawRoundedRect(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
): void {
    const safeRadius = Math.max(0, Math.min(radius, width / 2, height / 2));
    context.beginPath();
    context.moveTo(x + safeRadius, y);
    context.lineTo(x + width - safeRadius, y);
    context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
    context.lineTo(x + width, y + height - safeRadius);
    context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
    context.lineTo(x + safeRadius, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
    context.lineTo(x, y + safeRadius);
    context.quadraticCurveTo(x, y, x + safeRadius, y);
    context.closePath();
}

function setCanvasFont(
    context: CanvasRenderingContext2D,
    weight: number,
    size: number,
    lineHeight = 1.2
): void {
    context.font = `${weight} ${size}px/${lineHeight} Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
}

function drawFittedText(
    context: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    options: { weight: number; size: number; minSize?: number; color: string; align?: CanvasTextAlign }
): void {
    const minSize = options.minSize ?? 22;
    let size = options.size;
    setCanvasFont(context, options.weight, size);
    while (size > minSize && context.measureText(text).width > maxWidth) {
        size -= 2;
        setCanvasFont(context, options.weight, size);
    }
    context.fillStyle = options.color;
    context.textAlign = options.align || 'left';
    context.fillText(text, x, y);
}

function createShareCardCanvas(this: ShareCardContext, stats: DashboardStats, exportSize: number): HTMLCanvasElement {
    const pixelRatio = Math.max(2, Math.min(3, window.devicePixelRatio || 2));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(exportSize * pixelRatio);
    canvas.height = Math.round(exportSize * pixelRatio);
    canvas.style.width = `${exportSize}px`;
    canvas.style.height = `${exportSize}px`;

    const context = canvas.getContext('2d');
    if (!context) {
        throw new Error('Canvas rendering is unavailable.');
    }

    context.scale(pixelRatio, pixelRatio);
    context.textBaseline = 'alphabetic';

    const background = context.createLinearGradient(0, 0, exportSize, exportSize);
    background.addColorStop(0, '#07101f');
    background.addColorStop(0.52, '#050b1a');
    background.addColorStop(1, '#071826');
    context.fillStyle = background;
    context.fillRect(0, 0, exportSize, exportSize);

    context.fillStyle = 'rgba(79, 195, 247, 0.08)';
    context.beginPath();
    context.arc(940, 120, 240, 0, Math.PI * 2);
    context.fill();

    const padding = 72;
    const rangeLabel = this.getCumulativePLRangeLabel(this.cumulativePLRange);
    const timestamp = new Date().toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    setCanvasFont(context, 800, 54, 1.05);
    context.fillStyle = '#f8fbff';
    context.textAlign = 'left';
    context.fillText('Portfolio Snapshot', padding, 120);

    setCanvasFont(context, 600, 25);
    context.fillStyle = 'rgba(255, 255, 255, 0.72)';
    context.fillText(`Range: ${rangeLabel}`, padding, 164);

    setCanvasFont(context, 600, 22);
    context.textAlign = 'right';
    context.fillStyle = 'rgba(255, 255, 255, 0.62)';
    context.fillText(timestamp, exportSize - padding, 108);

    setCanvasFont(context, 800, 28);
    context.fillStyle = '#4fc3f7';
    context.fillText('GammaLedger', exportSize - padding, 154);

    const metricGap = 20;
    const metricY = 228;
    const metricWidth = (exportSize - padding * 2 - metricGap) / 2;
    const metricHeight = 126;
    const metrics = [
        {
            label: 'Realized P&L',
            value: this.formatCurrency(stats.realizedPL || 0),
            color: Number(stats.realizedPL) >= 0 ? '#6ee7b7' : '#fca5a5'
        },
        {
            label: 'Win Rate',
            value: formatShareCardPercent.call(this, stats.winRate, 1),
            color: '#f8fbff'
        },
        {
            label: 'Profit Factor',
            value: Number.isFinite(Number(stats.profitFactor)) ? Number(stats.profitFactor).toFixed(2) : 'Infinite',
            color: '#f8fbff'
        },
        {
            label: 'Total ROI',
            value: formatShareCardPercent.call(this, stats.totalROI, 2),
            color: Number(stats.totalROI) >= 0 ? '#6ee7b7' : '#fca5a5'
        }
    ];

    metrics.forEach((metric, index) => {
        const x = padding + (index % 2) * (metricWidth + metricGap);
        const y = metricY + Math.floor(index / 2) * (metricHeight + metricGap);
        drawRoundedRect(context, x, y, metricWidth, metricHeight, 8);
        context.fillStyle = 'rgba(255, 255, 255, 0.075)';
        context.fill();
        context.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        context.lineWidth = 1;
        context.stroke();

        setCanvasFont(context, 700, 21);
        context.fillStyle = 'rgba(255, 255, 255, 0.62)';
        context.textAlign = 'left';
        context.fillText(metric.label, x + 28, y + 42);
        drawFittedText(context, metric.value, x + 28, y + 91, metricWidth - 56, {
            weight: 800,
            size: 42,
            minSize: 26,
            color: metric.color
        });
    });

    const chartX = padding;
    const chartY = 548;
    const chartWidth = exportSize - padding * 2;
    const chartHeight = 380;
    drawRoundedRect(context, chartX, chartY, chartWidth, chartHeight, 8);
    context.fillStyle = 'rgba(255, 255, 255, 0.06)';
    context.fill();
    context.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    context.stroke();

    setCanvasFont(context, 800, 28);
    context.fillStyle = '#f8fbff';
    context.textAlign = 'left';
    context.fillText(`Cumulative P&L (${rangeLabel})`, chartX + 32, chartY + 52);

    const series = this.computeCumulativePLSeries(this.cumulativePLRange);
    const hasData = Boolean(series?.dataPoints?.length);
    const plot = {
        x: chartX + 78,
        y: chartY + 92,
        width: chartWidth - 118,
        height: chartHeight - 156
    };

    context.strokeStyle = 'rgba(255, 255, 255, 0.10)';
    context.lineWidth = 1;
    for (let i = 0; i <= 4; i += 1) {
        const y = plot.y + (plot.height / 4) * i;
        context.beginPath();
        context.moveTo(plot.x, y);
        context.lineTo(plot.x + plot.width, y);
        context.stroke();
    }

    if (hasData && series) {
        const values = series.dataPoints;
        let min = Math.min(0, ...values);
        let max = Math.max(0, ...values);
        if (min === max) {
            min -= 1;
            max += 1;
        }
        const paddingValue = (max - min) * 0.12;
        min -= paddingValue;
        max += paddingValue;

        const xFor = (index: number): number => {
            if (values.length === 1) {
                return plot.x + plot.width / 2;
            }
            return plot.x + (plot.width * index) / (values.length - 1);
        };
        const yFor = (value: number): number => plot.y + plot.height - ((value - min) / (max - min)) * plot.height;
        const zeroY = yFor(0);

        context.strokeStyle = 'rgba(255, 255, 255, 0.22)';
        context.beginPath();
        context.moveTo(plot.x, zeroY);
        context.lineTo(plot.x + plot.width, zeroY);
        context.stroke();

        const areaGradient = context.createLinearGradient(0, plot.y, 0, plot.y + plot.height);
        areaGradient.addColorStop(0, 'rgba(79, 195, 247, 0.34)');
        areaGradient.addColorStop(1, 'rgba(79, 195, 247, 0.02)');
        context.beginPath();
        values.forEach((value, index) => {
            const x = xFor(index);
            const y = yFor(value);
            if (index === 0) {
                context.moveTo(x, y);
            } else {
                context.lineTo(x, y);
            }
        });
        context.lineTo(xFor(values.length - 1), plot.y + plot.height);
        context.lineTo(xFor(0), plot.y + plot.height);
        context.closePath();
        context.fillStyle = areaGradient;
        context.fill();

        context.beginPath();
        values.forEach((value, index) => {
            const x = xFor(index);
            const y = yFor(value);
            if (index === 0) {
                context.moveTo(x, y);
            } else {
                context.lineTo(x, y);
            }
        });
        context.strokeStyle = '#4fc3f7';
        context.lineWidth = 5;
        context.lineJoin = 'round';
        context.lineCap = 'round';
        context.stroke();

        if (values.length <= 16) {
            values.forEach((value, index) => {
                context.beginPath();
                context.arc(xFor(index), yFor(value), 6, 0, Math.PI * 2);
                context.fillStyle = '#4fc3f7';
                context.fill();
                context.strokeStyle = '#050b1a';
                context.lineWidth = 3;
                context.stroke();
            });
        }

        setCanvasFont(context, 600, 18);
        context.fillStyle = 'rgba(255, 255, 255, 0.56)';
        context.textAlign = 'right';
        context.fillText(this.formatCurrency(max, { decimals: 0 }), plot.x - 14, plot.y + 6);
        context.fillText(this.formatCurrency(0, { decimals: 0 }), plot.x - 14, zeroY + 6);
        context.fillText(this.formatCurrency(min, { decimals: 0 }), plot.x - 14, plot.y + plot.height);

        const labelIndexes = Array.from(new Set([
            0,
            Math.floor((series.labels.length - 1) / 2),
            series.labels.length - 1
        ])).filter(index => index >= 0 && index < series.labels.length);
        context.textAlign = 'center';
        labelIndexes.forEach(index => {
            context.fillText(series.labels[index], xFor(index), plot.y + plot.height + 38);
        });
    } else {
        setCanvasFont(context, 700, 27);
        context.textAlign = 'center';
        context.fillStyle = 'rgba(255, 255, 255, 0.62)';
        context.fillText('No closed trades in this range', chartX + chartWidth / 2, chartY + 220);
    }

    setCanvasFont(context, 700, 22);
    context.textAlign = 'left';
    context.fillStyle = 'rgba(255, 255, 255, 0.56)';
    context.fillText('Generated with GammaLedger.com', padding, exportSize - 74);

    context.textAlign = 'right';
    context.fillStyle = 'rgba(79, 195, 247, 0.84)';
    context.fillText('Options portfolio analytics', exportSize - padding, exportSize - 74);

    return canvas;
}

export async function downloadShareCard(this: ShareCardContext): Promise<void> {
    const button = this.shareCard?.button;

    if (!button) {
        this.showNotification('Sharing is unavailable right now.', 'error');
        return;
    }

    const exportSize = Number(this.shareCard?.exportSize) || SHARE_CARD_EXPORT_SIZE;

    const btn = button as HTMLButtonElement;
    const previousDisabled = btn.disabled;
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    btn.blur();

    const stats = this.latestStats || this.calculateAdvancedStats();
    this.updateShareCard(stats);
    let canvas: HTMLCanvasElement | null = null;
    try {
        canvas = createShareCardCanvas.call(this, stats, exportSize);
    } catch (error) {
        console.error('Failed to capture share card:', error);
        this.showNotification('Unable to prepare the share card image. Please try again.', 'error');
    }

    btn.removeAttribute('aria-busy');
    btn.disabled = previousDisabled;

    if (!canvas) {
        return;
    }

    try {
        const dataUrl = canvas.toDataURL('image/png');
        const today = new Date();
        const stamp = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('');
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `gammaledger-portfolio-${stamp}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        this.showNotification('Portfolio snapshot saved as an image.', 'success');
    } catch (error) {
        console.error('Failed to download image:', error);
        this.showNotification('Image download failed. Please try again.', 'error');
    }
}
