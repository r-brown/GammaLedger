// src/ui/dashboard/needs-attention.ts — the morning checklist: expirations,
// ITM short strikes, 21-DTE management points, take-profit candidates.
// Uses the .call(this, …) delegation pattern.

import { evaluateAttention, type AttentionInput } from '@calculations/attention.js'
import { computeNetOpenLegs, filterUnexpired } from '@calculations/net-open-legs.js'
import { resolveSpotForTrade, tradeToNetLegInputs, todayISO, type GreeksStripContext } from './greeks-strip.js'
import type { Stats } from '@types-gl/stats'

type TradeRecord = Record<string, unknown>

export interface NeedsAttentionContext extends GreeksStripContext {
  inferOptionFlavor(trade: TradeRecord): 'call' | 'put' | null
  parseDecimal(value: unknown, fallback: unknown, opts?: Record<string, unknown>): number | null
  showTickerPage(ticker: unknown): void
  createTickerElement(ticker: unknown, className?: string, opts?: Record<string, unknown>): HTMLElement
  getStrategyDisplayName(strategy: string): string
}

const SEVERITY_CLASS: Record<number, string> = {
    3: 'needs-attention__item--critical',
    2: 'needs-attention__item--warning',
    1: 'needs-attention__item--notice'
}

function buildInputs(this: NeedsAttentionContext, trades: TradeRecord[]): AttentionInput[] {
    const iso = todayISO(this.currentDate)
    return trades.map((trade) => {
        const netLegs = filterUnexpired(computeNetOpenLegs(tradeToNetLegInputs.call(this, trade)), iso)
        const hasShortOptions = netLegs.some(leg => leg.type !== 'STOCK' && leg.netQuantity < 0)
        const dteRaw = Number(trade.dte)
        const strike = this.parseDecimal(trade.activeStrikePrice ?? trade.strikePrice, null, { allowNegative: false })
        const cashFlow = Number(trade.cashFlow)
        const unrealized = Number(trade.unrealizedPL)
        return {
            tradeId: String(trade.id ?? ''),
            ticker: String(trade.ticker ?? ''),
            strategy: String(trade.strategy ?? ''),
            dte: Number.isFinite(dteRaw) ? dteRaw : null,
            shortStrike: hasShortOptions && Number.isFinite(strike as number) ? (strike as number) : null,
            flavor: this.inferOptionFlavor(trade),
            spot: resolveSpotForTrade.call(this, trade),
            isShortPremium: hasShortOptions,
            netCredit: Number.isFinite(cashFlow) && cashFlow > 0 ? cashFlow : null,
            unrealizedPL: Number.isFinite(unrealized) ? unrealized : null
        }
    })
}

export function renderNeedsAttention(this: NeedsAttentionContext, stats: Stats): void {
    const root = document.getElementById('needs-attention')
    if (!root) return

    const openTrades = (stats.openTradesList ?? []) as unknown as TradeRecord[]
    if (!openTrades.length) {
        root.classList.add('hidden')
        return
    }

    const items = evaluateAttention(buildInputs.call(this, openTrades))
    root.classList.remove('hidden')
    root.textContent = ''

    const heading = document.createElement('h3')
    heading.className = 'needs-attention__title'
    heading.textContent = '⚡ Needs attention today'
    root.appendChild(heading)

    if (!items.length) {
        const clear = document.createElement('p')
        clear.className = 'needs-attention__clear'
        clear.textContent = '✓ Nothing needs attention — all open positions are inside their limits.'
        root.appendChild(clear)
        return
    }

    const list = document.createElement('ul')
    list.className = 'needs-attention__list'
    const tradeById = new Map(openTrades.map(trade => [String(trade.id ?? ''), trade]))

    items.forEach((item) => {
        const row = document.createElement('li')
        row.className = `needs-attention__item ${SEVERITY_CLASS[item.severity]}`

        const dot = document.createElement('span')
        dot.className = 'needs-attention__dot'
        dot.setAttribute('aria-hidden', 'true')
        row.appendChild(dot)

        row.appendChild(this.createTickerElement(item.ticker, 'ticker-pill', {
            behavior: 'filter',
            onClick: (value: unknown) => this.showTickerPage(value),
            title: `Open ${item.ticker} ticker page`
        }))

        const strategy = document.createElement('span')
        strategy.className = 'needs-attention__strategy'
        strategy.textContent = this.getStrategyDisplayName(item.strategy)
        row.appendChild(strategy)

        const reasons = document.createElement('span')
        reasons.className = 'needs-attention__reasons'
        reasons.textContent = item.reasons.join(' · ')
        row.appendChild(reasons)

        const review = document.createElement('button')
        review.type = 'button'
        review.className = 'btn btn--sm btn--secondary needs-attention__action'
        review.textContent = 'Review'
        review.addEventListener('click', () => {
            const trade = tradeById.get(item.tradeId)
            this.showTickerPage(trade?.ticker ?? item.ticker)
        })
        row.appendChild(review)

        list.appendChild(row)
    })

    root.appendChild(list)
}
