import type { StorageSchema, Trade } from '@types-gl'

const CURRENT_STORAGE_VERSION = '2.5'
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

function normalizeLegacyLeg(leg: MutableRecord, tradeIndex: number, legIndex: number): MutableRecord {
    const id = normalizeString(leg.id) || `legacy-${tradeIndex}-leg-${legIndex}`;
    return {
        ...leg,
        id
    };
}

function normalizeLegacyTrade(trade: MutableRecord, index: number): Trade {
    const id = normalizeString(trade.id) || `legacy-${index}`;
    const legs = Array.isArray(trade.legs)
        ? trade.legs
            .filter(isRecord)
            .map((leg, legIndex) => normalizeLegacyLeg(leg, index, legIndex))
        : [];

    return {
        ...trade,
        id,
        legs
    } as unknown as Trade;
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

    if (version < LEGACY_MIGRATION_VERSION || typeof source.version !== 'string') {
        source.version = CURRENT_STORAGE_VERSION;
    }

    source.exportDate = normalizeTimestamp(source.exportDate ?? source.timestamp);

    return source as unknown as StorageSchema;
}
