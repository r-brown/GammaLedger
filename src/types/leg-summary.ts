import type { ISODate, DollarAmount } from './common'
import type { NormalizedLeg } from './leg'

// ---------------------------------------------------------------------------
// §5 — LegSummary
// Aggregated result of summarizeLegs(legs) — the largest domain shape.
// ---------------------------------------------------------------------------

/**
 * Vertical spread geometry detected by summarizeLegs.
 */
export interface VerticalSpreadShape {
  /** Absolute width between strikes in dollars. */
  width: number
  /** Contract multiplier (typically 100). */
  multiplier: number
  /** Number of contracts on the spread. */
  contracts: number
}

/**
 * Aggregated result of running summarizeLegs() over a trade's legs.
 * 31 fields — produced in one pass with two fields appended after
 * the main loop (activeOpenLegs, hasClosedOutOpenLegs).
 *
 * Date fields are Date objects; enrichTradeData converts them to ISO strings
 * before assigning to EnrichedTrade.
 */
export interface LegSummary {
  /** All legs after normalizeLeg. Shape is NormalizedLeg[]. */
  legs: NormalizedLeg[]

  /** legs.length */
  legsCount: number

  /** Count of legs with side OPEN. */
  openLegs: number

  /** Count of legs with side CLOSE. */
  closeLegs: number

  /**
   * Count of legs with side ROLL.
   * NOTE: in EnrichedTrade, rollLegs is an array; here it is a count.
   */
  rollLegs: number

  /** Sum of all leg fees. */
  totalFees: DollarAmount

  /** Sum of buy-side cashflows including fees. */
  totalDebit: DollarAmount

  /** Sum of sell-side cashflows including fees. */
  totalCredit: DollarAmount

  /** Net cashflow (credit − debit). */
  cashFlow: DollarAmount

  /** Cashflow from OPEN-side legs only. */
  openCashFlow: DollarAmount

  /** Cashflow from CLOSE-side legs only. */
  closeCashFlow: DollarAmount

  /** Earliest execution date as a Date object; null if no dated legs. */
  openedDate: Date | null

  /** Latest execution date as a Date object; null if no close activity. */
  closedDate: Date | null

  /** Earliest expiration date as a Date object; null if no dated expirations. */
  earliestExpiration: Date | null

  /** Latest expiration date as a Date object; null if no dated expirations. */
  latestExpiration: Date | null

  /**
   * First non-CLOSE leg, or first leg overall if all are CLOSEs.
   * May be replaced by the active short leg when the trade has been rolled.
   * null when there are no legs.
   */
  primaryLeg: NormalizedLeg | null

  /** Sum of |qty| over OPEN-side legs. */
  openContracts: number

  /** Sum of |qty| over CLOSE-side legs. */
  closeContracts: number

  /**
   * Maximum capital at risk, or Infinity for unlimited-risk strategies.
   * Computed by computeMaxRiskUsingFormula over all normalized legs.
   */
  capitalAtRisk: DollarAmount

  /** Per-contract average entry premium; null if no open legs. */
  entryPrice: DollarAmount | null

  /** Per-contract average exit premium; null if no close legs. */
  exitPrice: DollarAmount | null

  /** Gross premium received from OPEN SELL legs. */
  openCreditGross: DollarAmount

  /** Gross premium paid on OPEN BUY legs. */
  openDebitGross: DollarAmount

  /** Sum of fees on OPEN-side legs only. */
  openFees: DollarAmount

  /** Maximum aggregated quantity across lifecycle key groups. */
  openBaseContracts: number

  /**
   * Detected vertical-spread geometry; null if the legs do not form a vertical.
   */
  verticalSpread: VerticalSpreadShape | null

  /**
   * Earliest active (net-open) short call expiration.
   * null if no active short calls.
   */
  nearestShortCallExpiration: Date | null

  /**
   * Earliest active short call expiration that has not yet passed market close (4 PM ET).
   * null if no such legs.
   */
  nextShortCallExpiration: Date | null

  /**
   * LIFO-reduced active legs after roll deduplication.
   * Appended after the main loop in summarizeLegs (line ~869).
   */
  activeOpenLegs: NormalizedLeg[]

  /**
   * True if any open legs have matching close (rolled-out) activity.
   * Appended after the main loop (line ~870).
   */
  hasClosedOutOpenLegs: boolean
}
