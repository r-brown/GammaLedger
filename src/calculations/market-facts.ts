// src/calculations/market-facts.ts — price, option-quote and target facts shared by every AI
// context and the watchlist target alert. Pure; G1 (always include fetched price/quotes) lives here.

export type PriceSource = 'schwab' | 'finnhub' | 'snapshot'

export interface ResolvedPrice {
  value: number
  source: PriceSource
}

export const WIDE_SPREAD_PCT = 10

const positive = (raw: unknown): number | null => {
  const n = Number(raw)
  return raw !== null && raw !== undefined && raw !== '' && Number.isFinite(n) && n > 0 ? n : null
}
const round = (value: number, places: number): number => {
  const f = 10 ** places
  return Math.round(value * f) / f
}

/** First usable price, live to stale: Schwab quote → Finnhub quote → the trade's stored snapshot. */
export function resolveTickerPrice(candidates: { schwab?: unknown; finnhub?: unknown; snapshot?: unknown }): ResolvedPrice | null {
  const order: Array<[PriceSource, unknown]> = [
    ['schwab', candidates.schwab],
    ['finnhub', candidates.finnhub],
    ['snapshot', candidates.snapshot]
  ]
  for (const [source, raw] of order) {
    const value = positive(raw)
    if (value !== null) return { value, source }
  }
  return null
}

/** Structural subset of SchwabTradeQuote. */
export interface TradeQuoteLike {
  netMark: number | null
  liquidationMark: number | null
  marketValue: number | null
  unrealizedPL: number | null
  legs: ReadonlyArray<{ bid: number | null; ask: number | null; quantity: number; multiplier: number }>
  capturedAt: string
  error?: string
}

export interface TradeQuoteFacts {
  mark: number
  liquidationMark: number | null
  /** App-computed dollars (opening cash flow + market value); the model must not recompute it. */
  unrealizedPL: number | null
  /** Total bid/ask width across the open legs, as % of the position's market value. */
  spreadPct: number | null
  quoteAgeMin: number | null
}

export function tradeQuoteFacts(quote: TradeQuoteLike | null | undefined, nowMs: number): TradeQuoteFacts | null {
  if (!quote || quote.error || quote.netMark === null || !Number.isFinite(quote.netMark)) return null
  const legs = quote.legs ?? []
  const allQuoted = legs.length > 0 && legs.every(leg => leg.bid !== null && leg.ask !== null)
  let spreadDollars: number | null = null
  if (allQuoted) {
    spreadDollars = 0
    for (const leg of legs) {
      spreadDollars += ((leg.ask ?? 0) - (leg.bid ?? 0)) * Math.abs(leg.quantity) * (leg.multiplier || 100)
    }
  }
  const value = quote.marketValue === null ? null : Math.abs(quote.marketValue)
  const spreadPct = spreadDollars !== null && value !== null && value > 0 ? round((spreadDollars / value) * 100, 1) : null
  const captured = Date.parse(quote.capturedAt)
  const quoteAgeMin = Number.isFinite(captured) ? Math.max(0, Math.round((nowMs - captured) / 60_000)) : null
  return {
    mark: round(quote.netMark, 2),
    liquidationMark: quote.liquidationMark === null ? null : round(quote.liquidationMark, 2),
    unrealizedPL: quote.unrealizedPL === null ? null : round(quote.unrealizedPL, 2),
    spreadPct,
    quoteAgeMin
  }
}

export interface TargetStatus {
  met: boolean
  crossedToday: boolean
  priceVsTargetPct: number | null
}

/** Watchlist target rule: "up" is met at price >= target, "down" at price <= target. */
export function targetStatus(
  price: number | null,
  previousClose: number | null,
  target: number | null | undefined,
  direction: 'up' | 'down' | undefined
): TargetStatus | null {
  if (price === null || !Number.isFinite(price) || target === null || target === undefined || !Number.isFinite(target)) return null
  const up = direction !== 'down'
  const met = up ? price >= target : price <= target
  const crossedToday = met && previousClose !== null && Number.isFinite(previousClose)
    && (up ? previousClose < target : previousClose > target)
  return { met, crossedToday, priceVsTargetPct: target !== 0 ? round(((price - target) / target) * 100, 1) : null }
}

export function daysBetweenIso(fromIso: string, toIso: string): number {
  const parse = (s: string) => Date.parse(`${s}T00:00:00Z`)
  return Math.round((parse(toIso) - parse(fromIso)) / 86_400_000)
}
