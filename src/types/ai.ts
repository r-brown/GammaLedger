import type { AIRole } from './common'
import type { EnrichedTrade } from './trade'
import type { Stats } from './stats'

// ---------------------------------------------------------------------------
// §22 — AIAgentContext (this.context on both AI agents)
// ---------------------------------------------------------------------------

/**
 * Shared context object held by LocalInsightsAgent and AIInsightsAgent.
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

// ---------------------------------------------------------------------------
// AI view types shared with strict UI modules (src/ui never imports src/ai)
// ---------------------------------------------------------------------------

export type ConfidenceBand = 'high' | 'medium' | 'low'

export interface DecisionTrust {
  engine: 'jev' | 'llm'
  /** True only for JEV; LLM self-reports are not calibrated. */
  calibrated: boolean
  confidence: number | null
  band: ConfidenceBand | null
  model: string
}

export interface AIReadView extends DecisionTrust {
  grade: 'bullish' | 'neutral' | 'bearish'
  /** 'mixed' when JEV's confidence is below 0.5, whatever the top choice. */
  display: 'bullish' | 'neutral' | 'bearish' | 'mixed'
  probabilities: Record<string, number>
  asOf: string
}

export interface DriftView extends DecisionTrust {
  drifted: boolean
  probability: number
  asOf: string
}

/**
 * 'rule' reasons come from the Active Positions attention rules (calculations/attention.ts), so the
 * digest and the table's status dot agree; the others are digest-only additions.
 */
export type AttentionReasonKind = 'rule' | 'earnings' | 'uncovered-shares' | 'wide-spread'

export interface AttentionReason {
  kind: AttentionReasonKind
  text: string
}

export interface AttentionItem {
  key: string
  ticker: string
  label: string
  reasons: AttentionReason[]
  /** Same scale as the table dot: 3 act now, 2 look today, 1 worth a glance. */
  severity: 1 | 2 | 3
  dte: number | null
  /** JEV urgency level 0–2 when ordered by JEV, else null. */
  urgency: number | null
}

export interface AskCoachRequest {
  ticker: string
  trade?: Record<string, unknown> | null
  watchlistEntry?: import('./watchlist').WatchlistEntry | null
}

export interface GroundingResult {
  checked: number
  matched: number
  unmatched: Array<{ raw: string; sentence: string }>
}
