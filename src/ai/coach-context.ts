// src/ai/coach-context.ts — compact, pre-computed portfolio snapshot for the AI Coach.
// buildCoachContext is pure (structural inputs only) so it can be checked in Node;
// gatherCoachContext is the this-typed adapter GammaLedger delegates to.

import { daysBetweenIso } from '../calculations/market-facts.js'

type AnyRecord = Record<string, any>

export type CoachContext = Record<string, unknown>

export interface CoachInventory {
    trade: AnyRecord
    shares?: number
    effectiveCostBasis?: number
    premiumCollected?: number
    coveredCallCount?: number
    activeShortCallDetails?: Array<{ strike?: number; expiration?: string; contracts?: number }>
}

export interface CoachContextInput {
    asOf: string
    accountSize: number | null
    stats: AnyRecord
    pl: { mtd?: number; ytd?: number; d30?: number; d90?: number; y1?: number }
    closedTrades: AnyRecord[]
    openTrades: AnyRecord[]
    heldInventory: CoachInventory[]
    earnings: ReadonlyMap<string, { date?: string }>
    priceOf: (ticker: string, trade?: AnyRecord) => number | null
    realizedPL: (trade: AnyRecord) => number
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const round = (v: unknown, places: number): number | null => {
    if (v === null || v === undefined || v === '') return null
    const n = Number(v)
    if (!Number.isFinite(n)) return null
    const f = 10 ** places
    return Math.round(n * f) / f
}
const r1 = (v: unknown) => round(v, 1)
const r2 = (v: unknown) => round(v, 2)
const clean = (o: AnyRecord): AnyRecord => Object.fromEntries(
    Object.entries(o).filter(([, v]) => v !== null && v !== undefined && v !== '' && !(typeof v === 'number' && !Number.isFinite(v)))
)

const STRATEGY_CODES: Record<string, string> = {
    'Cash-Secured Put': 'CSP', 'Covered Call': 'CC', 'Bull Put Spread': 'BPS', 'Bear Call Spread': 'BCS',
    'Bull Call Spread': 'BullCS', 'Bear Put Spread': 'BearPS', 'Iron Condor': 'IC', "Poor Man's Covered Call": 'PMCC',
    'Put Credit Spread': 'PCS', 'Call Credit Spread': 'CCS'
}

function positionLabel(trade: AnyRecord, withExpiry = true): string {
    const strategy = STRATEGY_CODES[String(trade.strategy)] ?? String(trade.strategy ?? '')
    const strikes = trade.displayStrike ?? trade.strikePrice
    return [trade.ticker, strategy, strikes, withExpiry ? trade.expirationDate : null]
        .filter(part => part !== null && part !== undefined && part !== '')
        .join(' ')
}


/**
 * How far (%) the underlying can move against the position before touching the nearest short
 * strike; negative = already through it. Uses net short quantity per (type, strike, expiration).
 */
export function shortLegDistancePct(legs: AnyRecord[] | undefined, asOf: string, price: number | null): number | null {
    if (!Array.isArray(legs) || !isNum(price) || !(price > 0)) return null
    const net = new Map<string, { type: 'CALL' | 'PUT'; strike: number; qty: number }>()
    const SIGN: Record<string, number> = { BTO: 1, BTC: 1, STO: -1, STC: -1 }
    for (const leg of legs) {
        const type = String(leg?.type ?? '').toUpperCase()
        const sign = SIGN[String(leg?.orderType ?? '').toUpperCase()]
        const strike = Number(leg?.strike)
        const qty = Math.abs(Number(leg?.quantity))
        const exp = String(leg?.expirationDate ?? '')
        if ((type !== 'CALL' && type !== 'PUT') || sign === undefined || !Number.isFinite(strike) || !(qty > 0)) continue
        if (exp && exp < asOf) continue
        const key = `${type}|${strike}|${exp}`
        const entry = net.get(key) ?? { type, strike, qty: 0 }
        entry.qty += sign * qty
        net.set(key, entry)
    }
    let nearest: number | null = null
    for (const { type, strike, qty } of net.values()) {
        if (!(qty < -1e-9)) continue
        const pct = type === 'PUT' ? ((price - strike) / price) * 100 : ((strike - price) / price) * 100
        nearest = nearest === null ? pct : Math.min(nearest, pct)
    }
    return nearest === null ? null : r1(nearest)
}

function monthKey(iso: string): string {
    return iso.slice(0, 7)
}

function lastMonths(asOf: string, count: number): string[] {
    const [year, month] = asOf.split('-').map(Number)
    const keys: string[] = []
    for (let i = count - 1; i >= 0; i -= 1) {
        const index = year * 12 + (month - 1) - i
        keys.push(`${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`)
    }
    return keys
}

function dteBucket(dte: unknown): string {
    const n = Number(dte)
    if (!Number.isFinite(n) || n < 0) return 'expired'
    if (n <= 7) return '0-7'
    if (n <= 21) return '8-21'
    if (n <= 45) return '22-45'
    if (n <= 90) return '46-90'
    return '90+'
}

export function buildCoachContext(input: CoachContextInput): CoachContext {
    const { asOf, accountSize, stats, pl, closedTrades, openTrades, heldInventory, earnings, priceOf, realizedPL } = input
    const hasAccount = isNum(accountSize) && accountSize > 0
    const pctOfAccount = (dollars: unknown) => (hasAccount && isNum(Number(dollars)) ? r1((Number(dollars) / (accountSize as number)) * 100) : null)

    // ── closed trades (realized only), newest first
    const closed = closedTrades
        .filter(t => typeof t.closedDate === 'string' && t.closedDate)
        .map(t => ({ trade: t, pl: Number(realizedPL(t)) || 0 }))
        .sort((a, b) => String(b.trade.closedDate).localeCompare(String(a.trade.closedDate)))

    // ── monthly realized P&L, last 12 calendar months
    const months = lastMonths(asOf, 12)
    const monthly = months.map(m => {
        const rows = closed.filter(c => monthKey(String(c.trade.closedDate)) === m)
        return { m, pl: r2(rows.reduce((sum, c) => sum + c.pl, 0)) ?? 0, n: rows.length }
    })

    // ── exits over the same window
    const windowStart = `${months[0]}-01`
    const recent = closed.filter(c => String(c.trade.closedDate) >= windowStart)
    const reasonCounts = new Map<string, number>()
    let expiredWorthless = 0
    const captures: number[] = []
    for (const { trade } of recent) {
        const reason = String(trade.exitReason ?? '').trim()
        if (reason) reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1)
        if (/expire/i.test(reason) || trade.autoExpired) expiredWorthless += 1
        const entry = Number(trade.entryPrice)
        const exit = Number(trade.exitPrice)
        if (String(trade.tradeDirection) === 'short' && entry > 0 && Number.isFinite(exit) && exit >= 0) {
            captures.push(((entry - exit) / entry) * 100)
        }
    }
    const reasons = Object.fromEntries([...reasonCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6))
    const exits = clean({
        reasons: Object.keys(reasons).length ? reasons : null,
        expiredWorthless: recent.length ? expiredWorthless : null,
        avgProfitCapturePct: captures.length ? r1(captures.reduce((s, v) => s + v, 0) / captures.length) : null,
        closedAtOrAbove50PctShare: captures.length ? r1((captures.filter(v => v >= 50).length / captures.length) * 100) : null
    })

    // ── strategies
    const strategyMap = new Map<string, { closed: number; open: number; wins: number; total: number }>()
    const entryFor = (name: string) => {
        const existing = strategyMap.get(name)
        if (existing) return existing
        const created = { closed: 0, open: 0, wins: 0, total: 0 }
        strategyMap.set(name, created)
        return created
    }
    closed.forEach(({ trade, pl: p }) => {
        const e = entryFor(String(trade.strategy ?? 'Unknown'))
        e.closed += 1
        e.total += p
        if (p > 0) e.wins += 1
    })
    openTrades.forEach(t => { entryFor(String(t.strategy ?? 'Unknown')).open += 1 })
    const strategies = [...strategyMap.entries()]
        .map(([name, e]) => clean({
            name, closed: e.closed, open: e.open,
            winRatePct: e.closed ? r1((e.wins / e.closed) * 100) : null,
            avgPL: e.closed ? r2(e.total / e.closed) : null,
            totalPL: r2(e.total)
        }))
        .sort((a, b) => Math.abs(Number(b.totalPL) || 0) - Math.abs(Number(a.totalPL) || 0))
        .slice(0, 8)

    // ── risk by ticker and P&L by ticker
    const finiteCapital = (t: AnyRecord) => (isNum(Number(t.capitalAtRisk)) && Number(t.capitalAtRisk) > 0 ? Number(t.capitalAtRisk) : 0)
    const capitalSum = openTrades.reduce((s, t) => s + finiteCapital(t), 0)
    const collateral = isNum(stats.collateralAtRisk) && stats.collateralAtRisk > 0 ? stats.collateralAtRisk : capitalSum
    const capitalByTicker = new Map<string, number>()
    openTrades.forEach(t => capitalByTicker.set(String(t.ticker), (capitalByTicker.get(String(t.ticker)) ?? 0) + finiteCapital(t)))
    const riskByTicker = [...capitalByTicker.entries()]
        .filter(([, capital]) => capital > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([ticker, capital]) => clean({ ticker, capital: r2(capital), pctOfCollateral: collateral > 0 ? r1((capital / collateral) * 100) : null }))

    const plByTicker = new Map<string, { pl: number; n: number }>()
    closed.forEach(({ trade, pl: p }) => {
        const e = plByTicker.get(String(trade.ticker)) ?? { pl: 0, n: 0 }
        e.pl += p
        e.n += 1
        plByTicker.set(String(trade.ticker), e)
    })
    const tickerRows = [...plByTicker.entries()].map(([ticker, e]) => ({ ticker, pl: r2(e.pl) ?? 0, n: e.n }))
    const tickerPL = {
        best: tickerRows.filter(r => r.pl > 0).sort((a, b) => b.pl - a.pl).slice(0, 3),
        worst: tickerRows.filter(r => r.pl < 0).sort((a, b) => a.pl - b.pl).slice(0, 3)
    }

    // ── DTE buckets
    const dteBuckets: Record<string, number> = { '0-7': 0, '8-21': 0, '22-45': 0, '46-90': 0, '90+': 0 }
    openTrades.forEach(t => {
        const bucket = dteBucket(t.dte)
        dteBuckets[bucket] = (dteBuckets[bucket] ?? 0) + 1
    })
    if (!dteBuckets.expired) delete dteBuckets.expired

    // ── open positions
    let missingPrice = 0
    let anyPrice = false
    const open = openTrades.map(t => {
        const ticker = String(t.ticker)
        const capital = Number(t.capitalAtRisk)
        const unlimited = capital === Number.POSITIVE_INFINITY || t.riskIsUnlimited === true
        const price = priceOf(ticker, t)
        const hasShort = Array.isArray(t.legs) && t.legs.some((l: AnyRecord) => String(l?.orderType).toUpperCase() === 'STO')
        if (price === null) { if (hasShort) missingPrice += 1 } else { anyPrice = true }
        const earning = earnings.get(ticker)
        const expiry = String(t.expirationDate ?? '')
        const earningsInLife = earning?.date && earning.date >= asOf && (!expiry || earning.date <= expiry)
            ? { date: earning.date, daysAway: daysBetweenIso(asOf, earning.date) }
            : null
        const note = String(t.notes ?? '').trim()
        return clean({
            pos: positionLabel(t),
            ticker,
            strategy: t.strategy,
            dte: isNum(Number(t.dte)) ? Number(t.dte) : null,
            qty: t.quantity,
            strikes: t.displayStrike ?? t.strikePrice ?? null,
            cash: r2(t.cashFlow),
            capital: unlimited ? null : r2(capital),
            unlimited: unlimited ? true : null,
            capitalPctOfCollateral: !unlimited && collateral > 0 && capital > 0 ? r1((capital / collateral) * 100) : null,
            price: price === null ? null : r2(price),
            toStrikePct: shortLegDistancePct(t.legs, asOf, price),
            earnings: earningsInLife,
            rolled: t.rolledForward ? true : null,
            note: note ? (note.length > 160 ? `${note.slice(0, 157)}...` : note) : null
        })
    })

    // ── held stock (assigned wheel / PMCC inventory)
    const stock = heldInventory.map(({ trade, shares, effectiveCostBasis, premiumCollected, coveredCallCount, activeShortCallDetails }) => {
        const price = isNum(Number(trade.marketPriceSnapshot)) && Number(trade.marketPriceSnapshot) > 0
            ? Number(trade.marketPriceSnapshot)
            : priceOf(String(trade.ticker), trade)
        const coverage = ['covered', 'partial', 'uncovered'].includes(String(trade.wheelCoverage)) ? String(trade.wheelCoverage) : null
        const shortCalls = (activeShortCallDetails ?? []).map(d => clean({ strike: r2(d.strike), exp: d.expiration, contracts: d.contracts }))
        const nearestCall = (activeShortCallDetails ?? []).map(d => Number(d.strike)).filter(isNum).sort((a, b) => a - b)[0]
        return clean({
            ticker: trade.ticker,
            shares,
            basisPerShare: isNum(shares) && shares > 0 && isNum(effectiveCostBasis) ? r2((effectiveCostBasis as number) / shares) : null,
            price: price === null ? null : r2(price),
            unrealizedPL: r2(trade.unrealizedPL),
            coverage,
            shortCalls: shortCalls.length ? shortCalls : null,
            callToStrikePct: price !== null && nearestCall !== undefined ? r1(((nearestCall - price) / price) * 100) : null,
            premiumCollected: r2(premiumCollected),
            callsSold: coveredCallCount
        })
    })

    // ── recent closed (realized). ROI is omitted when capital at risk is 0: the formula cannot
    // size heavily rolled campaigns, and 0% would read as "no return".
    const recentClosed = closed.slice(0, 10).map(({ trade, pl: p }) => clean({
        pos: positionLabel(trade, false),
        opened: trade.openedDate,
        closed: trade.closedDate,
        days: isNum(Number(trade.daysHeld)) ? Number(trade.daysHeld) : null,
        pl: r2(p),
        roiPct: Number(trade.capitalAtRisk) > 0 ? r1(trade.roi) : null,
        exit: trade.exitReason
    }))

    // ── notes on data limits
    const notes = ['No live option prices, IV or Greeks are available.']
    if (anyPrice) notes.push('Underlying prices are cached snapshots and may be stale.')
    if (missingPrice > 0) notes.push(`${missingPrice} open position(s) have no underlying price, so distance to strike is unknown.`)
    if (!hasAccount) notes.push('Account size not set: sizing advice is relative to collateral only.')

    // ── edge
    const avgWin = Number(stats.avgWin)
    const avgLoss = Number(stats.avgLoss)
    const haveBoth = isNum(avgWin) && isNum(avgLoss) && avgWin > 0 && avgLoss > 0
    const breakeven = haveBoth ? r1((avgLoss / (avgWin + avgLoss)) * 100) : null
    const edge = clean({
        winRatePct: r1(stats.winRate),
        avgWin: r2(stats.avgWin),
        avgLoss: r2(stats.avgLoss),
        payoffRatio: haveBoth ? r2(avgWin / avgLoss) : null,
        breakevenWinRatePct: breakeven,
        edgePts: breakeven === null || !isNum(Number(stats.winRate)) ? null : r1(Number(stats.winRate) - breakeven),
        expectancy: r2(stats.expectancy),
        profitFactor: isNum(stats.profitFactor) ? r2(stats.profitFactor) : null,
        avgDaysHeldWinners: r1(stats.avgWinnerDays),
        avgDaysHeldLosers: r1(stats.avgLoserDays),
        annualizedReturnOnCollateralPct: r1(stats.totalROI),
        maxDrawdown: isNum(stats.maxDrawdownDollars)
            ? clean({ dollars: r2(stats.maxDrawdownDollars), pctOfAccount: pctOfAccount(stats.maxDrawdownDollars) })
            : null,
        feesPctOfGross: r1(stats.feeShareOfGross)
    })

    return clean({
        asOf,
        account: hasAccount ? { size: accountSize } : null,
        book: clean({
            realizedPL: r2(stats.realizedPL),
            heldSharesUnrealizedPL: r2(stats.unrealizedPL),
            pendingPremium: r2(stats.pendingPremium),
            pl: clean({ mtd: r2(pl.mtd), ytd: r2(pl.ytd), d30: r2(pl.d30), d90: r2(pl.d90), y1: r2(pl.y1) }),
            closedTrades: closedTrades.length,
            openPositions: openTrades.length,
            heldStockPositions: heldInventory.length,
            collateralAtRisk: collateral > 0 ? r2(collateral) : null,
            collateralPctOfAccount: collateral > 0 ? pctOfAccount(collateral) : null
        }),
        edge,
        monthly,
        exits,
        strategies,
        riskByTicker,
        tickerPL,
        dteBuckets,
        open,
        stock,
        recentClosed,
        notes
    })
}

// ---------------------------------------------------------------------------
// Adapter: GammaLedger → CoachContextInput → compact JSON string
// ---------------------------------------------------------------------------

export interface CoachHost {
    trades: AnyRecord[]
    currentDate: Date | unknown
    accountSize?: number | null
    earningsMap?: ReadonlyMap<string, { date?: string }>
    schwab?: { quoteCache?: ReadonlyMap<string, { price: number }> }
    calculateAdvancedStats(): AnyRecord
    getClosedTradesInRange(range: string): AnyRecord[]
    calculateRealizedPL(trade: AnyRecord): number
    isClosedStatus(status: unknown): boolean
    getCachedQuote?(ticker: string): { value?: { price?: number } } | null
}

export function gatherCoachContext(this: CoachHost): string {
    const asOfDate = this.currentDate instanceof Date ? this.currentDate : new Date()
    const asOf = asOfDate.toISOString().slice(0, 10)
    try {
        const stats = this.calculateAdvancedStats()
        const realized = (t: AnyRecord) => Number(this.calculateRealizedPL(t)) || 0
        const windowPL = (range: string) => this.getClosedTradesInRange(range).reduce((sum, t) => sum + realized(t), 0)
        const priceOf = (ticker: string, trade?: AnyRecord): number | null => {
            const key = String(ticker).trim().toUpperCase()
            const candidates = [
                this.schwab?.quoteCache?.get(key)?.price,
                this.getCachedQuote?.(key)?.value?.price,
                trade?.marketPriceSnapshot
            ]
            const found = candidates.map(Number).find(n => Number.isFinite(n) && n > 0)
            return found === undefined ? null : found
        }
        const closedTrades = (stats.closedTradesList ?? []).filter((t: AnyRecord) => this.isClosedStatus(t.status))
        const context = buildCoachContext({
            asOf,
            accountSize: isNum(this.accountSize) ? this.accountSize : null,
            stats,
            pl: { mtd: windowPL('MTD'), ytd: windowPL('YTD'), d30: windowPL('1M'), d90: windowPL('3M'), y1: windowPL('1Y') },
            closedTrades,
            openTrades: stats.openTradesList ?? [],
            heldInventory: (stats.assignmentStats?.assignments ?? [])
                .filter(({ trade }: AnyRecord) => !this.isClosedStatus(trade?.status))
                .map((a: AnyRecord) => ({
                    trade: a.trade, shares: a.shares, effectiveCostBasis: a.effectiveCostBasis,
                    premiumCollected: a.premiumCollected, coveredCallCount: a.coveredCallCount,
                    activeShortCallDetails: a.activeShortCallDetails
                })),
            earnings: this.earningsMap ?? new Map(),
            priceOf,
            realizedPL: realized
        })
        return JSON.stringify(context)
    } catch (error) {
        console.warn('Failed to build the AI Coach context:', error)
        return JSON.stringify({ asOf, notes: ['Portfolio data could not be prepared.'] })
    }
}
