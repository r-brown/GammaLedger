// src/ui/tables/ticker-pl-table.ts — per-ticker P&L grid.
// Uses the .call(this, …) delegation pattern.
//
// The pinned TOTAL row is summed from the rows the grid actually shows, so it
// ties to stats.realizedPL / unrealizedPL / collateralAtRisk whenever the rows
// are unscoped (see the reconciliation contract in @calculations/ticker-pl).

import { createGrid, type ColDef, type GridApi } from './ag-grid.js'
import { rangeLabelFor } from './ticker-pl-range.js'
import type { Stats, TickerPLRow } from '@types-gl/stats'

interface TickerPLTableContext {
  tickerPLGridApi?: GridApi<TickerPLRow> | null
  cumulativePLRange: string
  formatCurrency(value: unknown, opts?: Record<string, unknown>): string
  createTickerElement(ticker: unknown, className?: string, opts?: Record<string, unknown>): HTMLElement
  openTradesFilteredByTicker(ticker: unknown): void
}

function signedClass(value: number): string {
    if (value > 0) return 'rv-pos'
    if (value < 0) return 'rv-neg'
    return 'rv'
}

/** The pinned TOTAL row. Aggregate-only fields (RoC, win rate) stay blank —
 *  averaging them across tickers would invent a number nothing reconciles to. */
function buildTotalRow(rows: TickerPLRow[]): TickerPLRow {
    const total: TickerPLRow = {
        ticker: 'TOTAL',
        closedPL: 0,
        openRealizedPL: 0,
        realizedPL: 0,
        unrealizedPL: 0,
        totalPL: 0,
        capitalAtRisk: 0,
        capitalDeployed: 0,
        returnOnCapital: null,
        closedTrades: 0,
        openPositions: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        markedPositions: 0,
        unmarkedPositions: 0,
    }

    for (const row of rows) {
        total.closedPL += row.closedPL
        total.openRealizedPL += row.openRealizedPL
        total.realizedPL += row.realizedPL
        total.unrealizedPL += row.unrealizedPL
        total.totalPL += row.totalPL
        total.capitalAtRisk += row.capitalAtRisk
        total.capitalDeployed += row.capitalDeployed
        total.closedTrades += row.closedTrades
        total.openPositions += row.openPositions
        total.wins += row.wins
        total.losses += row.losses
        total.markedPositions += row.markedPositions
        total.unmarkedPositions += row.unmarkedPositions
    }

    total.winRate = total.closedTrades > 0 ? (total.wins / total.closedTrades) * 100 : 0
    total.returnOnCapital = total.capitalDeployed > 0
        ? total.totalPL / total.capitalDeployed
        : null

    return total
}

export function renderTickerPLTable(this: TickerPLTableContext, stats: Stats): void {
    const root = document.getElementById('ticker-pl-table')
    if (!root) return

    const rows: TickerPLRow[] = stats.tickerPL ?? []
    const money = (value: unknown, decimals = 2) => this.formatCurrency(value, { decimals })

    const currencyCell = (params: { value?: unknown }) => {
        const value = Number(params.value) || 0
        const span = document.createElement('span')
        span.className = signedClass(value)
        span.textContent = money(value)
        return span
    }

    // Unrealized carries a per-row coverage warning: an unquoted short option
    // is valued at full credit (best case), which overstates the row.
    const unrealizedCell = (params: { value?: unknown; data?: TickerPLRow }) => {
        const span = currencyCell(params)
        const unmarked = params.data?.unmarkedPositions ?? 0
        if (unmarked > 0) {
            const dot = document.createElement('span')
            dot.className = 'chip chip-warn'
            dot.textContent = ' ⚠'
            dot.title = `${unmarked} position(s) have no live quote and are valued at raw cashflow — open short options count at full credit, which may overstate this row.`
            span.appendChild(dot)
        }
        return span
    }

    const columnDefs: ColDef<TickerPLRow>[] = [
        {
            field: 'ticker',
            headerName: 'Ticker',
            pinned: 'left',
            width: 110,
            cellRenderer: (params: { value?: unknown; data?: TickerPLRow }) => {
                if (!params.data || params.data.ticker === 'TOTAL') {
                    const strong = document.createElement('strong')
                    strong.textContent = 'TOTAL'
                    return strong
                }
                return this.createTickerElement(params.value, 'ticker-pill', {
                    behavior: 'filter',
                    onClick: (value: unknown) => this.openTradesFilteredByTicker(value),
                    title: `View all trades for ${String(params.value)}`,
                })
            },
        },
        {
            field: 'realizedPL',
            headerName: `Realized${rangeLabelFor(this.cumulativePLRange)}`,
            headerTooltip: 'Realized P&L attributed at leg level — a contract group counts on the date it terminated, not the date its trade was closed.',
            cellRenderer: currencyCell, sortable: true, type: 'numericColumn',
        },
        {
            field: 'unrealizedPL',
            headerName: 'Unrealized (now)',
            headerTooltip: 'Always the current mark, whatever range is selected — GammaLedger stores no historical position marks.',
            cellRenderer: unrealizedCell, sortable: true, type: 'numericColumn',
        },
        { field: 'totalPL', headerName: 'Total', cellRenderer: currencyCell, sort: 'desc', sortable: true, type: 'numericColumn' },
        {
            field: 'capitalAtRisk', headerName: 'Capital', sortable: true, type: 'numericColumn',
            headerTooltip: 'Capital still committed by OPEN positions — $0 once a ticker is fully closed. This is not the RoC denominator; RoC divides by capital deployed across open and closed trades alike.',
            valueFormatter: (params: { value?: unknown }) => money(params.value, 0),
        },
        {
            field: 'returnOnCapital', headerName: 'RoC', sortable: true, type: 'numericColumn',
            headerTooltip: 'Simple return on capital deployed across this ticker’s open and closed trades. Not annualized — distinct from the Total ROI in Trade Quality, which is capital-days-weighted and annualized.',
            valueFormatter: (params: { value?: unknown }) =>
                params.value === null || params.value === undefined
                    ? '—'
                    : `${(Number(params.value) * 100).toFixed(1)}%`,
        },
        {
            colId: 'trades', headerName: 'Trades', sortable: true, type: 'numericColumn',
            valueGetter: (params: { data?: TickerPLRow }) =>
                (params.data?.closedTrades ?? 0) + (params.data?.openPositions ?? 0),
        },
        {
            field: 'winRate', headerName: 'Win %', sortable: true, type: 'numericColumn',
            valueFormatter: (params: { value?: unknown; data?: TickerPLRow }) =>
                (params.data?.closedTrades ?? 0) === 0 ? '—' : `${Number(params.value).toFixed(0)}%`,
        },
    ]

    const total = buildTotalRow(rows)

    if (this.tickerPLGridApi) {
        // columnDefs must be re-applied: the Realized header carries the active
        // range, which changes without the grid being rebuilt.
        this.tickerPLGridApi.setGridOption('columnDefs', columnDefs)
        this.tickerPLGridApi.setGridOption('rowData', rows)
        this.tickerPLGridApi.setGridOption('pinnedBottomRowData', [total])
        return
    }

    this.tickerPLGridApi = createGrid<TickerPLRow>(root, {
        columnDefs,
        rowData: rows,
        pinnedBottomRowData: [total],
        defaultColDef: { resizable: true, sortable: true, flex: 1, minWidth: 90 },
        domLayout: 'autoHeight',
    })
}
