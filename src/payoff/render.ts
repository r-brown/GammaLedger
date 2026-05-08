// src/payoff/render.js — Wave 6: Payoff chart toggle and rendering.
// Uses the .call(this, …) delegation pattern.

import { disposeChartInstance, renderEChart, type GammaChartOption } from '../ui/charts/echarts.js'

type AnyRecord = Record<string, any>

interface PayoffPoint {
    x: number
    y: number
}

interface PayoffResult {
    points?: PayoffPoint[]
    zeroLinePoints?: PayoffPoint[]
    breakeven?: number | number[] | null
    maxProfit?: number | null
    maxLoss?: number | null
    message?: string
    [key: string]: any
}

export function toggleTradePayoffDetail(this: any, row: HTMLElement | null, detailRow: HTMLElement | null, trade: AnyRecord, chartId: string, footnoteId: string) {
    if (!detailRow) {
        return;
    }

    const isOpen = !detailRow.classList.contains('is-open');

    detailRow.classList.toggle('is-open', isOpen);
    detailRow.style.display = isOpen
        ? (detailRow instanceof HTMLTableRowElement ? 'table-row' : 'block')
        : 'none';
    detailRow.setAttribute('aria-hidden', String(!isOpen));
    row?.setAttribute('aria-expanded', String(isOpen));

    const detailChart = detailRow.querySelector('.echarts-chart');
    if (detailChart) {
        detailChart.setAttribute('aria-hidden', String(!isOpen));
    }

    if (isOpen) {
        const renderPromise = this.renderTradePayoffChart(trade, chartId, footnoteId);
        if (renderPromise?.catch) {
            renderPromise.catch((error: unknown) => {
                console.error('Failed to render payoff chart:', error);
            });
        }
    } else {
        this.destroyTradePayoffChart(chartId, footnoteId);
    }
}

export function destroyTradePayoffChart(this: any, chartId: string, footnoteId?: string) {
    const existingChart = this.tradeDetailCharts?.get(chartId);
    if (existingChart) {
        disposeChartInstance(existingChart);
        this.tradeDetailCharts.delete(chartId);
    }

    const chartRoot = document.getElementById(chartId);
    const wrapper = chartRoot?.parentElement;
    if (chartRoot) {
        chartRoot.innerHTML = '';
        chartRoot.classList.remove('hidden');
    }
    wrapper?.classList.remove('trade-diagram__canvas--empty');

    if (footnoteId) {
        const footnote = document.getElementById(footnoteId);
        if (footnote) {
            footnote.textContent = 'Tap or click the trade row to generate the payoff diagram.';
        }
    }
}

export async function renderTradePayoffChart(this: any, trade: Record<string, unknown>, chartId: string, footnoteId: string) {
    const chartRoot = document.getElementById(chartId);
    const footnote = document.getElementById(footnoteId);
    const wrapper = chartRoot?.parentElement;

    if (!chartRoot) {
        if (footnote) {
            footnote.textContent = 'Chart element missing; cannot generate payoff diagram.';
        }
        return;
    }

    if (this.tradeDetailCharts?.has(chartId)) {
        return; // Already rendered
    }

    if (footnote) {
        footnote.textContent = 'Loading live price and payoff data…';
    }

    const payoff = this.calculatePayoffSeries(trade) as PayoffResult | null;

    if (!payoff || !Array.isArray(payoff.points) || payoff.points.length === 0) {
        if (wrapper) {
            wrapper.classList.add('trade-diagram__canvas--empty');
        }
        chartRoot.classList.add('hidden');
        if (footnote) {
            footnote.textContent = payoff?.message || 'Payoff diagram not available for this strategy yet.';
        }
        return;
    }

    chartRoot.classList.remove('hidden');
    wrapper?.classList.remove('trade-diagram__canvas--empty');

    const currencyFormatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 2
    });

    const profitColor = 'rgba(34, 197, 94, 1)'; // green
    const lossColor = 'rgba(248, 113, 113, 1)'; // red
    const profitFill = 'rgba(34, 197, 94, 0.15)';
    const lossFill = 'rgba(248, 113, 113, 0.15)';

    const yValues = payoff.points.map((point: PayoffPoint) => point.y);
    let minY = Math.min(...yValues, 0);
    let maxY = Math.max(...yValues, 0);

    if (!Number.isFinite(minY) || !Number.isFinite(maxY)) {
        if (footnote) {
            footnote.textContent = 'Unable to calculate payoff range.';
        }
        return;
    }

    // Use trade's Max Risk if available to set accurate max loss
    const tradeMaxRisk = Number(trade.maxRiskOverride || trade.maxRisk);
    if (Number.isFinite(tradeMaxRisk) && tradeMaxRisk > 0) {
        minY = Math.min(minY, -tradeMaxRisk);
    }

    if (minY === maxY) {
        minY -= 1;
        maxY += 1;
    }

    // Prepare positive and negative fill areas extending to entire diagram
    const xMin = Math.min(...payoff.points.map((p: PayoffPoint) => p.x));
    const xMax = Math.max(...payoff.points.map((p: PayoffPoint) => p.x));

    const positiveArea: PayoffPoint[] = [
        { x: xMin, y: 0 },
        ...payoff.points.map((point: PayoffPoint) => ({
            x: point.x,
            y: point.y > 0 ? point.y : 0
        })),
        { x: xMax, y: 0 }
    ];
    const negativeArea: PayoffPoint[] = [
        { x: xMin, y: 0 },
        ...payoff.points.map((point: PayoffPoint) => ({
            x: point.x,
            y: point.y < 0 ? point.y : 0
        })),
        { x: xMax, y: 0 }
    ];

    const currentPrice = await this.getUnderlyingPriceForPayoff(trade);

    const detailRowElement = document.querySelector(`.trade-detail-row[data-chart-id="${chartId}"]`);
    if (detailRowElement && !detailRowElement.classList.contains('is-open')) {
        if (footnote) {
            footnote.textContent = 'Tap or click the trade row to generate the payoff diagram.';
        }
        return;
    }

    // Handle breakeven - can be single value or array
    const breakevenValue = Array.isArray(payoff.breakeven)
        ? payoff.breakeven[0]
        : payoff.breakeven;

    const breakevenNumber = Number(breakevenValue);
    const toSeriesData = (points: PayoffPoint[]): number[][] => points.map(point => [point.x, point.y]);
    const formatAxisCurrency = (value: unknown): string => currencyFormatter.format(Number(value)).replace('.00', '');
    const markLineData: Array<Record<string, unknown>> = [
        {
            name: 'Break-even Baseline',
            yAxis: 0,
            symbol: 'none',
            label: { show: false },
            lineStyle: { color: 'rgba(71, 85, 105, 0.9)', width: 2, type: 'dashed' }
        }
    ];

    if (Number.isFinite(currentPrice)) {
        markLineData.push({
            name: 'Current Price',
            xAxis: currentPrice,
            symbol: 'none',
            label: {
                show: true,
                formatter: `Current ${currencyFormatter.format(currentPrice)}`,
                color: 'rgba(30, 41, 59, 0.9)',
                fontSize: 12,
                position: 'insideEndTop'
            },
            lineStyle: { color: 'rgba(100, 116, 139, 0.95)', width: 2, type: 'dashed' }
        });
    }

    if (Number.isFinite(breakevenNumber)) {
        markLineData.push({
            name: 'Breakeven',
            xAxis: breakevenNumber,
            symbol: 'none',
            label: {
                show: true,
                formatter: 'Breakeven',
                color: 'rgba(59, 130, 246, 0.9)',
                fontSize: 11,
                position: 'insideStartTop'
            },
            lineStyle: { color: 'rgba(59, 130, 246, 0.85)', width: 1.25, type: 'dotted' }
        });
    }

    const option: GammaChartOption = {
        animation: false,
        aria: { enabled: true },
        grid: {
            top: 18,
            right: 18,
            bottom: 44,
            left: 16,
            containLabel: true
        },
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'cross' },
            backgroundColor: 'rgba(30, 41, 59, 0.95)',
            borderColor: 'rgba(148, 163, 184, 0.3)',
            borderWidth: 1,
            textStyle: { color: 'rgba(255, 255, 255, 0.92)' },
            formatter: (params: unknown) => {
                if (!Array.isArray(params)) {
                    return '';
                }
                const point = params.find(item => (item as { seriesName?: string }).seriesName === 'P&L at Expiration') as { value?: unknown } | undefined;
                const tuple = Array.isArray(point?.value) ? point.value as unknown[] : [];
                const price = Number(tuple[0]);
                const value = Number(tuple[1]);
                if (!Number.isFinite(price) || !Number.isFinite(value)) {
                    return '';
                }
                const label = value >= 0 ? 'Profit' : 'Loss';
                return [
                    `At ${currencyFormatter.format(price)}`,
                    `${label}: ${currencyFormatter.format(value)}`
                ].join('<br>');
            }
        },
        xAxis: {
            type: 'value',
            min: xMin,
            max: xMax,
            name: 'Underlying Price',
            nameLocation: 'middle',
            nameGap: 30,
            nameTextStyle: {
                color: 'rgba(100, 116, 139, 0.9)',
                fontSize: 11,
                fontWeight: 600
            },
            axisLabel: {
                color: 'rgba(100, 116, 139, 0.9)',
                fontSize: 10,
                formatter: formatAxisCurrency
            },
            splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.1)' } }
        },
        yAxis: {
            type: 'value',
            min: minY,
            max: maxY,
            name: 'P&L',
            nameLocation: 'middle',
            nameGap: 52,
            nameTextStyle: {
                color: 'rgba(100, 116, 139, 0.9)',
                fontSize: 11,
                fontWeight: 600
            },
            axisLabel: {
                color: 'rgba(100, 116, 139, 0.9)',
                fontSize: 10,
                formatter: formatAxisCurrency
            },
            splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.1)' } }
        },
        series: [
            {
                type: 'line',
                name: 'Profit Region',
                data: toSeriesData(positiveArea),
                showSymbol: false,
                silent: true,
                lineStyle: { opacity: 0 },
                areaStyle: { color: profitFill },
                emphasis: { disabled: true }
            },
            {
                type: 'line',
                name: 'Loss Region',
                data: toSeriesData(negativeArea),
                showSymbol: false,
                silent: true,
                lineStyle: { opacity: 0 },
                areaStyle: { color: lossFill },
                emphasis: { disabled: true }
            },
            {
                type: 'line',
                name: 'P&L at Expiration',
                data: toSeriesData(payoff.points),
                showSymbol: false,
                smooth: false,
                lineStyle: { color: profitColor, width: 2 },
                itemStyle: { color: profitColor },
                markLine: {
                    silent: true,
                    data: markLineData
                }
            }
        ]
    };

    const chart = renderEChart(chartRoot, this.tradeDetailCharts?.get(chartId), option);

    this.tradeDetailCharts.set(chartId, chart);

    if (footnote) {
        footnote.textContent = this.formatPayoffFooter(payoff, currencyFormatter);
    }
}
