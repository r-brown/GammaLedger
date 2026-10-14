// scripts/check-ticker-context.mjs — market facts, stock scores, ticker context, Ask Coach questions (Vite SSR, no network).
import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } })
const load = (path) => server.ssrLoadModule(path)
const tests = []
const test = (name, fn) => tests.push({ name, fn })

const METRICS = {
    beta: 1.8, vol3MonthStd: 62, return5Day: -6.2, return13Week: 4.1, return52Week: -20,
    forwardPE: 12, pfcfTTM: 10, currentRatio: 2.1, debtToEquity: 0.3, roeTTM: 25, interestCoverage: 12,
    peAnnualSeries: [], peTTM: null
}

test('stock scores keep their grades and detail strings after the move', async () => {
    const s = await load('/src/calculations/stock-scores.ts')
    assert.deepEqual(s.computePreTradeRiskScore(METRICS), { grade: 'red', detail: 'β1.8 · HV62% · 5D -6.2%' })
    assert.deepEqual(s.computeAssignmentConvictionScore(METRICS), { grade: 'safe', detail: 'P/E 12× · CR 2.1 · ROE 25%' })
    assert.deepEqual(s.computeBalanceSheetScore(METRICS), { grade: 'healthy', detail: 'CR 2.1 · D/E 0.3 · IC 12×' })
    assert.deepEqual(s.computeValuationScore(METRICS), { grade: 'cheap', detail: 'Fwd P/E 12×' })
})

test('resolveTickerPrice: Schwab, then Finnhub, then snapshot; non-positive values skipped', async () => {
    const { resolveTickerPrice } = await load('/src/calculations/market-facts.ts')
    assert.deepEqual(resolveTickerPrice({ schwab: 0, finnhub: '105.5', snapshot: 99 }), { value: 105.5, source: 'finnhub' })
    assert.deepEqual(resolveTickerPrice({ schwab: 110, finnhub: 105, snapshot: 99 }), { value: 110, source: 'schwab' })
    assert.deepEqual(resolveTickerPrice({ snapshot: 99 }), { value: 99, source: 'snapshot' })
    assert.equal(resolveTickerPrice({ schwab: null, finnhub: Number.NaN, snapshot: -1 }), null)
})

const QUOTE = {
    netMark: 6.8512, liquidationMark: -7.1, marketValue: -685.12, unrealizedPL: -65.12,
    legs: [{ bid: 6.6, ask: 7.1, quantity: 1, multiplier: 100 }], capturedAt: '2026-09-27T14:00:00Z'
}

test('tradeQuoteFacts: mark, liquidation, app P&L, spread % of value, quote age', async () => {
    const { tradeQuoteFacts } = await load('/src/calculations/market-facts.ts')
    const now = Date.parse('2026-09-27T14:12:00Z')
    assert.deepEqual(tradeQuoteFacts(QUOTE, now), { mark: 6.85, liquidationMark: -7.1, unrealizedPL: -65.12, spreadPct: 7.3, quoteAgeMin: 12 })
    assert.equal(tradeQuoteFacts({ ...QUOTE, error: 'no chain' }, now), null)
    assert.equal(tradeQuoteFacts({ ...QUOTE, netMark: null }, now), null)
    assert.equal(tradeQuoteFacts(null, now), null)
    assert.equal(tradeQuoteFacts({ ...QUOTE, legs: [{ bid: null, ask: 7.1, quantity: 1, multiplier: 100 }] }, now).spreadPct, null)
})

test('targetStatus mirrors the watchlist target alert rule', async () => {
    const { targetStatus } = await load('/src/calculations/market-facts.ts')
    assert.deepEqual(targetStatus(214, 209, 210, 'up'), { met: true, crossedToday: true, priceVsTargetPct: 1.9 })
    assert.deepEqual(targetStatus(214, 212, 210, 'up'), { met: true, crossedToday: false, priceVsTargetPct: 1.9 })
    assert.deepEqual(targetStatus(200, 195, 210, 'up'), { met: false, crossedToday: false, priceVsTargetPct: -4.8 })
    assert.deepEqual(targetStatus(190, 195, 190, 'down'), { met: true, crossedToday: true, priceVsTargetPct: 0 })
    assert.equal(targetStatus(null, 195, 190, 'down'), null)
    assert.equal(targetStatus(190, null, undefined, 'up'), null)
})

test('daysBetweenIso counts calendar days', async () => {
    const { daysBetweenIso } = await load('/src/calculations/market-facts.ts')
    assert.equal(daysBetweenIso('2026-06-01', '2026-09-27'), 118)
    assert.equal(daysBetweenIso('2026-09-27', '2026-09-27'), 0)
})

const NOW = new Date('2026-09-27T15:00:00Z')
const SIGNALS = {
    recommendation: { period: '2026-09-01', strongBuy: 3, buy: 7, hold: 5, sell: 1, strongSell: 0 },
    news: [1, 2, 3, 4].map(i => ({ headline: `Headline ${i} ${'x'.repeat(150)}`, datetime: 0, url: '', source: '', summary: 'long body' })),
    insiderTransactions: [
        { transactionType: 'Sell', transactionCode: 'S', isDerivative: false, name: 'A', share: 10, value: 1, filingDate: '2026-09-01' },
        { transactionType: 'Sell', transactionCode: 'S', isDerivative: false, name: 'B', share: 10, value: 1, filingDate: '2026-08-15' },
        { transactionType: 'Buy', transactionCode: 'P', isDerivative: false, name: 'C', share: 10, value: 1, filingDate: '2026-02-01' },
        { transactionType: 'Buy', transactionCode: 'A', isDerivative: false, name: 'D', share: 10, value: 1, filingDate: '2026-09-10' }
    ]
}
const SURPRISES = [
    { period: '2026-06-30', quarter: 2, year: 2026, actual: 1, estimate: 0.9, surprisePercent: 11 },
    { period: '2026-03-31', quarter: 1, year: 2026, actual: 1, estimate: 1.1, surprisePercent: -9 },
    { period: '2025-12-31', quarter: 4, year: 2025, actual: 1, estimate: 0.9, surprisePercent: 4 },
    { period: '2025-09-30', quarter: 3, year: 2025, actual: 1, estimate: 0.9, surprisePercent: 2 },
    { period: '2025-06-30', quarter: 2, year: 2025, actual: 1, estimate: 0.9, surprisePercent: 9 }
]
const TRADE = {
    id: 'o1', ticker: 'VEEV', strategy: 'Cash-Secured Put', status: 'Open', dte: 20, displayStrike: 'P210', expirationDate: '2026-10-16',
    cashFlow: 620, capitalAtRisk: 14305, marketPriceSnapshot: 200,
    legs: [{ type: 'PUT', strike: 210, expirationDate: '2026-10-16', quantity: 1, orderType: 'STO' }]
}
const ENTRY = { ticker: 'VEEV', rating: 4, notes: '  Wait for a pullback under $190 before selling puts.  ', targetPrice: 190, targetDirection: 'down', tags: ['wheel'], addedDate: '2026-06-01' }
const baseInput = (over = {}) => ({
    ticker: 'VEEV', now: NOW, prices: { schwab: null, finnhub: 214.3, snapshot: 200 }, previousClose: 212,
    metrics: METRICS, signals: SIGNALS, earningsSurprises: SURPRISES, upcomingEarningsDate: '2026-10-09',
    trade: null, tradeClosed: false, tradeQuote: null, watchlistEntry: null, aiRead: null, ...over
})

test('buildTickerContext: price source, momentum, scores and pre-counted signals', async () => {
    const { buildTickerContext } = await load('/src/ai/ticker-context.ts')
    const ctx = buildTickerContext(baseInput())
    assert.equal(ctx.asOf, '2026-09-27')
    assert.equal(ctx.price, 214.3)
    assert.equal(ctx.priceSource, 'finnhub')
    assert.deepEqual(ctx.momentum, { d5Pct: -6.2, w13Pct: 4.1, w52Pct: -20 })
    assert.equal(ctx.scores.risk.grade, 'red')
    assert.equal(ctx.scores.valuation.detail, 'Fwd P/E 12×')
    assert.deepEqual(ctx.signals.analyst, { buy: 10, hold: 5, sell: 1 })
    assert.equal(ctx.signals.insiderNet90d, 'selling')          // 2 open-market sales in 90 days; the P buy is older, the A grant ignored
    assert.equal(ctx.signals.earningsBeatsLast4, 3)             // latest four quarters: +11, -9, +4, +2
    assert.equal(ctx.signals.headlines.length, 3)
    assert.ok(ctx.signals.headlines.every(h => h.length <= 120))
    assert.equal(ctx.position, null)
    assert.equal(ctx.watchlist, null)
    assert.deepEqual(ctx.nextEarnings, { date: '2026-10-09', daysAway: 12 })
    assert.equal(ctx.range52w, null)                             // no 52-week high/low in these metrics
    const past = buildTickerContext(baseInput({ upcomingEarningsDate: '2026-09-01' }))
    assert.equal(past.nextEarnings, null)                        // a past date is stale, not "next"
    const ranged = buildTickerContext(baseInput({ metrics: { ...METRICS, week52High: 250, week52Low: 150 } }))
    assert.deepEqual(ranged.range52w, { fromHighPct: -14.3, fromLowPct: 42.9 })
})

test('buildTickerContext: position facts with the Schwab quote and earnings inside its life', async () => {
    const { buildTickerContext } = await load('/src/ai/ticker-context.ts')
    const quote = { netMark: 6.85, liquidationMark: -7.1, marketValue: -685, unrealizedPL: -65, legs: [{ bid: 6.6, ask: 7.1, quantity: 1, multiplier: 100 }], capturedAt: '2026-09-27T14:50:00Z' }
    const ctx = buildTickerContext(baseInput({ trade: TRADE, tradeQuote: quote }))
    assert.deepEqual(ctx.position, {
        pos: 'VEEV CSP P210 2026-10-16', status: 'open', dte: 20, strikes: 'P210', cash: 620, capitalAtRisk: 14305,
        toStrikePct: 2, earningsInLife: { date: '2026-10-09', daysAway: 12 },
        quote: { mark: 6.85, liquidationMark: -7.1, unrealizedPL: -65, spreadPct: 7.3, quoteAgeMin: 10 }
    })
    const closed = buildTickerContext(baseInput({ trade: { ...TRADE, status: 'Closed' }, tradeClosed: true }))
    assert.equal(closed.position.status, 'closed')
    assert.equal(closed.position.quote, null)
})

test('buildTickerContext: watchlist facts are pre-computed (days, watch-price distance, reached today)', async () => {
    const { buildTickerContext } = await load('/src/ai/ticker-context.ts')
    const ctx = buildTickerContext(baseInput({ watchlistEntry: ENTRY, prices: { finnhub: 188 }, previousClose: 192 }))
    assert.deepEqual(ctx.watchlist, {
        rating: 4, thesis: 'Wait for a pullback under $190 before selling puts.', tags: ['wheel'], daysSinceAdded: 118,
        watchPrice: { level: 190, waitingFor: 'price at or below level', priceVsLevelPct: -1.1, reached: true, reachedToday: true }
    })
})

test('tickerContextJson is compact, drops nulls and carries no trade IDs', async () => {
    const { buildTickerContext, tickerContextJson } = await load('/src/ai/ticker-context.ts')
    const json = tickerContextJson(buildTickerContext(baseInput({ trade: TRADE, metrics: null })))
    assert.ok(!json.includes('\n') && !json.includes('  '))
    assert.ok(!json.includes('"scores"'))
    assert.ok(!json.includes('"o1"'))
})

test('Ask Coach questions: open, closed and watchlist variants with a short display label', async () => {
    const t = await load('/src/ai/ticker-context.ts')
    const open = t.buildPositionAskQuestion(t.buildTickerContext(baseInput({ trade: TRADE })))
    assert.equal(open.display, 'Ask about VEEV CSP P210 2026-10-16')
    assert.ok(open.request.startsWith('Analyze this position. Say whether to hold, roll or close it, and why.'))
    assert.ok(open.request.includes('"pos":"VEEV CSP P210 2026-10-16"'))
    const closed = t.buildPositionAskQuestion(t.buildTickerContext(baseInput({ trade: { ...TRADE, status: 'Closed' }, tradeClosed: true })))
    assert.ok(closed.request.startsWith('Review this closed trade:'))
    const wl = t.buildWatchlistAskQuestion(t.buildTickerContext(baseInput({ watchlistEntry: ENTRY })))
    assert.equal(wl.display, 'Ask about VEEV (watchlist)')
    assert.ok(wl.request.startsWith('Give me an honest, independent assessment of VEEV'))
    assert.ok(wl.request.includes('not a bullish or bearish view'))
    // The analysis block carries market facts only; the trader's own inputs come after it.
    const [factsPart, inputsPart] = wl.request.split('MY INPUTS (use only in step 5):\n')
    assert.ok(factsPart.includes('MARKET FACTS'))
    assert.ok(factsPart.includes('"nextEarnings":{"date":"2026-10-09","daysAway":12}'))
    for (const leak of ['watchPrice', 'waitingFor', 'rating', 'Wait for a pullback', '"level":190']) {
        assert.ok(!factsPart.split('MARKET FACTS (compact JSON computed by GammaLedger):\n')[1].includes(leak), `${leak} leaked into the market facts`)
    }
    assert.ok(inputsPart.includes('"thesis":"Wait for a pullback under $190 before selling puts."'))
    assert.ok(inputsPart.includes('"waitingFor":"price at or below level"'))
    assert.ok(inputsPart.includes('"rating":4'))
    assert.ok(!wl.request.includes('has not reached my watch price') && !wl.request.includes('has reached my watch price'))
    const reached = t.buildWatchlistAskQuestion(t.buildTickerContext(baseInput({ watchlistEntry: ENTRY, prices: { finnhub: 188 } })))
    assert.ok(reached.request.startsWith('Give me an honest, independent assessment of VEEV'))   // same question wherever the price is
    const noLevel = t.buildWatchlistAskQuestion(t.buildTickerContext(baseInput({ watchlistEntry: { ...ENTRY, targetPrice: null } })))
    assert.ok(!noLevel.request.includes('"watchPrice"'))
    assert.ok(noLevel.request.includes('propose one if I have none'))
})

const scanInput = (t, entry, over = {}) => ({
    ctx: t.buildTickerContext(baseInput({ ticker: entry.ticker, watchlistEntry: entry, ...over.ctx })),
    earningsDate: null, drift: null, openPositions: 0, ...over.scan
})

test('watchlist scan: neutral market facts, trader inputs last, cap blind to watch price and rating', async () => {
    const t = await load('/src/ai/ticker-context.ts')
    const scan = await load('/src/ai/watchlist-scan.ts')
    const far = { ...ENTRY, ticker: 'FAR', rating: 5 }                                  // 214.3 vs 190 down: waiting
    const hit = { ...ENTRY, ticker: 'HIT', rating: 2 }                                  // 188 ≤ 190: reached today (prev 212)
    const near = { ...ENTRY, ticker: 'NEAR', rating: null, notes: '', targetPrice: 210 } // 214.3 is +2% above 210
    const bare = { ticker: 'BARE', rating: null, notes: '', addedDate: '2026-01-02' }
    const rangedMetrics = { ...METRICS, week52High: 250, week52Low: 150 }
    const facts = scan.buildWatchlistScanFacts([
        scanInput(t, far, { ctx: { metrics: rangedMetrics }, scan: { earningsDate: '2026-10-05', drift: { drifted: true, probability: 0.812 }, openPositions: 2 } }),
        scanInput(t, hit, { ctx: { prices: { finnhub: 188 } } }),
        scanInput(t, near),
        scanInput(t, bare, { ctx: { prices: {}, metrics: null, signals: null } })
    ], '2026-09-27')
    // The trader's list order is kept: neither a reached watch price nor a 5-star rating moves an entry.
    assert.deepEqual(facts.entries.map(e => e.ticker), ['FAR', 'HIT', 'NEAR', 'BARE'])
    const [f, h, n, b] = facts.entries
    assert.deepEqual(f.flags, ['thesis may no longer fit', 'earnings in 8d', 'already 2 open positions'])
    assert.deepEqual(f.thesisDrift, { flagged: true, probability: 0.81 })
    assert.deepEqual(f.nextEarnings, { date: '2026-10-05', daysAway: 8 })
    assert.deepEqual(f.range52w, { fromHighPct: -14.3, fromLowPct: 42.9 })
    assert.deepEqual(f.scores, { risk: 'red', own: 'safe', balanceSheet: 'healthy', valuation: 'cheap' })
    assert.equal(f.insiderNet90d, 'selling')
    assert.equal(f.earningsBeatsLast4, 3)
    assert.deepEqual(h.flags, [])                                                       // no "watch price reached" flag any more
    assert.deepEqual(n.flags, [])
    assert.deepEqual(b.flags, ['no current price'])
    assert.equal(b.price, undefined)
    for (const entry of facts.entries) {
        for (const key of ['rating', 'watchPrice', 'thesis', 'tags', 'daysSinceAdded']) assert.ok(!(key in entry), `${key} must not be in entries`)
    }
    assert.deepEqual(facts.summary, { watched: 4, sent: 4, omitted: 0, earningsWithin14d: 1, thesisDriftFlagged: 1, noPrice: 1 })

    // Trader inputs sit in their own block, in the same order, with their gaps named.
    assert.deepEqual(facts.traderInputs.map(i => i.ticker), ['FAR', 'HIT', 'NEAR', 'BARE'])
    const [tf, th, tn, tb] = facts.traderInputs
    assert.equal(tf.rating, 5)
    assert.equal(tf.watchPrice.waitingFor, 'price at or below level')
    assert.equal(th.watchPrice.reachedToday, true)
    assert.equal(tn.watchPrice.priceVsLevelPct, 2)
    assert.deepEqual(tn.gaps, ['rating', 'thesis'])
    assert.deepEqual(tb.gaps, ['rating', 'watch price', 'thesis'])

    const json = scan.watchlistScanJson(facts)
    assert.ok(!json.includes('null'))
    assert.ok(json.indexOf('"traderInputs"') > json.indexOf('"entries"'))               // listed last on purpose

    // Cap: drops by blind rank (flagged drift / earnings kept, no-price dropped first), stays in list order.
    const many = Array.from({ length: scan.MAX_SCAN_ENTRIES + 3 }, (_, i) => scanInput(t, { ...ENTRY, ticker: `T${i}`, rating: i === 0 ? 5 : null }))
    const capped = scan.buildWatchlistScanFacts(many, '2026-09-27')
    assert.equal(capped.entries.length, scan.MAX_SCAN_ENTRIES)
    assert.equal(capped.traderInputs.length, scan.MAX_SCAN_ENTRIES)
    assert.equal(capped.summary.omitted, 3)
    assert.deepEqual(capped.entries.map(e => e.ticker), many.slice(0, scan.MAX_SCAN_ENTRIES).map(i => i.ctx.ticker))
})

test('watchlist scan prompt: independent review layout wraps the facts; the agent keeps its prompt type', async () => {
    const p = await load('/src/ai/coach-prompts.ts')
    const prompt = p.buildCoachRequestPrompt('watchlist_scan', 'WATCHLIST FACTS (compact JSON computed by GammaLedger):\n{"entries":[]}')
    assert.ok(prompt.startsWith('Task: watchlist review'))
    for (const heading of ['### Ranking', '### Earnings and entry levels', '### Add, remove, keep', '### Look at now']) assert.ok(prompt.includes(heading), heading)
    assert.ok(prompt.includes('Suggested ★'))
    assert.ok(prompt.includes('traderInputs, listed last on purpose'))
    assert.ok(prompt.includes('The watch price and rating are not evidence'))
    assert.ok(prompt.includes('never that there is no earnings event'))
    assert.ok(!prompt.includes('Actionable means'))
    assert.ok(prompt.endsWith('{"entries":[]}'))
})

const ROW = (over = {}) => ({
    tradeId: 'T1', ticker: 'VEEV', strategy: 'Cash-Secured Put', dte: 19, shortStrike: 210, flavor: 'put', spot: 214.3,
    isShortPremium: true, netCredit: 620, unrealizedPL: 100, earnings: null, spreadPct: null, uncoveredShares: false, ...over
})

test('attention rules: every finding carries a reason and a next step; worst first; dot takes the worst', async () => {
    const { evaluateAttention } = await load('/src/calculations/attention.ts')
    const [item] = evaluateAttention([ROW({ spot: 200, earnings: { date: '2026-10-09', daysAway: 12 }, spreadPct: 14 })])
    assert.equal(item.severity, 3)
    assert.deepEqual(item.findings.map(f => [f.severity, f.reason]), [
        [3, 'short 210P ITM by $10.00'],
        [1, 'past the 21-DTE management point (19 DTE)'],
        [1, 'earnings 2026-10-09 (in 12d), before expiry'],
        [1, "bid/ask 14% of the position's value"]
    ])
    assert.ok(item.findings.every(f => f.action.length > 20))
    assert.match(item.findings[0].action, /roll down and out for a net credit/)
    assert.deepEqual(item.reasons, item.findings.map(f => f.reason))
})

test('attention rules: earnings inside 7 days is "look today"; after expiry or past it is ignored; uncovered shares', async () => {
    const { evaluateAttention } = await load('/src/calculations/attention.ts')
    const calm = { dte: 40, unrealizedPL: 0 }
    assert.equal(evaluateAttention([ROW({ ...calm, earnings: { date: '2026-10-01', daysAway: 4 } })])[0].severity, 2)
    assert.deepEqual(evaluateAttention([ROW({ ...calm, earnings: { date: '2026-12-01', daysAway: 65 } })]), [])
    assert.deepEqual(evaluateAttention([ROW({ ...calm, spreadPct: 9 })]), [])
    const [shares] = evaluateAttention([ROW({ ...calm, shortStrike: null, isShortPremium: false, uncoveredShares: true })])
    assert.deepEqual(shares.findings.map(f => [f.severity, f.reason]), [[1, 'shares without a covered call']])
    assert.match(shares.findings[0].action, /covered call/)
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
