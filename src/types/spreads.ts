import type { ISODate, DollarAmount } from './common'
import type { NormalizedLeg } from './leg'

// ---------------------------------------------------------------------------
// §18 — Spread extraction shapes
// ---------------------------------------------------------------------------

/**
 * A matched leg pair forming a vertical spread.
 * Common shape returned by extractSpreadPair and related helpers
 * (app.js:8800-9400). Variant shapes for rolled / individual pairs
 * extend this base.
 */
export interface SpreadPair {
  longLeg: NormalizedLeg
  shortLeg: NormalizedLeg
  /** Absolute spread width in dollars. */
  width: number
  expiration: ISODate
}

/**
 * Spread pair extracted from a rolled position.
 * The active leg may differ from the original open leg.
 */
export interface RolledSpreadPair extends SpreadPair {
  /** The leg that was rolled into (the new short). */
  rolledLeg: NormalizedLeg
}

/**
 * Individual leg pair from a multi-leg trade where legs are paired by
 * matching strikes / expirations rather than by position lifecycle.
 */
export interface IndividualLegPair extends SpreadPair {
  /** Index of this pair in the parent trade's leg list. */
  pairIndex: number
}

