import type { DollarAmount, AssignmentPositionType } from './common'
import type { EnrichedTrade } from './trade'
import type { NormalizedLeg } from './leg'

// ---------------------------------------------------------------------------
// §7 — Stats (AdvancedStats)
// Output of calculateAdvancedStats().
// ---------------------------------------------------------------------------

/**
 * Per-ticker performance summary, produced inside calculateAdvancedStats.
 */
export interface TickerPerformanceItem {
  ticker: string
  totalPL: DollarAmount
  tradeCount: number
  wins: number
  losses: number
  avgPL: DollarAmount
  /** Percent 0–100 */
  winRate: number
}

/**
 * Aggregated ticker performance shape (§8).
 */
export interface TickerPerformance {
  /** Items sorted by totalPL descending. */
  items: TickerPerformanceItem[]
  /** Largest |pl| across all items — used for chart scaling. */
  maxMagnitude: DollarAmount
}

/**
 * One assignment event as detected by calculateAssignmentStats.
 */
export interface AssignmentRecord {
  trade: EnrichedTrade
  positionType: AssignmentPositionType
  normalizedLegs: NormalizedLeg[]
}

/**
 * Assignment statistics (§9).
 */
export interface AssignmentStats {
  assignments: AssignmentRecord[]
}

/**
 * Risk band for per-ticker collateral concentration.
 * - critical: share > APP_CONFIG.RISK_RULES.CRITICAL_SHARE_PCT
 * - high:     share > APP_CONFIG.RISK_RULES.TARGET_SHARE_PCT
 * - ok:       share ≤ APP_CONFIG.RISK_RULES.TARGET_SHARE_PCT
 * - caution:  reserved for a future amber-light tier; current aggregator never emits it
 */
export type RiskBand = 'critical' | 'high' | 'caution' | 'ok'

/**
 * Per-ticker collateral concentration row.
 * Capital and share are both derived from openTrades only.
 */
export interface CollateralConcentration {
  ticker: string
  capital: DollarAmount
  /** Decimal 0..1 — share of total collateralAtRisk */
  share: number
  band: RiskBand
}

/**
 * Full advanced stats object returned by calculateAdvancedStats() (§7).
 *
 * NOTE on percentages:
 *   - winRate, maxDrawdown — 0-100 scale
 *   - totalROI, annualizedROI — 0-1 decimal scale
 */
export interface Stats {
  totalTrades: number
  closedTrades: number
  activePositions: number
  assignedPositions: number
  /** Count of assigned wheel/PMCC trades currently awaiting a covered call
   *  (shares held with no active short call). Subset of `closedTrades` for
   *  realized-P&L purposes, but also contributes share-side MTM to unrealizedPL. */
  awaitingCoveragePositions: number

  totalPL: DollarAmount
  realizedPL: DollarAmount
  unrealizedPL: DollarAmount
  /** Net cash booked on open option groups — collected but not yet earned */
  pendingPremium: DollarAmount
  /** Data-integrity flags from the leg-realization engine */
  realizationAnomalies: {
    orphanCloseGroups: number
    closeAfterExpiryLegs: number
    tickers: string[]
  }

  wins: number
  losses: number
  /** Percent 0–100 */
  winRate: number
  /** Gross wins / gross losses; Infinity when there are no losses */
  profitFactor: number
  avgWin: DollarAmount
  avgLoss: DollarAmount
  avgWinnerDays: number
  avgLoserDays: number
  /** Per-trade expected value in dollars */
  expectancy: DollarAmount

  /** Decimal (0-1) */
  totalROI: number
  /** Decimal (0-1) */
  annualizedROI: number
  /** Percent 0–100 of peak cumulative realized P&L (not account equity) */
  maxDrawdown: number
  /** Peak-to-trough dip of cumulative realized P&L in dollars */
  maxDrawdownDollars: DollarAmount

  dailyReturns: number[]
  meanDailyReturn: number
  dailyStdDev: number
  downsideDeviation: number
  sharpeRatio: number
  sortinoRatio: number

  totalFees: DollarAmount
  totalInvestment: DollarAmount
  collateralAtRisk: DollarAmount
  /** Sum of trade P&L over fully closed/expired trades. */
  closedTradesPL: DollarAmount
  /** Realized option premium captured by in-flight assigned wheel/PMCC positions. */
  wheelAssignedPremium: DollarAmount
  /** Realized P&L from terminated legs inside open non-wheel positions (PMCC short-call cycles, rolling cycles). */
  openTradeRealizedPL: DollarAmount
  /** Per-ticker collateral concentration over open positions, sorted desc by capital. */
  collateralByTicker: CollateralConcentration[]

  closedTradesList: EnrichedTrade[]
  openTradesList: EnrichedTrade[]
  assignedTradesList: EnrichedTrade[]

  tickerPerformance: TickerPerformance
  assignmentStats: AssignmentStats
}
