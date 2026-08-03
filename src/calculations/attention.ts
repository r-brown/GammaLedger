// src/calculations/attention.ts — morning-checklist rules for open positions.
// Pure & dependency-free (structural inputs) so the rules are unit-testable.
//
// Severity: 3 = act now (red), 2 = look today (orange), 1 = worth a glance (yellow).

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
}

export interface AttentionItem {
  tradeId: string
  ticker: string
  strategy: string
  severity: 1 | 2 | 3
  dte: number | null
  reasons: string[]
}

const NEAR_MONEY_PCT = 0.02
const EXPIRY_URGENT_DAYS = 2
const EXPIRY_SOON_DAYS = 7
const MANAGEMENT_DTE = 21
const TAKE_PROFIT_PCT = 0.75

export function evaluateAttention(rows: AttentionInput[]): AttentionItem[] {
    const items: AttentionItem[] = []

    for (const row of rows) {
        const reasons: string[] = []
        let severity = 0

        const bump = (level: number, reason: string): void => {
            reasons.push(reason)
            severity = Math.max(severity, level)
        }

        if (row.dte !== null && row.dte >= 0) {
            if (row.dte <= EXPIRY_URGENT_DAYS) {
                bump(3, row.dte === 0 ? 'expires today' : `expires in ${row.dte}d`)
            } else if (row.dte <= EXPIRY_SOON_DAYS) {
                bump(2, `expires in ${row.dte}d`)
            } else if (row.dte <= MANAGEMENT_DTE && row.isShortPremium) {
                bump(1, `past the 21-DTE management point (${row.dte} DTE)`)
            }
        }

        if (row.shortStrike !== null && row.spot !== null && row.flavor !== null && row.spot > 0) {
            const itm = row.flavor === 'put' ? row.spot < row.shortStrike : row.spot > row.shortStrike
            const distance = Math.abs(row.spot - row.shortStrike) / row.shortStrike
            if (itm) {
                bump(3, `short ${row.shortStrike}${row.flavor === 'put' ? 'P' : 'C'} ITM by $${Math.abs(row.spot - row.shortStrike).toFixed(2)}`)
            } else if (distance <= NEAR_MONEY_PCT) {
                bump(2, `spot within 2% of short ${row.shortStrike}${row.flavor === 'put' ? 'P' : 'C'}`)
            }
        }

        if (row.netCredit !== null && row.netCredit > 0
            && row.unrealizedPL !== null && row.unrealizedPL > 0) {
            const pct = row.unrealizedPL / row.netCredit
            if (pct >= TAKE_PROFIT_PCT && pct <= 1.5) {
                bump(1, `${Math.round(Math.min(pct, 1) * 100)}% of max profit — take-profit candidate`)
            }
        }

        if (severity > 0) {
            items.push({
                tradeId: row.tradeId,
                ticker: row.ticker,
                strategy: row.strategy,
                severity: severity as 1 | 2 | 3,
                dte: row.dte,
                reasons
            })
        }
    }

    return items.sort((a, b) => b.severity - a.severity
        || (a.dte ?? Number.MAX_SAFE_INTEGER) - (b.dte ?? Number.MAX_SAFE_INTEGER))
}
