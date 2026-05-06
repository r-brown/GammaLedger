// src/ui/credit-playbook/index.js — Wave 9: Credit playbook controls and orchestration.
// Uses the .call(this, …) delegation pattern.

export function initializeCreditPlaybookControls() {
    const statusControls = document.getElementById('credit-playbook-status-filter');
    if (statusControls && statusControls.dataset.initialized !== 'true') {
        statusControls.addEventListener('click', (event) => {
            const button = event.target instanceof HTMLElement
                ? event.target.closest('button[data-status]')
                : null;
            if (!button) {
                return;
            }
            this.setCreditPlaybookStatus(button.dataset.status);
        });
        statusControls.dataset.initialized = 'true';
    }

    this.syncCreditPlaybookStatusControls();

    const strategySelect = document.getElementById('credit-playbook-strategy-filter');
    if (strategySelect && strategySelect.dataset.initialized !== 'true') {
        strategySelect.addEventListener('change', () => {
            this.setCreditPlaybookStrategy(strategySelect.value);
        });
        strategySelect.dataset.initialized = 'true';
    }
    if (strategySelect && strategySelect.value !== this.creditPlaybookStrategy) {
        strategySelect.value = this.creditPlaybookStrategy;
    }

    const horizonSelect = document.getElementById('credit-playbook-horizon-filter');
    if (horizonSelect && horizonSelect.dataset.initialized !== 'true') {
        horizonSelect.addEventListener('change', () => {
            this.setCreditPlaybookHorizon(horizonSelect.value);
        });
        horizonSelect.dataset.initialized = 'true';
    }
    if (horizonSelect && horizonSelect.value !== this.creditPlaybookHorizon) {
        horizonSelect.value = this.creditPlaybookHorizon;
    }

    const symbolInput = document.getElementById('credit-playbook-symbol-filter');
    if (symbolInput && symbolInput.dataset.initialized !== 'true') {
        symbolInput.addEventListener('input', () => {
            this.setCreditPlaybookSymbol(symbolInput.value);
        });
        symbolInput.dataset.initialized = 'true';
    }
    if (symbolInput && symbolInput.value !== this.creditPlaybookSymbol) {
        symbolInput.value = this.creditPlaybookSymbol;
    }

    document
        .querySelectorAll('#credit-playbook-table .sortable')
        .forEach((header) => header.setAttribute('data-sort-context', 'credit-playbook'));

    this.creditPlaybookInitialized = true;
}

export function syncCreditPlaybookStatusControls() {
    const statusControls = document.getElementById('credit-playbook-status-filter');
    if (!statusControls) {
        return;
    }

    const current = this.creditPlaybookStatus;
    statusControls.querySelectorAll('button[data-status]').forEach((button) => {
        const buttonStatus = button.dataset.status || 'all';
        const isActive = buttonStatus === current;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', String(isActive));
    });
}

export function setCreditPlaybookStatus(status) {
    const normalized = ['active', 'closed', 'all'].includes(status) ? status : 'all';
    if (normalized === this.creditPlaybookStatus) {
        return;
    }

    this.creditPlaybookStatus = normalized;
    this.syncCreditPlaybookStatusControls();
    this.updateCreditPlaybookView();
}

export function normalizeCreditPlaybookStrategyValue(strategy) {
    if (!strategy) {
        return null;
    }
    const trimmed = strategy.toString().trim();
    if (!trimmed) {
        return null;
    }
    const sanitize = (value) => value.replace(/[^a-z0-9]/gi, '').toLowerCase();
    const target = sanitize(trimmed);
    if (!target) {
        return null;
    }
    const match = this.creditPlaybookStrategyOptions.find((option) => sanitize(option) === target);
    return match || null;
}

export function setCreditPlaybookStrategy(strategy) {
    const normalized = typeof strategy === 'string' && strategy.toLowerCase() === 'all'
        ? 'all'
        : this.normalizeCreditPlaybookStrategyValue(strategy) || 'all';

    if (normalized === this.creditPlaybookStrategy) {
        return;
    }

    this.creditPlaybookStrategy = normalized;
    const select = document.getElementById('credit-playbook-strategy-filter');
    if (select && select.value !== normalized) {
        select.value = normalized;
    }

    this.updateCreditPlaybookView();
}

export function setCreditPlaybookHorizon(horizon) {
    const allowed = new Set(['all', '7d', '14d', '30d', '90d', '180d', '365d', 'mtd', 'ytd']);
    const normalized = allowed.has(horizon) ? horizon : 'all';
    
    const hasChanged = normalized !== this.creditPlaybookHorizon;
    
    if (!hasChanged) {
        // Still update dropdown if needed
        const select = document.getElementById('credit-playbook-horizon-filter');
        if (select && select.value !== normalized) {
            select.value = normalized;
        }
        return;
    }
    
    this.creditPlaybookHorizon = normalized;
    
    const select = document.getElementById('credit-playbook-horizon-filter');
    if (select && select.value !== normalized) {
        select.value = normalized;
    }
    
    this.updateCreditPlaybookView();
}

export function setCreditPlaybookSymbol(symbol) {
    const normalized = (symbol || '').toString().trim().toUpperCase();
    if (normalized === this.creditPlaybookSymbol) {
        return;
    }

    this.creditPlaybookSymbol = normalized;
    const input = document.getElementById('credit-playbook-symbol-filter');
    if (input && input.value.toUpperCase() !== normalized) {
        input.value = normalized;
    }
    this.updateCreditPlaybookView();
}

export function updateCreditPlaybookView() {
    if (this.currentView !== 'credit-playbook') {
        this.creditPlaybookNeedsRefresh = true;
        return;
    }

    const table = document.getElementById('credit-playbook-table');
    const metricsContainer = document.getElementById('credit-playbook-metrics');
    if (!table || !metricsContainer) {
        this.creditPlaybookNeedsRefresh = true;
        return;
    }

    const entries = this.getCreditPlaybookEntries();
    this.creditPlaybookEntries = entries;

    // Extract leg pairs first, then filter and sort them
    const legPairs = this.extractCreditPlaybookLegPairs(entries);
    const filtered = this.filterCreditPlaybookLegPairs(legPairs);
    const sorted = this.applyCreditPlaybookSortToLegPairs(filtered);

    this.renderCreditPlaybookMetrics(filtered);
    this.renderCreditPlaybookTableFromLegPairs(sorted);
    this.applyCreditPlaybookSortIndicators();

    this.creditPlaybookNeedsRefresh = false;
}

export function getCreditPlaybookEntries() {
    return this.trades
        .filter((trade) => this.isCreditStrategyTrade(trade))
        .map((trade) => this.mapCreditTradeToEntry(trade))
        .filter(Boolean);
}
