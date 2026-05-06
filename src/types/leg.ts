import type {
  ISODate,
  OrderType,
  LegType,
  LegAction,
  LegSide,
  UnderlyingType,
  DollarAmount,
  StrikePrice,
  Multiplier,
} from './common'

// ---------------------------------------------------------------------------
// §3 — Leg (Persisted)
// What lives inside Trade.legs[] in localStorage.
// ---------------------------------------------------------------------------

/** Leg shape written to and read from localStorage inside a Trade. */
export interface PersistedLeg {
  /** Generated as "LEG-{timestamp}-{index}" if not provided on import. */
  id: string

  /** Canonical order type derived from normalizeLeg. */
  orderType: OrderType | null

  /** Uppercased option / asset type. */
  type: LegType

  /** Signed quantity. Absolute value used downstream. */
  quantity: number

  /**
   * Contract multiplier.
   * 100 for standard equity options.
   * Stock legs may use 1 or 100 depending on the import source.
   */
  multiplier: Multiplier

  /** Date the leg was executed. Empty string for legs with no known execution date. */
  executionDate: ISODate | ''

  /** Option expiration date. Empty string for stock / cash legs. */
  expirationDate: ISODate | ''

  /**
   * Strike price.
   * For STOCK legs with premium === 0, the per-share price is stored here.
   * Null for stock legs otherwise.
   */
  strike: StrikePrice | null

  /** Per-share / per-contract premium. Defaults to 0 if non-finite on ingest. */
  premium: DollarAmount

  /** Transaction fees. Defaults to 0 if non-finite. */
  fees: DollarAmount

  /** Underlying spot price at execution. Null if not recorded. */
  underlyingPrice: DollarAmount | null

  /** Per-leg underlying type (overrides trade-level when present). */
  underlyingType: UnderlyingType

  // Legacy / import-source aliases — may be present on stored data.
  // normalizeLeg collapses these into orderType; they are carried for compat.

  /** Legacy: raw action; deprecated in favour of orderType. */
  action?: LegAction

  /** Legacy: raw side; deprecated in favour of orderType. */
  side?: LegSide

  /** Legacy: Robinhood import alias of orderType. */
  tradeType?: string

  /** Legacy: hand-entry alias of orderType. */
  order?: string

  /** Marks this leg as an assignment event. */
  isAssignment?: boolean

  /** Per-leg free-text notes. */
  notes?: string
}

// ---------------------------------------------------------------------------
// §4 — Leg (Normalized / runtime)
// The strict 14-field shape returned by normalizeLeg(leg, index).
// Used exclusively by summarizeLegs, lifecycle determinator, risk/P&L/payoff.
// Fields not in this list are dropped by normalizeLeg.
// ---------------------------------------------------------------------------

/** Strict runtime shape output by normalizeLeg. */
export interface NormalizedLeg {
  /** Generated if missing. */
  id: string

  /** Inferred canonical order type. null if inference failed. */
  orderType: OrderType | null

  /** Uppercased leg type. */
  type: LegType

  /** NaN-safe quantity; defaults to 0. */
  quantity: number

  /** From getLegMultiplier. */
  multiplier: Multiplier

  /** Re-formatted to "YYYY-MM-DD" via toISOString().slice(0,10). */
  executionDate: ISODate | ''

  /** Same conversion. */
  expirationDate: ISODate | ''

  /** NaN-safe strike; null if original was non-finite. */
  strike: StrikePrice | null

  /** Defaults to 0 if non-finite. */
  premium: DollarAmount

  /** Defaults to 0 if non-finite. */
  fees: DollarAmount

  /** NaN-safe; null if original was non-finite. */
  underlyingPrice: DollarAmount | null

  /** Defaulted to 'Stock' when missing. */
  underlyingType: UnderlyingType

  /**
   * External broker ID for the leg.
   * Populated by the import pipeline; stripped before save (RUNTIME_LEG_FIELDS).
   * null if empty or absent.
   */
  externalId: string | null

  /**
   * Import group identifier.
   * Populated by the import pipeline; stripped before save.
   */
  importGroupId: string | null

  /**
   * Import source (e.g. 'robinhood', 'ofx').
   * Populated by the import pipeline; stripped before save.
   */
  importSource: string | null
}

