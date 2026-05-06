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

