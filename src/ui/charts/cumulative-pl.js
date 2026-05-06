// src/ui/charts/cumulative-pl.js — Wave 9: Cumulative P&L chart.
// Uses the .call(this, …) delegation pattern.

export function initializeCumulativePLControls() {
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

        const { range } = target.dataset;
        if (!range) {
            return;
        }

        this.setCumulativePLRange(range);
    });

    controls.dataset.initialized = 'true';
    this.syncCumulativePLControls();
}

export function setCumulativePLRange(range) {
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

export function syncCumulativePLControls() {
    const controls = document.getElementById('cumulative-pl-controls');
    if (!controls) {
        return;
    }

    const currentRange = this.normalizeCumulativePLRange(this.cumulativePLRange);
    controls.querySelectorAll('button[data-range]').forEach((button) => {
        const buttonRange = this.normalizeCumulativePLRange(button.dataset.range);
        const isActive = buttonRange === currentRange;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', String(isActive));
    });
}

export function updateCumulativePLChart() {
    const canvas = document.getElementById('cumulativePLChart');
    if (!canvas) {
        console.error('Cumulative P&L chart canvas not found');
        return;
    }

    const ctx = canvas.getContext('2d');

    if (this.charts.cumulativePL) {
        this.charts.cumulativePL.destroy();
    }

    const formatCurrencyValue = (value, decimals = 2) => this.formatCurrency(value, { decimals });

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
                            callback: (value) => formatCurrencyValue(value, 0)
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
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
                        callback: function (value) {
                            if (typeof value === 'string') {
                                return value;
                            }

                            if (typeof value === 'number' && this && typeof this.getLabelForValue === 'function') {
                                const label = this.getLabelForValue(value);
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
                        title: function (context) {
                            return context[0]?.label || '';
                        },
                        label: (context) => `Cumulative P&L: ${formatCurrencyValue(context.raw)}`
                    }
                }
            }
        }
    });
}
