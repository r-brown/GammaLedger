// src/payoff/render.js — Wave 6: Payoff chart toggle and rendering.
// Uses the .call(this, …) delegation pattern.

export function toggleTradePayoffDetail(row, detailRow, trade, chartId, footnoteId) {
    if (!detailRow) {
        return;
    }

    const isOpen = !detailRow.classList.contains('is-open');

    detailRow.classList.toggle('is-open', isOpen);
    detailRow.style.display = isOpen ? 'table-row' : 'none';
    detailRow.setAttribute('aria-hidden', String(!isOpen));
    row?.setAttribute('aria-expanded', String(isOpen));

    const detailCanvas = detailRow.querySelector('canvas');
    if (detailCanvas) {
        detailCanvas.setAttribute('aria-hidden', String(!isOpen));
    }

    if (isOpen) {
        const renderPromise = this.renderTradePayoffChart(trade, chartId, footnoteId);
        if (renderPromise?.catch) {
            renderPromise.catch(error => {
                console.error('Failed to render payoff chart:', error);
            });
        }
    } else {
        this.destroyTradePayoffChart(chartId, footnoteId);
    }
}

export function destroyTradePayoffChart(chartId, footnoteId) {
    const existingChart = this.tradeDetailCharts?.get(chartId);
    if (existingChart) {
        try {
            existingChart.destroy();
        } catch (error) {
            console.warn('Failed to destroy payoff chart:', error);
        }
        this.tradeDetailCharts.delete(chartId);
    }

    const canvas = document.getElementById(chartId) as HTMLCanvasElement | null;
    const wrapper = canvas?.parentElement;
    if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        canvas.classList.remove('hidden');
    }
    wrapper?.classList.remove('trade-diagram__canvas--empty');

    if (footnoteId) {
        const footnote = document.getElementById(footnoteId);
        if (footnote) {
            footnote.textContent = 'Tap or click the trade row to generate the payoff diagram.';
        }
    }
}

export async function renderTradePayoffChart(trade: Record<string, unknown>, chartId: string, footnoteId: string) {
    const canvas = document.getElementById(chartId) as HTMLCanvasElement | null;
    const footnote = document.getElementById(footnoteId);
    const wrapper = canvas?.parentElement;

    if (!canvas) {
        if (footnote) {
            footnote.textContent = 'Canvas element missing; cannot generate payoff diagram.';
        }
        return;
    }

    if (this.tradeDetailCharts?.has(chartId)) {
        return; // Already rendered
    }

    if (footnote) {
        footnote.textContent = 'Loading live price and payoff data…';
    }

    const payoff = this.calculatePayoffSeries(trade);

    if (!payoff || !Array.isArray(payoff.points) || payoff.points.length === 0) {
        if (wrapper) {
            wrapper.classList.add('trade-diagram__canvas--empty');
        }
        canvas.classList.add('hidden');
        if (footnote) {
            footnote.textContent = payoff?.message || 'Payoff diagram not available for this strategy yet.';
        }
        return;
    }

    canvas.classList.remove('hidden');
    wrapper?.classList.remove('trade-diagram__canvas--empty');

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        if (footnote) {
            footnote.textContent = 'Unable to access canvas rendering context.';
        }
        return;
    }

    const currencyFormatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 2
    });

    const profitColor = 'rgba(34, 197, 94, 1)'; // green
    const lossColor = 'rgba(248, 113, 113, 1)'; // red
    const profitFill = 'rgba(34, 197, 94, 0.15)';
    const lossFill = 'rgba(248, 113, 113, 0.15)';

    const yValues = payoff.points.map(point => point.y);
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

    // Prepare positive and negative fill areas extending to entire diagram
    const xMin = Math.min(...payoff.points.map(p => p.x));
    const xMax = Math.max(...payoff.points.map(p => p.x));

    const positiveArea = [
        { x: xMin, y: 0 },
        ...payoff.points.map(point => ({
            x: point.x,
            y: point.y > 0 ? point.y : 0
        })),
        { x: xMax, y: 0 }
    ];
    const negativeArea = [
        { x: xMin, y: 0 },
        ...payoff.points.map(point => ({
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

    const priceLabelPlugin = {
        id: `payoffPriceLineLabel-${chartId}`,
        afterDatasetsDraw: (chartInstance) => {
            if (!Number.isFinite(currentPrice)) {
                return;
            }
            const xScale = chartInstance.scales?.x;
            const chartArea = chartInstance.chartArea;
            if (!xScale || !chartArea) {
                return;
            }
            const x = xScale.getPixelForValue(currentPrice);
            if (!Number.isFinite(x) || x < chartArea.left || x > chartArea.right) {
                return;
            }
            const yScale = chartInstance.scales?.y;
            const ctxLabel = chartInstance.ctx;
            ctxLabel.save();
            ctxLabel.font = '12px "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
            ctxLabel.fillStyle = 'rgba(30, 41, 59, 0.9)';
            ctxLabel.textBaseline = 'middle';
            ctxLabel.textAlign = 'center';
            const chartBottomLimit = chartArea.bottom - 10;
            let targetY = chartBottomLimit - 50;
            if (!Number.isFinite(targetY) || targetY < chartArea.top + 12) {
                targetY = chartArea.top + 12;
            }
            const horizontalPadding = 18;
            const placeOnRight = x < (chartArea.left + chartArea.right) / 2;
            const translatedX = placeOnRight
                ? Math.min(chartArea.right - horizontalPadding, x + horizontalPadding)
                : Math.max(chartArea.left + horizontalPadding, x - horizontalPadding);
            const label = `Current ${currencyFormatter.format(currentPrice)}`;
            ctxLabel.translate(translatedX, targetY);
            ctxLabel.rotate(-Math.PI / 2);
            ctxLabel.fillText(label, 0, 0);
            ctxLabel.restore();
        }
    };

    const datasets = [
        {
            id: 'currentPriceLine',
            label: 'Current Price',
            data: [],
            borderColor: 'rgba(100, 116, 139, 0.95)',
            borderDash: [6, 4],
            borderWidth: 2,
            hoverBorderColor: 'rgba(100, 116, 139, 0.95)',
            hoverBorderWidth: 2,
            pointRadius: 0,
            pointHitRadius: 0,
            fill: false,
            order: 0,
            hidden: true
        },
        {
            id: 'breakevenLine',
            label: 'Breakeven',
            data: [],
            borderColor: 'rgba(59, 130, 246, 0.8)',
            borderDash: [2, 4],
            borderWidth: 1,
            pointRadius: 0,
            pointHitRadius: 0,
            fill: false,
            order: 0,
            hidden: true
        },
        {
            id: 'positiveFill',
            label: 'Profit Region',
            data: positiveArea,
            borderColor: 'rgba(0,0,0,0)',
            backgroundColor: profitFill,
            hoverBackgroundColor: profitFill,
            hoverBorderColor: 'rgba(0, 0, 0, 0)',
            hoverBorderWidth: 0,
            fill: 'origin',
            pointRadius: 0,
            pointHitRadius: 0,
            tension: 0,
            order: 1,
            spanGaps: true,
            showLine: true
        },
        {
            id: 'negativeFill',
            label: 'Loss Region',
            data: negativeArea,
            borderColor: 'rgba(0,0,0,0)',
            backgroundColor: lossFill,
            hoverBackgroundColor: lossFill,
            hoverBorderColor: 'rgba(0, 0, 0, 0)',
            hoverBorderWidth: 0,
            fill: 'origin',
            pointRadius: 0,
            pointHitRadius: 0,
            tension: 0,
            order: 1,
            spanGaps: true,
            showLine: true
        },
        {
            id: 'payoffLine',
            label: 'P&L at Expiration',
            data: payoff.points,
            borderColor: profitColor,
            hoverBorderColor: profitColor,
            hoverBorderWidth: 2,
            tension: 0,
            pointRadius: 0,
            pointHoverRadius: 0,
            borderWidth: 2,
            fill: false,
            order: 2,
            segment: {
                borderColor: ctx => {
                    const y0 = ctx.p0.parsed?.y;
                    const y1 = ctx.p1.parsed?.y;
                    if (y0 >= 0 && y1 >= 0) {
                        return profitColor;
                    }
                    if (y0 <= 0 && y1 <= 0) {
                        return lossColor;
                    }
                    return 'rgba(148, 163, 184, 1)';
                }
            }
        },
        {
            id: 'zeroLine',
            label: 'Break-even Baseline',
            data: payoff.zeroLinePoints ?? payoff.points.map(point => ({ x: point.x, y: 0 })),
            borderColor: 'rgba(71, 85, 105, 0.9)',
            borderDash: [4, 4],
            borderWidth: 2,
            hoverBorderColor: 'rgba(71, 85, 105, 0.95)',
            hoverBorderWidth: 2,
            pointRadius: 0,
            pointHitRadius: 0,
            fill: false,
            order: 3
        }
    ];

    if (Number.isFinite(currentPrice)) {
        const currentIndex = datasets.findIndex(dataset => dataset.id === 'currentPriceLine');
        if (currentIndex !== -1) {
            datasets[currentIndex].data = [
                { x: currentPrice, y: minY },
                { x: currentPrice, y: maxY }
            ];
            datasets[currentIndex].hidden = false;
        }
    }

    // Handle breakeven - can be single value or array
    const breakevenValue = Array.isArray(payoff.breakeven)
        ? payoff.breakeven[0]
        : payoff.breakeven;

    if (Number.isFinite(breakevenValue)) {
        const breakevenIndex = datasets.findIndex(dataset => dataset.id === 'breakevenLine');
        if (breakevenIndex !== -1) {
            datasets[breakevenIndex].data = [
                { x: breakevenValue, y: minY },
                { x: breakevenValue, y: maxY }
            ];
            datasets[breakevenIndex].hidden = false;
        }
    }

    const chart = new Chart(ctx, {
        type: 'line',
        data: { datasets },
        plugins: [priceLabelPlugin],
        options: {
            parsing: false,
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            hover: {
                mode: 'index',
                intersect: false
            },
            layout: {
                padding: {
                    top: 10,
                    right: 10,
                    bottom: 5,
                    left: 5
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(30, 41, 59, 0.95)',
                    titleColor: 'rgba(255, 255, 255, 0.95)',
                    bodyColor: 'rgba(255, 255, 255, 0.9)',
                    borderColor: 'rgba(148, 163, 184, 0.3)',
                    borderWidth: 1,
                    padding: 10,
                    displayColors: false,
                    titleFont: {
                        size: 13,
                        weight: 'bold'
                    },
                    bodyFont: {
                        size: 12
                    },
                    callbacks: {
                        title: (context) => {
                            const price = Number(context[0]?.parsed?.x);
                            if (!Number.isFinite(price)) return '';
                            return `At ${currencyFormatter.format(price)}`;
                        },
                        label: (context) => {
                            if (!context.dataset || context.dataset.id !== 'payoffLine') {
                                return null;
                            }
                            const value = Number(context.parsed?.y);
                            if (!Number.isFinite(value)) {
                                return null;
                            }
                            const formattedValue = currencyFormatter.format(value);
                            const label = value >= 0 ? 'Profit' : 'Loss';
                            return `${label}: ${formattedValue}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    title: {
                        display: true,
                        text: 'Underlying Price',
                        font: {
                            size: 11,
                            weight: '600'
                        },
                        color: 'rgba(100, 116, 139, 0.9)'
                    },
                    ticks: {
                        font: {
                            size: 10
                        },
                        maxRotation: 0,
                        autoSkipPadding: 20,
                        callback: (value) => {
                            const formatted = currencyFormatter.format(Number(value));
                            return formatted.replace('.00', '');
                        }
                    },
                    grid: {
                        color: 'rgba(148, 163, 184, 0.1)',
                        drawBorder: false
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'P&L',
                        font: {
                            size: 11,
                            weight: '600'
                        },
                        color: 'rgba(100, 116, 139, 0.9)'
                    },
                    ticks: {
                        font: {
                            size: 10
                        },
                        callback: (value) => {
                            const formatted = currencyFormatter.format(Number(value));
                            return formatted.replace('.00', '');
                        }
                    },
                    grid: {
                        color: 'rgba(148, 163, 184, 0.1)',
                        drawBorder: false
                    },
                    suggestedMin: minY,
                    suggestedMax: maxY
                }
            }
        }
    });

    this.tradeDetailCharts.set(chartId, chart);

    if (footnote) {
        footnote.textContent = this.formatPayoffFooter(payoff, currencyFormatter);
    }
}
