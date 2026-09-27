// src/ai/chart-blocks.ts — ```chart fences in Coach answers: split from the markdown source before
// rendering (DOMPurify strips class names, so no post-sanitize hook), validate, map to ECharts.

import { z } from 'zod'

export const MAX_CHART_POINTS = 24

export const ChartSpecSchema = z.object({
    type: z.enum(['bar', 'line']),
    title: z.string().trim().min(1).max(80),
    labels: z.array(z.string().trim().min(1).max(40)).min(1).max(MAX_CHART_POINTS),
    values: z.array(z.number().finite()).min(1).max(MAX_CHART_POINTS)
}).strict().refine(spec => spec.labels.length === spec.values.length, { message: 'labels and values differ in length' })

export type ChartSpec = z.infer<typeof ChartSpecSchema>
export type ChatSegment = { kind: 'md'; text: string } | { kind: 'chart'; spec: ChartSpec }

const CHART_FENCE = /```chart[^\S\r\n]*\r?\n([\s\S]*?)\r?\n```/g

export function parseChartSpec(body: string): ChartSpec | null {
    try {
        const parsed = ChartSpecSchema.safeParse(JSON.parse(body))
        return parsed.success ? parsed.data : null
    } catch {
        return null
    }
}

export function splitChartBlocks(markdown: string): ChatSegment[] {
    const segments: ChatSegment[] = []
    const pushMd = (text: string) => {
        if (!text) return
        const last = segments[segments.length - 1]
        if (last && last.kind === 'md') last.text += text
        else segments.push({ kind: 'md', text })
    }
    let cursor = 0
    for (const match of markdown.matchAll(CHART_FENCE)) {
        const start = match.index ?? 0
        pushMd(markdown.slice(cursor, start))
        const spec = parseChartSpec(match[1])
        if (spec) segments.push({ kind: 'chart', spec })
        else pushMd('```\n' + match[1] + '\n```')
        cursor = start + match[0].length
    }
    pushMd(markdown.slice(cursor))
    return segments
}

export interface ChartColors { text: string; grid: string; positive: string; negative: string; line: string }

export function buildChartOption(spec: ChartSpec, colors: ChartColors): Record<string, any> {
    return {
        animation: false,
        title: { text: spec.title, left: 0, textStyle: { fontSize: 12, fontWeight: 600, color: colors.text } },
        grid: { left: 8, right: 8, top: 32, bottom: 8, containLabel: true },
        tooltip: { trigger: 'axis' },
        xAxis: {
            type: 'category',
            data: spec.labels,
            axisLabel: { color: colors.text, fontSize: 10, interval: 0, rotate: spec.labels.length > 8 ? 45 : 0 },
            axisLine: { lineStyle: { color: colors.grid } }
        },
        yAxis: { type: 'value', axisLabel: { color: colors.text, fontSize: 10 }, splitLine: { lineStyle: { color: colors.grid } } },
        series: [spec.type === 'bar'
            ? { type: 'bar', data: spec.values.map(value => ({ value, itemStyle: { color: value < 0 ? colors.negative : colors.positive } })) }
            : { type: 'line', data: spec.values, symbolSize: 4, lineStyle: { color: colors.line }, itemStyle: { color: colors.line } }]
    }
}
