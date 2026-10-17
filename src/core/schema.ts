// src/core/schema.ts — Zod schemas for storage and form validation.

import { z } from 'zod'
import { AI_PROVIDER_IDS, CURRENT_STORAGE_VERSION, OPENROUTER_MAX_FALLBACK_MODELS } from './config.js'
import type { CompanyProfile, EarningsSurprise, SignalsData, StockMetrics } from '../types/integrations.js'

export const UNDERLYING_TYPES = ['Stock', 'ETF', 'Index', 'Future'] as const;
export const ORDER_TYPES = ['BTO', 'STO', 'BTC', 'STC'] as const;
export const LEG_TYPES = ['CALL', 'PUT', 'STOCK', 'CASH', 'FUTURE', 'ETF'] as const;
export const LEG_ACTIONS = ['BUY', 'SELL'] as const;
export const LEG_SIDES = ['OPEN', 'CLOSE', 'ROLL'] as const;
export const TRADE_STATUSES = ['Open', 'Closed', 'Assigned', 'Expired', 'Rolling', 'awaiting_coverage'] as const;

export const UnderlyingTypeSchema = z.enum(UNDERLYING_TYPES);
export const OrderTypeSchema = z.enum(ORDER_TYPES);
export const LegTypeSchema = z.enum(LEG_TYPES);
export const LegActionSchema = z.enum(LEG_ACTIONS);
export const LegSideSchema = z.enum(LEG_SIDES);
export const TradeStatusSchema = z.enum(TRADE_STATUSES);

const UnknownRecordSchema = z.record(z.string(), z.unknown());

function normalizeText(value: unknown): string {
    return value === undefined || value === null ? '' : String(value).trim();
}

function optionalText(value: unknown): string | undefined {
    const text = normalizeText(value);
    return text ? text : undefined;
}

function optionalNullableText(value: unknown): string | null | undefined {
    if (value === null) {
        return null;
    }
    return optionalText(value);
}

function parseFiniteNumber(value: unknown): number | undefined {
    if (value === undefined || value === null || value === '') {
        return undefined;
    }

    let normalized: unknown = value;
    if (typeof value === 'string') {
        let text = value.trim().replace(/\s+/g, '');
        if (!text) {
            return undefined;
        }

        const hasComma = text.includes(',');
        const hasDot = text.includes('.');
        if (hasComma && !hasDot) {
            text = text.replace(/,/g, '.');
        } else if (hasComma && hasDot) {
            const lastComma = text.lastIndexOf(',');
            const lastDot = text.lastIndexOf('.');
            text = lastComma > lastDot
                ? text.replace(/\./g, '').replace(/,/g, '.')
                : text.replace(/,/g, '');
        }

        normalized = text.replace(/_/g, '');
    }

    const numeric = Number(normalized);
    return Number.isFinite(numeric) ? numeric : undefined;
}

function parseFiniteInteger(value: unknown): number | undefined {
    if (value === undefined || value === null || value === '') {
        return undefined;
    }

    const text = String(value).trim();
    if (!text) {
        return undefined;
    }

    const numeric = Number(text);
    if (!Number.isFinite(numeric) || !Number.isInteger(numeric)) {
        return undefined;
    }

    return numeric;
}

function parseIsoDate(value: unknown): string {
    const text = normalizeText(value);
    if (!text) {
        return '';
    }

    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

const RequiredTextSchema = z.preprocess(
    normalizeText,
    z.string().min(1, 'This field is required.')
);

const OptionalTextSchema = z.preprocess(
    optionalText,
    z.string().optional()
);

const OptionalNullableTextSchema = z.preprocess(
    optionalNullableText,
    z.string().nullable().optional()
);

const OptionalFiniteNumberSchema = z.preprocess(
    value => value === null ? null : parseFiniteNumber(value),
    z.number().finite().nullable().optional()
);

const OptionalBooleanSchema = z.boolean().nullable().optional();

const IsoDateOrEmptySchema = z.preprocess(
    parseIsoDate,
    z.string()
);

const ImportableLegShapeSchema = UnknownRecordSchema;
const ImportableTradeShapeSchema = z.object({
    legs: z.array(ImportableLegShapeSchema).optional()
}).passthrough();

export const ImportableStorageShapeSchema = z.preprocess(
    raw => Array.isArray(raw) ? { trades: raw } : raw,
    z.object({
        trades: z.array(ImportableTradeShapeSchema)
    }).passthrough()
);

export const PersistedLegSchema = z.object({
    id: RequiredTextSchema,
    orderType: OrderTypeSchema.nullish(),
    type: LegTypeSchema.nullish(),
    quantity: OptionalFiniteNumberSchema,
    multiplier: OptionalFiniteNumberSchema.refine(
        value => value === undefined || value === null || value > 0,
        'multiplier must be greater than zero'
    ),
    executionDate: OptionalTextSchema,
    executionTimestamp: OptionalTextSchema,
    brokerTimeZone: OptionalTextSchema,
    expirationDate: OptionalTextSchema,
    strike: OptionalFiniteNumberSchema,
    premium: OptionalFiniteNumberSchema,
    fees: OptionalFiniteNumberSchema,
    underlyingPrice: OptionalFiniteNumberSchema,
    externalId: OptionalNullableTextSchema,
    importGroupId: OptionalNullableTextSchema,
    importSource: OptionalNullableTextSchema,
    schwabSymbol: OptionalNullableTextSchema,
    action: LegActionSchema.nullish(),
    side: LegSideSchema.nullish(),
    isAssignment: OptionalBooleanSchema,
    notes: OptionalTextSchema
}).passthrough();

export const PersistedTradeSchema = z.object({
    id: RequiredTextSchema,
    ticker: OptionalTextSchema,
    strategy: OptionalTextSchema,
    underlyingType: UnderlyingTypeSchema.nullish(),
    legs: z.array(PersistedLegSchema),
    openedDate: OptionalTextSchema,
    closedDate: OptionalTextSchema,
    expirationDate: OptionalTextSchema,
    notes: OptionalTextSchema,
    tradeReasoning: OptionalTextSchema,
    exitReason: OptionalTextSchema,
    maxRiskOverride: OptionalFiniteNumberSchema,
    status: TradeStatusSchema.nullish(),
    statusOverride: TradeStatusSchema.nullish(),
    marketPriceSnapshot: OptionalFiniteNumberSchema,
    marketPriceSnapshotAt: OptionalTextSchema
}).passthrough();

export const WatchlistEntrySchema = z.object({
    ticker: z.string().min(1),
    rating: z.number().int().min(1).max(5).nullable().catch(null).default(null),
    notes: z.string().catch('').default(''),
    addedDate: z.string().catch('').default(''),
    targetPrice: z.number().nullable().optional(),
    targetDirection: z.enum(['up', 'down']).optional()
}).passthrough();

export const SchwabVaultEnvelopeSchema = z.object({
    version: z.literal(1),
    iterations: z.number().int().min(100_000),
    salt: z.string().min(1),
    iv: z.string().min(1),
    ciphertext: z.string().min(1)
}).strict();

export const SchwabVaultPayloadSchema = z.object({
    clientId: z.string().trim().min(1),
    clientSecret: z.string().min(1),
    callbackUrl: z.string().url(),
    accessToken: z.string().optional(),
    refreshToken: z.string().optional(),
    accessTokenExpiresAt: z.number().finite().optional(),
    refreshTokenExpiresAt: z.number().finite().optional()
}).strict();

export const SchwabSettingsSchema = z.object({
    automaticRefresh: z.boolean().default(false)
}).strict();

export const AIProviderSelectionSchema = z.object({
    version: z.literal(1),
    active: z.enum(AI_PROVIDER_IDS)
}).strict();

export const AICoachConsentSchema = z.object({
    at: z.string().min(1),
    provider: z.enum(AI_PROVIDER_IDS),
    /**
     * 2 = also covers position/watchlist research data (Ask Coach, AI verdict, thesis drift) and,
     * with OpenRouter, typed decisions answered by JEV (TypeSafe AI) through OpenRouter.
     */
    version: z.literal(2).optional()
}).strict();

export type AICoachConsentRecord = z.infer<typeof AICoachConsentSchema>;

export const EncryptedSecretSchema = z.object({
    iv: z.string().min(1),
    ct: z.string().min(1)
}).strict();

export const OpenRouterConfigSchema = z.object({
    version: z.literal(1),
    model: z.string().trim().min(1),
    fallbackModels: z.array(z.string().trim().min(1)).max(OPENROUTER_MAX_FALLBACK_MODELS).default([]),
    dataCollection: z.enum(['deny', 'allow']).default('deny'),
    /** Custom JEV release for typed decisions; absent = the app default (`JEV_DEFAULT_MODEL`). */
    jevModel: z.string().trim().min(1).optional(),
    payload: EncryptedSecretSchema.optional(),
    apiKey: z.string().optional()
}).strict();

export type OpenRouterConfig = z.infer<typeof OpenRouterConfigSchema>;

/** Optional account size in USD used by the AI Coach to express risk as % of account. */
export const AccountSizeSchema = z.number().finite().positive().max(1e10);

const NullableFiniteNumberSchema = z.number().finite().nullable();

export const SchwabOptionQuoteSchema = z.object({
    symbol: z.string().min(1),
    bid: NullableFiniteNumberSchema,
    ask: NullableFiniteNumberSchema,
    last: NullableFiniteNumberSchema,
    mark: NullableFiniteNumberSchema,
    midpoint: NullableFiniteNumberSchema,
    multiplier: z.number().finite().positive(),
    providerTimestamp: z.string().nullable(),
    capturedAt: z.string().datetime()
}).strict();

export const SchwabTradeQuoteSchema = z.object({
    tradeId: z.string(),
    ticker: z.string(),
    netMark: NullableFiniteNumberSchema,
    liquidationMark: NullableFiniteNumberSchema,
    marketValue: NullableFiniteNumberSchema,
    openingCashFlow: z.number().finite(),
    unrealizedPL: NullableFiniteNumberSchema,
    legs: z.array(SchwabOptionQuoteSchema.extend({
        legId: z.string(),
        side: z.enum(['long', 'short']),
        quantity: z.number().finite().nonnegative()
    })),
    capturedAt: z.string().datetime(),
    error: z.string().optional()
}).strict();

export const SchwabQuoteCacheSchema = z.object({
    version: z.literal(1),
    underlying: z.record(z.string(), z.object({
        price: z.number().finite().positive(),
        capturedAt: z.string().datetime(),
        providerTimestamp: z.string().nullable()
    }).strict()),
    trades: z.record(z.string(), SchwabTradeQuoteSchema)
}).strict();

// ── Market research cache (Finnhub per-ticker research with fetch times) ──────────────────────

const NullableNumber = z.number().finite().nullable();
const SeriesSchema = z.array(z.object({ period: z.string(), v: z.number().finite() }).strict());
const METRIC_NUMBER_KEYS = [
    'currentPrice', 'beta', 'marketCap', 'vol3MonthStd', 'return5Day', 'return13Week', 'return52Week',
    'week52High', 'week52Low', 'vol10DayAvg', 'vol3MonthAvg', 'priceRelToSP500_13W', 'peTTM', 'forwardPE',
    'forwardPEG', 'pfcfTTM', 'evFCF', 'evEbitda', 'grossMarginTTM', 'operatingMarginTTM', 'netMarginTTM',
    'fcfMarginLatest', 'roeTTM', 'revenueGrowthYoY', 'epsGrowthYoY', 'currentRatio', 'netDebtToEquity',
    'debtToEquity', 'interestCoverage'
] as const;

const StockMetricsShape = z.object({
    ...Object.fromEntries(METRIC_NUMBER_KEYS.map(key => [key, NullableNumber])) as Record<typeof METRIC_NUMBER_KEYS[number], typeof NullableNumber>,
    week52HighDate: z.string().nullable(),
    week52LowDate: z.string().nullable(),
    epsAnnual: SeriesSchema,
    peAnnualSeries: SeriesSchema,
    grossMarginSeries: SeriesSchema,
    fcfPerShareSeries: SeriesSchema
}).strict();

const SignalsDataShape = z.object({
    recommendation: z.object({
        period: z.string(), strongBuy: z.number(), buy: z.number(), hold: z.number(), sell: z.number(), strongSell: z.number()
    }).strict().nullable(),
    news: z.array(z.object({
        headline: z.string(), datetime: z.number(), url: z.string(), source: z.string(), summary: z.string()
    }).strict()),
    insiderTransactions: z.array(z.object({
        transactionType: z.string(), transactionCode: z.string().nullable(), isDerivative: z.boolean(), name: z.string(),
        share: NullableNumber, value: NullableNumber, filingDate: z.string()
    }).strict())
}).strict();

const EarningsSurpriseListShape = z.array(z.object({
    period: z.string(), quarter: z.number(), year: z.number(),
    actual: NullableNumber, estimate: NullableNumber, surprisePercent: NullableNumber
}).strict());

const CompanyProfileShape = z.object({
    name: z.string(), industry: z.string(), logo: z.string(), exchange: z.string()
}).strict();

// The shapes validate; z.custom keeps the app's own interfaces as the output type (outside the strict
// subprojects Zod infers every nullable field as optional, which those interfaces don't allow).
export const StockMetricsSchema = z.custom<StockMetrics>(value => StockMetricsShape.safeParse(value).success);
export const SignalsDataSchema = z.custom<SignalsData>(value => SignalsDataShape.safeParse(value).success);
export const EarningsSurpriseListSchema = z.custom<EarningsSurprise[]>(value => EarningsSurpriseListShape.safeParse(value).success);
export const CompanyProfileSchema = z.custom<CompanyProfile>(value => CompanyProfileShape.safeParse(value).success);

/** Next earnings date as last checked; date null = none found in the look-ahead window. */
export const EarningsDateRecordSchema = z.object({
    date: z.string().nullable(),
    hour: z.string(),
    quarter: NullableNumber,
    year: NullableNumber,
    epsEstimate: NullableNumber
}).strict();

const stamped = <T extends z.ZodTypeAny>(data: T) => z.object({ at: z.number().int().positive(), data }).strict();

export const MarketResearchEntrySchema = z.object({
    metrics: stamped(StockMetricsSchema).optional(),
    signals: stamped(SignalsDataSchema).optional(),
    surprises: stamped(EarningsSurpriseListSchema).optional(),
    earnings: stamped(EarningsDateRecordSchema).optional(),
    profile: stamped(CompanyProfileSchema).optional()
}).strict();

export const MarketResearchCacheSchema = z.object({
    version: z.literal(1),
    tickers: z.record(z.string(), MarketResearchEntrySchema)
}).strict();

export const WatchlistScanHistorySchema = z.object({
    version: z.literal(1),
    asOf: z.string(),
    rows: z.array(z.object({
        ticker: z.string(),
        quality: z.enum(['strong', 'decent', 'mixed', 'weak']),
        stars: z.number().int().min(1).max(5)
    }).strict())
}).strict();

export type MarketResearchEntry = z.infer<typeof MarketResearchEntrySchema>;
export type MarketResearchCache = z.infer<typeof MarketResearchCacheSchema>;
export type WatchlistScanHistory = z.infer<typeof WatchlistScanHistorySchema>;

export const StorageSchema = z.object({
    version: z.literal(CURRENT_STORAGE_VERSION),
    exportDate: RequiredTextSchema,
    trades: z.array(PersistedTradeSchema),
    mcpContext: z.unknown().optional(),
    // Corrupted watchlist data must never block trade data from loading —
    // fall back to an empty list rather than failing the whole import.
    watchlist: z.array(WatchlistEntrySchema).catch([]).optional()
}).passthrough();

export const NormalizedLegInputSchema = z.object({
    id: OptionalTextSchema,
    orderType: OptionalTextSchema,
    tradeType: OptionalTextSchema,
    order: OptionalTextSchema,
    action: OptionalTextSchema,
    side: OptionalTextSchema,
    type: OptionalTextSchema,
    quantity: z.preprocess(parseFiniteNumber, z.number().finite().optional()),
    multiplier: z.preprocess(parseFiniteNumber, z.number().finite().positive().optional()),
    executionDate: IsoDateOrEmptySchema,
    expirationDate: IsoDateOrEmptySchema,
    strike: z.preprocess(parseFiniteNumber, z.number().finite().optional()),
    premium: z.preprocess(parseFiniteNumber, z.number().finite().optional()),
    fees: z.preprocess(parseFiniteNumber, z.number().finite().optional()),
    underlyingPrice: z.preprocess(parseFiniteNumber, z.number().finite().optional()),
    externalId: OptionalNullableTextSchema,
    importGroupId: OptionalNullableTextSchema,
    importSource: OptionalNullableTextSchema,
    schwabSymbol: OptionalNullableTextSchema
}).passthrough();

function numericFormSchema({
    field,
    integer = false,
    defaultValue,
    allowNegative = true
}: {
    field: string
    integer?: boolean
    defaultValue?: number | null
    allowNegative?: boolean
}) {
    const numberSchema = z.number({
        error: `${field} must be a valid number.`
    }).finite(`${field} must be a finite number.`);
    const targetSchema = defaultValue === null ? numberSchema.nullable() : numberSchema;

    return z.preprocess((value) => {
        const parsed = integer ? parseFiniteInteger(value) : parseFiniteNumber(value);
        return parsed === undefined ? defaultValue : parsed;
    }, targetSchema)
        .refine(value => value === null || allowNegative || value >= 0, `${field} cannot be negative.`);
}

export const LegFormInputSchema = z.object({
    id: RequiredTextSchema,
    orderType: OrderTypeSchema,
    type: z.enum(['CALL', 'PUT', 'STOCK', 'CASH']),
    quantity: numericFormSchema({
        field: 'Quantity',
        integer: true,
        allowNegative: false
    })
        .refine(value => value !== null && Number.isInteger(value), 'Quantity must be a whole number.')
        .refine(value => value !== null && value > 0, 'Quantity must be greater than 0.'),
    multiplier: z.preprocess(
        parseFiniteInteger,
        z.number().int().positive().optional()
    ),
    executionDate: IsoDateOrEmptySchema,
    expirationDate: IsoDateOrEmptySchema,
    strike: numericFormSchema({
        field: 'Strike',
        defaultValue: null,
        allowNegative: false
    }),
    premium: numericFormSchema({
        field: 'Premium',
        defaultValue: 0,
        allowNegative: false
    }),
    fees: numericFormSchema({
        field: 'Fees',
        defaultValue: 0,
        allowNegative: true
    }),
    underlyingPrice: numericFormSchema({
        field: 'Underlying price',
        defaultValue: null,
        allowNegative: false
    })
});

export const TradeFormInputSchema = z.object({
    ticker: z.preprocess(
        value => normalizeText(value).toUpperCase(),
        z.string().min(1, 'Ticker is required.')
    ),
    strategy: z.preprocess(
        normalizeText,
        z.string().min(1, 'Strategy is required.')
    ),
    underlyingType: UnderlyingTypeSchema,
    tradeStatus: z.union([TradeStatusSchema, z.literal('')]).optional(),
    exitReason: z.preprocess(normalizeText, z.string()),
    notes: z.preprocess(normalizeText, z.string())
});

export type PersistedLegInput = z.infer<typeof PersistedLegSchema>
export type PersistedTradeInput = z.infer<typeof PersistedTradeSchema>
export type StorageInput = z.infer<typeof StorageSchema>
export type NormalizedLegInput = z.infer<typeof NormalizedLegInputSchema>
export type LegFormInput = z.infer<typeof LegFormInputSchema>
export type TradeFormInput = z.infer<typeof TradeFormInputSchema>

export function formatZodIssues(error: z.ZodError, prefix = ''): string {
    return error.issues
        .map(issue => {
            const path = issue.path.length ? issue.path.join('.') : '';
            const label = prefix || path;
            return label ? `${label}: ${issue.message}` : issue.message;
        })
        .join('\n');
}
