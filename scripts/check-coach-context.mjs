// scripts/check-coach-context.mjs — coach context builder, source fixes and account size (Vite SSR, no network).
import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const load = (path) => server.ssrLoadModule(path)
const tests = []
const test = (name, fn) => tests.push({ name, fn })

// ── Source fixes ─────────────────────────────────────────────────────────────

test('calculateBasisROI is undefined-safe: non-positive or invalid basis gives 0', async () => {
    const { calculateBasisROI } = await load('/src/calculations/pnl.ts')
    assert.equal(calculateBasisROI(2467.19, -164.19), 0)   // the CMCSA "free wheel": was -1502.64
    assert.equal(calculateBasisROI(100, 0), 0)
    assert.equal(calculateBasisROI(100, 1000), 10)
    assert.equal(calculateBasisROI(-50, 1000), -5)
    assert.equal(calculateBasisROI(Number.NaN, 1000), 0)
    assert.equal(calculateBasisROI(100, Number.NaN), 0)
})

const mcpHost = (overrides = {}) => {
    const closed = { id: 'C1', ticker: 'AAPL', strategy: 'Cash-Secured Put', status: 'Closed', pl: 50, roi: 2.5, closedDate: '2026-09-10', openedDate: '2026-08-20' }
    const assignedHeld = { id: 'A1', ticker: 'CMCSA', strategy: 'Wheel', status: 'Assigned', pl: 2467.19, roi: 0, closedDate: '2026-09-18', openedDate: '2026-06-01' }
    const open = { id: 'O1', ticker: 'VEEV', strategy: 'Cash-Secured Put', status: 'Open', pl: 620, roi: 4, annualizedROI: 0, dte: 20 }
    const realized = { C1: 50, A1: 164.19 }
    return {
        closed, assignedHeld, open,
        host: {
            trades: [closed, assignedHeld, open],
            currentDate: new Date('2026-09-26T00:00:00Z'),
            calculateAdvancedStats: () => ({ closedTradesList: [closed, assignedHeld], openTradesList: [open], totalTrades: 3, closedTrades: 2, activePositions: 1, assignedPositions: 1, collateralAtRisk: 1000 }),
            getClosedTradesInRange: () => [closed],
            calculateRealizedPL: (t) => realized[t.id] ?? 0,
            isClosedStatus: (s) => s === 'Closed' || s === 'Expired',
            hasAssignedInventory: (t) => t.status === 'Assigned',
            isActiveStatus: (s) => s === 'Open' || s === 'Rolling',
            buildMCPAssignment: () => null,
            ...overrides
        }
    }
}

test('buildMCPContext: held (assigned) inventory is not a closed winner and not a recent closed trade', async () => {
    const { buildMCPContext, buildMCPTrade } = await load('/src/integrations/mcp.ts')
    const { host } = mcpHost()
    host.buildMCPTrade = buildMCPTrade
    const ctx = buildMCPContext.call(host)
    assert.equal(ctx.portfolio.largestWinner.ticker, 'AAPL')
    assert.equal(ctx.portfolio.largestWinner.pl, 50)
    assert.deepEqual(ctx.recentClosedTrades.map(t => t.ticker), ['AAPL'])
})

test('buildMCPTrade: open trades carry no annualizedROI, closed trades keep it', async () => {
    const { buildMCPTrade } = await load('/src/integrations/mcp.ts')
    const open = buildMCPTrade({ id: 'O', ticker: 'X', annualizedROI: 0, dte: 5 }, { isOpen: true })
    const closed = buildMCPTrade({ id: 'C', ticker: 'X', annualizedROI: 42.5, closedDate: '2026-09-01' }, { isOpen: false })
    assert.ok(!('annualizedROI' in open))
    assert.equal(closed.annualizedROI, 42.5)
})

// ── Account size ─────────────────────────────────────────────────────────────

test('parseAccountSize accepts positive finite USD amounts only', async () => {
    const { parseAccountSize } = await load('/src/settings/account-size.ts')
    assert.equal(parseAccountSize('50000'), 50000)
    assert.equal(parseAccountSize(' 62500.5 '), 62500.5)
    assert.equal(parseAccountSize('1,250'), null)          // no thousands separators
    for (const bad of ['0', '-5', 'abc', '', '  ', 'NaN', 'Infinity', '1e12', null, undefined]) {
        assert.equal(parseAccountSize(bad), null, String(bad))
    }
})

test('AccountSizeSchema mirrors the parser (max 1e10)', async () => {
    const { AccountSizeSchema } = await load('/src/core/schema.ts')
    assert.ok(AccountSizeSchema.safeParse(50000).success)
    assert.ok(!AccountSizeSchema.safeParse(0).success)
    assert.ok(!AccountSizeSchema.safeParse(1e11).success)
    assert.ok(!AccountSizeSchema.safeParse(Number.NaN).success)
})

// ── Coach context ────────────────────────────────────────────────────────────

const ASOF = '2026-09-26'
const shortLeg = (type, strike, exp, qty = 1, orderType = 'STO') => ({ type, strike, expirationDate: exp, quantity: qty, orderType })
const longLeg = (type, strike, exp) => shortLeg(type, strike, exp, 1, 'BTO')

const closedTrade = (o) => ({ status: 'Closed', tradeDirection: 'short', capitalAtRisk: 1000, daysHeld: 10, ...o })
const openTrade = (o) => ({ status: 'Open', tradeDirection: 'short', ...o })

function sampleInput(overrides = {}) {
    const closed = [
        closedTrade({ id: 'c1', ticker: 'AAPL', strategy: 'Cash-Secured Put', closedDate: '2026-09-10', openedDate: '2026-08-20', realized: 100, entryPrice: 2.0, exitPrice: 0.5, exitReason: 'Profit target reached', daysHeld: 21, roi: 5, displayStrike: 180, expirationDate: '2026-09-18' }),
        closedTrade({ id: 'c2', ticker: 'AAPL', strategy: 'Cash-Secured Put', closedDate: '2026-09-15', openedDate: '2026-08-25', realized: 60, entryPrice: 1.0, exitPrice: 0.0, exitReason: 'Expired', daysHeld: 21, roi: 3 }),
        closedTrade({ id: 'c3', ticker: 'MSFT', strategy: 'Bull Put Spread', closedDate: '2026-08-05', openedDate: '2026-07-01', realized: -300, entryPrice: 1.5, exitPrice: 3.0, exitReason: 'Stop loss', daysHeld: 35, roi: -30 }),
        closedTrade({ id: 'c4', ticker: 'KO', strategy: 'Covered Call', closedDate: '2026-01-15', openedDate: '2025-12-20', realized: 40, entryPrice: 1.0, exitPrice: 0.6, exitReason: 'Profit target reached', daysHeld: 26, roi: 2 }),
        closedTrade({ id: 'c5', ticker: 'IBM', strategy: 'Covered Call', closedDate: '2024-01-01', openedDate: '2023-12-01', realized: 999, entryPrice: 1.0, exitPrice: 0.1, exitReason: 'Profit target reached', daysHeld: 30, roi: 9 })
    ]
    const open = [
        openTrade({ id: 'o1', ticker: 'VEEV', strategy: 'Cash-Secured Put', dte: 20, quantity: 1, displayStrike: 'P200', expirationDate: '2026-10-16', cashFlow: 620, capitalAtRisk: 6000, rolledForward: true, notes: 'Rolled out and down 45->44', legs: [shortLeg('PUT', 200, '2026-10-16')] }),
        openTrade({ id: 'o2', ticker: 'TSLA', strategy: 'Bear Call Spread', dte: 34, quantity: 1, displayStrike: 'C300/310', expirationDate: '2026-10-30', cashFlow: 150, capitalAtRisk: 3000, legs: [shortLeg('CALL', 300, '2026-10-30'), longLeg('CALL', 310, '2026-10-30')] }),
        openTrade({ id: 'o3', ticker: 'NVDA', strategy: 'Long Call', tradeDirection: 'long', dte: 83, quantity: 1, displayStrike: 'C150', expirationDate: '2026-12-18', cashFlow: -500, capitalAtRisk: 500, legs: [longLeg('CALL', 150, '2026-12-18')] }),
        openTrade({ id: 'o4', ticker: 'XYZ', strategy: 'Cash-Secured Put', dte: 5, quantity: 1, displayStrike: 'P50', expirationDate: '2026-10-01', cashFlow: 80, capitalAtRisk: 500, legs: [shortLeg('PUT', 50, '2026-10-01')] })
    ]
    const held = { id: 'a1', ticker: 'CMCSA', strategy: 'Wheel', status: 'Assigned', pl: 2467.19, roi: 0, closedDate: '2026-09-18' }
    const prices = { VEEV: 210, TSLA: 290, NVDA: 140 }
    return {
        asOf: ASOF,
        accountSize: null,
        stats: { winRate: 75, avgWin: 80, avgLoss: 300, expectancy: 12, profitFactor: 1.1, avgWinnerDays: 30, avgLoserDays: 40, totalROI: 21.9, maxDrawdownDollars: 1000, feeShareOfGross: 2.9, totalFees: 100, realizedPL: 9311.55, unrealizedPL: 2467.19, pendingPremium: 2939.31, collateralAtRisk: 10000 },
        pl: { mtd: 160, ytd: 200, d30: 160, d90: -140, y1: 200 },
        closedTrades: closed,
        openTrades: open,
        heldInventory: [{ trade: { ...held, marketPriceSnapshot: 23.03, unrealizedPL: 2467.19, wheelCoverage: 'uncovered', lifecycleStatus: 'awaiting_coverage' }, shares: 100, effectiveCostBasis: -164.19, premiumCollected: 2574, coveredCallCount: 9, activeShortCallDetails: [] }],
        earnings: new Map([['VEEV', { date: '2026-10-09' }], ['TSLA', { date: '2026-11-20' }]]),
        priceOf: (ticker) => prices[ticker] ?? null,
        realizedPL: (t) => (t.realized !== undefined ? t.realized : t.pl),
        ...overrides
    }
}

test('shortLegDistancePct: short put/call/spread, ITM negative, long-only and closed shorts ignored', async () => {
    const { shortLegDistancePct } = await load('/src/ai/coach-context.ts')
    assert.equal(shortLegDistancePct([shortLeg('PUT', 200, '2026-10-16')], ASOF, 210), 4.8)
    assert.equal(shortLegDistancePct([shortLeg('CALL', 300, '2026-10-30'), longLeg('CALL', 310, '2026-10-30')], ASOF, 290), 3.4)
    assert.equal(shortLegDistancePct([shortLeg('PUT', 200, '2026-10-16')], ASOF, 190), -5.3)
    assert.equal(shortLegDistancePct([shortLeg('CALL', 300, '2026-10-30')], ASOF, 310), -3.2)
    assert.equal(shortLegDistancePct([longLeg('CALL', 150, '2026-12-18')], ASOF, 140), null)
    assert.equal(shortLegDistancePct([shortLeg('PUT', 200, '2026-10-16'), shortLeg('PUT', 200, '2026-10-16', 1, 'BTC')], ASOF, 210), null)
    assert.equal(shortLegDistancePct([shortLeg('PUT', 200, '2026-09-01')], ASOF, 210), null)   // expired leg
    assert.equal(shortLegDistancePct([shortLeg('PUT', 200, '2026-10-16')], ASOF, null), null)
    assert.equal(shortLegDistancePct(undefined, ASOF, 210), null)
    // the nearest of several short strikes wins
    assert.equal(shortLegDistancePct([shortLeg('PUT', 200, '2026-10-16'), shortLeg('CALL', 215, '2026-10-16')], ASOF, 210), 2.4)
})

test('buildCoachContext: edge block computes payoff, breakeven win rate and edge points', async () => {
    const { buildCoachContext } = await load('/src/ai/coach-context.ts')
    const ctx = buildCoachContext(sampleInput())
    assert.equal(ctx.asOf, ASOF)
    assert.deepEqual(ctx.edge, {
        winRatePct: 75, avgWin: 80, avgLoss: 300, payoffRatio: 0.27, breakevenWinRatePct: 78.9, edgePts: -3.9,
        expectancy: 12, profitFactor: 1.1, avgDaysHeldWinners: 30, avgDaysHeldLosers: 40,
        annualizedReturnOnCollateralPct: 21.9, maxDrawdown: { dollars: 1000 }, feesPctOfGross: 2.9
    })
    assert.deepEqual(ctx.book.pl, { mtd: 160, ytd: 200, d30: 160, d90: -140, y1: 200 })
    assert.equal(ctx.book.closedTrades, 5)
    assert.equal(ctx.book.openPositions, 4)
    assert.equal(ctx.book.heldStockPositions, 1)
    assert.equal(ctx.book.collateralAtRisk, 10000)
    assert.ok(!('collateralPctOfAccount' in ctx.book))
    assert.ok(!('account' in ctx))
})

test('buildCoachContext: account size adds account-relative fields only when set', async () => {
    const { buildCoachContext } = await load('/src/ai/coach-context.ts')
    const ctx = buildCoachContext(sampleInput({ accountSize: 50000 }))
    assert.deepEqual(ctx.account, { size: 50000 })
    assert.equal(ctx.book.collateralPctOfAccount, 20)
    assert.deepEqual(ctx.edge.maxDrawdown, { dollars: 1000, pctOfAccount: 2 })
    assert.ok(!ctx.notes.some(n => /Account size not set/.test(n)))
    assert.ok(buildCoachContext(sampleInput()).notes.some(n => /Account size not set/.test(n)))
})

test('buildCoachContext: monthly is the last 12 calendar months, realized only, zero months kept', async () => {
    const { buildCoachContext } = await load('/src/ai/coach-context.ts')
    const { monthly } = buildCoachContext(sampleInput())
    assert.equal(monthly.length, 12)
    assert.deepEqual(monthly[0], { m: '2025-10', pl: 0, n: 0 })
    assert.deepEqual(monthly.at(-1), { m: '2026-09', pl: 160, n: 2 })
    assert.deepEqual(monthly.find(x => x.m === '2026-08'), { m: '2026-08', pl: -300, n: 1 })
    assert.deepEqual(monthly.find(x => x.m === '2026-01'), { m: '2026-01', pl: 40, n: 1 })
    assert.ok(!monthly.some(x => x.pl === 999))     // 2024 trade is outside the window
})

test('buildCoachContext: exits mix, expired worthless and profit capture (last 12 months)', async () => {
    const { buildCoachContext } = await load('/src/ai/coach-context.ts')
    const { exits } = buildCoachContext(sampleInput())
    assert.deepEqual(exits.reasons, { 'Profit target reached': 2, Expired: 1, 'Stop loss': 1 })
    assert.equal(exits.expiredWorthless, 1)
    assert.equal(exits.avgProfitCapturePct, 28.8)          // (75 + 100 - 100 + 40) / 4
    assert.equal(exits.closedAtOrAbove50PctShare, 50)
})

test('buildCoachContext: strategies, risk by ticker, ticker P&L, DTE buckets', async () => {
    const { buildCoachContext } = await load('/src/ai/coach-context.ts')
    const ctx = buildCoachContext(sampleInput())
    const csp = ctx.strategies.find(s => s.name === 'Cash-Secured Put')
    assert.deepEqual(csp, { name: 'Cash-Secured Put', closed: 2, open: 2, winRatePct: 100, avgPL: 80, totalPL: 160 })
    const bps = ctx.strategies.find(s => s.name === 'Bull Put Spread')
    assert.deepEqual(bps, { name: 'Bull Put Spread', closed: 1, open: 0, winRatePct: 0, avgPL: -300, totalPL: -300 })
    assert.deepEqual(ctx.riskByTicker.slice(0, 2), [{ ticker: 'VEEV', capital: 6000, pctOfCollateral: 60 }, { ticker: 'TSLA', capital: 3000, pctOfCollateral: 30 }])
    assert.deepEqual(ctx.tickerPL.worst, [{ ticker: 'MSFT', pl: -300, n: 1 }])
    assert.equal(ctx.tickerPL.best[0].ticker, 'IBM')
    assert.deepEqual(ctx.dteBuckets, { '0-7': 1, '8-21': 1, '22-45': 1, '46-90': 1, '90+': 0 })
})

test('buildCoachContext: open positions carry labels, distance to strike, earnings inside the life, notes; no IDs', async () => {
    const { buildCoachContext } = await load('/src/ai/coach-context.ts')
    const { open } = buildCoachContext(sampleInput())
    assert.equal(open.length, 4)
    const veev = open.find(p => p.ticker === 'VEEV')
    assert.deepEqual(veev, {
        pos: 'VEEV CSP P200 2026-10-16', ticker: 'VEEV', strategy: 'Cash-Secured Put', dte: 20, qty: 1, strikes: 'P200',
        cash: 620, capital: 6000, capitalPctOfCollateral: 60, price: 210, toStrikePct: 4.8,
        earnings: { date: '2026-10-09', daysAway: 13 }, rolled: true, note: 'Rolled out and down 45->44'
    })
    const tsla = open.find(p => p.ticker === 'TSLA')
    assert.equal(tsla.toStrikePct, 3.4)
    assert.ok(!('earnings' in tsla))                      // 2026-11-20 is after the 2026-10-30 expiry
    const nvda = open.find(p => p.ticker === 'NVDA')
    assert.ok(!('toStrikePct' in nvda))                   // long-only
    const xyz = open.find(p => p.ticker === 'XYZ')
    assert.ok(!('price' in xyz) && !('toStrikePct' in xyz))
    assert.equal(JSON.stringify(open).includes('"id"'), false)
})

test('buildCoachContext: held inventory is reported as stock, not as a closed winner', async () => {
    const { buildCoachContext } = await load('/src/ai/coach-context.ts')
    const ctx = buildCoachContext(sampleInput())
    assert.deepEqual(ctx.stock, [{ ticker: 'CMCSA', shares: 100, basisPerShare: -1.64, price: 23.03, unrealizedPL: 2467.19, coverage: 'uncovered', premiumCollected: 2574, callsSold: 9 }])
    assert.ok(!ctx.recentClosed.some(t => t.pos.startsWith('CMCSA')))
    assert.deepEqual(ctx.recentClosed.slice(0, 2).map(t => t.pos.split(' ')[0]), ['AAPL', 'AAPL'])
    assert.equal(ctx.recentClosed[0].closed, '2026-09-15')
    assert.equal(ctx.recentClosed[0].exit, 'Expired')
    assert.equal(ctx.book.heldSharesUnrealizedPL, 2467.19)
})

test('buildCoachContext: ROI is left out when capital at risk is 0 (roi would read as a false 0%)', async () => {
    const { buildCoachContext } = await load('/src/ai/coach-context.ts')
    const input = sampleInput()
    input.closedTrades = [closedTrade({ id: 'z1', ticker: 'TTD', strategy: "Poor Man's Covered Call", closedDate: '2026-09-01', openedDate: '2026-01-01', realized: -1524.21, capitalAtRisk: 0, roi: 0, exitReason: 'Stop loss' }), ...input.closedTrades]
    const ttd = buildCoachContext(input).recentClosed.find(t => t.pos.startsWith('TTD'))
    assert.equal(ttd.pl, -1524.21)
    assert.ok(!('roiPct' in ttd))
    const aapl = buildCoachContext(input).recentClosed.find(t => t.pos.startsWith('AAPL'))
    assert.equal(typeof aapl.roiPct, 'number')
})

test('buildCoachContext: notes state data limits and missing prices', async () => {
    const { buildCoachContext } = await load('/src/ai/coach-context.ts')
    const { notes } = buildCoachContext(sampleInput())
    assert.ok(notes.includes('No live option prices, IV or Greeks are available.'))
    assert.ok(notes.some(n => /cached snapshots/.test(n)))
    assert.ok(notes.some(n => /1 open position\(s\) have no underlying price/.test(n)))
})

test('buildCoachContext: an empty book yields valid compact JSON without NaN or throwing', async () => {
    const { buildCoachContext } = await load('/src/ai/coach-context.ts')
    const empty = sampleInput({ closedTrades: [], openTrades: [], heldInventory: [], stats: {}, pl: {}, earnings: new Map() })
    const json = JSON.stringify(buildCoachContext(empty))
    assert.ok(!/NaN|Infinity|undefined/.test(json))
    const ctx = JSON.parse(json)
    assert.deepEqual(ctx.open, [])
    assert.deepEqual(ctx.stock, [])
    assert.deepEqual(ctx.recentClosed, [])
    assert.equal(ctx.monthly.length, 12)
    assert.ok(!('payoffRatio' in (ctx.edge ?? {})))
})

test('buildCoachContext: unlimited-risk positions stay valid JSON and are flagged', async () => {
    const { buildCoachContext } = await load('/src/ai/coach-context.ts')
    const input = sampleInput()
    input.openTrades = [openTrade({ id: 'n1', ticker: 'GME', strategy: 'Naked Call', dte: 12, quantity: 1, displayStrike: 'C30', expirationDate: '2026-10-08', cashFlow: 200, capitalAtRisk: Number.POSITIVE_INFINITY, legs: [shortLeg('CALL', 30, '2026-10-08')] })]
    const json = JSON.stringify(buildCoachContext(input))
    assert.ok(!/Infinity|NaN/.test(json))
    const pos = JSON.parse(json).open[0]
    assert.equal(pos.unlimited, true)
    assert.ok(!('capital' in pos))
})

test('serialized snapshot is compact: no indentation, no internal-only fields', async () => {
    const { buildCoachContext } = await load('/src/ai/coach-context.ts')
    const json = JSON.stringify(buildCoachContext(sampleInput({ accountSize: 50000 })))
    assert.ok(!json.includes('\n') && !json.includes('  '))
    for (const banned of ['totalMaxRisk', 'annualizedROI"', 'maxRiskLabel', 'MANUAL-MERGED', 'legacy-']) assert.ok(!json.includes(banned), banned)
})

test('gatherCoachContext pulls from the host and never throws', async () => {
    const { gatherCoachContext } = await load('/src/ai/coach-context.ts')
    const { host, closed, assignedHeld, open } = mcpHost()
    Object.assign(host, {
        accountSize: null, earningsMap: new Map(), schwab: { quoteCache: new Map() }, getCachedQuote: () => null,
        calculateAdvancedStats: () => ({ closedTradesList: [closed, assignedHeld], openTradesList: [open], assignmentStats: { assignments: [] }, collateralAtRisk: 1000 })
    })
    const json = gatherCoachContext.call(host)
    assert.equal(JSON.parse(json).asOf, '2026-09-26')
    const broken = gatherCoachContext.call({ ...host, calculateAdvancedStats: () => { throw new Error('boom') } })
    assert.deepEqual(JSON.parse(broken).notes, ['Portfolio data could not be prepared.'])
})

test('gatherCoachContext prices: Schwab quote first, then Finnhub cache, then the trade snapshot', async () => {
    const { gatherCoachContext } = await load('/src/ai/coach-context.ts')
    const { host, closed } = mcpHost()
    const leg = { type: 'PUT', strike: 100, expirationDate: '2026-12-18', quantity: 1, orderType: 'STO' }
    const mk = (id, ticker, extra = {}) => ({ id, ticker, strategy: 'Cash-Secured Put', status: 'Open', dte: 30, expirationDate: '2026-12-18', capitalAtRisk: 1000, legs: [leg], ...extra })
    const opens = [mk('a', 'AAA'), mk('b', 'BBB'), mk('c', 'CCC', { marketPriceSnapshot: 120 }), mk('d', 'DDD')]
    Object.assign(host, {
        accountSize: null, earningsMap: new Map(),
        schwab: { quoteCache: new Map([['AAA', { price: 110 }]]) },
        getCachedQuote: (t) => (t === 'AAA' ? { value: { price: 999 } } : t === 'BBB' ? { value: { price: 105 } } : null),
        calculateAdvancedStats: () => ({ closedTradesList: [closed], openTradesList: opens, assignmentStats: { assignments: [] }, collateralAtRisk: 4000 })
    })
    const open = JSON.parse(gatherCoachContext.call(host)).open
    const byTicker = Object.fromEntries(open.map(p => [p.ticker, p.price ?? null]))
    assert.deepEqual(byTicker, { AAA: 110, BBB: 105, CCC: 120, DDD: null })
})

const VEEV_QUOTE = { mark: 6.85, liquidationMark: -7.1, unrealizedPL: -65.12, spreadPct: 12.4, quoteAgeMin: 3 }

test('buildCoachContext: open positions carry the Schwab trade quote when one is cached', async () => {
    const { buildCoachContext } = await load('/src/ai/coach-context.ts')
    const ctx = buildCoachContext(sampleInput({ quoteOf: (t) => (t.ticker === 'VEEV' ? VEEV_QUOTE : null) }))
    const veev = ctx.open.find(p => p.ticker === 'VEEV')
    assert.deepEqual(veev.quote, VEEV_QUOTE)
    assert.ok(!('quote' in ctx.open.find(p => p.ticker === 'TSLA')))
    assert.ok(ctx.notes.includes('Option quotes: 1 of 4 open positions have a Schwab quote (bid/ask/mark; no Greeks or IV).'))
    assert.ok(ctx.notes.includes('No IV or Greeks are available.'))
    assert.ok(!ctx.notes.includes('No live option prices, IV or Greeks are available.'))
    assert.ok(ctx.notes.includes('1 position(s) have a bid/ask spread above 10% of their value: costly to exit.'))
})

test('buildCoachContext: held shares use the live price before the stored snapshot', async () => {
    const { buildCoachContext } = await load('/src/ai/coach-context.ts')
    const live = buildCoachContext(sampleInput({ priceOf: (ticker, trade) => (ticker === 'CMCSA' ? 25 : Number(trade?.marketPriceSnapshot) || null) }))
    assert.equal(live.stock[0].price, 25)
    const fallback = buildCoachContext(sampleInput({ priceOf: (_ticker, trade) => Number(trade?.marketPriceSnapshot) || null }))
    assert.equal(fallback.stock[0].price, 23.03)
})

test('gatherCoachContext attaches tradeQuoteCache quotes by getSchwabTradeQuoteKey', async () => {
    const { gatherCoachContext } = await load('/src/ai/coach-context.ts')
    const { host, closed } = mcpHost()
    const leg = { type: 'PUT', strike: 100, expirationDate: '2026-12-18', quantity: 1, orderType: 'STO' }
    const openTrade = { id: 'q1', ticker: 'AAA', strategy: 'Cash-Secured Put', status: 'Open', dte: 30, expirationDate: '2026-12-18', capitalAtRisk: 1000, legs: [leg] }
    const capturedAt = new Date(Date.now() - 5 * 60_000).toISOString()
    Object.assign(host, {
        accountSize: null, earningsMap: new Map(), getCachedQuote: () => null,
        getSchwabTradeQuoteKey: (t) => `key-${t.id}`,
        schwab: {
            quoteCache: new Map(),
            tradeQuoteCache: new Map([['key-q1', { netMark: 1.2, liquidationMark: -1.3, marketValue: -120, unrealizedPL: 30, legs: [{ bid: 1.1, ask: 1.3, quantity: 1, multiplier: 100 }], capturedAt }]])
        },
        calculateAdvancedStats: () => ({ closedTradesList: [closed], openTradesList: [openTrade], assignmentStats: { assignments: [] }, collateralAtRisk: 1000 })
    })
    const quote = JSON.parse(gatherCoachContext.call(host)).open[0].quote
    assert.deepEqual({ ...quote, quoteAgeMin: undefined }, { mark: 1.2, liquidationMark: -1.3, unrealizedPL: 30, spreadPct: 16.7, quoteAgeMin: undefined })
    assert.ok(quote.quoteAgeMin >= 4 && quote.quoteAgeMin <= 6)
})

// ── run ──────────────────────────────────────────────────────────────────────

let failed = 0
try {
    for (const { name, fn } of tests) {
        try { await fn(); console.log(`  ✓ ${name}`) } catch (error) { failed++; console.error(`  ✗ ${name}\n    ${error?.stack || error}`) }
    }
} finally {
    await server.close()
}
if (failed) { console.error(`\n${failed} of ${tests.length} check(s) failed.`); process.exit(1) }
console.log(`\nAll ${tests.length} checks passed.`)
