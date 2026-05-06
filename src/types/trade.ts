import type {
  ISODate,
  DollarAmount,
  StrikePrice,
  WheelCoverage,
  MarketPriceSource,
  LifecycleStatus,
  UnderlyingType,
} from './common'
import type { PersistedLeg, NormalizedLeg } from './leg'
import type { LifecycleMeta } from './lifecycle'

// ---------------------------------------------------------------------------
// §1 — Trade (Persisted)
// The minimal trade shape stored in localStorage.
// Produced by buildTradeStorageSnapshot (app.js:15166).
// RUNTIME_TRADE_FIELDS are stripped before writing; this is the remainder.
// ---------------------------------------------------------------------------

/**
 * Minimal trade record as stored in localStorage.
 * Enriched fields (see EnrichedTrade) are recomputed from legs on every load.
 */
export interface Trade {
  /** Unique identifier — UUID, timestamp-based, or import-derived. */
  id: string

  /** Underlying ticker symbol; uppercased on input. */
  ticker: string

  /**
   * Strategy label (~45 possible values from creditPlaybookStrategyOptions).
   * Not validated at the type level — too many variants to enumerate.
   */
  strategy: string

  /** Underlying asset category. Defaults to 'Stock'. */
  underlyingType: UnderlyingType

  /** Option / stock legs. Always an array; replaced with [] if missing on load. */
  legs: PersistedLeg[]

  /**
   * Earliest leg execution date.
   * Written by enrichTradeData; empty string on new/unprocessed trades.
   */
  openedDate: ISODate | ''

  /**
   * Latest leg execution date for the close side.
   * Empty string if the trade is still open.
   */
  closedDate: ISODate | ''

  /**
   * Latest leg expiration date.
   * Empty string if no expiration (e.g. pure stock trades).
   */
  expirationDate: ISODate | ''

  /** User-entered free-text notes. */
  notes?: string

  /**
   * User-supplied override of the computed maximum risk in dollars.
   * null means "use the computed value".
   */
  maxRiskOverride: DollarAmount | null

  /**
   * Persisted lifecycle status.
   * May be absent on legacy data imported from pre-v2.5 schemas.
   */
  status?: LifecycleStatus
}

// ---------------------------------------------------------------------------
// §2 — Trade (Enriched / Runtime)
// Shape after enrichTradeData(trade) runs. Consumed by all UI components,
// stats calculators, AI agents, charts, share card.
// NEVER written to localStorage (RUNTIME_TRADE_FIELDS lists these fields).
// ---------------------------------------------------------------------------

/**
 * Full runtime trade shape after enrichTradeData resolves all derived values.
 * Extends the persisted Trade with ~38 computed fields.
 */
export interface EnrichedTrade extends Trade {
  /**
   * legs is replaced by the NormalizedLeg array from summarizeLegs.
   * The in-memory shape is NormalizedLeg[], not PersistedLeg[].
   */
  legs: NormalizedLeg[]

  // ---- Leg counts / cashflow aggregates (from LegSummary) ----

  /** Total number of legs. */
  legsCount: number

  /** Net open contracts (openContracts - closeContracts, min 0). */
  openContracts: number

  /** Total close-side contracts. */
  closeContracts: number

  /**
   * Net open legs count (openLegs - closeLegs, min 0).
   * NOTE: this is a number (count), not an array — see rollLegs for the array.
   */
  openLegs: number

  /** Roll-side legs. This IS an array (unlike the LegSummary field of the same name). */
  rollLegs: NormalizedLeg[]

  /** Sum of all leg fees rounded to 4 decimals. */
  totalFees: DollarAmount

  /** Alias of totalFees for legacy callers. */
  fees: DollarAmount

  /** Buy-side total cashflow (debit) rounded to 2 decimals. */
  totalDebit: DollarAmount

  /** Sell-side total cashflow (credit) rounded to 2 decimals. */
  totalCredit: DollarAmount

  /** Net cashflow (credit - debit) rounded to 2 decimals. */
  cashFlow: DollarAmount

  /**
   * Capital at risk rounded to 2 decimals, or Infinity for unlimited-risk strategies.
   * NOTE: Infinity is a valid JavaScript number; TypeScript types it as number.
   */
  capitalAtRisk: DollarAmount

  // ---- Leg structure ----

  /** First relevant leg; null if no legs. */
  primaryLeg: NormalizedLeg | null

  /**
   * Trade shape category ('spread', 'single', 'wheel', 'pmcc', etc.).
   * Not enumerated centrally in the codebase; treated as an open string.
   */
  tradeType: string

  /**
   * Directional classification.
   * 'long_stock' is used for assigned / wheel stock-hold positions.
   */
  tradeDirection:
    | 'long'
    | 'short'
    | 'debit'
    | 'credit'
    | 'neutral'
    | 'long_stock'

  // ---- Price / strike ----

  /** Sign-aware quantity (negative for net-short trades). */
  quantity: number

  /** Primary leg strike price; null for pure stock positions. */
  strikePrice: StrikePrice | null

  /** Contract multiplier from the primary leg. */
  multiplier: number

  /** Human-readable strike string (e.g. "100/105" for spreads). */
  displayStrike: string

  /** Strike on the currently-active leg if the trade has been rolled. */
  activeStrikePrice: StrikePrice | null

  /** Per-contract average entry premium rounded to 4 decimals. */
  entryPrice: DollarAmount | null

  /** Per-contract average exit premium rounded to 4 decimals. */
  exitPrice: DollarAmount | null

  // ---- Dates (runtime aliases + derived) ----

  /** Alias of openedDate. */
  entryDate: ISODate | ''

  /** Alias of closedDate. */
  exitDate: ISODate | ''

  /** If PMCC, the nearest upcoming short call expiration. */
  pmccShortExpiration: ISODate | ''

  /** Latest leg expiration date (alias of Trade.expirationDate for runtime use). */
  longExpirationDate: ISODate | ''

  // ---- P&L / ROI ----

  /** Realized P&L. 0 for fully-open positions. */
  pl: DollarAmount

  /**
   * Return on investment as a decimal (0.15 = 15%).
   * 0 when data is insufficient.
   */
  roi: number

  /**
   * Maximum risk in dollars, or Infinity (unlimited-risk strategies).
   * Duplicate of capitalAtRisk; kept for legacy callers.
   */
  maxRisk: DollarAmount

  /** Pre-formatted max-risk label: currency string, 'Unlimited', or '—'. */
  maxRiskLabel: string

  /** True when maxRisk is Infinity. */
  riskIsUnlimited: boolean

  // ---- Lifecycle metadata ----

  /** Detailed lifecycle computation results. */
  lifecycleMeta: LifecycleMeta

  /**
   * Computed lifecycle status, with possible runtime override to 'awaiting_coverage'.
   * This is the canonical status for display; do not use Trade.status at the UI layer.
   */
  lifecycleStatus: LifecycleStatus

  // ---- Trade-shape flags ----

  /** True if some but not all contracts are closed (partial close). */
  partialClose: boolean

  /** True if any leg carries a roll marker. */
  rolledForward: boolean

  /** True if expiration passed without explicit close activity. */
  autoExpired: boolean

  // ---- Time metrics ----

  /** Days between openedDate and (closedDate or today). */
  daysHeld: number

  /** Days to nearest expiration. Negative if already past. */
  dte: number

  /** ROI annualized to a 7-day basis. */
  weeklyROI: number

  /** ROI annualized to a 30-day basis. */
  monthlyROI: number

  /** ROI annualized to a 365-day basis. */
  annualizedROI: number

  // ---- Wheel / PMCC runtime fields (stripped on save) ----

  /** User-entered free text explaining the reasoning for the trade. STRIPPED ON SAVE. */
  tradeReasoning?: string

  /**
   * Wheel coverage state. STRIPPED ON SAVE — recomputed on enrichment.
   * null for non-wheel / non-PMCC trades.
   */
  wheelCoverage: WheelCoverage

  /** Shares held (wheel/PMCC). STRIPPED ON SAVE. */
  shares?: number

  /**
   * Effective cost basis per share after premium offset.
   * STRIPPED ON SAVE.
   */
  effectiveCostBasis?: DollarAmount

  /** Mark-to-market value of held shares. STRIPPED ON SAVE. */
  marketValue?: DollarAmount

  /** Unrealized P&L on held position. STRIPPED ON SAVE. */
  unrealizedPL?: DollarAmount

  /** Where the current market price came from. STRIPPED ON SAVE. */
  marketPriceSource?: MarketPriceSource
}

