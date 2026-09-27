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
