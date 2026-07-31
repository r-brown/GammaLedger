// src/calculations/ticker-pl.ts — per-ticker P&L row assembly.
//
// Deliberately dependency-free: callers flatten their domain objects into
// TickerPLInput, so this file needs no EnrichedTrade import and can be
// unit-tested standalone.
//
// RECONCILIATION CONTRACT: the caller must supply exactly the same per-trade
// values that build the dashboard bridge. Then, by construction:
//   sum(row.realizedPL)    == stats.realizedPL
//   sum(row.unrealizedPL)  == stats.unrealizedPL
//   sum(row.capitalAtRisk) == stats.collateralAtRisk
// Re-deriving P&L here instead would break that tie and is forbidden.

/** One trade's contribution to its ticker's row. */
export interface TickerPLInput {
    ticker: string
    /** Realized P&L when this trade is fully exited; 0 otherwise. */
    closedPL: number
    /** Realized P&L from terminated legs inside a still-open trade; 0 otherwise. */
    openRealizedPL: number
    /** Double-count-adjusted mark-to-market; 0 for fully-exited trades. */
    unrealizedPL: number
    /** Capital committed by this trade while OPEN; 0 when closed. */
    capitalAtRisk: number
    /** Capital this trade consumed, open or closed. */
    capitalDeployed: number
    isWin: boolean
    isLoss: boolean
    isClosed: boolean
    isOpen: boolean
    /** True when the position carries a real price (live quote or snapshot). */
    isMarked: boolean
}

export interface TickerPLRow {
    ticker: string
    closedPL: number
    openRealizedPL: number
    realizedPL: number
    unrealizedPL: number
    totalPL: number
    capitalAtRisk: number
    capitalDeployed: number
    /** Decimal (0.05 == 5%). Null when no capital was deployed. */
    returnOnCapital: number | null
    closedTrades: number
    openPositions: number
    wins: number
    losses: number
    /** Percent 0–100, over closed trades only. */
    winRate: number
    markedPositions: number
    unmarkedPositions: number
}

function blankRow(ticker: string): TickerPLRow {
    return {
        ticker,
        closedPL: 0, openRealizedPL: 0, realizedPL: 0,
        unrealizedPL: 0, totalPL: 0,
        capitalAtRisk: 0, capitalDeployed: 0, returnOnCapital: null,
        closedTrades: 0, openPositions: 0,
        wins: 0, losses: 0, winRate: 0,
        markedPositions: 0, unmarkedPositions: 0,
    }
}

function addFinite(current: number, value: number): number {
    return Number.isFinite(value) ? current + value : current
}

/** Aggregate per-trade contributions into per-ticker rows, sorted by |totalPL| desc. */
export function buildTickerPLRows(inputs: TickerPLInput[]): TickerPLRow[] {
    const byTicker = new Map<string, TickerPLRow>()

    for (const input of inputs) {
        const key = input.ticker
        let row = byTicker.get(key)
        if (!row) {
            row = blankRow(key)
            byTicker.set(key, row)
        }

        row.closedPL = addFinite(row.closedPL, input.closedPL)
        row.openRealizedPL = addFinite(row.openRealizedPL, input.openRealizedPL)
        row.unrealizedPL = addFinite(row.unrealizedPL, input.unrealizedPL)

        // Guard capital: an undefined-risk leg must never poison the denominator.
        if (Number.isFinite(input.capitalAtRisk) && input.capitalAtRisk > 0) {
            row.capitalAtRisk += input.capitalAtRisk
        }
        if (Number.isFinite(input.capitalDeployed) && input.capitalDeployed > 0) {
            row.capitalDeployed += input.capitalDeployed
        }

        if (input.isClosed) row.closedTrades += 1
        if (input.isOpen) {
            row.openPositions += 1
            if (input.isMarked) row.markedPositions += 1
            else row.unmarkedPositions += 1
        }
        if (input.isWin) row.wins += 1
        if (input.isLoss) row.losses += 1
    }

    for (const row of byTicker.values()) {
        row.realizedPL = row.closedPL + row.openRealizedPL
        row.totalPL = row.realizedPL + row.unrealizedPL
        row.winRate = row.closedTrades > 0 ? (row.wins / row.closedTrades) * 100 : 0
        row.returnOnCapital = row.capitalDeployed > 0
            ? row.totalPL / row.capitalDeployed
            : null
    }

    return [...byTicker.values()].sort((a, b) => Math.abs(b.totalPL) - Math.abs(a.totalPL))
}
