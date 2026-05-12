// src/ui/tables/active-positions.ts — Wave 9: Active positions grid rendering.
// Uses the .call(this, …) delegation pattern.

import {
  createGrid,
  type ColDef,
  type GridApi,
  type GridOptions,
  type ICellRendererParams
} from './ag-grid.js'
import {
  buildRowsWithDetail,
  createPositionDetailPanelRenderer,
  type PositionDetailPanelContext
} from './position-detail-panel.js'
import type { EarningsCalendarEntry } from '../../types/integrations.js'

type TradeRecord = Record<string, unknown>

interface ActivePositionsContext extends PositionDetailPanelContext {
  trades: TradeRecord[]
  activePositionsTrades: TradeRecord[]
  expandedTradeId: string | null
  activePositionsGridApi?: GridApi<TradeRecord> | null
  activeQuoteEntries: Map<string, Record<string, unknown>>
  isActiveStatus(status: unknown): boolean
  isWheelOrPmccTrade(trade: TradeRecord): boolean
  isAssignmentTrade(trade: TradeRecord): boolean
  hasNonExpiredOpenShortOptions(trade: TradeRecord): boolean
  lifecycleStatus?: string
  parseInteger(value: unknown, fallback: unknown, opts?: { allowNegative?: boolean }): number | null
  parseDecimal(value: unknown, fallback: unknown, opts?: { allowNegative?: boolean }): number | null
  createTickerElement(ticker: unknown, className?: string, opts?: Record<string, unknown>): HTMLElement
  openTradesFilteredByTicker(ticker: unknown): void
  summarizeLegs(legs: unknown[]): Record<string, unknown>
  getActiveStrikeForDisplay(summary: Record<string, unknown>): number | null
  formatNumber(value: unknown, opts?: Record<string, unknown>): string | null
  formatCurrency(value: unknown, opts?: Record<string, unknown>): string
  getQuoteEntryKey(trade: TradeRecord): string
  populateQuoteCell(cell: HTMLElement | null, trade: TradeRecord, row: HTMLElement | null, opts: Record<string, unknown>): void
  updateExpirationHighlight(cell: HTMLElement, trade: TradeRecord): void
  rebuildQuoteRefreshSchedule(): void
  startQuoteAutoRefreshIfNeeded(): void
  refreshActivePositionsQuotes(opts: { force: boolean; immediate: boolean }): void
  earningsMap: Map<string, EarningsCalendarEntry>
  getEarningsDateForTrade(trade: TradeRecord): EarningsCalendarEntry | null
  formatDate(d: string): string
}

function activeRowKey(trade: TradeRecord): string {
    return String(trade.id ?? `${trade.ticker || 'active'}-${trade.openedDate || ''}`)
        .replace(/[^a-zA-Z0-9_-]/g, '-');
}

function resolveActiveStrike(this: ActivePositionsContext, trade: TradeRecord): number | null {
    let resolvedStrike = this.parseDecimal(trade.activeStrikePrice, null, { allowNegative: false });

    if (resolvedStrike === null && Array.isArray(trade.legs) && (trade.legs as unknown[]).length > 0) {
        const strikeSummary = this.summarizeLegs(trade.legs as unknown[]);
        const summaryStrike = this.getActiveStrikeForDisplay(strikeSummary);
        if (Number.isFinite(summaryStrike)) {
            resolvedStrike = summaryStrike;
        }
    }

    if (resolvedStrike === null) {
        resolvedStrike = this.parseDecimal(trade.strikePrice, null, { allowNegative: false });
    }

    return Number.isFinite(resolvedStrike) ? resolvedStrike : null;
}

function buildEarningsBadge(
    this: ActivePositionsContext,
    entry: EarningsCalendarEntry,
    ticker?: string
): HTMLElement {
    const badge = document.createElement('span');
    badge.className = 'earnings-badge';

    // Small calendar icon
    const iconSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    iconSvg.setAttribute('width', '9');
    iconSvg.setAttribute('height', '9');
    iconSvg.setAttribute('viewBox', '0 0 24 24');
    iconSvg.setAttribute('fill', 'none');
    iconSvg.setAttribute('stroke', 'currentColor');
    iconSvg.setAttribute('stroke-width', '2.5');
    iconSvg.setAttribute('stroke-linecap', 'round');
    iconSvg.setAttribute('stroke-linejoin', 'round');
    iconSvg.setAttribute('aria-hidden', 'true');
    const rectEl = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rectEl.setAttribute('x', '3'); rectEl.setAttribute('y', '4');
    rectEl.setAttribute('width', '18'); rectEl.setAttribute('height', '18');
    rectEl.setAttribute('rx', '2');
    const l1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    l1.setAttribute('x1', '16'); l1.setAttribute('y1', '2'); l1.setAttribute('x2', '16'); l1.setAttribute('y2', '6');
    const l2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    l2.setAttribute('x1', '8'); l2.setAttribute('y1', '2'); l2.setAttribute('x2', '8'); l2.setAttribute('y2', '6');
    const l3 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    l3.setAttribute('x1', '3'); l3.setAttribute('y1', '10'); l3.setAttribute('x2', '21'); l3.setAttribute('y2', '10');
    iconSvg.appendChild(rectEl); iconSvg.appendChild(l1); iconSvg.appendChild(l2); iconSvg.appendChild(l3);

    const labelSpan = document.createElement('span');
    labelSpan.textContent = 'Earnings';

    badge.appendChild(iconSvg);
    badge.appendChild(labelSpan);

    // ── popup ──────────────────────────────────────────────────────────────
    const popup = document.createElement('div');
    popup.className = 'earnings-popup';
    popup.setAttribute('role', 'tooltip');

    // Header row: title + optional ticker
    const header = document.createElement('div');
    header.className = 'earnings-popup__header';
    const title = document.createElement('span');
    title.className = 'earnings-popup__title';
    title.textContent = 'Upcoming Earnings';
    header.appendChild(title);
    if (ticker) {
        const tickerPill = document.createElement('span');
        tickerPill.className = 'earnings-popup__ticker';
        tickerPill.textContent = ticker;
        header.appendChild(tickerPill);
    }
    popup.appendChild(header);

    // Date block — prominent
    const dateBlock = document.createElement('div');
    dateBlock.className = 'earnings-popup__date-block';
    const dateVal = document.createElement('span');
    dateVal.className = 'earnings-popup__date-value';
    dateVal.textContent = this.formatDate(entry.date);
    dateBlock.appendChild(dateVal);

    if (entry.hour) {
        const hourLabels: Record<string, string> = {
            bmo: '🌅 Before market open',
            amc: '🌆 After market close',
            dmh: '📈 During market hours',
        };
        const timeSpan = document.createElement('span');
        timeSpan.className = 'earnings-popup__date-sub';
        timeSpan.textContent = hourLabels[entry.hour] ?? entry.hour;
        dateBlock.appendChild(timeSpan);
    }
    popup.appendChild(dateBlock);

    // Details grid: period + EPS
    const hasDetails = (entry.quarter !== null && entry.year !== null) || entry.epsEstimate !== null;
    if (hasDetails) {
        const divider = document.createElement('div');
        divider.className = 'earnings-popup__divider';
        popup.appendChild(divider);

        const details = document.createElement('div');
        details.className = 'earnings-popup__details';

        if (entry.quarter !== null && entry.year !== null) {
            const periodRow = document.createElement('div');
            periodRow.className = 'earnings-popup__row';
            const periodLabel = document.createElement('span');
            periodLabel.className = 'earnings-popup__label';
            periodLabel.textContent = 'Period';
            const periodVal = document.createElement('span');
            periodVal.className = 'earnings-popup__value';
            periodVal.textContent = `Q${entry.quarter} ${entry.year}`;
            periodRow.appendChild(periodLabel);
            periodRow.appendChild(periodVal);
            details.appendChild(periodRow);
        }

        if (entry.epsEstimate !== null) {
            const epsRow = document.createElement('div');
            epsRow.className = 'earnings-popup__row';
            const epsLabel = document.createElement('span');
            epsLabel.className = 'earnings-popup__label';
            epsLabel.textContent = 'EPS Est.';
            const epsVal = document.createElement('span');
            epsVal.className = `earnings-popup__value ${entry.epsEstimate >= 0 ? 'earnings-popup__value--pos' : 'earnings-popup__value--neg'}`;
            epsVal.textContent = (entry.epsEstimate >= 0 ? '+' : '') + entry.epsEstimate.toFixed(2);
            epsRow.appendChild(epsLabel);
            epsRow.appendChild(epsVal);
            details.appendChild(epsRow);
        }

        popup.appendChild(details);
    }

    document.body.appendChild(popup);

    let hideTimer: ReturnType<typeof setTimeout> | null = null;

    const show = () => {
        if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }

        // Place off-screen with full CSS visibility so the browser resolves
        // `width: max-content` and gives us accurate offsetWidth/offsetHeight.
        popup.style.cssText = 'top:-9999px;left:-9999px;visibility:hidden;opacity:0;pointer-events:none;';
        popup.classList.add('is-visible');          // activate display-affecting styles
        void popup.offsetWidth;                     // force reflow

        const pw = popup.offsetWidth;
        const ph = popup.offsetHeight;

        // Reset inline styles, keep .is-visible for the transition
        popup.style.cssText = '';

        const r = badge.getBoundingClientRect();
        let top = r.top - ph - 8;
        let left = r.left;
        if (top < 8) top = r.bottom + 8;
        if (left + pw > window.innerWidth - 8) left = window.innerWidth - pw - 8;
        if (left < 8) left = 8;
        popup.style.top = `${top}px`;
        popup.style.left = `${left}px`;
    };

    const hide = () => {
        hideTimer = setTimeout(() => popup.classList.remove('is-visible'), 100);
    };

    badge.addEventListener('mouseenter', show);
    badge.addEventListener('mouseleave', hide);
    popup.addEventListener('mouseenter', () => { if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; } });
    popup.addEventListener('mouseleave', hide);

    return badge;
}

function createQuoteRenderer(
    this: ActivePositionsContext,
    quoteEntries: Map<string, Record<string, unknown>>,
    params: ICellRendererParams<TradeRecord>
): HTMLElement {
    const cell = document.createElement('div');
    cell.className = 'quote-cell';
    const trade = params.data;
    if (!trade) {
        cell.textContent = '—';
        return cell;
    }

    const rowProxy = document.createElement('div');
    const tickerValue = ((trade.ticker ?? '') as string).toString().trim().toUpperCase();
    const strike = resolveActiveStrike.call(this, trade);
    const dteValue = this.parseInteger(trade.dte, null, { allowNegative: false });

    rowProxy.dataset.ticker = tickerValue;
    if (Number.isFinite(strike)) {
        rowProxy.dataset.strikePrice = String(strike);
    }
    if (Number.isFinite(dteValue)) {
        rowProxy.dataset.dte = String(dteValue);
    }

    const baseQuoteKey = this.getQuoteEntryKey(trade);
    const quoteKey = `${baseQuoteKey}|row:${quoteEntries.size}`;
    rowProxy.dataset.quoteKey = quoteKey;
    this.populateQuoteCell(cell, trade, rowProxy, { deferNetworkFetch: true });
    quoteEntries.set(quoteKey, { trade, row: rowProxy, cell, key: quoteKey });
    return cell;
}

function buildActivePositionsColumnDefs(
    this: ActivePositionsContext,
    quoteEntries: Map<string, Record<string, unknown>>
): ColDef<TradeRecord>[] {
    return [
        {
            colId: 'ticker',
            field: 'ticker',
            headerName: 'Ticker',
            width: 120,
            pinned: 'left',
            cellRenderer: (params: ICellRendererParams<TradeRecord>) => {
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
            field: 'strategy',
            headerName: 'Strategy',
            minWidth: 180,
            flex: 1,
            valueFormatter: params => (params.value as string) || '—',
            filter: 'agTextColumnFilter'
        },
        {
            colId: 'strike',
            headerName: 'Strike',
            width: 110,
            valueGetter: params => params.data ? resolveActiveStrike.call(this, params.data) : null,
            valueFormatter: params => {
                const value = Number(params.value);
                return Number.isFinite(value)
                    ? (this.formatNumber(value, { style: 'currency', decimals: 2 }) ?? '—')
                    : '—';
            },
            filter: 'agNumberColumnFilter'
        },
        {
            colId: 'currentPrice',
            headerName: 'Current Price',
            width: 145,
            sortable: false,
            filter: false,
            cellRenderer: (params: ICellRendererParams<TradeRecord>) => createQuoteRenderer.call(this, quoteEntries, params)
        },
        {
            colId: 'dte',
            field: 'dte',
            headerName: 'DTE',
            width: 120,
            valueGetter: params => this.parseInteger(params.data?.dte, null, { allowNegative: false }),
            cellRenderer: (params: ICellRendererParams<TradeRecord>) => {
                const trade = params.data;
                const dteValue = this.parseInteger(trade?.dte, null, { allowNegative: false });

                const cell = document.createElement('div');
                cell.style.cssText = 'display:flex;align-items:center;gap:4px';

                const dteSpan = document.createElement('span');
                dteSpan.textContent = Number.isFinite(dteValue) ? String(dteValue) : '—';
                cell.appendChild(dteSpan);

                if (trade) {
                    if (params.eGridCell) {
                        this.updateExpirationHighlight(params.eGridCell, trade);
                    }
                    const entry = this.getEarningsDateForTrade(trade);
                    if (entry) {
                        const tickerStr = typeof trade.ticker === 'string' ? trade.ticker : undefined;
                        cell.appendChild(buildEarningsBadge.call(this, entry, tickerStr));
                    }
                }
                return cell;
            },
            cellClass: params => {
                const probe = document.createElement('span');
                if (params.data) {
                    this.updateExpirationHighlight(probe, params.data);
                }
                return Array.from(probe.classList).join(' ');
            },
            filter: 'agNumberColumnFilter'
        },
        {
            colId: 'maxRisk',
            field: 'maxRisk',
            headerName: 'Max Risk',
            width: 125,
            valueGetter: params => this.parseDecimal(params.data?.maxRisk, null, { allowNegative: false }),
            valueFormatter: params => Number.isFinite(params.value as number) ? this.formatCurrency(params.value) : '—',
            cellClass: params => Number.isFinite(params.value as number) ? 'pl-negative' : 'pl-neutral',
            filter: 'agNumberColumnFilter'
        },
        {
            colId: 'notes',
            field: 'notes',
            headerName: 'Notes',
            minWidth: 180,
            flex: 1,
            valueFormatter: params => ((params.value || '') as string).trim() || '—',
            cellClass: 'notes-cell',
            tooltipValueGetter: params => ((params.value || '') as string).trim()
        }
    ];
}

function createActivePositionsGridOptions(
    this: ActivePositionsContext,
    rows: TradeRecord[],
    quoteEntries: Map<string, Record<string, unknown>>
): GridOptions<TradeRecord> {
    const context = this;
    return {
        rowData: buildRowsWithDetail(rows, this.expandedTradeId),
        columnDefs: buildActivePositionsColumnDefs.call(this, quoteEntries),
        defaultColDef: {
            sortable: true,
            resizable: true,
            filter: true,
            minWidth: 90
        },
        rowClassRules: {
            'earnings-risk-row': (params: { data?: TradeRecord }) => {
                if ((params.data as TradeRecord & { _isDetailRow?: boolean })?._isDetailRow) return false;
                return !!this.getEarningsDateForTrade(params.data ?? {});
            }
        },
        getRowId: params => {
            const row = params.data as TradeRecord & { _isDetailRow?: boolean; _parentTrade?: TradeRecord };
            if (row._isDetailRow && row._parentTrade) {
                return `detail-${activeRowKey(row._parentTrade)}`;
            }
            return activeRowKey(params.data);
        },
        isFullWidthRow: params => !!(params.rowNode.data as TradeRecord & { _isDetailRow?: boolean })?._isDetailRow,
        fullWidthCellRenderer: createPositionDetailPanelRenderer(context),
        getRowHeight: params => {
            const row = params.node.data as TradeRecord & { _isDetailRow?: boolean };
            return row?._isDetailRow ? 800 : 46;
        },
        onRowClicked: params => {
            const row = params.data as TradeRecord & { _isDetailRow?: boolean };
            if (row?._isDetailRow) return;
            const tradeId = String(params.data?.id ?? '');
            if (!tradeId) return;
            context.expandedTradeId = context.expandedTradeId === tradeId ? null : tradeId;
            params.api.setGridOption('rowData', buildRowsWithDetail(context.activePositionsTrades, context.expandedTradeId));
        },
        domLayout: 'autoHeight',
        headerHeight: 44,
        rowBuffer: 10,
        animateRows: false,
        overlayNoRowsTemplate: '<span class="ag-overlay-no-rows-center">No active positions.</span>'
    };
}

export function updateActivePositionsTable(
    this: ActivePositionsContext,
    openTrades: TradeRecord[] = (this.trades as TradeRecord[]).filter(trade => {
        if ((trade as TradeRecord & { lifecycleStatus?: string }).lifecycleStatus === 'awaiting_coverage') {
            return false;
        }
        if (this.isActiveStatus(trade.status)) {
            if (this.isWheelOrPmccTrade(trade) || this.isAssignmentTrade(trade)) {
                return this.hasNonExpiredOpenShortOptions(trade);
            }
            return true;
        }
        if (this.isAssignmentTrade(trade) && this.isWheelOrPmccTrade(trade)) {
            return this.hasNonExpiredOpenShortOptions(trade);
        }
        return false;
    })
): void {
    const gridRoot = document.getElementById('active-positions-table') as HTMLElement | null;
    if (!gridRoot) {
        return;
    }

    const sortedTrades = [...(Array.isArray(openTrades) ? openTrades : [])].sort((a, b) => {
        const dteA = this.parseInteger(a.dte, Number.POSITIVE_INFINITY, { allowNegative: false }) ?? Number.POSITIVE_INFINITY;
        const dteB = this.parseInteger(b.dte, Number.POSITIVE_INFINITY, { allowNegative: false }) ?? Number.POSITIVE_INFINITY;
        return dteA - dteB;
    });

    this.expandedTradeId = null;
    this.activePositionsTrades = sortedTrades;

    const quoteEntries = new Map<string, Record<string, unknown>>();
    if (!this.activePositionsGridApi || this.activePositionsGridApi.isDestroyed()) {
        this.activePositionsGridApi = createGrid(
            gridRoot,
            createActivePositionsGridOptions.call(this, sortedTrades, quoteEntries)
        );
    } else {
        this.activePositionsGridApi.updateGridOptions({
            columnDefs: buildActivePositionsColumnDefs.call(this, quoteEntries),
            rowData: buildRowsWithDetail(sortedTrades, this.expandedTradeId)
        });
    }

    this.activeQuoteEntries = quoteEntries;
    this.rebuildQuoteRefreshSchedule();
    this.startQuoteAutoRefreshIfNeeded();
    this.refreshActivePositionsQuotes({ force: true, immediate: true });
}
