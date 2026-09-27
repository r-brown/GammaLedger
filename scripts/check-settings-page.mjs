// scripts/check-settings-page.mjs — settings page status badges, section dots and search matching (Vite SSR, no DOM).
import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } })
const load = (path) => server.ssrLoadModule(path)
const tests = []
const test = (name, fn) => tests.push({ name, fn })

const provider = (configured, model = 'google/gemini-3.8-flash') => ({
    displayName: 'OpenRouter',
    isConfigured: () => configured,
    activeModel: () => model,
    modelLabel: (id) => (id === 'google/gemini-3.8-flash' ? 'Gemini 3.8 Flash' : id)
})
const host = (over = {}) => ({
    settingsSection: null,
    schwab: { vault: null, encryptionKey: null },
    finnhub: { apiKey: null },
    getActiveLLMProvider: () => provider(false),
    defaultFeePerContract: null,
    accountSize: null,
    externalAnalyticsUrl: 'https://www.investing.com/search/?q={ticker}',
    startupBehavior: 'cache',
    formatCurrency: (v) => `$${Number(v).toFixed(2)}`,
    hasSchwabVault: () => false,
    ...over
})

test('card badges reflect what is configured', async () => {
    const { getCardStatus } = await load('/src/ui/settings-page.ts')
    const blank = host()
    assert.deepEqual(getCardStatus(blank, 'schwab'), { tone: 'off', text: 'Not set up' })
    assert.deepEqual(getCardStatus(blank, 'finnhub'), { tone: 'off', text: 'Not set' })
    assert.deepEqual(getCardStatus(blank, 'ai-provider'), { tone: 'off', text: 'OpenRouter · no key' })
    assert.deepEqual(getCardStatus(blank, 'default-fee'), { tone: 'off', text: 'Not set' })
    assert.deepEqual(getCardStatus(blank, 'startup'), { tone: 'info', text: 'Auto-load' })
    assert.deepEqual(getCardStatus(blank, 'analytics-link'), { tone: 'info', text: 'Default' })
    assert.equal(getCardStatus(blank, 'unknown-card'), null)

    const set = host({
        finnhub: { apiKey: 'fh' },
        getActiveLLMProvider: () => provider(true),
        defaultFeePerContract: 0.65,
        accountSize: 60000,
        externalAnalyticsUrl: 'https://finance.yahoo.com/quote/{ticker}',
        startupBehavior: 'manual'
    })
    assert.deepEqual(getCardStatus(set, 'finnhub'), { tone: 'ok', text: 'Key saved' })
    assert.deepEqual(getCardStatus(set, 'ai-provider'), { tone: 'ok', text: 'OpenRouter · Gemini 3.8 Flash' })
    assert.deepEqual(getCardStatus(set, 'default-fee'), { tone: 'ok', text: '$0.65 / contract' })
    assert.deepEqual(getCardStatus(set, 'account-size'), { tone: 'ok', text: '$60000.00' })
    assert.deepEqual(getCardStatus(set, 'analytics-link'), { tone: 'info', text: 'Custom' })
    assert.deepEqual(getCardStatus(set, 'startup'), { tone: 'info', text: 'Start blank' })
})

test('Schwab badge walks the vault states: locked, needs authorization, connected', async () => {
    const { getCardStatus } = await load('/src/ui/settings-page.ts')
    assert.deepEqual(getCardStatus(host({ hasSchwabVault: () => true }), 'schwab'), { tone: 'warn', text: 'Locked' })
    const unlocked = { vault: { clientId: 'c' }, encryptionKey: {} }
    assert.deepEqual(getCardStatus(host({ schwab: unlocked }), 'schwab'), { tone: 'warn', text: 'Authorize' })
    const connected = { vault: { clientId: 'c', refreshToken: 'r' }, encryptionKey: {} }
    assert.deepEqual(getCardStatus(host({ schwab: connected }), 'schwab'), { tone: 'ok', text: 'Connected' })
})

test('a throwing status getter hides the badge instead of breaking the page', async () => {
    const { getCardStatus } = await load('/src/ui/settings-page.ts')
    const broken = host({ getActiveLLMProvider: () => { throw new Error('not ready') } })
    assert.equal(getCardStatus(broken, 'ai-provider'), null)
})

test('section dot: needs attention wins, then set up, then not set up; info-only gets none', async () => {
    const { sectionTone } = await load('/src/ui/settings-page.ts')
    assert.equal(sectionTone(['ok', 'warn', 'off']), 'warn')
    assert.equal(sectionTone(['off', 'ok']), 'ok')
    assert.equal(sectionTone(['off', 'info']), 'off')
    assert.equal(sectionTone(['info', 'info']), 'none')
    assert.equal(sectionTone([]), 'none')
})

test('search matches every term, case-insensitively, anywhere in the card text', async () => {
    const { matchesSettingsQuery } = await load('/src/ui/settings-page.ts')
    const text = 'Finnhub Quotes, earnings dates API key rate limit requests per minute'
    assert.equal(matchesSettingsQuery(text, 'API KEY'), true)
    assert.equal(matchesSettingsQuery(text, 'rate   limit'), true)
    assert.equal(matchesSettingsQuery(text, 'rate schwab'), false)
    assert.equal(matchesSettingsQuery(text, ''), true)
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
