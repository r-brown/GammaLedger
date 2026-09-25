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
