// src/ai/ticker-context.ts — facts about one ticker (optionally one position or watchlist entry) for
// Ask Coach, AI Read and thesis drift. buildTickerContext is pure; gatherTickerContext is the
// this-typed adapter. Counts, date gaps and comparisons are computed here: JEV can't count.

import type { EarningsSurprise, SignalsData, StockMetrics } from '../types/integrations.js'
import type { WatchlistEntry } from '../types/watchlist.js'
import type { AIReadView } from '../types/ai.js'
import {
    computeAssignmentConvictionScore,
    computeBalanceSheetScore,
    computePreTradeRiskScore,
    computeValuationScore
} from '../calculations/stock-scores.js'
import {
    daysBetweenIso,
    resolveTickerPrice,
    targetStatus,
    tradeQuoteFacts,
    type PriceSource,
    type TradeQuoteFacts,
    type TradeQuoteLike
} from '../calculations/market-facts.js'
import { positionLabel, shortLegDistancePct } from './coach-context.js'

type AnyRecord = Record<string, any>

export interface TickerContextInput {
    ticker: string
    now: Date
    prices: { schwab?: unknown; finnhub?: unknown; snapshot?: unknown }
    previousClose: number | null
    metrics: StockMetrics | null
    signals: SignalsData | null
    earningsSurprises: EarningsSurprise[] | null
    upcomingEarningsDate: string | null
    trade: AnyRecord | null
    tradeClosed: boolean
    tradeQuote: TradeQuoteLike | null
    watchlistEntry: WatchlistEntry | null
    aiRead: AIReadView | null
}

export interface TickerContext {
    ticker: string
    asOf: string
    price: number | null
    priceSource: PriceSource | null
    momentum: { d5Pct: number | null; w13Pct: number | null; w52Pct: number | null } | null
    scores: {
        risk: ReturnType<typeof computePreTradeRiskScore>
        own: ReturnType<typeof computeAssignmentConvictionScore>
        balanceSheet: ReturnType<typeof computeBalanceSheetScore>
        valuation: ReturnType<typeof computeValuationScore>
    } | null
    signals: {
        analyst: { buy: number; hold: number; sell: number } | null
        insiderNet90d: 'buying' | 'selling' | 'mixed' | 'none'
        earningsBeatsLast4: number | null
        headlines: string[]
    } | null
    position: {
        pos: string
        status: 'open' | 'closed'
        dte: number | null
        strikes: string | null
        cash: number | null
        capitalAtRisk: number | null
        toStrikePct: number | null
        earningsInLife: { date: string; daysAway: number } | null
        quote: TradeQuoteFacts | null
    } | null
    watchlist: {
        rating: number | null
        thesis: string
        tags: string[]
        daysSinceAdded: number | null
        targetPrice: number | null
        targetDirection: 'up' | 'down' | null
        priceVsTargetPct: number | null
        targetMet: boolean
        targetCrossedToday: boolean
    } | null
    aiRead: { grade: AIReadView['grade']; display: AIReadView['display']; confidence: number | null; engine: AIReadView['engine'] } | null
}

const MAX_HEADLINES = 3
const MAX_HEADLINE_CHARS = 120
const MAX_THESIS_CHARS = 600
const finite = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const round = (v: number, places: number) => Math.round(v * 10 ** places) / 10 ** places

function summarizeSignals(signals: SignalsData, surprises: EarningsSurprise[] | null, asOf: string): TickerContext['signals'] {
    const r = signals.recommendation
    const analyst = r ? { buy: r.strongBuy + r.buy, hold: r.hold, sell: r.sell + r.strongSell } : null
    let buys = 0
    let sells = 0
    for (const tx of signals.insiderTransactions) {
        if (tx.isDerivative || !tx.filingDate) continue
        const age = daysBetweenIso(tx.filingDate.slice(0, 10), asOf)
        if (!(age >= 0 && age <= 90)) continue
        if (tx.transactionCode === 'P') buys += 1
        if (tx.transactionCode === 'S') sells += 1
    }
    const insiderNet90d = buys === 0 && sells === 0 ? 'none' : buys > sells ? 'buying' : sells > buys ? 'selling' : 'mixed'
    const latest = [...(surprises ?? [])].sort((a, b) => b.period.localeCompare(a.period)).slice(0, 4)
    const scored = latest.filter(s => finite(s.surprisePercent) !== null)
    return {
        analyst,
        insiderNet90d,
        earningsBeatsLast4: scored.length ? scored.filter(s => (s.surprisePercent ?? 0) > 0).length : null,
        headlines: signals.news.slice(0, MAX_HEADLINES).map(n => {
            const h = String(n.headline ?? '').trim()
            return h.length > MAX_HEADLINE_CHARS ? `${h.slice(0, MAX_HEADLINE_CHARS - 1)}…` : h
        }).filter(Boolean)
    }
}

export function buildTickerContext(input: TickerContextInput): TickerContext {
    const asOf = input.now.toISOString().slice(0, 10)
    const resolved = resolveTickerPrice(input.prices)
    const price = resolved?.value ?? null
    const m = input.metrics

    let position: TickerContext['position'] = null
    if (input.trade) {
        const t = input.trade
        const expiry = String(t.expirationDate ?? '')
        const earningsDate = input.upcomingEarningsDate
        const earningsInLife = !input.tradeClosed && earningsDate && earningsDate >= asOf && (!expiry || earningsDate <= expiry)
            ? { date: earningsDate, daysAway: daysBetweenIso(asOf, earningsDate) }
            : null
        const capital = finite(Number(t.capitalAtRisk))
        position = {
            pos: positionLabel(t),
            status: input.tradeClosed ? 'closed' : 'open',
            dte: input.tradeClosed ? null : finite(Number(t.dte)),
            strikes: t.displayStrike ?? t.strikePrice ?? null,
            cash: finite(Number(t.cashFlow)) === null ? null : round(Number(t.cashFlow), 2),
            capitalAtRisk: capital !== null && capital > 0 ? round(capital, 2) : null,
            toStrikePct: input.tradeClosed ? null : shortLegDistancePct(t.legs, asOf, price),
            earningsInLife,
            quote: input.tradeClosed ? null : tradeQuoteFacts(input.tradeQuote, input.now.getTime())
        }
    }

    let watchlist: TickerContext['watchlist'] = null
    if (input.watchlistEntry) {
        const e = input.watchlistEntry
        const thesis = String(e.notes ?? '').trim()
        const status = targetStatus(price, input.previousClose, e.targetPrice ?? null, e.targetDirection)
        watchlist = {
            rating: e.rating ?? null,
            thesis: thesis.length > MAX_THESIS_CHARS ? `${thesis.slice(0, MAX_THESIS_CHARS - 1)}…` : thesis,
            tags: Array.isArray(e.tags) ? e.tags : [],
            daysSinceAdded: e.addedDate ? daysBetweenIso(e.addedDate, asOf) : null,
            targetPrice: finite(e.targetPrice ?? null),
            targetDirection: e.targetPrice == null ? null : (e.targetDirection === 'down' ? 'down' : 'up'),
            priceVsTargetPct: status?.priceVsTargetPct ?? null,
            targetMet: status?.met ?? false,
            targetCrossedToday: status?.crossedToday ?? false
        }
    }

    return {
        ticker: input.ticker.toUpperCase(),
        asOf,
        price: price === null ? null : round(price, 2),
        priceSource: resolved?.source ?? null,
        momentum: m ? { d5Pct: m.return5Day, w13Pct: m.return13Week, w52Pct: m.return52Week } : null,
        scores: m ? {
            risk: computePreTradeRiskScore(m),
            own: computeAssignmentConvictionScore(m),
            balanceSheet: computeBalanceSheetScore(m),
            valuation: computeValuationScore(m)
        } : null,
        signals: input.signals ? summarizeSignals(input.signals, input.earningsSurprises, asOf) : null,
        position,
        watchlist,
        aiRead: input.aiRead
            ? { grade: input.aiRead.grade, display: input.aiRead.display, confidence: input.aiRead.confidence, engine: input.aiRead.engine }
            : null
    }
}

/** Compact JSON without nulls (same discipline as the Coach snapshot). */
export function tickerContextJson(ctx: TickerContext): string {
    return JSON.stringify(ctx, (_key, value) => (value === null || value === undefined ? undefined : value))
}

export interface AskQuestion { display: string; request: string }

const AI_READ_NOTE = 'If aiRead is present, it is a separate model\'s calibrated read; treat it as one input, not a conclusion.'

export function buildPositionAskQuestion(ctx: TickerContext): AskQuestion {
    const pos = ctx.position?.pos ?? ctx.ticker
    const instruction = ctx.position?.status === 'closed'
        ? 'Review this closed trade: what worked, what didn\'t, and what to repeat or avoid next time.'
        : 'Analyze this position. Say whether to hold, roll or close it, and why. quote.unrealizedPL is computed by the app; use it as given.'
    return {
        display: `Ask about ${pos}`,
        request: `${instruction} ${AI_READ_NOTE}\n\nPOSITION FACTS (compact JSON computed by GammaLedger):\n${tickerContextJson(ctx)}`
    }
}

export function buildWatchlistAskQuestion(ctx: TickerContext): AskQuestion {
    return {
        display: `Ask about ${ctx.ticker} (watchlist)`,
        request: `Is ${ctx.ticker} a candidate to open a position on, given my thesis and the numbers below? If yes, suggest a structure (strategy, rough distance to strike, DTE window) and what to check first. If not, say what would change that. ${AI_READ_NOTE}\n\nWATCHLIST FACTS (compact JSON computed by GammaLedger):\n${tickerContextJson(ctx)}`
    }
}

// ---------------------------------------------------------------------------
// Adapter: GammaLedger caches → TickerContextInput
// ---------------------------------------------------------------------------

export interface TickerHost {
    currentDate: Date | unknown
    schwab?: { quoteCache?: ReadonlyMap<string, { price: number }>; tradeQuoteCache?: ReadonlyMap<string, TradeQuoteLike> }
    metricsCache: ReadonlyMap<string, StockMetrics | 'loading' | 'error'>
    signalsCache: ReadonlyMap<string, SignalsData | 'loading' | 'error'>
    earningsCache: ReadonlyMap<string, EarningsSurprise[] | 'loading' | 'error'>
    earningsMap?: ReadonlyMap<string, { date?: string }>
    aiReadCache?: ReadonlyMap<string, AIReadView | 'loading' | 'error'>
    getCachedQuote?(ticker: string): { value?: { price?: number; previousClose?: number } } | null
    getSchwabTradeQuoteKey?(trade: AnyRecord): string
    isClosedStatus(status: unknown): boolean
}

const loaded = <T>(value: T | 'loading' | 'error' | undefined): T | null =>
    value === undefined || value === 'loading' || value === 'error' ? null : value

export function latestAIRead(host: Pick<TickerHost, 'aiReadCache'>, ticker: string, asOf: string): AIReadView | null {
    for (const [key, value] of host.aiReadCache ?? []) {
        if (key.startsWith(`${ticker}|${asOf}|`) && value !== 'loading' && value !== 'error') return value
    }
    return null
}

export function gatherTickerContext(
    this: TickerHost,
    ticker: string,
    scope: { trade?: AnyRecord | null; watchlistEntry?: WatchlistEntry | null } = {}
): TickerContext {
    const key = ticker.trim().toUpperCase()
    const now = this.currentDate instanceof Date ? this.currentDate : new Date()
    const quote = this.getCachedQuote?.(key)?.value
    const trade = scope.trade ?? null
    const quoteKey = trade ? this.getSchwabTradeQuoteKey?.(trade) : undefined
    const previousClose = Number(quote?.previousClose)
    return buildTickerContext({
        ticker: key,
        now,
        prices: { schwab: this.schwab?.quoteCache?.get(key)?.price, finnhub: quote?.price, snapshot: trade?.marketPriceSnapshot },
        previousClose: Number.isFinite(previousClose) ? previousClose : null,
        metrics: loaded(this.metricsCache.get(key)),
        signals: loaded(this.signalsCache.get(key)),
        earningsSurprises: loaded(this.earningsCache.get(key)),
        upcomingEarningsDate: this.earningsMap?.get(key)?.date ?? null,
        trade,
        tradeClosed: trade ? this.isClosedStatus(trade.status) : false,
        tradeQuote: quoteKey ? this.schwab?.tradeQuoteCache?.get(quoteKey) ?? null : null,
        watchlistEntry: scope.watchlistEntry ?? null,
        aiRead: latestAIRead(this, key, now.toISOString().slice(0, 10))
    })
}
