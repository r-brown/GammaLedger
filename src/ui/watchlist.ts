// src/ui/watchlist.ts — Watchlist view: followed tickers with user rating,
// notes, live quote/risk summary, and an expandable fundamentals panel.
// Uses the .call(this, …) delegation pattern; state lives on the instance.

import { showNotification } from './notifications.js'
import { createGrid, type ColDef, type GridApi, type GridOptions, type ICellRendererParams } from './tables/ag-grid.js'
import { buildPanelSkeleton, computePreTradeRiskScore, triggerDataFetch, type PositionDetailPanelContext } from './tables/position-detail-panel.js'
import { createTickerElement } from '@utils/dom'
import type { WatchlistEntry } from '../types/watchlist.js'
import type { EarningsCalendarEntry, StockMetrics } from '../types/integrations.js'

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

    const refreshBtn = document.createElement('button')
    refreshBtn.type = 'button'
    refreshBtn.className = 'btn btn--secondary btn--sm'
    refreshBtn.textContent = '⟳ Refresh'
    refreshBtn.addEventListener('click', () => {
        this.watchlist.forEach(entry => this.finnhub?.cache?.delete?.(entry.ticker))
        renderWatchlistView.call(this)
    })
    bar.appendChild(refreshBtn)

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
    requestAnimationFrame(() => {
        this.watchlistGridApi = createGrid<WatchlistRow>(gridRoot, buildGridOptions.call(this))
    })

    // fetchEarningsCalendar is a bare fetch with no rate-limit queue or cache (unlike
    // getCurrentPrice), and renderWatchlistView re-runs on every rating/add/delete/undo.
    // Only fetch when at least one watched ticker isn't already recorded in earningsMap,
    // so rapid re-renders don't fire an uncached Finnhub call per click. Note: a ticker
    // with no upcoming earnings never lands in earningsMap, so it will keep re-triggering
    // this check on every render — acceptable residual refetch, not worth extra tracking state.
    if (this.finnhub?.apiKey && this.watchlist.length) {
        const tickers = this.watchlist.map(entry => entry.ticker)
        const hasMissingTicker = tickers.some(ticker => !this.earningsMap.has(ticker))
        if (hasMissingTicker) {
            const toDate = new Date(this.currentDate.getTime() + 90 * 86_400_000).toISOString().slice(0, 10)
            void this.fetchEarningsCalendar(tickers, toDate).then(() => {
                if (this.currentView !== 'watchlist') return
                this.watchlistGridApi?.refreshCells({ columns: ['earnings'], force: true })
            }).catch(() => { /* earnings column stays '—' */ })
        }
    }
}

export function renderStars(this: WatchlistContext, ticker: string, rating: number | null): HTMLElement {
    const wrap = document.createElement('div')
    wrap.className = 'watchlist-stars'
    wrap.setAttribute('role', 'radiogroup')
    wrap.setAttribute('aria-label', `Rating for ${ticker}`)
    for (let value = 1; value <= 5; value++) {
        const star = document.createElement('button')
        star.type = 'button'
        star.className = 'watchlist-star'
        star.classList.toggle('is-active', rating !== null && value <= rating)
        star.textContent = rating !== null && value <= rating ? '★' : '☆'
        star.setAttribute('aria-label', `${value} star${value > 1 ? 's' : ''}`)
        star.addEventListener('click', (event) => {
            event.stopPropagation()
            // Clicking the current rating clears it.
            const next = rating === value ? null : value
            updateWatchlistEntry.call(this, ticker, { rating: next })
            renderWatchlistView.call(this)
        })
        wrap.appendChild(star)
    }
    return wrap
}

function buildWatchlistRows(entries: WatchlistEntry[], expandedTicker: string | null): WatchlistRow[] {
    const rows: WatchlistRow[] = []
    for (const entry of entries) {
        rows.push({ ...entry })
        if (expandedTicker === entry.ticker) {
            rows.push({ _isDetailRow: true, _entry: { ...entry } })
        }
    }
    return rows
}

const RISK_EMOJI: Record<'green' | 'yellow' | 'red', string> = { green: '🟢', yellow: '🟡', red: '🔴' }

function quoteCell(this: WatchlistContext, ticker: string, mode: 'price' | 'changePct'): HTMLElement {
    const span = document.createElement('span')
    span.textContent = '…'
    if (!this.finnhub?.apiKey) {
        span.textContent = '—'
        span.title = 'Add a Finnhub API key in Settings to see live data'
        return span
    }
    this.getCurrentPrice(ticker).then((quote) => {
        if (!span.isConnected) return
        if (mode === 'price') {
            const price = Number(quote?.price)
            span.textContent = Number.isFinite(price) ? this.formatCurrency(price) : '—'
        } else {
            const pct = this.getQuoteChangePercent(quote)
            if (pct === null) { span.textContent = '—'; return }
            span.textContent = `${pct > 0 ? '+' : ''}${pct.toFixed(2)}%`
            span.className = pct > 0 ? 'rv-pos' : pct < 0 ? 'rv-neg' : ''
        }
    }).catch(() => { if (span.isConnected) span.textContent = '—' })
    return span
}

function riskCell(this: WatchlistContext, ticker: string): HTMLElement {
    const span = document.createElement('span')
    span.className = 'watchlist-risk'
    span.textContent = '…'
    if (!this.finnhub?.apiKey) { span.textContent = '—'; return span }
    const apply = (metrics: StockMetrics): void => {
        if (!span.isConnected) return
        const { grade, detail } = computePreTradeRiskScore(metrics)
        span.textContent = RISK_EMOJI[grade]
        span.title = detail
    }
    const cached = this.metricsCache.get(ticker)
    if (cached && cached !== 'loading' && cached !== 'error') {
        apply(cached)
    } else if (cached === 'loading') {
        this.metricsPromiseMap.get(ticker)?.then(data => { if (data) apply(data) })
    } else {
        this.metricsCache.set(ticker, 'loading')
        const promise = this.fetchStockMetrics(ticker)
        this.metricsPromiseMap.set(ticker, promise)
        promise.then((data) => {
            this.metricsPromiseMap.delete(ticker)
            this.metricsCache.set(ticker, data ?? 'error')
            if (data) apply(data)
            else if (span.isConnected) span.textContent = '—'
        })
    }
    return span
}

function createWatchlistDetailRenderer(context: WatchlistContext) {
    return class {
        private container!: HTMLElement
        private ro: ResizeObserver | null = null

        init(params: { node: { data: WatchlistRow; setRowHeight(h: number): void }; api: { onRowHeightChanged(): void } }) {
            const entry = params.node.data._entry as WatchlistEntry
            const ticker = entry.ticker

            this.container = document.createElement('div')
            this.container.className = 'watchlist-detail'

            // ── My notes & rating ────────────────────────────────
            const card = document.createElement('div')
            card.className = 'pdp-card watchlist-notes-card'
            const header = document.createElement('div')
            header.className = 'watchlist-notes-header'
            const title = document.createElement('span')
            title.textContent = 'My notes & rating'
            header.appendChild(title)
            header.appendChild(renderStars.call(context, ticker, entry.rating))
            card.appendChild(header)
            const textarea = document.createElement('textarea')
            textarea.className = 'form-control watchlist-notes-input'
            textarea.rows = 3
            textarea.placeholder = 'Why are you watching this ticker?'
            textarea.value = entry.notes
            textarea.addEventListener('blur', () => {
                const current = context.watchlist.find(candidate => candidate.ticker === ticker)
                if (current && textarea.value !== current.notes) {
                    updateWatchlistEntry.call(context, ticker, { notes: textarea.value })
                    // Row objects are copies, so refreshCells would re-read stale data —
                    // rebuild rowData instead. Safe here: blur means focus already left.
                    context.watchlistGridApi?.setGridOption('rowData', buildWatchlistRows(context.watchlist, context.expandedWatchlistTicker))
                }
            })
            card.appendChild(textarea)
            if (entry.addedDate) {
                const added = document.createElement('div')
                added.className = 'watchlist-notes-added'
                added.textContent = `Watching since ${context.formatDate(entry.addedDate)}`
                card.appendChild(added)
            }
            this.container.appendChild(card)

            // ── Fundamentals / signals / news (existing panel) ───
            const panel = buildPanelSkeleton(ticker, { threeCol: true })
            this.container.appendChild(panel)
            triggerDataFetch(context, ticker, panel, null, true)

            this.ro = new ResizeObserver((entries) => {
                const height = entries[0]?.contentRect.height ?? this.container.offsetHeight
                if (height > 0) {
                    params.node.setRowHeight(Math.ceil(height))
                    params.api.onRowHeightChanged()
                }
            })
            this.ro.observe(this.container)
        }

        getGui(): HTMLElement { return this.container }
        destroy(): void { this.ro?.disconnect() }
    }
}

function buildGridOptions(this: WatchlistContext): GridOptions<WatchlistRow> {
    const context = this
    const columnDefs: ColDef<WatchlistRow>[] = [
        {
            colId: 'expand', headerName: '', width: 44, maxWidth: 44, sortable: false, resizable: false,
            cellRenderer: (params: ICellRendererParams<WatchlistRow>) => {
                const ticker = String(params.data?.ticker ?? '')
                const button = document.createElement('button')
                button.type = 'button'
                button.className = 'watchlist-expand-btn'
                const expanded = context.expandedWatchlistTicker === ticker
                button.textContent = expanded ? '▾' : '▸'
                button.setAttribute('aria-label', expanded ? `Collapse ${ticker} details` : `Expand ${ticker} details`)
                button.setAttribute('aria-expanded', String(expanded))
                button.addEventListener('click', (event) => {
                    event.stopPropagation()
                    context.expandedWatchlistTicker = expanded ? null : ticker
                    params.api.setGridOption('rowData', buildWatchlistRows(context.watchlist, context.expandedWatchlistTicker))
                })
                return button
            }
        },
        {
            colId: 'ticker', field: 'ticker', headerName: 'Ticker', width: 110, pinned: 'left', sortable: true,
            cellRenderer: (params: ICellRendererParams<WatchlistRow>) =>
                createTickerElement(params.value, 'ticker-pill', {
                    behavior: 'filter',
                    onClick: (value: unknown) => context.showTickerPage(value),
                    title: `Open ${String(params.value ?? '')} ticker page`
                })
        },
        {
            colId: 'quote', headerName: 'Quote', width: 110, sortable: false,
            cellRenderer: (params: ICellRendererParams<WatchlistRow>) =>
                quoteCell.call(context, String(params.data?.ticker ?? ''), 'price')
        },
        {
            colId: 'dayPct', headerName: 'Day %', width: 100, sortable: false,
            cellRenderer: (params: ICellRendererParams<WatchlistRow>) =>
                quoteCell.call(context, String(params.data?.ticker ?? ''), 'changePct')
        },
        {
            colId: 'risk', headerName: 'Risk', width: 90, sortable: false,
            cellRenderer: (params: ICellRendererParams<WatchlistRow>) =>
                riskCell.call(context, String(params.data?.ticker ?? ''))
        },
        {
            colId: 'rating', field: 'rating', headerName: 'Rating', width: 150, sortable: true,
            comparator: (a: unknown, b: unknown) => (Number(a) || 0) - (Number(b) || 0),
            cellRenderer: (params: ICellRendererParams<WatchlistRow>) =>
                renderStars.call(context, String(params.data?.ticker ?? ''), (params.data?.rating as number | null) ?? null)
        },
        {
            colId: 'notes', field: 'notes', headerName: 'Notes', flex: 1, minWidth: 160, sortable: false,
            valueFormatter: params => {
                const notes = String(params.value ?? '').trim()
                if (!notes) return ''
                return notes.length > 80 ? `${notes.slice(0, 80)}…` : notes
            },
            tooltipValueGetter: params => String(params.value ?? '') || null
        },
        {
            colId: 'earnings', headerName: 'Earnings', width: 110, sortable: false,
            valueGetter: (params) => context.earningsMap.get(String((params.data as WatchlistRow)?.ticker ?? ''))?.date ?? null,
            valueFormatter: params => params.value ? context.formatDate(params.value) : '—'
        },
        {
            colId: 'position', headerName: 'Position', width: 110, sortable: false,
            cellRenderer: (params: ICellRendererParams<WatchlistRow>) => {
                const ticker = String(params.data?.ticker ?? '')
                const hasTrades = context.trades.some(trade => String(trade.ticker ?? '').toUpperCase() === ticker)
                if (!hasTrades) return document.createTextNode('')
                const badge = document.createElement('button')
                badge.type = 'button'
                badge.className = 'watchlist-position-badge'
                badge.textContent = 'Held'
                badge.title = `View trades for ${ticker}`
                badge.addEventListener('click', (event) => {
                    event.stopPropagation()
                    context.openTradesFilteredByTicker(ticker)
                })
                return badge
            }
        },
        {
            colId: 'delete', headerName: '', width: 60, maxWidth: 60, sortable: false, resizable: false,
            cellRenderer: (params: ICellRendererParams<WatchlistRow>) => {
                const ticker = String(params.data?.ticker ?? '')
                const button = document.createElement('button')
                button.type = 'button'
                button.className = 'watchlist-delete-btn'
                button.textContent = '✕'
                button.setAttribute('aria-label', `Remove ${ticker} from watchlist`)
                button.addEventListener('click', (event) => {
                    event.stopPropagation()
                    removeFromWatchlist.call(context, ticker)
                })
                return button
            }
        }
    ]

    return {
        rowData: buildWatchlistRows(this.watchlist, this.expandedWatchlistTicker),
        columnDefs,
        defaultColDef: { resizable: true, minWidth: 60 },
        getRowId: params => {
            const row = params.data as WatchlistRow & { _isDetailRow?: boolean; _entry?: WatchlistEntry }
            return row._isDetailRow ? `detail-${row._entry?.ticker ?? ''}` : String(row.ticker ?? '')
        },
        domLayout: 'autoHeight',
        headerHeight: 44,
        animateRows: false,
        isFullWidthRow: params => !!(params.rowNode.data as WatchlistRow & { _isDetailRow?: boolean })?._isDetailRow,
        fullWidthCellRenderer: createWatchlistDetailRenderer(context),
        getRowHeight: params => {
            const row = params.node.data as WatchlistRow & { _isDetailRow?: boolean }
            return row?._isDetailRow ? 800 : 46
        },
        overlayNoRowsTemplate: '<span class="ag-overlay-no-rows-center">No tickers on the watchlist.</span>'
    }
}
