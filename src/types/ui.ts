import type { ISODate, DollarAmount, SortDirection, CumulativePLRange, LifecycleStatus, QuoteState } from './common'
import type { EnrichedTrade } from './trade'
import type { NormalizedLeg } from './leg'

// ---------------------------------------------------------------------------
// §13 — FilterState (trades list)
// ---------------------------------------------------------------------------

/**
 * Filter state for the main trades table.
 * There is no single FilterState object in the live code — values are read
 * from DOM controls on demand. This interface captures the logical shape.
 */
export interface FilterState {
  /** Substring match against trade.ticker. */
  tickerSearch: string

  /** Selected lifecycle statuses; 'all' means no status filter. */
  status: (LifecycleStatus | 'all')[]

  /** Selected strategy strings; 'all' means no strategy filter. */
  strategy: (string | 'all')[]

  /** Inclusive lower bound for trade date. null = no lower bound. */
  dateFrom: ISODate | null

  /** Inclusive upper bound for trade date. null = no upper bound. */
  dateTo: ISODate | null
}

// ---------------------------------------------------------------------------
// §14 — QuoteEntry
// Runtime Finnhub quote cache entry.
// ---------------------------------------------------------------------------

/**
 * Cache entry for a single trade's live market quote.
 * Lives in-memory in this.activeQuoteEntries (Map<string, QuoteEntry>).
 */
export interface QuoteEntry {
  /** Trade identifier — the Map key. */
  tradeId: string

  /** Underlying ticker symbol. */
  ticker: string

  /** Current fetch lifecycle state. */
  state: QuoteState

  /** Epoch ms of the last successful fetch; null before first fetch. */
  lastUpdated: number | null

  /** Latest mid price; null until a successful quote arrives. */
  price: DollarAmount | null

  /** Day change in dollars; null until a successful quote arrives. */
  change: DollarAmount | null

  /** Day change as a percent; null until a successful quote arrives. */
  changePercent: number | null

  /** Error message when state === 'error'. */
  error: string | null
}

// ---------------------------------------------------------------------------
// §16 — PositionHighlightConfig
// ---------------------------------------------------------------------------

/**
 * Configuration for the conditional row-highlight rules on the positions table.
 */
export interface PositionHighlightConfig {
  /** DTE threshold below which an expiration warning is shown. */
  expirationWarningDays: number

  /** Whether ITM highlighting is active. */
  itmHighlightEnabled: boolean

  /** Whether expiration-proximity highlighting is active. */
  expirationHighlightEnabled: boolean
}

// ---------------------------------------------------------------------------
// §17 — ShareCardState + ShareCardMetrics
// ---------------------------------------------------------------------------

/** Metrics displayed on the shareable performance card. */
export interface ShareCardMetrics {
  totalPL: DollarAmount
  /** Decimal 0-1 */
  totalROI: number
  /** Percent 0-100 */
  winRate: number
  /** Infinity for portfolios with no losing trades */
  profitFactor: number
  range: CumulativePLRange
}

/**
 * In-class struct for the share-card DOM references and state.
 * Lives as this.shareCard on GammaLedger.
 */
export interface ShareCardState {
  root: HTMLElement | null
  card: HTMLElement | null
  button: HTMLButtonElement | null
  chartCanvas: HTMLElement | null
  chartTitle: HTMLElement | null
  rangeLabel: HTMLElement | null
  /** ECharts instance; kept unknown to avoid coupling state docs to UI vendor types. */
  chart: unknown | null
  metrics: ShareCardMetrics
  /** ISO timestamp of the last export. null until first export. */
  timestamp: string | null
  /** Pixel size of the exported image (square). */
  exportSize: number
}

// ---------------------------------------------------------------------------
// §19 — CreditPlaybookEntry (partial; verify during conversion)
// ---------------------------------------------------------------------------

/**
 * One row in the credit-playbook table.
 * Shape approximate — verify against getCreditPlaybookEntries / mapCreditTradeToEntry
 * during the src/ui/credit-playbook/ conversion.
 */
export interface CreditPlaybookEntry {
  /** Leg-pair or trade identifier. */
  id: string

  /** Source trade identifier. */
  tradeId: string

  ticker: string
  strategy: string

  /** Resolved entry date from resolveCreditPlaybookOpenedAt. */
  openedAt: ISODate

  dte: number
  credit: DollarAmount
  width: number
  maxRisk: DollarAmount
  currentPrice: DollarAmount | null
  roi: number
  status: 'active' | 'closed'

  /** The leg pair driving this playbook entry. */
  legs: NormalizedLeg[]
}

// ---------------------------------------------------------------------------
// §24 — ToastOptions
// ---------------------------------------------------------------------------

import type { ToastVariant } from './common'

/**
 * Options passed to showNotification / the toast rendering function.
 */
export interface ToastOptions {
  message: string
  type: ToastVariant
  /** Duration in milliseconds before auto-dismiss. Defaults to ~3000. */
  durationMs?: number
}
