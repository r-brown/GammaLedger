import type { ISODate, ExitReason, LifecycleStatus } from './common'

// ---------------------------------------------------------------------------
// §6 — LegLifecycleResult + LifecycleMeta
// Output of determineTradeLifecycleStatus(trade, summary).
// ---------------------------------------------------------------------------

/**
 * Detailed lifecycle metadata embedded in every EnrichedTrade.
 *
 * `matchedPairs` is numeric from initialization through enrichment; lifecycle
 * boolean flags are required and default to false before leg traversal.
 */
export interface LifecycleMeta {
  /** Number of matched open/close contract pairs. Initialise to 0. */
  matchedPairs: number

  /** Net unpaired contract exposure. */
  unmatchedExposure: number

  /** True if any leg's expiration date is ≤ today. */
  expirationPassed: boolean

  /** True if at least one leg is marked as a roll. */
  hasRollLegs: boolean

  /** True if at least one CLOSE-side leg is present. */
  hasCloseActivity: boolean

  /** True if an assignment marker was found on any leg. */
  hasAssignmentEvent: boolean

  /** True if an expiration event was found. */
  hasExpirationEvent: boolean

  /** True if total bought stock > total sold stock across all STOCK legs. */
  hasOpenStockPosition: boolean

  /** True if a CASH-type leg was encountered (cash-settlement). */
  hasCashSettlementEvent: boolean

  /** True if a close / expiry activity was detected after the primary expiration. */
  activityAfterExpiration: boolean
}

/**
 * Return value of determineTradeLifecycleStatus.
 * The `meta` field is forwarded directly to EnrichedTrade.lifecycleMeta.
 */
export interface LegLifecycleResult {
  /**
   * Computed status before any runtime override.
   * enrichTradeData may later override lifecycleStatus to 'awaiting_coverage'.
   */
  status: Exclude<LifecycleStatus, 'awaiting_coverage'>

  /** Why the position was closed (or null if still open / indeterminate). */
  exitReason: ExitReason

  /**
   * The date the position effectively closed.
   * May differ from Trade.closedDate when the close date is inferred
   * from expiration rather than an explicit closing transaction.
   */
  effectiveClosedDate: ISODate | null

  /**
   * When set, overrides the openContracts value on the enriched trade.
   * Used in edge cases (e.g. assignments where the leg count math is unreliable).
   */
  openContractsOverride?: number

  /** Detailed lifecycle flags forwarded to EnrichedTrade.lifecycleMeta. */
  meta: LifecycleMeta
}
