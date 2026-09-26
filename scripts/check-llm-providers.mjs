// scripts/check-llm-providers.mjs — transport-level checks for src/integrations/llm (Vite SSR, no network).
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const load = (path) => server.ssrLoadModule(path)
const tests = []
const test = (name, fn) => tests.push({ name, fn })

const encoder = new TextEncoder()
/** A ReadableStream that yields each argument as one chunk (strings are UTF-8 encoded). */
const streamOf = (...chunks) => new ReadableStream({
    start(controller) {
        for (const chunk of chunks) controller.enqueue(typeof chunk === 'string' ? encoder.encode(chunk) : chunk)
        controller.close()
    }
})
const sseResponse = (...chunks) => new Response(streamOf(...chunks), { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
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

// ── SSE ──────────────────────────────────────────────────────────────────────

test('readSSE splits events across arbitrary chunk boundaries', async () => {
    const { readSSE } = await load('/src/integrations/llm/sse.ts')
    const events = []
    await readSSE(streamOf('data: {"a"', ':1}\n', '\ndata: second\n\n'), (d) => events.push(d))
    assert.deepEqual(events, ['{"a":1}', 'second'])
})

test('readSSE handles CRLF, comments, multi-line data and a final event without blank line', async () => {
    const { readSSE } = await load('/src/integrations/llm/sse.ts')
    const events = []
    await readSSE(streamOf(': OPENROUTER PROCESSING\r\n\r\ndata: line one\r\ndata: line two\r\n\r\nevent: x\r\ndata:last'), (d) => events.push(d))
    assert.deepEqual(events, ['line one\nline two', 'last'])
})

test('readSSE decodes a UTF-8 character split across chunks', async () => {
    const { readSSE } = await load('/src/integrations/llm/sse.ts')
    const bytes = encoder.encode('data: café\n\n')
    const split = bytes.indexOf(0xc3) + 1
    const events = []
    await readSSE(streamOf(bytes.slice(0, split), bytes.slice(split)), (d) => events.push(d))
    assert.deepEqual(events, ['café'])
})

test('readSSE propagates an error thrown by onData', async () => {
    const { readSSE } = await load('/src/integrations/llm/sse.ts')
    await assert.rejects(readSSE(streamOf('data: a\n\ndata: b\n\n'), () => { throw new Error('stop') }), /stop/)
})

// ── http ─────────────────────────────────────────────────────────────────────

test('runWithTimeout maps a timeout to LLMError(timeout)', async () => {
    const { runWithTimeout } = await load('/src/integrations/llm/http.ts')
    const hang = (signal) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))))
    await rejectsKind(runWithTimeout(20, undefined, hang), 'timeout')
})

test('runWithTimeout maps a caller abort to LLMError(aborted)', async () => {
    const { runWithTimeout } = await load('/src/integrations/llm/http.ts')
    const controller = new AbortController()
    const hang = (signal) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))))
    const pending = runWithTimeout(5000, controller.signal, hang)
    controller.abort()
    await rejectsKind(pending, 'aborted')
})

test('runWithTimeout maps a fetch TypeError to LLMError(network) and passes LLMErrors through', async () => {
    const { runWithTimeout } = await load('/src/integrations/llm/http.ts')
    const { LLMError } = await load('/src/integrations/llm/types.ts')
    await rejectsKind(runWithTimeout(5000, undefined, async () => { throw new TypeError('Failed to fetch') }), 'network')
    await rejectsKind(runWithTimeout(5000, undefined, async () => { throw new LLMError('auth', 'bad key') }), 'auth')
})

test('describeLLMError gives a provider-named sentence per kind', async () => {
    const { describeLLMError, LLMError } = await load('/src/integrations/llm/types.ts')
    assert.equal(describeLLMError(new LLMError('rate_limit', 'x'), 'OpenRouter'), 'Rate-limited by OpenRouter. Try again in a minute.')
    assert.equal(describeLLMError(new LLMError('insufficient_credits', 'x'), 'OpenRouter'), 'Your OpenRouter account is out of credits. Add credits and try again.')
    assert.equal(describeLLMError(new LLMError('model_unavailable', 'The model "x/y" is unavailable: gone'), 'OpenRouter'), 'The model "x/y" is unavailable: gone')
    assert.equal(describeLLMError(new Error('plain'), 'Gemini'), 'plain')
    assert.equal(describeLLMError('weird', 'Gemini'), 'Unknown error')
})

// ── Gemini ───────────────────────────────────────────────────────────────────

const geminiCtx = (overrides = {}) => ({ gemini: { apiKey: 'g-key', model: 'gemini-3.5-flash', ...overrides } })
const textRequest = (extra = {}) => ({
    messages: [
        { role: 'user', content: [{ type: 'text', text: 'hi' }] },
        { role: 'assistant', content: [{ type: 'text', text: 'hello' }] },
        { role: 'user', content: [{ type: 'text', text: 'how am I doing?' }] }
    ],
    maxOutputTokens: 1000,
    temperature: 0.25,
    ...extra
})

test('buildGeminiBody maps roles, images, system text and response schema', async () => {
    const { buildGeminiBody } = await load('/src/integrations/llm/gemini.ts')
    const body = buildGeminiBody({
        messages: [
            { role: 'system', content: [{ type: 'text', text: 'be brief' }] },
            { role: 'user', content: [{ type: 'image', mimeType: 'image/png', base64: 'AAA' }, { type: 'text', text: 'read this' }] },
            { role: 'assistant', content: [{ type: 'text', text: 'ok' }] }
        ],
        maxOutputTokens: 500,
        temperature: 0.05,
        responseSchema: { name: 's', schema: { type: 'object' } }
    })
    assert.deepEqual(body, {
        contents: [
            { role: 'user', parts: [{ inlineData: { mimeType: 'image/png', data: 'AAA' } }, { text: 'read this' }] },
            { role: 'model', parts: [{ text: 'ok' }] }
        ],
        generationConfig: { maxOutputTokens: 500, temperature: 0.05, responseMimeType: 'application/json', responseJsonSchema: { type: 'object' } },
        systemInstruction: { parts: [{ text: 'be brief' }] }
    })
})

test('Gemini complete sends the key only in the header and parses text + usage', async () => {
    const { createGeminiProvider } = await load('/src/integrations/llm/gemini.ts')
    const reply = { candidates: [{ content: { parts: [{ text: '  Hello ' }, { text: 'there  ' }] } }], usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 5 }, modelVersion: 'gemini-3.5-flash-002' }
    await withFetch(() => jsonResponse(200, reply), async (calls) => {
        const result = await createGeminiProvider(geminiCtx()).complete(textRequest())
        assert.equal(calls[0].url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent')
        assert.ok(!calls[0].url.includes('g-key'))
        assert.equal(calls[0].init.headers['x-goog-api-key'], 'g-key')
        assert.deepEqual(result, { text: 'Hello there', provider: 'gemini', model: 'gemini-3.5-flash-002', usage: { inputTokens: 12, outputTokens: 5, costUsd: null } })
    })
})

test('Gemini complete maps HTTP errors and blocked prompts to LLMError kinds', async () => {
    const { createGeminiProvider } = await load('/src/integrations/llm/gemini.ts')
    const provider = createGeminiProvider(geminiCtx())
    await withFetch(() => jsonResponse(400, { error: { code: 400, message: 'API key not valid. Please pass a valid API key.', status: 'INVALID_ARGUMENT' } }), () => rejectsKind(provider.complete(textRequest()), 'auth'))
    await withFetch(() => jsonResponse(429, { error: { code: 429, message: 'quota', status: 'RESOURCE_EXHAUSTED' } }), () => rejectsKind(provider.complete(textRequest()), 'rate_limit'))
    await withFetch(() => jsonResponse(404, { error: { code: 404, message: 'models/x is not found', status: 'NOT_FOUND' } }), () => rejectsKind(provider.complete(textRequest()), 'model_unavailable'))
    await withFetch(() => jsonResponse(200, { promptFeedback: { blockReason: 'SAFETY' } }), () => rejectsKind(provider.complete(textRequest()), 'blocked'))
    await withFetch(() => jsonResponse(500, 'oops'), () => rejectsKind(provider.complete(textRequest()), 'http'))
    await rejectsKind(createGeminiProvider(geminiCtx({ apiKey: '' })).complete(textRequest()), 'missing_key')
})

test('Gemini stream uses alt=sse, keeps leading spaces between chunks and reads final usage', async () => {
    const { createGeminiProvider } = await load('/src/integrations/llm/gemini.ts')
    const chunk = (text, extra = {}) => `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }], ...extra })}\n\n`
    const deltas = []
    await withFetch(() => sseResponse(chunk('Hello'), chunk(' world'), chunk('!', { usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 2 } })), async (calls) => {
        const result = await createGeminiProvider(geminiCtx()).stream(textRequest(), (t) => deltas.push(t))
        assert.equal(calls[0].url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:streamGenerateContent?alt=sse')
        assert.deepEqual(deltas, ['Hello', 'Hello world', 'Hello world!'])
        assert.equal(result.text, 'Hello world!')
        assert.deepEqual(result.usage, { inputTokens: 3, outputTokens: 2, costUsd: null })
    })
})

test('Gemini stream surfaces a JSON error body returned instead of SSE', async () => {
    const { createGeminiProvider } = await load('/src/integrations/llm/gemini.ts')
    await withFetch(() => jsonResponse(403, [{ error: { code: 403, message: 'Permission denied', status: 'PERMISSION_DENIED' } }]),
        () => rejectsKind(createGeminiProvider(geminiCtx()).stream(textRequest(), () => {}), 'auth'))
})

test('Gemini provider falls back to the default model for unknown IDs and labels models', async () => {
    const { createGeminiProvider, geminiModelLabel } = await load('/src/integrations/llm/gemini.ts')
    assert.equal(createGeminiProvider(geminiCtx({ model: 'nope' })).activeModel(), 'gemini-3.5-flash')
    assert.equal(geminiModelLabel('gemini-3.1-pro-preview'), 'Gemini 3.1 Pro (Preview)')
    assert.equal(geminiModelLabel('gemini-9-ultra'), 'Gemini 9 Ultra')
})

test('registry returns the Gemini provider when gemini is active', async () => {
    const { getActiveLLMProvider } = await load('/src/integrations/llm/registry.ts')
    assert.equal(getActiveLLMProvider({ aiProvider: { active: 'gemini' }, ...geminiCtx() }).id, 'gemini')
})

// ── crypto ───────────────────────────────────────────────────────────────────

test('loadOrCreateAesKey creates a key once and reuses the stored one', async () => {
    const { loadOrCreateAesKey, encryptString, decryptString } = await load('/src/utils/crypto.ts')
    const store = new Map()
    const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => { store.set(k, v); return true }, removeItem: (k) => store.delete(k) }
    const first = await loadOrCreateAesKey(storage, 'TestSecret', globalThis.crypto)
    const storedRaw = store.get('TestSecret')
    assert.ok(storedRaw && storedRaw.length > 20)
    const second = await loadOrCreateAesKey(storage, 'TestSecret', globalThis.crypto)
    assert.equal(store.get('TestSecret'), storedRaw)
    const payload = await encryptString('sk-or-secret', globalThis.crypto, first)
    assert.equal(await decryptString(payload, globalThis.crypto, second), 'sk-or-secret')
})

// ── OpenRouter catalogue ─────────────────────────────────────────────────────

const modelsFixture = () => JSON.parse(readFileSync(new URL('./fixtures/openrouter-models.json', import.meta.url), 'utf8'))
const catalogueState = () => ({ models: null, modelsLoading: null, modelsError: null })

test('parseOpenRouterModels derives capabilities, prices and skips :batch and malformed entries', async () => {
    const { parseOpenRouterModels } = await load('/src/integrations/llm/openrouter-models.ts')
    const models = parseOpenRouterModels(modelsFixture())
    const ids = models.map(m => m.id)
    assert.ok(!ids.includes('google/gemini-3.8-flash:batch'))
    assert.ok(!ids.includes(42))
    const flash = models.find(m => m.id === 'google/gemini-3.8-flash')
    assert.deepEqual(
        { vision: flash.vision, structuredOutput: flash.structuredOutput, maxOutputTokens: flash.maxOutputTokens, prompt: flash.promptPricePerMillion, completion: flash.completionPricePerMillion },
        { vision: true, structuredOutput: true, maxOutputTokens: 65536, prompt: 0.75, completion: 3.75 }
    )
    assert.equal(models.find(m => m.id === 'z-ai/glm-5.3-prime').vision, false)
    assert.equal(models.find(m => m.id === 'openrouter/auto').promptPricePerMillion, null)
    assert.ok(models.some(m => m.maxOutputTokens === null))
})

test('isValidOpenRouterModelId accepts provider/model forms only', async () => {
    const { isValidOpenRouterModelId } = await load('/src/integrations/llm/openrouter-models.ts')
    for (const ok of ['anthropic/claude-sonnet-5', 'qwen/qwen3.8-27b:free', 'openai/gpt-6-sol', 'openrouter/auto']) assert.ok(isValidOpenRouterModelId(ok), ok)
    for (const bad of ['claude', 'a/b/c', 'anthropic/claude sonnet', ' anthropic/x', '', '/x', 'x/']) assert.ok(!isValidOpenRouterModelId(bad), bad)
})

test('ensureOpenRouterCatalogue de-duplicates concurrent loads and caches the result', async () => {
    const { ensureOpenRouterCatalogue } = await load('/src/integrations/llm/openrouter-models.ts')
    let calls = 0
    const fetchImpl = async () => { calls++; return jsonResponse(200, modelsFixture()) }
    const state = catalogueState()
    const [a, b] = await Promise.all([ensureOpenRouterCatalogue(state, fetchImpl), ensureOpenRouterCatalogue(state, fetchImpl)])
    assert.equal(calls, 1)
    assert.equal(a, b)
    assert.equal(state.models, a)
    assert.equal(state.modelsLoading, null)
    await ensureOpenRouterCatalogue(state, fetchImpl)
    assert.equal(calls, 1)
})

test('ensureOpenRouterCatalogue falls back to the curated list and retries later', async () => {
    const { ensureOpenRouterCatalogue, OPENROUTER_CURATED_MODELS, availableOpenRouterModels } = await load('/src/integrations/llm/openrouter-models.ts')
    const state = catalogueState()
    const models = await ensureOpenRouterCatalogue(state, async () => jsonResponse(503, {}))
    assert.deepEqual(models.map(m => m.id), OPENROUTER_CURATED_MODELS.map(m => m.id))
    assert.equal(state.models, null)
    assert.match(state.modelsError, /503/)
    assert.equal(availableOpenRouterModels(state), OPENROUTER_CURATED_MODELS)
    assert.ok(OPENROUTER_CURATED_MODELS.some(m => m.id === 'google/gemini-3.8-flash'))
})

test('describeOpenRouterModel summarises context, prices and capabilities', async () => {
    const { describeOpenRouterModel, OPENROUTER_CURATED_MODELS } = await load('/src/integrations/llm/openrouter-models.ts')
    assert.equal(describeOpenRouterModel(OPENROUTER_CURATED_MODELS[0]), 'Google: Gemini 3.8 Flash · 1.05M context · $0.75/M in · $3.75/M out · reads images · structured output')
})

// ── OpenRouter provider ──────────────────────────────────────────────────────

const orState = (overrides = {}) => ({ apiKey: 'or-key', model: 'anthropic/claude-sonnet-5', fallbackModels: [], dataCollection: 'deny', models: null, modelsLoading: null, modelsError: null, ...overrides })
const orCtx = (overrides) => ({ openRouter: orState(overrides) })
const orSettings = (overrides = {}) => ({ model: 'anthropic/claude-sonnet-5', fallbackModels: [], dataCollection: 'deny', modelMaxOutputTokens: null, modelContextLength: null, ...overrides })

test('buildOpenRouterBody: string content for text, parts for images, schema + require_parameters, fallbacks, clamp, stream', async () => {
    const { buildOpenRouterBody } = await load('/src/integrations/llm/openrouter.ts')
    const plain = buildOpenRouterBody(textRequest({ maxOutputTokens: 65536 }), orSettings({ modelMaxOutputTokens: 8192 }), false)
    assert.deepEqual(plain, {
        model: 'anthropic/claude-sonnet-5',
        messages: [{ role: 'user', content: 'hi' }, { role: 'assistant', content: 'hello' }, { role: 'user', content: 'how am I doing?' }],
        max_tokens: 8192,
        temperature: 0.25,
        usage: { include: true },
        provider: { data_collection: 'deny' }
    })
    const rich = buildOpenRouterBody({
        messages: [{ role: 'user', content: [{ type: 'image', mimeType: 'image/png', base64: 'AAA' }, { type: 'text', text: 'read' }] }],
        maxOutputTokens: 100, temperature: 0.05, responseSchema: { name: 'draft', schema: { type: 'object' } }
    }, orSettings({ fallbackModels: ['openai/gpt-6-luna', 'anthropic/claude-sonnet-5'], dataCollection: 'allow' }), true)
    assert.deepEqual(rich.messages[0].content, [{ type: 'image_url', image_url: { url: 'data:image/png;base64,AAA' } }, { type: 'text', text: 'read' }])
    assert.deepEqual(rich.models, ['anthropic/claude-sonnet-5', 'openai/gpt-6-luna'])
    assert.deepEqual(rich.provider, { data_collection: 'allow', require_parameters: true })
    assert.deepEqual(rich.response_format, { type: 'json_schema', json_schema: { name: 'draft', strict: true, schema: { type: 'object' } } })
    assert.equal(rich.stream, true)
    assert.equal(rich.max_tokens, 100)
})

test('OpenRouter max_tokens also fits the model context window: prompt estimate + reply <= context, floor 256', async () => {
    const { buildOpenRouterBody, estimatePromptTokens } = await load('/src/integrations/llm/openrouter.ts')
    const textOf = (n) => ({ messages: [{ role: 'user', content: [{ type: 'text', text: 'x'.repeat(n) }] }], maxOutputTokens: 65536, temperature: 0.25 })
    const imageOnly = { messages: [{ role: 'user', content: [{ type: 'image', mimeType: 'image/png', base64: 'AAA' }] }], maxOutputTokens: 65536, temperature: 0.25 }
    // ~1 token per 3 chars (deliberately pessimistic) + 4 per message, + 1,500 per image
    assert.equal(estimatePromptTokens(textOf(3000).messages), 1004)
    assert.equal(estimatePromptTokens(imageOnly.messages), 1504)
    assert.equal(buildOpenRouterBody(textOf(3000), orSettings({ modelContextLength: 8192 }), false).max_tokens, 8192 - 1004)
    // the smaller of context room and the model's own output limit wins
    assert.equal(buildOpenRouterBody(textOf(3000), orSettings({ modelContextLength: 8192, modelMaxOutputTokens: 2048 }), false).max_tokens, 2048)
    // a user cap below the room is respected
    assert.equal(buildOpenRouterBody({ ...textOf(3000), maxOutputTokens: 500 }, orSettings({ modelContextLength: 8192 }), false).max_tokens, 500)
    // no known context window: unchanged behaviour
    assert.equal(buildOpenRouterBody(textOf(3000), orSettings({ modelContextLength: null }), false).max_tokens, 65536)
    // a prompt that fills the window still gets a sane floor rather than 0 or a negative number
    assert.equal(buildOpenRouterBody(textOf(3000), orSettings({ modelContextLength: 1000 }), false).max_tokens, 256)
})

test('OpenRouter complete sends attribution headers and parses text, answering model, usage and cost', async () => {
    const { createOpenRouterProvider } = await load('/src/integrations/llm/openrouter.ts')
    const reply = { model: 'openai/gpt-6-luna', choices: [{ message: { content: ' Fine. ' }, finish_reason: 'stop' }], usage: { prompt_tokens: 100, completion_tokens: 20, cost: 0.00042 } }
    await withFetch(() => jsonResponse(200, reply), async (calls) => {
        const result = await createOpenRouterProvider(orCtx()).complete(textRequest())
        assert.equal(calls[0].url, 'https://openrouter.ai/api/v1/chat/completions')
        assert.equal(calls[0].init.headers.Authorization, 'Bearer or-key')
        assert.equal(calls[0].init.headers['HTTP-Referer'], 'https://gammaledger.com')
        assert.equal(calls[0].init.headers['X-Title'], 'GammaLedger')
        assert.deepEqual(result, { text: 'Fine.', provider: 'openrouter', model: 'openai/gpt-6-luna', usage: { inputTokens: 100, outputTokens: 20, costUsd: 0.00042 } })
    })
})

test('OpenRouter maps status codes and 200-with-error bodies to LLMError kinds', async () => {
    const { createOpenRouterProvider } = await load('/src/integrations/llm/openrouter.ts')
    const provider = createOpenRouterProvider(orCtx())
    const cases = [[401, 'auth'], [402, 'insufficient_credits'], [403, 'blocked'], [404, 'model_unavailable'], [408, 'timeout'], [429, 'rate_limit'], [500, 'http']]
    for (const [status, kind] of cases) {
        await withFetch(() => jsonResponse(status, { error: { code: status, message: `status ${status}` } }), () => rejectsKind(provider.complete(textRequest()), kind))
    }
    await withFetch(() => jsonResponse(400, { error: { code: 400, message: 'No endpoints found that support the requested parameters' } }), async () => {
        await assert.rejects(provider.complete(textRequest()), (error) => {
            assert.equal(error.kind, 'model_unavailable')
            assert.match(error.message, /^The model "anthropic\/claude-sonnet-5" is unavailable: No endpoints found/)
            assert.match(error.message, /train on my data/)
            return true
        })
    })
    await withFetch(() => jsonResponse(200, { error: { code: 502, message: 'upstream died' } }), () => rejectsKind(provider.complete(textRequest()), 'http'))
    await withFetch(() => jsonResponse(200, { choices: [{ message: { content: null } }] }), async () => {
        assert.equal((await provider.complete(textRequest())).text, '')
    })
    await rejectsKind(createOpenRouterProvider(orCtx({ apiKey: '' })).complete(textRequest()), 'missing_key')
})

test('OpenRouter stream ignores comments, stops at [DONE], reads final usage', async () => {
    const { createOpenRouterProvider } = await load('/src/integrations/llm/openrouter.ts')
    const chunk = (obj) => `data: ${JSON.stringify(obj)}\n\n`
    const deltas = []
    await withFetch(() => sseResponse(
        ': OPENROUTER PROCESSING\n\n',
        chunk({ model: 'anthropic/claude-sonnet-5', choices: [{ delta: { content: 'Hel' } }] }),
        chunk({ choices: [{ delta: { content: 'lo' } }] }),
        chunk({ choices: [{ delta: { content: '' }, finish_reason: 'stop' }], usage: { prompt_tokens: 9, completion_tokens: 2, cost: 0 } }),
        'data: [DONE]\n\n'
    ), async (calls) => {
        const result = await createOpenRouterProvider(orCtx()).stream(textRequest(), (t) => deltas.push(t))
        assert.equal(JSON.parse(calls[0].init.body).stream, true)
        assert.deepEqual(deltas, ['Hel', 'Hello'])
        assert.deepEqual(result, { text: 'Hello', provider: 'openrouter', model: 'anthropic/claude-sonnet-5', usage: { inputTokens: 9, outputTokens: 2, costUsd: 0 } })
    })
})

test('OpenRouter stream throws on a mid-stream error chunk and on a JSON error response', async () => {
    const { createOpenRouterProvider } = await load('/src/integrations/llm/openrouter.ts')
    const provider = createOpenRouterProvider(orCtx())
    const chunk = (obj) => `data: ${JSON.stringify(obj)}\n\n`
    const deltas = []
    await withFetch(() => sseResponse(
        chunk({ choices: [{ delta: { content: 'partial' } }] }),
        chunk({ error: { code: 'server_error', message: 'provider disconnected' }, choices: [{ delta: { content: '' }, finish_reason: 'error' }] })
    ), async () => {
        await assert.rejects(provider.stream(textRequest(), (t) => deltas.push(t)), /provider disconnected/)
        assert.deepEqual(deltas, ['partial'])
    })
    await withFetch(() => jsonResponse(402, { error: { code: 402, message: 'Insufficient credits' } }), () => rejectsKind(provider.stream(textRequest(), () => {}), 'insufficient_credits'))
})

test('OpenRouter capabilities: catalogue values when known, optimistic when unknown; labels strip vendor prefix', async () => {
    const { createOpenRouterProvider } = await load('/src/integrations/llm/openrouter.ts')
    const { parseOpenRouterModels } = await load('/src/integrations/llm/openrouter-models.ts')
    const provider = createOpenRouterProvider(orCtx({ models: parseOpenRouterModels(modelsFixture()) }))
    assert.equal(provider.capabilities('z-ai/glm-5.3-prime').vision, false)
    assert.deepEqual(provider.capabilities('someone/custom-model'), { vision: true, structuredOutput: true, maxOutputTokens: null })
    assert.equal(provider.modelLabel('anthropic/claude-sonnet-5'), 'Claude Sonnet 5')
    assert.equal(provider.modelLabel('qwen/qwen3.8-27b:free'), 'qwen3.8-27b:free')
    assert.equal(createOpenRouterProvider(orCtx({ model: 'not valid' })).activeModel(), 'google/gemini-3.8-flash')
})

test('registry returns the OpenRouter provider when openrouter is active', async () => {
    const { getActiveLLMProvider } = await load('/src/integrations/llm/registry.ts')
    assert.equal(getActiveLLMProvider({ aiProvider: { active: 'openrouter' }, ...geminiCtx(), ...orCtx() }).id, 'openrouter')
})

test('cache flag: OpenRouter marks flagged text parts with cache_control; Gemini ignores it', async () => {
    const { buildOpenRouterBody } = await load('/src/integrations/llm/openrouter.ts')
    const { buildGeminiBody } = await load('/src/integrations/llm/gemini.ts')
    const request = {
        messages: [
            { role: 'system', content: [{ type: 'text', text: 'rules' }] },
            { role: 'user', content: [{ type: 'text', text: 'SNAPSHOT', cache: true }] },
            { role: 'user', content: [{ type: 'text', text: 'question' }] }
        ],
        maxOutputTokens: 100, temperature: 0.25
    }
    const body = buildOpenRouterBody(request, orSettings(), false)
    assert.equal(body.messages[0].content, 'rules')
    assert.deepEqual(body.messages[1].content, [{ type: 'text', text: 'SNAPSHOT', cache_control: { type: 'ephemeral' } }])
    assert.equal(body.messages[2].content, 'question')
    const gemini = buildGeminiBody(request)
    assert.deepEqual(gemini.contents[0], { role: 'user', parts: [{ text: 'SNAPSHOT' }] })
    assert.ok(!JSON.stringify(gemini).includes('cache'))
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
