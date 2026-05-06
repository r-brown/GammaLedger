// src/integrations/finnhub.ts — Wave 5: Finnhub API integration.
// Uses the .call(this, …) delegation pattern so all this.* refs work.

import {
    DEFAULT_FINNHUB_RATE_LIMIT,
    FINNHUB_RATE_LIMIT_STORAGE_KEY
} from '@core/config'

export function initializeFinnhubControls() {
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
            return;
        }

        if (!cryptoApi?.subtle) {
            this.saveFinnhubConfigToStorage();
            this.updateFinnhubStatus('Finnhub API key saved (unencrypted — Web Crypto unavailable).', 'success', 6000);
            this.updateActivePositionsTable();
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

export function initializeFinnhubRateLimitControls() {
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

export function updateFinnhubRateStatus(element, message = null, variant = 'neutral') {
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

export function loadFinnhubRateLimitFromStorage() {
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

export function saveFinnhubRateLimitToStorage() {
    try {
        if (this.finnhub?.maxRequestsPerMinute) {
            localStorage.setItem(FINNHUB_RATE_LIMIT_STORAGE_KEY, String(this.finnhub.maxRequestsPerMinute));
        }
    } catch (error) {
        console.warn('Failed to save Finnhub rate limit to storage:', error);
    }
}

export function removeFinnhubRateLimitFromStorage() {
    try {
        localStorage.removeItem(FINNHUB_RATE_LIMIT_STORAGE_KEY);
    } catch (error) {
        console.warn('Failed to remove Finnhub rate limit from storage:', error);
    }
}

export function updateFinnhubStatus(message, variant = 'neutral', autoClearMs = 0) {
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

export function setFinnhubApiKey(value, { persist = false, updateUI = true, markUnsaved = false } = {}) {
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

export function getFinnhubStorageKey() {
    return 'GammaLedgerFinnhubConfig';
}

export function saveFinnhubConfigToStorage() {
    try {
        const payload = { apiKey: this.finnhub.apiKey };
        localStorage.setItem(this.getFinnhubStorageKey(), JSON.stringify(payload));
    } catch (error) {
        console.warn('Failed to save Finnhub configuration:', error);
    }
}

export function removeFinnhubConfigFromStorage() {
    try {
        localStorage.removeItem(this.getFinnhubStorageKey());
    } catch (error) {
        console.warn('Failed to remove Finnhub configuration:', error);
    }
}

export function getFinnhubSecretStorageKey() {
    return 'GammaLedgerFinnhubSecret';
}

export function getQuoteEntryKey(trade) {
    if (!trade || typeof trade !== 'object') {
        return 'unknown';
    }

    const candidateId = trade.id ?? trade.tradeId ?? trade.uid ?? trade.uniqueId;
    if (candidateId !== undefined && candidateId !== null && candidateId !== '') {
        return `id:${candidateId}`;
    }

    const ticker = (trade.ticker || '').toString().trim().toUpperCase();
    const entryDate = trade.entryDate || '';
    const strike = trade.strikePrice || '';
    return `fallback:${ticker}|${entryDate}|${strike}`;
}

export function rebuildQuoteRefreshSchedule() {
    if (!(this.activeQuoteEntries instanceof Map)) {
        this.activeQuoteEntries = new Map();
    }

    // Prioritize entries by state:
    // - High priority: no price yet, errors, rate-limited, unavailable
    // - Low priority: has valid price (ready state)
    const priorityGroups = {
        highPriority: [],
        lowPriority: []
    };

    this.activeQuoteEntries.forEach((entry, key) => {
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

export function startQuoteAutoRefreshIfNeeded() {
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
        const sources = [];

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

export function stopQuoteAutoRefresh() {
    if (this.quoteRefreshIntervalId) {
        clearInterval(this.quoteRefreshIntervalId);
        this.quoteRefreshIntervalId = null;
    }

    if (this.activeQuoteEntries?.size === 0) {
        this.quoteRefreshKeys = [];
        this.quoteRefreshCursor = 0;
    }
}

export function restartQuoteRefreshWithNewRate() {
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

export function refreshActivePositionsQuotes({ force = false, immediate = false } = {}) {
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

        if (!entry || !entry.cell?.isConnected || !entry.row?.isConnected) {
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

export function refreshAssignedPositionsQuotes({ force = false, immediate = false } = {}) {
    // Process ONE Assigned Positions quote per call to respect rate limits
    // Called by unified auto-refresh timer that alternates between tables
    if (!(this.assignedPositionsQuoteEntries instanceof Map) || this.assignedPositionsQuoteEntries.size === 0) {
        return;
    }

    // Find one entry to refresh, prioritizing entries without prices or with errors
    let entryToRefresh = null;
    let keyToRefresh = null;

    // First pass: look for high-priority entries (no price yet, errors, rate-limited)
    for (const [key, entry] of this.assignedPositionsQuoteEntries.entries()) {
        if (!entry || !entry.row?.isConnected) {
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
            if (!entry || !entry.row?.isConnected) {
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
            .then(quote => {
                if (!entryToRefresh.row?.isConnected) {
                    return;
                }
                this.updateAssignedPositionMetrics(entryToRefresh, quote);
            })
            .catch(error => {
                if (!entryToRefresh.row?.isConnected) {
                    return;
                }
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

export function refreshCreditPlaybookQuotes({ force = false, immediate = false } = {}) {
    // Process ONE Credit Playbook quote per call to respect rate limits
    // Called by unified auto-refresh timer that alternates between tables
    if (!(this.creditPlaybookQuoteEntries instanceof Map) || this.creditPlaybookQuoteEntries.size === 0) {
        return;
    }

    // Find one entry to refresh, prioritizing by state
    let entryToRefresh = null;
    let keyToRefresh = null;

    // First pass: look for high-priority entries (no price yet, errors, rate-limited, unavailable)
    for (const [key, entry] of this.creditPlaybookQuoteEntries.entries()) {
        if (!entry || !entry.cell?.isConnected || !entry.row?.isConnected) {
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
            if (!entry || !entry.cell?.isConnected || !entry.row?.isConnected) {
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

export function populateQuoteCell(cell, trade, row, options: { forceRefresh?: boolean; deferNetworkFetch?: boolean; silentIfCached?: boolean; suppressLoadingText?: boolean } = {}) {
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
        .then(quote => {
            if (!cell.isConnected) {
                return;
            }
            this.renderQuoteValue(cell, row, trade, quote);
        })
        .catch(error => {
            if (!cell.isConnected) {
                return;
            }
            const message = this.getQuoteErrorMessage(error);
            this.setQuoteCellError(cell, row, trade, message);
        });
}

export function renderQuoteValue(cell, row, trade, quote) {
    if (!cell) {
        return;
    }
    cell.dataset.priceState = 'ready';
    cell.classList.remove('quote-error');
    const numeric = Number(quote?.price);
    if (!Number.isFinite(numeric)) {
        cell.textContent = '—';
        this.applyPositionHighlight(row, trade, null);
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
}

export function getQuoteChangePercent(quote) {
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

export function getQuoteChangeValue(quote) {
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

export function setQuoteCellError(cell, row, trade, message) {
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

export function getQuoteErrorMessage(error) {
    const message = (error?.message || '').toLowerCase();
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

export function getCachedQuote(ticker) {
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

export function setCachedQuote(ticker, value) {
    if (!ticker) {
        return;
    }
    this.finnhub.cache.set(ticker, {
        value,
        timestamp: Date.now()
    });
}

export function enqueueFinnhubRequest(symbol) {
    const execute = () => this.performFinnhubFetch(symbol);
    const chain = this.finnhub.rateLimitQueue
        .catch(() => undefined)
        .then(execute);

    this.finnhub.rateLimitQueue = chain
        .then(() => undefined)
        .catch(() => undefined);

    return chain;
}
