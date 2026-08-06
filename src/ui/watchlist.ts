// src/ui/watchlist.ts — Watchlist view: followed tickers with user rating,
// notes, live quote/risk summary, and an expandable fundamentals panel.
// Uses the .call(this, …) delegation pattern; state lives on the instance.

import { showNotification } from './notifications.js'
import { createGrid, type ColDef, type GridApi, type GridOptions, type ICellRendererParams } from './tables/ag-grid.js'
import { type PositionDetailPanelContext } from './tables/position-detail-panel.js'
import { createTickerElement } from '@utils/dom'
import type { WatchlistEntry } from '../types/watchlist.js'
import type { EarningsCalendarEntry } from '../types/integrations.js'

type WatchlistRow = Record<string, unknown>

export interface WatchlistContext extends PositionDetailPanelContext {
  watchlist: WatchlistEntry[]
  watchlistGridApi: GridApi<WatchlistRow> | null
  expandedWatchlistTicker: string | null
  trades: Record<string, unknown>[]
  currentView: string
  currentDate: Date
  currentFileName: string | null
  earningsMap: Map<string, EarningsCalendarEntry>
  saveToStorage(metadata?: Record<string, unknown>): void
  markUnsavedChanges(): void
  showTickerPage(ticker: unknown): void
  openTradesFilteredByTicker(ticker: unknown): void
  getCurrentPrice(ticker: string, opts?: { forceRefresh?: boolean }): Promise<Record<string, unknown>>
  getQuoteChangePercent(quote: Record<string, unknown>): number | null
  fetchEarningsCalendar(tickers: string[], toDate: string): Promise<void>
}

const TICKER_PATTERN = /^[A-Z][A-Z0-9.\-]{0,9}$/

function persistWatchlist(this: WatchlistContext): void {
    this.markUnsavedChanges()
    this.saveToStorage()
}

export function addToWatchlist(this: WatchlistContext, ticker: unknown): void {
    const normalized = String(ticker ?? '').trim().toUpperCase()
    if (!TICKER_PATTERN.test(normalized)) {
        showNotification('Enter a valid ticker symbol (letters, digits, ".", "-").', 'error')
        return
    }
    if (this.watchlist.some(entry => entry.ticker === normalized)) {
        showNotification(`${normalized} is already on the watchlist.`, 'info')
        return
    }
    this.watchlist.push({
        ticker: normalized,
        rating: null,
        notes: '',
        addedDate: this.currentDate.toISOString().slice(0, 10)
    })
    persistWatchlist.call(this)
    renderWatchlistView.call(this)
}

export function removeFromWatchlist(this: WatchlistContext, ticker: unknown): void {
    const normalized = String(ticker ?? '').trim().toUpperCase()
    const index = this.watchlist.findIndex(entry => entry.ticker === normalized)
    if (index === -1) return
    const [removed] = this.watchlist.splice(index, 1)
    if (this.expandedWatchlistTicker === normalized) this.expandedWatchlistTicker = null
    persistWatchlist.call(this)
    renderWatchlistView.call(this)
    showNotification(`${normalized} removed from watchlist.`, 'info', {
        action: {
            label: 'Undo',
            onClick: () => {
                if (!this.watchlist.some(entry => entry.ticker === removed.ticker)) {
                    this.watchlist.splice(Math.min(index, this.watchlist.length), 0, removed)
                    persistWatchlist.call(this)
                    if (this.currentView === 'watchlist') renderWatchlistView.call(this)
                }
            }
        }
    })
}

export function updateWatchlistEntry(
    this: WatchlistContext,
    ticker: unknown,
    patch: Partial<Pick<WatchlistEntry, 'rating' | 'notes'>>
): void {
    const normalized = String(ticker ?? '').trim().toUpperCase()
    const entry = this.watchlist.find(candidate => candidate.ticker === normalized)
    if (!entry) return
    if (patch.rating !== undefined) entry.rating = patch.rating
    if (patch.notes !== undefined) entry.notes = patch.notes
    persistWatchlist.call(this)
}

export function renderWatchlistView(this: WatchlistContext): void {
    const root = document.getElementById('watchlist-root')
    if (!root) return
    root.textContent = ''

    // ── Top bar: add form + refresh ──────────────────────────────
    const bar = document.createElement('div')
    bar.className = 'watchlist-bar'
    const form = document.createElement('form')
    form.className = 'watchlist-add-form'
    const input = document.createElement('input')
    input.type = 'text'
    input.className = 'form-control watchlist-add-input'
    input.placeholder = 'Add ticker (e.g. NVDA)'
    input.setAttribute('aria-label', 'Ticker to add to watchlist')
    input.maxLength = 10
    const addBtn = document.createElement('button')
    addBtn.type = 'submit'
    addBtn.className = 'btn btn--primary btn--sm'
    addBtn.textContent = 'Add'
    form.append(input, addBtn)
    form.addEventListener('submit', (event) => {
        event.preventDefault()
        addToWatchlist.call(this, input.value)
        // A successful add re-renders `root` synchronously, replacing this
        // form/input with a fresh one — re-query the live input so both the
        // success and validation-failure paths clear/focus the right node.
        const liveInput = root.querySelector<HTMLInputElement>('.watchlist-add-input')
        if (liveInput) {
            liveInput.value = ''
            liveInput.focus()
        }
    })
    bar.appendChild(form)
    root.appendChild(bar)

    if (!this.watchlist.length) {
        const empty = document.createElement('p')
        empty.className = 'chart-subtext'
        empty.textContent = 'No tickers yet — add one above to start tracking it.'
        root.appendChild(empty)
        return
    }

    const gridWrap = document.createElement('div')
    gridWrap.className = 'table-container dashboard-grid-container'
    const gridRoot = document.createElement('div')
    gridRoot.id = 'watchlist-grid'
    gridRoot.className = 'dashboard-ag-grid ag-theme-quartz'
    gridRoot.setAttribute('aria-label', 'Watched tickers')
    gridWrap.appendChild(gridRoot)
    root.appendChild(gridWrap)

    if (this.watchlistGridApi) {
        this.watchlistGridApi.destroy()
        this.watchlistGridApi = null
    }
    // Grid content arrives in Task 4; for now render an empty grid so the
    // scaffold is testable end to end.
    requestAnimationFrame(() => {
        this.watchlistGridApi = createGrid<WatchlistRow>(gridRoot, buildGridOptions.call(this))
    })
}

function buildGridOptions(this: WatchlistContext): GridOptions<WatchlistRow> {
    return {
        rowData: this.watchlist.map(entry => ({ ...entry })),
        columnDefs: [{ field: 'ticker', headerName: 'Ticker' }],
        defaultColDef: { resizable: true, minWidth: 90 },
        domLayout: 'autoHeight',
        headerHeight: 44,
        animateRows: false
    }
}
