// scripts/check-decision.mjs — typed decisions: JEV client, LLM adapter, registry and the AI features on top (Vite SSR, no network).
import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } })
const load = (path) => server.ssrLoadModule(path)
const tests = []
const test = (name, fn) => tests.push({ name, fn })

const jsonResponse = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
/** Replaces globalThis.fetch for the duration of fn; records calls. */
async function withFetch(impl, fn) {
    const calls = []
    const original = globalThis.fetch
    globalThis.fetch = async (url, init) => { calls.push({ url: String(url), init }); return impl(String(url), init, calls.length) }
    try { return await fn(calls) } finally { globalThis.fetch = original }
}
const rejectsKind = async (promise, kind) => {
    await assert.rejects(promise, (error) => { assert.equal(error.name, 'LLMError'); assert.equal(error.kind, kind); return true })
}

const Q = {
    read: { type: 'choice', instructions: 'How does it look?', criteria: { bullish: 'good', neutral: 'mixed', bearish: 'bad' } },
    urgency: { type: 'score', instructions: 'How urgent?', criteria: ['Fine', 'Watch', 'Act'] },
    drift: { type: 'noul', instructions: 'Thesis no longer fits', criteria: { true: 'contradicted', false: 'consistent' } }
}
const JEV_OK = {
    model: 'jev-1.13.0',
    answers: {
        read: { type: 'choice', choice: 'bullish', confidence: 0.62, probabilities: { bullish: 0.7, neutral: 0.2, bearish: 0.1 } },
        urgency: { type: 'score', score: 1.2, confidence: 0.55, probabilities: { 0: 0.1, 1: 0.6, 2: 0.3 } },
        drift: { type: 'noul', noul: 0.81 }
    },
    usage: { input_tokens: 1000, output_tokens: 3 }
}

test('JEV request: endpoint, Bearer key, body {state, questions, model}', async () => {
    const { createJevProvider } = await load('/src/integrations/decision/jev.ts')
    await withFetch(() => jsonResponse(200, JEV_OK), async (calls) => {
        const result = await createJevProvider({ jev: { apiKey: ' ts-key ' } }).decide({ state: { ticker: 'VEEV' }, questions: Q })
        assert.equal(calls[0].url, 'https://api.typesafe.ai/v1/systemone')
        assert.equal(calls[0].init.headers.Authorization, 'Bearer ts-key')
        assert.deepEqual(JSON.parse(calls[0].init.body), { state: { ticker: 'VEEV' }, questions: Q, model: 'jev-latest' })
        assert.equal(result.engine, 'jev')
        assert.equal(result.calibrated, true)
        assert.equal(result.answers.read.choice, 'bullish')
        assert.equal(result.answers.drift.noul, 0.81)
        assert.equal(result.usage.costUsd, 1000 * 0.042 / 1e6)
    })
})

test('JEV errors: 401 auth, 429 rate_limit, missing answer and bad JSON are bad_response, no key is missing_key', async () => {
    const { createJevProvider } = await load('/src/integrations/decision/jev.ts')
    const jev = createJevProvider({ jev: { apiKey: 'k' } })
    await withFetch(() => jsonResponse(401, { error: { message: 'bad key' } }), () => rejectsKind(jev.decide({ state: {}, questions: Q }), 'auth'))
    await withFetch(() => jsonResponse(429, { message: 'slow down' }), () => rejectsKind(jev.decide({ state: {}, questions: Q }), 'rate_limit'))
    await withFetch(() => jsonResponse(200, { ...JEV_OK, answers: { read: JEV_OK.answers.read } }), () => rejectsKind(jev.decide({ state: {}, questions: Q }), 'bad_response'))
    await withFetch(() => jsonResponse(200, { model: 'x', answers: { read: { type: 'choice', choice: 1 } } }), () => rejectsKind(jev.decide({ state: {}, questions: Q }), 'bad_response'))
    await rejectsKind(createJevProvider({ jev: { apiKey: '' } }).decide({ state: {}, questions: Q }), 'missing_key')
})

test('LLM adapter: schema per question type, uncalibrated answers', async () => {
    const { createLlmDecisionProvider, buildDecisionSchema } = await load('/src/integrations/decision/llm-adapter.ts')
    const schema = buildDecisionSchema(Q)
    assert.deepEqual(schema.required, ['read', 'urgency', 'drift'])
    assert.deepEqual(schema.properties.read.properties.choice.enum, ['bullish', 'neutral', 'bearish'])
    assert.equal(schema.properties.urgency.properties.level.maximum, 2)
    assert.equal(schema.properties.drift.properties.answer.type, 'boolean')
    const requests = []
    const llm = {
        id: 'openrouter', displayName: 'OpenRouter', isConfigured: () => true, activeModel: () => 'm', modelLabel: (m) => m,
        capabilities: () => ({ vision: true, structuredOutput: true, maxOutputTokens: null }), prepare: async () => {},
        complete: async (r) => { requests.push(r); return { text: '{"read":{"choice":"neutral"},"urgency":{"level":2},"drift":{"answer":true}}', provider: 'openrouter', model: 'vendor/m', usage: { inputTokens: 50, outputTokens: 5, costUsd: 0.001 } } }
    }
    const result = await createLlmDecisionProvider(llm).decide({ state: { a: 1 }, questions: Q })
    assert.equal(requests[0].responseSchema.name, 'typed_decisions')
    assert.equal(requests[0].temperature, 0)
    assert.equal(result.calibrated, false)
    assert.deepEqual(result.answers.read, { type: 'choice', choice: 'neutral', confidence: null, probabilities: { bullish: 0, neutral: 1, bearish: 0 } })
    assert.deepEqual(result.answers.urgency, { type: 'score', score: 2, confidence: null, probabilities: { 2: 1 } })
    assert.deepEqual(result.answers.drift, { type: 'noul', noul: 1 })
})

test('LLM adapter rejects an out-of-set choice as bad_response', async () => {
    const { parseAdapterAnswers } = await load('/src/integrations/decision/llm-adapter.ts')
    assert.throws(() => parseAdapterAnswers(Q, '{"read":{"choice":"moon"},"urgency":{"level":0},"drift":{"answer":false}}'), (e) => e.kind === 'bad_response')
})

test('resolveDecisionEngine: consent v2 required; JEV only with jev consent and reachable', async () => {
    const { resolveDecisionEngine } = await load('/src/integrations/decision/registry.ts')
    const v2 = { at: 't', provider: 'openrouter', version: 2, decision: 'jev' }
    const base = { consent: v2, activeLlm: 'openrouter', llmConfigured: true, jevConfigured: true, jevReachable: true }
    assert.equal(resolveDecisionEngine(base), 'jev')
    assert.equal(resolveDecisionEngine({ ...base, jevReachable: false }), 'llm')
    assert.equal(resolveDecisionEngine({ ...base, consent: { ...v2, decision: null } }), 'llm')
    assert.equal(resolveDecisionEngine({ ...base, jevConfigured: false, llmConfigured: false }), null)
    assert.equal(resolveDecisionEngine({ ...base, consent: { at: 't', provider: 'openrouter' } }), null)   // v1
    assert.equal(resolveDecisionEngine({ ...base, consent: null }), null)
})

test('decideWithFallback: a JEV network failure marks it unreachable and answers via the LLM adapter', async () => {
    const { decideWithFallback } = await load('/src/integrations/decision/registry.ts')
    const llm = {
        id: 'openrouter', displayName: 'OpenRouter', isConfigured: () => true, activeModel: () => 'm', modelLabel: (m) => m,
        capabilities: () => ({ vision: true, structuredOutput: true, maxOutputTokens: null }), prepare: async () => {},
        complete: async () => ({ text: '{"drift":{"answer":false}}', provider: 'openrouter', model: 'm', usage: null })
    }
    const ctx = {
        aiProvider: { active: 'openrouter' }, jev: { apiKey: 'k', reachable: true },
        getActiveLLMProvider: () => llm, getAICoachConsent: () => ({ at: 't', provider: 'openrouter', version: 2, decision: 'jev' })
    }
    await withFetch(() => { throw new TypeError('Failed to fetch') }, async () => {
        const result = await decideWithFallback(ctx, { state: {}, questions: { drift: Q.drift } })
        assert.equal(result.engine, 'llm')
        assert.equal(ctx.jev.reachable, false)
    })
})

test('confidenceBand follows TypeSafe thresholds', async () => {
    const { confidenceBand } = await load('/src/integrations/decision/types.ts')
    assert.equal(confidenceBand(0.95), 'high')
    assert.equal(confidenceBand(0.9), 'medium')
    assert.equal(confidenceBand(0.5), 'medium')
    assert.equal(confidenceBand(0.49), 'low')
    assert.equal(confidenceBand(null), null)
})

test('JevConfigSchema: encrypted payload or plaintext fallback, version 1, strict', async () => {
    const { parseJevConfig } = await load('/src/integrations/jev.ts')
    assert.deepEqual(parseJevConfig(JSON.stringify({ version: 1, payload: { iv: 'a', ct: 'b' } })), { version: 1, payload: { iv: 'a', ct: 'b' } })
    assert.deepEqual(parseJevConfig(JSON.stringify({ version: 1, apiKey: 'k' })), { version: 1, apiKey: 'k' })
    assert.equal(parseJevConfig(JSON.stringify({ version: 1, apiKey: 'k', extra: 1 })), null)
    assert.equal(parseJevConfig('not json'), null)
    assert.equal(parseJevConfig(null), null)
})

test('AI Read: state excludes position/watchlist; JEV below 0.5 confidence reads "mixed"', async () => {
    const { buildAIReadState, toAIReadView, AI_READ_QUESTIONS, aiReadCacheKey } = await load('/src/ai/ai-read.ts')
    assert.deepEqual(Object.keys(AI_READ_QUESTIONS.read.criteria), ['bullish', 'neutral', 'bearish'])
    const state = buildAIReadState({ ticker: 'VEEV', asOf: '2026-09-27', price: 214, priceSource: 'finnhub', momentum: { d5Pct: 1, w13Pct: 2, w52Pct: 3 }, scores: { risk: { grade: 'green', detail: 'x' } }, signals: { headlines: ['h'] }, position: { pos: 'p' }, watchlist: { thesis: 't' }, aiRead: null })
    assert.deepEqual(Object.keys(state).sort(), ['asOf', 'momentum', 'price', 'scores', 'signals', 'ticker'])
    const jev = (confidence) => ({ engine: 'jev', calibrated: true, model: 'jev-1', usage: {}, answers: { read: { type: 'choice', choice: 'bullish', confidence, probabilities: { bullish: 0.45, neutral: 0.35, bearish: 0.2 } } } })
    assert.equal(toAIReadView(jev(0.3), '2026-09-27').display, 'mixed')
    assert.equal(toAIReadView(jev(0.3), '2026-09-27').band, 'low')
    const clear = toAIReadView(jev(0.93), '2026-09-27')
    assert.deepEqual({ grade: clear.grade, display: clear.display, band: clear.band }, { grade: 'bullish', display: 'bullish', band: 'high' })
    const llm = toAIReadView({ ...jev(null), engine: 'llm', calibrated: false }, '2026-09-27')
    assert.deepEqual({ display: llm.display, band: llm.band, confidence: llm.confidence }, { display: 'bullish', band: null, confidence: null })
    assert.equal(aiReadCacheKey('veev', '2026-09-27', 'jev'), 'VEEV|2026-09-27|jev')
})

test('drift: state only for a non-empty thesis; hash changes with the notes; 0.7 threshold', async () => {
    const d = await load('/src/ai/watchlist-drift.ts')
    const ctx = (thesis) => ({ ticker: 'VEEV', asOf: '2026-09-27', price: 214, scores: null, signals: null, momentum: null, position: null, aiRead: null, watchlist: thesis === null ? null : { thesis, targetMet: false, priceVsTargetPct: 12.6, daysSinceAdded: 118 } })
    assert.equal(d.buildDriftState(ctx('   ')), null)
    assert.equal(d.buildDriftState(ctx(null)), null)
    assert.deepEqual(Object.keys(d.buildDriftState(ctx('Wait for a pullback'))).sort(), ['asOf', 'price', 'ticker', 'watchlist'])
    assert.notEqual(d.notesHash('a'), d.notesHash('b'))
    assert.equal(d.notesHash('a'), d.notesHash('a'))
    assert.equal(d.driftCacheKey('veev', 'a', '2026-09-27'), `VEEV|${d.notesHash('a')}|2026-09-27`)
    const res = (noul, engine = 'jev') => ({ engine, calibrated: engine === 'jev', model: 'm', usage: {}, answers: { drift: { type: 'noul', noul } } })
    assert.equal(d.toDriftView(res(0.81), '2026-09-27').drifted, true)
    assert.equal(d.toDriftView(res(0.69), '2026-09-27').drifted, false)
    assert.equal(d.toDriftView(res(0.81), '2026-09-27').band, 'medium')   // |0.81 − 0.5| × 2 = 0.62
    assert.equal(d.toDriftView(res(1, 'llm'), '2026-09-27').band, null)
    assert.equal(d.DRIFT_QUESTIONS.drift.type, 'noul')
})

const RULE = (tradeId, severity, reasons, dte) => ({ tradeId, ticker: tradeId.split('-')[0], strategy: 'Cash-Secured Put', severity, dte, reasons })
const DIGEST_TRADES = [
    { tradeId: 'VEEV-1', ticker: 'VEEV', label: 'VEEV CSP P210 2026-10-16', dte: 20, rule: RULE('VEEV-1', 2, ['spot within 2% of short 210P'], 20), earningsInLife: { date: '2026-10-09', daysAway: 12 }, spreadPct: 7 },
    { tradeId: 'TSLA-1', ticker: 'TSLA', label: 'TSLA BCS C300/310 2026-10-30', dte: 34, rule: RULE('TSLA-1', 3, ['short 300C ITM by $4.10'], 34), earningsInLife: null, spreadPct: 14 },
    { tradeId: 'NVDA-1', ticker: 'NVDA', label: 'NVDA Long Call C150 2026-12-18', dte: 83, rule: null, earningsInLife: null, spreadPct: null },
    { tradeId: 'XYZ-1', ticker: 'XYZ', label: 'XYZ CSP P50 2026-10-01', dte: 4, rule: RULE('XYZ-1', 2, ['expires in 4d'], 4), earningsInLife: null, spreadPct: null },
    { tradeId: 'AMD-1', ticker: 'AMD', label: 'AMD CSP P140 2026-11-20', dte: 54, rule: null, earningsInLife: { date: '2026-10-01', daysAway: 4 }, spreadPct: null }
]
const DIGEST_STOCK = [{ ticker: 'CMCSA', coverage: 'uncovered' }, { ticker: 'KO', coverage: 'covered' }]

test('selectAttentionItems: the table rules plus earnings, wide spread and uncovered shares, by severity then DTE', async () => {
    const { selectAttentionItems } = await load('/src/ai/attention.ts')
    const items = selectAttentionItems(DIGEST_TRADES, DIGEST_STOCK)
    assert.deepEqual(items.map(i => [i.ticker, i.severity, i.reasons.map(r => r.kind)]), [
        ['TSLA', 3, ['rule', 'wide-spread']],
        ['XYZ', 2, ['rule']],                       // equal severity: nearer expiry first
        ['VEEV', 2, ['rule', 'earnings']],          // earnings 12 days out adds a reason, not severity
        ['AMD', 2, ['earnings']],                   // earnings in 4 days lifts it to "look today"
        ['CMCSA', 1, ['uncovered-shares']]
    ])
    assert.equal(items[0].reasons[0].text, 'short 300C ITM by $4.10')   // the table dot's own wording
    assert.ok(items.every(i => i.urgency === null))
    assert.deepEqual(selectAttentionItems([], []), [])
})

test('urgency: one score question per item (max 10), pre-computed reasons only, ordering by JEV score', async () => {
    const { selectAttentionItems, buildUrgencyRequest, orderByUrgency } = await load('/src/ai/attention.ts')
    const items = selectAttentionItems(DIGEST_TRADES, DIGEST_STOCK)
    const request = buildUrgencyRequest(items)
    assert.deepEqual(Object.keys(request.questions), ['item_0', 'item_1', 'item_2', 'item_3', 'item_4'])
    assert.deepEqual(request.questions.item_0.criteria, ['Fine for now', 'Watch this week', 'Act before expiry'])
    assert.deepEqual(request.state.items[0], { position: 'TSLA BCS C300/310 2026-10-30', reasons: ['short 300C ITM by $4.10', 'bid/ask 14% of value: costly to exit'], dte: 34 })
    const many = Array.from({ length: 14 }, (_, i) => ({ ...items[0], key: `k${i}` }))
    assert.equal(Object.keys(buildUrgencyRequest(many).questions).length, 10)
    const score = (s) => ({ type: 'score', score: s, confidence: 0.9, probabilities: {} })
    const result = { engine: 'jev', calibrated: true, model: 'm', usage: {}, answers: { item_0: score(0.4), item_1: score(1.9), item_2: score(1.1), item_3: score(1.1), item_4: score(0.2) } }
    assert.deepEqual(orderByUrgency(items, result).map(i => [i.ticker, i.urgency]), [['XYZ', 1.9], ['VEEV', 1.1], ['AMD', 1.1], ['TSLA', 0.4], ['CMCSA', 0.2]])
})

test('decideWithFallback jevOnly: never calls the LLM for the digest order', async () => {
    const { decideWithFallback } = await load('/src/integrations/decision/registry.ts')
    let llmCalls = 0
    const llm = {
        id: 'openrouter', displayName: 'OpenRouter', isConfigured: () => true, activeModel: () => 'm', modelLabel: (m) => m,
        capabilities: () => ({ vision: true, structuredOutput: true, maxOutputTokens: null }), prepare: async () => {},
        complete: async () => { llmCalls += 1; return { text: '{}', provider: 'openrouter', model: 'm', usage: null } }
    }
    const ctx = (apiKey) => ({
        aiProvider: { active: 'openrouter' }, jev: { apiKey, reachable: true },
        getActiveLLMProvider: () => llm, getAICoachConsent: () => ({ at: 't', provider: 'openrouter', version: 2, decision: 'jev' })
    })
    assert.equal(await decideWithFallback(ctx(''), { state: {}, questions: { a: { type: 'noul', instructions: 'x' } } }, { jevOnly: true }), null)
    const jevCtx = ctx('k')
    await withFetch(() => { throw new TypeError('Failed to fetch') }, async () => {
        assert.equal(await decideWithFallback(jevCtx, { state: {}, questions: { a: { type: 'noul', instructions: 'x' } } }, { jevOnly: true }), null)
    })
    assert.equal(jevCtx.jev.reachable, false)
    assert.equal(llmCalls, 0)
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
