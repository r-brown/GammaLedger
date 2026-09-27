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

test('JEV via OpenRouter: Decisions endpoint, OpenRouter key and attribution headers, body {model, state, questions}', async () => {
    const { createJevProvider } = await load('/src/integrations/decision/jev.ts')
    await withFetch(() => jsonResponse(200, { id: 'gen-1', provider: 'TypeSafe', ...JEV_OK, usage: { input_tokens: 1000, output_tokens: 3, cost: 0.00005 } }), async (calls) => {
        const result = await createJevProvider({ openRouter: { apiKey: ' sk-or-key ' } }).decide({ state: { ticker: 'VEEV' }, questions: Q })
        assert.equal(calls[0].url, 'https://openrouter.ai/api/alpha/decisions')
        assert.equal(calls[0].init.headers.Authorization, 'Bearer sk-or-key')
        assert.equal(calls[0].init.headers['X-Title'], 'GammaLedger')
        assert.deepEqual(JSON.parse(calls[0].init.body), { model: 'typesafe/jev-1.13', state: { ticker: 'VEEV' }, questions: Q })
        assert.equal(result.engine, 'jev')
        assert.equal(result.calibrated, true)
        assert.equal(result.answers.read.choice, 'bullish')
        assert.equal(result.answers.read.confidence, 0.62)
        assert.equal(result.answers.drift.noul, 0.81)
        assert.equal(result.usage.costUsd, 0.00005)              // OpenRouter's own cost wins
    })
    // Answers without a "type" tag, a bare noul number, no score confidence, no usage cost
    const bare = { model: 'typesafe/jev-1.13-20260917', answers: { read: { choice: 'neutral', probabilities: { neutral: 0.6 } }, urgency: { score: 1.4 }, drift: 0.3 }, usage: { input_tokens: 1000 } }
    await withFetch(() => jsonResponse(200, bare), async () => {
        const result = await createJevProvider({ openRouter: { apiKey: 'k' } }).decide({ state: {}, questions: Q })
        assert.deepEqual(result.answers.read, { type: 'choice', choice: 'neutral', probabilities: { neutral: 0.6 }, confidence: null })
        assert.deepEqual(result.answers.urgency, { type: 'score', score: 1.4, probabilities: {}, confidence: null })
        assert.deepEqual(result.answers.drift, { type: 'noul', noul: 0.3 })
        assert.equal(result.model, 'typesafe/jev-1.13-20260917')
        assert.equal(result.usage.costUsd, 1000 * 0.042 / 1e6)
    })
})

test('JEV errors: 401 auth, 404 model_unavailable, 429 rate_limit, bad answers are bad_response, no OpenRouter key is missing_key', async () => {
    const { createJevProvider } = await load('/src/integrations/decision/jev.ts')
    const jev = createJevProvider({ openRouter: { apiKey: 'k' } })
    await withFetch(() => jsonResponse(401, { error: { message: 'bad key' } }), () => rejectsKind(jev.decide({ state: {}, questions: Q }), 'auth'))
    await withFetch(() => jsonResponse(404, { error: { message: 'no such route' } }), () => rejectsKind(jev.decide({ state: {}, questions: Q }), 'model_unavailable'))
    await withFetch(() => jsonResponse(429, { message: 'slow down' }), () => rejectsKind(jev.decide({ state: {}, questions: Q }), 'rate_limit'))
    await withFetch(() => jsonResponse(200, { ...JEV_OK, answers: { read: JEV_OK.answers.read } }), () => rejectsKind(jev.decide({ state: {}, questions: Q }), 'bad_response'))
    await withFetch(() => jsonResponse(200, { model: 'x', answers: { ...JEV_OK.answers, read: { choice: 'moon' } } }), () => rejectsKind(jev.decide({ state: {}, questions: Q }), 'bad_response'))
    await withFetch(() => jsonResponse(200, { model: 'x', answers: { ...JEV_OK.answers, drift: { noul: 1.4 } } }), () => rejectsKind(jev.decide({ state: {}, questions: Q }), 'bad_response'))
    await rejectsKind(createJevProvider({ openRouter: { apiKey: '' } }).decide({ state: {}, questions: Q }), 'missing_key')
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

test('resolveDecisionEngine: consent v2 and a configured model required; JEV whenever OpenRouter is active and reachable', async () => {
    const { resolveDecisionEngine } = await load('/src/integrations/decision/registry.ts')
    const v2 = { at: 't', provider: 'openrouter', version: 2 }
    const base = { consent: v2, activeLlm: 'openrouter', llmConfigured: true, jevReachable: true }
    assert.equal(resolveDecisionEngine(base), 'jev')
    assert.equal(resolveDecisionEngine({ ...base, jevReachable: false }), 'llm')
    assert.equal(resolveDecisionEngine({ ...base, activeLlm: 'gemini', consent: { ...v2, provider: 'gemini' } }), 'llm')
    assert.equal(resolveDecisionEngine({ ...base, llmConfigured: false }), null)
    assert.equal(resolveDecisionEngine({ ...base, consent: { at: 't', provider: 'openrouter' } }), null)   // v1
    assert.equal(resolveDecisionEngine({ ...base, consent: { ...v2, provider: 'gemini' } }), null)        // consent for another provider
    assert.equal(resolveDecisionEngine({ ...base, consent: null }), null)
})

const fakeLlm = (onComplete) => ({
    id: 'openrouter', displayName: 'OpenRouter', isConfigured: () => true, activeModel: () => 'm', modelLabel: (m) => m,
    capabilities: () => ({ vision: true, structuredOutput: true, maxOutputTokens: null }), prepare: async () => {},
    complete: async () => onComplete()
})
const decisionCtx = (llm) => ({
    aiProvider: { active: 'openrouter' }, openRouter: { apiKey: 'k' }, jev: { reachable: true },
    getActiveLLMProvider: () => llm, getAICoachConsent: () => ({ at: 't', provider: 'openrouter', version: 2 })
})

test('decideWithFallback: JEV unavailable (network or missing route) marks it unreachable and answers via the LLM adapter', async () => {
    const { decideWithFallback } = await load('/src/integrations/decision/registry.ts')
    const llm = fakeLlm(() => ({ text: '{"drift":{"answer":false}}', provider: 'openrouter', model: 'm', usage: null }))
    for (const failure of [() => { throw new TypeError('Failed to fetch') }, () => jsonResponse(404, { error: 'not found' })]) {
        const ctx = decisionCtx(llm)
        let notified = 0
        ctx.onJevUnreachable = () => { notified += 1 }
        await withFetch(failure, async () => {
            const result = await decideWithFallback(ctx, { state: {}, questions: { drift: Q.drift } })
            assert.equal(result.engine, 'llm')
            assert.equal(ctx.jev.reachable, false)
            assert.equal(notified, 1)
        })
    }
    const authCtx = decisionCtx(llm)
    await withFetch(() => jsonResponse(401, { error: 'bad key' }), () => rejectsKind(decideWithFallback(authCtx, { state: {}, questions: { drift: Q.drift } }), 'auth'))
    assert.equal(authCtx.jev.reachable, true)   // the same key would fail the LLM too: no fallback
})

test('confidenceBand follows TypeSafe thresholds', async () => {
    const { confidenceBand } = await load('/src/integrations/decision/types.ts')
    assert.equal(confidenceBand(0.95), 'high')
    assert.equal(confidenceBand(0.9), 'medium')
    assert.equal(confidenceBand(0.5), 'medium')
    assert.equal(confidenceBand(0.49), 'low')
    assert.equal(confidenceBand(null), null)
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
    const ctx = (thesis) => ({ ticker: 'VEEV', asOf: '2026-09-27', price: 214, scores: null, signals: null, momentum: null, position: null, aiRead: null, watchlist: thesis === null ? null : { thesis, daysSinceAdded: 118, watchPrice: { level: 190, waitingFor: 'price at or below level', priceVsLevelPct: 12.6, reached: false, reachedToday: false } } })
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
    assert.ok(d.DRIFT_QUESTIONS.drift.instructions.includes('not a bullish or bearish view'))
})

test('decideWithFallback jevOnly: never calls the LLM (automatic thesis checks)', async () => {
    const { decideWithFallback } = await load('/src/integrations/decision/registry.ts')
    let llmCalls = 0
    const llm = fakeLlm(() => { llmCalls += 1; return { text: '{}', provider: 'openrouter', model: 'm', usage: null } })
    const gemini = { ...decisionCtx(llm), aiProvider: { active: 'gemini' }, getAICoachConsent: () => ({ at: 't', provider: 'gemini', version: 2 }) }
    assert.equal(await decideWithFallback(gemini, { state: {}, questions: { a: { type: 'noul', instructions: 'x' } } }, { jevOnly: true }), null)
    const jevCtx = decisionCtx(llm)
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
