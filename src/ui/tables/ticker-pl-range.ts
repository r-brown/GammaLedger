// src/ui/tables/ticker-pl-range.ts — range-scoped realized overlay for the
// Ticker P&L view.
//
// WHY LEG-LEVEL: filtering whole trades by closedDate misattributes a trade
// closed in August whose contract groups terminated in July. realizedByDate
// carries the true termination date per group, so the window filter is applied
// there. The stock-side residual (assigned shares sold, PMCC long legs) has no
// per-leg date, so it stays attributed to closedDate — exactly how the
// performance-trend chart attributes it, which keeps the two views consistent.
//
// Unrealized is NEVER scoped: GammaLedger stores no historical position marks,
// so the only honest answer for any window is the current mark.

import { normalizeTickerKey } from '@calculations/stats.js'
import type { TickerPLRow } from '@types-gl/stats'

interface TradeLike { ticker?: unknown; status?: unknown; closedDate?: unknown; openedDate?: unknown }

interface RangeScopeContext {
  trades: TradeLike[]
  cumulativePLRange: string
  summarizeLegRealization(trade: TradeLike): { realizedByDate: Map<string, number> }
  getCumulativePLRangeWindow(range: string): { start: Date | null; end: Date | null }
  isClosedStatus(status: unknown): boolean
  calculateRealizedPL(trade: TradeLike): number
}

/** Header suffix for the active range. '' for ALL (header stays plain 'Realized'). */
export function rangeLabelFor(range: string): string {
    const normalized = String(range).toUpperCase()
    return normalized === 'ALL' ? '' : ` (${normalized})`
}

/** 'YYYY-MM-DD' from a Date's LOCAL calendar fields. Using toISOString() here
 *  would shift the window by a day for any non-UTC offset, because the range
 *  window is built from local midnight / local end-of-day. */
function dayKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function toFiniteNumber(value: unknown): number {
    const numeric = Number(value)
    return Number.isFinite(numeric) ? numeric : 0
}

/**
 * Replace each row's realized figures with the portion realized inside the
 * active range window. Returns rows re-sorted by |totalPL| desc.
 * For the ALL range the input is returned unchanged, preserving the
 * reconciliation invariant asserted against calculateAdvancedStats.
 */
export function scopeRealizedToRange(
    this: RangeScopeContext,
    rows: TickerPLRow[]
): TickerPLRow[] {
    const { start, end } = this.getCumulativePLRangeWindow(this.cumulativePLRange)
    if (!start && !end) return rows

    const startKey = start ? dayKey(start) : ''
    const endKey = end ? dayKey(end) : '9999-12-31'
    const inWindow = (date: string) => Boolean(date) && date >= startKey && date <= endKey

    const inRangeByTicker = new Map<string, number>()
    const add = (ticker: string, amount: number) => {
        inRangeByTicker.set(ticker, (inRangeByTicker.get(ticker) ?? 0) + amount)
    }

    for (const trade of this.trades) {
        const ticker = normalizeTickerKey(trade.ticker)
        let totalOptionCF = 0
        for (const [date, amount] of this.summarizeLegRealization(trade).realizedByDate) {
            totalOptionCF += amount
            if (inWindow(date)) add(ticker, amount)
        }

        // Stock-side residual: whatever calculateRealizedPL books beyond the
        // option cash flows. Dropping it would understate every wheel that
        // realized share P&L inside the window.
        if (this.isClosedStatus(trade.status)) {
            const stockPL = toFiniteNumber(this.calculateRealizedPL(trade)) - totalOptionCF
            if (Math.abs(stockPL) > 0.01) {
                const closedDate = String(trade.closedDate ?? trade.openedDate ?? '').slice(0, 10)
                if (inWindow(closedDate)) add(ticker, stockPL)
            }
        }
    }

    return rows
        .map(row => {
            const realizedPL = inRangeByTicker.get(row.ticker) ?? 0
            const totalPL = realizedPL + row.unrealizedPL
            return {
                ...row,
                realizedPL,
                closedPL: realizedPL,
                openRealizedPL: 0,
                totalPL,
                returnOnCapital: row.capitalDeployed > 0 ? totalPL / row.capitalDeployed : null,
            }
        })
        .sort((a, b) => Math.abs(b.totalPL) - Math.abs(a.totalPL))
}
