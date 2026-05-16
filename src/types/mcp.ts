import type { DollarAmount, ISODate, AssignmentPositionType } from './common'
import type { EnrichedTrade } from './trade'
import type { NormalizedLeg } from './leg'
import type { AssignmentRecord } from './stats'

// ---------------------------------------------------------------------------
// §21 — MCPTrade / MCPAssignment
// Subset projections sent to external MCP agents.
// Produced by buildMCPTrade / buildMCPAssignment (app.js:16858-17268).
// ---------------------------------------------------------------------------

/**
 * Condensed trade projection forwarded to the MCP integration.
 * Exact field set — verify against buildMCPTrade during conversion.
 * Optional fields reflect that some trades may not carry all properties.
 */
export interface MCPTrade {
  id: string
  ticker: string
  strategy: string
  status: string
  openedDate?: ISODate | ''
  closedDate?: ISODate | ''
  expirationDate?: ISODate | ''
  pl?: DollarAmount
  roi?: number
  daysHeld?: number
  dte?: number
  tradeDirection?: string
  tradeType?: string
  [key: string]: unknown
}

/**
 * Condensed assignment record forwarded to the MCP integration.
 * Subset of AssignmentRecord.
 */
export interface MCPAssignment {
  tradeId: string
  ticker: string
  positionType: AssignmentPositionType
  legs: NormalizedLeg[]
  [key: string]: unknown
}

