// src/ai/scan-table.ts — the Watchlist scan's ```watchlist block. The model writes only its judgement
// per ticker (quality, stars, a short why, an optional entry level); the app merges in the facts it
// computed itself (price, 52-week position, trend, earnings, JEV grade, the trader's own stars and
// watch price, change since the last scan) and renders the table, so no number in it is model-made
// except the stars and the suggested level. The merged JSON replaces the block in the message, so a
// re-render or a follow-up question sees the same table.

import { z } from 'zod'
import { SCAN_QUALITIES, type ScanQuality } from './watchlist-grade.js'

const lower = (value: unknown) => (typeof value === 'string' ? value.trim().toLowerCase() : value)
const Quality = z.preprocess(lower, z.enum(SCAN_QUALITIES))
const Ticker = z.string().trim().min(1).max(12).transform(t => t.toUpperCase())

export const ScanRowSchema = z.object({
    ticker: Ticker,
    quality: Quality,
    stars: z.coerce.number().int().min(1).max(5),
    why: z.string().trim().max(200).catch(''),
    level: z.coerce.number().finite().positive().optional().catch(undefined),
    levelWhy: z.string().trim().max(160).optional().catch(undefined),
    // Filled by the app on merge (ignored if the model writes them).
    price: z.number().finite().optional(),
    rangePos: z.number().finite().optional(),
    trend: z.enum(['up', 'down', 'mixed']).optional(),
    earnings: z.object({ date: z.string(), daysAway: z.number() }).optional(),
    jev: z.object({ quality: z.enum(SCAN_QUALITIES), confidence: z.number().nullable().optional() }).optional(),
    myStars: z.number().int().min(1).max(5).optional(),
    watchPrice: z.number().finite().optional(),
    openPositions: z.number().int().optional(),
    was: z.object({ stars: z.number().int(), quality: z.enum(SCAN_QUALITIES), asOf: z.string() }).optional()
})

export const ScanTableSchema = z.object({
    rows: z.array(ScanRowSchema).max(80),
    unscored: z.array(z.object({ ticker: Ticker, missing: z.array(z.string().max(40)).max(8) })).max(80).optional(),
    asOf: z.string().optional(),
    merged: z.boolean().optional()
})

export type ScanRow = z.infer<typeof ScanRowSchema>
export type ScanTable = z.infer<typeof ScanTableSchema>

export const SCAN_FENCE_LANG = 'watchlist'
const SCAN_FENCE = /```watchlist[^\S\r\n]*\r?\n([\s\S]*?)\r?\n```/

export function parseScanTable(body: string): ScanTable | null {
    try {
        const parsed = ScanTableSchema.safeParse(JSON.parse(body))
        return parsed.success ? parsed.data : null
    } catch {
        return null
    }
}

/** App-side facts per ticker the merge pulls from (built from the scan facts that were sent). */
export interface ScanRowFacts {
    index: number
    price?: number
    rangePos?: number
    trend?: 'up' | 'down' | 'mixed'
    earnings?: { date: string; daysAway: number }
    jev?: { quality: ScanQuality; confidence: number | null }
    myStars?: number
    watchPrice?: number
    openPositions?: number
}

export interface MergeInput {
    asOf: string
    /** Every ticker that was sent with market facts. */
    scored: Map<string, ScanRowFacts>
    /** Tickers the app could not score, with what was missing. */
    unscored: Array<{ ticker: string; missing: string[] }>
    previous: { asOf: string; rows: Array<{ ticker: string; stars: number; quality: ScanQuality }> } | null
}

const QUALITY_ORDER: Record<ScanQuality, number> = { strong: 0, decent: 1, mixed: 2, weak: 3 }

/**
 * Validates the model's block against what was sent: unknown tickers and duplicates are dropped,
 * app facts are filled in, rows are sorted (stars, then quality, then list order) and any scored
 * ticker the model skipped is listed as not ranked. Returns null when there is no usable block.
 */
export function mergeScanTable(text: string, input: MergeInput): { text: string; table: ScanTable } | null {
    const match = SCAN_FENCE.exec(text)
    if (!match) return null
    const parsed = parseScanTable(match[1])
    if (!parsed) return null
    const previous = new Map(input.previous?.rows.map(row => [row.ticker, row]) ?? [])
    const seen = new Set<string>()
    const rows: ScanRow[] = []
    for (const row of parsed.rows) {
        const facts = input.scored.get(row.ticker)
        if (!facts || seen.has(row.ticker)) continue
        seen.add(row.ticker)
        const merged: ScanRow = {
            ticker: row.ticker,
            quality: row.quality,
            stars: row.stars,
            why: row.why,
            ...(row.level !== undefined ? { level: row.level } : {}),
            ...(row.levelWhy ? { levelWhy: row.levelWhy } : {}),
            ...(facts.price !== undefined ? { price: facts.price } : {}),
            ...(facts.rangePos !== undefined ? { rangePos: facts.rangePos } : {}),
            ...(facts.trend ? { trend: facts.trend } : {}),
            ...(facts.earnings ? { earnings: facts.earnings } : {}),
            ...(facts.jev ? { jev: facts.jev } : {}),
            ...(facts.myStars !== undefined ? { myStars: facts.myStars } : {}),
            ...(facts.watchPrice !== undefined ? { watchPrice: facts.watchPrice } : {}),
            ...(facts.openPositions ? { openPositions: facts.openPositions } : {})
        }
        const before = previous.get(row.ticker)
        if (before && input.previous && (before.stars !== row.stars || before.quality !== row.quality)) {
            merged.was = { stars: before.stars, quality: before.quality, asOf: input.previous.asOf }
        }
        rows.push(merged)
    }
    if (!rows.length) return null
    const indexOf = (ticker: string) => input.scored.get(ticker)?.index ?? Number.MAX_SAFE_INTEGER
    rows.sort((a, b) => b.stars - a.stars || QUALITY_ORDER[a.quality] - QUALITY_ORDER[b.quality] || indexOf(a.ticker) - indexOf(b.ticker))
    const skipped = [...input.scored.entries()]
        .filter(([ticker]) => !seen.has(ticker))
        .sort((a, b) => a[1].index - b[1].index)
        .map(([ticker]) => ({ ticker, missing: ['not ranked by the model'] }))
    const unscored = [...input.unscored, ...skipped]
    const table: ScanTable = { asOf: input.asOf, merged: true, rows, ...(unscored.length ? { unscored } : {}) }
    const fence = '```' + SCAN_FENCE_LANG + '\n' + JSON.stringify(table) + '\n```'
    return { text: text.slice(0, match.index) + fence + text.slice(match.index + match[0].length), table }
}

/** While the answer streams, the half-written JSON block shows as one line instead of raw JSON. */
export function maskScanBlockWhileStreaming(text: string): string {
    return text.replace(/```watchlist[^\S\r\n]*\r?\n[\s\S]*?(?:\r?\n```|$)/, '_Building the ranking table…_')
}

// ---------------------------------------------------------------------------
// Rendering (DOM built with textContent only: nothing from the model is parsed as HTML)
// ---------------------------------------------------------------------------

const QUALITY_LABEL: Record<ScanQuality, string> = { strong: 'Strong', decent: 'Decent', mixed: 'Mixed', weak: 'Weak' }
const TREND_LABEL = { up: '↗ up', down: '↘ down', mixed: '→ mixed' } as const
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const starString = (stars: number): string => '★'.repeat(stars) + '☆'.repeat(Math.max(0, 5 - stars))

export function shortDate(iso: string): string {
    const [, m, d] = iso.split('-').map(Number)
    return m >= 1 && m <= 12 && d ? `${MONTHS[m - 1]} ${d}` : iso
}

const money = (value: number) => `$${value >= 100 ? value.toFixed(0) : value.toFixed(2)}`

function el<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, className: string | null, text?: string): HTMLElementTagNameMap[K] {
    const node = doc.createElement(tag)
    if (className) node.className = className
    if (text !== undefined) node.textContent = text
    return node
}

export function renderScanTable(table: ScanTable, doc: Document = document): HTMLElement {
    const figure = el(doc, 'figure', 'scan-table')
    const scroll = el(doc, 'div', 'scan-table__scroll')
    const grid = el(doc, 'table', 'scan-table__grid')
    const head = el(doc, 'thead', null)
    const headRow = el(doc, 'tr', null)
    for (const label of ['#', 'Ticker', 'Stars', 'Quality', '52w', 'Earnings']) headRow.appendChild(el(doc, 'th', null, label))
    head.appendChild(headRow)
    grid.appendChild(head)
    const body = el(doc, 'tbody', null)

    table.rows.forEach((row, i) => {
        const tr = el(doc, 'tr', `scan-table__row scan-table__row--${row.quality}`)
        tr.appendChild(el(doc, 'td', 'scan-table__num', String(i + 1)))

        const ticker = el(doc, 'td', 'scan-table__ticker')
        ticker.appendChild(el(doc, 'strong', null, row.ticker))
        if (row.price !== undefined) ticker.appendChild(el(doc, 'small', null, money(row.price)))
        if (row.openPositions) ticker.appendChild(el(doc, 'small', 'scan-table__muted', `${row.openPositions} open`))
        tr.appendChild(ticker)

        const stars = el(doc, 'td', 'scan-table__stars')
        const ai = el(doc, 'span', 'scan-table__ai-stars', starString(row.stars))
        ai.title = `Suggested: ${row.stars} of 5`
        stars.appendChild(ai)
        stars.appendChild(el(doc, 'small', 'scan-table__muted', row.myStars !== undefined ? `you: ${row.myStars}★` : 'you: unrated'))
        if (row.was) {
            const was = el(doc, 'small', 'scan-table__change', `was ${row.was.stars}★ · ${shortDate(row.was.asOf)}`)
            was.title = `Last scan (${row.was.asOf}): ${row.was.stars} stars, ${QUALITY_LABEL[row.was.quality]}`
            stars.appendChild(was)
        }
        tr.appendChild(stars)

        const quality = el(doc, 'td', null)
        quality.appendChild(el(doc, 'span', `scan-table__badge scan-table__badge--${row.quality}`, QUALITY_LABEL[row.quality]))
        if (row.jev) {
            const confidence = row.jev.confidence !== null && row.jev.confidence !== undefined ? ` ${Math.round(row.jev.confidence * 100)}%` : ''
            const jev = el(doc, 'small', row.jev.quality === row.quality ? 'scan-table__muted' : 'scan-table__change', `JEV: ${QUALITY_LABEL[row.jev.quality]}${confidence}`)
            jev.title = 'Calibrated pre-grade by JEV from the same market facts'
            quality.appendChild(jev)
        }
        tr.appendChild(quality)

        const range = el(doc, 'td', 'scan-table__range')
        if (row.rangePos !== undefined) {
            const bar = el(doc, 'div', 'scan-table__range-bar')
            const dot = el(doc, 'div', 'scan-table__range-dot')
            dot.style.left = `${Math.min(100, Math.max(0, row.rangePos))}%`
            bar.appendChild(dot)
            bar.title = `${Math.round(row.rangePos)}% of the 52-week range (0 = low, 100 = high)`
            range.appendChild(bar)
        }
        range.appendChild(el(doc, 'small', null, [row.rangePos !== undefined ? `${Math.round(row.rangePos)}%` : '—', row.trend ? TREND_LABEL[row.trend] : null].filter(Boolean).join(' · ')))
        tr.appendChild(range)

        const earnings = el(doc, 'td', row.earnings && row.earnings.daysAway <= 14 ? 'scan-table__warn' : null,
            row.earnings ? `${shortDate(row.earnings.date)} · ${row.earnings.daysAway}d` : 'unknown')
        tr.appendChild(earnings)

        body.appendChild(tr)

        // The reason gets its own full-width line, so it stays readable in the narrow chat panel.
        const whyRow = el(doc, 'tr', 'scan-table__why-row')
        whyRow.appendChild(el(doc, 'td', null))
        const why = el(doc, 'td', 'scan-table__why')
        why.colSpan = 5
        why.appendChild(el(doc, 'div', null, row.why))
        if (row.level !== undefined) {
            const watch = row.watchPrice !== undefined ? ` (yours ${money(row.watchPrice)})` : ''
            why.appendChild(el(doc, 'small', 'scan-table__level', `Entry ~${money(row.level)}${watch}${row.levelWhy ? `: ${row.levelWhy}` : ''}`))
        }
        whyRow.appendChild(why)
        body.appendChild(whyRow)
    })
    grid.appendChild(body)
    scroll.appendChild(grid)
    figure.appendChild(scroll)

    if (table.unscored?.length) {
        const note = el(doc, 'p', 'scan-table__unscored')
        note.appendChild(el(doc, 'strong', null, `Not scored (${table.unscored.length}): `))
        note.appendChild(doc.createTextNode(table.unscored.map(u => `${u.ticker} (${u.missing.join(', ')})`).join(' · ')))
        figure.appendChild(note)
    }
    const caption = el(doc, 'figcaption', 'scan-table__caption',
        'Stars, quality, why and entry levels are the Coach\'s; price, 52-week position, trend, earnings, JEV and your inputs come from the app.')
    figure.appendChild(caption)
    return figure
}
