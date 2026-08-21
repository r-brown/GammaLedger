import type { DollarAmount, GeminiModel, ToastVariant } from './common'
import type { RequestScheduler } from '../integrations/request-scheduler'

export interface SchwabVaultPayload {
  clientId: string
  clientSecret: string
  callbackUrl: string
  accessToken?: string
  refreshToken?: string
  accessTokenExpiresAt?: number
  refreshTokenExpiresAt?: number
}

export interface SchwabOptionQuote {
  symbol: string
  bid: number | null
  ask: number | null
  last: number | null
  mark: number | null
  midpoint: number | null
  multiplier: number
  providerTimestamp: string | null
  capturedAt: string
}

export interface SchwabTradeQuote {
  tradeId: string
  ticker: string
  netMark: number | null
  liquidationMark: number | null
  marketValue: number | null
  openingCashFlow: number
  unrealizedPL: number | null
  legs: Array<SchwabOptionQuote & { legId: string; side: 'long' | 'short'; quantity: number }>
  capturedAt: string
  error?: string
}

export interface SchwabState {
  vault: SchwabVaultPayload | null
  encryptionKey: CryptoKey | null
  automaticRefresh: boolean
  quoteCache: Map<string, { price: number; capturedAt: string; providerTimestamp: string | null }>
  optionQuoteCache: Map<string, SchwabOptionQuote>
  tradeQuoteCache: Map<string, SchwabTradeQuote>
  timerId: ReturnType<typeof setInterval> | null
  refreshPromise: Promise<void> | null
  elements: Record<string, HTMLElement>
}

// ---------------------------------------------------------------------------
// §15 — FinnhubState / GeminiState / StatusMessage
// In-class struct fields on GammaLedger.
// ---------------------------------------------------------------------------

/**
 * Live quote from the Finnhub /quote endpoint.
 * Field names are the raw Finnhub API keys.
 */
export interface FinnhubQuote {
  /** Current price */
  c: number
  /** Day high */
  h: number
  /** Day low */
  l: number
  /** Open price */
  o: number
  /** Previous close */
  pc: number
  /** Timestamp (epoch seconds) */
  t: number
}

/**
 * A quote after `performFinnhubFetch` normalizes the raw `FinnhubQuote` keys
 * into readable names. This — not `FinnhubQuote` — is what every consumer of
 * the quote cache actually receives, so read `price`/`previousClose`, never
 * `c`/`pc`.
 */
export interface NormalizedQuote {
  symbol: string
  /** Current price (raw `c`). */
  price: number
  change: number | null
  changePercent: number | null
  /** Previous close (raw `pc`). */
  previousClose: number
  open: number
  high: number
  low: number
  /** ISO timestamp of the fetch. */
  fetchedAt: string
  currency: string
}

/**
 * What `setCachedQuote` actually stores: the quote wrapped alongside its fetch
 * time for TTL expiry. Reaching into `finnhub.cache` directly means unwrapping
 * `.value` yourself — prefer `getCachedQuote()`, which also honours the TTL.
 */
export interface CachedQuoteEntry {
  value: NormalizedQuote
  timestamp: number
}

/** Transient status message shown on the Finnhub / Gemini adapters. */
export interface StatusMessage {
  message: string
  variant: ToastVariant
  /** If set, the message is auto-cleared after this many milliseconds. */
  autoClearMs?: number
}

/**
 * Finnhub adapter state (this.finnhub on GammaLedger).
 */
export interface FinnhubState {
  apiKey: string | null
  encryptionKey: CryptoKey | null

  /** Quote cache keyed by ticker symbol. Values are TTL-stamped wrappers. */
  cache: Map<string, CachedQuoteEntry>

  /** Cache TTL in milliseconds. */
  cacheTTL: number

  /** In-flight requests keyed by request key. */
  outstandingRequests: Map<string, Promise<NormalizedQuote>>

  /**
   * Shared request governor for every outbound Finnhub call: priority queue,
   * sliding-window rate limiter, bounded concurrency, per-request abort
   * deadline, and scope cancellation. Created lazily by getRequestScheduler().
   */
  scheduler: RequestScheduler | null

  /** Maximum requests allowed per minute. */
  maxRequestsPerMinute: number

  /** Request timestamps (epoch ms) used for rate-limit sliding window. */
  timestamps: number[]

  /** Timeout ID for auto-clearing the status badge. null when idle. */
  statusTimeoutId: number | null

  /** Most recently shown status message. null when no status. */
  lastStatus: StatusMessage | null

  /**
   * Cached DOM element references for the Finnhub UI.
   * Keyed by logical name.
   */
  elements: Record<string, HTMLElement>
}

/**
 * Gemini adapter state (this.gemini on GammaLedger).
 */
export interface GeminiState {
  apiKey: string | null
  encryptionKey: CryptoKey | null
  model: GeminiModel
  maxOutputTokens: number

  /** Timeout ID for auto-clearing the status badge. null when idle. */
  statusTimeoutId: number | null

  /** Most recently shown status message. */
  lastStatus: StatusMessage | null

  /** Status queued to show after the current one clears. */
  pendingStatus: StatusMessage | null

  /** Cached DOM element references for the Gemini UI. */
  elements: Record<string, HTMLElement>
}

// ---------------------------------------------------------------------------
// Finnhub enrichment types
// ---------------------------------------------------------------------------

/** One entry from GET /calendar/earnings */
export interface EarningsEvent {
  /** ISO date "YYYY-MM-DD" */
  date: string
  /** Company ticker symbol (e.g., "SPY") */
  ticker: string
  epsEstimate: number | null
  epsActual: number | null
}

/** Parsed subset of GET /stock/metric?metric=all relevant to options traders */
export interface StockMetrics {
  // ── Price context ──────────────────────────────────────────
  currentPrice: number | null
  beta: number | null
  marketCap: number | null
  vol3MonthStd: number | null
  return5Day: number | null
  /** 13-week price return, in percent. */
  return13Week: number | null
  return52Week: number | null
  week52High: number | null
  week52Low: number | null
  week52HighDate: string | null
  week52LowDate: string | null
  /** 10-day average daily trading volume (thousands of shares). */
  vol10DayAvg: number | null
  /** 3-month average daily trading volume (thousands of shares). */
  vol3MonthAvg: number | null
  /** Price return relative to S&P 500 over 13 weeks, in percent. */
  priceRelToSP500_13W: number | null

  // ── Valuation ─────────────────────────────────────────────
  peTTM: number | null
  forwardPE: number | null
  /** Forward PEG ratio (forward PE / expected EPS growth). Near 1.0 = fair value. */
  forwardPEG: number | null
  pfcfTTM: number | null
  evFCF: number | null
  /** EV / EBITDA (TTM). */
  evEbitda: number | null

  // ── Quality (margins, all in percent) ─────────────────────
  grossMarginTTM: number | null
  operatingMarginTTM: number | null
  netMarginTTM: number | null
  fcfMarginLatest: number | null
  /** Return on equity, TTM, in percent. */
  roeTTM: number | null

  // ── Growth (in percent) ───────────────────────────────────
  revenueGrowthYoY: number | null
  epsGrowthYoY: number | null

  // ── Balance sheet ─────────────────────────────────────────
  currentRatio: number | null
  netDebtToEquity: number | null
  /** Total debt / total equity (annual). */
  debtToEquity: number | null
  /** Net interest coverage ratio (annual). */
  interestCoverage: number | null

  // ── Sparkline series (sorted oldest → newest) ─────────────
  epsAnnual: { period: string; v: number }[]
  /** Annual P/E series for historical percentile computation. */
  peAnnualSeries: { period: string; v: number }[]
  /** Annual gross margin series for sparkline. */
  grossMarginSeries: { period: string; v: number }[]
  /** Annual FCF-per-share series for sparkline. */
  fcfPerShareSeries: { period: string; v: number }[]
}

export interface RecommendationTrend {
  /** ISO date "YYYY-MM-DD" */
  period: string
  strongBuy: number
  buy: number
  hold: number
  sell: number
  strongSell: number
}

export interface NewsItem {
  headline: string
  /** Unix timestamp (seconds) */
  datetime: number
  url: string
  source: string
  /** Article summary / lead paragraph from Finnhub. May be empty. */
  summary: string
}

export interface InsiderTransaction {
  /** 'Buy' | 'Sell' */
  transactionType: string
  /**
   * SEC transaction code: P=Open Market Purchase, S=Open Market Sale,
   * A=Award/Grant, M=Exercise/Conversion, F=Tax Withholding (share surrender),
   * D=Other Disposition, C=Conversion, W=Gift/Will, I=Discretionary
   */
  transactionCode: string | null
  /** True when the transaction involves a derivative (option/warrant) rather than shares. */
  isDerivative: boolean
  name: string
  /** Number of shares transacted. */
  share: number | null
  /** Dollar value of transaction */
  value: number | null
  filingDate: string
}

export interface SignalsData {
  /** Most recent analyst recommendation period. null if unavailable. */
  recommendation: RecommendationTrend | null
  /** Up to 5 articles sorted newest first. */
  news: NewsItem[]
  /** Up to 5 transactions sorted newest first. */
  insiderTransactions: InsiderTransaction[]
}

export interface CompanyProfile {
  /** Full company name, e.g. "Apple Inc". */
  name: string
  /** Finnhub industry category, e.g. "Technology". */
  industry: string
  /** URL to company logo PNG (from Finnhub CDN). May be empty string. */
  logo: string
  /** Exchange name, e.g. "NASDAQ/NMS (GLOBAL MARKET)". */
  exchange: string
}

/** An upcoming earnings event from Finnhub's earnings calendar. */
export interface EarningsCalendarEntry {
  /** ISO date of earnings announcement, e.g. "2026-05-14". */
  date: string
  /**
   * Timing of the announcement:
   * "bmo" = before market open, "amc" = after market close,
   * "dmh" = during market hours, "" = unspecified.
   */
  hour: string
  /** Fiscal quarter (1–4). */
  quarter: number | null
  /** Fiscal year. */
  year: number | null
  /** Consensus EPS estimate for this quarter. */
  epsEstimate: number | null
}

export interface EarningsSurprise {
  /** ISO date of earnings period end, e.g. "2023-03-31". */
  period: string
  quarter: number
  year: number
  actual: number | null
  estimate: number | null
  /** Surprise as a percentage of estimate. Positive = beat. */
  surprisePercent: number | null
}

export interface DividendCalendarEntry {
  symbol: string
  date: string
  amount: number
  exDate: string
  payDate: string
  recordDate: string
  declarationDate: string
}

// ---------------------------------------------------------------------------
// M2 — Gemini API response types and runtime type guards
// The API response shape follows the generateContent REST contract.
// ---------------------------------------------------------------------------

/** A single text part returned by Gemini. */
export interface GeminiApiPart {
  text: string
}

/** The content object inside a candidate. */
export interface GeminiApiContent {
  parts: GeminiApiPart[]
  role?: string
}

/** A generation candidate from the Gemini response. */
export interface GeminiApiCandidate {
  content: GeminiApiContent
  finishReason?: string
  index?: number
}

/** Prompt-feedback block (present when the request is blocked). */
export interface GeminiPromptFeedback {
  blockReason?: string
}

/** Error object returned by the Gemini API on 4xx/5xx responses. */
export interface GeminiApiError {
  code?: number
  message?: string
  status?: string
}

/**
 * Top-level response shape from POST .../generateContent.
 * Both `candidates` and `error` are optional because only one is present.
 */
export interface GeminiApiResponse {
  candidates?: GeminiApiCandidate[]
  promptFeedback?: GeminiPromptFeedback
  error?: GeminiApiError
}

// ---------------------------------------------------------------------------
// Runtime type guards
// ---------------------------------------------------------------------------

/** Asserts the value is an object (non-null, non-array). */
function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * Narrows an unknown JSON payload to `GeminiApiResponse`.
 * Accepts the response whether it represents success, a block, or an error.
 */
export function isGeminiApiResponse(v: unknown): v is GeminiApiResponse {
  if (!isObject(v)) return false
  // At least one of these top-level keys must be present to be a Gemini response
  return (
    'candidates' in v ||
    'promptFeedback' in v ||
    'error' in v
  )
}

/**
 * Narrows a candidate object to `GeminiApiCandidate`.
 * Validates that `content.parts` exists and is an array.
 */
export function isGeminiApiCandidate(v: unknown): v is GeminiApiCandidate {
  if (!isObject(v)) return false
  const { content } = v
  if (!isObject(content)) return false
  return Array.isArray((content as Record<string, unknown>).parts)
}

/**
 * Extracts the concatenated text from a validated Gemini response.
 * Returns an empty string if no text is present.
 */
export function extractGeminiText(response: GeminiApiResponse): string {
  const candidate = response.candidates?.[0]
  if (!candidate || !isGeminiApiCandidate(candidate)) return ''
  return candidate.content.parts
    .filter((p): p is GeminiApiPart => typeof p?.text === 'string')
    .map(p => p.text)
    .join('')
    .trim()
}

/**
 * Extracts an error message from a Gemini API error response.
 * Returns null if no recognisable error is present.
 */
export function extractGeminiError(response: GeminiApiResponse, httpStatus: number): string | null {
  const errMessage = response.error?.message
  if (typeof errMessage === 'string' && errMessage) return errMessage
  const blockReason = response.promptFeedback?.blockReason
  if (typeof blockReason === 'string' && blockReason) return `Request blocked (${blockReason})`
  if (!httpStatus || httpStatus < 400) return null
  return `HTTP ${httpStatus}`
}
