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

interface Html2CanvasWindow {
  html2canvas?: (element: HTMLElement, options?: Record<string, unknown>) => Promise<HTMLCanvasElement>
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

export async function downloadShareCard(this: ShareCardContext): Promise<void> {
    const button = this.shareCard?.button;
    const root = this.shareCard?.root;
    const card = this.shareCard?.card;

    if (!button || !root || !card) {
        this.showNotification('Sharing is unavailable right now.', 'error');
        return;
    }

    const html2canvas = (window as unknown as Html2CanvasWindow).html2canvas;
    if (typeof html2canvas !== 'function') {
        this.showNotification('Image export library failed to load. Please refresh and try again.', 'error');
        return;
    }

    const exportSize = Number(this.shareCard?.exportSize) || SHARE_CARD_EXPORT_SIZE;

    const btn = button as HTMLButtonElement;
    const previousDisabled = btn.disabled;
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    btn.blur();

    const previousExportFlag = card.dataset.exportMode;
    const previousWidth = card.style.width;
    const previousHeight = card.style.height;
    const previousMaxWidth = card.style.maxWidth;
    const previousMaxHeight = card.style.maxHeight;

    // Force the card into a deterministic square frame for export.
    card.dataset.exportMode = 'true';
    card.style.width = `${exportSize}px`;
    card.style.height = `${exportSize}px`;
    card.style.maxWidth = `${exportSize}px`;
    card.style.maxHeight = `${exportSize}px`;

    this.updateShareCard(this.latestStats || this.calculateAdvancedStats());
    root.classList.add('is-active');
    root.setAttribute('aria-hidden', 'false');

    await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
            this.refreshShareCardChart();
            setTimeout(resolve, 220);
        });
    });

    await this.waitForShareCardChartRender();

    let canvas: HTMLCanvasElement | null = null;
    try {
        const scale = Math.max(2, Math.min(3, window.devicePixelRatio || 2));
        canvas = await html2canvas(card, {
            width: exportSize,
            height: exportSize,
            scale,
            useCORS: true,
            logging: false,
            backgroundColor: '#050b1a'
        });
    } catch (error) {
        console.error('Failed to capture share card:', error);
        this.showNotification('Unable to prepare the share card image. Please try again.', 'error');
    }

    root.classList.remove('is-active');
    root.setAttribute('aria-hidden', 'true');
    btn.removeAttribute('aria-busy');
    btn.disabled = previousDisabled;

    if (previousExportFlag) {
        card.dataset.exportMode = previousExportFlag;
    } else {
        delete card.dataset.exportMode;
    }

    // Restore the card's natural sizing after capture.
    card.style.width = previousWidth;
    card.style.height = previousHeight;
    card.style.maxWidth = previousMaxWidth;
    card.style.maxHeight = previousMaxHeight;

    if (this.shareCard.chart) {
        disposeChartInstance(this.shareCard.chart);
        this.shareCard.chart = null;
    }

    if (this.shareCard.chartCanvas) {
        this.shareCard.chartCanvas.style.removeProperty('min-height');
        this.shareCard.chartCanvas.style.removeProperty('width');
        this.shareCard.chartCanvas.style.removeProperty('height');
    }

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
