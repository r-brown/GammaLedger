// src/ui/charts/destroy.ts — Safe chart cleanup helper.

import { disposeChartInstance } from './echarts.js'

export function destroyChart(chart: unknown): void {
    disposeChartInstance(chart);
}
