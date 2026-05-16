import type { AIRole } from './common'
import type { EnrichedTrade } from './trade'
import type { Stats } from './stats'

// ---------------------------------------------------------------------------
// §22 — AIAgentContext (this.context on both AI agents)
// ---------------------------------------------------------------------------

/**
 * Shared context object held by LocalInsightsAgent and GeminiInsightsAgent.
 * Updated via updateContext() whenever the portfolio data changes.
 */
export interface AIAgentContext {
  /** Latest advanced stats snapshot; null until first calculateAdvancedStats run. */
  stats: Stats | null

  /** Current open trades. */
  openTrades: EnrichedTrade[]
}

// ---------------------------------------------------------------------------
// §23 — Message (AI chat)
// ---------------------------------------------------------------------------

/**
 * One message in the in-memory AI chat history.
 * Not persisted across page reloads.
 */
export interface Message {
  /** Unique message identifier. */
  id: string

  /** Participant that produced the message. */
  role: AIRole

  /** Plain-text or markdown content. */
  content: string

  /** Creation time as epoch milliseconds. */
  timestamp: number
}

