// src/ui/attention.ts — per-trade "needs attention" lookup: expirations,
// ITM short strikes, 21-DTE management points, take-profit candidates.
// Pure computation (no DOM) — consumed by the Active Positions table to
// drive the colored status dot + hover tooltip. Uses the .call(this, …)
// delegation pattern.

import { evaluateAttention, type AttentionInput, type AttentionItem } from '@calculations/attention.js'
import { computeNetOpenLegs, filterUnexpired } from '@calculations/net-open-legs.js'
import { resolveSpotForTrade, tradeToNetLegInputs, todayISO, type PortfolioGreeksContext } from './dashboard/portfolio-greeks.js'

export type { AttentionItem } from '@calculations/attention.js'

type TradeRecord = Record<string, unknown>

export interface AttentionMapContext extends PortfolioGreeksContext {
  inferOptionFlavor(trade: TradeRecord): 'call' | 'put' | null
  parseDecimal(value: unknown, fallback: unknown, opts?: Record<string, unknown>): number | null
}

function buildAttentionInputs(this: AttentionMapContext, trades: TradeRecord[]): AttentionInput[] {
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

/** Maps tradeId -> AttentionItem for every trade whose severity > 0. */
export function computeAttentionByTrade(this: AttentionMapContext, trades: TradeRecord[]): Map<string, AttentionItem> {
    const items = evaluateAttention(buildAttentionInputs.call(this, trades))
    return new Map(items.map(item => [item.tradeId, item]))
}
