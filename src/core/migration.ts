import type { StorageSchema, Trade } from '@types-gl'
import { CURRENT_STORAGE_VERSION } from '@core/config'

const LEGACY_MIGRATION_VERSION = 1
const VALID_UNDERLYING_TYPES = new Set(['Stock', 'ETF', 'Index', 'Future']);
const VALID_ORDER_TYPES = new Set(['BTO', 'STO', 'BTC', 'STC']);
const VALID_LEG_TYPES = new Set(['CALL', 'PUT', 'STOCK', 'CASH', 'FUTURE', 'ETF']);
const VALID_LEG_ACTIONS = new Set(['BUY', 'SELL']);
const VALID_LEG_SIDES = new Set(['OPEN', 'CLOSE', 'ROLL']);
const VALID_TRADE_STATUSES = new Set(['Open', 'Closed', 'Assigned', 'Expired', 'Rolling', 'awaiting_coverage']);

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

function isOptionalString(value: unknown): boolean {
    return value === undefined || value === null || typeof value === 'string';
}

function isOptionalFiniteNumber(value: unknown): boolean {
    return value === undefined || value === null || (typeof value === 'number' && Number.isFinite(value));
}

function isOptionalBoolean(value: unknown): boolean {
    return value === undefined || value === null || typeof value === 'boolean';
}

function assertStringField(value: unknown, path: string): void {
    if (typeof value !== 'string') {
        throw new Error(`Invalid database import: ${path} must be a string`);
    }
}

function assertOptionalStringField(value: unknown, path: string): void {
    if (!isOptionalString(value)) {
        throw new Error(`Invalid database import: ${path} must be a string when present`);
    }
}

function assertOptionalFiniteNumberField(value: unknown, path: string): void {
    if (!isOptionalFiniteNumber(value)) {
        throw new Error(`Invalid database import: ${path} must be a finite number when present`);
    }
}

function assertOptionalBooleanField(value: unknown, path: string): void {
    if (!isOptionalBoolean(value)) {
        throw new Error(`Invalid database import: ${path} must be a boolean when present`);
    }
}

function assertImportableStorageShape(raw: unknown): void {
    const source = Array.isArray(raw)
        ? { trades: raw }
        : raw;
    if (!isRecord(source)) {
        throw new Error('Invalid database import: root must be an object');
    }
    if (!Array.isArray(source.trades)) {
        throw new Error('Invalid database import: trades must be an array');
    }
    source.trades.forEach((trade, tradeIndex) => {
        const tradePath = `trades[${tradeIndex}]`;
        if (!isRecord(trade)) {
            throw new Error(`Invalid database import: ${tradePath} must be an object`);
        }
        if (trade.legs !== undefined && !Array.isArray(trade.legs)) {
            throw new Error(`Invalid database import: ${tradePath}.legs must be an array`);
        }
        if (Array.isArray(trade.legs)) {
            trade.legs.forEach((leg, legIndex) => {
                if (!isRecord(leg)) {
                    throw new Error(`Invalid database import: ${tradePath}.legs[${legIndex}] must be an object`);
                }
            });
        }
    });
}

function validatePersistedLeg(leg: unknown, path: string): void {
    if (!isRecord(leg)) {
        throw new Error(`Invalid database import: ${path} must be an object`);
    }

    assertStringField(leg.id, `${path}.id`);
    assertOptionalStringField(leg.orderType, `${path}.orderType`);
    if (typeof leg.orderType === 'string' && leg.orderType && !VALID_ORDER_TYPES.has(leg.orderType)) {
        throw new Error(`Invalid database import: ${path}.orderType is not supported`);
    }

    assertOptionalStringField(leg.type, `${path}.type`);
    if (typeof leg.type === 'string' && leg.type && !VALID_LEG_TYPES.has(leg.type)) {
        throw new Error(`Invalid database import: ${path}.type is not supported`);
    }

    assertOptionalFiniteNumberField(leg.quantity, `${path}.quantity`);
    assertOptionalFiniteNumberField(leg.multiplier, `${path}.multiplier`);
    if (typeof leg.multiplier === 'number' && leg.multiplier <= 0) {
        throw new Error(`Invalid database import: ${path}.multiplier must be greater than zero`);
    }

    assertOptionalFiniteNumberField(leg.strike, `${path}.strike`);
    assertOptionalFiniteNumberField(leg.premium, `${path}.premium`);
    assertOptionalFiniteNumberField(leg.fees, `${path}.fees`);
    assertOptionalFiniteNumberField(leg.underlyingPrice, `${path}.underlyingPrice`);
    assertOptionalStringField(leg.underlyingType, `${path}.underlyingType`);
    if (typeof leg.underlyingType === 'string' && leg.underlyingType && !VALID_UNDERLYING_TYPES.has(leg.underlyingType)) {
        throw new Error(`Invalid database import: ${path}.underlyingType is not supported`);
    }
    assertOptionalStringField(leg.executionDate, `${path}.executionDate`);
    assertOptionalStringField(leg.expirationDate, `${path}.expirationDate`);
    assertOptionalStringField(leg.externalId, `${path}.externalId`);
    assertOptionalStringField(leg.importGroupId, `${path}.importGroupId`);
    assertOptionalStringField(leg.importSource, `${path}.importSource`);
    assertOptionalStringField(leg.action, `${path}.action`);
    if (typeof leg.action === 'string' && leg.action && !VALID_LEG_ACTIONS.has(leg.action)) {
        throw new Error(`Invalid database import: ${path}.action is not supported`);
    }
    assertOptionalStringField(leg.side, `${path}.side`);
    if (typeof leg.side === 'string' && leg.side && !VALID_LEG_SIDES.has(leg.side)) {
        throw new Error(`Invalid database import: ${path}.side is not supported`);
    }
    assertOptionalBooleanField(leg.isAssignment, `${path}.isAssignment`);
    assertOptionalStringField(leg.notes, `${path}.notes`);
}

function validatePersistedTrade(trade: unknown, index: number): void {
    const path = `trades[${index}]`;
    if (!isRecord(trade)) {
        throw new Error(`Invalid database import: ${path} must be an object`);
    }

    assertStringField(trade.id, `${path}.id`);
    assertOptionalStringField(trade.ticker, `${path}.ticker`);
    assertOptionalStringField(trade.strategy, `${path}.strategy`);
    assertOptionalStringField(trade.openedDate, `${path}.openedDate`);
    assertOptionalStringField(trade.closedDate, `${path}.closedDate`);
    assertOptionalStringField(trade.expirationDate, `${path}.expirationDate`);
    assertOptionalStringField(trade.notes, `${path}.notes`);
    assertOptionalStringField(trade.tradeReasoning, `${path}.tradeReasoning`);
    assertOptionalFiniteNumberField(trade.maxRiskOverride, `${path}.maxRiskOverride`);

    if (typeof trade.underlyingType === 'string' && trade.underlyingType && !VALID_UNDERLYING_TYPES.has(trade.underlyingType)) {
        throw new Error(`Invalid database import: ${path}.underlyingType is not supported`);
    }

    if (typeof trade.status === 'string' && trade.status && !VALID_TRADE_STATUSES.has(trade.status)) {
        throw new Error(`Invalid database import: ${path}.status is not supported`);
    }

    if (!Array.isArray(trade.legs)) {
        throw new Error(`Invalid database import: ${path}.legs must be an array`);
    }
    trade.legs.forEach((leg, legIndex) => validatePersistedLeg(leg, `${path}.legs[${legIndex}]`));
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
    if (!isRecord(schema)) {
        throw new Error('Invalid database import: root must be an object');
    }
    if (schema.version !== CURRENT_STORAGE_VERSION) {
        throw new Error(`Invalid database import: version must be ${CURRENT_STORAGE_VERSION}`);
    }
    assertStringField(schema.exportDate, 'exportDate');
    if (!Array.isArray(schema.trades)) {
        throw new Error('Invalid database import: trades must be an array');
    }
    schema.trades.forEach((trade, index) => validatePersistedTrade(trade, index));
    return schema;
}

export function parseStorageSchema(raw: unknown): StorageSchema {
    assertImportableStorageShape(raw);
    return validateStorageSchema(migrateSchema(raw));
}
