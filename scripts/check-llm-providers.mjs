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
