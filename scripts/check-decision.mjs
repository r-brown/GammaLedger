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
