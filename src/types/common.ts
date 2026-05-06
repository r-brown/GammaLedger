/**
 * Primitive type aliases and magic-string enums shared across the codebase.
 * All financial values in GammaLedger are numbers — never strings.
 *
 * NOTE on `Percent`: the codebase uses two conventions.
 *   - 0-100 percent (e.g. winRate = 55 means 55%)   — used in Stats
 *   - 0-1 decimal  (e.g. roi = 0.15 means 15%)      — used in EnrichedTrade
 * The convention is noted per field in the relevant interfaces.
 */

/** ISO 8601 date string in "YYYY-MM-DD" format */
export type ISODate = string

/** Full ISO 8601 timestamp — result of Date.toISOString() */
export type ISOTimestamp = string

/** Dollar amount as a decimal number. 1.25 = $1.25 per share/contract. */
export type DollarAmount = number

/** Number of option contracts (1 contract = 100 shares by default) */
export type ContractCount = number

/** Number of shares */
export type ShareCount = number

/** Strike price in dollars */
export type StrikePrice = number

/** Option contract multiplier; 100 for standard equity options */
export type Multiplier = number

// ---------------------------------------------------------------------------
// Magic-string enums
// ---------------------------------------------------------------------------

/** Option leg type */
export type LegType = 'CALL' | 'PUT' | 'STOCK' | 'CASH'

/** Normalised order-type (open/close × long/short) */
export type OrderType = 'BTO' | 'STO' | 'BTC' | 'STC'

/** Raw legacy leg action field */
export type LegAction = 'BUY' | 'SELL'

/** Raw legacy leg side field */
export type LegSide = 'OPEN' | 'CLOSE' | 'ROLL'

/** Underlying asset category */
export type UnderlyingType = 'Stock' | 'ETF' | 'Index' | 'Future'

/**
 * Trade lifecycle status.
 * 'awaiting_coverage' is a runtime-only override applied in enrichTradeData
 * when a wheel trade has been assigned but the covered-call leg has not been opened.
 */
export type LifecycleStatus =
  | 'Open'
  | 'Closed'
  | 'Assigned'
  | 'Expired'
  | 'Rolling'
  | 'awaiting_coverage'

/**
 * Reason a position was closed.
 * Stored as free-text in legacy data; typed as string to allow the real
 * display strings used in determineTradeLifecycleStatus.
 */
export type ExitReason = string | null

/**
 * Wheel-coverage state for wheel/PMCC trades.
 * null = not a wheel/PMCC trade (or coverage cannot be determined).
 */
export type WheelCoverage = 'covered' | 'partial' | 'uncovered' | null

/** Source of a live market-price quote */
export type MarketPriceSource = 'finnhub' | 'manual' | null | undefined

/** Gemini model identifiers supported by the app */
export type GeminiModel =
  | 'gemini-2.5-flash-lite'
  | 'gemini-2.5-flash'
  | 'gemini-2.5-pro'

/** Cumulative P&L time range selector */
export type CumulativePLRange = '7D' | 'MTD' | '1M' | '3M' | 'YTD' | '1Y' | 'ALL'

/** Sort direction */
export type SortDirection = 'asc' | 'desc'

/** Toast notification severity */
export type ToastVariant = 'success' | 'error' | 'warning' | 'info'

/** Quote-fetch lifecycle state */
export type QuoteState = 'idle' | 'loading' | 'ready' | 'error'

/** AI chat participant */
export type AIRole = 'user' | 'assistant'

/** Assignment position type for stats */
export type AssignmentPositionType = 'wheel' | 'pmcc' | 'other'

