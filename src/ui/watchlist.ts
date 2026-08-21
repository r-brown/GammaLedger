// src/ui/watchlist.ts — Watchlist view: followed tickers with user rating,
// notes, live quote/risk summary, and an expandable fundamentals panel.
// Uses the .call(this, …) delegation pattern; state lives on the instance.

import { showNotification } from './notifications.js'
import { createGrid, type ColDef, type GridApi, type GridOptions, type ICellRendererParams, type IRowNode } from './tables/ag-grid.js'
import { buildPanelSkeleton, computePreTradeRiskScore, triggerDataFetch, type PositionDetailPanelContext } from './tables/position-detail-panel.js'
import { createTickerElement } from '@utils/dom'
import type { WatchlistEntry } from '../types/watchlist.js'
import type { EarningsCalendarEntry, NormalizedQuote, StockMetrics } from '../types/integrations.js'

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
  dividendMap: Map<string, import('../types/integrations.js').DividendCalendarEntry>
  saveToStorage(metadata?: Record<string, unknown>): void
  markUnsavedChanges(): void
  showView(viewName: string): void
  openTradesFilteredByTicker(ticker: unknown): void
  getCurrentPrice(ticker: string, opts?: { forceRefresh?: boolean; scope?: string; priority?: number }): Promise<Record<string, unknown>>
  getQuoteChangePercent(quote: Record<string, unknown>): number | null
  fetchEarningsCalendar(tickers: string[], toDate: string): Promise<void>
  fetchDividendCalendar(from: string, to: string): Promise<import('../types/integrations.js').DividendCalendarEntry[]>
  isActiveStatus(status: unknown): boolean
  isWheelOrPmccTrade(trade: unknown): boolean
  isAssignmentTrade(trade: unknown): boolean
  hasNonExpiredOpenShortOptions(trade: unknown): boolean
}

const TICKER_PATTERN = /^[A-Z][A-Z0-9.\-]{0,9}$/

function persistWatchlist(this: WatchlistContext): void {
    this.markUnsavedChanges()
    this.saveToStorage()
}

export function addToWatchlist(this: WatchlistContext, tickerInput: unknown): void {
    const rawInput = String(tickerInput ?? '')
    const rawTickers = rawInput.split(/[\s,]+/).filter(Boolean)
    if (rawTickers.length === 0) return

    let addedCount = 0
    for (const rawTicker of rawTickers) {
        const normalized = rawTicker.trim().toUpperCase()
        if (!TICKER_PATTERN.test(normalized)) {
            showNotification(`Invalid ticker format: ${normalized}`, 'error')
            continue
        }
        if (this.watchlist.some(entry => entry.ticker === normalized)) {
            showNotification(`${normalized} is already on the watchlist.`, 'info')
            continue
        }
        this.watchlist.push({
            ticker: normalized,
            rating: null,
            notes: '',
            addedDate: this.currentDate.toISOString().slice(0, 10)
        })
        addedCount++
    }

    if (addedCount > 0) {
        persistWatchlist.call(this)
        renderWatchlistView.call(this)
    }
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
    patch: Partial<Pick<WatchlistEntry, 'rating' | 'notes' | 'tags' | 'targetPrice' | 'targetDirection'>>
): void {
    const normalized = String(ticker ?? '').trim().toUpperCase()
    const entry = this.watchlist.find(candidate => candidate.ticker === normalized)
    if (!entry) return
    if (patch.rating !== undefined) entry.rating = patch.rating
    if (patch.notes !== undefined) entry.notes = patch.notes
    if (patch.tags !== undefined) entry.tags = patch.tags
    if (patch.targetPrice !== undefined) entry.targetPrice = patch.targetPrice
    if (patch.targetDirection !== undefined) entry.targetDirection = patch.targetDirection
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
    input.placeholder = 'Enter ticker(s) (e.g. AAPL, MSFT)'
    input.setAttribute('aria-label', 'Tickers to add to watchlist')
    const addBtn = document.createElement('button')
    addBtn.type = 'submit'
    addBtn.className = 'btn btn--primary btn--sm'
    addBtn.innerHTML = '+ Add'
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
        const empty = document.createElement('div')
        empty.className = 'watchlist-empty-state'
        empty.innerHTML = `
            <div class="empty-icon">👀</div>
            <h3>Your Watchlist is empty</h3>
            <p class="chart-subtext">Add a ticker above to start tracking it.</p>
        `
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
        primeTargetAlertQuotes.call(this)
    })

    // fetchEarningsCalendar is a bare fetch with no rate-limit queue or cache (unlike
    // getCurrentPrice), and renderWatchlistView re-runs on every rating/add/delete/undo.
    // Only fetch when at least one watched ticker isn't already recorded in earningsMap,
    // so rapid re-renders don't fire an uncached Finnhub call per click. Note: a ticker
    // with no upcoming earnings never lands in earningsMap, so it will keep re-triggering
    // this check on every render — acceptable residual refetch, not worth extra tracking state.
    if (this.finnhub?.apiKey && this.watchlist.length) {
        const tickers = this.watchlist.map(entry => entry.ticker)
        
        // Earnings
        const hasMissingEarnings = tickers.some(ticker => !this.earningsMap.has(ticker))
        if (hasMissingEarnings) {
            const toDate = new Date(this.currentDate.getTime() + 90 * 86_400_000).toISOString().slice(0, 10)
            void this.fetchEarningsCalendar(tickers, toDate).then(() => {
                if (this.currentView !== 'watchlist') return
                this.watchlistGridApi?.refreshCells({ columns: ['earnings'], force: true })
            }).catch(() => { /* stay '—' */ })
        }

        // Dividends
        const hasMissingDividends = tickers.some(ticker => !this.dividendMap.has(ticker))
        if (hasMissingDividends) {
            const todayStr = this.currentDate.toISOString().slice(0, 10)
            const toDateStr = new Date(this.currentDate.getTime() + 90 * 86_400_000).toISOString().slice(0, 10)
            void this.fetchDividendCalendar(todayStr, toDateStr).then((events) => {
                let updated = false
                for (const event of events) {
                    if (!tickers.includes(event.symbol)) continue
                    const existing = this.dividendMap.get(event.symbol)
                    if (!existing || event.date < existing.date) {
                        this.dividendMap.set(event.symbol, event)
                        updated = true
                    }
                }
                // Pre-fill missing ones with a dummy to prevent endless fetching
                for (const ticker of tickers) {
                    if (!this.dividendMap.has(ticker)) {
                        this.dividendMap.set(ticker, { symbol: ticker, date: '9999-12-31' } as any)
                    }
                }
                if (updated && this.currentView === 'watchlist') {
                    this.watchlistGridApi?.refreshCells({ columns: ['dividends'], force: true })
                }
            }).catch(() => {})
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

// Grid rows and the expanded detail row's `_entry` are independent shallow
// copies (see buildWatchlistRows). An inline edit in the grid cell itself
// (e.g. double-clicking the Target column) only updates that row's own copy,
// so the detail row below it would keep showing the pre-edit value — reaching
// it needs a full rowData rebuild. When no panel is open, the far cheaper
// single-row sync is enough and avoids tearing down other rows. Deferred via
// setTimeout so this runs after AG Grid's own edit-commit cycle finishes,
// not from inside it.
function afterInlineEdit(context: WatchlistContext, ticker: string): void {
    setTimeout(() => {
        if (context.expandedWatchlistTicker === ticker) {
            context.watchlistGridApi?.setGridOption('rowData', buildWatchlistRows(context.watchlist, context.expandedWatchlistTicker))
        }
        syncSummaryRow(context, ticker)
    }, 0)
}

// ── Target-price alerts ──────────────────────────────────────────
// `finnhub.cache` stores `{ value, timestamp }` wrappers of a NormalizedQuote,
// so reaching into it directly and reading the raw Finnhub `.c`/`.pc` keys
// silently yields undefined. Always go through getCachedQuote — it unwraps the
// wrapper and honours the TTL.
function readCachedQuote(context: WatchlistContext, ticker: string): NormalizedQuote | null {
    if (!ticker) return null
    return context.getCachedQuote?.(ticker)?.value ?? null
}

interface TargetAlertState {
    /** Price currently sits at or beyond the target, in the configured direction. */
    met: boolean
    /** The move past the target happened during today's session. */
    crossedToday: boolean
}

const NO_TARGET_ALERT: TargetAlertState = { met: false, crossedToday: false }

/**
 * `met` drives the steady row tint: it stays on for as long as the price
 * remains beyond the target. `crossedToday` additionally animates the Target
 * cell on the day of the cross, so a fresh trigger reads differently from one
 * that has been true for a week.
 */
function evaluateTargetAlert(context: WatchlistContext, row: WatchlistRow | undefined): TargetAlertState {
    const targetPrice = Number(row?.targetPrice)
    if (row?.targetPrice == null || !Number.isFinite(targetPrice)) return NO_TARGET_ALERT

    const quote = readCachedQuote(context, String(row?.ticker ?? ''))
    const price = Number(quote?.price)
    if (!Number.isFinite(price)) return NO_TARGET_ALERT

    const direction = row?.targetDirection === 'down' ? 'down' : 'up'
    const met = direction === 'up' ? price >= targetPrice : price <= targetPrice
    if (!met) return NO_TARGET_ALERT

    const prevClose = Number(quote?.previousClose)
    const crossedToday = Number.isFinite(prevClose) && (
        direction === 'up' ? prevClose < targetPrice : prevClose > targetPrice
    )
    return { met, crossedToday }
}

/**
 * Quotes arrive asynchronously (see quoteCell), long after AG Grid has already
 * evaluated its row/cell class rules against an empty cache — without this the
 * highlight would never appear on a fresh load. Redraws summary rows only; the
 * expanded detail row is a full-width row whose renderer would be torn down and
 * rebuilt (losing focus and in-flight panel fetches) if it were redrawn too.
 */
function refreshTargetAlertRows(this: WatchlistContext): void {
    const api = this.watchlistGridApi
    if (!api) return
    const nodes: IRowNode<WatchlistRow>[] = []
    api.forEachNode(node => {
        if (!(node.data as { _isDetailRow?: boolean } | undefined)?._isDetailRow) nodes.push(node)
    })
    if (nodes.length) api.redrawRows({ rowNodes: nodes })
}

/**
 * Warms the quote cache for every watched ticker, then re-evaluates the alert
 * classes once the batch settles. quoteCell's own getCurrentPrice calls dedupe
 * against these through finnhub's outstandingRequests map, so this costs no
 * extra API requests.
 *
 * These are submitted under the `watchlist` scope rather than fired as a bare
 * Promise.allSettled burst: 20 watched tickers used to hit the API within
 * ~75 ms — a third of the free minute — and jumped ahead of whatever the
 * visible table still needed. The scheduler now paces them and drops them
 * outright if the user navigates away mid-flight.
 */
function primeTargetAlertQuotes(this: WatchlistContext): void {
    if (!this.finnhub?.apiKey || !this.watchlist.length) return
    if (this.currentView !== 'watchlist') return
    const tickers = this.watchlist.map(entry => entry.ticker)
    void Promise.allSettled(tickers.map(ticker => this.getCurrentPrice(ticker, {
        scope: 'watchlist',
        priority: 20
    }))).then(() => {
        if (this.currentView !== 'watchlist') return
        refreshTargetAlertRows.call(this)
    })
}

/**
 * Pushes an edited entry into its grid row without rebuilding rowData. A full
 * rowData swap makes AG Grid recreate the full-width detail row, which destroys
 * the panel's DOM mid-interaction — that is what used to swallow a click on the
 * direction toggle: the target input's blur fired first, the button was removed
 * between mousedown and mouseup, and the click never landed.
 */
function syncSummaryRow(context: WatchlistContext, ticker: string): void {
    const api = context.watchlistGridApi
    const entry = context.watchlist.find(candidate => candidate.ticker === ticker)
    const node = api?.getRowNode(ticker)
    if (!api || !entry || !node) return
    node.setData({ ...entry })
    // setData refreshes cell values but does not re-run rowClassRules.
    api.redrawRows({ rowNodes: [node] })
}

const RISK_EMOJI: Record<'green' | 'yellow' | 'red', string> = { green: '🟢', yellow: '🟡', red: '🔴' }

function quoteCell(this: WatchlistContext, ticker: string): HTMLElement {
    const cell = document.createElement('div')
    cell.className = 'quote-cell'
    cell.dataset.priceState = 'loading'
    cell.textContent = 'Loading…'
    if (!this.finnhub?.apiKey) {
        cell.dataset.priceState = 'idle'
        cell.textContent = '—'
        cell.title = 'Add a Finnhub API key in Settings to see live data'
        return cell
    }
    this.getCurrentPrice(ticker, { scope: 'watchlist', priority: 10 }).then((quote) => {
        if (!cell.isConnected) return
        const numeric = Number(quote?.price)
        if (!Number.isFinite(numeric)) {
            cell.dataset.priceState = 'ready'
            cell.textContent = '—'
            return
        }
        cell.dataset.priceState = 'ready'
        cell.innerHTML = ''
        const priceEl = document.createElement('span')
        priceEl.className = 'quote-price'
        priceEl.textContent = this.formatCurrency(numeric)
        
        cell.appendChild(priceEl)
        const pct = this.getQuoteChangePercent(quote)
        if (Number.isFinite(pct) && pct !== null) {
            const changeEl = document.createElement('span')
            changeEl.className = 'quote-change'
            const formattedPercent = `${pct > 0 ? '+' : ''}${pct.toFixed(2)}%`
            changeEl.textContent = formattedPercent
            if (pct > 0) changeEl.classList.add('is-up')
            else if (pct < 0) changeEl.classList.add('is-down')
            else changeEl.classList.add('is-flat')
            cell.appendChild(changeEl)
        }
    }).catch((error: unknown) => {
        if (!cell.isConnected) return
        // Cancelled by a view switch — leave the cell idle rather than showing
        // an error the user never triggered.
        const cancelled = (error as { name?: string } | null)?.name === 'GammaLedgerRequestCancelled'
        cell.dataset.priceState = cancelled ? 'idle' : 'error'
        cell.textContent = '—'
    })
    return cell
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
            
            const savedIndicator = document.createElement('span')
            savedIndicator.className = 'watchlist-notes-saved'
            savedIndicator.textContent = 'Saved'
            savedIndicator.style.opacity = '0'
            savedIndicator.style.transition = 'opacity 0.3s'
            savedIndicator.style.marginLeft = '8px'
            savedIndicator.style.fontSize = '12px'
            savedIndicator.style.color = 'var(--color-success, #059669)'
            
            const titleWrap = document.createElement('div')
            titleWrap.style.display = 'flex'
            titleWrap.style.alignItems = 'center'
            titleWrap.appendChild(title)
            titleWrap.appendChild(savedIndicator)
            
            header.appendChild(titleWrap)
            header.appendChild(renderStars.call(context, ticker, entry.rating))
            card.appendChild(header)

            const targetWrap = document.createElement('div')
            targetWrap.style.marginBottom = '8px'
            const targetLabel = document.createElement('label')
            targetLabel.textContent = 'Target: '
            targetLabel.style.fontSize = '13px'
            targetLabel.style.marginRight = '8px'
            targetLabel.style.color = 'var(--color-text-secondary)'
            
            const targetInput = document.createElement('input')
            targetInput.type = 'number'
            targetInput.step = '0.01'
            targetInput.className = 'form-control'
            targetInput.style.width = '120px'
            targetInput.style.display = 'inline-block'
            targetInput.value = entry.targetPrice != null ? String(entry.targetPrice) : ''
            targetInput.placeholder = 'e.g. 150.00'
            targetInput.addEventListener('blur', () => {
                const current = context.watchlist.find(candidate => candidate.ticker === ticker)
                const parsed = parseFloat(targetInput.value)
                const newVal = isNaN(parsed) ? null : parsed
                if (current && newVal !== (current.targetPrice ?? null)) {
                    updateWatchlistEntry.call(context, ticker, { targetPrice: newVal })
                    savedIndicator.style.opacity = '1'
                    setTimeout(() => { savedIndicator.style.opacity = '0' }, 2000)
                    syncSummaryRow(context, ticker)
                }
            })
            
            const targetDirectionBtn = document.createElement('button')
            targetDirectionBtn.type = 'button'
            targetDirectionBtn.className = 'btn btn--secondary btn--sm'
            targetDirectionBtn.style.marginLeft = '8px'
            targetDirectionBtn.style.padding = '2px 8px'
            targetDirectionBtn.style.fontSize = '1.2em'
            targetDirectionBtn.title = 'Toggle target direction (above or below)'
            
            // Read the direction back off the persisted entry on every click
            // rather than tracking it in a closure variable — an inline grid
            // edit or a re-render would otherwise leave the closure's copy
            // stale and make the first click a no-op.
            const readDirection = (): 'up' | 'down' => {
                const current = context.watchlist.find(candidate => candidate.ticker === ticker)
                return current?.targetDirection === 'down' ? 'down' : 'up'
            }
            const paintDirection = (direction: 'up' | 'down'): void => {
                targetDirectionBtn.textContent = direction === 'up' ? '🔼' : '🔽'
                targetDirectionBtn.setAttribute(
                    'aria-label',
                    direction === 'up' ? 'Alert when price rises to or above target' : 'Alert when price drops to or below target'
                )
            }
            paintDirection(readDirection())

            targetDirectionBtn.addEventListener('click', () => {
                const next: 'up' | 'down' = readDirection() === 'up' ? 'down' : 'up'
                paintDirection(next)
                updateWatchlistEntry.call(context, ticker, { targetDirection: next })
                savedIndicator.style.opacity = '1'
                setTimeout(() => { savedIndicator.style.opacity = '0' }, 2000)
                syncSummaryRow(context, ticker)
            })
            
            targetWrap.appendChild(targetLabel)
            targetWrap.appendChild(targetInput)
            targetWrap.appendChild(targetDirectionBtn)
            card.appendChild(targetWrap)

            const textarea = document.createElement('textarea')
            textarea.className = 'form-control watchlist-notes-input'
            textarea.rows = 3
            textarea.placeholder = 'Why are you watching this ticker?'
            textarea.value = entry.notes
            textarea.addEventListener('blur', () => {
                const current = context.watchlist.find(candidate => candidate.ticker === ticker)
                if (current && textarea.value !== current.notes) {
                    updateWatchlistEntry.call(context, ticker, { notes: textarea.value })

                    savedIndicator.style.opacity = '1'
                    setTimeout(() => { savedIndicator.style.opacity = '0' }, 2000)

                    // Row objects are copies, so refreshCells would re-read stale data.
                    syncSummaryRow(context, ticker)
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
            colId: 'ticker', field: 'ticker', headerName: 'Ticker', width: 110, pinned: 'left', sortable: true,
            cellRenderer: (params: ICellRendererParams<WatchlistRow>) =>
                createTickerElement(params.value, 'ticker-pill', {
                    behavior: 'filter',
                    onClick: (value: unknown) => context.openTradesFilteredByTicker(value),
                    title: `View all trades for ${String(params.value ?? '')}`
                })
        },
        {
            colId: 'quote', headerName: 'Current Price', width: 140, sortable: false,
            cellRenderer: (params: ICellRendererParams<WatchlistRow>) =>
                quoteCell.call(context, String(params.data?.ticker ?? ''))
        },
        {
            colId: 'targetPrice', field: 'targetPrice', headerName: 'Target', width: 100, sortable: true,
            editable: true,
            valueSetter: (params) => {
                if (params.data && params.newValue !== params.oldValue) {
                    const parsed = parseFloat(params.newValue)
                    const ticker = String(params.data.ticker)
                    updateWatchlistEntry.call(context, ticker, { targetPrice: isNaN(parsed) ? null : parsed })
                    afterInlineEdit(context, ticker)
                    return true
                }
                return false
            },
            // Used for CSV/clipboard export and the edit-cell tooltip — the
            // on-screen look (price + small direction icon) is handled by
            // cellRenderer below.
            valueFormatter: params => params.value != null ? context.formatCurrency(params.value) : '—',
            cellRenderer: (params: ICellRendererParams<WatchlistRow>) => {
                const wrap = document.createElement('span')
                wrap.className = 'watchlist-target-cell'
                if (params.value == null) {
                    wrap.textContent = '—'
                    return wrap
                }
                const priceEl = document.createElement('span')
                priceEl.textContent = context.formatCurrency(params.value)
                const isDown = (params.data as WatchlistRow)?.targetDirection === 'down'
                const dirEl = document.createElement('span')
                dirEl.className = `watchlist-target-dir ${isDown ? 'is-down' : 'is-up'}`
                dirEl.textContent = isDown ? '▼' : '▲'
                dirEl.setAttribute('aria-label', isDown ? 'Alert when price drops to or below target' : 'Alert when price rises to or above target')
                wrap.append(priceEl, dirEl)
                return wrap
            },
            cellClassRules: {
                // Animation is reserved for the day of the cross; the steady
                // "still beyond target" state is the row tint below, so a
                // long-standing target does not pulse forever.
                'target-alert-pulse': (params) => evaluateTargetAlert(context, params.data).crossedToday,
                'target-alert-met': (params) => evaluateTargetAlert(context, params.data).met
            }
        },
        {
            colId: 'rating', field: 'rating', headerName: 'Rating', width: 150, sortable: true,
            comparator: (a: unknown, b: unknown) => (Number(a) || 0) - (Number(b) || 0),
            cellRenderer: (params: ICellRendererParams<WatchlistRow>) =>
                renderStars.call(context, String(params.data?.ticker ?? ''), (params.data?.rating as number | null) ?? null)
        },
        {
            colId: 'notes', field: 'notes', headerName: 'Notes', flex: 1, minWidth: 160, sortable: false,
            editable: true,
            valueSetter: (params) => {
                if (params.data && params.newValue !== params.oldValue) {
                    const ticker = String(params.data.ticker)
                    updateWatchlistEntry.call(context, ticker, { notes: String(params.newValue ?? '') })
                    afterInlineEdit(context, ticker)
                    return true
                }
                return false
            },
            valueFormatter: params => String(params.value ?? '').trim(),
            tooltipValueGetter: params => String(params.value ?? '') || null
        },
        {
            colId: 'earnings', headerName: 'Earnings', width: 110, sortable: true,
            valueGetter: (params) => context.earningsMap.get(String((params.data as WatchlistRow)?.ticker ?? ''))?.date ?? null,
            valueFormatter: params => params.value ? context.formatDate(params.value) : '—'
        },
        {
            colId: 'dividends', headerName: 'Dividend', width: 110, sortable: true,
            valueGetter: (params) => {
                const d = context.dividendMap.get(String((params.data as WatchlistRow)?.ticker ?? ''))?.date
                return d === '9999-12-31' ? null : d ?? null
            },
            valueFormatter: params => params.value ? context.formatDate(params.value) : '—'
        },

        {
            colId: 'position', headerName: 'Position', width: 140, sortable: false,
            cellRenderer: (params: ICellRendererParams<WatchlistRow>) => {
                const ticker = String(params.data?.ticker ?? '')
                const matchingTrades = context.trades.filter(trade => String(trade.ticker ?? '').toUpperCase() === ticker)
                if (matchingTrades.length === 0) return document.createTextNode('')

                let hasActive = false
                let hasWheel = false

                for (const trade of matchingTrades) {
                    if (context.isWheelOrPmccTrade(trade) || context.isAssignmentTrade(trade)) {
                        hasWheel = true
                    }
                    if (context.isActiveStatus(trade.status)) {
                        if (context.isWheelOrPmccTrade(trade) || context.isAssignmentTrade(trade)) {
                            if (context.hasNonExpiredOpenShortOptions(trade)) hasActive = true
                        } else {
                            hasActive = true
                        }
                    }
                }

                const container = document.createElement('div')
                container.style.display = 'flex'
                container.style.gap = '6px'
                container.style.alignItems = 'center'
                container.style.height = '100%'

                if (!hasActive && !hasWheel) {
                    const badge = document.createElement('button')
                    badge.type = 'button'
                    badge.className = 'watchlist-position-badge is-closed'
                    badge.textContent = 'Closed'
                    badge.title = `View past trades for ${ticker}`
                    badge.addEventListener('click', (event) => {
                        event.stopPropagation()
                        context.openTradesFilteredByTicker(ticker)
                    })
                    container.appendChild(badge)
                    return container
                }

                if (hasActive) {
                    const badge = document.createElement('button')
                    badge.type = 'button'
                    badge.className = 'watchlist-position-badge is-active'
                    badge.textContent = 'Active'
                    badge.title = `View active trades for ${ticker}`
                    badge.addEventListener('click', (event) => {
                        event.stopPropagation()
                        context.openTradesFilteredByTicker(ticker)
                    })
                    container.appendChild(badge)
                }

                if (hasWheel) {
                    const badge = document.createElement('button')
                    badge.type = 'button'
                    badge.className = 'watchlist-position-badge is-wheel'
                    badge.textContent = 'Wheel'
                    badge.title = `View wheel trades for ${ticker}`
                    badge.addEventListener('click', (event) => {
                        event.stopPropagation()
                        context.openTradesFilteredByTicker(ticker)
                    })
                    container.appendChild(badge)
                }

                return container
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
        rowClassRules: {
            // Steady tint across the whole row for as long as the price sits
            // beyond the target, so a met target is scannable down the list.
            'watchlist-target-met': (params) => {
                const row = params.data as (WatchlistRow & { _isDetailRow?: boolean }) | undefined
                if (!row || row._isDetailRow) return false
                return evaluateTargetAlert(context, row).met
            }
        },
        getRowId: params => {
            const row = params.data as WatchlistRow & { _isDetailRow?: boolean; _entry?: WatchlistEntry }
            return row._isDetailRow ? `detail-${row._entry?.ticker ?? ''}` : String(row.ticker ?? '')
        },
        onRowClicked: params => {
            const row = params.data as WatchlistRow & { _isDetailRow?: boolean }
            if (row?._isDetailRow) return
            const ticker = String(row.ticker ?? '')
            if (!ticker) return
            context.expandedWatchlistTicker = context.expandedWatchlistTicker === ticker ? null : ticker
            params.api.setGridOption('rowData', buildWatchlistRows(context.watchlist, context.expandedWatchlistTicker))
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
