// src/calculations/monte-carlo.ts — Wave 3: Monte Carlo simulation helpers.
// generateMonteCarloProjection is pure (no this refs).
// ensureMonteCarloBaseline operates on a Chart.js chart object (no class state).

export interface MonteCarloOptions {
    periods?: number
    simulations?: number
}

export interface MonteCarloPercentiles {
    p10: number[]
    p25: number[]
    p50: number[]
    p75: number[]
    p90: number[]
}

export interface MonteCarloResult {
    labels: string[]
    percentiles: MonteCarloPercentiles
}

/** Chart.js-compatible chart object surface used by ensureMonteCarloBaseline. */
interface ChartLike {
    ctx: CanvasRenderingContext2D | null
    scales?: { y?: { getPixelForValue(value: number): number } }
    chartArea?: { left: number; right: number; top: number; bottom: number }
}

export function generateMonteCarloProjection(
    dailyReturns: number[] = [],
    { periods = 60, simulations = 400 }: MonteCarloOptions = {}
): MonteCarloResult | null {
    if (!Array.isArray(dailyReturns) || dailyReturns.length === 0) {
        return null;
    }

    const sanitized = dailyReturns.filter(value => Number.isFinite(value));
    if (!sanitized.length) {
        return null;
    }

    const trajectory: number[][] = Array.from({ length: periods }, () => []);

    for (let sim = 0; sim < simulations; sim += 1) {
        let equity = 1;
        for (let step = 0; step < periods; step += 1) {
            const randomIndex = Math.floor(Math.random() * sanitized.length);
            let sample = sanitized[randomIndex];
            if (!Number.isFinite(sample)) {
                sample = 0;
            }
            sample = Math.max(-0.95, Math.min(sample, 5));
            equity *= 1 + sample;
            equity = Math.max(equity, 0);
            trajectory[step].push(Number(equity.toFixed(6)));
        }
    }

    const percentilesList = [0.1, 0.25, 0.5, 0.75, 0.9] as const;
    const percentileSeries: number[][] = percentilesList.map(() => []);

    trajectory.forEach(stepValues => {
        if (!stepValues.length) {
            percentilesList.forEach((_, idx) => percentileSeries[idx].push(1));
            return;
        }

        const sorted = stepValues.slice().sort((a, b) => a - b);
        percentilesList.forEach((percentile, index) => {
            const target = (sorted.length - 1) * percentile;
            const lowerIndex = Math.floor(target);
            const upperIndex = Math.ceil(target);
            if (lowerIndex === upperIndex) {
                percentileSeries[index].push(sorted[lowerIndex]);
                return;
            }
            const lower = sorted[lowerIndex];
            const upper = sorted[upperIndex];
            const weight = target - lowerIndex;
            const interpolated = lower + (upper - lower) * weight;
            percentileSeries[index].push(Number(interpolated.toFixed(6)));
        });
    });

    return {
        labels: Array.from({ length: periods }, (_, idx) => `Day ${idx + 1}`),
        percentiles: {
            p10: percentileSeries[0],
            p25: percentileSeries[1],
            p50: percentileSeries[2],
            p75: percentileSeries[3],
            p90: percentileSeries[4]
        }
    };
}

export function ensureMonteCarloBaseline(chart: ChartLike | null | undefined): void {
    if (!chart) {
        return;
    }

    const ctx = chart.ctx;
    const yScale = chart.scales?.y;
    const area = chart.chartArea;
    if (!ctx || !yScale || !area) {
        return;
    }

    const zeroPixel = yScale.getPixelForValue(1);
    if (!Number.isFinite(zeroPixel)) {
        return;
    }

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(area.left, zeroPixel);
    ctx.lineTo(area.right, zeroPixel);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(146, 149, 152, 0.85)';
    ctx.setLineDash([]);
    ctx.stroke();
    ctx.restore();
}

