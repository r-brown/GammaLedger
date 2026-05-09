// src/ui/tables/assigned-positions.ts — Wave 9: Assigned positions grid rendering.
// Uses the .call(this, …) delegation pattern.

import {
  createGrid,
  type ColDef,
  type GridApi,
  type GridOptions,
  type ICellRendererParams
} from './ag-grid.js'

type TradeRecord = Record<string, unknown>

interface AssignmentEntry {
  trade: TradeRecord
  strike: number
  premiumCollected: number
  premiumHistory: Array<{ label: string; amount: number }>
  effectiveCostBasis: number
  shares: number
  initialPutPremium: number
  callPremium: number
  longCallCost: number
  positionType: string
  assignmentCostBasis: number
  assignmentDate: string
  activeShortCalls: number
  activeShortCallDetails: Array<{ strike: number; expiration: string; contracts: number }>
  coveredShares: number
  uncoveredShares: number
  coverageStatus: string
}

interface AssignedPositionsContext {
  latestStats: Record<string, unknown> | null
  assignedPositionsGridApi?: GridApi<AssignmentEntry> | null
  assignedPositionsStatusFilter: string
  assignedPositionsQuoteEntries?: Map<string, Record<string, unknown>>
  activeQuoteEntries: Map<string, Record<string, unknown>>
  finnhub: { apiKey?: string }
  isClosedStatus(status: unknown): boolean
  createTickerElement(ticker: unknown, className?: string, opts?: Record<string, unknown>): HTMLElement
  openTradesFilteredByTicker(ticker: unknown): void
  formatCurrency(value: unknown, opts?: Record<string, unknown>): string
  formatDate(value: unknown): string
  formatNumber(value: unknown, opts: Record<string, unknown>): string | null
  positionFormulaTooltip(wrapper: HTMLElement, tooltip: HTMLElement): void
  escapeHtml(value: string): string
  getQuoteEntryKey(trade: TradeRecord): string
  rebuildQuoteRefreshSchedule(): void
  startQuoteAutoRefreshIfNeeded(): void
  refreshAssignedPositionsQuotes(opts: { immediate: boolean }): void
  updateAssignedPositionMetrics(entry: Record<string, unknown>, quote: Record<string, unknown>): void
}

function assignmentRowKey(entry: AssignmentEntry): string {
    return String(entry.trade.id ?? `${entry.trade.ticker || 'assigned'}-${entry.assignmentDate || ''}`)
        .replace(/[^a-zA-Z0-9_-]/g, '-');
}

function createStatusBadge(isOpen: boolean): HTMLElement {
    const statusBadge = document.createElement('span');
    statusBadge.className = `status-badge ${isOpen ? 'open' : 'closed'}`;
    statusBadge.textContent = isOpen ? 'Open' : 'Closed';
    return statusBadge;
}

function createCoverageBadge(this: AssignedPositionsContext, entry: AssignmentEntry): HTMLElement {
    const {
        trade,
        activeShortCalls,
        activeShortCallDetails,
        coveredShares,
        uncoveredShares,
        coverageStatus,
        shares
    } = entry;
    const wrapper = document.createElement('div');
    wrapper.className = 'coverage-indicator-wrapper';

    const badge = document.createElement('span');
    badge.className = 'coverage-badge';
    const isOpen = !this.isClosedStatus(trade.status);

    if (!isOpen) {
        badge.classList.add('coverage-na');
        badge.textContent = '—';
        badge.title = 'Position is closed';
    } else if (coverageStatus === 'full') {
        badge.classList.add('coverage-full');
        badge.textContent = '✓ Covered';
        const tooltipParts = [`${activeShortCalls} contract${activeShortCalls !== 1 ? 's' : ''} sold`];
        activeShortCallDetails.forEach(detail => {
            tooltipParts.push(`${detail.contracts}x ${this.formatCurrency(detail.strike)} Call exp ${this.formatDate(detail.expiration)}`);
        });
        badge.title = tooltipParts.join('\n');
    } else if (coverageStatus === 'partial') {
        badge.classList.add('coverage-partial');
        badge.textContent = 'Partial';
        badge.title = `${uncoveredShares} of ${shares} shares uncovered\n${activeShortCalls} contract${activeShortCalls !== 1 ? 's' : ''} sold (covers ${coveredShares} shares)`;
    } else {
        badge.classList.add('coverage-none');
        badge.textContent = 'Uncovered';
        badge.title = `${shares} shares have no active covered call\nSell a call to collect premium and reduce cost basis`;
    }

    wrapper.appendChild(badge);
    return wrapper;
}

function createPremiumRenderer(this: AssignedPositionsContext, entry: AssignmentEntry): HTMLElement {
    const {
        premiumCollected,
        premiumHistory,
        initialPutPremium,
        callPremium,
        longCallCost,
        positionType
    } = entry;
    const wrapper = document.createElement('span');
    wrapper.className = 'formula-value-wrapper';

    const premiumText = document.createElement('span');
    premiumText.textContent = this.formatCurrency(premiumCollected);
    wrapper.appendChild(premiumText);

    const icon = document.createElement('span');
    icon.className = 'formula-info-icon';
    icon.textContent = 'i';
    icon.setAttribute('aria-label', 'View premium breakdown');

    const tooltip = document.createElement('div');
    tooltip.className = 'formula-tooltip';
    tooltip.setAttribute('role', 'tooltip');

    const isPmccPosition = positionType === 'pmcc';
    const componentRows = isPmccPosition
        ? [
            { name: 'LEAP Cost', value: this.formatCurrency(-Math.abs(longCallCost)) },
            { name: 'Short Calls Net', value: this.formatCurrency(callPremium) }
        ]
        : [
            { name: 'Initial CSP Net', value: this.formatCurrency(initialPutPremium) },
            { name: 'Covered Calls Net', value: this.formatCurrency(callPremium) }
        ];

    let tooltipHTML = '<div class="formula-tooltip__title">Premium Breakdown</div>';
    tooltipHTML += '<div class="formula-tooltip__section">';
    tooltipHTML += '<div class="formula-tooltip__label">Net Premium Collected</div>';
    tooltipHTML += `<div class="formula-tooltip__formula">${this.escapeHtml(this.formatCurrency(premiumCollected))}</div>`;
    tooltipHTML += '</div><div class="formula-tooltip__section">';
    tooltipHTML += '<div class="formula-tooltip__label">Components</div><div class="formula-tooltip__variables">';
    componentRows.forEach(row => {
        tooltipHTML += '<div class="formula-tooltip__variable">';
        tooltipHTML += `<span class="formula-tooltip__variable-name">${this.escapeHtml(row.name)}</span>`;
        tooltipHTML += `<span class="formula-tooltip__variable-value">${this.escapeHtml(row.value)}</span>`;
        tooltipHTML += '</div>';
    });
    tooltipHTML += '</div></div><div class="formula-tooltip__section">';
    tooltipHTML += '<div class="formula-tooltip__label">Activity Log</div>';
    if (premiumHistory && premiumHistory.length > 0) {
        tooltipHTML += '<div class="formula-tooltip__variables">';
        premiumHistory.forEach(item => {
            tooltipHTML += '<div class="formula-tooltip__variable">';
            tooltipHTML += `<span class="formula-tooltip__variable-name">${this.escapeHtml(item.label)}</span>`;
            tooltipHTML += `<span class="formula-tooltip__variable-value">${this.escapeHtml(this.formatCurrency(item.amount))}</span>`;
            tooltipHTML += '</div>';
        });
        tooltipHTML += '</div>';
    } else {
        tooltipHTML += '<div class="formula-tooltip__explanation">No option premium activity recorded yet.</div>';
    }
    tooltipHTML += '</div>';
    tooltip.innerHTML = tooltipHTML;

    wrapper.appendChild(icon);
    wrapper.appendChild(tooltip);
    wrapper.addEventListener('mouseenter', () => this.positionFormulaTooltip(wrapper, tooltip));
    wrapper.addEventListener('mouseleave', () => tooltip.removeAttribute('style'));
    return wrapper;
}

function createQuoteDependentCell(
    className: string,
    text = '—'
): HTMLElement {
    const cell = document.createElement('div');
    cell.className = className;
    cell.textContent = text;
    return cell;
}

function ensureAssignedQuoteEntry(
    this: AssignedPositionsContext,
    entry: AssignmentEntry,
    quoteEntries: Map<string, Record<string, unknown>>
): Record<string, unknown> | null {
    const ticker = ((entry.trade.ticker || '') as string).toString().trim().toUpperCase();
    if (!ticker || !this.finnhub.apiKey) {
        return null;
    }
    const quoteKey = `assigned|${this.getQuoteEntryKey(entry.trade)}|${assignmentRowKey(entry)}`;
    const existing = quoteEntries.get(quoteKey);
    if (existing) {
        return existing;
    }
    const created: Record<string, unknown> = {
        trade: entry.trade,
        shares: entry.shares,
        effectiveCostBasis: entry.effectiveCostBasis,
        key: quoteKey
    };
    quoteEntries.set(quoteKey, created);
    return created;
}

function buildAssignedColumnDefs(
    this: AssignedPositionsContext,
    quoteEntries: Map<string, Record<string, unknown>>
): ColDef<AssignmentEntry>[] {
    return [
        {
            colId: 'ticker',
            headerName: 'Ticker',
            width: 120,
            pinned: 'left',
            valueGetter: params => params.data?.trade.ticker || '',
            cellRenderer: (params: ICellRendererParams<AssignmentEntry>) => {
                const tickerValue = ((params.value ?? '') as string).toString().trim().toUpperCase();
                return this.createTickerElement(params.value, 'ticker-pill', {
                    behavior: 'filter',
                    onClick: (value: unknown) => this.openTradesFilteredByTicker(value),
                    title: tickerValue ? `View all trades for ${tickerValue}` : ''
                });
            },
            filter: 'agTextColumnFilter'
        },
        {
            colId: 'strategy',
            headerName: 'Strategy',
            minWidth: 180,
            flex: 1,
            valueGetter: params => params.data?.trade.strategy || '',
            valueFormatter: params => (params.value as string) || '—',
            filter: 'agTextColumnFilter'
        },
        {
            colId: 'status',
            headerName: 'Status',
            width: 105,
            valueGetter: params => params.data ? (this.isClosedStatus(params.data.trade.status) ? 'Closed' : 'Open') : '',
            cellRenderer: (params: ICellRendererParams<AssignmentEntry>) => params.data
                ? createStatusBadge(!this.isClosedStatus(params.data.trade.status))
                : '—',
            filter: 'agTextColumnFilter'
        },
        {
            colId: 'coverage',
            headerName: 'Coverage',
            width: 145,
            valueGetter: params => params.data?.coverageStatus || '',
            cellRenderer: (params: ICellRendererParams<AssignmentEntry>) => params.data
                ? createCoverageBadge.call(this, params.data)
                : '—',
            filter: 'agTextColumnFilter'
        },
        {
            colId: 'assignmentDate',
            field: 'assignmentDate',
            headerName: 'Assignment Date',
            width: 145,
            valueFormatter: params => this.formatDate(params.value),
            filter: 'agDateColumnFilter'
        },
        {
            colId: 'shares',
            field: 'shares',
            headerName: 'Shares',
            width: 105,
            valueFormatter: params => this.formatNumber(params.value, { decimals: 0, useGrouping: true }) ?? String(params.value ?? '—'),
            filter: 'agNumberColumnFilter'
        },
        {
            colId: 'strike',
            field: 'strike',
            headerName: 'Strike Price',
            width: 130,
            valueFormatter: params => this.formatCurrency(params.value),
            filter: 'agNumberColumnFilter'
        },
        {
            colId: 'assignmentCostBasis',
            field: 'assignmentCostBasis',
            headerName: 'Assignment Cost Basis',
            width: 180,
            valueFormatter: params => this.formatCurrency(params.value),
            filter: 'agNumberColumnFilter'
        },
        {
            colId: 'premiumCollected',
            field: 'premiumCollected',
            headerName: 'Premium Collected',
            width: 170,
            cellRenderer: (params: ICellRendererParams<AssignmentEntry>) => params.data
                ? createPremiumRenderer.call(this, params.data)
                : '—',
            filter: 'agNumberColumnFilter'
        },
        {
            colId: 'effectiveCostBasis',
            field: 'effectiveCostBasis',
            headerName: 'Eff. Cost Basis',
            width: 140,
            valueFormatter: params => this.formatCurrency(params.value),
            filter: 'agNumberColumnFilter'
        },
        {
            colId: 'currentPrice',
            headerName: 'Current Price',
            width: 130,
            sortable: false,
            filter: false,
            cellRenderer: (params: ICellRendererParams<AssignmentEntry>) => {
                const cell = createQuoteDependentCell('current-price-cell quote-dependent');
                const entry = params.data;
                if (!entry) {
                    return cell;
                }
                const quoteEntry = ensureAssignedQuoteEntry.call(this, entry, quoteEntries);
                if (quoteEntry) {
                    quoteEntry.currentPriceCell = cell;
                }
                return cell;
            }
        },
        {
            colId: 'marketValue',
            headerName: 'Market Value',
            width: 135,
            sortable: false,
            filter: false,
            cellRenderer: (params: ICellRendererParams<AssignmentEntry>) => {
                const cell = createQuoteDependentCell('market-value-cell quote-dependent');
                const entry = params.data;
                if (entry) {
                    const quoteEntry = ensureAssignedQuoteEntry.call(this, entry, quoteEntries);
                    if (quoteEntry) {
                        quoteEntry.marketValueCell = cell;
                    }
                }
                return cell;
            }
        },
        {
            colId: 'unrealizedGL',
            headerName: 'Unrealized Gain/Loss',
            width: 175,
            sortable: false,
            filter: false,
            cellRenderer: (params: ICellRendererParams<AssignmentEntry>) => {
                const cell = createQuoteDependentCell('unrealized-gl-cell quote-dependent');
                const entry = params.data;
                if (entry) {
                    const quoteEntry = ensureAssignedQuoteEntry.call(this, entry, quoteEntries);
                    if (quoteEntry) {
                        quoteEntry.unrealizedGLCell = cell;
                    }
                }
                return cell;
            }
        },
        {
            colId: 'notes',
            headerName: 'Notes',
            minWidth: 180,
            flex: 1,
            valueGetter: params => params.data?.trade.notes || '',
            valueFormatter: params => ((params.value || '') as string) || '—',
            cellClass: 'notes-col',
            tooltipValueGetter: params => ((params.value || '') as string)
        }
    ];
}

function createAssignedGridOptions(
    this: AssignedPositionsContext,
    rows: AssignmentEntry[],
    quoteEntries: Map<string, Record<string, unknown>>
): GridOptions<AssignmentEntry> {
    return {
        rowData: rows,
        columnDefs: buildAssignedColumnDefs.call(this, quoteEntries),
        defaultColDef: {
            sortable: true,
            resizable: true,
            filter: true,
            minWidth: 95
        },
        getRowId: params => assignmentRowKey(params.data),
        domLayout: 'autoHeight',
        rowHeight: 48,
        headerHeight: 44,
        rowBuffer: 10,
        animateRows: false,
        overlayNoRowsTemplate: '<span class="ag-overlay-no-rows-center">No assigned positions match the current filter.</span>'
    };
}

export function updateAssignedPositionsTable(this: AssignedPositionsContext): void {
    const stats = this.latestStats;
    const assignmentStats = (stats?.assignmentStats as Record<string, unknown> | undefined);
    const assignments = (assignmentStats?.assignments as AssignmentEntry[] | undefined) || [];

    const currentFilter = this.assignedPositionsStatusFilter;
    const filteredAssignments = assignments.filter(({ trade }) => {
        if (currentFilter === 'open') {
            return !this.isClosedStatus(trade.status);
        } else if (currentFilter === 'closed') {
            return this.isClosedStatus(trade.status);
        }
        return true;
    });

    const gridRoot = document.getElementById('assigned-positions-table') as HTMLElement | null;
    if (!gridRoot) {
        return;
    }

    const quoteEntries = new Map<string, Record<string, unknown>>();
    if (!this.assignedPositionsGridApi || this.assignedPositionsGridApi.isDestroyed()) {
        this.assignedPositionsGridApi = createGrid(
            gridRoot,
            createAssignedGridOptions.call(this, filteredAssignments, quoteEntries)
        );
    } else {
        this.assignedPositionsGridApi.updateGridOptions({
            columnDefs: buildAssignedColumnDefs.call(this, quoteEntries),
            rowData: filteredAssignments
        });
    }

    this.assignedPositionsQuoteEntries = quoteEntries;

    if (quoteEntries.size > 0) {
        quoteEntries.forEach((entry, key) => {
            this.activeQuoteEntries.set(key, entry);
        });
        this.rebuildQuoteRefreshSchedule();
        this.startQuoteAutoRefreshIfNeeded();
        this.refreshAssignedPositionsQuotes({ immediate: true });
    }
}

export function updateAssignedPositionMetrics(
    this: AssignedPositionsContext,
    entry: Record<string, unknown>,
    quote: Record<string, unknown>
): void {
    if (!entry || !quote) {
        return;
    }

    const currentPrice = Number(quote?.price);
    const shares = Number(entry.shares);
    const effectiveCostBasis = Number(entry.effectiveCostBasis);

    if (!Number.isFinite(currentPrice) || !Number.isFinite(shares) || !Number.isFinite(effectiveCostBasis)) {
        return;
    }

    const marketValue = currentPrice * shares;
    const unrealizedGL = marketValue - effectiveCostBasis;
    const unrealizedGLPercent = effectiveCostBasis !== 0 ? (unrealizedGL / effectiveCostBasis) * 100 : 0;

    const currentPriceCell = entry.currentPriceCell as HTMLElement | undefined;
    if (currentPriceCell) {
        currentPriceCell.textContent = this.formatCurrency(currentPrice);
    }

    const marketValueCell = entry.marketValueCell as HTMLElement | undefined;
    if (marketValueCell) {
        marketValueCell.textContent = this.formatCurrency(marketValue);
    }

    const unrealizedGLCell = entry.unrealizedGLCell as HTMLElement | undefined;
    if (unrealizedGLCell) {
        unrealizedGLCell.innerHTML = '';

        const absValueEl = document.createElement('span');
        absValueEl.className = 'gl-absolute';
        absValueEl.textContent = this.formatCurrency(unrealizedGL);
        unrealizedGLCell.appendChild(absValueEl);

        const percentEl = document.createElement('span');
        percentEl.className = 'gl-percent';
        const percentMagnitude = Math.abs(unrealizedGLPercent);
        const percentNumber = this.formatNumber(percentMagnitude, { decimals: 2, useGrouping: true })
            ?? percentMagnitude.toFixed(2);
        const percentPrefix = unrealizedGL > 0 ? '+' : unrealizedGL < 0 ? '-' : '';
        percentEl.textContent = `${percentPrefix}${percentNumber}%`;
        unrealizedGLCell.appendChild(percentEl);

        unrealizedGLCell.classList.remove('pl-positive', 'pl-negative', 'pl-neutral');
        if (unrealizedGL > 0) {
            unrealizedGLCell.classList.add('pl-positive');
        } else if (unrealizedGL < 0) {
            unrealizedGLCell.classList.add('pl-negative');
        } else {
            unrealizedGLCell.classList.add('pl-neutral');
        }
    }
}
