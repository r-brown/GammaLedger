// src/ui/charts/destroy.ts — Safe Chart.js cleanup helper.

interface DestroyableChart {
    destroy(): void
}

function isDestroyableChart(chart: unknown): chart is DestroyableChart {
    return Boolean(chart)
        && typeof chart === 'object'
        && typeof (chart as { destroy?: unknown }).destroy === 'function';
}

export function destroyChart(chart: unknown): void {
    if (!isDestroyableChart(chart)) {
        return;
    }

    try {
        chart.destroy();
    } catch (error) {
        console.warn('Failed to destroy chart:', error);
    }
}
// Populated in waves per docs/refactor/phase1-module-map.md.
