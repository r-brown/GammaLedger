// src/ui/charts/cumulative-pl.ts — Range-filter controls for the performance trend chart.
// updateCumulativePLChart removed — superseded by updatePerformanceTrendChart.
// Uses the .call(this, …) delegation pattern.

import { defaultGranularityFor, type Granularity } from '@calculations/time-buckets.js'

interface CumulativePLContext {
  cumulativePLRange: string
  chartGranularity: Granularity | 'auto'
  normalizeCumulativePLRange(range: string): string
  setCumulativePLRange(range: string): void
  syncCumulativePLControls(): void
  resolveGranularity(): Granularity
  setChartGranularity(value: Granularity | 'auto'): void
  syncGranularityControls(): void
  updatePerformanceTrendChart(): void
  refreshShareCardChart(): void
  updateStrategyPerformanceChart(): void
  updateWinRateByStrategyChart(): void
  updateCommissionImpactChart(): void
  renderTickerHeatmap(): void
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
    this.syncGranularityControls();
    this.updatePerformanceTrendChart();
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

/** The granularity actually in force: an explicit pin, else the range default. */
export function resolveGranularity(this: CumulativePLContext): Granularity {
    if (this.chartGranularity !== 'auto') return this.chartGranularity;
    return defaultGranularityFor(this.cumulativePLRange);
}

export function setChartGranularity(
    this: CumulativePLContext,
    value: Granularity | 'auto'
): void {
    if (value === this.chartGranularity) return;
    this.chartGranularity = value;
    this.syncGranularityControls();
    this.updatePerformanceTrendChart();
}

export function syncGranularityControls(this: CumulativePLContext): void {
    const controls = document.getElementById('chart-granularity-controls');
    if (!controls) return;
    const active = this.resolveGranularity();
    controls.querySelectorAll('button[data-granularity]').forEach((button) => {
        const value = (button as HTMLElement).dataset.granularity;
        const isActive = value === active;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', String(isActive));
    });
}

export function initializeGranularityControls(this: CumulativePLContext): void {
    const controls = document.getElementById('chart-granularity-controls');
    if (!controls) return;
    if (controls.dataset.initialized === 'true') {
        this.syncGranularityControls();
        return;
    }
    controls.addEventListener('click', (event) => {
        const target = event.target instanceof HTMLElement
            ? event.target.closest('button[data-granularity]')
            : null;
        if (!target) return;
        const value = (target as HTMLElement).dataset.granularity;
        if (value === 'day' || value === 'week' || value === 'month') {
            this.setChartGranularity(value);
        }
    });
    controls.dataset.initialized = 'true';
    this.syncGranularityControls();
}
