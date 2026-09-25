// scripts/check-ai-agent.mjs — AI Coach agent, draft-leg parsing, consent, provider resolution, usage format.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'
import { GOLDEN_CHAT_CASES, GOLDEN_DRAFT_INPUT, makeGoldenApp } from './fixtures/gemini-golden-inputs.mjs'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const load = (path) => server.ssrLoadModule(path)
const tests = []
const test = (name, fn) => tests.push({ name, fn })

/** A scripted LLMProvider: `script` decides what complete()/stream() do. */
function fakeProvider(script = {}) {
    const calls = []
    return {
        calls,
        provider: {
            id: script.id ?? 'openrouter',
            displayName: script.displayName ?? 'OpenRouter',
            isConfigured: () => script.configured ?? true,
            activeModel: () => script.model ?? 'vendor/model-a',
            modelLabel: (m) => m,
            capabilities: () => ({ vision: script.vision ?? true, structuredOutput: script.structuredOutput ?? true, maxOutputTokens: null }),
            prepare: async () => { calls.push({ type: 'prepare' }) },
            complete: async (request) => { calls.push({ type: 'complete', request }); return script.complete(request, calls) },
            stream: async (request, onDelta) => { calls.push({ type: 'stream', request }); return script.stream(request, onDelta, calls) }
        }
    }
}
function agentWith(AIInsightsAgent, provider) {
    const app = makeGoldenApp()
    app.getActiveLLMProvider = () => provider
    return new AIInsightsAgent(app)
}

// ── golden ───────────────────────────────────────────────────────────────────

test('Gemini request bodies match the pre-refactor golden fixture', async () => {
    const golden = JSON.parse(readFileSync(new URL('./fixtures/gemini-request-golden.json', import.meta.url), 'utf8'))
    const { AIInsightsAgent } = await load('/src/ai/insights-agent.ts')
    const { createGeminiProvider, buildGeminiBody } = await load('/src/integrations/llm/gemini.ts')
    const app = makeGoldenApp()
    app.getActiveLLMProvider = () => createGeminiProvider(app)
    const agent = new AIInsightsAgent(app)
    const model = app.getActiveLLMProvider().activeModel()
    for (const c of GOLDEN_CHAT_CASES) {
        assert.deepEqual({ model, body: buildGeminiBody(agent.buildChatRequest(c.question, c.options)) }, golden.chat[c.name], c.name)
    }
    assert.deepEqual({ model, body: buildGeminiBody(agent.buildDraftLegExtractionRequest(GOLDEN_DRAFT_INPUT, true)) }, golden.draftLegs)
})

// ── draft legs ───────────────────────────────────────────────────────────────

const goodRow = {
    underlying: 'AAPL', assetType: 'OPTION', optionType: 'PUT', expiration: '2026-10-16', strike: 180,
    optionAction: 'STO', stockAction: null, quantity: 1, price: 2.35, fees: 0.65, tradeDate: '2026-09-24',
    tradeTime: null, confidence: { row: 0.95 }, needsUserReview: false, warnings: [], rawText: 'AAPL 16OCT26 180 P'
}

test('parseDraftLegExtraction keeps valid rows and turns malformed rows into warnings', async () => {
    const { parseDraftLegExtraction } = await load('/src/ai/draft-leg-extraction.ts')
    const result = parseDraftLegExtraction(JSON.stringify({ broker: ' Schwab ', detectedRows: [goodRow, { strike: { bad: true } }, 'nope'], warnings: ['w1', 3] }))
    assert.equal(result.broker, 'Schwab')
    assert.equal(result.detectedRows.length, 1)
    assert.equal(result.detectedRows[0].underlying, 'AAPL')
    assert.deepEqual(result.warnings, ['w1', 'Skipped row 2: it did not match the expected fields.', 'Skipped row 3: it did not match the expected fields.'])
})

test('parseDraftLegExtraction fills missing fields with null and forces review', async () => {
    const { parseDraftLegExtraction } = await load('/src/ai/draft-leg-extraction.ts')
    const result = parseDraftLegExtraction('```json\n{"detectedRows":[{"underlying":"MSFT","strike":"400"}]}\n```')
    assert.equal(result.broker, null)
    assert.equal(result.detectedRows[0].underlying, 'MSFT')
    assert.equal(result.detectedRows[0].strike, '400')
    assert.equal(result.detectedRows[0].optionType, null)
    assert.equal(result.detectedRows[0].needsUserReview, true)
    assert.deepEqual(result.detectedRows[0].warnings, [])
})

test('parseDraftLegExtraction rejects non-JSON and wrong envelopes', async () => {
    const { parseDraftLegExtraction } = await load('/src/ai/draft-leg-extraction.ts')
    assert.throws(() => parseDraftLegExtraction(''), /Empty/)
    assert.throws(() => parseDraftLegExtraction('no json here'), /not valid JSON/)
    assert.throws(() => parseDraftLegExtraction('{"rows":[]}'), /did not match/)
})

// ── agent ────────────────────────────────────────────────────────────────────

test('extractDraftLegsFromImage refuses a model that cannot read images', async () => {
    const { AIInsightsAgent } = await load('/src/ai/insights-agent.ts')
    const { provider, calls } = fakeProvider({ vision: false })
    await assert.rejects(agentWith(AIInsightsAgent, provider).extractDraftLegsFromImage(GOLDEN_DRAFT_INPUT), /can't read images/)
    assert.ok(!calls.some(c => c.type === 'complete'))
})

test('extractDraftLegsFromImage omits the schema without structured output and retries once without it on model_unavailable', async () => {
    const { AIInsightsAgent } = await load('/src/ai/insights-agent.ts')
    const { LLMError } = await load('/src/integrations/llm/types.ts')
    const body = JSON.stringify({ broker: null, detectedRows: [goodRow], warnings: [] })
    const noSchema = fakeProvider({ structuredOutput: false, complete: async () => ({ text: body, provider: 'openrouter', model: 'm', usage: null }) })
    await agentWith(AIInsightsAgent, noSchema.provider).extractDraftLegsFromImage(GOLDEN_DRAFT_INPUT)
    assert.equal(noSchema.calls.find(c => c.type === 'complete').request.responseSchema, undefined)

    const retry = fakeProvider({
        complete: async (request) => {
            if (request.responseSchema) throw new LLMError('model_unavailable', 'no endpoints support response_format')
            return { text: body, provider: 'openrouter', model: 'm', usage: null }
        }
    })
    const result = await agentWith(AIInsightsAgent, retry.provider).extractDraftLegsFromImage(GOLDEN_DRAFT_INPUT)
    assert.equal(result.detectedRows.length, 1)
    assert.deepEqual(retry.calls.filter(c => c.type === 'complete').map(c => Boolean(c.request.responseSchema)), [true, false])
})

test('generateResponse falls back to the local snapshot with a described error', async () => {
    const { AIInsightsAgent } = await load('/src/ai/insights-agent.ts')
    const { LLMError } = await load('/src/integrations/llm/types.ts')
    const { provider } = fakeProvider({ complete: async () => { throw new LLMError('rate_limit', '429') } })
    const reply = await agentWith(AIInsightsAgent, provider).generateResponse('How am I doing?', {})
    assert.match(reply.text, /^OpenRouter request failed: Rate-limited by OpenRouter\. Try again in a minute\./)
    assert.equal(reply.usage, null)
})

test('generateResponse returns text, usage and answering model', async () => {
    const { AIInsightsAgent } = await load('/src/ai/insights-agent.ts')
    const usage = { inputTokens: 10, outputTokens: 4, costUsd: 0.001 }
    const { provider } = fakeProvider({ complete: async () => ({ text: 'All good', provider: 'openrouter', model: 'vendor/model-b', usage }) })
    const reply = await agentWith(AIInsightsAgent, provider).generateResponse('How am I doing?', {})
    assert.deepEqual(reply, { text: 'All good', usage, model: 'vendor/model-b', provider: 'openrouter' })
})

test('generateResponse answers locally when the provider is not configured', async () => {
    const { AIInsightsAgent } = await load('/src/ai/insights-agent.ts')
    const { provider, calls } = fakeProvider({ configured: false })
    const reply = await agentWith(AIInsightsAgent, provider).generateResponse('hi', {})
    assert.match(reply.text, /Add your OpenRouter API key under \[Settings\]\(#settings\)/)
    assert.equal(calls.length, 0)
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
