// src/integrations/finnhub.ts — Wave 5: Finnhub API integration.
// Uses the .call(this, …) delegation pattern so all this.* refs work.

import {
    DEFAULT_FINNHUB_RATE_LIMIT,
    FINNHUB_RATE_LIMIT_STORAGE_KEY
} from '@core/config'

type AnyRecord = Record<string, any>

interface FinnhubQuotePayload {
    c: number
    h: number
    l: number
    o: number
    pc: number
    t: number
    d?: number
    dp?: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readFiniteFinnhubNumber(payload: Record<string, unknown>, key: keyof FinnhubQuotePayload): number {
    const value = Number(payload[key]);
    if (!Number.isFinite(value)) {
        throw new Error(`Invalid Finnhub response: ${String(key)} must be a finite number`);
    }
    return value;
}

function parseFinnhubQuotePayload(payload: unknown): FinnhubQuotePayload {
    if (!isRecord(payload)) {
        throw new Error('Invalid response from Finnhub');
    }
    if (typeof payload.error === 'string') {
        throw new Error(payload.error);
    }

    const quote: FinnhubQuotePayload = {
        c: readFiniteFinnhubNumber(payload, 'c'),
        h: readFiniteFinnhubNumber(payload, 'h'),
        l: readFiniteFinnhubNumber(payload, 'l'),
        o: readFiniteFinnhubNumber(payload, 'o'),
        pc: readFiniteFinnhubNumber(payload, 'pc'),
        t: readFiniteFinnhubNumber(payload, 't')
    };
    if (payload.d !== undefined && payload.d !== null && payload.d !== '') {
        quote.d = readFiniteFinnhubNumber(payload, 'd');
    }
    if (payload.dp !== undefined && payload.dp !== null && payload.dp !== '') {
        quote.dp = readFiniteFinnhubNumber(payload, 'dp');
    }
    if (quote.c <= 0) {
        throw new Error('Price unavailable for symbol');
    }
    return quote;
}

export function initializeFinnhubControls(this: any) {
    const container = document.getElementById('finnhub-controls');
    if (!container) {
        return;
    }

    const input = document.getElementById('finnhub-api-key') as HTMLInputElement | null;
    const saveButton = document.getElementById('finnhub-save');
    const status = document.getElementById('finnhub-status');

    this.finnhub.elements = { container, input, saveButton, status };

    if (input) {
        input.value = this.finnhub.apiKey;
    }

    if (status) {
        const variant = this.finnhub.apiKey ? 'success' : 'neutral';
        const message = this.finnhub.apiKey ? 'API key loaded' : 'Not set';
        this.updateFinnhubStatus(message, variant, 4000);
    }

    const commit = async () => {
        const value = (input?.value || '').trim();
        this.setFinnhubApiKey(value, { persist: false, updateUI: true, markUnsaved: false });

        const cryptoApi = this.getCrypto();

        if (!value) {
            this.removeFinnhubConfigFromStorage();
            this.updateFinnhubStatus('API key cleared. Live prices disabled.', 'neutral', 5000);
            this.updateActivePositionsTable();
            this.initMarketStatus();
            return;
        }

        if (!cryptoApi?.subtle) {
            this.saveFinnhubConfigToStorage();
            this.updateFinnhubStatus('Finnhub API key saved (unencrypted — Web Crypto unavailable).', 'success', 6000);
            this.updateActivePositionsTable();
            this.initMarketStatus();
            return;
        }

        const encrypted = await this.encryptAndStoreFinnhubApiKey(cryptoApi);
        if (encrypted) {
            this.updateFinnhubStatus('Finnhub API key saved securely.', 'success', 5000);
        } else {
            this.saveFinnhubConfigToStorage();
            this.updateFinnhubStatus('Finnhub API key saved (unencrypted fallback).', 'neutral', 6000);
        }

        this.updateActivePositionsTable();
        this.initMarketStatus();
    };

    saveButton?.addEventListener('click', async (event) => {
        event.preventDefault();
        await commit();
    });

    input?.addEventListener('keydown', async (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            await commit();
        }
    });

    // Rate limit controls
    this.initializeFinnhubRateLimitControls();
}

export function initializeFinnhubRateLimitControls(this: any) {
    const rateLimitInput = document.getElementById('finnhub-rate-limit') as HTMLInputElement | null;
    const rateSaveButton = document.getElementById('finnhub-rate-save');
    const rateResetButton = document.getElementById('finnhub-rate-reset');
    const rateStatus = document.getElementById('finnhub-rate-status');

    // Initialize input with current value
    if (rateLimitInput) {
        rateLimitInput.value = this.finnhub.maxRequestsPerMinute;
    }

    // Update status display
    this.updateFinnhubRateStatus(rateStatus);

    // Save button handler
    rateSaveButton?.addEventListener('click', (event) => {
        event.preventDefault();
        const value = parseInt(rateLimitInput?.value || '', 10);
        
        if (Number.isFinite(value) && value > 0) {
            this.finnhub.maxRequestsPerMinute = value;
            this.saveFinnhubRateLimitToStorage();
            this.updateFinnhubRateStatus(rateStatus, `Rate limit set to ${value} requests/minute`, 'success');
            // Recalculate and restart quote refresh with new rate limit
            this.restartQuoteRefreshWithNewRate();
        } else {
            this.updateFinnhubRateStatus(rateStatus, 'Please enter a valid rate limit', 'error');
        }
    });

    // Reset button handler
    rateResetButton?.addEventListener('click', (event) => {
        event.preventDefault();
        this.finnhub.maxRequestsPerMinute = DEFAULT_FINNHUB_RATE_LIMIT;
        this.removeFinnhubRateLimitFromStorage();
        if (rateLimitInput) {
            rateLimitInput.value = String(DEFAULT_FINNHUB_RATE_LIMIT);
        }
        this.updateFinnhubRateStatus(rateStatus, `Rate limit reset to ${DEFAULT_FINNHUB_RATE_LIMIT}/minute`, 'neutral');
        // Recalculate and restart quote refresh with default rate limit
        this.restartQuoteRefreshWithNewRate();
    });

    // Enter key handler
    rateLimitInput?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            rateSaveButton?.click();
        }
    });
}

export function updateFinnhubRateStatus(this: any, element: HTMLElement | null, message: string | null = null, variant = 'neutral') {
    if (!element) {
        return;
    }

    if (message) {
        element.textContent = message;
        element.className = 'finnhub-rate-status';
        if (variant === 'success') {
            element.classList.add('is-success');
        } else if (variant === 'error') {
            element.classList.add('is-error');
        }
        return;
    }

    // Default status based on current value
    const isDefault = this.finnhub.maxRequestsPerMinute === DEFAULT_FINNHUB_RATE_LIMIT;
    if (isDefault) {
        element.textContent = `Default: ${DEFAULT_FINNHUB_RATE_LIMIT}/min`;
        element.className = 'finnhub-rate-status';
    } else {
        element.textContent = `Custom: ${this.finnhub.maxRequestsPerMinute}/min`;
        element.className = 'finnhub-rate-status is-success';
    }
}

export function loadFinnhubRateLimitFromStorage(this: any) {
    try {
        const stored = localStorage.getItem(FINNHUB_RATE_LIMIT_STORAGE_KEY);
        if (stored !== null) {
            const value = parseInt(stored, 10);
            if (Number.isFinite(value) && value > 0) {
                return value;
            }
        }
    } catch (error) {
        console.warn('Failed to load Finnhub rate limit from storage:', error);
    }
    return DEFAULT_FINNHUB_RATE_LIMIT;
}

export function saveFinnhubRateLimitToStorage(this: any) {
    try {
        if (this.finnhub?.maxRequestsPerMinute) {
            localStorage.setItem(FINNHUB_RATE_LIMIT_STORAGE_KEY, String(this.finnhub.maxRequestsPerMinute));
        }
    } catch (error) {
        console.warn('Failed to save Finnhub rate limit to storage:', error);
    }
}

export function removeFinnhubRateLimitFromStorage(this: any) {
    try {
        localStorage.removeItem(FINNHUB_RATE_LIMIT_STORAGE_KEY);
    } catch (error) {
        console.warn('Failed to remove Finnhub rate limit from storage:', error);
    }
}

export function updateFinnhubStatus(this: any, message: string, variant = 'neutral', autoClearMs = 0) {
    const statusEl = this.finnhub?.elements?.status;
    if (!statusEl || !message) {
        return;
    }

    const normalizedVariant = ['success', 'error', 'neutral'].includes(variant) ? variant : 'neutral';
    statusEl.textContent = message;
    statusEl.classList.remove('is-success', 'is-error');
    if (normalizedVariant === 'success') {
        statusEl.classList.add('is-success');
    } else if (normalizedVariant === 'error') {
        statusEl.classList.add('is-error');
    }

    if (this.finnhub.statusTimeoutId) {
        clearTimeout(this.finnhub.statusTimeoutId);
    }

    this.finnhub.lastStatus = { message, variant: normalizedVariant };

    if (autoClearMs > 0) {
        this.finnhub.statusTimeoutId = setTimeout(() => {
            if (!statusEl.isConnected) {
                return;
            }
            statusEl.textContent = normalizedVariant === 'neutral' ? 'Not set' : '';
            statusEl.classList.remove('is-success', 'is-error');
        }, autoClearMs);
    }
}

export function setFinnhubApiKey(this: any, value: string, { persist = false, updateUI = true, markUnsaved = false } = {}) {
    const sanitized = (value || '').trim();
    if (sanitized === this.finnhub.apiKey) {
        return;
    }

    this.finnhub.apiKey = sanitized;
    this.finnhub.cache.clear();
    this.finnhub.outstandingRequests.clear();

    if (updateUI && this.finnhub.elements?.input) {
        this.finnhub.elements.input.value = sanitized;
    }

    if (persist) {
        this.saveFinnhubConfigToStorage();
    }

    if (markUnsaved) {
        this.markUnsavedChanges();
    }
}

export function getFinnhubStorageKey(this: any) {
    return 'GammaLedgerFinnhubConfig';
}

export function saveFinnhubConfigToStorage(this: any) {
    try {
        const payload = { apiKey: this.finnhub.apiKey };
        localStorage.setItem(this.getFinnhubStorageKey(), JSON.stringify(payload));
    } catch (error) {
        console.warn('Failed to save Finnhub configuration:', error);
    }
}

export function removeFinnhubConfigFromStorage(this: any) {
    try {
        localStorage.removeItem(this.getFinnhubStorageKey());
    } catch (error) {
        console.warn('Failed to remove Finnhub configuration:', error);
    }
}

export function getFinnhubSecretStorageKey(this: any) {
    return 'GammaLedgerFinnhubSecret';
}

export async function loadFinnhubConfigFromStorage(this: any) {
    try {
        const raw = localStorage.getItem(this.getFinnhubStorageKey());
        if (!raw) {
            return;
        }
        const parsed = JSON.parse(raw);
        if (!parsed) {
            return;
        }

        if (parsed.enc && parsed.payload) {
            const cryptoApi = this.getCrypto();
            if (!cryptoApi?.subtle) {
                console.warn('Encrypted Finnhub API key stored but Web Crypto unavailable.');
                this.updateFinnhubStatus('Stored Finnhub key is encrypted, but this browser cannot decrypt it.', 'error', 7000);
                return;
            }

            try {
                const key = await this.ensureFinnhubEncryptionKey(cryptoApi);
                if (!key) {
                    throw new Error('Encryption key unavailable');
                }
                const decrypted = await this.decryptString(parsed.payload, cryptoApi, key);
                if (decrypted) {
                    this.finnhub.apiKey = decrypted;
                }
            } catch (error) {
                console.warn('Failed to decrypt stored Finnhub API key:', error);
                this.updateFinnhubStatus('Failed to decrypt stored Finnhub API key.', 'error', 6000);
            }
            return;
        }

        if (typeof parsed.apiKey === 'string') {
            this.finnhub.apiKey = parsed.apiKey;
        }
    } catch (error) {
        console.warn('Failed to load Finnhub configuration:', error);
    }
}

export async function ensureFinnhubEncryptionKey(this: any, cryptoApi = this.getCrypto()) {
    if (!cryptoApi?.subtle) {
        return null;
    }

    if (this.finnhub.encryptionKey) {
        return this.finnhub.encryptionKey;
    }

    let rawKeyB64 = localStorage.getItem(this.getFinnhubSecretStorageKey()) || '';
    if (!rawKeyB64) {
        const raw = cryptoApi.getRandomValues(new Uint8Array(32));
        rawKeyB64 = String(this.arrayBufferToBase64(raw.buffer));
        localStorage.setItem(this.getFinnhubSecretStorageKey(), rawKeyB64);
    }

    const rawKey = new Uint8Array(this.base64ToArrayBuffer(rawKeyB64));
    const cryptoKey = await cryptoApi.subtle.importKey('raw', rawKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    this.finnhub.encryptionKey = cryptoKey;
    return cryptoKey;
}

export async function encryptAndStoreFinnhubApiKey(this: any, cryptoApi = this.getCrypto()) {
    try {
        if (!cryptoApi?.subtle) {
            throw new Error('Web Crypto API unavailable');
        }
        const apiKey = this.finnhub.apiKey || '';
        if (!apiKey) {
            this.removeFinnhubConfigFromStorage();
            return true;
        }

        const key = await this.ensureFinnhubEncryptionKey(cryptoApi);
        if (!key) {
            throw new Error('Failed to prepare encryption key');
        }

        const payload = await this.encryptString(apiKey, cryptoApi, key);
        localStorage.setItem(this.getFinnhubStorageKey(), JSON.stringify({ enc: true, payload }));
        return true;
    } catch (error) {
        console.warn('Failed to encrypt Finnhub API key:', error);
        return false;
    }
}

export async function getCurrentPrice(this: any, ticker: string, { forceRefresh = false }: { forceRefresh?: boolean } = {}) {
    const symbol = (ticker || '').toString().trim().toUpperCase();
    if (!symbol) {
        throw new Error('Invalid symbol');
    }

    if (forceRefresh) {
        this.finnhub.cache.delete(symbol);
    } else {
        const cached = this.getCachedQuote(symbol);
        if (cached) {
            return cached.value;
        }
    }

    if (!this.finnhub.apiKey) {
        throw new Error('Finnhub API key missing');
    }

    const existing = this.finnhub.outstandingRequests.get(symbol);
    if (existing) {
        return existing;
    }

    const request = this.enqueueFinnhubRequest(symbol)
        .then((result: AnyRecord) => {
            this.setCachedQuote(symbol, result);
            return result;
        })
        .catch((error: unknown) => {
            const message = error instanceof Error ? error.message : 'Failed to load quote.';
            this.updateFinnhubStatus(message || 'Failed to load quote.', 'error', 7000);
            throw error;
        })
        .finally(() => {
            this.finnhub.outstandingRequests.delete(symbol);
        });

    this.finnhub.outstandingRequests.set(symbol, request);

    return request;
}

export function getQuoteEntryKey(this: any, trade: AnyRecord) {
    if (!trade || typeof trade !== 'object') {
        return 'unknown';
    }

    const candidateId = trade.id ?? trade.tradeId ?? trade.uid ?? trade.uniqueId;
    if (candidateId !== undefined && candidateId !== null && candidateId !== '') {
        return `id:${candidateId}`;
    }

    const ticker = (trade.ticker || '').toString().trim().toUpperCase();
    const entryDate = trade.openedDate || '';
    const strike = trade.strikePrice || '';
    return `fallback:${ticker}|${entryDate}|${strike}`;
}

export function rebuildQuoteRefreshSchedule(this: any) {
    if (!(this.activeQuoteEntries instanceof Map)) {
        this.activeQuoteEntries = new Map();
    }

    // Prioritize entries by state:
    // - High priority: no price yet, errors, rate-limited, unavailable
    // - Low priority: has valid price (ready state)
    const priorityGroups = {
        highPriority: [] as string[],
        lowPriority: [] as string[]
    };

    this.activeQuoteEntries.forEach((entry: AnyRecord, key: string) => {
        const state = entry.cell?.dataset?.priceState;
        // High priority: idle, error, loading, refreshing, or no state
        // This includes rate-limited, unavailable, and any other error conditions
        if (!state || state === 'idle' || state === 'error' || state === 'loading' || state === 'refreshing') {
            priorityGroups.highPriority.push(key);
        } else {
            // Low priority: ready state (has valid price)
            priorityGroups.lowPriority.push(key);
        }
    });

    // Build schedule with high priority first
    this.quoteRefreshKeys = [...priorityGroups.highPriority, ...priorityGroups.lowPriority];
    this.quoteRefreshCursor = 0;
}

export function startQuoteAutoRefreshIfNeeded(this: any) {
    // Only refresh quotes for the currently active view to reduce API calls
    if (!(this.activeQuoteEntries instanceof Map)) {
        this.activeQuoteEntries = new Map();
    }
    
    if (!(this.creditPlaybookQuoteEntries instanceof Map)) {
        this.creditPlaybookQuoteEntries = new Map();
    }

    if (!(this.assignedPositionsQuoteEntries instanceof Map)) {
        this.assignedPositionsQuoteEntries = new Map();
    }

    // Determine which views are active based on currentView
    const isDashboardView = this.currentView === 'dashboard';
    const isCreditPlaybookView = this.currentView === 'credit-playbook';

    // Count entries only for active views
    const activePositionsCount = isDashboardView ? this.activeQuoteEntries.size : 0;
    const assignedPositionsCount = isDashboardView ? this.assignedPositionsQuoteEntries.size : 0;
    const creditPlaybookCount = isCreditPlaybookView ? this.creditPlaybookQuoteEntries.size : 0;
    const totalEntries = activePositionsCount + assignedPositionsCount + creditPlaybookCount;
    
    if (totalEntries === 0) {
        this.stopQuoteAutoRefresh();
        return;
    }

    const desiredInterval = this.computeAutoRefreshInterval();
    if (desiredInterval !== this.autoRefreshIntervalMs) {
        this.autoRefreshIntervalMs = desiredInterval;
        this.stopQuoteAutoRefresh();
    }

    if (this.quoteRefreshIntervalId) {
        return;
    }

    // Cycle between active sources based on current view
    let cycleIndex = 0;

    this.quoteRefreshIntervalId = setInterval(() => {
        // Re-check current view each interval (view may have changed)
        const isCurrentlyDashboard = this.currentView === 'dashboard';
        const isCurrentlyCreditPlaybook = this.currentView === 'credit-playbook';

        // Build sources list based on current view
        const sources: Array<{ refresh: () => void }> = [];

        if (isCurrentlyDashboard) {
            if (this.activeQuoteEntries.size > 0) {
                sources.push({ refresh: () => this.refreshActivePositionsQuotes({ force: true }) });
            }
            if (this.assignedPositionsQuoteEntries.size > 0) {
                sources.push({ refresh: () => this.refreshAssignedPositionsQuotes({ force: true }) });
            }
        } else if (isCurrentlyCreditPlaybook) {
            if (this.creditPlaybookQuoteEntries.size > 0) {
                sources.push({ refresh: () => this.refreshCreditPlaybookQuotes({ force: true }) });
            }
        }

        if (sources.length === 0) {
            // No active sources for current view, but don't stop - view might change
            return;
        }

        // Cycle through available sources
        sources[cycleIndex % sources.length].refresh();
        cycleIndex++;
    }, this.autoRefreshIntervalMs);
}

export function stopQuoteAutoRefresh(this: any) {
    if (this.quoteRefreshIntervalId) {
        clearInterval(this.quoteRefreshIntervalId);
        this.quoteRefreshIntervalId = null;
    }

    if (this.activeQuoteEntries?.size === 0) {
        this.quoteRefreshKeys = [];
        this.quoteRefreshCursor = 0;
    }
}

export function restartQuoteRefreshWithNewRate(this: any) {
    // Force recalculation of the refresh interval
    this.autoRefreshIntervalMs = this.computeAutoRefreshInterval();
    
    // Stop current refresh timer
    this.stopQuoteAutoRefresh();
    
    // Restart with new interval if there are entries to refresh
    const totalEntries = (this.activeQuoteEntries?.size || 0) + 
                        (this.creditPlaybookQuoteEntries?.size || 0) + 
                        (this.assignedPositionsQuoteEntries?.size || 0);
    
    if (totalEntries > 0) {
        this.startQuoteAutoRefresh();
    }
}

export function refreshActivePositionsQuotes(this: any, { force = false, immediate = false }: { force?: boolean; immediate?: boolean } = {}) {
    // Process ONE Active Positions quote per call to respect rate limits
    // Called by unified auto-refresh timer that alternates between tables
    if (!(this.activeQuoteEntries instanceof Map) || this.activeQuoteEntries.size === 0) {
        this.stopQuoteAutoRefresh();
        return;
    }

    if (!Array.isArray(this.quoteRefreshKeys) || this.quoteRefreshKeys.length === 0) {
        this.rebuildQuoteRefreshSchedule();
    }

    if (this.quoteRefreshKeys.length === 0) {
        this.stopQuoteAutoRefresh();
        return;
    }

    let attempts = 0;
    const maxAttempts = this.quoteRefreshKeys.length;

    while (attempts < maxAttempts && this.quoteRefreshKeys.length > 0) {
        const normalizedCursor = this.quoteRefreshCursor % this.quoteRefreshKeys.length;
        const key = this.quoteRefreshKeys[normalizedCursor];
        const entry = this.activeQuoteEntries.get(key);

        this.quoteRefreshCursor = (normalizedCursor + 1) % this.quoteRefreshKeys.length;
        attempts += 1;

        if (!entry || !entry.cell?.isConnected) {
            this.activeQuoteEntries.delete(key);
            this.quoteRefreshKeys.splice(normalizedCursor, 1);
            if (this.quoteRefreshKeys.length === 0) {
                this.stopQuoteAutoRefresh();
                return;
            }
            continue;
        }

        this.populateQuoteCell(entry.cell, entry.trade, entry.row, {
            forceRefresh: force,
            silentIfCached: !force,
            suppressLoadingText: !immediate
        });
        return;
    }

    if (this.activeQuoteEntries.size === 0) {
        this.stopQuoteAutoRefresh();
    }
}

export function refreshAssignedPositionsQuotes(this: any, { force = false, immediate = false }: { force?: boolean; immediate?: boolean } = {}) {
    // Process ONE Assigned Positions quote per call to respect rate limits
    // Called by unified auto-refresh timer that alternates between tables
    if (!(this.assignedPositionsQuoteEntries instanceof Map) || this.assignedPositionsQuoteEntries.size === 0) {
        return;
    }

    // Find one entry to refresh, prioritizing entries without prices or with errors
    let entryToRefresh: AnyRecord | null = null;
    let keyToRefresh: string | null = null;

    // First pass: look for high-priority entries (no price yet, errors, rate-limited)
    for (const [key, entry] of this.assignedPositionsQuoteEntries.entries()) {
        if (!entry || !entry.key) {
            this.assignedPositionsQuoteEntries.delete(key);
            continue;
        }

        // Check if this entry needs a price (no market value displayed or shows error)
        const marketValueText = entry.marketValueCell?.textContent || '';
        const hasNoPrice = !marketValueText || marketValueText === '—' || marketValueText === 'Loading…';

        if (hasNoPrice) {
            entryToRefresh = entry;
            keyToRefresh = key;
            break;
        }
    }

    // Second pass: if no high-priority entry found, take any entry for refresh
    if (!entryToRefresh) {
        for (const [key, entry] of this.assignedPositionsQuoteEntries.entries()) {
            if (!entry || !entry.key) {
                this.assignedPositionsQuoteEntries.delete(key);
                continue;
            }

            entryToRefresh = entry;
            keyToRefresh = key;
            break;
        }
    }

    // Process one entry per refresh cycle
    if (entryToRefresh) {
        const ticker = (entryToRefresh.trade?.ticker || '').toString().trim().toUpperCase();
        if (!ticker) {
            this.assignedPositionsQuoteEntries.delete(keyToRefresh);
            return;
        }

        this.getCurrentPrice(ticker, { forceRefresh: force })
            .then((quote: AnyRecord) => {
                this.updateAssignedPositionMetrics(entryToRefresh, quote);
            })
            .catch((_error: unknown) => {
                // Mark as needing refresh on next cycle
                if (entryToRefresh.currentPriceCell) {
                    entryToRefresh.currentPriceCell.textContent = '—';
                }
                if (entryToRefresh.marketValueCell) {
                    entryToRefresh.marketValueCell.textContent = '—';
                }
                if (entryToRefresh.unrealizedGLCell) {
                    entryToRefresh.unrealizedGLCell.textContent = '—';
                    entryToRefresh.unrealizedGLCell.classList.remove('pl-positive', 'pl-negative', 'pl-neutral');
                }
            });
    }
}

export function refreshCreditPlaybookQuotes(this: any, { force = false, immediate = false }: { force?: boolean; immediate?: boolean } = {}) {
    // Process ONE Credit Playbook quote per call to respect rate limits
    // Called by unified auto-refresh timer that alternates between tables
    if (!(this.creditPlaybookQuoteEntries instanceof Map) || this.creditPlaybookQuoteEntries.size === 0) {
        return;
    }

    // Find one entry to refresh, prioritizing by state
    let entryToRefresh: AnyRecord | null = null;
    let keyToRefresh: string | null = null;

    // First pass: look for high-priority entries (no price yet, errors, rate-limited, unavailable)
    for (const [key, entry] of this.creditPlaybookQuoteEntries.entries()) {
        if (!entry || !entry.cell?.isConnected) {
            this.creditPlaybookQuoteEntries.delete(key);
            continue;
        }

        const state = entry.cell?.dataset?.priceState;
        // High priority: idle, error, loading, refreshing, or no state
        if (!state || state === 'idle' || state === 'error' || state === 'loading' || state === 'refreshing') {
            entryToRefresh = entry;
            keyToRefresh = key;
            break;
        }
    }

    // Second pass: if no high-priority entry found, take any ready entry
    if (!entryToRefresh) {
        for (const [key, entry] of this.creditPlaybookQuoteEntries.entries()) {
            if (!entry || !entry.cell?.isConnected) {
                this.creditPlaybookQuoteEntries.delete(key);
                continue;
            }

            entryToRefresh = entry;
            keyToRefresh = key;
            break;
        }
    }

    // Process one entry per refresh cycle
    if (entryToRefresh) {
        this.populateQuoteCell(entryToRefresh.cell, entryToRefresh.trade, entryToRefresh.row, {
            forceRefresh: force,
            silentIfCached: !force,
            suppressLoadingText: !immediate
        });
    }

    // Stop auto-refresh if no more entries
    if (this.creditPlaybookQuoteEntries.size === 0) {
        this.stopQuoteAutoRefresh();
    }
}

export function populateQuoteCell(this: any, cell: HTMLElement | null, trade: AnyRecord, row: HTMLElement | null, options: { forceRefresh?: boolean; deferNetworkFetch?: boolean; silentIfCached?: boolean; suppressLoadingText?: boolean } = {}) {
    const {
        forceRefresh = false,
        deferNetworkFetch = false,
        silentIfCached = false,
        suppressLoadingText = false
    } = options;
    if (!cell) {
        return;
    }

    const ticker = (trade?.ticker || '').toString().trim().toUpperCase();
    if (!ticker) {
        cell.dataset.priceState = 'idle';
        cell.textContent = '—';
        cell.classList.remove('quote-error');
        return;
    }

    const cached = forceRefresh ? null : this.getCachedQuote(ticker);
    if (cached) {
        this.renderQuoteValue(cell, row, trade, cached.value);
        return;
    } else if (!this.finnhub.apiKey) {
        cell.dataset.priceState = 'error';
        this.setQuoteCellError(cell, row, trade, 'Set API key');
        const lastStatus = this.finnhub.lastStatus?.message;
        if (lastStatus !== 'Add your Finnhub API key to load live prices.') {
            this.updateFinnhubStatus('Add your Finnhub API key to load live prices.', 'neutral', 6000);
        }
        this.updateItmHighlight(row, trade, null);
        return;
    } else {
        cell.dataset.priceState = forceRefresh ? 'refreshing' : 'loading';
        if (!forceRefresh && !suppressLoadingText && !silentIfCached) {
            cell.textContent = 'Loading…';
        }
        cell.classList.remove('quote-error');
    }

    if (!this.finnhub.apiKey || deferNetworkFetch) {
        return;
    }

    this.getCurrentPrice(ticker, { forceRefresh })
        .then((quote: AnyRecord) => {
            if (!cell.isConnected) {
                return;
            }
            this.renderQuoteValue(cell, row, trade, quote);
        })
        .catch((error: unknown) => {
            if (!cell.isConnected) {
                return;
            }
            const message = this.getQuoteErrorMessage(error);
            this.setQuoteCellError(cell, row, trade, message);
        });
}

export function renderQuoteValue(this: any, cell: HTMLElement | null, row: HTMLElement | null, trade: AnyRecord, quote: AnyRecord) {
    if (!cell) {
        return;
    }
    cell.dataset.priceState = 'ready';
    cell.classList.remove('quote-error');
    const numeric = Number(quote?.price);
    if (!Number.isFinite(numeric)) {
        cell.textContent = '—';
        this.applyPositionHighlight(row, trade, null);
        const agRowNull = cell.closest?.('.ag-row') as HTMLElement | null;
        if (agRowNull) agRowNull.classList.remove('position-itm');
        return;
    }

    const changePercent = this.getQuoteChangePercent(quote);
    const changeValue = this.getQuoteChangeValue(quote);

    cell.innerHTML = '';

    const priceEl = document.createElement('span');
    priceEl.className = 'quote-price';
    priceEl.textContent = this.formatCurrency(numeric);
    cell.appendChild(priceEl);

    if (Number.isFinite(changePercent)) {
        const changeEl = document.createElement('span');
        changeEl.className = 'quote-change';

        const percentMagnitude = Math.abs(changePercent);
        const percentNumber = this.formatNumber(percentMagnitude, { decimals: 2, useGrouping: true })
            ?? percentMagnitude.toFixed(2);
        const percentPrefix = changePercent > 0 ? '+' : changePercent < 0 ? '-' : '';
        const formattedPercent = `${percentPrefix}${percentNumber}%`;
        changeEl.textContent = formattedPercent;

        if (changePercent > 0) {
            changeEl.classList.add('is-up');
        } else if (changePercent < 0) {
            changeEl.classList.add('is-down');
        } else {
            changeEl.classList.add('is-flat');
        }

        if (Number.isFinite(changeValue)) {
            const changeMagnitude = Math.abs(changeValue);
            const changeNumber = this.formatCurrency(changeMagnitude);
            const changePrefix = changeValue > 0 ? '+' : changeValue < 0 ? '-' : '';
            changeEl.title = `${changePrefix}${changeNumber} (${formattedPercent})`;
        }

        cell.appendChild(changeEl);
    }

    this.applyPositionHighlight(row, trade, numeric);

    // Apply ITM class to actual AG Grid row element (rowProxy is detached, cell is connected)
    const agRow = cell.closest?.('.ag-row') as HTMLElement | null;
    if (agRow) {
        agRow.classList.toggle('position-itm', row?.classList?.contains('position-itm') ?? false);
    }
}

export function getQuoteChangePercent(this: any, quote: AnyRecord) {
    const percent = Number(quote?.changePercent);
    if (Number.isFinite(percent)) {
        return percent;
    }

    const change = Number(quote?.change);
    const previousClose = Number(quote?.previousClose);
    if (Number.isFinite(change) && Number.isFinite(previousClose) && previousClose !== 0) {
        return (change / previousClose) * 100;
    }

    const price = Number(quote?.price);
    if (Number.isFinite(price) && Number.isFinite(previousClose) && previousClose !== 0) {
        return ((price - previousClose) / previousClose) * 100;
    }

    return null;
}

export function getQuoteChangeValue(this: any, quote: AnyRecord) {
    const change = Number(quote?.change);
    if (Number.isFinite(change)) {
        return change;
    }

    const price = Number(quote?.price);
    const previousClose = Number(quote?.previousClose);
    if (Number.isFinite(price) && Number.isFinite(previousClose)) {
        return price - previousClose;
    }

    return null;
}

export function setQuoteCellError(this: any, cell: HTMLElement | null, row: HTMLElement | null, trade: AnyRecord, message: string) {
    if (!cell) {
        return;
    }
    cell.dataset.priceState = 'error';
    cell.classList.add('quote-error');
    const normalizedMessage = (message || '').trim();

    if (normalizedMessage === 'Set API key') {
        cell.textContent = '';
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'link-button link-button--inline';
        button.textContent = 'Set API key';
        button.addEventListener('click', (event) => {
            event.preventDefault();
            this.showView('settings');
        });
        cell.appendChild(button);
    } else {
        cell.textContent = normalizedMessage || 'Unavailable';
    }
    this.applyPositionHighlight(row, trade, null);
}

export function getQuoteErrorMessage(this: any, error: unknown) {
    const message = (error instanceof Error ? error.message : '').toLowerCase();
    if (!message) {
        return 'Unavailable';
    }
    if (message.includes('api key')) {
        return 'Set API key';
    }
    if (message.includes('rate limit')) {
        return 'Rate limited';
    }
    if (message.includes('symbol')) {
        return 'Bad ticker';
    }
    if (message.includes('network')) {
        return 'Network error';
    }
    return 'Unavailable';
}

export function getCachedQuote(this: any, ticker: string) {
    if (!ticker) {
        return null;
    }
    const cached = this.finnhub.cache.get(ticker);
    if (!cached) {
        return null;
    }
    if (Date.now() - cached.timestamp > this.finnhub.cacheTTL) {
        this.finnhub.cache.delete(ticker);
        return null;
    }
    return cached;
}

export function setCachedQuote(this: any, ticker: string, value: AnyRecord) {
    if (!ticker) {
        return;
    }
    this.finnhub.cache.set(ticker, {
        value,
        timestamp: Date.now()
    });
}

export function enqueueFinnhubRequest(this: any, symbol: string) {
    const execute = () => this.performFinnhubFetch(symbol);
    const chain = this.finnhub.rateLimitQueue
        .catch(() => undefined)
        .then(execute);

    this.finnhub.rateLimitQueue = chain
        .then(() => undefined)
        .catch(() => undefined);

    return chain;
}

export async function performFinnhubFetch(this: any, symbol: string) {
    await this.enforceFinnhubRateLimit();

    const url = new URL('https://finnhub.io/api/v1/quote');
    url.searchParams.set('symbol', symbol);
    url.searchParams.set('token', String(this.finnhub.apiKey || ''));

    let response: Response;
    try {
        response = await fetch(url.toString(), { cache: 'no-store' });
    } catch (error) {
        throw new Error('Network error fetching price');
    }

    if (!response.ok) {
        throw new Error(response.status === 429 ? 'Finnhub rate limit exceeded. Please wait.' : 'Finnhub API error');
    }

    let payload: unknown;
    try {
        payload = await response.json();
    } catch (error) {
        throw new Error('Invalid response from Finnhub');
    }

    const quote = parseFinnhubQuotePayload(payload);
    const change = Number(quote.d);
    const changePercent = Number(quote.dp);

    return {
        symbol,
        price: quote.c,
        change: Number.isFinite(change) ? change : null,
        changePercent: Number.isFinite(changePercent) ? changePercent : null,
        previousClose: quote.pc,
        open: quote.o,
        high: quote.h,
        low: quote.l,
        fetchedAt: new Date().toISOString(),
        currency: 'USD'
    };
}

export async function enforceFinnhubRateLimit(this: any) {
    const windowMs = 60_000;
    const timestamps = this.finnhub.timestamps;
    const maxRequests = this.finnhub.maxRequestsPerMinute;
    const now = Date.now();

    // Clean up old timestamps outside the rate limit window
    while (timestamps.length > 0 && now - timestamps[0] >= windowMs) {
        timestamps.shift();
    }

    // Enforce rate limit (requests per minute) using sliding window
    if (timestamps.length >= maxRequests) {
        const waitTime = windowMs - (now - timestamps[0]) + 50;
        await new Promise<void>((resolve) => setTimeout(resolve, waitTime));
        // Re-clean after waiting
        const afterWait = Date.now();
        while (timestamps.length > 0 && afterWait - timestamps[0] >= windowMs) {
            timestamps.shift();
        }
    }

    // Record this request timestamp
    timestamps.push(Date.now());
}

// ─── Market Status Badge ───────────────────────────────────────────────────

interface FinnhubMarketStatusPayload {
    exchange: string
    holiday: string | null
    isOpen: boolean
    session: 'pre_market' | 'market_hours' | 'after_hours' | ''
    t: number
    timezone: string
}

interface FinnhubContext {
    finnhub: {
        apiKey: string
        marketStatusTimer: ReturnType<typeof setTimeout> | null
        marketStatusCountdownTimer: ReturnType<typeof setInterval> | null
    }
    showView(name: string): void
}

function getNextRefreshMs(session: string): number {
    const etNow = new Date(
        new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })
    );
    const totalMinutes = etNow.getHours() * 60 + etNow.getMinutes();

    if (session === 'market_hours') {
        const minsUntilClose = 960 - totalMinutes + 1;
        return Math.max(minsUntilClose, 1) * 60_000;
    }
    if (session === 'pre_market') {
        const minsUntilOpen = 570 - totalMinutes + 1;
        return Math.max(minsUntilOpen, 1) * 60_000;
    }
    return 30 * 60_000;
}

function getCountdownText(session: string): string {
    const etNow = new Date(
        new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })
    );
    const totalMinutes = etNow.getHours() * 60 + etNow.getMinutes();

    if (session === 'market_hours') {
        const remaining = Math.max(960 - totalMinutes, 0);
        const h = Math.floor(remaining / 60);
        const m = remaining % 60;
        return h > 0 ? `closes in ${h}h ${m}m` : `closes in ${m}m`;
    }
    if (session === 'pre_market') {
        const remaining = Math.max(570 - totalMinutes, 0);
        const h = Math.floor(remaining / 60);
        const m = remaining % 60;
        return h > 0 ? `opens in ${h}h ${m}m` : `opens in ${m}m`;
    }
    return '';
}

export function updateMarketStatusBadge(this: FinnhubContext, payload: FinnhubMarketStatusPayload | null): void {
    const badge = document.getElementById('market-status');
    const label = document.getElementById('market-status-label');
    const countdown = document.getElementById('market-status-countdown');
    if (!badge || !label || !countdown) return;

    const modifiers = ['--loading', '--open', '--premarket', '--closed', '--unavailable'];
    modifiers.forEach(m => badge.classList.remove(`market-status${m}`));

    if (!payload) {
        badge.classList.add('market-status--unavailable');
        label.textContent = '';
        countdown.textContent = '';
        const link = document.createElement('button');
        link.type = 'button';
        link.className = 'link-button link-button--inline';
        link.textContent = 'Market status unavailable →';
        link.addEventListener('click', () => this.showView('settings'));
        label.appendChild(link);
        return;
    }

    countdown.textContent = getCountdownText(payload.session);

    if (payload.session === 'market_hours') {
        badge.classList.add('market-status--open');
        label.textContent = 'NYSE Open';
    } else if (payload.session === 'pre_market') {
        badge.classList.add('market-status--premarket');
        label.textContent = 'Pre-market';
    } else {
        badge.classList.add('market-status--closed');
        label.textContent = 'NYSE Closed';
    }
}

function scheduleNextMarketStatusFetch(this: FinnhubContext, session: string): void {
    if (this.finnhub.marketStatusTimer !== null) {
        clearTimeout(this.finnhub.marketStatusTimer);
    }
    const delay = getNextRefreshMs(session);
    this.finnhub.marketStatusTimer = setTimeout(() => {
        fetchMarketStatus.call(this as any);
    }, delay);
}

export async function fetchMarketStatus(this: FinnhubContext): Promise<void> {
    const apiKey = this.finnhub.apiKey;
    if (!apiKey) return;

    let payload: unknown;
    try {
        const url = `https://finnhub.io/api/v1/stock/market-status?exchange=US&token=${encodeURIComponent(apiKey)}`;
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) return;
        payload = await response.json();
    } catch {
        return;
    }

    // Finnhub returns session: null when the market is closed — allow null or string
    if (!isRecord(payload) || typeof payload.isOpen !== 'boolean') {
        return;
    }
    if (payload.session !== null && typeof payload.session !== 'string') {
        return;
    }

    // Normalize null → '' (internal "closed" sentinel)
    const validSessions = new Set(['pre_market', 'market_hours', 'after_hours', '']);
    const rawSession: string = payload.session === null ? '' : (payload.session as string);
    if (!validSessions.has(rawSession)) return;

    const typed: FinnhubMarketStatusPayload = {
        exchange: typeof payload.exchange === 'string' ? payload.exchange : '',
        holiday: payload.holiday === null || typeof payload.holiday === 'string' ? payload.holiday as string | null : null,
        isOpen: payload.isOpen,
        session: rawSession as FinnhubMarketStatusPayload['session'],
        t: typeof payload.t === 'number' ? payload.t : 0,
        timezone: typeof payload.timezone === 'string' ? payload.timezone : ''
    };

    updateMarketStatusBadge.call(this, typed);
    scheduleNextMarketStatusFetch.call(this, typed.session);

    if (this.finnhub.marketStatusCountdownTimer === null) {
        this.finnhub.marketStatusCountdownTimer = setInterval(() => {
            const badge = document.getElementById('market-status');
            if (!badge) return;
            const currentSession = badge.classList.contains('market-status--open') ? 'market_hours'
                : badge.classList.contains('market-status--premarket') ? 'pre_market'
                : '';
            const countdown = document.getElementById('market-status-countdown');
            if (countdown) countdown.textContent = getCountdownText(currentSession);
        }, 60_000);
    }
}

export function initMarketStatus(this: FinnhubContext): void {
    if (this.finnhub.marketStatusTimer !== null) {
        clearTimeout(this.finnhub.marketStatusTimer);
        this.finnhub.marketStatusTimer = null;
    }
    if (this.finnhub.marketStatusCountdownTimer !== null) {
        clearInterval(this.finnhub.marketStatusCountdownTimer);
        this.finnhub.marketStatusCountdownTimer = null;
    }

    if (!this.finnhub.apiKey) {
        updateMarketStatusBadge.call(this, null);
        return;
    }

    fetchMarketStatus.call(this as any);
}

// ---------------------------------------------------------------------------
// Earnings calendar — fetched once per session on init()
// ---------------------------------------------------------------------------

export async function fetchEarningsCalendar(
    this: any,
    tickers: string[],
    toDate: string
): Promise<void> {
    const apiKey = this.finnhub?.apiKey;
    if (!apiKey || !tickers.length) return;

    const from = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
    const url = new URL('https://finnhub.io/api/v1/calendar/earnings');
    url.searchParams.set('from', from);
    url.searchParams.set('to', toDate);
    url.searchParams.set('token', String(apiKey));

    try {
        const response = await fetch(url.toString());
        if (!response.ok) {
            console.warn(`[Finnhub] earnings calendar request failed: ${response.status}`);
            return;
        }
        const data: unknown = await response.json();
        if (
            !data ||
            typeof data !== 'object' ||
            !Array.isArray((data as Record<string, unknown>).earningsCalendar)
        ) {
            console.warn('[Finnhub] unexpected earnings calendar response shape');
            return;
        }
        const events = (data as { earningsCalendar: unknown[] }).earningsCalendar;
        const tickerSet = new Set(tickers.map(t => t.toUpperCase()));

        for (const event of events) {
            if (!event || typeof event !== 'object') continue;
            const e = event as Record<string, unknown>;
            const symbol = typeof e.symbol === 'string' ? e.symbol.toUpperCase() : null;
            const date = typeof e.date === 'string' ? e.date : null;
            if (!symbol || !date || !tickerSet.has(symbol)) continue;
            // Keep earliest upcoming date per ticker
            const existing = (this.earningsMap as Map<string, string>).get(symbol);
            if (!existing || date < existing) {
                (this.earningsMap as Map<string, string>).set(symbol, date);
            }
        }
    } catch (error) {
        console.warn('[Finnhub] failed to fetch earnings calendar:', error);
    }
}

// ---------------------------------------------------------------------------
// Stock metrics — fetched lazily on first ticker hover
// ---------------------------------------------------------------------------

export async function fetchStockMetrics(
    this: any,
    ticker: string
): Promise<import('../types/integrations.js').StockMetrics | null> {
    const apiKey = this.finnhub?.apiKey;
    if (!apiKey) return null;

    const url = new URL('https://finnhub.io/api/v1/stock/metric');
    url.searchParams.set('symbol', ticker.toUpperCase());
    url.searchParams.set('metric', 'all');
    url.searchParams.set('token', String(apiKey));

    try {
        const response = await fetch(url.toString());
        if (!response.ok) {
            console.warn(`[Finnhub] stock/metric request failed for ${ticker}: ${response.status}`);
            return null;
        }
        const data: unknown = await response.json();
        if (!data || typeof data !== 'object') return null;

        const m = ((data as Record<string, unknown>).metric ?? {}) as Record<string, unknown>;
        const series = ((m as Record<string, unknown>).series ?? {}) as Record<string, unknown>;
        const annual = ((series as Record<string, unknown>).annual ?? {}) as Record<string, unknown>;

        function safeNum(v: unknown): number | null {
            const n = Number(v);
            return Number.isFinite(n) ? n : null;
        }

        function latestSeries(arr: unknown): number | null {
            if (!Array.isArray(arr) || arr.length === 0) return null;
            const last = arr[arr.length - 1];
            if (!last || typeof last !== 'object') return null;
            return safeNum((last as Record<string, unknown>).v);
        }

        function parseSeriesArray(arr: unknown): { period: string; v: number }[] {
            if (!Array.isArray(arr)) return [];
            return arr
                .filter(item => item && typeof item === 'object')
                .map(item => {
                    const i = item as Record<string, unknown>;
                    return { period: String(i.period ?? ''), v: Number(i.v ?? 0) };
                })
                .filter(item => Number.isFinite(item.v));
        }

        // Current price from the quote cache
        const quoteCache = this.finnhub?.cache;
        const cachedQuote = (quoteCache instanceof Map ? quoteCache.get(ticker.toUpperCase()) : null) as Record<string, unknown> | null;
        const currentPrice = safeNum(cachedQuote?.c);

        return {
            currentPrice,
            beta: safeNum(m['beta']),
            marketCap: safeNum(m['marketCapitalization']),
            vol3MonthStd: safeNum(m['3MonthADReturnStd']),
            return5Day: safeNum(m['5DayPriceReturnDaily']),
            return52Week: safeNum(m['52WeekPriceReturnDaily']),
            week52High: safeNum(m['52WeekHigh']),
            week52Low: safeNum(m['52WeekLow']),
            week52HighDate: typeof m['52WeekHighDate'] === 'string' ? m['52WeekHighDate'] : null,
            week52LowDate: typeof m['52WeekLowDate'] === 'string' ? m['52WeekLowDate'] : null,
            peTTM: safeNum(m['peBasicExclExtraTTM']) ?? safeNum(m['peNormalizedAnnual']),
            forwardPE: safeNum(m['forwardPE']),
            pfcfTTM: safeNum(m['pfcfShareTTM']),
            evFCF: safeNum(m['currentEv/freeCashFlowTTM']),
            grossMarginTTM: safeNum(m['grossMarginTTM']),
            operatingMarginTTM: safeNum(m['operatingMarginTTM']),
            netMarginTTM: safeNum(m['netProfitMarginTTM']),
            fcfMarginLatest: latestSeries(annual['fcfMargin']),
            revenueGrowthYoY: safeNum(m['revenueGrowthTTMYoy']),
            epsGrowthYoY: safeNum(m['epsGrowthTTMYoy']),
            currentRatio: safeNum(m['currentRatioAnnual']),
            netDebtToEquity: safeNum(m['netDebtToTotalEquityAnnual']),
            epsAnnual: parseSeriesArray(annual['eps']),
        };
    } catch (error) {
        console.warn(`[Finnhub] failed to fetch stock metrics for ${ticker}:`, error);
        return null;
    }
}

// ---------------------------------------------------------------------------
// Pure lookup — called by Active Positions DTE cell renderer
// ---------------------------------------------------------------------------

export function getEarningsDateForTrade(
    this: any,
    trade: Record<string, unknown>
): string | null {
    const ticker = typeof trade.ticker === 'string' ? trade.ticker.toUpperCase() : null;
    const expiration = typeof trade.expirationDate === 'string' ? trade.expirationDate : null;
    if (!ticker || !expiration) return null;
    const earningsDate = (this.earningsMap as Map<string, string>).get(ticker);
    if (!earningsDate) return null;
    return earningsDate <= expiration ? earningsDate : null;
}

// ---------------------------------------------------------------------------
// Stock candles — fetched lazily on first row expand
// ---------------------------------------------------------------------------

export async function fetchCandleData(
    this: any,
    ticker: string
): Promise<import('../types/integrations.js').CandleData | null> {
    const apiKey = this.finnhub?.apiKey;
    if (!apiKey) return null;

    const now = Math.floor(Date.now() / 1000);
    const from = now - 90 * 86_400;
    const url = new URL('https://finnhub.io/api/v1/stock/candle');
    url.searchParams.set('symbol', ticker.toUpperCase());
    url.searchParams.set('resolution', 'D');
    url.searchParams.set('from', String(from));
    url.searchParams.set('to', String(now));
    url.searchParams.set('token', String(apiKey));

    try {
        const response = await fetch(url.toString());
        if (!response.ok) {
            console.warn(`[Finnhub] stock/candle request failed for ${ticker}: ${response.status}`);
            return null;
        }
        const data: unknown = await response.json();
        if (!data || typeof data !== 'object') return null;
        const d = data as Record<string, unknown>;
        const s = typeof d.s === 'string' ? d.s : 'no_data';
        if (s === 'no_data') return { t: [], o: [], h: [], l: [], c: [], s: 'no_data' };
        const t = Array.isArray(d.t) ? (d.t as number[]) : [];
        const o = Array.isArray(d.o) ? (d.o as number[]) : [];
        const h = Array.isArray(d.h) ? (d.h as number[]) : [];
        const l = Array.isArray(d.l) ? (d.l as number[]) : [];
        const c = Array.isArray(d.c) ? (d.c as number[]) : [];
        if (t.length === 0) return { t: [], o: [], h: [], l: [], c: [], s: 'no_data' };
        return { t, o, h, l, c, s };
    } catch (error) {
        console.warn(`[Finnhub] failed to fetch candle data for ${ticker}:`, error);
        return null;
    }
}

// ---------------------------------------------------------------------------
// Signals data — fetched lazily on first row expand via Promise.allSettled
// ---------------------------------------------------------------------------

export async function fetchSignalsData(
    this: any,
    ticker: string
): Promise<import('../types/integrations.js').SignalsData | null> {
    const apiKey = this.finnhub?.apiKey;
    if (!apiKey) return null;

    const sym = ticker.toUpperCase();
    const token = String(apiKey);
    const todayISO = new Date().toISOString().slice(0, 10);
    const from30d = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);

    function safeNum(v: unknown): number | null {
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
    }

    // Recommendation
    const recUrl = new URL('https://finnhub.io/api/v1/stock/recommendation')
    recUrl.searchParams.set('symbol', sym)
    recUrl.searchParams.set('token', token)

    // Price target
    const ptUrl = new URL('https://finnhub.io/api/v1/stock/price-target')
    ptUrl.searchParams.set('symbol', sym)
    ptUrl.searchParams.set('token', token)

    // News
    const newsUrl = new URL('https://finnhub.io/api/v1/company-news')
    newsUrl.searchParams.set('symbol', sym)
    newsUrl.searchParams.set('from', from30d)
    newsUrl.searchParams.set('to', todayISO)
    newsUrl.searchParams.set('token', token)

    // Insider transactions
    const insiderUrl = new URL('https://finnhub.io/api/v1/stock/insider-transactions')
    insiderUrl.searchParams.set('symbol', sym)
    insiderUrl.searchParams.set('token', token)

    // Social sentiment — average Reddit + Twitter score
    const sentUrl = new URL('https://finnhub.io/api/v1/stock/social-sentiment')
    sentUrl.searchParams.set('symbol', sym)
    sentUrl.searchParams.set('token', token)

    const [recResult, ptResult, newsResult, insiderResult, sentResult] = await Promise.allSettled([
        fetch(recUrl.toString()).then(r => r.ok ? r.json() : null),
        fetch(ptUrl.toString()).then(r => r.ok ? r.json() : null),
        fetch(newsUrl.toString()).then(r => r.ok ? r.json() : null),
        fetch(insiderUrl.toString()).then(r => r.ok ? r.json() : null),
        fetch(sentUrl.toString()).then(r => r.ok ? r.json() : null),
    ]);

    // Recommendation — results[0] is the most recent period
    let recommendation: import('../types/integrations.js').RecommendationTrend | null = null;
    if (recResult.status === 'fulfilled' && Array.isArray(recResult.value) && recResult.value.length > 0) {
        const r = recResult.value[0] as Record<string, unknown>;
        recommendation = {
            period: typeof r.period === 'string' ? r.period : '',
            strongBuy: Number(r.strongBuy) || 0,
            buy: Number(r.buy) || 0,
            hold: Number(r.hold) || 0,
            sell: Number(r.sell) || 0,
            strongSell: Number(r.strongSell) || 0,
        };
    }

    // Price target
    let priceTarget: import('../types/integrations.js').PriceTarget | null = null;
    if (ptResult.status === 'fulfilled' && ptResult.value && typeof ptResult.value === 'object') {
        const pt = ptResult.value as Record<string, unknown>;
        priceTarget = {
            targetMean: safeNum(pt.targetMean),
            targetHigh: safeNum(pt.targetHigh),
            targetLow: safeNum(pt.targetLow),
            targetMedian: safeNum(pt.targetMedian),
            lastUpdated: typeof pt.lastUpdated === 'string' ? pt.lastUpdated : null,
        };
    }

    // News — up to 5 items sorted newest first
    let news: import('../types/integrations.js').NewsItem[] = [];
    if (newsResult.status === 'fulfilled' && Array.isArray(newsResult.value)) {
        news = (newsResult.value as Record<string, unknown>[])
            .filter(item => item && typeof item === 'object')
            .sort((a, b) => Number(b.datetime ?? 0) - Number(a.datetime ?? 0))
            .slice(0, 5)
            .map(item => ({
                headline: typeof item.headline === 'string' ? item.headline : '',
                datetime: Number(item.datetime) || 0,
                url: typeof item.url === 'string' ? item.url : '',
                source: typeof item.source === 'string' ? item.source : '',
            }));
    }

    // Insider transactions — up to 5 most recent
    let insiderTransactions: import('../types/integrations.js').InsiderTransaction[] = [];
    if (insiderResult.status === 'fulfilled' && insiderResult.value && typeof insiderResult.value === 'object') {
        const data = (insiderResult.value as Record<string, unknown>).data;
        if (Array.isArray(data)) {
            insiderTransactions = (data as Record<string, unknown>[])
                .filter(item => item && typeof item === 'object')
                .sort((a, b) => String(b.filingDate ?? '').localeCompare(String(a.filingDate ?? '')))
                .slice(0, 5)
                .map(item => ({
                    transactionType: typeof item.transactionType === 'string' ? item.transactionType : '',
                    name: typeof item.name === 'string' ? item.name : '',
                    share: safeNum(item.share),
                    value: safeNum(item.value),
                    filingDate: typeof item.filingDate === 'string' ? item.filingDate : '',
                }));
        }
    }

    let socialSentimentScore: number | null = null;
    if (sentResult.status === 'fulfilled' && sentResult.value && typeof sentResult.value === 'object') {
        const sent = sentResult.value as Record<string, unknown>;
        const redditArr = Array.isArray(sent.reddit) ? sent.reddit as Record<string, unknown>[] : [];
        const twitterArr = Array.isArray(sent.twitter) ? sent.twitter as Record<string, unknown>[] : [];
        const redditScore = redditArr.length > 0 ? safeNum(redditArr[0].score) : null;
        const twitterScore = twitterArr.length > 0 ? safeNum(twitterArr[0].score) : null;
        if (redditScore !== null && twitterScore !== null) {
            socialSentimentScore = (redditScore + twitterScore) / 2;
        } else {
            socialSentimentScore = redditScore ?? twitterScore;
        }
    }

    // Return null only if every endpoint failed
    const allFailed = [recResult, ptResult, newsResult, insiderResult, sentResult]
        .every(r => r.status === 'rejected');
    if (allFailed) return null;

    return { recommendation, priceTarget, news, insiderTransactions, socialSentimentScore };
}
