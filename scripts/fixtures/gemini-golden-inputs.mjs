// scripts/fixtures/gemini-golden-inputs.mjs — deterministic inputs for the Gemini
// request golden fixture. Shared by the one-off capture script and check-ai-agent.mjs.

export const GOLDEN_MODEL = 'gemini-3.1-pro-preview'
export const GOLDEN_MAX_TOKENS = 8192

export const GOLDEN_MCP_CONTEXT = {
    version: 'golden',
    totals: { realizedPL: 1234.5, openPositions: 2 },
    activePositions: [{ ticker: 'AAPL', strategy: 'Cash-Secured Put', dte: 12 }]
}

const turn = (sender, text, extra = {}) => ({ sender, text, ...extra })

export const GOLDEN_HISTORY = [
    turn('user', 'First question'),
    turn('ai', 'First answer'),
    turn('user', 'Second question'),
    turn('ai', 'Second answer'),
    turn('user', '   '),
    turn('ai', 'Pending answer', { pending: true }),
    turn('user', 'Third question'),
    turn('ai', '  Third answer with padding  '),
    turn('user', 'Fourth question'),
    turn('ai', 'Fourth answer'),
    turn('user', 'Fifth question'),
    turn('ai', 'Fifth answer')
]

export const GOLDEN_CHAT_CASES = [
    { name: 'free-form question', question: 'How concentrated am I in tech?', options: { history: GOLDEN_HISTORY } },
    { name: 'portfolio_health', question: 'Portfolio health', options: { history: GOLDEN_HISTORY, promptType: 'portfolio_health' } },
    { name: 'risk_check', question: 'Risk check', options: { history: [], promptType: 'risk_check' } },
    { name: 'strategy_ideas', question: 'Strategy ideas', options: { promptType: 'strategy_ideas' } }
]

export const GOLDEN_DRAFT_INPUT = {
    mimeType: 'image/png',
    data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    metadata: {
        source: 'ai_coach_screenshot',
        currentDate: '2026-09-25',
        fileName: 'Trade 2026-09-24 10-00-00.png',
        imageWidth: 1,
        imageHeight: 1,
        sizeBytes: 68,
        wasResized: false,
        appContext: 'GammaLedger draft trade leg import'
    }
}

/** A fake GammaLedger carrying both the pre-refactor (gemini.maxOutputTokens) and post-refactor (aiProvider) shapes. */
export function makeGoldenApp() {
    return {
        gemini: { apiKey: 'golden-key', model: GOLDEN_MODEL, maxOutputTokens: GOLDEN_MAX_TOKENS },
        aiProvider: { active: 'gemini', maxOutputTokens: GOLDEN_MAX_TOKENS },
        getCapitalAtRisk: () => 500,
        calculateDTE: () => 10,
        buildMCPContext: () => GOLDEN_MCP_CONTEXT,
        formatCurrency: (value) => `$${Number(value || 0).toFixed(2)}`,
        formatPercent: (value) => `${Number(value || 0).toFixed(1)}%`,
        formatNumber: (value) => (value === null || value === undefined ? null : String(value))
    }
}
