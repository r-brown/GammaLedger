// src/core/schema.ts — Zod schemas for storage and form validation.

import { z } from 'zod'
import { CURRENT_STORAGE_VERSION } from './config.js'

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
    expirationDate: OptionalTextSchema,
    strike: OptionalFiniteNumberSchema,
    premium: OptionalFiniteNumberSchema,
    fees: OptionalFiniteNumberSchema,
    underlyingPrice: OptionalFiniteNumberSchema,
    underlyingType: UnderlyingTypeSchema.nullish(),
    externalId: OptionalNullableTextSchema,
    importGroupId: OptionalNullableTextSchema,
    importSource: OptionalNullableTextSchema,
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

export const StorageSchema = z.object({
    version: z.literal(CURRENT_STORAGE_VERSION),
    exportDate: RequiredTextSchema,
    trades: z.array(PersistedTradeSchema),
    mcpContext: z.unknown().optional()
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
    underlyingType: OptionalTextSchema,
    externalId: OptionalNullableTextSchema,
    importGroupId: OptionalNullableTextSchema,
    importSource: OptionalNullableTextSchema
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
    }),
    underlyingType: UnderlyingTypeSchema
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
