// scripts/check-coach-context.mjs — coach context builder, source fixes and account size (Vite SSR, no network).
import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const load = (path) => server.ssrLoadModule(path)
const tests = []
const test = (name, fn) => tests.push({ name, fn })

// ── Source fixes ─────────────────────────────────────────────────────────────

test('calculateBasisROI is undefined-safe: non-positive or invalid basis gives 0', async () => {
    const { calculateBasisROI } = await load('/src/calculations/pnl.ts')
    assert.equal(calculateBasisROI(2467.19, -164.19), 0)   // the CMCSA "free wheel": was -1502.64
    assert.equal(calculateBasisROI(100, 0), 0)
    assert.equal(calculateBasisROI(100, 1000), 10)
    assert.equal(calculateBasisROI(-50, 1000), -5)
    assert.equal(calculateBasisROI(Number.NaN, 1000), 0)
    assert.equal(calculateBasisROI(100, Number.NaN), 0)
})

const mcpHost = (overrides = {}) => {
    const closed = { id: 'C1', ticker: 'AAPL', strategy: 'Cash-Secured Put', status: 'Closed', pl: 50, roi: 2.5, closedDate: '2026-09-10', openedDate: '2026-08-20' }
    const assignedHeld = { id: 'A1', ticker: 'CMCSA', strategy: 'Wheel', status: 'Assigned', pl: 2467.19, roi: 0, closedDate: '2026-09-18', openedDate: '2026-06-01' }
    const open = { id: 'O1', ticker: 'VEEV', strategy: 'Cash-Secured Put', status: 'Open', pl: 620, roi: 4, annualizedROI: 0, dte: 20 }
    const realized = { C1: 50, A1: 164.19 }
    return {
        closed, assignedHeld, open,
        host: {
            trades: [closed, assignedHeld, open],
            currentDate: new Date('2026-09-26T00:00:00Z'),
            calculateAdvancedStats: () => ({ closedTradesList: [closed, assignedHeld], openTradesList: [open], totalTrades: 3, closedTrades: 2, activePositions: 1, assignedPositions: 1, collateralAtRisk: 1000 }),
            getClosedTradesInRange: () => [closed],
            calculateRealizedPL: (t) => realized[t.id] ?? 0,
            isClosedStatus: (s) => s === 'Closed' || s === 'Expired',
            hasAssignedInventory: (t) => t.status === 'Assigned',
            isActiveStatus: (s) => s === 'Open' || s === 'Rolling',
            buildMCPAssignment: () => null,
            ...overrides
        }
    }
}

test('buildMCPContext: held (assigned) inventory is not a closed winner and not a recent closed trade', async () => {
    const { buildMCPContext, buildMCPTrade } = await load('/src/integrations/mcp.ts')
    const { host } = mcpHost()
    host.buildMCPTrade = buildMCPTrade
    const ctx = buildMCPContext.call(host)
    assert.equal(ctx.portfolio.largestWinner.ticker, 'AAPL')
    assert.equal(ctx.portfolio.largestWinner.pl, 50)
    assert.deepEqual(ctx.recentClosedTrades.map(t => t.ticker), ['AAPL'])
})

test('buildMCPTrade: open trades carry no annualizedROI, closed trades keep it', async () => {
    const { buildMCPTrade } = await load('/src/integrations/mcp.ts')
    const open = buildMCPTrade({ id: 'O', ticker: 'X', annualizedROI: 0, dte: 5 }, { isOpen: true })
    const closed = buildMCPTrade({ id: 'C', ticker: 'X', annualizedROI: 42.5, closedDate: '2026-09-01' }, { isOpen: false })
    assert.ok(!('annualizedROI' in open))
    assert.equal(closed.annualizedROI, 42.5)
})

// ── Account size ─────────────────────────────────────────────────────────────

test('parseAccountSize accepts positive finite USD amounts only', async () => {
    const { parseAccountSize } = await load('/src/settings/account-size.ts')
    assert.equal(parseAccountSize('50000'), 50000)
    assert.equal(parseAccountSize(' 62500.5 '), 62500.5)
    assert.equal(parseAccountSize('1,250'), null)          // no thousands separators
    for (const bad of ['0', '-5', 'abc', '', '  ', 'NaN', 'Infinity', '1e12', null, undefined]) {
        assert.equal(parseAccountSize(bad), null, String(bad))
    }
})

test('AccountSizeSchema mirrors the parser (max 1e10)', async () => {
    const { AccountSizeSchema } = await load('/src/core/schema.ts')
    assert.ok(AccountSizeSchema.safeParse(50000).success)
    assert.ok(!AccountSizeSchema.safeParse(0).success)
    assert.ok(!AccountSizeSchema.safeParse(1e11).success)
    assert.ok(!AccountSizeSchema.safeParse(Number.NaN).success)
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
