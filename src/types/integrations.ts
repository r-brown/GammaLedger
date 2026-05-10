import type { DollarAmount, GeminiModel, ToastVariant } from './common'

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

  /** Quote cache keyed by ticker symbol. */
  cache: Map<string, FinnhubQuote>

  /** Cache TTL in milliseconds. */
  cacheTTL: number

  /** In-flight requests keyed by request key. */
  outstandingRequests: Map<string, Promise<FinnhubQuote>>

  /** Rate-limiter queue promise chain. */
  rateLimitQueue: Promise<unknown>

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
  /** Current price from the Finnhub quote cache at fetch time. */
  currentPrice: number | null
  beta: number | null
  /** Market cap in millions of USD. */
  marketCap: number | null
  /** 3-month annualised daily return std-dev (realized vol baseline). */
  vol3MonthStd: number | null
  /** 5-day price return, in percent. */
  return5Day: number | null
  /** 52-week price return, in percent. */
  return52Week: number | null
  week52High: number | null
  week52Low: number | null
  /** ISO date string "YYYY-MM-DD" of the 52-week high. */
  week52HighDate: string | null
  /** ISO date string "YYYY-MM-DD" of the 52-week low. */
  week52LowDate: string | null

  // ── Valuation ─────────────────────────────────────────────
  /** Trailing twelve-month P/E ratio. */
  peTTM: number | null
  /** Forward P/E ratio. */
  forwardPE: number | null
  /** Trailing twelve-month Price-to-FCF per share. */
  pfcfTTM: number | null
  /** Enterprise Value / Free Cash Flow (TTM). */
  evFCF: number | null

  // ── Quality (margins, all in percent) ─────────────────────
  grossMarginTTM: number | null
  operatingMarginTTM: number | null
  netMarginTTM: number | null
  /** Most recent annual FCF margin, in percent. */
  fcfMarginLatest: number | null

  // ── Growth (in percent) ───────────────────────────────────
  /** Revenue growth year-over-year (TTM), in percent. */
  revenueGrowthYoY: number | null
  /** EPS growth year-over-year (TTM), in percent. */
  epsGrowthYoY: number | null

  // ── Balance sheet ─────────────────────────────────────────
  currentRatio: number | null
  /** Net debt / total equity (latest annual). */
  netDebtToEquity: number | null

  // ── Sparkline ─────────────────────────────────────────────
  /** Annual EPS series for sparkline rendering. Array of {period, v} sorted oldest→newest. */
  epsAnnual: { period: string; v: number }[]
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
