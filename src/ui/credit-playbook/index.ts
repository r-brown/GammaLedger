// src/ui/credit-playbook/index.ts — Wave 9: Credit playbook controls and orchestration.
// Uses the .call(this, …) delegation pattern.

import { renderSelectChips } from '../filter-chips.js'
import { getAvailableStrategies, getSelectedFilterValues, normalizeFilterSelect } from '../filters.js'

type TradeRecord = Record<string, unknown>

interface LegPair {
  [key: string]: unknown
}

interface CreditPlaybookEntry {
  [key: string]: unknown
}

interface CreditPlaybookContext {
  schwab?: { vault: { accessToken?: string; refreshToken?: string } | null }
  currentView: string
  creditPlaybookNeedsRefresh: boolean
  creditPlaybookQuotePauseUntil: number
  creditPlaybookQuoteCountdownTimerId: ReturnType<typeof setInterval> | null
  creditPlaybookStatus: string
  creditPlaybookStrategies: string[]
  creditPlaybookHorizon: string
  creditPlaybookSymbol: string
  creditPlaybookInitialized: boolean
  creditPlaybookStrategyOptions: string[]
  creditPlaybookEntries: CreditPlaybookEntry[]
  trades: TradeRecord[]
  syncCreditPlaybookStatusControls(): void
  syncCreditPlaybookStrategyControls(): void
  syncCreditPlaybookQuoteRefreshStatus(): void
  setCreditPlaybookStatus(status: string): void
  setCreditPlaybookStrategies(strategies: string[] | null): void
  setCreditPlaybookStrategy(strategy: string | null): void
  setCreditPlaybookHorizon(horizon: string): void
  setCreditPlaybookSymbol(symbol: string): void
  refreshCreditPlaybookQuotes(opts: { force?: boolean; immediate?: boolean; manual?: boolean; prime?: boolean }): void
  refreshSchwabMarketData(opts?: { allowContractPrompt?: boolean }): Promise<void>
  getSchwabLastQuoteAt(): string | null
  isSchwabQuoteStale(capturedAt: string): boolean
  normalizeCreditPlaybookStrategyValue(strategy: string): string | null
  updateCreditPlaybookView(): void
  getCreditPlaybookEntries(): CreditPlaybookEntry[]
  extractCreditPlaybookLegPairs(entries: CreditPlaybookEntry[]): LegPair[]
  filterCreditPlaybookLegPairs(pairs: LegPair[]): LegPair[]
  applyCreditPlaybookSortToLegPairs(pairs: LegPair[]): LegPair[]
  renderCreditPlaybookMetrics(pairs: LegPair[]): void
  renderCreditPlaybookTableFromLegPairs(pairs: LegPair[]): void
  applyCreditPlaybookSortIndicators(): void
  isCreditStrategyTrade(trade: TradeRecord): boolean
  mapCreditTradeToEntry(trade: TradeRecord): CreditPlaybookEntry | null
}

export function initializeCreditPlaybookControls(this: CreditPlaybookContext): void {
    const statusControls = document.getElementById('credit-playbook-status-filter');
    if (statusControls && statusControls.dataset.initialized !== 'true') {
        statusControls.addEventListener('click', (event) => {
            const button = event.target instanceof HTMLElement
                ? event.target.closest('button[data-status]')
                : null;
            if (!button) {
                return;
            }
            this.setCreditPlaybookStatus((button as HTMLElement).dataset.status ?? '');
        });
        statusControls.dataset.initialized = 'true';
    }

    this.syncCreditPlaybookStatusControls();

    const strategySelect = document.getElementById('credit-playbook-strategy-filter') as HTMLSelectElement | null;
    if (strategySelect && strategySelect.dataset.initialized !== 'true') {
        strategySelect.addEventListener('change', () => {
            normalizeFilterSelect(strategySelect);
            this.setCreditPlaybookStrategies(getSelectedFilterValues(strategySelect));
        });
        strategySelect.dataset.initialized = 'true';
    }
    populateCreditPlaybookStrategyOptions.call(this);
    this.syncCreditPlaybookStrategyControls();

    const horizonSelect = document.getElementById('credit-playbook-horizon-filter') as HTMLSelectElement | null;
    if (horizonSelect && horizonSelect.dataset.initialized !== 'true') {
        horizonSelect.addEventListener('change', () => {
            this.setCreditPlaybookHorizon(horizonSelect.value);
        });
        horizonSelect.dataset.initialized = 'true';
    }
    if (horizonSelect && horizonSelect.value !== this.creditPlaybookHorizon) {
        horizonSelect.value = this.creditPlaybookHorizon;
    }

    const symbolInput = document.getElementById('credit-playbook-symbol-filter') as HTMLInputElement | null;
    if (symbolInput && symbolInput.dataset.initialized !== 'true') {
        symbolInput.addEventListener('input', () => {
            this.setCreditPlaybookSymbol(symbolInput.value);
        });
        symbolInput.dataset.initialized = 'true';
    }
    if (symbolInput && symbolInput.value !== this.creditPlaybookSymbol) {
        symbolInput.value = this.creditPlaybookSymbol;
    }

    const refreshButton = document.getElementById('credit-playbook-refresh-quotes') as HTMLButtonElement | null;
    if (refreshButton && refreshButton.dataset.initialized !== 'true') {
        refreshButton.addEventListener('click', async () => {
            refreshButton.classList.add('is-refreshing');
            refreshButton.setAttribute('aria-busy', 'true');
            refreshButton.disabled = true;
            try {
                if (this.schwab?.vault && (this.schwab.vault.accessToken || this.schwab.vault.refreshToken)) {
                    await this.refreshSchwabMarketData({ allowContractPrompt: true });
                } else {
                    this.refreshCreditPlaybookQuotes({ force: true, immediate: true, manual: true });
                }
                this.syncCreditPlaybookQuoteRefreshStatus();
            } finally {
                refreshButton.classList.remove('is-refreshing');
                refreshButton.removeAttribute('aria-busy');
                refreshButton.disabled = false;
            }
        });
        refreshButton.dataset.initialized = 'true';
    }

    startCreditPlaybookQuoteRefreshStatus.call(this);

    document
        .querySelectorAll('#credit-playbook-table .sortable')
        .forEach((header) => header.setAttribute('data-sort-context', 'credit-playbook'));

    this.creditPlaybookInitialized = true;
}

function formatCreditPlaybookCountdown(remainingMs: number): string {
    const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function startCreditPlaybookQuoteRefreshStatus(this: CreditPlaybookContext): void {
    if (this.creditPlaybookQuoteCountdownTimerId === null) {
        this.creditPlaybookQuoteCountdownTimerId = setInterval(() => {
            this.syncCreditPlaybookQuoteRefreshStatus();
        }, 1000);
    }

    this.syncCreditPlaybookQuoteRefreshStatus();
}

export function syncCreditPlaybookQuoteRefreshStatus(this: CreditPlaybookContext): void {
    // The countdown timer keeps ticking after the user navigates away, so skip
    // the DOM writes and date formatting while the view is not on screen.
    if (this.currentView !== 'credit-playbook') {
        return;
    }

    const status = document.getElementById('credit-playbook-refresh-status');
    const detail = document.getElementById('credit-playbook-refresh-detail');
    if (!status || !detail) {
        return;
    }

    const pauseUntil = Number(this.creditPlaybookQuotePauseUntil);
    const remainingMs = pauseUntil - Date.now();
    const isPaused = Number.isFinite(pauseUntil) && remainingMs > 0;
    const lastSchwabQuoteAt = this.getSchwabLastQuoteAt();
    const schwabIsStale = lastSchwabQuoteAt ? this.isSchwabQuoteStale(lastSchwabQuoteAt) : false;

    status.textContent = lastSchwabQuoteAt
        ? `Schwab quotes${schwabIsStale ? ' · Stale' : ''}`
        : isPaused ? 'Automatic refresh paused' : 'Automatic quote refresh';
    detail.textContent = lastSchwabQuoteAt
        ? `Last updated ${new Date(lastSchwabQuoteAt).toLocaleString()} · Refreshes stocks and current options`
        : isPaused
            ? `Resumes in ${formatCreditPlaybookCountdown(remainingMs)} · Manual refresh available`
            : 'One position at a time · 5-minute pause after a full pass';
    status.classList.toggle('is-paused', isPaused);
    detail.classList.toggle('is-paused', isPaused);
}

function populateCreditPlaybookStrategyOptions(this: CreditPlaybookContext): void {
    const select = document.getElementById('credit-playbook-strategy-filter') as HTMLSelectElement | null;
    if (!select) {
        return;
    }

    const previousSelection = Array.isArray(this.creditPlaybookStrategies)
        ? this.creditPlaybookStrategies.slice()
        : [];
    const strategies = [...new Set(getAvailableStrategies(this.trades)
        .map((strategy) => this.normalizeCreditPlaybookStrategyValue(strategy) || strategy))]
        .sort((a, b) => a.localeCompare(b));

    select.textContent = '';

    const allOption = document.createElement('option');
    allOption.value = '';
    allOption.textContent = 'All Strategies';
    select.appendChild(allOption);

    strategies.forEach((strategy) => {
        const option = document.createElement('option');
        option.value = strategy;
        option.textContent = strategy;
        select.appendChild(option);
    });

    const availableStrategies = new Set(strategies);
    this.creditPlaybookStrategies = previousSelection.filter((strategy) => availableStrategies.has(strategy));
    normalizeFilterSelect(select);
}

export function syncCreditPlaybookStatusControls(this: CreditPlaybookContext): void {
    const statusControls = document.getElementById('credit-playbook-status-filter');
    if (!statusControls) {
        return;
    }

    const current = this.creditPlaybookStatus;
    statusControls.querySelectorAll('button[data-status]').forEach((button) => {
        const buttonStatus = (button as HTMLElement).dataset.status || 'all';
        const isActive = buttonStatus === current;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', String(isActive));
    });
}

export function syncCreditPlaybookStrategyControls(this: CreditPlaybookContext): void {
    const select = document.getElementById('credit-playbook-strategy-filter') as HTMLSelectElement | null;
    if (!select) {
        return;
    }

    const selectedStrategies = new Set(this.creditPlaybookStrategies);
    Array.from(select.options).forEach((option) => {
        option.selected = option.value === ''
            ? selectedStrategies.size === 0
            : selectedStrategies.has(option.value);
    });
    normalizeFilterSelect(select);

    renderSelectChips({
        selectId: 'credit-playbook-strategy-filter',
        chipsId: 'credit-playbook-strategy-chips',
        allLabel: 'All strategies',
        onSelectionChange: (changedSelect) => {
            normalizeFilterSelect(changedSelect);
            this.setCreditPlaybookStrategies(getSelectedFilterValues(changedSelect));
        }
    });
}

export function setCreditPlaybookStatus(this: CreditPlaybookContext, status: string): void {
    const normalized = (['active', 'closed', 'all'] as string[]).includes(status) ? status : 'all';
    if (normalized === this.creditPlaybookStatus) {
        return;
    }

    this.creditPlaybookStatus = normalized;
    this.syncCreditPlaybookStatusControls();
    this.updateCreditPlaybookView();
}

export function normalizeCreditPlaybookStrategyValue(this: CreditPlaybookContext, strategy: string): string | null {
    if (!strategy) {
        return null;
    }
    const trimmed = strategy.toString().trim();
    if (!trimmed) {
        return null;
    }
    const sanitize = (value: string) => value.replace(/[^a-z0-9]/gi, '').toLowerCase();
    const target = sanitize(trimmed);
    if (!target) {
        return null;
    }
    const select = document.getElementById('credit-playbook-strategy-filter') as HTMLSelectElement | null;
    const dynamicOptions = select
        ? Array.from(select.options).map((option) => option.value).filter(Boolean)
        : [];
    const options = dynamicOptions.length > 0 ? dynamicOptions : this.creditPlaybookStrategyOptions;
    const match = options.find((option) => sanitize(option) === target);
    return match || null;
}

export function setCreditPlaybookStrategies(this: CreditPlaybookContext, strategies: string[] | null): void {
    const normalized = [...new Set((Array.isArray(strategies) ? strategies : [])
        .map((strategy) => this.normalizeCreditPlaybookStrategyValue(strategy))
        .filter((strategy): strategy is string => Boolean(strategy)))];
    const hasChanged = normalized.length !== this.creditPlaybookStrategies.length
        || normalized.some((strategy, index) => strategy !== this.creditPlaybookStrategies[index]);

    this.creditPlaybookStrategies = normalized;
    this.syncCreditPlaybookStrategyControls();
    if (hasChanged) {
        this.updateCreditPlaybookView();
    }
}

export function setCreditPlaybookStrategy(this: CreditPlaybookContext, strategy: string | null): void {
    const normalized = typeof strategy === 'string' && strategy.toLowerCase() === 'all'
        ? null
        : this.normalizeCreditPlaybookStrategyValue(strategy ?? '');
    this.setCreditPlaybookStrategies(normalized ? [normalized] : []);
}

export function setCreditPlaybookHorizon(this: CreditPlaybookContext, horizon: string): void {
    const allowed = new Set(['all', '7d', '14d', '30d', '90d', '180d', '365d', 'mtd', 'ytd']);
    const normalized = allowed.has(horizon) ? horizon : 'all';

    const hasChanged = normalized !== this.creditPlaybookHorizon;

    if (!hasChanged) {
        const select = document.getElementById('credit-playbook-horizon-filter') as HTMLSelectElement | null;
        if (select && select.value !== normalized) {
            select.value = normalized;
        }
        return;
    }

    this.creditPlaybookHorizon = normalized;

    const select = document.getElementById('credit-playbook-horizon-filter') as HTMLSelectElement | null;
    if (select && select.value !== normalized) {
        select.value = normalized;
    }

    this.updateCreditPlaybookView();
}

export function setCreditPlaybookSymbol(this: CreditPlaybookContext, symbol: string): void {
    const normalized = (symbol || '').toString().trim().toUpperCase();
    if (normalized === this.creditPlaybookSymbol) {
        return;
    }

    this.creditPlaybookSymbol = normalized;
    const input = document.getElementById('credit-playbook-symbol-filter') as HTMLInputElement | null;
    if (input && input.value.toUpperCase() !== normalized) {
        input.value = normalized;
    }
    this.updateCreditPlaybookView();
}

export function updateCreditPlaybookView(this: CreditPlaybookContext): void {
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

    populateCreditPlaybookStrategyOptions.call(this);
    this.syncCreditPlaybookStrategyControls();

    const entries = this.getCreditPlaybookEntries();
    this.creditPlaybookEntries = entries;

    const legPairs = this.extractCreditPlaybookLegPairs(entries);
    const filtered = this.filterCreditPlaybookLegPairs(legPairs);
    const sorted = this.applyCreditPlaybookSortToLegPairs(filtered);

    this.renderCreditPlaybookMetrics(filtered);
    this.renderCreditPlaybookTableFromLegPairs(sorted);
    this.applyCreditPlaybookSortIndicators();

    this.creditPlaybookNeedsRefresh = false;
}

export function getCreditPlaybookEntries(this: CreditPlaybookContext): CreditPlaybookEntry[] {
    return this.trades
        .filter((trade) => this.isCreditStrategyTrade(trade))
        .map((trade) => this.mapCreditTradeToEntry(trade))
        .filter((entry): entry is CreditPlaybookEntry => Boolean(entry));
}
