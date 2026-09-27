// src/ai/attention.ts — attention digest (roadmap 02). Detection is deterministic: the Active
// Positions attention rules (calculations/attention.ts, the table's status dot) plus three
// digest-only reasons (earnings inside the position's life, shares without a covered call, a wide
// Schwab bid/ask). JEV only orders the flagged items by urgency; the LLM is never used here.

import type { AttentionItem, AttentionReason } from '../types/ai.js'
import type { AttentionItem as RuleItem } from '../calculations/attention.js'
import { daysBetweenIso, tradeQuoteFacts, WIDE_SPREAD_PCT, type TradeQuoteLike } from '../calculations/market-facts.js'
import { currentDecisionEngine, decideWithFallback, type DecisionContext } from '../integrations/decision/registry.js'
import type { DecisionQuestion, DecisionRequest, DecisionResult } from '../integrations/decision/types.js'
import { positionLabel } from './coach-context.js'
import { notesHash } from './watchlist-drift.js'

type AnyRecord = Record<string, any>

/** Earnings this close to today count as "look today" rather than "worth a glance". */
const EARNINGS_SOON_DAYS = 7
const MAX_URGENCY_ITEMS = 10
export const URGENCY_LEVELS = ['Fine for now', 'Watch this week', 'Act before expiry']

export interface DigestTradeInput {
    tradeId: string
    ticker: string
    label: string
    dte: number | null
    /** The table's attention item for this trade, when its rules flagged it. */
    rule: RuleItem | null
    earningsInLife: { date: string; daysAway: number } | null
    spreadPct: number | null
}

export interface DigestStockInput {
    ticker: string
    coverage: string | null
}

const bySeverity = (a: AttentionItem, b: AttentionItem) =>
    b.severity - a.severity || (a.dte ?? Number.MAX_SAFE_INTEGER) - (b.dte ?? Number.MAX_SAFE_INTEGER)

export function selectAttentionItems(trades: DigestTradeInput[], stock: DigestStockInput[]): AttentionItem[] {
    const items: AttentionItem[] = []
    for (const t of trades) {
        const reasons: AttentionReason[] = (t.rule?.reasons ?? []).map(text => ({ kind: 'rule', text }))
        let severity = t.rule?.severity ?? 0
        if (t.earningsInLife) {
            reasons.push({ kind: 'earnings', text: `earnings ${t.earningsInLife.date} (in ${t.earningsInLife.daysAway}d), before expiry` })
            severity = Math.max(severity, t.earningsInLife.daysAway <= EARNINGS_SOON_DAYS ? 2 : 1)
        }
        if (t.spreadPct !== null && t.spreadPct > WIDE_SPREAD_PCT) {
            reasons.push({ kind: 'wide-spread', text: `bid/ask ${t.spreadPct}% of value: costly to exit` })
            severity = Math.max(severity, 1)
        }
        if (reasons.length && severity > 0) {
            items.push({ key: t.tradeId, ticker: t.ticker, label: t.label, reasons, severity: severity as 1 | 2 | 3, dte: t.dte, urgency: null })
        }
    }
    for (const s of stock) {
        if (s.coverage !== 'uncovered') continue
        items.push({
            key: `${s.ticker}|shares`,
            ticker: s.ticker,
            label: `${s.ticker} shares`,
            reasons: [{ kind: 'uncovered-shares', text: 'shares without a covered call' }],
            severity: 1,
            dte: null,
            urgency: null
        })
    }
    return items.sort(bySeverity)
}

export function attentionHash(items: AttentionItem[]): string {
    return notesHash(items.map(i => `${i.key}:${i.reasons.map(r => r.text).join(',')}`).join('|'))
}

/** One score question per item (JEV judges urgency only; every reason is pre-computed text). */
export function buildUrgencyRequest(items: AttentionItem[]): DecisionRequest<string> {
    const top = items.slice(0, MAX_URGENCY_ITEMS)
    const questions: Record<string, DecisionQuestion> = {}
    top.forEach((_item, i) => {
        questions[`item_${i}`] = { type: 'score', instructions: `How urgently does state.items[${i}] need the trader's attention?`, criteria: URGENCY_LEVELS }
    })
    return {
        state: { items: top.map(i => ({ position: i.label, reasons: i.reasons.map(r => r.text), dte: i.dte })) },
        questions
    }
}

/** Items re-ordered by JEV's urgency score; ties keep the deterministic order. */
export function orderByUrgency(items: AttentionItem[], result: DecisionResult<string>): AttentionItem[] {
    return items
        .map((item, index) => {
            const answer = result.answers[`item_${index}`]
            const urgency = answer && answer.type === 'score' ? Math.round(answer.score * 10) / 10 : null
            return { item: { ...item, urgency }, index }
        })
        .sort((a, b) => (b.item.urgency ?? -1) - (a.item.urgency ?? -1) || a.index - b.index)
        .map(({ item }) => item)
}

// ---------------------------------------------------------------------------
// Host adapter
// ---------------------------------------------------------------------------

export interface AttentionHost extends DecisionContext {
    currentDate: Date | unknown
    latestStats?: AnyRecord | null
    calculateAdvancedStats(): AnyRecord
    computeAttentionByTrade(trades: AnyRecord[]): Map<string, RuleItem>
    isClosedStatus(status: unknown): boolean
    earningsMap?: ReadonlyMap<string, { date?: string }>
    schwab?: { tradeQuoteCache?: ReadonlyMap<string, TradeQuoteLike> }
    getSchwabTradeQuoteKey?(trade: AnyRecord): string
    attentionUrgencyCache: Map<string, Record<string, number> | 'loading' | 'error'>
}

const asOfOf = (host: AttentionHost) => (host.currentDate instanceof Date ? host.currentDate : new Date()).toISOString().slice(0, 10)

function detectItems(host: AttentionHost): AttentionItem[] {
    const stats = host.latestStats ?? host.calculateAdvancedStats()
    const openTrades: AnyRecord[] = Array.isArray(stats.openTradesList) ? stats.openTradesList : []
    const rules = host.computeAttentionByTrade(openTrades)
    const asOf = asOfOf(host)
    const nowMs = Date.now()
    const trades = openTrades.map((trade): DigestTradeInput => {
        const ticker = String(trade.ticker ?? '').toUpperCase()
        const expiry = String(trade.expirationDate ?? '')
        const earnings = host.earningsMap?.get(ticker)?.date
        const quoteKey = host.getSchwabTradeQuoteKey?.(trade)
        const dte = Number(trade.dte)
        return {
            tradeId: String(trade.id ?? ''),
            ticker,
            label: positionLabel(trade),
            dte: Number.isFinite(dte) ? dte : null,
            rule: rules.get(String(trade.id ?? '')) ?? null,
            earningsInLife: earnings && earnings >= asOf && (!expiry || earnings <= expiry)
                ? { date: earnings, daysAway: daysBetweenIso(asOf, earnings) }
                : null,
            spreadPct: quoteKey ? tradeQuoteFacts(host.schwab?.tradeQuoteCache?.get(quoteKey), nowMs)?.spreadPct ?? null : null
        }
    })
    const stock = (stats.assignmentStats?.assignments ?? [])
        .filter((a: AnyRecord) => a?.trade && !host.isClosedStatus(a.trade.status))
        .map((a: AnyRecord): DigestStockInput => ({ ticker: String(a.trade.ticker ?? '').toUpperCase(), coverage: a.trade.wheelCoverage ?? null }))
    return selectAttentionItems(trades, stock)
}

const cacheKeyFor = (host: AttentionHost, items: AttentionItem[]) => `${asOfOf(host)}|${attentionHash(items)}`

/** Deterministic items, re-ordered by a cached JEV urgency result when one exists. */
export function getAttentionDigest(this: AttentionHost): AttentionItem[] {
    let items: AttentionItem[]
    try {
        items = detectItems(this)
    } catch (error) {
        console.warn('Attention digest failed:', error)
        return []
    }
    const cached = this.attentionUrgencyCache.get(cacheKeyFor(this, items))
    if (!cached || cached === 'loading' || cached === 'error') return items
    return items
        .map((item, index) => ({ item: { ...item, urgency: cached[item.key] ?? null }, index }))
        .sort((a, b) => (b.item.urgency ?? -1) - (a.item.urgency ?? -1) || a.index - b.index)
        .map(({ item }) => item)
}

/** JEV only (the dashboard refreshes too often for LLM calls); resolves true when a new order arrived. */
export async function requestAttentionOrder(this: AttentionHost): Promise<boolean> {
    if (currentDecisionEngine(this) !== 'jev') return false
    let items: AttentionItem[]
    try {
        items = detectItems(this)
    } catch {
        return false
    }
    if (items.length < 2) return false
    const key = cacheKeyFor(this, items)
    if (this.attentionUrgencyCache.has(key)) return false
    this.attentionUrgencyCache.set(key, 'loading')
    try {
        const top = items.slice(0, MAX_URGENCY_ITEMS)
        const result = await decideWithFallback(this, buildUrgencyRequest(top), { jevOnly: true })
        if (!result || result.engine !== 'jev') {
            this.attentionUrgencyCache.delete(key)
            return false
        }
        const ordered = orderByUrgency(top, result)
        this.attentionUrgencyCache.set(key, Object.fromEntries(ordered.map(i => [i.key, i.urgency ?? -1])))
        return true
    } catch (error) {
        console.warn('Attention ordering failed:', error)
        this.attentionUrgencyCache.set(key, 'error')
        return false
    }
}
