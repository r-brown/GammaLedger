// scripts/check-watchlist-scan.mjs — Watchlist scan pipeline: research staleness and collection, the saved
// research cache, the JEV pre-grade, and the ```watchlist table merge/render (Vite SSR, no network).
import assert from 'node:assert/strict'
import { createServer } from 'vite'

// localStorage stand-in (safeLocalStorage reads the global).
const store = new Map()
Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => { store.set(k, String(v)) },
        removeItem: (k) => { store.delete(k) }
    }
})

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } })
const load = (path) => server.ssrLoadModule(path)
const tests = []
const test = (name, fn) => tests.push({ name, fn })

const HOUR = 3_600_000
const DAY = 24 * HOUR
const NOW = Date.parse('2026-10-15T15:00:00Z')
const TODAY = '2026-10-15'
const okState = (over = {}) => ({
    status: { metrics: 'ok', signals: 'ok', surprises: 'ok', earnings: 'ok', profile: 'ok' },
    stamps: {}, earningsDate: '2026-10-28', hasPrice: true, ...over
})

test('researchNeeds: missing, failed, past TTL and past earnings dates are refetched; unstamped session data is fresh', async () => {
    const r = await load('/src/ai/market-research.ts')
    assert.deepEqual(r.researchNeeds(okState(), NOW, TODAY), [])
    assert.deepEqual(r.researchNeeds(okState({ hasPrice: false, status: { ...okState().status, metrics: 'missing', signals: 'error' } }), NOW, TODAY), ['quote', 'metrics', 'signals'])
    const stamps = { metrics: NOW - 25 * HOUR, signals: NOW - 2 * DAY, surprises: NOW - 15 * DAY, earnings: NOW - HOUR, profile: NOW - 31 * DAY }
    assert.deepEqual(r.researchNeeds(okState({ stamps }), NOW, TODAY), ['metrics', 'surprises', 'profile'])
    assert.deepEqual(r.researchNeeds(okState({ earningsDate: '2026-10-01' }), NOW, TODAY), ['earnings'])
    assert.deepEqual(r.researchNeeds(okState({ status: { ...okState().status, metrics: 'loading' } }), NOW, TODAY), [])
})

test('call and time estimates: signals cost three requests; time is a lower bound at the per-minute budget', async () => {
    const r = await load('/src/ai/market-research.ts')
    assert.equal(r.estimateCalls(['quote', 'metrics', 'signals', 'surprises', 'earnings', 'profile']), 8)
    assert.equal(r.estimateDurationMs(240, 60), 240_000)
    assert.equal(r.estimateDurationMs(30, 0), 30_000)                 // bad rate → 60/min
    assert.equal(r.formatDuration(200_000), '3m 20s')
    assert.equal(r.formatDuration(120_000), '2m')
    assert.equal(r.formatDuration(400), '1s')
})

const METRICS = {
    currentPrice: null, beta: 1.1, marketCap: 1000, vol3MonthStd: 30, return5Day: 1, return13Week: 5, return52Week: 12,
    week52High: 120, week52Low: 80, week52HighDate: '2026-08-01', week52LowDate: '2025-11-01', vol10DayAvg: 1, vol3MonthAvg: 1,
    priceRelToSP500_13W: 2, peTTM: 20, forwardPE: 18, forwardPEG: 1.2, pfcfTTM: 15, evFCF: 16, evEbitda: 12,
    grossMarginTTM: 50, operatingMarginTTM: 20, netMarginTTM: 15, fcfMarginLatest: null, roeTTM: 18, revenueGrowthYoY: 8,
    epsGrowthYoY: 10, currentRatio: 1.5, netDebtToEquity: 0.2, debtToEquity: 0.4, interestCoverage: 9,
    epsAnnual: [{ period: '2025-12-31', v: 4 }], peAnnualSeries: [], grossMarginSeries: [], fcfPerShareSeries: []
}
const SIGNALS = {
    recommendation: { period: '2026-10-01', strongBuy: 2, buy: 5, hold: 3, sell: 0, strongSell: 0 },
    news: [{ headline: 'H', datetime: 1, url: 'u', source: 's', summary: 'x'.repeat(1000) }],
    insiderTransactions: []
}
const SURPRISES = [{ period: '2026-06-30', quarter: 2, year: 2026, actual: 1, estimate: 0.9, surprisePercent: 11 }]
const PROFILE = { name: 'Acme', industry: 'Technology', logo: '', exchange: 'NASDAQ' }

test('research cache: round-trips through the schema, trims news, drops data older than 4× its TTL, rejects junk', async () => {
    const r = await load('/src/ai/market-research.ts')
    const entries = new Map([
        ['AAA', {
            metrics: { at: NOW - HOUR, data: METRICS }, signals: { at: NOW - HOUR, data: SIGNALS }, surprises: { at: NOW - DAY, data: SURPRISES },
            earnings: { at: NOW - HOUR, data: { date: '2026-10-28', hour: 'amc', quarter: 3, year: 2026, epsEstimate: 1.2 } }, profile: { at: NOW - DAY, data: PROFILE }
        }],
        ['NONE', { earnings: { at: NOW - HOUR, data: null } }],
        ['OLD', { metrics: { at: NOW - 5 * DAY, data: METRICS } }]
    ])
    const serialized = r.serializeResearch(entries, NOW)
    assert.deepEqual(Object.keys(serialized.tickers).sort(), ['AAA', 'NONE'])
    assert.equal(serialized.tickers.AAA.signals.data.news[0].summary.length, 280)
    const back = r.parseResearch(JSON.stringify(serialized))
    assert.deepEqual(back.get('AAA').metrics.data, METRICS)
    assert.deepEqual(back.get('AAA').earnings.data, { date: '2026-10-28', hour: 'amc', quarter: 3, year: 2026, epsEstimate: 1.2 })
    assert.equal(back.get('NONE').earnings.data, null)                 // "checked, none in 90 days" survives a reload
    assert.equal(r.parseResearch('{"version":1,"tickers":{"X":{"metrics":{"at":1,"data":{"beta":"high"}}}}}').size, 0)
    assert.equal(r.parseResearch('not json').size, 0)
    assert.equal(r.parseResearch(null).size, 0)
})

/** A host with in-memory caches and scripted Finnhub fetchers. */
function fakeHost(script = {}) {
    const calls = []
    const answer = (kind, ticker, fallback) => {
        calls.push(`${kind}:${ticker}`)
        const fn = script[kind]
        return Promise.resolve(fn ? fn(ticker) : fallback)
    }
    return {
        calls,
        currentDate: new Date(NOW),
        finnhub: { apiKey: 'k', maxRequestsPerMinute: 60 },
        schwab: { quoteCache: new Map() },
        quotes: new Map(),
        metricsCache: new Map(), signalsCache: new Map(), earningsCache: new Map(), profileCache: new Map(),
        metricsPromiseMap: new Map(), signalsPromiseMap: new Map(), earningsPromiseMap: new Map(), profilePromiseMap: new Map(),
        earningsMap: new Map(),
        researchStamps: new Map(),
        researchQuotes: new Map(),
        getCachedQuote(t) { return this.quotes.has(t) ? { value: { price: this.quotes.get(t) } } : null },
        getCurrentPrice(t) { calls.push(`quote:${t}`); return Promise.resolve({ price: 100 }) },   // the live cache expires; the collector keeps it
        fetchStockMetrics: (t) => answer('metrics', t, METRICS),
        fetchSignalsData: (t) => answer('signals', t, SIGNALS),
        fetchEarningsSurprise: (t) => answer('surprises', t, SURPRISES),
        fetchCompanyProfile: (t) => answer('profile', t, PROFILE),
        fetchEarningsDate(t) {
            calls.push(`earnings:${t}`)
            const entry = script.earnings ? script.earnings(t) : { date: '2026-10-28', hour: '', quarter: null, year: null, epsEstimate: null }
            if (entry instanceof Error) return Promise.reject(entry)
            if (entry) this.earningsMap.set(t, entry)
            return Promise.resolve(entry)
        }
    }
}

test('collectMarketResearch: fetches only what is missing, reports progress, stamps, keeps stale data on failure, saves', async () => {
    const r = await load('/src/ai/market-research.ts')
    store.clear()
    const host = fakeHost({ metrics: (t) => (t === 'BAD' ? null : METRICS), earnings: (t) => (t === 'BBB' ? null : { date: '2026-10-28', hour: '', quarter: null, year: null, epsEstimate: null }) })
    host.quotes.set('AAA', 50)
    host.metricsCache.set('AAA', METRICS)                              // fetched this session by another view: fresh
    host.metricsCache.set('BAD', { ...METRICS, beta: 9 })              // stale copy that must survive a failed refresh
    host.researchStamps.set('BAD', { metrics: NOW - 2 * DAY })
    const plan = r.planMarketResearch.call(host, ['AAA', 'bbb', 'BAD'])
    assert.deepEqual(plan.needs.get('AAA'), ['signals', 'surprises', 'earnings', 'profile'])
    assert.deepEqual(plan.needs.get('BBB'), ['quote', 'metrics', 'signals', 'surprises', 'earnings', 'profile'])
    assert.equal(plan.calls, 6 + 8 + 8)
    const progress = []
    const outcome = await r.collectMarketResearch.call(host, plan, { onProgress: (p) => progress.push(p) })
    assert.deepEqual(outcome, { done: 3, total: 3, failed: ['BAD'], stopped: false })
    assert.equal(progress[0].done, 0)
    assert.equal(progress.at(-1).done, 3)
    assert.equal(progress.at(-1).callsLeft, 0)
    assert.ok(!host.calls.includes('metrics:AAA'))
    assert.equal(host.metricsCache.get('BAD').beta, 9)                 // the failed refresh kept the old data
    assert.equal(host.researchStamps.get('BAD').metrics, NOW - 2 * DAY) // …and its old stamp, so it is retried next time
    assert.ok(host.researchStamps.get('BBB').earnings > 0)             // checked: "none in 90 days" is now known
    assert.equal(host.earningsMap.has('BBB'), false)
    assert.deepEqual(r.planMarketResearch.call(host, ['AAA', 'BBB']).needs.size, 0)
    assert.equal(r.researchQuote(host, 'BBB'), 100)                    // the fetched price outlives the 1-minute quote cache…
    assert.equal(r.researchQuote(host, 'BBB', Date.now() + r.RESEARCH_QUOTE_TTL_MS + 1), null)   // …but not forever
    const saved = JSON.parse(store.get('GammaLedgerMarketResearchCache'))
    assert.deepEqual(Object.keys(saved.tickers).sort(), ['AAA', 'BAD', 'BBB'])
    assert.equal(saved.tickers.BBB.earnings.data.date, null)

    // A reload: an empty host is filled from the saved copy with the original stamps.
    const fresh = fakeHost()
    r.hydrateMarketResearch.call(fresh)
    assert.deepEqual(fresh.metricsCache.get('BBB'), METRICS)
    assert.equal(fresh.earningsMap.get('AAA').date, '2026-10-28')
    assert.equal(fresh.researchStamps.get('BBB').earnings, host.researchStamps.get('BBB').earnings)
    fresh.quotes.set('BBB', 100)
    assert.equal(r.planMarketResearch.call(fresh, ['BBB']).calls, 0)
})

test('planMarketResearch force: ignores TTLs and cached data, and a failed forced refresh keeps the old value', async () => {
    const r = await load('/src/ai/market-research.ts')
    store.clear()
    const host = fakeHost({ metrics: (t) => (t === 'BAD' ? null : METRICS) })
    for (const t of ['AAA', 'BAD']) {
        host.quotes.set(t, 50)
        host.metricsCache.set(t, { ...METRICS, beta: 7 })
        host.signalsCache.set(t, SIGNALS)
        host.earningsCache.set(t, [])
        host.profileCache.set(t, { name: t, industry: '', logo: '', exchange: '' })
        host.earningsMap.set(t, { date: '2026-10-28', hour: '', quarter: null, year: null, epsEstimate: null })
        host.researchStamps.set(t, { metrics: NOW, signals: NOW, surprises: NOW, earnings: NOW, profile: NOW })
    }
    assert.equal(r.planMarketResearch.call(host, ['AAA', 'BAD']).needs.size, 0)   // everything fresh: nothing to do
    const forced = r.planMarketResearch.call(host, ['aaa', 'BAD'], { force: true })
    assert.deepEqual(forced.needs.get('AAA'), ['quote', 'metrics', 'signals', 'surprises', 'earnings', 'profile'])
    assert.equal(forced.calls, 2 * 8)
    const outcome = await r.collectMarketResearch.call(host, forced)
    assert.deepEqual(outcome.failed, ['BAD'])
    assert.equal(host.metricsCache.get('AAA').beta, METRICS.beta)                  // refetched
    assert.equal(host.metricsCache.get('BAD').beta, 7)                             // failed refresh kept the old data
    assert.equal(host.researchStamps.get('BAD').metrics, NOW)
})

test('collectMarketResearch: abort stops starting new tickers; the ones in flight finish', async () => {
    const r = await load('/src/ai/market-research.ts')
    store.clear()
    const host = fakeHost()
    const tickers = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6']
    const stop = new AbortController()
    const outcome = await r.collectMarketResearch.call(host, r.planMarketResearch.call(host, tickers), {
        signal: stop.signal,
        onProgress: (p) => { if (p.done === 2) stop.abort() }
    })
    assert.equal(outcome.stopped, true)
    assert.ok(outcome.done >= 2 && outcome.done < 6, `done=${outcome.done}`)
    assert.ok(!host.calls.some(c => c.endsWith(':A6')))
})

const jsonResponse = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
async function withFetch(impl, fn) {
    const calls = []
    const original = globalThis.fetch
    globalThis.fetch = async (url, init) => { calls.push({ url: String(url), init }); return impl(String(url), init, calls.length) }
    try { return await fn(calls) } finally { globalThis.fetch = original }
}
const gradeHost = (over = {}) => ({
    aiProvider: { active: 'openrouter' }, openRouter: { apiKey: 'k' }, jev: { reachable: true },
    getActiveLLMProvider: () => ({ id: 'openrouter', displayName: 'OpenRouter', isConfigured: () => true }),
    getAICoachConsent: () => ({ at: 't', provider: 'openrouter', version: 2 }),
    scanGradeCache: new Map(), ...over
})

test('JEV pre-grade: one calibrated choice per ungraded ticker, cached for the day; skipped without JEV', async () => {
    const g = await load('/src/ai/watchlist-grade.ts')
    const host = gradeHost()
    host.scanGradeCache.set(g.scanGradeCacheKey('CCC', TODAY), { quality: 'weak', confidence: 0.9 })
    const states = new Map([['AAA', { ticker: 'AAA' }], ['BBB', { ticker: 'BBB' }], ['CCC', { ticker: 'CCC' }]])
    await withFetch((url, init) => {
        const ticker = JSON.parse(init.body).state.ticker
        return jsonResponse(200, { model: 'jev', answers: { quality: { choice: ticker === 'AAA' ? 'strong' : 'mixed', confidence: 0.874, probabilities: {} } } })
    }, async (calls) => {
        const graded = await g.gradeWatchlist.call(host, states, TODAY)
        assert.equal(graded, 2)
        assert.equal(calls.length, 2)                                   // CCC was already graded today
        const body = JSON.parse(calls[0].init.body)
        assert.deepEqual(Object.keys(body.questions), ['quality'])
        assert.deepEqual(Object.keys(body.questions.quality.criteria), ['strong', 'decent', 'mixed', 'weak'])
    })
    assert.deepEqual(host.scanGradeCache.get(g.scanGradeCacheKey('AAA', TODAY)), { quality: 'strong', confidence: 0.87 })
    // Without JEV (another provider active) nothing is sent: no per-ticker LLM calls.
    const gemini = gradeHost({ aiProvider: { active: 'gemini' }, getAICoachConsent: () => ({ at: 't', provider: 'gemini', version: 2 }) })
    await withFetch(() => { throw new Error('no call expected') }, async () => {
        assert.equal(await g.gradeWatchlist.call(gemini, states, TODAY), 0)
    })
})

const MERGE = () => ({
    asOf: TODAY,
    scored: new Map([
        ['AAA', { index: 0, price: 101.5, rangePos: 54, trend: 'up', earnings: { date: '2026-10-28', daysAway: 13 }, jev: { quality: 'strong', confidence: 0.9 }, myStars: 3, watchPrice: 95 }],
        ['BBB', { index: 1, price: 20 }],
        ['CCC', { index: 2 }]
    ]),
    unscored: [{ ticker: 'ZZZ', missing: ['metrics'] }],
    previous: { asOf: '2026-10-01', rows: [{ ticker: 'AAA', stars: 3, quality: 'mixed' }, { ticker: 'BBB', stars: 2, quality: 'weak' }] }
})
const REPLY = (rows) => `**Verdict:** ok.\n\n\`\`\`watchlist\n${JSON.stringify({ rows })}\n\`\`\`\n\n### Earnings\nAAA in 13d.`

test('mergeScanTable: drops unknown and duplicate tickers, fills app facts, sorts, lists skipped tickers, marks changes', async () => {
    const t = await load('/src/ai/scan-table.ts')
    const reply = REPLY([
        { ticker: 'bbb', quality: 'Weak', stars: '2', why: 'Downtrend', price: 999 },
        { ticker: 'AAA', quality: 'decent', stars: 4, why: 'Uptrend, mid-range', level: 92, levelWhy: 'near 52w low' },
        { ticker: 'AAA', quality: 'weak', stars: 1, why: 'dup' },
        { ticker: 'NOPE', quality: 'strong', stars: 5, why: 'not sent' }
    ])
    const merged = t.mergeScanTable(reply, MERGE())
    assert.ok(merged.text.startsWith('**Verdict:** ok.'))
    assert.ok(merged.text.endsWith('### Earnings\nAAA in 13d.'))
    const { table } = merged
    assert.deepEqual(table.rows.map(r => r.ticker), ['AAA', 'BBB'])
    const [a, b] = table.rows
    assert.deepEqual(a, {
        ticker: 'AAA', quality: 'decent', stars: 4, why: 'Uptrend, mid-range', level: 92, levelWhy: 'near 52w low',
        price: 101.5, rangePos: 54, trend: 'up', earnings: { date: '2026-10-28', daysAway: 13 }, jev: { quality: 'strong', confidence: 0.9 },
        myStars: 3, watchPrice: 95, was: { stars: 3, quality: 'mixed', asOf: '2026-10-01' }
    })
    assert.equal(b.price, 20)                                           // the app's price, not the model's 999
    assert.equal(b.was, undefined)                                      // unchanged since the last scan
    assert.deepEqual(table.unscored, [{ ticker: 'ZZZ', missing: ['metrics'] }, { ticker: 'CCC', missing: ['not ranked by the model'] }])
    // The merged block parses again (re-render, follow-ups) and the splitter lifts it out of the markdown.
    const { splitChartBlocks } = await load('/src/ai/chart-blocks.ts')
    const segments = splitChartBlocks(merged.text)
    assert.deepEqual(segments.map(s => s.kind), ['md', 'scan', 'md'])
    assert.deepEqual(segments[1].table, table)
    assert.equal(t.mergeScanTable('no block here', MERGE()), null)
    assert.equal(t.mergeScanTable(REPLY([{ ticker: 'NOPE', quality: 'strong', stars: 5, why: '' }]), MERGE()), null)
    assert.equal(t.mergeScanTable('```watchlist\n{broken\n```', MERGE()), null)
})

test('maskScanBlockWhileStreaming hides the half-written JSON; a bad block falls back to a code block', async () => {
    const t = await load('/src/ai/scan-table.ts')
    assert.equal(t.maskScanBlockWhileStreaming('**Verdict:** x\n\n```watchlist\n{"rows":[{"tick'), '**Verdict:** x\n\n_Building the ranking table…_')
    assert.equal(t.maskScanBlockWhileStreaming('A\n```watchlist\n{}\n```\nB'), 'A\n_Building the ranking table…_\nB')
    const { splitChartBlocks } = await load('/src/ai/chart-blocks.ts')
    assert.deepEqual(splitChartBlocks('```watchlist\n{"rows":"x"}\n```').map(s => s.kind), ['md'])
})

/** Just enough DOM for renderScanTable (it only uses createElement, createTextNode, textContent, className, title, style). */
function fakeDocument() {
    const make = (tag) => {
        const node = { tag, children: [], className: '', title: '', style: {}, _text: '' }
        node.appendChild = (child) => { node.children.push(child); return child }
        Object.defineProperty(node, 'textContent', {
            get: () => node._text + node.children.map(c => c.textContent).join(''),
            set: (v) => { node._text = String(v); node.children = [] }
        })
        return node
    }
    return { createElement: make, createTextNode: (text) => ({ textContent: text }) }
}
const findAll = (node, pred, out = []) => { if (pred(node)) out.push(node); (node.children ?? []).forEach(c => findAll(c, pred, out)); return out }

test('renderScanTable: one row per verdict with app facts, unscored line and source caption; text only', async () => {
    const t = await load('/src/ai/scan-table.ts')
    const { table } = t.mergeScanTable(REPLY([
        { ticker: 'AAA', quality: 'decent', stars: 4, why: '<img src=x onerror=alert(1)>', level: 92, levelWhy: 'near 52w low' },
        { ticker: 'BBB', quality: 'weak', stars: 2, why: 'Downtrend' }
    ]), MERGE())
    const figure = t.renderScanTable(table, fakeDocument())
    const rows = findAll(figure, n => n.tag === 'tr' && n.className.startsWith('scan-table__row'))
    assert.equal(rows.length, 2)
    const whyRows = findAll(figure, n => n.tag === 'tr' && n.className === 'scan-table__why-row')
    assert.equal(whyRows.length, 2)
    assert.equal(whyRows[0].children[1].colSpan, 5)
    const first = rows[0].textContent + whyRows[0].textContent
    for (const part of ['AAA', '$102', '★★★★☆', 'you: 3★', 'was 3★ · Oct 1', 'Decent', 'JEV: Strong 90%', '54% · ↗ up', 'Oct 28 · 13d', 'Entry ~$92.00 (yours $95.00): near 52w low']) {
        assert.ok(first.includes(part), `row text is missing "${part}": ${first}`)
    }
    assert.ok(first.includes('<img src=x onerror=alert(1)>'))           // shown as text, never parsed as HTML
    assert.equal(findAll(figure, n => n.className === 'scan-table__warn').length, 1)   // earnings within 14 days
    assert.equal(findAll(figure, n => n.className === 'scan-table__range-dot')[0].style.left, '54%')
    assert.ok(figure.textContent.includes('Not scored (2): ZZZ (metrics) · CCC (not ranked by the model)'))
    assert.ok(rows[1].textContent.includes('you: unrated') || rows[1].textContent.includes('you:'))
})

test('scan merge input and history: the trader\'s stars and watch price come from traderInputs; history parses', async () => {
    const scan = await load('/src/ai/watchlist-scan.ts')
    const facts = {
        asOf: TODAY, summary: {}, unscored: [{ ticker: 'ZZZ', missing: ['metrics'], price: 3 }],
        entries: [{ ticker: 'AAA', price: 10, range52w: { fromHighPct: -5, fromLowPct: 30, positionPct: 77 }, trend: 'up', jev: { quality: 'decent' }, flags: [], openPositions: 1 }],
        traderInputs: [{ ticker: 'AAA', rating: 5, watchPrice: { level: 9, waitingFor: 'price at or below level', priceVsLevelPct: 11, reached: false, reachedToday: false } }]
    }
    const input = scan.scanMergeInput(facts, { version: 1, asOf: TODAY, rows: [] })
    assert.deepEqual(input.scored.get('AAA'), { index: 0, price: 10, rangePos: 77, trend: 'up', jev: { quality: 'decent', confidence: null }, myStars: 5, watchPrice: 9, openPositions: 1 })
    assert.equal(input.previous, null)                                  // a same-day rerun is not a "change since last scan"
    assert.deepEqual(input.unscored, [{ ticker: 'ZZZ', missing: ['metrics'] }])
    assert.equal(scan.parseScanHistory('{"version":1,"asOf":"2026-10-01","rows":[{"ticker":"AAA","quality":"strong","stars":5}]}').rows[0].stars, 5)
    assert.equal(scan.parseScanHistory('{"version":1,"asOf":"x","rows":[{"ticker":"AAA","quality":"great","stars":9}]}'), null)
    assert.ok(scan.progressText({ done: 3, total: 10, callsLeft: 56, etaMs: 56_000, failed: [] }, 60).includes('3 of 10 tickers · about 56s left'))
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
