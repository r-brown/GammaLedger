// scripts/check-grounding.mjs — numeric grounding of Coach answers (Vite SSR, no network).
import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } })
const load = (path) => server.ssrLoadModule(path)
const tests = []
const test = (name, fn) => tests.push({ name, fn })

test('extractClaims: $ amounts, percentages and DTE; dates, years, list numbers and code blocks skipped', async () => {
    const { extractClaims } = await load('/src/ai/grounding.ts')
    const answer = [
        '1. **Verdict:** Watch. Realized P&L is +$9,311.55 YTD; VEEV is 48.7% of collateral.',
        'Expiring 2026-10-16 in 20 DTE. In 2025 you lost −$2.35k on TSLA.',
        '```',
        'VEEV  ██████████░░ 48.7%',
        '```'
    ].join('\n')
    const claims = extractClaims(answer)
    assert.deepEqual(claims.map(c => [c.raw, c.value, c.unit]), [
        ['+$9,311.55', 9311.55, '$'],
        ['48.7%', 48.7, '%'],
        ['20 DTE', 20, 'dte'],
        ['−$2.35k', 2350, '$']
    ])
    assert.ok(claims[0].sentence.includes('Realized P&L'))
})

test('extractClaims includes values from valid chart blocks', async () => {
    const { extractClaims } = await load('/src/ai/grounding.ts')
    const claims = extractClaims('Here:\n```chart\n{"type":"bar","title":"Capital","labels":["VEEV","TSLA"],"values":[48.7,30.2]}\n```')
    assert.deepEqual(claims.map(c => c.value), [48.7, 30.2])
    assert.ok(claims.every(c => c.unit === 'chart'))
})

test('collectSnapshotNumbers reads numbers and numbers inside strings', async () => {
    const { collectSnapshotNumbers } = await load('/src/ai/grounding.ts')
    const nums = collectSnapshotNumbers('{"book":{"realizedPL":9311.55},"open":[{"pos":"VEEV CSP P210 2026-10-16","dte":20}]}')
    for (const n of [9311.55, 210, 20]) assert.ok(nums.includes(n), String(n))
})

test('groundClaims: precision-aware tolerance, ratio↔percent, unmatched listed not counted', async () => {
    const { extractClaims, groundAnswer } = await load('/src/ai/grounding.ts')
    const snapshot = JSON.stringify({ book: { realizedPL: 9311.55, collateralAtRisk: 14305 }, edge: { winRatePct: 87.2, payoffRatio: 0.31 }, open: [{ dte: 20, capitalPctOfCollateral: 48.7 }] })
    const answer = 'You made $9,311 on $14.3k collateral. Win rate 87%, payoff 31%, VEEV 48.7% and 20 DTE. Combined $4,120 at risk.'
    const result = groundAnswer(answer, snapshot)
    assert.equal(result.checked, extractClaims(answer).length)
    assert.equal(result.checked, 7)
    assert.equal(result.matched, 6)
    assert.deepEqual(result.unmatched.map(u => u.raw), ['$4,120'])
})

test('formatGroundingBadge', async () => {
    const { formatGroundingBadge } = await load('/src/ai/usage-format.ts')
    assert.equal(formatGroundingBadge({ checked: 15, matched: 14, unmatched: [{ raw: '$4,120', sentence: 's' }] }), 'Numbers checked: 14/15 in your data · 1 not found')
    assert.equal(formatGroundingBadge({ checked: 5, matched: 5, unmatched: [] }), 'Numbers checked: 5/5 in your data')
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
