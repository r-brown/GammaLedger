// src/ui/filters.ts — Wave 8: Trade filter UI logic.
// Uses the .call(this, …) delegation pattern.

type TradeRecord = Record<string, unknown>

interface FiltersContext {
  trades: TradeRecord[]
  currentSort: { key: string; direction: string } | null
  sortDirection: Record<string, string>
  currentFilteredTrades: TradeRecord[]
  normalizeFilterSelect(selectElement: HTMLSelectElement | null): void
  getSelectedFilterValues(selectElement: HTMLSelectElement | null): string[]
  restoreMultiSelectSelection(selectElement: HTMLSelectElement, previousValues: string[]): void
  resetFilterSelect(selectElement: HTMLSelectElement): void
  normalizeStatus(status: unknown): string
  getDisplayStatus(trade: TradeRecord): string
  getSortableValue(trade: TradeRecord, sortKey: string): unknown
  compareSortableValues(a: unknown, b: unknown): number
  applySortToTrades(trades: TradeRecord[], sortKey: string, direction: string): TradeRecord[]
  filterTrades(): void
  renderTradesTable(trades: TradeRecord[]): void
  showView(viewName: string): void
}

export function getSelectedFilterValues(selectElement: HTMLSelectElement | null): string[] {
    if (!selectElement) {
        return [];
    }
    const values = Array.from(selectElement.options || [])
        .filter(option => option.selected)
        .map(option => option.value);
    if (values.includes('') && values.length === 1) {
        return [];
    }
    return values.filter(value => value !== '');
}

export function normalizeFilterSelect(selectElement: HTMLSelectElement | null): void {
    if (!selectElement) {
        return;
    }
    const options = Array.from(selectElement.options || []);
    const allOption = options.find(option => option.value === '');
    if (!allOption) {
        return;
    }

    const selectedValues = options
        .filter(option => option.selected)
        .map(option => option.value);
    const hasAllSelected = selectedValues.includes('');

    if (hasAllSelected && selectedValues.length > 1) {
        options.forEach(option => {
            option.selected = option.value === '';
        });
        return;
    }

    if (!hasAllSelected && selectedValues.length === 0) {
        allOption.selected = true;
        return;
    }

    if (!hasAllSelected) {
        allOption.selected = false;
    }
}

export function resetFilterSelect(this: FiltersContext, selectElement: HTMLSelectElement): void {
    if (!selectElement) {
        return;
    }
    Array.from(selectElement.options || []).forEach(option => {
        option.selected = option.value === '';
    });
    this.normalizeFilterSelect(selectElement);
}

export function restoreMultiSelectSelection(
    this: FiltersContext,
    selectElement: HTMLSelectElement,
    previousValues: string[] = []
): void {
    if (!selectElement) {
        return;
    }

    const normalizedValues = Array.isArray(previousValues) ? previousValues : [previousValues];
    const hasSpecificSelection = normalizedValues.some(value => value);
    const selectionSet = new Set(hasSpecificSelection ? normalizedValues.filter(Boolean) : ['']);
    const options = Array.from(selectElement.options || []);
    let selectionApplied = false;

    options.forEach(option => {
        if (selectionSet.has(option.value)) {
            option.selected = true;
            selectionApplied = true;
        } else {
            option.selected = false;
        }
    });

    if (!selectionApplied) {
        const allOption = options.find(option => option.value === '');
        if (allOption) {
            allOption.selected = true;
        }
    }

    this.normalizeFilterSelect(selectElement);
}

export function getSortableValue(this: FiltersContext, trade: TradeRecord, sortKey: string): unknown {
    if (!trade || !sortKey) {
        return null;
    }

    const rawValue = trade[sortKey];
    if (rawValue === undefined || rawValue === null) {
        return null;
    }

    if (sortKey.toLowerCase().includes('date')) {
        const timestamp = new Date(rawValue as string).getTime();
        return Number.isNaN(timestamp) ? null : timestamp;
    }

    if (sortKey === 'status') {
        return this.normalizeStatus(rawValue);
    }

    const numericValue = Number(rawValue);
    if (!Number.isNaN(numericValue) && Number.isFinite(numericValue) && rawValue !== '') {
        return numericValue;
    }

    if (typeof rawValue === 'string') {
        return rawValue.toLowerCase();
    }

    return rawValue;
}

export function compareSortableValues(a: unknown, b: unknown): number {
    const isInvalid = (value: unknown) => value === null || value === undefined || value === '';
    const aInvalid = isInvalid(a);
    const bInvalid = isInvalid(b);

    if (aInvalid && bInvalid) {
        return 0;
    }
    if (aInvalid) {
        return 1;
    }
    if (bInvalid) {
        return -1;
    }

    if ((a as number | string) < (b as number | string)) {
        return -1;
    }
    if ((a as number | string) > (b as number | string)) {
        return 1;
    }
    return 0;
}

export function applySortToTrades(
    this: FiltersContext,
    trades: TradeRecord[],
    sortKey: string,
    direction = 'asc'
): TradeRecord[] {
    if (!Array.isArray(trades) || !sortKey) {
        return Array.isArray(trades) ? trades.slice() : [];
    }

    const normalizedDirection = direction === 'desc' ? 'desc' : 'asc';
    const sorted = trades.slice().sort((a, b) => {
        const aVal = this.getSortableValue(a, sortKey);
        const bVal = this.getSortableValue(b, sortKey);
        const comparison = this.compareSortableValues(aVal, bVal);
        return normalizedDirection === 'asc' ? comparison : -comparison;
    });

    return sorted;
}

export function populateFilters(this: FiltersContext): void {
    const strategySelect = document.getElementById('filter-strategy') as HTMLSelectElement | null;
    const previousSelection = strategySelect
        ? Array.from(strategySelect.options || [])
            .filter(option => option.selected)
            .map(option => option.value)
        : [''];

    const strategies = [...new Set(this.trades.map(trade => trade.strategy as string))]
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));

    if (strategySelect) {
        strategySelect.innerHTML = '';

        const allOption = document.createElement('option');
        allOption.value = '';
        allOption.textContent = 'All Strategies';
        strategySelect.appendChild(allOption);

        strategies.forEach(strategy => {
            const option = document.createElement('option');
            option.value = strategy;
            option.textContent = strategy;
            strategySelect.appendChild(option);
        });

        this.restoreMultiSelectSelection(strategySelect, previousSelection);
    }

    const statusSelect = document.getElementById('filter-status') as HTMLSelectElement | null;
    if (statusSelect) {
        this.normalizeFilterSelect(statusSelect);
    }
}

export function filterTrades(this: FiltersContext): void {
    const strategySelect = document.getElementById('filter-strategy') as HTMLSelectElement | null;
    const statusSelect = document.getElementById('filter-status') as HTMLSelectElement | null;
    this.normalizeFilterSelect(strategySelect);
    this.normalizeFilterSelect(statusSelect);

    const strategyFilters = this.getSelectedFilterValues(strategySelect);
    const statusFilters = this.getSelectedFilterValues(statusSelect).map(value => value.toLowerCase());
    const searchTerm = ((document.getElementById('search-ticker') as HTMLInputElement | null)?.value || '').toString().trim().toLowerCase();

    const hasStrategyFilter = strategyFilters.length > 0;
    const hasStatusFilter = statusFilters.length > 0;

    const filteredTrades = this.trades.filter(trade => {
        const tradeStrategy = ((trade.strategy ?? '') as string).toString();
        const matchesStrategy = !hasStrategyFilter || strategyFilters.includes(tradeStrategy);
        const normalizedStatus = this.normalizeStatus(trade.status);
        let matchesStatus = true;
        if (hasStatusFilter) {
            matchesStatus = statusFilters.some(filterStatus => {
                if (filterStatus === 'assigned') {
                    return this.getDisplayStatus(trade).toLowerCase() === 'assigned';
                }
                return normalizedStatus === filterStatus;
            });
        }
        const tickerValueRaw = ((trade.ticker ?? '') as string).toString();
        const tickerLower = tickerValueRaw.toLowerCase();
        const strategyLower = ((trade.strategy ?? '') as string).toString().toLowerCase();
        const notesLower = ((trade.notes ?? '') as string).toString().toLowerCase();
        const matchesSearch = !searchTerm ||
            tickerLower.includes(searchTerm) ||
            strategyLower.includes(searchTerm) ||
            notesLower.includes(searchTerm);

        return matchesStrategy && matchesStatus && matchesSearch;
    });

    const activeSortKey = this.currentSort?.key;
    const activeSortDirection = activeSortKey ? (this.sortDirection[activeSortKey] || this.currentSort?.direction || 'asc') : null;
    const result = activeSortKey && activeSortDirection
        ? this.applySortToTrades(filteredTrades, activeSortKey, activeSortDirection)
        : filteredTrades.slice();

    this.currentFilteredTrades = result.slice();
    this.renderTradesTable(result);
}

export function openTradesFilteredByTicker(this: FiltersContext, ticker: unknown): void {
    const normalizedTicker = ((ticker ?? '') as string).toString().trim().toUpperCase();
    if (!normalizedTicker) {
        return;
    }

    this.showView('trades-list');

    const searchInput = document.getElementById('search-ticker') as HTMLInputElement | null;
    if (searchInput) {
        searchInput.value = normalizedTicker;
        searchInput.focus();
    }

    ['filter-strategy', 'filter-status'].forEach(filterId => {
        const filterElement = document.getElementById(filterId) as HTMLSelectElement | null;
        if (filterElement) {
            this.resetFilterSelect(filterElement);
        }
    });

    this.filterTrades();
}

export function setupResponsiveFilters(): void {
    const panel = document.getElementById('trades-filters-panel');
    const toggle = document.getElementById('toggle-filters');

    if (!panel || !toggle) {
        return;
    }

    const updateToggleState = (isOpen: boolean) => {
        toggle.textContent = isOpen ? 'Hide Filters' : 'Show Filters';
        toggle.setAttribute('aria-expanded', String(isOpen));
    };

    let wasMobile = window.innerWidth <= 768;

    const evaluateBreakpoint = (forceCollapse = false) => {
        const isMobile = window.innerWidth <= 768;

        if (isMobile) {
            if (forceCollapse || !wasMobile) {
                panel.classList.remove('is-open');
            }
            updateToggleState(panel.classList.contains('is-open'));
        } else {
            panel.classList.add('is-open');
            updateToggleState(true);
        }

        wasMobile = isMobile;
    };

    toggle.addEventListener('click', () => {
        const isOpen = panel.classList.toggle('is-open');
        updateToggleState(isOpen);
    });

    let resizeTimeout: ReturnType<typeof setTimeout> | null = null;
    window.addEventListener('resize', () => {
        if (resizeTimeout !== null) clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => evaluateBreakpoint(false), 160);
    });

    evaluateBreakpoint(true);
}

