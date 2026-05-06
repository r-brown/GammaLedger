import type { ISOTimestamp, ISODate, DollarAmount, CumulativePLRange } from './common'
import type { Trade } from './trade'
import type { EnrichedTrade } from './trade'
import type { Stats } from './stats'

// ---------------------------------------------------------------------------
// §10 — MCPContext
// Snapshot embedded in the persisted database payload.
// ---------------------------------------------------------------------------

/**
 * Cumulative P&L per range.
 * Values are null when there is insufficient data for the range.
 */
export type PLByRange = Record<Exclude<CumulativePLRange, 'ALL'>, DollarAmount | null>

/** Current win / loss streak. */
export interface Streak {
  type: 'win' | 'loss' | null
  count: number
}

/** Net open positions by option type. */
export interface PositionSummary {
  shortCalls: number
  longCalls: number
  longPuts: number
  shortPuts: number
}

/**
 * MCP context snapshot persisted inside StorageSchema.
 * Built by buildMCPContext (app.js:15265+).
 * All "extra" sub-fields are optional because old-format data may lack them.
 */
export interface MCPContext {
  /** Stats rounded via r2/r4 helpers. */
  stats: Stats

  plByRange: PLByRange

  streak: Streak

  daysSinceLastTrade?: number

  largestWinner: EnrichedTrade | null
  largestLoser: EnrichedTrade | null

  /** DTE-bucket counts (e.g. { "0-7": 3, "8-14": 2 }). */
  activeHorizonCount?: Record<string, number>

  positionSummary?: PositionSummary

  assignmentRisk?: DollarAmount

  /** Percentage of portfolio in wheel trades (0-100). */
  wheelPercentage?: number

  /** Percentage of portfolio in PMCC trades (0-100). */
  pmccPercentage?: number
}

// ---------------------------------------------------------------------------
// §11 — StorageSchema
// The top-level localStorage payload under key GammaLedgerLocalDatabase.
// ---------------------------------------------------------------------------

/**
 * Root shape for the GammaLedger database stored in localStorage.
 *
 * NOTE: `version` is the string `'2.5'` in the live codebase, NOT a number.
 * The CLAUDE.md spec assumed numeric versioning — do not change the stored
 * value without a migration step. Type it as `string` for now.
 */
export interface StorageSchema {
  /**
   * Schema version. Currently `'2.5'` as a string literal.
   * Increment when the shape changes and add a migration in src/core/migration.ts.
   */
  version: string

  /** ISO timestamp when this payload was written. */
  exportDate: ISOTimestamp

  /** All trades in the portfolio. */
  trades: Trade[]

  /**
   * Cached MCP/stats context embedded for fast load.
   * May be absent on data imported from older versions.
   */
  mcpContext?: MCPContext
}

