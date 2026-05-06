// src/ui/charts/cumulative-pl.ts — Wave 9: Cumulative P&L chart.
// Uses the .call(this, …) delegation pattern.

// Chart is loaded from CDN; declared in vendor.d.ts or the host app scope.
declare const Chart: { new(ctx: CanvasRenderingContext2D, config: Record<string, unknown>): { destroy(): void } };

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
    const canvas = document.getElementById('cumulativePLChart') as HTMLCanvasElement | null;
    if (!canvas) {
        console.error('Cumulative P&L chart canvas not found');
        return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (this.charts.cumulativePL) {
        this.charts.cumulativePL.destroy();
    }

    const formatCurrencyValue = (value: unknown, decimals = 2) => this.formatCurrency(value, { decimals });

    const series = this.computeCumulativePLSeries(this.cumulativePLRange);

    if (!series || !series.labels.length || !series.dataPoints.length) {
        this.charts.cumulativePL = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['No Data'],
                datasets: [{
                    label: 'Cumulative P&L',
                    data: [0],
                    borderColor: '#1FB8CD',
                    backgroundColor: 'rgba(31, 184, 205, 0.1)',
                    fill: false,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        ticks: {
                            callback: (value: unknown) => formatCurrencyValue(value, 0)
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        } as Record<string, unknown>);
        return;
    }

    this.charts.cumulativePL = new Chart(ctx, {
        type: 'line',
        data: {
            labels: series.labels,
            datasets: [{
                label: 'Cumulative P&L',
                data: series.dataPoints,
                borderColor: '#1FB8CD',
                backgroundColor: 'rgba(31, 184, 205, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 3,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    ticks: {
                        // NOTE: `this` inside this callback refers to Chart.js scale — not our context.
                        // Using a regular function per Chart.js convention.
                        callback: function (this: unknown, value: unknown) {
                            if (typeof value === 'string') {
                                return value;
                            }

                            if (typeof value === 'number' && this && typeof (this as Record<string, unknown>).getLabelForValue === 'function') {
                                const label = (this as { getLabelForValue(v: number): string }).getLabelForValue(value);
                                if (label) {
                                    return label;
                                }
                            }

                            return '';
                        },
                        maxRotation: 45,
                        minRotation: 45
                    }
                },
                y: {
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
                        title: function (context: Array<{ label?: string }>) {
                            return context[0]?.label || '';
                        },
                        label: (context: { raw: unknown }) => `Cumulative P&L: ${formatCurrencyValue(context.raw)}`
                    }
                }
            }
        }
    } as Record<string, unknown>);
}


