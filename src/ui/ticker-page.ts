// src/ui/ticker-page.ts — per-ticker drill-down: lifetime P&L, open-position
// payoff at expiration, cumulative realized curve, and the trade history.
// Uses the .call(this, …) delegation pattern; page state lives on the instance.

import { computeNetOpenLegs, filterUnexpired, type NetOpenLeg } from '@calculations/net-open-legs.js'
import { computePayoff } from '@calculations/payoff.js'
import { renderEChart } from './charts/echarts.js'
import { renderPayoffChart } from './charts/payoff.js'
import { tradeToNetLegInputs, resolveSpotForTrade, todayISO, type PortfolioGreeksContext } from './dashboard/portfolio-greeks.js'
import { createGrid, type ColDef, type GridApi } from './tables/ag-grid.js'
import type { Stats, TickerPLRow } from '@types-gl/stats'

type TradeRecord = Record<string, unknown>

export interface TickerPageState {
  ticker: string | null
  selectedTradeId: string
}

export interface TickerPageContext extends PortfolioGreeksContext {
  trades: TradeRecord[]
  charts: Record<string, unknown>
  latestStats: Stats | null
  tickerPage: TickerPageState
  tickerPageGridApi: GridApi<TradeRecord> | null
  finnhub: { apiKey: string }
  currentView: string
  calculateAdvancedStats(): Stats
  showView(viewName: string): void
  openTradesFilteredByTicker(ticker: unknown): void
  editTrade(id: unknown, trade?: TradeRecord): void
  getDisplayStatus(trade: TradeRecord): string
  getStrategyDisplayName(strategy: string): string
  calculateLegCashFlow(leg: Record<string, unknown>): number
  formatDate(value: unknown): string
  getCurrentPrice(ticker: string, opts?: Record<string, unknown>): Promise<unknown>
  hasAssignedInventory(trade: TradeRecord): boolean
}

function signedClass(value: number): string {
    if (value > 0) return 'rv-pos'
    if (value < 0) return 'rv-neg'
    return 'rv'
}

export function showTickerPage(this: TickerPageContext, ticker: unknown): void {
    const normalized = String(ticker ?? '').trim().toUpperCase()
    if (!normalized) return
    this.tickerPage.ticker = normalized
    this.tickerPage.selectedTradeId = 'all'
    this.showView('ticker-page')
}

function tickerTrades(this: TickerPageContext, ticker: string): TradeRecord[] {
    return this.trades.filter(trade => String(trade.ticker ?? '').toUpperCase() === ticker)
}

function openTrades(this: TickerPageContext, trades: TradeRecord[]): TradeRecord[] {
    return trades.filter((trade) => {
        const status = String(trade.status ?? '')
        return status === 'Open' || status === 'Rolling' || this.hasAssignedInventory(trade)
    })
}

function buildTile(label: string, value: string, valueClass = 'rv'): HTMLElement {
    const tile = document.createElement('div')
    tile.className = 'ticker-page__tile'
    const labelEl = document.createElement('span')
    labelEl.className = 'ticker-page__tile-label'
    labelEl.textContent = label
    const valueEl = document.createElement('span')
    valueEl.className = `ticker-page__tile-value ${valueClass}`
    valueEl.textContent = value
    tile.append(labelEl, valueEl)
    return tile
}

function renderPayoffSection(this: TickerPageContext, container: HTMLElement, open: TradeRecord[]): void {
    const section = document.createElement('section')
    section.className = 'card ticker-page__section'
    const heading = document.createElement('h3')
    heading.textContent = 'Payoff at expiration'
    section.appendChild(heading)

    const iso = todayISO(this.currentDate)
    const withLegs = open
        .map(trade => ({
            trade,
            netLegs: filterUnexpired(computeNetOpenLegs(tradeToNetLegInputs.call(this, trade)), iso)
        }))
        .filter(entry => entry.netLegs.length > 0)

    const showEmpty = (): void => {
        const empty = document.createElement('p')
        empty.className = 'chart-subtext'
        empty.textContent = 'No open legs to graph.'
        section.appendChild(empty)
        container.appendChild(section)
    }

    if (!withLegs.length) {
        showEmpty()
        return
    }

    // Selector: aggregate view + one chip per open trade.
    const selector = document.createElement('div')
    selector.className = 'chart-range'
    selector.setAttribute('role', 'group')
    selector.setAttribute('aria-label', 'Payoff scope')
    const options: Array<{ id: string; label: string }> = [
        { id: 'all', label: 'All open legs' },
        ...withLegs.map(entry => ({
            id: String(entry.trade.id ?? ''),
            label: `${this.getStrategyDisplayName(String(entry.trade.strategy ?? ''))} · ${String(entry.trade.expirationDate ?? '').slice(0, 10) || 'n/a'}`
        }))
    ]
    if (!options.some(option => option.id === this.tickerPage.selectedTradeId)) {
        this.tickerPage.selectedTradeId = 'all'
    }
    options.forEach((option) => {
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'chart-range__button'
        button.classList.toggle('is-active', option.id === this.tickerPage.selectedTradeId)
        button.textContent = option.label
        button.addEventListener('click', () => {
            this.tickerPage.selectedTradeId = option.id
            renderTickerPage.call(this)
        })
        selector.appendChild(button)
    })
    if (options.length > 2) section.appendChild(selector)

    const selected = this.tickerPage.selectedTradeId
    const selectedEntry = selected === 'all'
        ? null
        : withLegs.find(entry => String(entry.trade.id ?? '') === selected) ?? null
    const legs: NetOpenLeg[] = selectedEntry
        ? selectedEntry.netLegs
        : withLegs.flatMap(entry => entry.netLegs)
    const spot = resolveSpotForTrade.call(this, selectedEntry?.trade ?? withLegs[0].trade)
    const payoff = computePayoff(legs, { spot })

    if (!payoff) {
        showEmpty()
        return
    }

    const wrapper = document.createElement('div')
    wrapper.className = 'chart-responsive-wrapper chart-responsive-wrapper--medium'
    const chartRoot = document.createElement('div')
    chartRoot.id = 'ticker-payoff-chart'
    chartRoot.className = 'echarts-chart'
    chartRoot.setAttribute('role', 'img')
    chartRoot.setAttribute('aria-label', 'P&L at expiration')
    wrapper.appendChild(chartRoot)
    section.appendChild(wrapper)

    const summary = document.createElement('p')
    summary.className = 'chart-subtext'
    const maxProfitText = payoff.maxProfit === null ? 'unbounded' : this.formatCurrency(payoff.maxProfit)
    const maxLossText = payoff.maxLoss === null ? 'unbounded' : this.formatCurrency(payoff.maxLoss)
    const beText = payoff.breakevens.length ? payoff.breakevens.map(be => be.toFixed(2)).join(', ') : '—'
    const expirations = [...new Set(legs.map(leg => leg.expirationDate).filter(Boolean))]
    summary.textContent = `Max profit ${maxProfitText} · Max loss ${maxLossText} · Breakeven ${beText}`
        + (expirations.length > 1 ? ` · ⚠ mixes ${expirations.length} expirations — curve assumes all held to the last` : '')
    section.appendChild(summary)

    container.appendChild(section)

    // Chart root must be attached and laid out before ECharts init.
    requestAnimationFrame(() => {
        renderPayoffChart.call(this, 'ticker-payoff-chart', 'tickerPayoff', payoff, { spot })
    })
}

function renderCumulativeSection(this: TickerPageContext, container: HTMLElement, trades: TradeRecord[]): void {
    const closed = trades
        .filter(trade => trade.exitDate && Number.isFinite(Number(trade.pl)))
        .sort((a, b) => String(a.exitDate).localeCompare(String(b.exitDate)))
    if (closed.length < 2) return

    const section = document.createElement('section')
    section.className = 'card ticker-page__section'
    const heading = document.createElement('h3')
    heading.textContent = 'Cumulative realized P&L'
    section.appendChild(heading)
    const wrapper = document.createElement('div')
    wrapper.className = 'chart-responsive-wrapper chart-responsive-wrapper--short'
    const chartRoot = document.createElement('div')
    chartRoot.id = 'ticker-cumpl-chart'
    chartRoot.className = 'echarts-chart'
    chartRoot.setAttribute('role', 'img')
    chartRoot.setAttribute('aria-label', 'Cumulative realized P&L for this ticker')
    wrapper.appendChild(chartRoot)
    section.appendChild(wrapper)
    container.appendChild(section)

    let running = 0
    const data: Array<[string, number]> = closed.map((trade) => {
        running += Number(trade.pl) || 0
        return [String(trade.exitDate).slice(0, 10), Math.round(running * 100) / 100]
    })

    requestAnimationFrame(() => {
        const target = document.getElementById('ticker-cumpl-chart')
        if (!target) return
        this.charts.tickerCumulative = renderEChart(target, this.charts.tickerCumulative, {
            aria: { enabled: true },
            grid: { left: 64, right: 24, top: 16, bottom: 32 },
            tooltip: { trigger: 'axis', valueFormatter: (value: unknown) => this.formatCurrency(value) },
            xAxis: { type: 'category', data: data.map(d => d[0]) },
            yAxis: { type: 'value', axisLabel: { formatter: (value: number) => this.formatCurrency(value, { decimals: 0 }) } },
            series: [{ type: 'line', data: data.map(d => d[1]), showSymbol: false, areaStyle: { opacity: 0.1 } }]
        }, { notMerge: true })
    })
}

function renderTradesGrid(this: TickerPageContext, container: HTMLElement, trades: TradeRecord[]): void {
    const section = document.createElement('section')
    section.className = 'card ticker-page__section'
    const heading = document.createElement('h3')
    heading.textContent = `Trades (${trades.length})`
    section.appendChild(heading)
    const gridWrap = document.createElement('div')
    gridWrap.className = 'table-container dashboard-grid-container'
    const gridRoot = document.createElement('div')
    gridRoot.id = 'ticker-page-grid'
    gridRoot.className = 'dashboard-ag-grid ag-theme-quartz'
    gridRoot.setAttribute('aria-label', 'Trades for this ticker')
    gridWrap.appendChild(gridRoot)
    section.appendChild(gridWrap)
    container.appendChild(section)

    const columnDefs: ColDef<TradeRecord>[] = [
        {
            field: 'entryDate', headerName: 'Opened', sort: 'desc', sortable: true,
            valueFormatter: (params: { value?: unknown }) => params.value ? this.formatDate(params.value) : '—'
        },
        {
            field: 'strategy', headerName: 'Strategy', sortable: true,
            valueFormatter: (params: { value?: unknown }) => this.getStrategyDisplayName(String(params.value ?? ''))
        },
        {
            colId: 'status', headerName: 'Status', sortable: true,
            valueGetter: (params: { data?: TradeRecord }) => params.data ? this.getDisplayStatus(params.data) : ''
        },
        {
            field: 'dte', headerName: 'DTE', sortable: true, type: 'numericColumn', maxWidth: 90,
            valueFormatter: (params: { value?: unknown; data?: TradeRecord }) => {
                const status = params.data ? this.getDisplayStatus(params.data) : ''
                return status === 'Open' || status === 'Rolling' ? String(params.value ?? '—') : '—'
            }
        },
        {
            field: 'pl', headerName: 'P&L', sortable: true, type: 'numericColumn',
            cellRenderer: (params: { value?: unknown }) => {
                const value = Number(params.value) || 0
                const span = document.createElement('span')
                span.className = signedClass(value)
                span.textContent = this.formatCurrency(value)
                return span
            }
        },
        {
            colId: 'actions', headerName: '', maxWidth: 90, sortable: false,
            cellRenderer: (params: { data?: TradeRecord }) => {
                const button = document.createElement('button')
                button.type = 'button'
                button.className = 'btn btn--sm btn--secondary'
                button.textContent = 'Edit'
                button.addEventListener('click', () => {
                    if (params.data) this.editTrade(params.data.id, params.data)
                })
                return button
            }
        }
    ]

    // The grid root is recreated on every render — always build a fresh grid.
    if (this.tickerPageGridApi) {
        this.tickerPageGridApi.destroy()
        this.tickerPageGridApi = null
    }
    requestAnimationFrame(() => {
        this.tickerPageGridApi = createGrid<TradeRecord>(gridRoot, {
            columnDefs,
            rowData: trades,
            defaultColDef: { resizable: true, flex: 1, minWidth: 90 },
            domLayout: 'autoHeight'
        })
    })
}

export function renderTickerPage(this: TickerPageContext): void {
    const root = document.getElementById('ticker-page-root')
    const ticker = this.tickerPage.ticker
    if (!root || !ticker) return

    const trades = tickerTrades.call(this, ticker)
    const open = openTrades.call(this, trades)
    const stats = this.latestStats ?? this.calculateAdvancedStats()
    const row: TickerPLRow | undefined = (stats.tickerPL ?? []).find(r => r.ticker === ticker)

    root.textContent = ''

    // Header: ticker, live quote slot, actions.
    const header = document.createElement('div')
    header.className = 'ticker-page__header'
    const title = document.createElement('h2')
    title.className = 'ticker-page__ticker'
    title.textContent = ticker
    header.appendChild(title)
    const quote = document.createElement('span')
    quote.id = 'ticker-page-quote'
    quote.className = 'ticker-page__quote'
    const spot = resolveSpotForTrade.call(this, (open[0] ?? trades[0] ?? {}) as TradeRecord)
    quote.textContent = spot !== null ? this.formatCurrency(spot) : ''
    header.appendChild(quote)
    const allTradesBtn = document.createElement('button')
    allTradesBtn.type = 'button'
    allTradesBtn.className = 'btn btn--sm btn--secondary'
    allTradesBtn.textContent = 'View in All Trades'
    allTradesBtn.addEventListener('click', () => this.openTradesFilteredByTicker(ticker))
    header.appendChild(allTradesBtn)
    root.appendChild(header)

    if (!trades.length) {
        const empty = document.createElement('p')
        empty.className = 'chart-subtext'
        empty.textContent = 'No trades recorded for this ticker.'
        root.appendChild(empty)
        return
    }

    // Stat tiles from the reconciled tickerPL row.
    const tiles = document.createElement('div')
    tiles.className = 'ticker-page__tiles'
    if (row) {
        tiles.appendChild(buildTile('Realized P&L', this.formatCurrency(row.realizedPL), signedClass(row.realizedPL)))
        tiles.appendChild(buildTile('Unrealized', this.formatCurrency(row.unrealizedPL), signedClass(row.unrealizedPL)))
        tiles.appendChild(buildTile('Total P&L', this.formatCurrency(row.totalPL), signedClass(row.totalPL)))
        tiles.appendChild(buildTile('Capital at risk', this.formatCurrency(row.capitalAtRisk, { decimals: 0 })))
        tiles.appendChild(buildTile('Win rate', row.closedTrades > 0 ? `${row.winRate.toFixed(0)}% (${row.wins}W/${row.losses}L)` : '—'))
    }
    // Lifetime net option premium (credits minus debits across CALL/PUT legs).
    let premium = 0
    trades.forEach((trade) => {
        const legs = Array.isArray(trade.legs) ? trade.legs as Record<string, unknown>[] : []
        legs.forEach((leg) => {
            const type = String(leg.type ?? '').toUpperCase()
            if (type === 'CALL' || type === 'PUT') premium += this.calculateLegCashFlow(leg)
        })
    })
    tiles.appendChild(buildTile('Net option premium', this.formatCurrency(premium), signedClass(premium)))

    // Assigned inventory (wheel cost basis).
    const assigned = trades.filter(trade => this.hasAssignedInventory(trade))
    if (assigned.length) {
        const shares = assigned.reduce((sum, trade) => sum + (Number(trade.shares) || 0), 0)
        const basis = assigned.reduce((sum, trade) => sum + ((Number(trade.effectiveCostBasis) || 0) * (Number(trade.shares) || 0)), 0)
        if (shares > 0) {
            tiles.appendChild(buildTile('Assigned shares', String(shares)))
            tiles.appendChild(buildTile('Effective cost basis', this.formatCurrency(basis / shares)))
        }
    }
    root.appendChild(tiles)

    renderPayoffSection.call(this, root, open)
    renderCumulativeSection.call(this, root, trades)
    renderTradesGrid.call(this, root, trades)

    // Async live-quote refresh (best effort, only when a key exists).
    if (this.finnhub?.apiKey) {
        void this.getCurrentPrice(ticker, {}).then(() => {
            const el = document.getElementById('ticker-page-quote')
            if (!el || this.currentView !== 'ticker-page' || this.tickerPage.ticker !== ticker) return
            const fresh = resolveSpotForTrade.call(this, (open[0] ?? trades[0]) as TradeRecord)
            if (fresh !== null) el.textContent = this.formatCurrency(fresh)
        }).catch(() => { /* quote is decorative here */ })
    }
}
