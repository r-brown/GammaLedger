// src/ui/tables/trades-table.ts — Wave 9: Trades table rendering and actions.
// Uses the .call(this, …) delegation pattern.

import {
  createGrid,
  type ColDef,
  type GridApi,
  type GridOptions,
  type ICellRendererParams,
  type SortChangedEvent
} from './ag-grid.js'
import {
  buildRowsWithDetail,
  createPositionDetailPanelRenderer,
  type PositionDetailPanelContext
} from './position-detail-panel.js'

type TradeRecord = Record<string, unknown>

interface TradesTableContext extends PositionDetailPanelContext {
  trades: TradeRecord[]
  currentFilteredTrades: TradeRecord[]
  expandedTradeId: string | null
  currentSort: { key: string | null; direction: string } | null
  sortDirection: Record<string, string>
  tradesGridApi?: GridApi<TradeRecord> | null
  tradesMergePanelOpen: boolean
  tradeMergeSelection: Set<unknown>
  isClosedStatus(status: unknown): boolean
  formatDate(value: unknown): string
  formatCurrency(value: unknown, opts?: Record<string, unknown>): string
  formatPercent(value: unknown, fallback: string, opts?: Record<string, unknown>): string
  createTickerElement(ticker: unknown, className?: string, opts?: Record<string, unknown>): HTMLElement
  getDisplayStatus(trade: TradeRecord): string
  createFormulaIcon(trade: TradeRecord, field: string): HTMLElement | null
  positionFormulaTooltip(wrapper: HTMLElement, tooltip: HTMLElement): void
  editTrade(id: unknown, trade?: TradeRecord): void
  deleteTrade(id: unknown, trade?: TradeRecord): void
  applyResponsiveLabels(row: HTMLTableRowElement, labels: string[]): void
  setupTradesMergeControls?(): void
  pruneTradeMergeSelection(): void
  syncSelectAllCheckbox(): void
  refreshTradesMergePanelContents(): void
  syncTradeSelectionCheckboxes(): void
  updateMergeColumnVisibility(): void
  refreshTradesGridSelectionState(): void
  applySortToTrades(trades: TradeRecord[], sortKey: string, direction: string): TradeRecord[]
  populateFilters(): void
  filterTrades(): void
  renderTradesTable(trades?: TradeRecord[]): void
  updateDashboard(): void
  resetAddTradeForm(): void
  renderLegForms(legs: unknown[]): void
  showView(viewName: string): void
  normalizeUnderlyingType(value: unknown, opts: { fallback: string }): string
  normalizeTradeStatusInput(value: unknown): string | null
  openTradesFilteredByTicker(ticker: unknown): void
  saveToStorage(): void
  markUnsavedChanges(): void
  enrichTradeData(data: TradeRecord): TradeRecord
  currentEditingId: unknown
  currentEditingTrade: TradeRecord | null
  updateTickerPreview(ticker: string): void
  escapeHtml(value: string): string
}

const MERGE_COLUMN_ID = 'mergeSelect';

function safeNumber(value: unknown): number | null {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}

function tradeRowKey(trade: TradeRecord | null | undefined, fallback = 'trade'): string {
    const source = trade?.id ?? trade?.tradeId ?? trade?.uniqueId ?? fallback;
    return String(source || fallback).replace(/[^a-zA-Z0-9_-]/g, '-');
}

function hasTradeSelection(selection: Set<unknown>, id: unknown): boolean {
    const key = String(id ?? '');
    if (!key) {
        return false;
    }
    return Array.from(selection).some(value => String(value) === key);
}

function removeTradeSelection(selection: Set<unknown>, id: unknown): void {
    const key = String(id ?? '');
    if (!key) {
        return;
    }
    Array.from(selection).forEach(value => {
        if (String(value) === key) {
            selection.delete(value);
        }
    });
}

function createMetricElement(
    text: string,
    formulaIcon: HTMLElement | null = null
): HTMLElement {
    const wrapper = document.createElement('span');
    wrapper.className = 'trades-grid__metric';
    wrapper.appendChild(document.createTextNode(text));
    if (formulaIcon) {
        wrapper.appendChild(formulaIcon);
    }
    return wrapper;
}

/** Wire cell-level hover so the popup shows on any cell hover, not just the (i) icon. */
function attachCellHoverTooltip(
    cellEl: HTMLElement,
    formulaIcon: HTMLElement,
    positionFn: (anchor: HTMLElement, tooltip: HTMLElement) => void
): void {
    const tooltipId = formulaIcon.dataset.tooltipId;
    if (!tooltipId) return;
    const tooltip = document.getElementById(tooltipId);
    if (!tooltip) return;
    cellEl.addEventListener('mouseenter', () => {
        positionFn(formulaIcon, tooltip);
        tooltip.classList.add('is-visible');
    });
    cellEl.addEventListener('mouseleave', () => {
        tooltip.classList.remove('is-visible');
    });
}

function createStatusBadge(this: TradesTableContext, trade: TradeRecord): HTMLElement {
    const badge = document.createElement('span');
    const displayStatus = this.getDisplayStatus(trade);
    const statusClass = displayStatus.toLowerCase().replace(/\s+/g, '-');
    badge.className = `status-badge ${statusClass}`.trim();
    badge.textContent = displayStatus;
    return badge;
}


function createMergeCheckboxRenderer(
    this: TradesTableContext,
    params: ICellRendererParams<TradeRecord>
): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'trade-select-cell';

    const trade = params.data;
    if (!trade) {
        return wrapper;
    }

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'trade-merge-checkbox';
    checkbox.dataset.tradeId = String(trade.id ?? '');
    checkbox.checked = hasTradeSelection(this.tradeMergeSelection, trade.id);
    checkbox.disabled = !this.tradesMergePanelOpen;
    checkbox.tabIndex = this.tradesMergePanelOpen ? 0 : -1;
    checkbox.setAttribute('aria-label', `Select trade ${(trade.ticker as string) || ''}`.trim());
    checkbox.addEventListener('change', (event) => {
        event.stopPropagation();
        if (!this.tradesMergePanelOpen) {
            checkbox.checked = hasTradeSelection(this.tradeMergeSelection, trade.id);
            return;
        }
        if (checkbox.checked) {
            this.tradeMergeSelection.add(trade.id);
        } else {
            removeTradeSelection(this.tradeMergeSelection, trade.id);
        }
        this.syncSelectAllCheckbox();
        this.refreshTradesMergePanelContents();
    });

    wrapper.appendChild(checkbox);
    return wrapper;
}

function createActionsRenderer(
    this: TradesTableContext,
    params: ICellRendererParams<TradeRecord>
): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'trades-grid__actions';
    const trade = params.data;
    if (!trade) {
        return wrapper;
    }

    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.className = 'action-btn action-btn--edit';
    editButton.textContent = 'Edit';
    editButton.addEventListener('click', (event) => {
        event.stopPropagation();
        this.editTrade(trade.id, trade);
    });

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'action-btn action-btn--delete';
    deleteButton.textContent = 'Delete';
    deleteButton.addEventListener('click', (event) => {
        event.stopPropagation();
        this.deleteTrade(trade.id, trade);
    });

    wrapper.append(editButton, deleteButton);
    return wrapper;
}

function buildTradeColumnDefs(this: TradesTableContext): ColDef<TradeRecord>[] {
    return [
        {
            colId: MERGE_COLUMN_ID,
            headerName: '',
            width: 52,
            minWidth: 52,
            maxWidth: 60,
            pinned: 'left',
            lockPosition: 'left',
            sortable: false,
            filter: false,
            resizable: false,
            suppressMovable: true,
            hide: !this.tradesMergePanelOpen,
            cellRenderer: (params: ICellRendererParams<TradeRecord>) => createMergeCheckboxRenderer.call(this, params),
            cellClass: 'trade-select-cell'
        },
        {
            colId: 'ticker',
            field: 'ticker',
            headerName: 'Ticker',
            width: 120,
            pinned: 'left',
            cellRenderer: (params: ICellRendererParams<TradeRecord>) => this.createTickerElement(params.value),
            filter: 'agTextColumnFilter'
        },
        {
            colId: 'strategy',
            field: 'strategy',
            headerName: 'Strategy',
            minWidth: 190,
            flex: 1,
            valueFormatter: params => (params.value as string) || '—',
            filter: 'agTextColumnFilter'
        },
        {
            colId: 'strikePrice',
            headerName: 'Strike',
            width: 110,
            valueGetter: params => safeNumber(params.data?.strikePrice),
            cellRenderer: (params: ICellRendererParams<TradeRecord>) => {
                const trade = params.data;
                const strikeDisplay = trade?.displayStrike || null;
                const strikePrice = safeNumber(trade?.strikePrice);
                if (strikeDisplay) {
                    return String(strikeDisplay);
                }
                return strikePrice !== null ? `$${strikePrice.toFixed(2)}` : '—';
            },
            filter: 'agNumberColumnFilter'
        },
        {
            colId: 'quantity',
            headerName: 'Qty',
            width: 90,
            valueGetter: params => safeNumber(params.data?.quantity),
            valueFormatter: params => {
                const value = safeNumber(params.value);
                return value !== null ? String(Math.abs(value)) : '—';
            },
            filter: 'agNumberColumnFilter'
        },
        {
            colId: 'entryDate',
            headerName: 'Entry Date',
            width: 130,
            valueGetter: params => params.data?.openedDate || '',
            valueFormatter: params => this.formatDate(params.value),
            filter: 'agDateColumnFilter'
        },
        {
            colId: 'expirationDate',
            field: 'expirationDate',
            headerName: 'Expiration Date',
            width: 150,
            valueFormatter: params => this.formatDate(params.value),
            filter: 'agDateColumnFilter'
        },
        {
            colId: 'dte',
            field: 'dte',
            headerName: 'DTE',
            width: 90,
            valueGetter: params => safeNumber(params.data?.dte),
            valueFormatter: params => {
                const value = safeNumber(params.value);
                return value !== null ? String(value) : '—';
            },
            filter: 'agNumberColumnFilter'
        },
        {
            colId: 'exitDate',
            headerName: 'Exit Date',
            width: 130,
            valueGetter: params => {
                const trade = params.data;
                return trade && this.isClosedStatus(trade.status) ? trade.closedDate || '' : '';
            },
            valueFormatter: params => params.value ? this.formatDate(params.value) : '—',
            filter: 'agDateColumnFilter'
        },
        {
            colId: 'daysHeld',
            field: 'daysHeld',
            headerName: 'Days Held',
            width: 120,
            valueGetter: params => safeNumber(params.data?.daysHeld),
            valueFormatter: params => {
                const value = safeNumber(params.value);
                return value !== null ? String(value) : '—';
            },
            filter: 'agNumberColumnFilter'
        },
        {
            colId: 'maxRisk',
            headerName: 'Max Risk',
            width: 140,
            valueGetter: params => safeNumber(params.data?.maxRisk),
            cellRenderer: (params: ICellRendererParams<TradeRecord>) => {
                const trade = params.data || {};
                const maxRiskValue = safeNumber(trade.maxRisk);
                const text = (trade.maxRiskLabel as string) ||
                    (maxRiskValue !== null ? this.formatCurrency(maxRiskValue) : '—');
                const formulaIcon = trade.strategy && (trade.maxRiskLabel || maxRiskValue !== null)
                    ? this.createFormulaIcon(trade, 'maxRisk')
                    : null;
                const metricEl = createMetricElement(text, formulaIcon);
                if (formulaIcon) {
                    attachCellHoverTooltip(metricEl, formulaIcon, (anchor, tip) => this.positionFormulaTooltip(anchor, tip));
                }
                return metricEl;
            },
            cellClass: params => {
                const trade = params.data || {};
                const maxRiskValue = safeNumber(trade.maxRisk);
                if (trade.maxRiskLabel) {
                    if (trade.riskIsUnlimited) {
                        return 'pl-negative';
                    }
                    return maxRiskValue !== null ? 'pl-negative' : 'pl-neutral';
                }
                return maxRiskValue !== null ? 'pl-negative' : 'pl-neutral';
            },
            filter: 'agNumberColumnFilter'
        },
        {
            colId: 'pl',
            headerName: 'P&L',
            width: 125,
            valueGetter: params => safeNumber(params.data?.pl),
            cellRenderer: (params: ICellRendererParams<TradeRecord>) => {
                const trade = params.data || {};
                const plValue = safeNumber(trade.pl);
                const text = plValue !== null ? this.formatCurrency(plValue) : '—';
                const formulaIcon = trade.strategy && plValue !== null
                    ? this.createFormulaIcon(trade, 'pl')
                    : null;
                const metricEl = createMetricElement(text, formulaIcon);
                if (formulaIcon) {
                    attachCellHoverTooltip(metricEl, formulaIcon, (anchor, tip) => this.positionFormulaTooltip(anchor, tip));
                }
                return metricEl;
            },
            cellClass: params => {
                const plValue = safeNumber(params.data?.pl);
                return plValue !== null
                    ? (plValue > 0 ? 'pl-positive' : plValue < 0 ? 'pl-negative' : 'pl-neutral')
                    : 'pl-neutral';
            },
            filter: 'agNumberColumnFilter'
        },
        {
            colId: 'roi',
            headerName: 'ROI',
            width: 105,
            valueGetter: params => safeNumber(params.data?.roi),
            valueFormatter: params => {
                const value = safeNumber(params.value);
                return value !== null ? this.formatPercent(value, '—') : '—';
            },
            cellClass: params => {
                const value = safeNumber(params.value);
                return value !== null
                    ? (value > 0 ? 'pl-positive' : value < 0 ? 'pl-negative' : 'pl-neutral')
                    : 'pl-neutral';
            },
            filter: 'agNumberColumnFilter'
        },
        {
            colId: 'weeklyROI',
            headerName: 'Weekly ROI',
            headerTooltip: 'Simple (non-compounded) scaling: ROI × 7 ÷ days held',
            width: 125,
            valueGetter: params => {
                const trade = params.data;
                return trade && this.isClosedStatus(trade.status) ? safeNumber(trade.weeklyROI) : null;
            },
            valueFormatter: params => {
                const value = safeNumber(params.value);
                return value !== null ? this.formatPercent(value, '—') : '—';
            },
            cellClass: params => {
                const value = safeNumber(params.value);
                return value !== null
                    ? (value > 0 ? 'pl-positive' : value < 0 ? 'pl-negative' : 'pl-neutral')
                    : 'pl-neutral';
            },
            filter: 'agNumberColumnFilter'
        },
        {
            colId: 'monthlyROI',
            headerName: 'Monthly ROI',
            headerTooltip: 'Simple (non-compounded) scaling: ROI × 30 ÷ days held',
            width: 130,
            valueGetter: params => {
                const trade = params.data;
                return trade && this.isClosedStatus(trade.status) ? safeNumber(trade.monthlyROI) : null;
            },
            valueFormatter: params => {
                const value = safeNumber(params.value);
                return value !== null ? this.formatPercent(value, '—') : '—';
            },
            cellClass: params => {
                const value = safeNumber(params.value);
                return value !== null
                    ? (value > 0 ? 'pl-positive' : value < 0 ? 'pl-negative' : 'pl-neutral')
                    : 'pl-neutral';
            },
            filter: 'agNumberColumnFilter'
        },
        {
            colId: 'annualizedROI',
            headerName: 'Annual ROI',
            headerTooltip: 'Simple (non-compounded) annualization: ROI × 365 ÷ days held — the options convention for annualized return on collateral',
            width: 120,
            valueGetter: params => {
                const trade = params.data;
                return trade && this.isClosedStatus(trade.status) ? safeNumber(trade.annualizedROI) : null;
            },
            valueFormatter: params => {
                const value = safeNumber(params.value);
                return value !== null ? this.formatPercent(value, '—') : '—';
            },
            cellClass: params => {
                const value = safeNumber(params.value);
                return value !== null
                    ? (value > 0 ? 'pl-positive' : value < 0 ? 'pl-negative' : 'pl-neutral')
                    : 'pl-neutral';
            },
            filter: 'agNumberColumnFilter'
        },
        {
            colId: 'status',
            headerName: 'Status',
            width: 130,
            valueGetter: params => params.data ? this.getDisplayStatus(params.data) : '',
            cellRenderer: (params: ICellRendererParams<TradeRecord>) => params.data ? createStatusBadge.call(this, params.data) : '—',
            filter: 'agTextColumnFilter'
        },
        {
            colId: 'actions',
            headerName: 'Actions',
            width: 120,
            minWidth: 120,
            pinned: 'right',
            sortable: false,
            filter: false,
            resizable: false,
            suppressMovable: true,
            cellRenderer: (params: ICellRendererParams<TradeRecord>) => createActionsRenderer.call(this, params),
            cellClass: 'actions-cell'
        }
    ];
}

function applyGridSortState(this: TradesTableContext): void {
    const api = this.tradesGridApi;
    const sortKey = this.currentSort?.key;
    const direction = sortKey ? (this.sortDirection[sortKey] || this.currentSort?.direction || 'asc') : null;
    if (!api || api.isDestroyed() || !sortKey || (direction !== 'asc' && direction !== 'desc')) {
        return;
    }

    api.applyColumnState({
        defaultState: { sort: null },
        state: [{ colId: sortKey, sort: direction }]
    });
}

function syncSortFromGrid(this: TradesTableContext, event: SortChangedEvent<TradeRecord>): void {
    const sortedColumn = event.api.getColumnState().find(column => column.sort);
    if (!sortedColumn?.colId) {
        this.currentSort = { key: null, direction: 'asc' };
        return;
    }

    const direction = sortedColumn.sort === 'desc' ? 'desc' : 'asc';
    this.sortDirection[sortedColumn.colId] = direction;
    this.currentSort = {
        key: sortedColumn.colId,
        direction
    };

    const orderedTrades: TradeRecord[] = [];
    event.api.forEachNodeAfterFilterAndSort((node) => {
        if (node.data) {
            orderedTrades.push(node.data);
        }
    });
    if (orderedTrades.length) {
        this.currentFilteredTrades = orderedTrades;
    }
    this.syncSelectAllCheckbox();
    this.refreshTradesMergePanelContents();
}

function createTradesGridOptions(this: TradesTableContext, trades: TradeRecord[]): GridOptions<TradeRecord> {
    const context = this;
    const rowIdsByTrade = new WeakMap<object, string>();
    const rowIdCounts = new Map<string, number>();
    trades.forEach((trade, index) => {
        const baseKey = tradeRowKey(trade, `trade-${index}`);
        const count = (rowIdCounts.get(baseKey) ?? 0) + 1;
        rowIdCounts.set(baseKey, count);
        rowIdsByTrade.set(trade as object, count === 1 ? baseKey : `${baseKey}-${count}`);
    });
    return {
        rowData: buildRowsWithDetail(trades, this.expandedTradeId),
        columnDefs: buildTradeColumnDefs.call(this),
        defaultColDef: {
            sortable: true,
            resizable: true,
            filter: true,
            minWidth: 90,
            suppressHeaderMenuButton: false
        },
        getRowId: params => {
            const row = params.data as TradeRecord & { _isDetailRow?: boolean; _parentTrade?: TradeRecord };
            if (row._isDetailRow && row._parentTrade) {
                const parentKey = rowIdsByTrade.get(row._parentTrade as object) || tradeRowKey(row._parentTrade);
                return `detail-${parentKey}`;
            }
            return rowIdsByTrade.get(params.data as object) || tradeRowKey(params.data);
        },
        isFullWidthRow: params => !!(params.rowNode.data as Record<string, unknown>)?._isDetailRow,
        fullWidthCellRenderer: createPositionDetailPanelRenderer(context as unknown as PositionDetailPanelContext, { threeCol: true, tradeBreakdown: true }),
        getRowHeight: params => (params.data as Record<string, unknown>)?._isDetailRow ? 800 : 50,
        onRowClicked: params => {
            const data = params.data;
            if ((data as Record<string, unknown>)?._isDetailRow) return;
            const id = typeof data?.id === 'string' ? data.id : null;
            if (!id) return;
            context.expandedTradeId = context.expandedTradeId === id ? null : id;
            params.api.setGridOption('rowData', buildRowsWithDetail(context.currentFilteredTrades, context.expandedTradeId));
        },
        domLayout: 'autoHeight',
        headerHeight: 46,
        rowBuffer: 20,
        animateRows: false,
        suppressCellFocus: false,
        maintainColumnOrder: true,
        onSortChanged: (event: SortChangedEvent<TradeRecord>) => syncSortFromGrid.call(this, event),
        overlayNoRowsTemplate: '<span class="ag-overlay-no-rows-center">No trades match the current filters.</span>'
    };
}

export function updateTradesList(this: TradesTableContext): void {
    this.populateFilters();
    this.filterTrades();
}

export function renderTradesTable(this: TradesTableContext, trades: TradeRecord[] = this.trades): void {
    const gridRoot = document.getElementById('trades-table') as HTMLElement | null;
    if (!gridRoot) return;

    const tradesToRender = Array.isArray(trades) ? trades.slice() : [];
    this.currentFilteredTrades = tradesToRender;
    this.expandedTradeId = null;

    if (typeof this.setupTradesMergeControls === 'function') {
        this.setupTradesMergeControls();
    }

    // Clean up formula tooltips that were appended to <body> by previous renders
    document.querySelectorAll('body > .formula-tooltip').forEach(el => el.remove());

    this.pruneTradeMergeSelection();

    if (!this.tradesGridApi || this.tradesGridApi.isDestroyed()) {
        this.tradesGridApi = createGrid(gridRoot, createTradesGridOptions.call(this, tradesToRender));
        applyGridSortState.call(this);
    } else {
        this.tradesGridApi.updateGridOptions({
            rowData: buildRowsWithDetail(tradesToRender, this.expandedTradeId)
        });
        applyGridSortState.call(this);
    }

    this.updateMergeColumnVisibility();
    this.refreshTradesGridSelectionState();
    this.refreshTradesMergePanelContents();
}

export function updateTradesGridMergeColumnVisibility(this: TradesTableContext): void {
    const api = this.tradesGridApi;
    if (!api || api.isDestroyed()) {
        return;
    }
    api.setColumnsVisible([MERGE_COLUMN_ID], Boolean(this.tradesMergePanelOpen));
    api.refreshHeader();
    api.refreshCells({ columns: [MERGE_COLUMN_ID], force: true });
}

export function refreshTradesGridSelectionState(this: TradesTableContext): void {
    const api = this.tradesGridApi;
    if (!api || api.isDestroyed()) {
        return;
    }
    api.refreshCells({ columns: [MERGE_COLUMN_ID], force: true });
    api.refreshHeader();
}

export function sortTrades(this: TradesTableContext, sortBy: string): void {
    if (!sortBy) {
        return;
    }

    const direction = this.sortDirection[sortBy] === 'asc' ? 'desc' : 'asc';
    this.sortDirection[sortBy] = direction;
    this.currentSort = {
        key: sortBy,
        direction
    };

    const tradesTable = document.getElementById('trades-table');
    if (tradesTable) {
        tradesTable.querySelectorAll('.sortable').forEach((header) => {
            header.classList.remove('asc', 'desc');
            header.removeAttribute('aria-sort');
        });
        const sortHeader = tradesTable.querySelector(`[data-sort="${sortBy}"]`);
        if (sortHeader) {
            sortHeader.classList.add(direction);
            sortHeader.setAttribute('aria-sort', direction === 'asc' ? 'ascending' : 'descending');
        }
    }

    const sourceTrades = Array.isArray(this.currentFilteredTrades)
        ? this.currentFilteredTrades
        : this.trades;
    const sortedTrades = this.applySortToTrades(sourceTrades, sortBy, direction);

    this.currentFilteredTrades = sortedTrades.slice();
    this.renderTradesTable(sortedTrades);
}

export function deleteTrade(this: TradesTableContext, id: unknown, selectedTrade?: TradeRecord): void {
    if (confirm('Are you sure you want to delete this trade?')) {
        const index = selectedTrade
            ? this.trades.indexOf(selectedTrade)
            : this.trades.findIndex(trade => trade.id === id);
        if (index < 0) {
            return;
        }
        this.trades.splice(index, 1);
        this.saveToStorage();
        this.markUnsavedChanges();
        this.filterTrades();
        this.updateDashboard();
    }
}

export function editTrade(this: TradesTableContext, id: unknown, selectedTrade?: TradeRecord): void {
    const trade = selectedTrade && this.trades.includes(selectedTrade)
        ? selectedTrade
        : this.trades.find(t => t.id === id);
    if (!trade) {
        return;
    }

    this.resetAddTradeForm();
    this.currentEditingId = id;
    this.currentEditingTrade = trade;

    const form = document.getElementById('add-trade-form') as HTMLFormElement | null;
    if (!form) {
        return;
    }

    const elements = form.elements as HTMLFormControlsCollection & {
        ticker?: HTMLInputElement;
        strategy?: HTMLInputElement;
        exitReason?: HTMLInputElement;
        notes?: HTMLInputElement;
        underlyingType?: HTMLSelectElement;
        tradeStatus?: HTMLSelectElement;
    };

    if (elements.ticker) {
        elements.ticker.value = (trade.ticker as string) || '';
    }
    if (elements.strategy) {
        elements.strategy.value = (trade.strategy as string) || '';
    }
    if (elements.exitReason) {
        elements.exitReason.value = (trade.exitReason as string) || '';
    }
    if (elements.notes) {
        elements.notes.value = (trade.notes as string) || '';
    }
    if (elements.underlyingType) {
        const normalizedUnderlying = this.normalizeUnderlyingType(trade.underlyingType, { fallback: 'Stock' }) || 'Stock';
        elements.underlyingType.value = normalizedUnderlying;
    }
    if (elements.tradeStatus) {
        const manualStatus = this.normalizeTradeStatusInput(trade.statusOverride);
        elements.tradeStatus.value = manualStatus || '';
    }

    this.renderLegForms((trade.legs as unknown[]) || []);
    this.updateTickerPreview((trade.ticker as string) || '');

    this.showView('add-trade');
}

// NOTE: updateTickerPreview is implemented in views.ts and provided to this module
// via the host class mixin — declared in the primary interface above.
