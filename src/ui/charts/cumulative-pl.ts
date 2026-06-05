// src/ui/charts/cumulative-pl.ts — Range-filter controls for the performance trend chart.
// updateCumulativePLChart removed — superseded by updatePerformanceTrendChart.
// Uses the .call(this, …) delegation pattern.

interface CumulativePLContext {
  cumulativePLRange: string
  normalizeCumulativePLRange(range: string): string
  setCumulativePLRange(range: string): void
  syncCumulativePLControls(): void
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
