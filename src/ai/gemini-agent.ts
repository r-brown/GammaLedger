// src/ai/gemini-agent.ts
// GeminiInsightsAgent — Gemini-backed AI coach with LocalInsightsAgent as fallback.
// Migrated verbatim from class GammaLedger's monolith file.
import {
    DEFAULT_GEMINI_MODEL,
    GEMINI_ALLOWED_MODELS,
    DEFAULT_GEMINI_TEMPERATURE,
    DEFAULT_GEMINI_ENDPOINT,
    DEFAULT_GEMINI_MAX_TOKENS
} from '../core/config.js';
import { LocalInsightsAgent } from './local-agent.js';
import {
    isGeminiApiResponse,
    extractGeminiText,
    extractGeminiError,
} from '../types/integrations.js';

type SnapshotValue = string | number | boolean | null | SnapshotValue[] | { [key: string]: SnapshotValue }

interface GeminiConfig {
    apiKey?: string | null
    model?: string
    maxOutputTokens?: number
}

interface GeminiAppInterface {
    gemini?: GeminiConfig
    getCapitalAtRisk(trade: Record<string, unknown>): number
    calculateDTE(expiration: string, trade: Record<string, unknown>): number
    buildMCPContext(): Record<string, unknown>
    formatCurrency(value: unknown, options?: Record<string, unknown>): string
    formatPercent?(value: unknown, fallback?: string, options?: Record<string, unknown>): string
    formatNumber?(value: unknown, options?: Record<string, unknown>): string | null
}

type GeminiRequestPart =
    | { text: string }
    | { inlineData: { mimeType: string; data: string } }

interface RequestPayload {
    model: string
    body: {
        contents: Array<{ role: string; parts: GeminiRequestPart[] }>
        generationConfig: Record<string, unknown>
    }
}

interface ChatMessage {
    sender?: string
    text?: string
    pending?: boolean
    [key: string]: unknown
}

interface GenerateOptions {
    history?: ChatMessage[]
    promptType?: string
    [key: string]: unknown
}

interface DraftLegImageInput {
    mimeType: string
    data: string
    metadata?: Record<string, unknown>
}

export interface GeminiDraftLegExtraction {
    broker: string | null
    detectedRows: Array<Record<string, unknown>>
    warnings?: string[]
}

const DRAFT_LEG_EXTRACTION_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    properties: {
        broker: {
            type: ['string', 'null'],
            description: 'Detected broker name, or null when not visible.'
        },
        detectedRows: {
            type: 'array',
            description: 'Only trade execution rows visibly present in the screenshot.',
            items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    underlying: { type: ['string', 'null'], description: 'Ticker symbol for the underlying security.' },
                    assetType: { type: ['string', 'null'], enum: ['OPTION', 'STOCK', 'UNKNOWN', null] },
                    optionType: { type: ['string', 'null'], enum: ['CALL', 'PUT', null] },
                    expiration: { type: ['string', 'null'], description: 'Option expiration as YYYY-MM-DD.' },
                    strike: { type: ['number', 'null'] },
                    optionAction: {
                        type: ['string', 'null'],
                        enum: ['BTO', 'STO', 'BTC', 'STC', null]
                    },
                    stockAction: { type: ['string', 'null'], enum: ['BUY', 'SELL', null] },
                    quantity: { type: ['number', 'null'] },
                    price: { type: ['number', 'null'], description: 'Execution price as visibly quoted by the broker. For listed US options this is usually the option premium per underlying share, e.g. 2.35, not multiplied by 100.' },
                    fees: { type: ['number', 'null'] },
                    tradeDate: { type: ['string', 'null'], description: 'Execution date as YYYY-MM-DD.' },
                    tradeTime: { type: ['string', 'null'] },
                    confidence: {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            row: { type: 'number', minimum: 0, maximum: 1 },
                            underlying: { type: 'number', minimum: 0, maximum: 1 },
                            assetType: { type: 'number', minimum: 0, maximum: 1 },
                            optionType: { type: 'number', minimum: 0, maximum: 1 },
                            expiration: { type: 'number', minimum: 0, maximum: 1 },
                            strike: { type: 'number', minimum: 0, maximum: 1 },
                            optionAction: { type: 'number', minimum: 0, maximum: 1 },
                            stockAction: { type: 'number', minimum: 0, maximum: 1 },
                            quantity: { type: 'number', minimum: 0, maximum: 1 },
                            price: { type: 'number', minimum: 0, maximum: 1 },
                            fees: { type: 'number', minimum: 0, maximum: 1 },
                            tradeDate: { type: 'number', minimum: 0, maximum: 1 }
                        },
                        required: [
                            'row',
                            'underlying',
                            'assetType',
                            'optionType',
                            'expiration',
                            'strike',
                            'optionAction',
                            'stockAction',
                            'quantity',
                            'price',
                            'fees',
                            'tradeDate'
                        ]
                    },
                    needsUserReview: { type: 'boolean' },
                    warnings: { type: 'array', items: { type: 'string' } },
                    rawText: { type: ['string', 'null'], description: 'Visible source text for this row.' }
                },
                required: [
                    'underlying',
                    'assetType',
                    'optionType',
                    'expiration',
                    'strike',
                    'optionAction',
                    'stockAction',
                    'quantity',
                    'price',
                    'fees',
                    'tradeDate',
                    'tradeTime',
                    'confidence',
                    'needsUserReview',
                    'warnings',
                    'rawText'
                ]
            }
        },
        warnings: {
            type: 'array',
            items: { type: 'string' }
        }
    },
    required: ['broker', 'detectedRows', 'warnings']
} as const;

export class GeminiInsightsAgent {
    app: GeminiAppInterface
    context: { stats: Record<string, unknown> | null; openTrades: Record<string, unknown>[] }
    fallback: LocalInsightsAgent

    constructor(app: GeminiAppInterface) {
        this.app = app;
        this.context = {
            stats: null,
            openTrades: []
        };
        this.fallback = new LocalInsightsAgent(app);
    }

    updateContext({ stats, openTrades }: { stats?: Record<string, unknown>; openTrades?: unknown[] } = {}): void {
        if (stats) {
            this.context.stats = stats;
        }
        if (Array.isArray(openTrades)) {
            this.context.openTrades = openTrades as Record<string, unknown>[];
        }
        this.fallback.updateContext({ stats: this.context.stats ?? undefined, openTrades: this.context.openTrades });
    }

    getGreeting(): string {
        if (!this.isConfigured()) {
            return 'Connect your Gemini API key in [Settings](#settings) to get tailored analysis.';
        }
        return this.fallback.getGreeting();
    }

    isConfigured(): boolean {
        const config = this.app?.gemini;
        return Boolean(config && config.apiKey);
    }

    async generateResponse(query = '', options: GenerateOptions = {}): Promise<string> {
        const prompt = query.trim();
        if (!prompt) {
            return 'Ask a question and I\'ll send it to Gemini along with a snapshot of your portfolio.';
        }

        if (!this.isConfigured()) {
            return 'Add a Gemini-compatible API key under [Settings](#settings) to enable AI-powered insights.';
        }

        try {
            const request = this.buildRequestPayload(prompt, options);
            const content = await this.callGemini(request);
            if (content) {
                return content;
            }
            throw new Error('Gemini returned an empty response');
        } catch (error) {
            const fallback = this.fallback.generateResponse(query);
            const message = (error as Error)?.message || 'Unknown error';
            if (fallback) {
                return `Gemini request failed (${message}). Here's a local snapshot instead:\n\n${fallback}`;
            }
            return `Gemini request failed (${message}). Try again in a moment.`;
        }
    }

    async extractDraftLegsFromImage(input: DraftLegImageInput): Promise<GeminiDraftLegExtraction> {
        if (!this.isConfigured()) {
            throw new Error('Add a Gemini-compatible API key under Settings before extracting screenshot trades.');
        }

        if (!input?.mimeType || !input?.data) {
            throw new Error('Screenshot image data is missing.');
        }

        const request = this.buildDraftLegExtractionPayload(input);
        const content = await this.callGemini(request);
        if (!content) {
            throw new Error('Gemini returned an empty extraction response.');
        }

        const parsed = this.parseDraftLegExtractionResponse(content);
        if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.detectedRows)) {
            throw new Error('Gemini response did not match the draft-leg extraction shape.');
        }

        return {
            broker: typeof parsed.broker === 'string' && parsed.broker.trim() ? parsed.broker.trim() : null,
            detectedRows: parsed.detectedRows as Array<Record<string, unknown>>,
            warnings: Array.isArray(parsed.warnings)
                ? parsed.warnings.filter((warning: unknown): warning is string => typeof warning === 'string')
                : []
        };
    }

    buildDraftLegExtractionPayload(input: DraftLegImageInput): RequestPayload {
        const config = this.app?.gemini || {};
        const model = GEMINI_ALLOWED_MODELS.includes(config.model ?? '')
            ? (config.model as string)
            : DEFAULT_GEMINI_MODEL;
        const metadata = input.metadata && typeof input.metadata === 'object'
            ? JSON.stringify(input.metadata, null, 2)
            : '{}';

        const prompt = `# ROLE

You extract visible broker trade executions from a screenshot for GammaLedger, an options trade tracker.

This is visual extraction only. Return draft trade-leg candidates for human review. Do not give trading, accounting, tax, or portfolio advice.

# TASK

Extract only visible broker trade, fill, execution, assignment, or exercise rows. Return only JSON matching the provided response schema.

# STRICT EXTRACTION RULES

- Extract only rows visibly present in the screenshot
- Do not invent missing values
- Use null and warnings for unclear fields
- Preserve short raw visible text per row
- If no valid trade rows are visible, return detectedRows = [] and add a warning
- Ignore balances, charts, watchlists, filters, headers-only rows, totals, summaries, P/L-only rows, cash movements, fees-only rows, option-chain quotes, and open-position-only rows
- Extract pending orders only if clearly filled or executed
- Never create accounting entries or advice
- Never say that a trade should be made
- This is only a draft extraction for human review

# ASSET AND CONTRACT PARSING

Use assetType OPTION for option contracts, STOCK for share trades, UNKNOWN if unclear.

For options, extract underlying, optionType, expiration, and strike. Recognize formats like:

- AAPL 19JUN26 180 P
- AAPL Jun 19 '26 180 Put
- AAPL 2026-06-19 180 PUT
- AAPL 260619P00180000
- AAPL 06/19/2026 180 C
- AAPL Jun26 180C

Normalize expiration to YYYY-MM-DD, strike to a decimal number, C/Call to CALL, and P/Put to PUT. If ambiguous, use null and add a warning.

# ACTION NORMALIZATION

For options, use:

- BTO = Buy To Open
- STO = Sell To Open
- BTC = Buy To Close
- STC = Sell To Close

Set optionAction only when open/close is visible or strongly inferable.

Strong mappings:

- Buy to Open, BOT OPEN, Opening Buy -> BTO
- Sell to Open, SLD OPEN, Opening Sell -> STO
- Buy to Close, BOT CLOSE, Closing Buy -> BTC
- Sell to Close, SLD CLOSE, Closing Sell -> STC

If only BUY, BOT, Bought, SELL, SLD, or Sold is visible without open/close, set optionAction to null.

For stock rows, use stockAction BUY or SELL. Do not use optionAction for stock rows.

# DATES, NUMBERS, PRICE

Use ISO dates: YYYY-MM-DD.

The CLIENT METADATA includes a currentDate field with today's date in YYYY-MM-DD format.

Date rules:
- If the visible trade date is complete, use it as-is.
- If only month and day are visible with no year, fill in the year from currentDate.
- Try to determine the trade date from the screenshot filename if no date is visible in the screenshot itself.
- If no date is visible at all, use currentDate for tradeDate and do not add a warning.
- Do not invent timezone.

Use decimal numbers, not strings, for strike, quantity, price, and fees.

Normalize examples:

- $2.35 -> 2.35
- 2,35 -> 2.35 only when decimal-comma locale is clear
- 1,234.56 -> 1234.56
- (2.35) -> -2.35 only when parentheses visibly mean negative

For options, price is the premium exactly as visibly quoted, usually per underlying share. Do not multiply by 100 unless a separate total/net amount is visibly shown.

# REVIEW AND CONFIDENCE

Set needsUserReview = true when confidence.row < 0.85, any required field is null, optionAction is unclear, option fields are unclear, date/decimal format is ambiguous, the row is cropped, or multiple interpretations are possible.

Use confidence.row and field-level confidence. Prefer incomplete but reviewable extraction over confident guessing.

# STRATEGY

Do not infer strategy unless explicitly labeled by the broker. GammaLedger or its MCP server may infer strategy later.

# CLIENT METADATA

Use this only as weak context, not as proof that trades exist.

${metadata}`;

        return {
            model,
            body: {
                contents: [
                    {
                        role: 'user',
                        parts: [
                            {
                                inlineData: {
                                    mimeType: input.mimeType,
                                    data: input.data
                                }
                            },
                            { text: prompt }
                        ]
                    }
                ],
                generationConfig: {
                    maxOutputTokens: Math.min(this.app.gemini?.maxOutputTokens || DEFAULT_GEMINI_MAX_TOKENS, DEFAULT_GEMINI_MAX_TOKENS),
                    temperature: 0.05,
                    responseMimeType: 'application/json',
                    responseJsonSchema: DRAFT_LEG_EXTRACTION_SCHEMA
                }
            }
        };
    }

    parseDraftLegExtractionResponse(content: string): Record<string, unknown> {
        const trimmed = (content || '').trim();
        if (!trimmed) {
            throw new Error('Empty draft-leg extraction response.');
        }

        try {
            return JSON.parse(trimmed) as Record<string, unknown>;
        } catch (_error) {
            const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
            const candidate = fenced?.[1]?.trim();
            if (candidate) {
                return JSON.parse(candidate) as Record<string, unknown>;
            }
            const start = trimmed.indexOf('{');
            const end = trimmed.lastIndexOf('}');
            if (start !== -1 && end > start) {
                return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
            }
            throw new Error('Draft-leg extraction response was not valid JSON.');
        }
    }

    buildRequestPayload(question: string, options: GenerateOptions = {}): RequestPayload {
        const config = this.app?.gemini || {};
        const model = GEMINI_ALLOWED_MODELS.includes(config.model ?? '')
            ? (config.model as string)
            : DEFAULT_GEMINI_MODEL;
        const temperature = DEFAULT_GEMINI_TEMPERATURE;
        const contextBlock = this.buildContextBlock();
        const historyContents = this.buildHistoryContents(options.history || []);

        const userContent = options.promptType === 'risk_check'
            ? this.buildRiskCheckPrompt(contextBlock)
            : options.promptType === 'strategy_ideas'
                ? this.buildStrategyIdeasPrompt(contextBlock)
                : options.promptType === 'portfolio_health'
                    ? this.buildPortfolioHealthPrompt(contextBlock, null)
                    : this.buildPortfolioHealthPrompt(contextBlock, question);

        const contents = [
            ...historyContents,
            {
                role: 'user',
                parts: [{ text: userContent }]
            }
        ];

        const generationConfig: Record<string, unknown> = {
            maxOutputTokens: this.app.gemini?.maxOutputTokens || DEFAULT_GEMINI_MAX_TOKENS
        };

        generationConfig.temperature = Number(temperature.toFixed(2));

        return {
            model,
            body: {
                contents,
                generationConfig
            }
        };
    }

    buildPortfolioHealthPrompt(contextBlock: string, question: string | null): string {
        return [
            '# ROLE & PHILOSOPHY',
            'You are a disciplined options trading coach specializing in income-focused\nretail portfolios. Your responses are concise, data-driven, and honest —\nincluding about the limits of the data itself. You never fabricate missing\nvalues or force conclusions that the data does not support.',
            '---',
            '# PORTFOLIO DATA',
            contextBlock,
            '---',
            '# TRADER\'S OBJECTIVE',
            question || 'Deliver a portfolio health check focused on:\n1. Capital utilization and idle cash risk\n2. Strategy concentration and single-ticker exposure\n3. Identifying any open positions at immediate risk (low DTE, breached\n   strikes, prior rolls) — or explicitly stating none exist if the\n   active position list is empty',
            '---',
            '# ANALYSIS INSTRUCTIONS',
            'Follow these steps in order. Skip any step that is not applicable\ngiven the data, and say so explicitly rather than padding.\n\n## Step 0 — Data Integrity Check (always run first)\nBefore any analysis, scan for anomalies:\n- Does `largestLoser.pl` equal `largestWinner.pl`? If yes, flag as a\n  possible data artifact and note that loss analysis is unavailable.\n- Does `exitPrice` in `recentClosedTrades` conflict with the `notes`\n  field? If yes, use the notes as ground truth and flag the discrepancy.\n- Are `activePositions` and `dteDistribution` both empty/zero?\n  If yes, note that open-position risk analysis is not applicable.\n\n## Step 1 — Acknowledge Strengths (2–3 sentences max)\nState win rate, realized P&L, annualized ROI, and fee efficiency\n(fees.shareOfGross). Be factual — do not inflate a 1-trade sample\ninto a pattern.\n\n## Step 2 — Top Risks (identify 2–3, each with a specific data citation)\nPrioritize in this order:\n1. Idle capital risk — if `activePositions` is empty and\n   `daysSinceLastTrade` > 30, quantify the opportunity cost.\n2. Concentration risk — cite specific ticker(s) from `tickerExposure`\n   where a single name represents > 50% of realized P&L or capital at risk.\n3. Sample-size risk — if `totalTrades` < 5, explicitly warn that\n   win rate and ROI figures are statistically meaningless and should\n   not drive sizing decisions.\n4. Open position risk — only if `activePositions` is non-empty:\n   flag positions with DTE ≤ 14, any noted prior rolls, or strikes\n   within 3% of current price.\n\n## Step 3 — Actionable Recommendations (bullet list)\nEach bullet must reference a specific data point.\n- Position sizing: propose a max-collateral-per-trade rule based on\n  the account size implied by `totalMaxRisk`.\n- Diversification: suggest minimum ticker and sector count targets\n  before the next trade is opened.\n- Behavioral: if `daysSinceLastTrade` > 60, address inactivity as a\n  capital efficiency risk, not just a streak observation.\n\n## Step 4 — Next Steps (2–3 forward-looking actions)\nConcrete, time-bound. No vague advice like "stay disciplined."',
            '---',
            '# OUTPUT FORMAT',
            '- Tone: direct, risk-aware, educational\n- Length: 350–500 words (adjust naturally; do not truncate to hit a cap)\n- Structure: headers for each step, bullets for recommendations\n- Flag any field you cannot interpret clearly rather than guessing\n- Close with: "This analysis is educational only and does not\n  constitute financial advice."'
        ].join('\n\n');
    }

    buildRiskCheckPrompt(contextBlock: string): string {
        return [
            '# ROLE',
            'You are a disciplined options risk analyst. Your job is to assess\ncurrent and forward-looking risk exposure with precision. You cite\nspecific data fields, flag anomalies, and never manufacture risk\nfindings where the data does not support them.',
            '---',
            '# PORTFOLIO DATA',
            contextBlock,
            '---',
            '# TRADER\'S OBJECTIVE',
            'Identify the largest concentration risk in this portfolio and, where\nan open position exists, propose a specific strategy to reduce its\nleverage or exposure. Reference drawdown data only where it is\nstatistically valid.',
            '---',
            '# ANALYSIS INSTRUCTIONS',
            '## Step 0 — Data Integrity & State Classification (always run first)\n\nRun these checks before any analysis:\n\n**Data anomalies:**\n- If `largestLoser.pl` equals `largestWinner.pl`, flag as a data\n  artifact. State: "Loss-side analysis is unavailable."\n- If `exitPrice` in `recentClosedTrades` conflicts with the `notes`\n  field, use notes as ground truth and flag the discrepancy explicitly.\n- If `maxDrawdown` is 0 and `totalTrades` < 5, state:\n  "Max Drawdown of 0% is a sample-size artifact, not a risk signal.\n  It will not be used to draw conclusions."\n\n**Portfolio state — classify as exactly one of:**\n- **LIVE**: `activePositions` is non-empty → proceed to all steps\n- **FLAT**: `activePositions` is empty → Step 2 becomes a\n  *forward-looking* risk analysis for the next trade; skip all\n  open-position sub-items. State this classification clearly.',
            '---',
            '# OUTPUT FORMAT',
            '- Tone: analytical, direct, risk-first\n- Length: 400–550 words\n- Close with: "This analysis is educational only and does not\n  constitute financial advice."'
        ].join('\n\n');
    }

    buildStrategyIdeasPrompt(contextBlock: string): string {
        return [
            '# ROLE',
            'You are an options strategy analyst for income-focused retail\nportfolios.',
            '---',
            '# PORTFOLIO DATA',
            contextBlock,
            '---',
            '# TRADER\'S OBJECTIVE',
            'Based on the portfolio\'s historical strategy performance, assess\nwhether the current strategy mix is optimal and recommend specific\nstrategies to add, adjust, or avoid.',
            '---',
            '# OUTPUT FORMAT',
            '- Tone: analytical, strategy-focused, honest about data limits\n- Length: 450–600 words\n- Close with: "This analysis is educational only and does not\n  constitute financial advice."'
        ].join('\n\n');
    }

    buildHistoryContents(history: ChatMessage[]): Array<{ role: string; parts: Array<{ text: string }> }> {
        if (!Array.isArray(history) || history.length === 0) {
            return [];
        }

        return history
            .filter(entry => entry && !entry.pending && typeof entry.text === 'string' && (entry.text as string).trim().length > 0)
            .slice(-8)
            .map(entry => ({
                role: entry.sender === 'ai' ? 'model' : 'user',
                parts: [{ text: (entry.text as string).trim() }]
            }));
    }

    buildContextBlock(): string {
        try {
            const mcpContext = this.app.buildMCPContext();
            return JSON.stringify(mcpContext, null, 2);
        } catch (_err) {
            // Fallback: legacy hand-crafted snapshot if buildMCPContext fails
            const stats = this.context.stats || {};
            const totals = {
                totalPL: this.formatNumber(stats.totalPL, { style: 'currency' }),
                winRate: this.formatNumber(stats.winRate, { style: 'percent' }),
                profitFactor: Number.isFinite(stats.profitFactor as number)
                    ? this.formatNumber(stats.profitFactor, {})
                    : (stats.profitFactor === Number.POSITIVE_INFINITY ? 'Infinite' : null),
                totalROI: this.formatNumber(stats.totalROI, { style: 'percent' }),
                annualizedROI: this.formatNumber(stats.annualizedROI, { style: 'percent' }),
                maxDrawdown: this.formatNumber(stats.maxDrawdown, { style: 'percent' }),
                closedTrades: stats.closedTrades ?? 0,
                openPositions: stats.activePositions ?? (this.context.openTrades?.length || 0)
            };
            return JSON.stringify({
                totals,
                riskHeadline: this.fallback.buildRiskHeadline(),
                strategyHighlight: this.fallback.buildStrategyHeadline(),
                coachingHighlight: this.fallback.buildCoachingHighlight(),
                performanceHighlight: this.fallback.buildPerformanceSummary?.() || '',
                openPositions: this.buildOpenPositionsSummary(),
                topStrategies: this.buildStrategySummary()
            }, null, 2);
        }
    }

    buildOpenPositionsSummary(limit = 8): SnapshotValue[] {
        const trades = Array.isArray(this.context.openTrades) ? this.context.openTrades : [];
        return trades.slice(0, limit).map(trade => {
            const snapshot = this.snapshotObjectForPrompt(trade);
            const derived: Record<string, unknown> = {};

            const dteValue = Number.isFinite(trade?.dte as number) ? Number(trade.dte) : this.deriveDTE(trade);
            if (Number.isFinite(dteValue)) {
                derived.calculatedDTE = Math.max(Math.round(dteValue as number), 0);
            }

            const riskValue = Number(this.app.getCapitalAtRisk(trade));
            if (Number.isFinite(riskValue)) {
                derived.calculatedMaxRisk = Number(riskValue.toFixed(2));
            }

            const notePreview = this.cleanNote(trade?.notes as string | undefined);
            if (notePreview) {
                derived.notePreview = notePreview;
            }

            if (Object.keys(derived).length) {
                (snapshot as Record<string, unknown>).__promptDerived = derived;
            }

            return snapshot as SnapshotValue;
        });
    }

    deriveDTE(trade: Record<string, unknown>): number | null {
        if (!trade?.expirationDate) {
            return null;
        }
        try {
            return this.app.calculateDTE(trade.expirationDate as string, trade);
        } catch (_error) {
            return null;
        }
    }

    buildStrategySummary(limit = 5): Array<Record<string, unknown>> {
        const breakdown = this.fallback.getStrategyBreakdown();
        return breakdown.slice(0, limit).map(entry => ({
            name: entry.name,
            trades: entry.trades,
            wins: entry.wins,
            losses: entry.losses,
            realisedPL: this.formatNumber(entry.pl, { style: 'currency' }),
            winRate: entry.trades > 0 ? this.formatNumber((entry.wins / entry.trades) * 100, { style: 'percent' }) : null
        }));
    }

    snapshotObjectForPrompt(source: unknown): Record<string, SnapshotValue> {
        const snapshot = this.snapshotForPrompt(source);
        if (snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)) {
            return snapshot as Record<string, SnapshotValue>;
        }
        return {};
    }

    snapshotForPrompt(value: unknown): SnapshotValue {
        if (value === null || value === undefined) {
            return null;
        }

        if (typeof value === 'number') {
            return Number.isFinite(value) ? Number(value) : null;
        }

        if (typeof value === 'string' || typeof value === 'boolean') {
            return value;
        }

        if (value instanceof Date) {
            return value.toISOString();
        }

        if (Array.isArray(value)) {
            return value.map(item => this.snapshotForPrompt(item));
        }

        if (typeof value === 'object') {
            const result: Record<string, SnapshotValue> = {};
            for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
                if (typeof val === 'function') {
                    continue;
                }
                result[key] = this.snapshotForPrompt(val);
            }
            return result;
        }

        return null;
    }

    cleanNote(value: string | undefined): string {
        if (!value) {
            return '';
        }
        const text = value.toString().trim();
        if (text.length <= 180) {
            return text;
        }
        return `${text.slice(0, 177)}…`;
    }

    formatNumber(value: unknown, options: Record<string, unknown> = {}): string | null {
        const fallback = Object.prototype.hasOwnProperty.call(options || {}, 'fallback')
            ? (options.fallback as string | null)
            : null;

        if (!this.app || typeof this.app.formatNumber !== 'function') {
            return fallback;
        }

        const normalizedOptions = { ...(options || {}) };
        delete normalizedOptions.fallback;

        if (normalizedOptions.style === 'string') {
            normalizedOptions.style = 'number';
        }

        if (normalizedOptions.style === 'percent') {
            const percentOptions: Record<string, unknown> = {};
            if (Number.isInteger(normalizedOptions.decimals)) {
                percentOptions.decimals = normalizedOptions.decimals;
            }
            return this.app.formatPercent?.(value, fallback ?? '—', percentOptions) ?? fallback;
        }

        const formatted = this.app.formatNumber(value, normalizedOptions);
        return formatted ?? fallback;
    }

    formatPercent(value: unknown, fallback: string | null, options: Record<string, unknown> | undefined): string | null {
        if (!this.app || typeof this.app.formatPercent !== 'function') {
            return fallback ?? null;
        }
        return this.app.formatPercent(value, fallback ?? '—', options) ?? fallback;
    }

    async callGemini({ model, body }: RequestPayload): Promise<string> {
        const apiKey = this.app?.gemini?.apiKey;

        if (!apiKey) {
            throw new Error('Missing Gemini API key');
        }

        const base = DEFAULT_GEMINI_ENDPOINT.replace(/\/+$/, '');
        const normalizedModel = (model || DEFAULT_GEMINI_MODEL).replace(/^models\//i, '');
        const modelSegment = encodeURIComponent(normalizedModel);
        const urlBase = `${base}/${modelSegment}:generateContent`;
        const url = `${urlBase}?key=${encodeURIComponent(apiKey)}`;

        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timeoutId = controller ? setTimeout(() => controller.abort(), 120_000) : null;

        try {
            const httpResponse = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': apiKey
                },
                body: JSON.stringify(body),
                signal: controller?.signal
            });

            // Parse response body — fall back to an empty object so shape guards
            // always receive a value they can inspect.
            const rawData: unknown = await httpResponse.json().catch(() => ({}));

            if (!isGeminiApiResponse(rawData)) {
                if (!httpResponse.ok) {
                    throw new Error(`HTTP ${httpResponse.status}`);
                }
                return '';
            }

            // Surface any API-level error raised by Gemini
            const errorMsg = extractGeminiError(rawData, httpResponse.status);
            if (errorMsg || !httpResponse.ok) {
                throw new Error(errorMsg ?? `HTTP ${httpResponse.status}`);
            }

            return extractGeminiText(rawData);
        } finally {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        }
    }
}
