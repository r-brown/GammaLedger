// src/ui/tables/recent-trades.ts — Wave 9: Recent trades table rendering.
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

type TradeRecord = Record<string, unknown>

interface RecentTradesContext extends PositionDetailPanelContext {
  trades: TradeRecord[]
  recentTradesGridApi?: GridApi<TradeRecord> | null
  recentClosedTrades: TradeRecord[]
  expandedRecentTradeId: string | null
  isClosedStatus(status: unknown): boolean
  isActiveStatus(status: unknown): boolean
  formatDate(value: unknown): string
  formatCurrency(value: unknown, opts?: Record<string, unknown>): string
  formatPercent(value: unknown, fallback: string, opts?: Record<string, unknown>): string
  createTickerElement(ticker: unknown, className?: string, opts?: Record<string, unknown>): HTMLElement
  openTradesFilteredByTicker(ticker: unknown): void
  applyResponsiveLabels(row: HTMLTableRowElement, labels: string[]): void
}

function safeNumber(value: unknown): number | null {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
}

function rowKey(trade: TradeRecord, fallback = 'recent'): string {
    return String(trade.id ?? `${trade.ticker || fallback}-${trade.closedDate || ''}`)
        .replace(/[^a-zA-Z0-9_-]/g, '-');
}

function signedClass(value: number | null): string {
    return value !== null
        ? (value > 0 ? 'pl-positive' : value < 0 ? 'pl-negative' : 'pl-neutral')
        : 'pl-neutral';
}

function buildRecentTradesColumnDefs(this: RecentTradesContext): ColDef<TradeRecord>[] {
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
            colId: 'closedDate',
            field: 'closedDate',
            headerName: 'Exit Date',
            width: 120,
            valueFormatter: params => this.formatDate(params.value),
            filter: 'agDateColumnFilter'
        },
        {
            colId: 'daysHeld',
            field: 'daysHeld',
            headerName: 'Days Held',
            width: 110,
            valueGetter: params => safeNumber(params.data?.daysHeld),
            valueFormatter: params => {
                const value = safeNumber(params.value);
                return value !== null ? String(value) : '—';
            },
            filter: 'agNumberColumnFilter'
        },
        {
            colId: 'pl',
            field: 'pl',
            headerName: 'P&L',
            width: 120,
            valueGetter: params => safeNumber(params.data?.pl),
            valueFormatter: params => {
                const value = safeNumber(params.value);
                return value !== null ? this.formatCurrency(value) : '—';
            },
            cellClass: params => signedClass(safeNumber(params.value)),
            filter: 'agNumberColumnFilter'
        },
        {
            colId: 'roi',
            field: 'roi',
            headerName: 'ROI',
            width: 100,
            valueGetter: params => safeNumber(params.data?.roi),
            valueFormatter: params => {
                const value = safeNumber(params.value);
                return value !== null ? this.formatPercent(value, '—') : '—';
            },
            cellClass: params => signedClass(safeNumber(params.value)),
            filter: 'agNumberColumnFilter'
        },
        {
            colId: 'weeklyROI',
            field: 'weeklyROI',
            headerName: 'Weekly ROI',
            width: 120,
            valueGetter: params => safeNumber(params.data?.weeklyROI),
            valueFormatter: params => {
                const value = safeNumber(params.value);
                return value !== null ? this.formatPercent(value, '—') : '—';
            },
            cellClass: params => signedClass(safeNumber(params.value)),
            filter: 'agNumberColumnFilter'
        }
    ];
}

function createRecentTradesGridOptions(this: RecentTradesContext, rows: TradeRecord[]): GridOptions<TradeRecord> {
    const context = this;
    return {
        rowData: buildRowsWithDetail(rows, this.expandedRecentTradeId),
        columnDefs: buildRecentTradesColumnDefs.call(this),
        defaultColDef: {
            sortable: true,
            resizable: true,
            filter: true,
            minWidth: 90
        },
        getRowId: params => {
            const row = params.data as TradeRecord & { _isDetailRow?: boolean; _parentTrade?: TradeRecord };
            if (row._isDetailRow && row._parentTrade) {
                return `detail-${rowKey(row._parentTrade)}`;
            }
            return rowKey(params.data);
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
            context.expandedRecentTradeId = context.expandedRecentTradeId === tradeId ? null : tradeId;
            params.api.setGridOption('rowData', buildRowsWithDetail(context.recentClosedTrades, context.expandedRecentTradeId));
        },
        domLayout: 'autoHeight',
        headerHeight: 44,
        rowBuffer: 10,
        animateRows: false,
        overlayNoRowsTemplate: '<span class="ag-overlay-no-rows-center">No closed trades yet.</span>'
    };
}

export function updateRecentTradesTable(
    this: RecentTradesContext,
    closedTrades: TradeRecord[] = (this.trades as TradeRecord[]).filter(trade => this.isClosedStatus(trade.status)),
    activeCount: number = (this.trades as TradeRecord[]).filter(trade => this.isActiveStatus(trade.status)).length
): void {
    const normalizedActiveCount = Number(activeCount);
    const desiredRowCount = Math.max(Number.isFinite(normalizedActiveCount) ? normalizedActiveCount : 0, 10);

    const recentTrades = [...(Array.isArray(closedTrades) ? closedTrades : [])]
        .sort((a, b) => {
            const aTime = new Date(((a.closedDate || a.openedDate) as string) || '').getTime();
            const bTime = new Date(((b.closedDate || b.openedDate) as string) || '').getTime();
            return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
        })
        .slice(0, desiredRowCount);

    const gridRoot = document.getElementById('recent-trades-table') as HTMLElement | null;
    if (!gridRoot) {
        return;
    }

    this.expandedRecentTradeId = null;
    this.recentClosedTrades = recentTrades;

    if (!this.recentTradesGridApi || this.recentTradesGridApi.isDestroyed()) {
        this.recentTradesGridApi = createGrid(gridRoot, createRecentTradesGridOptions.call(this, recentTrades));
    } else {
        this.recentTradesGridApi.updateGridOptions({ rowData: buildRowsWithDetail(recentTrades, null) });
    }
}
