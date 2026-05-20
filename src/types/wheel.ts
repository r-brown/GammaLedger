import type { WheelCoverage, ISODate, DollarAmount } from './common'
import type { NormalizedLeg } from './leg'

// ---------------------------------------------------------------------------
// §18 — Wheel / PMCC shapes
// Wheel and PMCC positions are regular Trade objects identified by their
// `strategy` field. The types here capture the shapes produced by the
// extraction helpers rather than standalone entity objects.
// ---------------------------------------------------------------------------

/**
 * Result of extractPmccLegs(trade).
 * The closest runtime shape to a dedicated PMCCPosition entity.
 */
export interface PMCCLegExtraction {
  /** The long call (LEAPS) leg; null if not found. */
  longCall: NormalizedLeg | null

  /** All short call legs sold against the LEAPS. */
  shortCalls: NormalizedLeg[]
}

/**
 * Wheel-coverage state type alias.
 * Exported here for convenient import from @types-gl/wheel.
 * The value lives on EnrichedTrade.wheelCoverage.
 */
export type { WheelCoverage }
