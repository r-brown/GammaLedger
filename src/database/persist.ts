// src/database/persist.ts — Wave 11: Database persistence (save/load/export/import).
// Uses the .call(this, …) delegation pattern.

import {
    LOCAL_STORAGE_KEY,
    LEGACY_STORAGE_KEYS,
    RUNTIME_TRADE_FIELDS,
    RUNTIME_LEG_FIELDS,
    CURRENT_STORAGE_VERSION
} from '@core/config'
import { parseStorageSchema } from '@core/migration'
import { safeLocalStorage } from '@core/storage'

type TradeRecord = Record<string, unknown>
type StorageSnapshot = Record<string, unknown>
const PERSISTED_LEG_PROVENANCE_FIELDS = new Set(['externalId', 'importGroupId', 'importSource']);

class StaleFileError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'StaleFileError';
    }
}

interface PickerFileHandle {
    name: string
    getFile(): Promise<File>
    createWritable(): Promise<{ write(data: unknown): Promise<void>; close(): Promise<void> }>
}

interface PickerWindow {
    showSaveFilePicker?: (options?: Record<string, unknown>) => Promise<PickerFileHandle>
    showOpenFilePicker?: (options?: Record<string, unknown>) => Promise<PickerFileHandle[]>
}

interface CachedQuote {
    value?: {
        price?: unknown
    }
}

interface PersistContext {
    trades: TradeRecord[]
    currentFileHandle: PickerFileHandle | null
    currentFileName: string | null
    currentFileLastModified: number | null
    currentView: string
    hasUnsavedChanges: boolean
    supportsFileSystemAccess: boolean
    importMergeSelection: Set<unknown>
    importSummary: unknown

    isClosedStatus(status: unknown): boolean
    getTradeOpenStockShares(trade: TradeRecord): number
    isPmccTrade(trade: TradeRecord): boolean
    getNetOpenLongCallContracts(trade: TradeRecord): number
    getCachedQuote?(ticker: string): CachedQuote | null | undefined
    enrichTradeData(trade: TradeRecord): TradeRecord
    buildTradeStorageSnapshot(trade: TradeRecord): StorageSnapshot | null
    buildLegStorageSnapshot(leg: TradeRecord): StorageSnapshot | null
    getStorageTrades(): StorageSnapshot[]
    buildMCPContext(): unknown
    buildDatabasePayload(): StorageSnapshot
    saveWithFileSystemAPI(data: unknown): Promise<void>
    saveWithDownload(data: unknown): void
    loadWithFileSystemAPI(): Promise<void>
    loadWithFileInput(): void
    processLoadedData(data: Record<string, unknown>, metadata?: Record<string, unknown>): void
    saveToStorage(metadata?: Record<string, unknown>): void
    showNotification(message: string, variant?: string): void
    showLoadingIndicator(text?: string): void
    hideLoadingIndicator(): void
    updateDashboard(): void
    updateFileNameDisplay(): void
    updateTradesList(): void
    updateUnsavedIndicator(): void
    initializeAIChat(): void
    renderImportSummary(): void
    refreshImportMergeList(): void
    formatCurrency(value: number): string
    formatNumber(value: number, options?: { decimals?: number; useGrouping?: boolean }): string
    getTradeType(trade: TradeRecord): unknown
}

function normalizeLegAliasFields(leg: TradeRecord): TradeRecord {
    const normalized: TradeRecord = { ...leg };
    if (!normalized.orderType) {
        normalized.orderType = normalized.tradeType || normalized.order;
    }
    delete normalized.tradeType;
    delete normalized.order;
    return normalized;
}

function normalizeTradeAliasFields(trade: TradeRecord): TradeRecord {
    const normalized: TradeRecord = { ...trade };
    if (!normalized.openedDate) {
        normalized.openedDate = normalized.entryDate || '';
    }
    if (!normalized.closedDate) {
        normalized.closedDate = normalized.exitDate || '';
    }
    delete normalized.entryDate;
    delete normalized.exitDate;

    if (Array.isArray(normalized.legs)) {
        normalized.legs = normalized.legs.map((leg) => (
            leg && typeof leg === 'object'
                ? normalizeLegAliasFields(leg as TradeRecord)
                : leg
        ));
    }

    return normalized;
}

export function getStorageTrades(this: PersistContext): StorageSnapshot[] {
    if (!Array.isArray(this.trades)) {
        return [];
    }

    // Capture latest market price for awaiting-coverage trades from the Finnhub
    // quote cache so MCP and reload-time Unrealized G/L stay in sync without a
    // live API call. Mutates the in-memory trade record (these are persisted,
    // not runtime, fields).
    let snapshotChanged = false;
    const needsSnapshot = (t: TradeRecord): boolean => {
        if (!t || typeof t !== 'object') return false;
        if (this.isClosedStatus(t.status)) return false;
        const heldShares = this.getTradeOpenStockShares(t);
        const heldLeap = this.isPmccTrade(t) ? this.getNetOpenLongCallContracts(t) : 0;
        return heldShares > 0 || heldLeap > 0;
    };
    this.trades.forEach((trade: TradeRecord) => {
        if (!needsSnapshot(trade)) return;
        const ticker = (trade.ticker || '').toString().trim().toUpperCase();
        if (!ticker) return;
        const cached = this.getCachedQuote ? this.getCachedQuote(ticker) : null;
        const price = Number(cached?.value?.price);
        if (Number.isFinite(price) && price > 0) {
            trade.marketPriceSnapshot = price;
            trade.marketPriceSnapshotAt = new Date().toISOString();
            snapshotChanged = true;
        }
    });

    // Re-enrich any trade with held stock/LEAP so unrealizedPL & marketValue
    // reflect the latest snapshot price before MCP context is built.
    if (snapshotChanged) {
        this.trades = this.trades.map(t => (needsSnapshot(t) ? this.enrichTradeData(t) : t));
    }

    return this.trades
        .map((trade: TradeRecord) => this.buildTradeStorageSnapshot(trade))
        .filter((trade): trade is StorageSnapshot => Boolean(trade));
}

export function buildTradeStorageSnapshot(this: PersistContext, trade: TradeRecord): StorageSnapshot | null {
    if (!trade || typeof trade !== 'object') {
        return null;
    }

    const snapshot: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(trade)) {
        if (RUNTIME_TRADE_FIELDS.has(key)) {
            continue;
        }

        if (key === 'legs') {
            if (!Array.isArray(value)) {
                snapshot.legs = [];
            } else {
                const legs = value
                    .map((leg: unknown) => (
                        leg && typeof leg === 'object'
                            ? this.buildLegStorageSnapshot(leg as TradeRecord)
                            : null
                    ))
                    .filter((leg): leg is StorageSnapshot => Boolean(leg));
                snapshot.legs = legs;
            }
            continue;
        }

        if (value === undefined) {
            continue;
        }

        if (value === null) {
            snapshot[key] = null;
            continue;
        }

        if (Array.isArray(value)) {
            snapshot[key] = value.map((item) => (typeof item === 'object' && item !== null ? { ...item } : item));
            continue;
        }

        if (typeof value === 'object') {
            snapshot[key] = { ...(value as Record<string, unknown>) };
            continue;
        }

        snapshot[key] = value;
    }

    if (!Array.isArray(snapshot.legs)) {
        snapshot.legs = [];
    }

    return snapshot;
}

export function buildLegStorageSnapshot(leg: TradeRecord): StorageSnapshot | null {
    if (!leg || typeof leg !== 'object') {
        return null;
    }

    const canonicalLeg = normalizeLegAliasFields(leg);
    const snapshot: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(canonicalLeg)) {
        if (RUNTIME_LEG_FIELDS.has(key)) {
            continue;
        }

        if (key === 'tradeType' || key === 'order') {
            continue;
        }

        if (PERSISTED_LEG_PROVENANCE_FIELDS.has(key) && (value === null || value === '')) {
            continue;
        }

        if (value === undefined) {
            continue;
        }

        if (value === null) {
            snapshot[key] = null;
            continue;
        }

        if (Array.isArray(value)) {
            snapshot[key] = value.slice();
            continue;
        }

        if (typeof value === 'object') {
            snapshot[key] = { ...(value as Record<string, unknown>) };
            continue;
        }

        snapshot[key] = value;
    }

    return snapshot;
}

export function buildDatabasePayload(this: PersistContext): StorageSnapshot {
    return {
        version: CURRENT_STORAGE_VERSION,
        exportDate: new Date().toISOString(),
        trades: this.getStorageTrades(),
        mcpContext: this.buildMCPContext()
    };
}

export async function saveDatabase(this: PersistContext): Promise<void> {
    this.showLoadingIndicator('Saving...');

    try {
        const data = this.buildDatabasePayload();

        if (this.supportsFileSystemAccess) {
            await this.saveWithFileSystemAPI(data);
        } else {
            this.saveWithDownload(data);
        }

        this.hasUnsavedChanges = false;
        this.updateUnsavedIndicator();
        this.showNotification('Database saved successfully!', 'success');
        this.saveToStorage({ fileName: this.currentFileName });
    } catch (error) {
        console.error('Save error:', error);
        const errorName = (error as { name?: string })?.name;
        if (errorName === 'AbortError') {
            // User cancelled the file picker — no-op.
        } else if (errorName === 'StaleFileError') {
            this.showNotification((error as Error).message, 'error');
        } else {
            try {
                const data = this.buildDatabasePayload();
                this.saveWithDownload(data);
                this.hasUnsavedChanges = false;
                this.updateUnsavedIndicator();
                this.showNotification('Database saved as download!', 'success');
                this.saveToStorage({ fileName: this.currentFileName });
            } catch (_fallbackError) {
                this.showNotification('Failed to save database', 'error');
            }
        }
    }

    this.hideLoadingIndicator();
}

export async function saveWithFileSystemAPI(this: PersistContext, data: unknown): Promise<void> {
    const pickerWindow = window as unknown as PickerWindow;
    if (!pickerWindow.showSaveFilePicker) {
        throw new Error('File System Access API unavailable');
    }

    if (!this.currentFileHandle) {
        this.currentFileHandle = await pickerWindow.showSaveFilePicker({
            suggestedName: 'gammaledger.json',
            types: [{
                description: 'JSON files',
                accept: { 'application/json': ['.json'] }
            }]
        });
    } else if (this.currentFileLastModified !== null) {
        // Guard against overwriting a version of the file that changed on disk
        // since it was loaded (e.g. synced in from another device) — see #53.
        const onDiskFile = await this.currentFileHandle.getFile();
        if (onDiskFile.lastModified !== this.currentFileLastModified) {
            throw new StaleFileError(
                `"${this.currentFileHandle.name}" has changed on disk since you loaded it (possibly edited on another device). Reload the file before saving to avoid overwriting those changes.`
            );
        }
    }

    const writable = await this.currentFileHandle.createWritable();
    await writable.write(JSON.stringify(data, null, 2));
    await writable.close();

    const savedFile = await this.currentFileHandle.getFile();
    this.currentFileLastModified = savedFile.lastModified;
    this.currentFileName = this.currentFileHandle.name;
    this.updateFileNameDisplay();
}

export function saveWithDownload(this: PersistContext, data: unknown): void {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gammaledger.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.currentFileName = 'gammaledger.json';
    this.updateFileNameDisplay();
}

export async function loadDatabase(this: PersistContext): Promise<void> {
    this.showLoadingIndicator('Loading...');

    try {
        if (this.supportsFileSystemAccess) {
            await this.loadWithFileSystemAPI();
        } else {
            this.loadWithFileInput();
        }
    } catch (error) {
        if ((error as { name?: string })?.name !== 'AbortError') {
            console.error('Load error:', error);
            this.showNotification('Failed to open file. Please try again.', 'error');
        }
    }

    this.hideLoadingIndicator();
}

export async function loadWithFileSystemAPI(this: PersistContext): Promise<void> {
    const pickerWindow = window as unknown as PickerWindow;
    if (!pickerWindow.showOpenFilePicker) {
        throw new Error('File System Access API unavailable');
    }

    const [fileHandle] = await pickerWindow.showOpenFilePicker({
        types: [{
            description: 'JSON files',
            accept: { 'application/json': ['.json'] }
        }]
    });

    const file = await fileHandle.getFile();
    const text = await file.text();
    let data: unknown;
    try {
        data = JSON.parse(text);
    } catch {
        throw new Error(`"${fileHandle.name}" does not appear to be a valid GammaLedger JSON file.`);
    }

    this.processLoadedData(data as Record<string, unknown>, { fileName: fileHandle.name, source: 'file-open' });
    this.currentFileHandle = fileHandle;
    this.currentFileLastModified = file.lastModified;
    this.showNotification(`Loaded ${this.trades.length} trades successfully!`, 'success');
}

export function loadWithFileInput(this: PersistContext): void {
    const fileInput = document.getElementById('file-input') as HTMLInputElement | null;
    if (!fileInput) return;
    fileInput.onchange = (e) => {
        const target = e.target as HTMLInputElement;
        const file = target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const result = (ev.target as FileReader).result;
                    const data = JSON.parse(result as string);
                    this.processLoadedData(data, { fileName: file.name, source: 'file-open' });
                    this.showNotification(`Loaded ${this.trades.length} trades successfully!`, 'success');
                } catch (error) {
                    this.showNotification('Invalid JSON file', 'error');
                }
                fileInput.value = '';
            };
            reader.readAsText(file);
        } else {
            fileInput.value = '';
        }
    };
    fileInput.click();
}

export function exportToCSV(this: PersistContext): void {
    const headers = [
        'Ticker', 'Strategy', 'Trade Type', 'Strike', 'Defined Risk Width', 'Qty', 'Exit Price', 'DTE', 'Days Held',
        'Entry Date', 'Expiration Date', 'Exit Date', 'Max Risk', 'P&L', 'ROI %', 'Weekly ROI %', 'Monthly ROI %', 'Annual ROI %', 'Status',
        'Stock Price at Entry', 'Fees', 'Max Risk Override', 'IV Rank', 'Notes', 'Exit Reason'
    ];

    const escapeCsv = (value: unknown): string => {
        if (value === null || value === undefined) {
            return '';
        }

        const text = String(value);
        if (text === '') {
            return '';
        }

        if (/[",\n]/.test(text)) {
            return `"${text.replace(/"/g, '""')}"`;
        }

        return text;
    };

    const sanitize = (value: unknown): string => {
        if (value === null || value === undefined) {
            return '';
        }
        return value === '—' ? '' : String(value);
    };

    const formatCurrencyValue = (value: unknown): string => {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
            return '';
        }
        return sanitize(this.formatCurrency(numeric));
    };

    const formatNumberValue = (value: unknown, decimals = 0): string => {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
            return '';
        }
        return sanitize(this.formatNumber(numeric, { decimals, useGrouping: true }));
    };

    const formatPercentValue = (value: unknown): string => {
        const numeric = Number(value);
        if (numeric === Number.POSITIVE_INFINITY) {
            return 'Infinite';
        }
        if (!Number.isFinite(numeric)) {
            return '';
        }
        const formatted = sanitize(this.formatNumber(numeric, { decimals: 2, useGrouping: true }));
        return formatted ? `${formatted}%` : `${numeric.toFixed(2)}%`;
    };

    const formatOptionalCurrency = (value: unknown): string => (value === null || value === undefined ? '' : formatCurrencyValue(value));
    const formatOptionalNumber = (value: unknown, decimals = 0): string => (value === null || value === undefined ? '' : formatNumberValue(value, decimals));

    const rows = this.trades.map((trade: TradeRecord) => {
        const fields = [
            trade.ticker ?? '',
            trade.strategy ?? '',
            this.getTradeType(trade) ?? '',
            formatOptionalCurrency(trade.strikePrice),
            formatOptionalCurrency(trade.definedRiskWidth),
            formatOptionalNumber(Math.abs(Number(trade.quantity)), 0),
            formatOptionalCurrency(trade.exitPrice),
            formatOptionalNumber(trade.dte, 0),
            formatOptionalNumber(trade.daysHeld, 0),
            trade.openedDate ?? '',
            trade.expirationDate ?? '',
            trade.closedDate ?? '',
            formatOptionalCurrency(trade.maxRisk),
            formatOptionalCurrency(trade.pl),
            formatPercentValue(trade.roi),
            formatPercentValue(trade.weeklyROI),
            formatPercentValue(trade.monthlyROI),
            formatPercentValue(trade.annualizedROI),
            trade.status ?? '',
            formatOptionalCurrency(trade.stockPriceAtEntry),
            formatOptionalCurrency(trade.fees),
            formatOptionalCurrency(trade.maxRiskOverride),
            formatOptionalNumber(trade.ivRank, 2),
            trade.notes ?? '',
            trade.exitReason ?? ''
        ];

        return fields.map(escapeCsv).join(',');
    });

    const csvContent = [
        headers.map(escapeCsv).join(','),
        ...rows
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = 'options_trades_enhanced.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

export function processLoadedData(
    this: PersistContext,
    data: Record<string, unknown>,
    metadata: Record<string, unknown> = {}
): void {
    const parsed = parseStorageSchema(data);

    this.trades = parsed.trades.map(trade => {
        const updatedTrade = normalizeTradeAliasFields(trade as unknown as Record<string, unknown>);
        if (updatedTrade.tradeReasoning && !updatedTrade.notes) {
            updatedTrade.notes = updatedTrade.tradeReasoning;
            delete updatedTrade.tradeReasoning;
        }
        return this.enrichTradeData(updatedTrade);
    });

    const metadataFileName = typeof metadata.fileName === 'string' ? metadata.fileName : '';
    if (metadataFileName) {
        this.currentFileName = metadataFileName;
    } else if (!this.currentFileName) {
        this.currentFileName = 'Unsaved Database';
    }

    this.hasUnsavedChanges = false;
    this.updateUnsavedIndicator();
    this.saveToStorage({ fileName: this.currentFileName, source: metadata.source || 'import' });
    this.updateDashboard();
    if (this.currentView === 'trades-list') {
        this.updateTradesList();
    }
    this.updateFileNameDisplay();
    this.initializeAIChat();

    this.importSummary = null;
    this.importMergeSelection.clear();
    this.renderImportSummary();
    this.refreshImportMergeList();
}

export function newDatabase(this: PersistContext): void {
    if (this.hasUnsavedChanges) {
        if (!confirm('You have unsaved changes. Are you sure you want to create a new database?')) {
            return;
        }
    }

    this.trades = [];
    this.currentFileHandle = null;
    this.currentFileLastModified = null;
    this.currentFileName = 'Unsaved Database';
    this.hasUnsavedChanges = false;
    this.updateFileNameDisplay();
    this.updateUnsavedIndicator();
    this.saveToStorage({ fileName: this.currentFileName });
    this.updateDashboard();
    this.showNotification('New database created', 'success');
    this.initializeAIChat();
}

export function saveToStorage(this: PersistContext, metadata: Record<string, unknown> = {}): void {
    try {
        const timestamp = new Date().toISOString();
        const payload = parseStorageSchema({
            version: CURRENT_STORAGE_VERSION,
            exportDate: timestamp,
            timestamp,
            fileName: (metadata.fileName as string) || this.currentFileName || 'Unsaved Database',
            trades: this.getStorageTrades(),
            mcpContext: this.buildMCPContext()
        });
        const saved = safeLocalStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload));
        if (!saved) {
            return;
        }
        LEGACY_STORAGE_KEYS.forEach(key => {
            if (key && key !== LOCAL_STORAGE_KEY) {
                safeLocalStorage.removeItem(key);
            }
        });
    } catch (e) {
        console.warn('Failed to save to localStorage:', e);
    }
}

export async function loadFromStorage(this: PersistContext): Promise<boolean> {
    try {
        const stored = safeLocalStorage.getItem(LOCAL_STORAGE_KEY);
        if (stored) {
            const raw = JSON.parse(stored);
            const hasPrimaryTrades = Array.isArray(raw)
                || (raw && typeof raw === 'object' && Array.isArray((raw as Record<string, unknown>).trades));
            if (hasPrimaryTrades) {
                const parsed = parseStorageSchema(raw);
                this.trades = parsed.trades.map(trade => {
                    const normalized = normalizeTradeAliasFields(trade as unknown as Record<string, unknown>);
                    if (normalized.tradeReasoning && !normalized.notes) {
                        normalized.notes = normalized.tradeReasoning;
                    }
                    delete normalized.tradeReasoning;
                    return this.enrichTradeData(normalized);
                });
                const metadata = parsed as unknown as Record<string, unknown>;
                if (metadata.fileName) {
                    this.currentFileName = String(metadata.fileName);
                }
                this.currentFileHandle = null;
                this.currentFileLastModified = null;
                this.hasUnsavedChanges = false;
                this.updateUnsavedIndicator();
                this.updateFileNameDisplay();
                this.updateDashboard();
                return true;
            }
        }

        for (const key of LEGACY_STORAGE_KEYS) {
            if (!key || key === LOCAL_STORAGE_KEY) {
                continue;
            }

            const legacy = safeLocalStorage.getItem(key);
            if (!legacy) {
                continue;
            }

            const parsedTrades = JSON.parse(legacy);
            if (Array.isArray(parsedTrades)) {
                const migrated = parseStorageSchema(parsedTrades);
                this.trades = migrated.trades.map(trade => {
                    const normalized = normalizeTradeAliasFields(trade as unknown as Record<string, unknown>);
                    if (normalized.tradeReasoning && !normalized.notes) {
                        normalized.notes = normalized.tradeReasoning;
                    }
                    delete normalized.tradeReasoning;
                    return this.enrichTradeData(normalized);
                });
                this.currentFileName = 'Unsaved Database';
                this.hasUnsavedChanges = false;
                this.updateUnsavedIndicator();
                this.saveToStorage({ fileName: this.currentFileName });
                this.updateFileNameDisplay();
                this.updateDashboard();
                return true;
            }
        }
    } catch (e) {
        console.warn('Failed to load from localStorage:', e);
    }

    return false;
}
