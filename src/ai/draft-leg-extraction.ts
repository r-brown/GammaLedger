// src/ai/draft-leg-extraction.ts — screenshot → draft trade legs: JSON Schema sent to the
// model, the extraction prompt, and a lenient Zod parse of whatever comes back.

import { z } from 'zod'

export const DRAFT_LEG_SCHEMA_NAME = 'draft_leg_extraction'

export const DRAFT_LEG_EXTRACTION_SCHEMA = {
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

export function buildDraftLegExtractionPrompt(metadataJson: string): string {
    return `# ROLE

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
- If a complete trade date is visible in the screenshot, use it as the primary source and normalize it to YYYY-MM-DD
- If no complete trade date is visible in the screenshot, try to determine tradeDate from the screenshot filename
- Use the filename date only when it is unambiguous, for example: Trade 2026-05-18 21-51-50.png/jpeg
- If only month and day are visible, but no year, fill in the year from currentDate
- If no trade date is visible in the screenshot and no usable filename date is available, use currentDate as tradeDate without adding a warning
- If multiple dates are present, prefer the visible trade-row date over the filename date and currentDate
- Do not invent timezone. Use null unless timezone is explicitly visible or provided by client metadata

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

${metadataJson}`;
}

// Scalars stay loose (string | number) — sanitizeDraftRow in chat.ts normalises them,
// and models without structured output often quote numbers or change enum casing.
const scalar = z.union([z.string(), z.number()]).nullish().transform(value => value ?? null)

const DraftLegRowSchema = z.object({
    underlying: scalar,
    assetType: scalar,
    optionType: scalar,
    expiration: scalar,
    strike: scalar,
    optionAction: scalar,
    stockAction: scalar,
    quantity: scalar,
    price: scalar,
    fees: scalar,
    tradeDate: scalar,
    tradeTime: scalar,
    confidence: z.unknown().optional().transform(value => value ?? {}),
    needsUserReview: z.boolean().nullish().transform(value => value ?? true),
    warnings: z.array(z.string()).nullish().transform(value => value ?? []),
    rawText: scalar
})

export type DraftLegRow = z.infer<typeof DraftLegRowSchema>

const ExtractionEnvelopeSchema = z.object({
    broker: z.string().nullish().transform(value => (value && value.trim() ? value.trim() : null)),
    detectedRows: z.array(z.unknown()),
    warnings: z.array(z.unknown()).nullish()
        .transform(value => (value ?? []).filter((warning): warning is string => typeof warning === 'string'))
})

export interface DraftLegExtraction {
    broker: string | null
    detectedRows: DraftLegRow[]
    warnings: string[]
}

function parseJsonLenient(content: string): unknown {
    const trimmed = (content || '').trim()
    if (!trimmed) {
        throw new Error('Empty draft-leg extraction response.')
    }
    try {
        return JSON.parse(trimmed)
    } catch {
        const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim()
        if (fenced) {
            return JSON.parse(fenced)
        }
        const start = trimmed.indexOf('{')
        const end = trimmed.lastIndexOf('}')
        if (start !== -1 && end > start) {
            return JSON.parse(trimmed.slice(start, end + 1))
        }
        throw new Error('Draft-leg extraction response was not valid JSON.')
    }
}

export function parseDraftLegExtraction(content: string): DraftLegExtraction {
    const envelope = ExtractionEnvelopeSchema.safeParse(parseJsonLenient(content))
    if (!envelope.success) {
        throw new Error('The AI response did not match the draft-leg extraction shape.')
    }
    const rows: DraftLegRow[] = []
    const warnings = [...envelope.data.warnings]
    envelope.data.detectedRows.forEach((candidate, index) => {
        const row = DraftLegRowSchema.safeParse(candidate)
        if (row.success) {
            rows.push(row.data)
        } else {
            warnings.push(`Skipped row ${index + 1}: it did not match the expected fields.`)
        }
    })
    return { broker: envelope.data.broker, detectedRows: rows, warnings }
}
