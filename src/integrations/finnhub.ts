// src/integrations/finnhub.ts — Wave 5: Finnhub API integration.
// Uses the .call(this, …) delegation pattern so all this.* refs work.

import {
    DEFAULT_FINNHUB_RATE_LIMIT,
    FINNHUB_RATE_LIMIT_STORAGE_KEY,
    FINNHUB_SECRET_STORAGE_KEY,
    FINNHUB_STORAGE_KEY
} from '@core/config'
import {
    createRequestScheduler,
    isCancelledError,
    PRIORITY,
    type RequestScheduler
} from './request-scheduler'

type AnyRecord = Record<string, any>
const CREDIT_PLAYBOOK_QUOTE_CYCLE_PAUSE_MS = 5 * 60 * 1000;

/**
 * Cancellation groups for outbound Finnhub work. Every request carries one so
 * that switching away from a view can drop the requests that view asked for —
 * the free tier is 60 calls/minute and a hidden table must not spend them.
 */
export const QUOTE_SCOPE = {
    ACTIVE_POSITIONS: 'active-positions',
    ASSIGNED_POSITIONS: 'assigned-positions',
    CREDIT_PLAYBOOK: 'credit-playbook',
    WATCHLIST: 'watchlist',
    /** User-initiated and view-independent (form lookups, expanded row detail). */
    MANUAL: 'manual',
    /** Background enrichment: earnings, metrics, profiles, market status. */
    ENRICHMENT: 'enrichment'
} as const;

export type QuoteScope = typeof QUOTE_SCOPE[keyof typeof QUOTE_SCOPE];

/** Which view has to be open for a scope's requests to be worth spending on. */
const SCOPE_REQUIRED_VIEW: Record<string, string> = {
    [QUOTE_SCOPE.ACTIVE_POSITIONS]: 'dashboard',
    [QUOTE_SCOPE.ASSIGNED_POSITIONS]: 'dashboard',
    [QUOTE_SCOPE.CREDIT_PLAYBOOK]: 'credit-playbook',
    [QUOTE_SCOPE.WATCHLIST]: 'watchlist'
};

/** Scopes that are cancelled when their view closes, in cancellation order. */
const VIEW_BOUND_SCOPES: string[] = Object.keys(SCOPE_REQUIRED_VIEW);

/**
 * True when `scope`'s view is on screen. MANUAL and ENRICHMENT are never
 * view-bound: the user asked for those directly, or they feed data the whole
 * app reads from cache.
 */
export function isQuoteScopeVisible(this: any, scope: string): boolean {
    const requiredView = SCOPE_REQUIRED_VIEW[scope];
    if (!requiredView) return true;
    return this.currentView === requiredView;
}

/**
 * The shared request governor: priority queue + sliding-window rate limiter +
 * bounded concurrency + per-request timeout. Created lazily so existing
 * constructor wiring stays untouched, and re-synced with the user's configured
 * rate limit on every access (it is the single source of truth for the budget).
 */
export function getRequestScheduler(this: any): RequestScheduler {
    if (!this.finnhub.scheduler) {
        this.finnhub.scheduler = createRequestScheduler({
            maxConcurrent: 4,
            requestTimeoutMs: 10_000,
            maxRetries: 1,
            retryDelayMs: 750,
            maxRequestsPerWindow: Number(this.finnhub.maxRequestsPerMinute) || DEFAULT_FINNHUB_RATE_LIMIT
        });
    } else {
        this.finnhub.scheduler.setRateLimit(
            Number(this.finnhub.maxRequestsPerMinute) || DEFAULT_FINNHUB_RATE_LIMIT
        );
    }
    return this.finnhub.scheduler as RequestScheduler;
}

/**
 * Cancels every view-bound scope that is not currently on screen, then primes
 * the one that is. Called on each view switch: queued work for the view the
 * user just left is dropped and its in-flight fetches aborted, so the newly
 * opened view gets the whole per-minute budget immediately.
 */
export function syncQuoteScopesToActiveView(this: any): void {
    const scheduler: RequestScheduler = getRequestScheduler.call(this);
    VIEW_BOUND_SCOPES.forEach((scope) => {
        if (!isQuoteScopeVisible.call(this, scope)) scheduler.cancelScope(scope);
    });

    if (this.currentView === 'dashboard') {
        this.refreshActivePositionsQuotes({ prime: true });
        this.refreshAssignedPositionsQuotes({ prime: true });
    } else if (this.currentView === 'credit-playbook') {
        this.refreshCreditPlaybookQuotes({ prime: true });
    }
}

/**
 * Runs one Finnhub HTTP call under the scheduler: rate-limited, capped in
 * concurrency, aborted if it stalls, and cancellable by scope. `key` dedupes
 * concurrent callers asking for the same thing.
 */
export function scheduleFinnhubRequest<T>(
    this: any,
    key: string,
    scope: string,
    priority: number,
    run: (signal: AbortSignal) => Promise<T>
): Promise<T> {
    const scheduler: RequestScheduler = getRequestScheduler.call(this);
    return scheduler.submit<T>({ key, scope, priority, run });
}

/**
 * Shared transport for the non-quote endpoints. Wrapping them in the scheduler
 * keeps the rate-limit budget honest (they draw on the same 60/minute) and,
 * more importantly, gives every one of them the abort deadline they previously
 * lacked — an untimed fetch here used to hang forever with no way out.
 */
async function fetchFinnhubJson(
    this: any,
    url: string,
    key: string,
    scope: string,
    priority: number
): Promise<unknown> {
    return scheduleFinnhubRequest.call(this, key, scope, priority, async (signal: AbortSignal) => {
        const response = await fetch(url, { cache: 'no-store', signal });
        if (!response.ok) {
            throw new Error(response.status === 429
                ? 'Finnhub rate limit exceeded. Please wait.'
                : `Finnhub API error (${response.status})`);
        }
        return response.json();
    });
}

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
    const stored = this.safeLocalStorage.getItem(FINNHUB_RATE_LIMIT_STORAGE_KEY);
    if (stored !== null) {
        const value = parseInt(stored, 10);
        if (Number.isFinite(value) && value > 0) {
            return value;
        }
    }
    return DEFAULT_FINNHUB_RATE_LIMIT;
}

export function saveFinnhubRateLimitToStorage(this: any) {
    if (this.finnhub?.maxRequestsPerMinute) {
        this.safeLocalStorage.setItem(FINNHUB_RATE_LIMIT_STORAGE_KEY, String(this.finnhub.maxRequestsPerMinute));
    }
}

export function removeFinnhubRateLimitFromStorage(this: any) {
    this.safeLocalStorage.removeItem(FINNHUB_RATE_LIMIT_STORAGE_KEY);
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
    return FINNHUB_STORAGE_KEY;
}

export function saveFinnhubConfigToStorage(this: any) {
    try {
        const payload = { apiKey: this.finnhub.apiKey };
        this.safeLocalStorage.setItem(this.getFinnhubStorageKey(), JSON.stringify(payload));
    } catch (error) {
        console.warn('Failed to save Finnhub configuration:', error);
    }
}

export function removeFinnhubConfigFromStorage(this: any) {
    try {
        this.safeLocalStorage.removeItem(this.getFinnhubStorageKey());
    } catch (error) {
        console.warn('Failed to remove Finnhub configuration:', error);
    }
}

export function getFinnhubSecretStorageKey(this: any) {
    return FINNHUB_SECRET_STORAGE_KEY;
}

export async function loadFinnhubConfigFromStorage(this: any) {
    try {
        const raw = this.safeLocalStorage.getItem(this.getFinnhubStorageKey());
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

    let rawKeyB64 = this.safeLocalStorage.getItem(this.getFinnhubSecretStorageKey()) || '';
    if (!rawKeyB64) {
        const raw = cryptoApi.getRandomValues(new Uint8Array(32));
        rawKeyB64 = String(this.arrayBufferToBase64(raw.buffer));
        this.safeLocalStorage.setItem(this.getFinnhubSecretStorageKey(), rawKeyB64);
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
        this.safeLocalStorage.setItem(this.getFinnhubStorageKey(), JSON.stringify({ enc: true, payload }));
        return true;
    } catch (error) {
        console.warn('Failed to encrypt Finnhub API key:', error);
        return false;
    }
}

export async function getCurrentPrice(
    this: any,
    ticker: string,
    {
        forceRefresh = false,
        scope = QUOTE_SCOPE.MANUAL,
        priority = PRIORITY.VISIBLE_EMPTY
    }: { forceRefresh?: boolean; scope?: string; priority?: number } = {}
) {
    const symbol = (ticker || '').toString().trim().toUpperCase();
    if (!symbol) {
        throw new Error('Invalid symbol');
    }

    const schwabCached = this.schwab?.quoteCache?.get?.(symbol);
    if (schwabCached && !forceRefresh) {
        return {
            symbol,
            price: schwabCached.price,
            change: null,
            changePercent: null,
            previousClose: null,
            fetchedAt: schwabCached.capturedAt,
            provider: 'Schwab',
            providerTimestamp: schwabCached.providerTimestamp
        };
    }
    if (this.schwab?.vault
        && (forceRefresh || this.schwab?.automaticRefresh)
        && typeof this.getSchwabUnderlyingQuote === 'function') {
        try {
            const quote = await this.getSchwabUnderlyingQuote(symbol, forceRefresh);
            return {
                symbol,
                price: quote.price,
                change: null,
                changePercent: null,
                previousClose: null,
                fetchedAt: quote.capturedAt,
                provider: 'Schwab',
                providerTimestamp: quote.providerTimestamp
            };
        } catch (error) {
            if (!this.finnhub.apiKey) throw error;
        }
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

    const request = this.enqueueFinnhubRequest(symbol, { scope, priority })
        .then((result: AnyRecord) => {
            this.setCachedQuote(symbol, result);
            return result;
        })
        .catch((error: unknown) => {
            // A scope cancellation (view switch) is routine housekeeping, not a
            // failure the user needs to read about.
            if (!isCancelledError(error)) {
                const message = error instanceof Error ? error.message : 'Failed to load quote.';
                this.updateFinnhubStatus(message || 'Failed to load quote.', 'error', 7000);
            }
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
    // The scheduler owns the per-minute budget — keep it in step with the
    // user's new setting before recomputing the polling cadence.
    getRequestScheduler.call(this);

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

/**
 * Enqueues every entry of a scope that has no price yet, letting the scheduler's
 * pool and rate limiter govern the pace. This is the "fill the table now" path
 * used on table build and view activation.
 *
 * WHY NOT force: a rebuild re-renders rows that already hold a fresh cached
 * quote. Priming respects the cache, so a rebuild costs zero API calls for the
 * tickers it already knows and spends the budget only on genuinely empty cells.
 */
/**
 * Fetches one entry's quote. Renders straight into the entry's cell when that
 * cell is on screen; otherwise still fetches, which warms the shared quote cache
 * and updates the live trade snapshot.
 *
 * WHY THE CELL IS OPTIONAL: AG Grid virtualises columns, so a table wide enough
 * to push its price column out of the viewport never instantiates those cells.
 * Tying the fetch to the cell meant such a table silently showed no prices at
 * all — and the value is wanted regardless, because it feeds P&L snapshots and
 * must be there the moment the column scrolls into view.
 */
function refreshQuoteEntry(
    this: any,
    entry: AnyRecord,
    scope: string,
    { force = false, priority }: { force?: boolean; priority?: number } = {}
): boolean {
    const ticker = (entry?.trade?.ticker || '').toString().trim().toUpperCase();
    if (!ticker) return false;

    const cell = entry.cell as HTMLElement | null;
    if (cell?.isConnected) {
        const hasPrice = cell.dataset.priceState === 'ready';
        this.populateQuoteCell(cell, entry.trade, entry.row, {
            forceRefresh: force,
            silentIfCached: !force,
            suppressLoadingText: hasPrice,
            scope,
            priority: priority ?? (hasPrice ? PRIORITY.VISIBLE_REFRESH : PRIORITY.VISIBLE_EMPTY)
        });
        return true;
    }

    if (!force && this.getCachedQuote(ticker)) return true;
    this.getCurrentPrice(ticker, {
        forceRefresh: force,
        scope,
        priority: priority ?? PRIORITY.VISIBLE_EMPTY
    }).catch(() => undefined);
    return true;
}

function primeQuoteEntries(
    this: any,
    entries: Map<string, AnyRecord> | undefined,
    scope: string
): void {
    if (!(entries instanceof Map) || entries.size === 0) return;
    if (!isQuoteScopeVisible.call(this, scope)) return;

    for (const [key, entry] of [...entries.entries()]) {
        const cell = entry?.cell as HTMLElement | null | undefined;
        // A detached cell means the column is not rendered right now, not that
        // the row is gone — clear the stale element and keep fetching.
        if (cell && !cell.isConnected) entry.cell = null;
        if (!refreshQuoteEntry.call(this, entry, scope)) {
            entries.delete(key);
        }
    }
}

export function refreshActivePositionsQuotes(this: any, { force = false, immediate = false, prime = false }: { force?: boolean; immediate?: boolean; prime?: boolean } = {}) {
    // Process ONE Active Positions quote per call to respect rate limits
    // Called by unified auto-refresh timer that alternates between tables
    if (!(this.activeQuoteEntries instanceof Map) || this.activeQuoteEntries.size === 0) {
        this.stopQuoteAutoRefresh();
        return;
    }

    // Dashboard is not on screen — its rows are stale DOM behind another view.
    if (!isQuoteScopeVisible.call(this, QUOTE_SCOPE.ACTIVE_POSITIONS)) {
        return;
    }

    if (prime) {
        primeQuoteEntries.call(this, this.activeQuoteEntries, QUOTE_SCOPE.ACTIVE_POSITIONS);
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
            suppressLoadingText: !immediate,
            scope: QUOTE_SCOPE.ACTIVE_POSITIONS,
            priority: PRIORITY.VISIBLE_REFRESH
        });
        return;
    }

    if (this.activeQuoteEntries.size === 0) {
        this.stopQuoteAutoRefresh();
    }
}

export function refreshAssignedPositionsQuotes(this: any, { force = false, immediate = false, prime = false }: { force?: boolean; immediate?: boolean; prime?: boolean } = {}) {
    // Process ONE Assigned Positions quote per call to respect rate limits
    // Called by unified auto-refresh timer that alternates between tables
    if (!(this.assignedPositionsQuoteEntries instanceof Map) || this.assignedPositionsQuoteEntries.size === 0) {
        return;
    }

    if (!isQuoteScopeVisible.call(this, QUOTE_SCOPE.ASSIGNED_POSITIONS)) {
        return;
    }

    // Table rebuilds replace assignedPositionsQuoteEntries with a fresh Map on
    // every quote update (see updateAssignedPositionsTable), which resets every
    // cell back to "no price". Without a cursor that survives that replacement,
    // scanning from the start of the Map on every call re-selects row 1 (or 2)
    // forever and rows further down are never reached — persist the cursor on
    // `this` (like quoteRefreshCursor/creditPlaybookQuoteCursor) instead.
    const entries: Array<[string, AnyRecord]> = [];
    for (const [key, entry] of this.assignedPositionsQuoteEntries.entries()) {
        if (!entry || !entry.key) {
            this.assignedPositionsQuoteEntries.delete(key);
            continue;
        }
        entries.push([key, entry]);
    }

    if (entries.length === 0) {
        return;
    }

    if (!Number.isInteger(this.assignedPositionsQuoteCursor)) {
        this.assignedPositionsQuoteCursor = 0;
    }

    const hasNoPrice = (entry: AnyRecord) => {
        const marketValueText = entry.marketValueCell?.textContent || '';
        return !marketValueText || marketValueText === '—' || marketValueText === 'Loading…';
    };

    if (prime) {
        entries.forEach(([, entry]) => {
            if (!hasNoPrice(entry)) return;
            fetchAssignedPositionQuote.call(this, entry, false, PRIORITY.VISIBLE_EMPTY);
        });
        return;
    }

    const startIndex = this.assignedPositionsQuoteCursor % entries.length;
    let selectedIndex = -1;

    // First pass: look for the next high-priority entry (no price yet, errors, rate-limited)
    for (let offset = 0; offset < entries.length; offset += 1) {
        const index = (startIndex + offset) % entries.length;
        if (hasNoPrice(entries[index][1])) {
            selectedIndex = index;
            break;
        }
    }

    // Second pass: if every entry already has a price, just take the next one in rotation
    if (selectedIndex === -1) {
        selectedIndex = startIndex;
    }

    const [keyToRefresh, entryToRefresh] = entries[selectedIndex];
    this.assignedPositionsQuoteCursor = (selectedIndex + 1) % entries.length;

    // Process one entry per refresh cycle
    if (entryToRefresh) {
        if (!fetchAssignedPositionQuote.call(this, entryToRefresh, force, PRIORITY.VISIBLE_REFRESH)) {
            this.assignedPositionsQuoteEntries.delete(keyToRefresh);
        }
    }
}

/**
 * Fetches one assigned-position quote and pushes it into that row's metric
 * cells. Returns false when the entry has no usable ticker (caller drops it).
 */
function fetchAssignedPositionQuote(
    this: any,
    entry: AnyRecord,
    force: boolean,
    priority: number
): boolean {
    const ticker = (entry.trade?.ticker || '').toString().trim().toUpperCase();
    if (!ticker) return false;

    this.getCurrentPrice(ticker, {
        forceRefresh: force,
        scope: QUOTE_SCOPE.ASSIGNED_POSITIONS,
        priority
    })
        .then((quote: AnyRecord) => {
            updateLiveTradeSnapshotFromQuote.call(this, entry.trade, quote);
            this.updateAssignedPositionMetrics(entry, quote);
        })
        .catch((error: unknown) => {
            // A view switch cancelled this — keep whatever the row already shows.
            if (isCancelledError(error)) return;
            // Mark as needing refresh on next cycle
            if (entry.currentPriceCell) {
                entry.currentPriceCell.textContent = '—';
            }
            if (entry.marketValueCell) {
                entry.marketValueCell.textContent = '—';
            }
            if (entry.unrealizedGLCell) {
                entry.unrealizedGLCell.textContent = '—';
                entry.unrealizedGLCell.classList.remove('pl-positive', 'pl-negative', 'pl-neutral');
            }
        });
    return true;
}

function updateLiveTradeSnapshotFromQuote(this: any, quoteTrade: AnyRecord, quote: AnyRecord): void {
    if (!Array.isArray(this.trades) || !quoteTrade || !quote) {
        return;
    }

    const price = Number(quote.price);
    if (!Number.isFinite(price) || price <= 0) {
        return;
    }

    const quoteTradeId = quoteTrade.tradeId ?? quoteTrade.id ?? null;
    const ticker = String(quoteTrade.ticker || '').trim().toUpperCase();
    if (!quoteTradeId && !ticker) {
        return;
    }

    const matches = this.trades.filter((candidate: AnyRecord) => {
        if (!candidate || typeof candidate !== 'object' || this.isClosedStatus(candidate.status)) {
            return false;
        }

        const heldShares = Number(this.getTradeOpenStockShares?.(candidate)) || 0;
        const heldLongCalls = this.isPmccTrade?.(candidate)
            ? Number(this.getNetOpenLongCallContracts?.(candidate)) || 0
            : 0;
        if (heldShares <= 0 && heldLongCalls <= 0) {
            return false;
        }

        if (quoteTradeId) {
            return String(candidate.id ?? '') === String(quoteTradeId);
        }

        return String(candidate.ticker || '').trim().toUpperCase() === ticker;
    });

    if (matches.length === 0) {
        return;
    }

    const fetchedAt = typeof quote.fetchedAt === 'string' && quote.fetchedAt
        ? quote.fetchedAt
        : new Date().toISOString();
    const changedIds = new Set<string>();

    this.trades = this.trades.map((candidate: AnyRecord) => {
        if (!matches.includes(candidate)) {
            return candidate;
        }

        const existingPrice = Number(candidate.marketPriceSnapshot);
        if (existingPrice === price && Number.isFinite(candidate.unrealizedPL)) {
            return candidate;
        }

        const refreshed = this.enrichTradeData({
            ...candidate,
            marketPriceSnapshot: price,
            marketPriceSnapshotAt: fetchedAt
        });
        changedIds.add(String(candidate.id ?? `${candidate.ticker}|${candidate.openedDate || ''}`));
        return refreshed;
    });

    if (changedIds.size === 0 || this.quotePnlRefreshTimerId) {
        return;
    }

    this.quotePnlRefreshTimerId = setTimeout(() => {
        this.quotePnlRefreshTimerId = null;

        if (this.currentView === 'credit-playbook' && typeof this.updateCreditPlaybookView === 'function') {
            const wasSuppressed = this.creditPlaybookQuoteRefreshSuppressed;
            this.creditPlaybookQuoteRefreshSuppressed = true;
            try {
                this.updateCreditPlaybookView();
            } finally {
                this.creditPlaybookQuoteRefreshSuppressed = wasSuppressed;
            }
        } else if (this.currentView === 'dashboard' && typeof this.updateDashboard === 'function') {
            this.updateDashboard();
        } else {
            this.creditPlaybookNeedsRefresh = true;
        }
    }, 0);
}

export function refreshCreditPlaybookQuotes(this: any, { force = false, immediate = false, manual = false, prime = false }: { force?: boolean; immediate?: boolean; manual?: boolean; prime?: boolean } = {}) {
    // Process ONE Credit Playbook quote per call to respect rate limits
    // Called by unified auto-refresh timer that alternates between tables
    if (!(this.creditPlaybookQuoteEntries instanceof Map) || this.creditPlaybookQuoteEntries.size === 0) {
        return;
    }

    if (!isQuoteScopeVisible.call(this, QUOTE_SCOPE.CREDIT_PLAYBOOK)) {
        return;
    }

    if (prime) {
        primeQuoteEntries.call(this, this.creditPlaybookQuoteEntries, QUOTE_SCOPE.CREDIT_PLAYBOOK);
        return;
    }

    const now = Date.now();
    if (manual) {
        this.creditPlaybookQuotePauseUntil = 0;
        this.creditPlaybookQuoteCursor = 0;
        this.creditPlaybookQuoteCycleKeys.clear();
    } else if (this.creditPlaybookQuotePauseUntil > now) {
        if (typeof this.syncCreditPlaybookQuoteRefreshStatus === 'function') {
            this.syncCreditPlaybookQuoteRefreshStatus();
        }
        return;
    }

    if (typeof this.syncCreditPlaybookQuoteRefreshStatus === 'function') {
        this.syncCreditPlaybookQuoteRefreshStatus();
    }

    // Find one entry to refresh, prioritizing by state. An entry whose cell is
    // absent or detached is kept: that only means AG Grid has not rendered the
    // Current Price column (it is virtualised out at normal window widths), and
    // the quote is still wanted for the cache and the P&L snapshot.
    const entries: Array<[string, AnyRecord]> = [];
    for (const [key, entry] of this.creditPlaybookQuoteEntries.entries()) {
        if (!entry || !entry.trade?.ticker) {
            this.creditPlaybookQuoteEntries.delete(key);
            this.creditPlaybookQuoteCycleKeys.delete(key);
            continue;
        }
        if (entry.cell && !entry.cell.isConnected) entry.cell = null;
        entries.push([key, entry]);
    }

    if (entries.length === 0) {
        this.stopQuoteAutoRefresh();
        return;
    }

    const currentKeys = new Set(entries.map(([key]) => key));
    for (const key of this.creditPlaybookQuoteCycleKeys) {
        if (!currentKeys.has(key)) {
            this.creditPlaybookQuoteCycleKeys.delete(key);
        }
    }

    const startIndex = this.creditPlaybookQuoteCursor % entries.length;
    const findEntry = (predicate: (entry: AnyRecord) => boolean): [string, AnyRecord, number] | null => {
        for (let offset = 0; offset < entries.length; offset += 1) {
            const index = (startIndex + offset) % entries.length;
            const [key, entry] = entries[index];
            if (!this.creditPlaybookQuoteCycleKeys.has(key) && predicate(entry)) {
                return [key, entry, index];
            }
        }
        return null;
    };

    let selected = findEntry((entry) => {
        // No cell rendered → judge by the cache instead of the DOM.
        if (!entry.cell) {
            return !this.getCachedQuote((entry.trade?.ticker || '').toString().trim().toUpperCase());
        }
        const state = entry.cell?.dataset?.priceState;
        return !state || state === 'idle' || state === 'error' || state === 'loading' || state === 'refreshing';
    });

    // First pass: look for high-priority entries (no price yet, errors, rate-limited, unavailable)
    // If every unprocessed entry is already ready, continue the same cursor-based pass.
    if (!selected) {
        selected = findEntry(() => true);
    }

    if (!selected) {
        this.creditPlaybookQuotePauseUntil = now + CREDIT_PLAYBOOK_QUOTE_CYCLE_PAUSE_MS;
        this.creditPlaybookQuoteCycleKeys.clear();
        if (typeof this.syncCreditPlaybookQuoteRefreshStatus === 'function') {
            this.syncCreditPlaybookQuoteRefreshStatus();
        }
        return;
    }

    const [keyToRefresh, entryToRefresh, selectedIndex] = selected;
    this.creditPlaybookQuoteCycleKeys.add(keyToRefresh);
    this.creditPlaybookQuoteCursor = (selectedIndex + 1) % entries.length;

    if (this.creditPlaybookQuoteCycleKeys.size >= entries.length) {
        this.creditPlaybookQuotePauseUntil = now + CREDIT_PLAYBOOK_QUOTE_CYCLE_PAUSE_MS;
        this.creditPlaybookQuoteCycleKeys.clear();
        if (typeof this.syncCreditPlaybookQuoteRefreshStatus === 'function') {
            this.syncCreditPlaybookQuoteRefreshStatus();
        }
    }

    // Process one entry per refresh cycle
    refreshQuoteEntry.call(this, entryToRefresh, QUOTE_SCOPE.CREDIT_PLAYBOOK, {
        force,
        priority: PRIORITY.VISIBLE_REFRESH
    });

    // Stop auto-refresh if no more entries
    if (this.creditPlaybookQuoteEntries.size === 0) {
        this.stopQuoteAutoRefresh();
    }
}

export function populateQuoteCell(this: any, cell: HTMLElement | null, trade: AnyRecord, row: HTMLElement | null, options: { forceRefresh?: boolean; deferNetworkFetch?: boolean; silentIfCached?: boolean; suppressLoadingText?: boolean; scope?: string; priority?: number } = {}) {
    const {
        forceRefresh = false,
        deferNetworkFetch = false,
        silentIfCached = false,
        suppressLoadingText = false,
        scope = QUOTE_SCOPE.MANUAL,
        priority = PRIORITY.VISIBLE_EMPTY
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

    const schwabCached = this.schwab?.quoteCache?.get?.(ticker);
    if (schwabCached) {
        this.renderQuoteValue(cell, row, trade, {
            price: schwabCached.price,
            fetchedAt: schwabCached.capturedAt,
            provider: 'Schwab',
            providerTimestamp: schwabCached.providerTimestamp
        });
        return;
    }
    const cached = forceRefresh ? null : this.getCachedQuote(ticker);
    if (cached) {
        this.renderQuoteValue(cell, row, trade, cached.value);
        return;
    }
    if (!this.finnhub.apiKey && !(this.schwab?.vault && this.schwab?.automaticRefresh)) {
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

    if ((!this.finnhub.apiKey && !(this.schwab?.vault && this.schwab?.automaticRefresh)) || deferNetworkFetch) {
        return;
    }

    // Hidden views never spend the per-minute budget. Anything cached above has
    // already rendered; the rest waits until the view is opened and primed.
    if (!isQuoteScopeVisible.call(this, scope)) {
        cell.dataset.priceState = 'idle';
        return;
    }

    this.getCurrentPrice(ticker, { forceRefresh, scope, priority })
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
            // Cancelled by a view switch — leave the cell as-is so it does not
            // flash an error the user never caused.
            if (isCancelledError(error)) {
                if (cell.dataset.priceState !== 'ready') cell.dataset.priceState = 'idle';
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
    const fetchedAt = typeof quote?.fetchedAt === 'string' ? quote.fetchedAt : '';
    const provider = typeof quote?.provider === 'string' ? quote.provider : 'Market data';
    const stale = fetchedAt && typeof this.isSchwabQuoteStale === 'function'
        ? this.isSchwabQuoteStale(fetchedAt)
        : false;

    updateLiveTradeSnapshotFromQuote.call(this, trade, quote);

    cell.innerHTML = '';
    cell.dataset.quoteState = stale ? 'stale' : 'fresh';
    cell.title = fetchedAt
        ? `${provider} quote · Updated ${new Date(fetchedAt).toLocaleString()}${stale ? ' · Stale' : ''}`
        : `${provider} quote`;

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

    if (stale) {
        const staleEl = document.createElement('span');
        staleEl.className = 'quote-age';
        staleEl.textContent = 'Stale';
        cell.appendChild(staleEl);
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

/**
 * Queues one quote fetch on the shared scheduler.
 *
 * WHY NOT A PROMISE CHAIN: this used to append every request to a single
 * `finnhub.rateLimitQueue` promise whose head awaited an untimed `fetch()`.
 * One stalled connection therefore blocked every quote in the app forever —
 * cells sat at "Loading…" and no further request was ever issued. The
 * scheduler bounds each request with an abort deadline and keeps the other
 * pool lanes draining.
 */
export function enqueueFinnhubRequest(
    this: any,
    symbol: string,
    { scope = QUOTE_SCOPE.MANUAL, priority = PRIORITY.VISIBLE_EMPTY }: { scope?: string; priority?: number } = {}
) {
    return scheduleFinnhubRequest.call(
        this,
        `quote:${symbol}`,
        scope,
        priority,
        (signal: AbortSignal) => this.performFinnhubFetch(symbol, signal)
    );
}

export async function performFinnhubFetch(this: any, symbol: string, signal?: AbortSignal) {
    const url = new URL('https://finnhub.io/api/v1/quote');
    url.searchParams.set('symbol', symbol);
    url.searchParams.set('token', String(this.finnhub.apiKey || ''));

    let response: Response;
    try {
        response = await fetch(url.toString(), { cache: 'no-store', signal });
    } catch (error) {
        // Re-throw abort/timeout unchanged so the scheduler can retry or the
        // caller can tell cancellation apart from a genuine network failure.
        if ((error as { name?: string })?.name === 'AbortError' || isCancelledError(error)) {
            throw error;
        }
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
    if (session === 'after_hours') {
        // Extended-hours trading runs until 8:00pm ET (minute 1200).
        const minsUntilClose = 1200 - totalMinutes + 1;
        return Math.max(minsUntilClose, 1) * 60_000;
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
    if (session === 'after_hours') {
        const remaining = Math.max(1200 - totalMinutes, 0);
        const h = Math.floor(remaining / 60);
        const m = remaining % 60;
        return h > 0 ? `closes in ${h}h ${m}m` : `closes in ${m}m`;
    }
    return '';
}

export function updateMarketStatusBadge(this: FinnhubContext, payload: FinnhubMarketStatusPayload | null): void {
    const badge = document.getElementById('market-status');
    const label = document.getElementById('market-status-label');
    const countdown = document.getElementById('market-status-countdown');
    if (!badge || !label || !countdown) return;

    const modifiers = ['--loading', '--open', '--premarket', '--afterhours', '--closed', '--unavailable'];
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
    } else if (payload.session === 'after_hours') {
        badge.classList.add('market-status--afterhours');
        label.textContent = 'After-hours';
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
        payload = await fetchFinnhubJson.call(
            this as any, url, 'market-status', QUOTE_SCOPE.ENRICHMENT, PRIORITY.BACKGROUND
        );
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

    // Normalise Finnhub session string → internal sentinel
    //   Finnhub canonical values (per API docs): "pre-market" | "regular" | "post-market" | null
    //   Internal sentinels used by this module:  "pre_market" | "market_hours" | "after_hours" | ""
    const SESSION_MAP: Record<string, string> = {
        'pre-market':  'pre_market',
        'pre_market':  'pre_market',   // defensive: underscore variant
        'regular':     'market_hours',
        'market_hours':'market_hours', // defensive: already-internal variant
        'post-market': 'after_hours',
        'after_hours': 'after_hours',  // defensive: already-internal variant
    };
    const rawSession: string = payload.session === null
        ? ''
        : (SESSION_MAP[payload.session as string] ?? '');
    const validSessions = new Set(['pre_market', 'market_hours', 'after_hours', '']);
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
                : badge.classList.contains('market-status--afterhours') ? 'after_hours'
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
        const data: unknown = await fetchFinnhubJson.call(
            this, url.toString(), `earnings-calendar:${from}:${toDate}`,
            QUOTE_SCOPE.ENRICHMENT, PRIORITY.BACKGROUND
        );
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
            const existing = (this.earningsMap as Map<string, import('../types/integrations.js').EarningsCalendarEntry>).get(symbol);
            if (!existing || date < existing.date) {
                const safeN = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
                (this.earningsMap as Map<string, import('../types/integrations.js').EarningsCalendarEntry>).set(symbol, {
                    date,
                    hour: typeof e.hour === 'string' ? e.hour : '',
                    quarter: safeN(e.quarter),
                    year: safeN(e.year),
                    epsEstimate: safeN(e.epsEstimate),
                });
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
        const data: unknown = await fetchFinnhubJson.call(
            this, url.toString(), `metric:${ticker.toUpperCase()}`,
            QUOTE_SCOPE.MANUAL, PRIORITY.IMMEDIATE
        );
        if (!data || typeof data !== 'object') return null;

        const raw = data as Record<string, unknown>;
        // BUG FIX: series is at data.series, NOT data.metric.series
        const m = (raw.metric ?? {}) as Record<string, unknown>;
        const seriesRoot = (raw.series ?? {}) as Record<string, unknown>;
        const annual = (seriesRoot.annual ?? {}) as Record<string, unknown>;

        function safeNum(v: unknown): number | null {
            const n = Number(v);
            return Number.isFinite(n) ? n : null;
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

        const quoteCache = this.finnhub?.cache;
        const cachedEntry = (quoteCache instanceof Map ? quoteCache.get(ticker.toUpperCase()) : null) as { value?: Record<string, unknown> } | null;
        // Cached quotes are normalized (`price`), not raw Finnhub keys (`c`).
        const currentPrice = safeNum(cachedEntry?.value?.price);

        return {
            currentPrice,
            beta: safeNum(m['beta']),
            marketCap: safeNum(m['marketCapitalization']),
            vol3MonthStd: safeNum(m['3MonthADReturnStd']),
            return5Day: safeNum(m['5DayPriceReturnDaily']),
            return13Week: safeNum(m['13WeekPriceReturnDaily']),
            return52Week: safeNum(m['52WeekPriceReturnDaily']),
            week52High: safeNum(m['52WeekHigh']),
            week52Low: safeNum(m['52WeekLow']),
            week52HighDate: typeof m['52WeekHighDate'] === 'string' ? m['52WeekHighDate'] : null,
            week52LowDate: typeof m['52WeekLowDate'] === 'string' ? m['52WeekLowDate'] : null,
            vol10DayAvg: safeNum(m['10DayAverageTradingVolume']),
            vol3MonthAvg: safeNum(m['3MonthAverageTradingVolume']),
            priceRelToSP500_13W: safeNum(m['priceRelativeToS&P50013WeekPriceReturn']) ?? safeNum(m['priceRelativeToS&P50013Week']),
            peTTM: safeNum(m['peBasicExclExtraTTM']) ?? safeNum(m['peNormalizedAnnual']),
            forwardPE: safeNum(m['forwardPE']),
            forwardPEG: safeNum(m['forwardPEG']),
            pfcfTTM: safeNum(m['pfcfShareTTM']),
            evFCF: safeNum(m['currentEv/freeCashFlowTTM']),
            evEbitda: safeNum(m['evEbitdaTTM']),
            grossMarginTTM: safeNum(m['grossMarginTTM']),
            operatingMarginTTM: safeNum(m['operatingMarginTTM']),
            netMarginTTM: safeNum(m['netProfitMarginTTM']),
            fcfMarginLatest: null,
            roeTTM: safeNum(m['roeTTM']),
            revenueGrowthYoY: safeNum(m['revenueGrowthTTMYoy']),
            epsGrowthYoY: safeNum(m['epsGrowthTTMYoy']),
            currentRatio: safeNum(m['currentRatioAnnual']),
            netDebtToEquity: safeNum(m['netDebtToTotalEquityAnnual']),
            debtToEquity: safeNum(m['totalDebt/totalEquityAnnual']),
            interestCoverage: safeNum(m['netInterestCoverageAnnual']),
            epsAnnual: parseSeriesArray(annual['eps']),
            peAnnualSeries: parseSeriesArray(annual['pe']),
            grossMarginSeries: parseSeriesArray(annual['grossMargin']),
            fcfPerShareSeries: parseSeriesArray(annual['fcfPerShareTTM']),
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
): import('../types/integrations.js').EarningsCalendarEntry | null {
    const ticker = typeof trade.ticker === 'string' ? trade.ticker.toUpperCase() : null;
    const expiration = typeof trade.expirationDate === 'string' ? trade.expirationDate : null;
    if (!ticker || !expiration) return null;
    const entry = (this.earningsMap as Map<string, import('../types/integrations.js').EarningsCalendarEntry>).get(ticker);
    if (!entry) return null;
    return entry.date <= expiration ? entry : null;
}

// ---------------------------------------------------------------------------
// Dividend Calendar — fetched to populate Watchlist dividends
// ---------------------------------------------------------------------------

export async function fetchDividendCalendar(
    this: any,
    fromYYYYMMDD: string,
    toYYYYMMDD: string
): Promise<import('../types/integrations.js').DividendCalendarEntry[]> {
    const apiKey = this.finnhub?.apiKey;
    if (!apiKey) return [];

    const url = new URL('https://finnhub.io/api/v1/calendar/dividend');
    url.searchParams.set('from', fromYYYYMMDD);
    url.searchParams.set('to', toYYYYMMDD);
    url.searchParams.set('token', String(apiKey));

    try {
        const data: any = await fetchFinnhubJson.call(
            this, url.toString(), `dividend:${fromYYYYMMDD}:${toYYYYMMDD}`,
            QUOTE_SCOPE.ENRICHMENT, PRIORITY.BACKGROUND
        );
        if (!data || !Array.isArray(data.calendar)) return [];
        
        return data.calendar as import('../types/integrations.js').DividendCalendarEntry[];
    } catch (error) {
        console.warn(`[Finnhub] failed to fetch dividend calendar:`, error);
        return [];
    }
}

// ---------------------------------------------------------------------------
// Company profile — fetched lazily on first row expand, cached permanently
// ---------------------------------------------------------------------------

export async function fetchCompanyProfile(
    this: any,
    ticker: string
): Promise<import('../types/integrations.js').CompanyProfile | null> {
    const apiKey = this.finnhub?.apiKey;
    if (!apiKey) return null;

    const url = new URL('https://finnhub.io/api/v1/stock/profile2');
    url.searchParams.set('symbol', ticker.toUpperCase());
    url.searchParams.set('token', String(apiKey));

    try {
        const data: unknown = await fetchFinnhubJson.call(
            this, url.toString(), `profile:${ticker.toUpperCase()}`,
            QUOTE_SCOPE.MANUAL, PRIORITY.IMMEDIATE
        );
        if (!data || typeof data !== 'object') return null;
        const d = data as Record<string, unknown>;
        const name = typeof d.name === 'string' ? d.name : '';
        if (!name) return null;
        return {
            name,
            industry: typeof d.finnhubIndustry === 'string' ? d.finnhubIndustry : '',
            logo: typeof d.logo === 'string' ? d.logo : '',
            exchange: typeof d.exchange === 'string' ? d.exchange : '',
        };
    } catch (error) {
        console.warn(`[Finnhub] failed to fetch company profile for ${ticker}:`, error);
        return null;
    }
}

// ---------------------------------------------------------------------------
// Earnings surprise history — last 4 quarters
// ---------------------------------------------------------------------------

export async function fetchEarningsSurprise(
    this: any,
    ticker: string
): Promise<import('../types/integrations.js').EarningsSurprise[] | null> {
    const apiKey = this.finnhub?.apiKey;
    if (!apiKey) return null;

    const url = new URL('https://finnhub.io/api/v1/stock/earnings');
    url.searchParams.set('symbol', ticker.toUpperCase());
    url.searchParams.set('token', String(apiKey));

    function safeNum(v: unknown): number | null {
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
    }

    try {
        const data: unknown = await fetchFinnhubJson.call(
            this, url.toString(), `earnings-surprise:${ticker.toUpperCase()}`,
            QUOTE_SCOPE.MANUAL, PRIORITY.IMMEDIATE
        );
        if (!Array.isArray(data) || data.length === 0) return null;

        return (data as Record<string, unknown>[])
            .filter(item => item && typeof item === 'object')
            .slice(0, 4)
            .map(item => ({
                period: typeof item.period === 'string' ? item.period : '',
                quarter: Number(item.quarter) || 0,
                year: Number(item.year) || 0,
                actual: safeNum(item.actual),
                estimate: safeNum(item.estimate),
                surprisePercent: safeNum(item.surprisePercent),
            }));
    } catch (error) {
        console.warn(`[Finnhub] failed to fetch earnings for ${ticker}:`, error);
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

    // IMMEDIATE, not BACKGROUND: the user expanded this row and is watching a
    // spinner. The dashboard's quote polling occupies the whole per-minute
    // budget at the default rate, so a lower priority here would leave the panel
    // waiting behind up to a minute of routine re-polls.
    const [recResult, newsResult, insiderResult] = await Promise.allSettled([
        fetchFinnhubJson.call(this, recUrl.toString(), `recommendation:${sym}`, QUOTE_SCOPE.MANUAL, PRIORITY.IMMEDIATE),
        fetchFinnhubJson.call(this, newsUrl.toString(), `news:${sym}`, QUOTE_SCOPE.MANUAL, PRIORITY.IMMEDIATE),
        fetchFinnhubJson.call(this, insiderUrl.toString(), `insider:${sym}`, QUOTE_SCOPE.MANUAL, PRIORITY.IMMEDIATE),
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
                summary: typeof item.summary === 'string' ? item.summary : '',
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
                    transactionCode: typeof item.transactionCode === 'string' ? item.transactionCode : null,
                    isDerivative: item.isDerivative === true,
                    name: typeof item.name === 'string' ? item.name : '',
                    share: safeNum(item.share),
                    value: safeNum(item.value),
                    filingDate: typeof item.filingDate === 'string' ? item.filingDate : '',
                }));
        }
    }

    // Return null only if every endpoint failed
    const allFailed = [recResult, newsResult, insiderResult]
        .every(r => r.status === 'rejected');
    if (allFailed) return null;

    return { recommendation, news, insiderTransactions };
}
