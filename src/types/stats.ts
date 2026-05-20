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

  totalPL: DollarAmount
  realizedPL: DollarAmount
  unrealizedPL: DollarAmount

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
  /** Percent 0–100 */
  maxDrawdown: number

  dailyReturns: number[]
  meanDailyReturn: number
  dailyStdDev: number
  downsideDeviation: number
  sharpeRatio: number
  sortinoRatio: number

  totalFees: DollarAmount
  totalInvestment: DollarAmount
  collateralAtRisk: DollarAmount

  closedTradesList: EnrichedTrade[]
  openTradesList: EnrichedTrade[]
  assignedTradesList: EnrichedTrade[]

  tickerPerformance: TickerPerformance
  assignmentStats: AssignmentStats
}
