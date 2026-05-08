import type { StorageSchema, Trade } from '@types-gl'
import { CURRENT_STORAGE_VERSION } from '@core/config'
import {
    ImportableStorageShapeSchema,
    StorageSchema as StoragePayloadSchema,
    formatZodIssues
} from '@core/schema'

const LEGACY_MIGRATION_VERSION = 1

type MutableRecord = Record<string, unknown>

function isRecord(value: unknown): value is MutableRecord {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getMigrationVersion(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
}

function normalizeString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function normalizeTimestamp(value: unknown): string {
    const text = normalizeString(value);
    if (text) {
        return text;
    }
    return new Date().toISOString();
}

function assertImportableStorageShape(raw: unknown): void {
    const result = ImportableStorageShapeSchema.safeParse(raw);
    if (!result.success) {
        throw new Error(`Invalid database import: ${formatZodIssues(result.error)}`);
    }
}

function normalizeLegacyLeg(leg: MutableRecord, tradeIndex: number, legIndex: number): MutableRecord {
    const id = normalizeString(leg.id) || `legacy-${tradeIndex}-leg-${legIndex}`;
    const normalized: MutableRecord = {
        ...leg,
        id
    };
    const orderType = normalizeString(leg.orderType) || normalizeString(leg.tradeType) || normalizeString(leg.order);
    if (orderType) {
        normalized.orderType = orderType;
    }
    delete normalized.tradeType;
    delete normalized.order;
    return normalized;
}

function normalizeLegacyTrade(trade: MutableRecord, index: number): Trade {
    const id = normalizeString(trade.id) || `legacy-${index}`;
    const legs = Array.isArray(trade.legs)
        ? trade.legs
            .filter(isRecord)
            .map((leg, legIndex) => normalizeLegacyLeg(leg, index, legIndex))
        : [];

    const normalized: MutableRecord = {
        ...trade,
        id,
        openedDate: normalizeString(trade.openedDate) || normalizeString(trade.entryDate),
        closedDate: normalizeString(trade.closedDate) || normalizeString(trade.exitDate),
        legs
    };
    delete normalized.entryDate;
    delete normalized.exitDate;
    return normalized as unknown as Trade;
}

export function emptySchema(): StorageSchema {
    return {
        version: CURRENT_STORAGE_VERSION,
        exportDate: new Date().toISOString(),
        trades: []
    };
}

export function migrateSchema(raw: unknown): StorageSchema {
    const source: MutableRecord | null = Array.isArray(raw)
        ? { version: 0, trades: raw }
        : (isRecord(raw) ? { ...raw } : null);

    if (!source) {
        return emptySchema();
    }

    const version = getMigrationVersion(source.version);
    const trades = Array.isArray(source.trades) ? source.trades : [];

    source.trades = trades
        .filter(isRecord)
        .map((trade, index) => normalizeLegacyTrade(trade, index));

    if (version < LEGACY_MIGRATION_VERSION || source.version !== CURRENT_STORAGE_VERSION) {
        source.version = CURRENT_STORAGE_VERSION;
    }

    source.exportDate = normalizeTimestamp(source.exportDate ?? source.timestamp);

    return source as unknown as StorageSchema;
}

export function validateStorageSchema(schema: StorageSchema): StorageSchema {
    const result = StoragePayloadSchema.safeParse(schema);
    if (!result.success) {
        throw new Error(`Invalid database import: ${formatZodIssues(result.error)}`);
    }
    return result.data as unknown as StorageSchema;
}

export function parseStorageSchema(raw: unknown): StorageSchema {
    assertImportableStorageShape(raw);
    return validateStorageSchema(migrateSchema(raw));
}
