// src/calculations/attention.ts — morning-checklist rules for open positions.
// Pure (structural inputs) so the rules are unit-testable.
//
// Severity: 3 = act now (red), 2 = look today (orange), 1 = worth a glance (yellow).
// Every finding pairs the reason with a suggested next step, shown in the status-dot popup.

import { WIDE_SPREAD_PCT } from './market-facts.js'

export interface AttentionInput {
  tradeId: string
  ticker: string
  strategy: string
  /** Days to expiration; null when no expiration applies. */
  dte: number | null
  /** Active short strike, when one exists. */
  shortStrike: number | null
  flavor: 'call' | 'put' | null
  /** Current underlying price; null when unavailable. */
  spot: number | null
  /** Trade carries net short option exposure. */
  isShortPremium: boolean
  /** Net credit collected (max profit for pure credit trades); null otherwise. */
  netCredit: number | null
  /** Current mark-to-market P&L; null when the position has no reliable mark. */
  unrealizedPL: number | null
  /** Next earnings on or before expiry, with days from today; null when none is known. */
  earnings?: { date: string; daysAway: number } | null
  /** Bid/ask width as % of the position's value (Schwab quote); null when unknown. */
  spreadPct?: number | null
  /** Assigned shares held without a covered call. */
  uncoveredShares?: boolean
}

export type AttentionSeverity = 1 | 2 | 3

export interface AttentionFinding {
  severity: AttentionSeverity
  /** What the app found (facts only). */
  reason: string
  /** A suggested next step; the trader decides. */
  action: string
}

export interface AttentionItem {
  tradeId: string
  ticker: string
  strategy: string
  severity: AttentionSeverity
  dte: number | null
  /** Most severe first; ties keep rule order. */
  findings: AttentionFinding[]
  reasons: string[]
}

const NEAR_MONEY_PCT = 0.02
const EXPIRY_URGENT_DAYS = 2
const EXPIRY_SOON_DAYS = 7
const MANAGEMENT_DTE = 21
const TAKE_PROFIT_PCT = 0.75
/** Earnings this close lift the finding from "worth a glance" to "look today". */
const EARNINGS_SOON_DAYS = 7

export function evaluateAttention(rows: AttentionInput[]): AttentionItem[] {
    const items: AttentionItem[] = []

    for (const row of rows) {
        const findings: AttentionFinding[] = []
        const add = (severity: AttentionSeverity, reason: string, action: string): void => {
            findings.push({ severity, reason, action })
        }

        if (row.dte !== null && row.dte >= 0) {
            if (row.dte <= EXPIRY_URGENT_DAYS) {
                add(3, row.dte === 0 ? 'expires today' : `expires in ${row.dte}d`, row.isShortPremium
                    ? 'Decide before the close: take it off, roll it out, or let it expire only if it is safely out of the money (watch pin risk near the strike).'
                    : 'Decide before the close: sell to close or let it expire.')
            } else if (row.dte <= EXPIRY_SOON_DAYS) {
                add(2, `expires in ${row.dte}d`, 'Plan the exit this week: close or roll before gamma picks up in the last days.')
            } else if (row.dte <= MANAGEMENT_DTE && row.isShortPremium) {
                add(1, `past the 21-DTE management point (${row.dte} DTE)`, 'Manage it: take the profit or roll out in time; gamma risk grows from here.')
            }
        }

        if (row.shortStrike !== null && row.spot !== null && row.flavor !== null && row.spot > 0) {
            const leg = `${row.shortStrike}${row.flavor === 'put' ? 'P' : 'C'}`
            const itm = row.flavor === 'put' ? row.spot < row.shortStrike : row.spot > row.shortStrike
            const distance = Math.abs(row.spot - row.shortStrike) / row.shortStrike
            if (itm) {
                add(3, `short ${leg} ITM by $${Math.abs(row.spot - row.shortStrike).toFixed(2)}`,
                    row.flavor === 'put'
                        ? 'Tested: roll down and out for a net credit, close it, or be ready to take the shares.'
                        : 'Tested: roll up and out for a net credit, close it, or be ready to deliver the shares.')
            } else if (distance <= NEAR_MONEY_PCT) {
                add(2, `spot within 2% of short ${leg}`, 'Set your line: decide now at which price you roll or close if the strike is touched.')
            }
        }

        if (row.netCredit !== null && row.netCredit > 0
            && row.unrealizedPL !== null && row.unrealizedPL > 0) {
            const pct = row.unrealizedPL / row.netCredit
            if (pct >= TAKE_PROFIT_PCT && pct <= 1.5) {
                add(1, `${Math.round(Math.min(pct, 1) * 100)}% of max profit — take-profit candidate`,
                    'Consider closing to lock in the gain: the little premium left rarely pays for the risk still open.')
            }
        }

        const earnings = row.earnings
        if (earnings && earnings.daysAway >= 0 && (row.dte === null || earnings.daysAway <= row.dte)) {
            add(earnings.daysAway <= EARNINGS_SOON_DAYS ? 2 : 1,
                `earnings ${earnings.date} (${earnings.daysAway === 0 ? 'today' : `in ${earnings.daysAway}d`}), before expiry`,
                'Earnings gap risk: close or roll past the date, reduce size, or hold knowing the move can jump your strike.')
        }

        if (row.spreadPct !== null && row.spreadPct !== undefined && row.spreadPct > WIDE_SPREAD_PCT) {
            add(1, `bid/ask ${row.spreadPct}% of the position's value`, 'Exits are costly: work a limit order near the mid, never a market order.')
        }

        if (row.uncoveredShares) {
            add(1, 'shares without a covered call', 'Sell a covered call against the shares, or decide to hold them uncovered on purpose.')
        }

        if (findings.length) {
            findings.sort((a, b) => b.severity - a.severity)
            items.push({
                tradeId: row.tradeId,
                ticker: row.ticker,
                strategy: row.strategy,
                severity: findings[0].severity,
                dte: row.dte,
                findings,
                reasons: findings.map(f => f.reason)
            })
        }
    }

    return items.sort((a, b) => b.severity - a.severity
        || (a.dte ?? Number.MAX_SAFE_INTEGER) - (b.dte ?? Number.MAX_SAFE_INTEGER))
}
