// src/database/persist.ts — Wave 11: Database persistence (save/load/export/import).
// Uses the .call(this, …) delegation pattern.

import {
    LOCAL_STORAGE_KEY,
    LEGACY_STORAGE_KEYS,
    RUNTIME_TRADE_FIELDS,
    RUNTIME_LEG_FIELDS
} from '@core/config'

export function getStorageTrades() {
    if (!Array.isArray(this.trades)) {
        return [];
    }

    // Capture latest market price for awaiting-coverage trades from the Finnhub
    // quote cache so MCP and reload-time Unrealized G/L stay in sync without a
    // live API call. Mutates the in-memory trade record (these are persisted,
    // not runtime, fields).
    let snapshotChanged = false;
    const needsSnapshot = (t) => {
        if (!t || typeof t !== 'object') return false;
        if (this.isClosedStatus(t.status)) return false;
        const heldShares = this.getTradeOpenStockShares(t);
        const heldLeap = this.isPmccTrade(t) ? this.getNetOpenLongCallContracts(t) : 0;
        return heldShares > 0 || heldLeap > 0;
    };
    this.trades.forEach((trade) => {
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
        .map((trade) => this.buildTradeStorageSnapshot(trade))
        .filter(Boolean);
}

export function buildTradeStorageSnapshot(trade: Record<string, unknown>) {
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
                    .map((leg) => this.buildLegStorageSnapshot(leg))
                    .filter(Boolean);
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

export function buildLegStorageSnapshot(leg: Record<string, unknown>) {
    if (!leg || typeof leg !== 'object') {
        return null;
    }

    const snapshot: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(leg)) {
        if (RUNTIME_LEG_FIELDS.has(key)) {
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

export function buildDatabasePayload() {
    return {
        version: '2.5',
        exportDate: new Date().toISOString(),
        trades: this.getStorageTrades(),
        mcpContext: this.buildMCPContext()
    };
}

export function saveWithDownload(data) {
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

export function loadWithFileInput() {
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

export function exportToCSV() {
    const headers = [
        'Ticker', 'Strategy', 'Trade Type', 'Strike', 'Defined Risk Width', 'Qty', 'Exit Price', 'DTE', 'Days Held',
        'Entry Date', 'Expiration Date', 'Exit Date', 'Max Risk', 'P&L', 'ROI %', 'Weekly ROI %', 'Monthly ROI %', 'Annual ROI %', 'Status',
        'Stock Price at Entry', 'Fees', 'Max Risk Override', 'IV Rank', 'Notes', 'Exit Reason'
    ];

    const escapeCsv = (value) => {
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

    const sanitize = (value) => {
        if (value === null || value === undefined) {
            return '';
        }
        return value === '—' ? '' : value;
    };

    const formatCurrencyValue = (value) => {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
            return '';
        }
        return sanitize(this.formatCurrency(numeric));
    };

    const formatNumberValue = (value, decimals = 0) => {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
            return '';
        }
        return sanitize(this.formatNumber(numeric, { decimals, useGrouping: true }));
    };

    const formatPercentValue = (value) => {
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

    const formatOptionalCurrency = (value) => (value === null || value === undefined ? '' : formatCurrencyValue(value));
    const formatOptionalNumber = (value, decimals = 0) => (value === null || value === undefined ? '' : formatNumberValue(value, decimals));

    const rows = this.trades.map(trade => {
        const fields = [
            trade.ticker ?? '',
            trade.strategy ?? '',
            this.getTradeType(trade) ?? '',
            formatOptionalCurrency(trade.strikePrice),
            formatOptionalCurrency(trade.definedRiskWidth),
            formatOptionalNumber(Math.abs(trade.quantity), 0),
            formatOptionalCurrency(trade.exitPrice),
            formatOptionalNumber(trade.dte, 0),
            formatOptionalNumber(trade.daysHeld, 0),
            trade.entryDate ?? '',
            trade.expirationDate ?? '',
            trade.exitDate ?? '',
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

export function processLoadedData(data: Record<string, unknown>, metadata: Record<string, unknown> = {}) {
    if (!data || !Array.isArray(data.trades)) {
        throw new Error('Invalid data format');
    }

    this.trades = (data.trades as Record<string, unknown>[]).map(trade => {
        const updatedTrade = { ...trade };
        if (updatedTrade.tradeReasoning && !updatedTrade.notes) {
            updatedTrade.notes = updatedTrade.tradeReasoning;
            delete updatedTrade.tradeReasoning;
        }
        return this.enrichTradeData(updatedTrade);
    });

    if (metadata.fileName) {
        this.currentFileName = metadata.fileName;
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

export function newDatabase() {
    if (this.hasUnsavedChanges) {
        if (!confirm('You have unsaved changes. Are you sure you want to create a new database?')) {
            return;
        }
    }

    this.trades = [];
    this.currentFileHandle = null;
    this.currentFileName = 'Unsaved Database';
    this.hasUnsavedChanges = false;
    this.updateFileNameDisplay();
    this.updateUnsavedIndicator();
    this.saveToStorage({ fileName: this.currentFileName });
    this.updateDashboard();
    this.showNotification('New database created', 'success');
    this.initializeAIChat();
}

export function saveToStorage(metadata: Record<string, unknown> = {}) {
    try {
        const payload = {
            version: '2.5',
            timestamp: new Date().toISOString(),
            fileName: (metadata.fileName as string) || this.currentFileName || 'Unsaved Database',
            trades: this.getStorageTrades(),
            mcpContext: this.buildMCPContext()
        };
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload));
        LEGACY_STORAGE_KEYS.forEach(key => {
            if (key && key !== LOCAL_STORAGE_KEY) {
                localStorage.removeItem(key);
            }
        });
    } catch (e) {
        console.warn('Failed to save to localStorage:', e);
    }
}
