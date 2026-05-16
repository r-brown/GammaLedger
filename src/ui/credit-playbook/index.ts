// src/ui/credit-playbook/index.ts — Wave 9: Credit playbook controls and orchestration.
// Uses the .call(this, …) delegation pattern.

type TradeRecord = Record<string, unknown>

interface LegPair {
  [key: string]: unknown
}

interface CreditPlaybookEntry {
  [key: string]: unknown
}

interface CreditPlaybookContext {
  currentView: string
  creditPlaybookNeedsRefresh: boolean
  creditPlaybookStatus: string
  creditPlaybookStrategy: string
  creditPlaybookHorizon: string
  creditPlaybookSymbol: string
  creditPlaybookInitialized: boolean
  creditPlaybookStrategyOptions: string[]
  creditPlaybookEntries: CreditPlaybookEntry[]
  trades: TradeRecord[]
  syncCreditPlaybookStatusControls(): void
  setCreditPlaybookStatus(status: string): void
  setCreditPlaybookStrategy(strategy: string | null): void
  setCreditPlaybookHorizon(horizon: string): void
  setCreditPlaybookSymbol(symbol: string): void
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
            this.setCreditPlaybookStrategy(strategySelect.value);
        });
        strategySelect.dataset.initialized = 'true';
    }
    if (strategySelect && strategySelect.value !== this.creditPlaybookStrategy) {
        strategySelect.value = this.creditPlaybookStrategy;
    }

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

    document
        .querySelectorAll('#credit-playbook-table .sortable')
        .forEach((header) => header.setAttribute('data-sort-context', 'credit-playbook'));

    this.creditPlaybookInitialized = true;
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
    const match = this.creditPlaybookStrategyOptions.find((option) => sanitize(option) === target);
    return match || null;
}

export function setCreditPlaybookStrategy(this: CreditPlaybookContext, strategy: string | null): void {
    const normalized = typeof strategy === 'string' && strategy.toLowerCase() === 'all'
        ? 'all'
        : this.normalizeCreditPlaybookStrategyValue(strategy ?? '') || 'all';

    if (normalized === this.creditPlaybookStrategy) {
        return;
    }

    this.creditPlaybookStrategy = normalized;
    const select = document.getElementById('credit-playbook-strategy-filter') as HTMLSelectElement | null;
    if (select && select.value !== normalized) {
        select.value = normalized;
    }

    this.updateCreditPlaybookView();
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

