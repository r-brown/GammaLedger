// scripts/check-dates-and-safety.mjs — calendar-date handling across time zones, expiry cutoff,
// external link schemes, watchlist tags on load, IBKR fee sign (Vite SSR, no network).
import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } })
const load = (path) => server.ssrLoadModule(path)
const tests = []
const test = (name, fn) => tests.push({ name, fn })
const inZone = async (tz, fn) => {
    const previous = process.env.TZ
    process.env.TZ = tz
    try { await fn() } finally { process.env.TZ = previous }
}

test('date-only strings display as their calendar day in every time zone', async () => {
    const d = await load('/src/utils/dates.ts')
    for (const tz of ['America/Los_Angeles', 'America/New_York', 'UTC', 'Europe/Berlin', 'Asia/Tokyo']) {
        await inZone(tz, () => {
            assert.equal(d.formatDate('2026-10-16'), 'Oct 16, 2026', tz)
            assert.equal(d.formatDateForInput('2026-10-16'), '2026-10-16', tz)
            assert.equal(d.getWeekKey(d.getWeekEndingFriday('2026-09-28')), '2026-10-02', `${tz}: Monday belongs to that week's Friday`)
            assert.equal(d.getWeekKey(d.getWeekEndingFriday('2026-10-02')), '2026-10-02', tz)
        })
    }
    assert.equal(d.formatDate(''), '—')
    assert.equal(d.formatDate('not a date'), '—')
})

test('DTE is whole calendar days: 1 the evening before expiry, 0 on expiration day', async () => {
    const d = await load('/src/utils/dates.ts')
    await inZone('America/New_York', () => {
        assert.equal(d.calendarDaysUntil('2026-10-16', new Date(2026, 9, 15, 21, 30)), 1, '9:30 PM ET the day before')
        assert.equal(d.calendarDaysUntil('2026-10-16', new Date(2026, 9, 16, 9, 30)), 0)
        assert.equal(d.calendarDaysUntil(new Date('2026-10-16'), new Date(2026, 9, 15, 21, 30)), 1, 'UTC-midnight Date from parseDateValue')
    })
    await inZone('Europe/Berlin', () => {
        assert.equal(d.calendarDaysUntil('2026-10-16', new Date(2026, 9, 16, 0, 30)), 0, '00:30 on expiration day')
    })
    assert.equal(d.calendarDaysUntil('', new Date()), null)
})

test('expiry cutoff is the 21:00 UTC close on expiration day, not midnight', async () => {
    const d = await load('/src/utils/dates.ts')
    const exp = '2026-10-16'
    assert.equal(d.isPastExpiryCutoff(exp, new Date('2026-10-16T00:30:00Z')), false, 'evening before in the US')
    assert.equal(d.isPastExpiryCutoff(exp, new Date('2026-10-16T19:59:00Z')), false, '3:59 PM ET on expiration day')
    assert.equal(d.isPastExpiryCutoff(exp, new Date('2026-10-16T21:01:00Z')), true)
    assert.equal(d.isPastExpiryCutoff(new Date('2026-10-16'), new Date('2026-10-16T12:00:00Z')), false)
    assert.equal(d.isPastExpiryCutoff(null, new Date()), false)
})

test('external links: only absolute http(s) URLs pass', async () => {
    const { safeExternalUrl } = await load('/src/utils/dom.ts')
    assert.equal(safeExternalUrl('https://example.com/a?b=1'), 'https://example.com/a?b=1')
    assert.equal(safeExternalUrl('http://example.com'), 'http://example.com/')
    assert.equal(safeExternalUrl('javascript:alert(1)'), null)
    assert.equal(safeExternalUrl(' JavaScript:alert(1)'), null)
    assert.equal(safeExternalUrl('data:text/html,<b>x</b>'), null)
    assert.equal(safeExternalUrl('/relative/path'), null)
    assert.equal(safeExternalUrl(''), null)
    assert.equal(safeExternalUrl(null), null)
})

test('watchlist entries keep their tags when a database is loaded; bad watch prices are dropped', async () => {
    const { normalizeWatchlist } = await load('/src/core/migration.ts')
    const [entry, other] = normalizeWatchlist([
        { ticker: 'msft', rating: 4, notes: 'n', addedDate: '2026-09-01', tags: [' core ', '', 7, 'wheel'], targetPrice: 400, targetDirection: 'down' },
        { ticker: 'aapl', rating: 9, notes: 1, addedDate: '2026-09-02', targetPrice: -5 }
    ])
    assert.deepEqual(entry.tags, ['core', 'wheel'])
    assert.equal(entry.targetPrice, 400)
    assert.equal('tags' in other, false)
    assert.equal(other.targetPrice, null)
    assert.equal(other.rating, null)
})

test('IBKR fills: a negative "Fees:" line is still a cost', async () => {
    const { parsePastedLegs } = await load('/src/trades/leg-paste.ts')
    const text = ['AAPL Oct16\'26 200 Put', 'Sold 2 @ 1.25', '09/15/2026, 10:31:02 AM', 'Fees: -1.34'].join('\n')
    const result = parsePastedLegs(text, new Date('2026-09-20T12:00:00Z'))
    assert.equal(result.legs.length, 1, JSON.stringify(result))
    assert.equal(result.legs[0].fees, 1.34)
    assert.equal(result.legs[0].orderType, 'STO')
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
