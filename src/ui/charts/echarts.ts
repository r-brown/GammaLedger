// src/ui/charts/echarts.ts — Tree-shaken Apache ECharts registry and lifecycle helpers.

import * as echarts from 'echarts/core'
import {
    BarChart,
    GaugeChart,
    HeatmapChart,
    LineChart,
    PieChart
} from 'echarts/charts'
import {
    AriaComponent,
    GridComponent,
    LegendComponent,
    MarkLineComponent,
    TooltipComponent,
    VisualMapComponent
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { EChartsCoreOption, EChartsType, SetOptionOpts } from 'echarts/core'

echarts.use([
    AriaComponent,
    BarChart,
    CanvasRenderer,
    GaugeChart,
    GridComponent,
    HeatmapChart,
    LegendComponent,
    LineChart,
    MarkLineComponent,
    PieChart,
    TooltipComponent,
    VisualMapComponent
])

export type GammaChartOption = EChartsCoreOption
export type GammaChart = EChartsType & { destroy(): void }

const resizeObservers = new WeakMap<EChartsType, ResizeObserver>()

function isEChart(chart: unknown): chart is EChartsType {
    return Boolean(chart)
        && typeof chart === 'object'
        && typeof (chart as { setOption?: unknown }).setOption === 'function'
        && typeof (chart as { resize?: unknown }).resize === 'function'
        && typeof (chart as { dispose?: unknown }).dispose === 'function'
        && typeof (chart as { isDisposed?: unknown }).isDisposed === 'function';
}

function destroyEChart(chart: EChartsType): void {
    const observer = resizeObservers.get(chart);
    if (observer) {
        observer.disconnect();
        resizeObservers.delete(chart);
    }

    if (!chart.isDisposed()) {
        chart.dispose();
    }
}

function attachDestroy(chart: EChartsType): GammaChart {
    const gammaChart = chart as GammaChart;
    if (typeof gammaChart.destroy !== 'function') {
        gammaChart.destroy = () => destroyEChart(gammaChart);
    }
    return gammaChart;
}

function observeResize(chart: EChartsType, target: HTMLElement): void {
    if (typeof ResizeObserver === 'undefined') {
        return;
    }

    if (resizeObservers.has(chart)) {
        return;
    }

    const observer = new ResizeObserver(() => {
        if (!chart.isDisposed()) {
            chart.resize();
        }
    });
    observer.observe(target);
    resizeObservers.set(chart, observer);
}

export function disposeChartInstance(chart: unknown): void {
    if (!chart || typeof chart !== 'object') {
        return;
    }

    try {
        if (isEChart(chart)) {
            destroyEChart(chart);
            return;
        }

        const destroy = (chart as { destroy?: unknown }).destroy;
        if (typeof destroy === 'function') {
            destroy.call(chart);
            return;
        }

        const dispose = (chart as { dispose?: unknown }).dispose;
        if (typeof dispose === 'function') {
            dispose.call(chart);
        }
    } catch (error) {
        console.warn('Failed to destroy chart:', error);
    }
}

export function renderEChart(
    target: HTMLElement,
    existingChart: unknown,
    option: GammaChartOption,
    opts: SetOptionOpts = {}
): GammaChart {
    let chart: EChartsType | undefined;

    if (isEChart(existingChart) && !existingChart.isDisposed() && existingChart.getDom() === target) {
        chart = existingChart;
    } else {
        disposeChartInstance(existingChart);
        const domChart = echarts.getInstanceByDom(target);
        chart = domChart && !domChart.isDisposed()
            ? domChart
            : echarts.init(target, undefined, { renderer: 'canvas' });
    }

    const gammaChart = attachDestroy(chart);
    observeResize(gammaChart, target);
    gammaChart.setOption(option, {
        lazyUpdate: false,
        notMerge: false,
        ...opts
    });
    gammaChart.resize();

    return gammaChart;
}
