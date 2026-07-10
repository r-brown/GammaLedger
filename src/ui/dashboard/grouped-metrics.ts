// src/ui/dashboard/grouped-metrics.ts — Four-column grouped metric panel (bridge + 3 metric cols).
// Uses the .call(this, …) delegation pattern.

import { APP_CONFIG } from '@core/config.js'
import { infoPopoverIcon, infoPopoverTrigger, setupInfoPopovers } from './popover.js'
import type { EnrichedTrade } from '@types-gl/trade'
import type { Stats } from '@types-gl/stats'

interface GroupedMetricsContext {
  formatCurrency(value: unknown, opts?: Record<string, unknown>): string
  formatNumber(value: unknown, opts: Record<string, unknown>): string | null
}

function escapeHtml(s: string): string {
    return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] as string))
}

function bar(widthPct: number, bg: string, fg: string): string {
    const w = Math.max(0, Math.min(100, widthPct))
    return `<div class="bridge-bar" style="width:${w}%;background:${bg};color:${fg}"></div>`
}

// Sign-driven color, with an optional override applied only when the value is
// positive. Negative values always go red; zero stays neutral. This is what
// the bucket-color rows (Wheel premium, Realized) need: purple on profit,
// red on loss, never a misleading green.
function valClass(value: number, positiveOverride?: string): string {
    if (value < 0) return 'rv-neg'
    if (value > 0) return positiveOverride ?? 'rv-pos'
    return 'rv'
}

function buildBridgeColumn(this: GroupedMetricsContext, stats: Stats): string {
    const fmt = (v: number) => escapeHtml(this.formatCurrency(v))
    const closed = stats.closedTradesPL
    const wheel = stats.wheelAssignedPremium
    const openRealized = stats.openTradeRealizedPL
    const realized = stats.realizedPL
    const unrealized = stats.unrealizedPL
    const total = realized + unrealized
    const scale = Math.max(Math.abs(closed), Math.abs(realized), Math.abs(total), 1)

    const assignmentRecords = (stats.assignedTradesList ?? []) as EnrichedTrade[]
    const wheelOpen = stats.assignedPositions
    const wheelClosed = Math.max(0, assignmentRecords.length - wheelOpen)
    const awaitingCC = stats.awaitingCoveragePositions
    const fullyClosed = Math.max(0, stats.closedTrades - awaitingCC)
    const unrealizedPositions = stats.activePositions + awaitingCC

    const closedSub = awaitingCC > 0
        ? `${fullyClosed} closed · ${awaitingCC} awaiting CC`
        : `${fullyClosed} closed`

    const wheelSub = assignmentRecords.length === 0
        ? 'no wheel/PMCC cycles'
        : `${wheelOpen} open · ${wheelClosed} closed`

    const unrealizedSub = `${unrealizedPositions} ${unrealizedPositions === 1 ? 'position' : 'positions'} MTM`

    // Quote-coverage chip: how many of the positions behind this number carry
    // a real mark vs. raw cashflow (open short options at full credit).
    const coverage = stats.unrealizedQuoteCoverage ?? { marked: 0, total: 0, unmarkedTickers: [] }
    const unquoted = coverage.total - coverage.marked
    let coverageChip = ''
    if (coverage.total > 0) {
        const label = unquoted > 0
            ? `MTM ${coverage.marked}/${coverage.total} · ${unquoted} @ full credit`
            : `MTM ${coverage.marked}/${coverage.total}`
        const detail = unquoted > 0
            ? `${unquoted} of ${coverage.total} position${coverage.total === 1 ? '' : 's'} ha${unquoted === 1 ? 's' : 've'} no live quote and count at raw cashflow — open short options are valued at full credit (best case), which may understate the buy-back obligation.\nUnquoted: ${coverage.unmarkedTickers.join(', ') || '—'}\nAdd a Finnhub API key in Settings (or set a market-price snapshot on the trade) to mark these positions to market.`
            : `All ${coverage.total} open position${coverage.total === 1 ? ' is' : 's are'} marked to market with a live quote or snapshot price.`
        coverageChip = infoPopoverTrigger(label, detail, `chip mtm-chip${unquoted > 0 ? ' chip-warn' : ''}`)
    }

    const row = (
        label: string,
        sub: string,
        value: number,
        bg: string,
        cls: string,
        explanation: string,
        isTotal = false,
        extraLabelHtml = ''
    ) => `
      <div class="bridge-row${isTotal ? ' bridge-total' : ''}">
        <div class="bridge-label"><span>${escapeHtml(label)}&nbsp;${infoPopoverIcon(explanation)}${extraLabelHtml ? `&nbsp;${extraLabelHtml}` : ''}</span><small>${escapeHtml(sub)}</small></div>
        <div class="bridge-bar-area">
          ${bar((Math.abs(value) / scale) * 100, bg, 'transparent')}
          <span class="bridge-val${isTotal ? ' bridge-val-large' : ''} ${cls}">${fmt(value)}</span>
        </div>
      </div>`

    return `
      <h3>P&amp;L Performance</h3>
      ${row(
        'Closed trades',
        closedSub,
        closed,
        'var(--color-bridge-closed-bg)',
        valClass(closed),
        'Realized P&L from fully exited trades plus stock-side gains/losses from closed wheel cycles.\nExcludes option premium from wheel/PMCC cycles — that is shown separately on the next line as Wheel premium.\nAwaiting-coverage assigned wheels are listed here only to disclose count; their option premium lives in Wheel premium and their share-side MTM lives in Unrealized.'
      )}
      ${row(
        '+ Wheel premium',
        wheelSub,
        wheel,
        'var(--color-bridge-wheel-bg)',
        valClass(wheel, 'rv-pur'),
        'Net option premium across every wheel/PMCC cycle (open + closed), net of buy-back debits and fees.\nPremium realized to date on cycles still holding shares (an open short call counts once it expires or is bought back).\nCan be NEGATIVE after credit rolls: the buyback loss is realized now while the replacement contract\'s credit sits in "premium pending" until it terminates.\nThe Wheel/PMCC Tracker\'s "Premium" column is cash-basis (credits a short call the moment it is sold) so its total will be higher while open calls are live.'
      )}
      ${row(
        '+ Open-trade realized',
        'terminated legs, open positions',
        openRealized,
        'var(--color-bridge-wheel-bg)',
        valClass(openRealized, 'rv-pur'),
        'Realized P&L from terminated legs inside open positions — a PMCC\'s expired or bought-back short calls, completed roll cycles. The legs are done even though the position is not.\nOften NEGATIVE while rolling for credit: each buyback locks in that contract\'s loss immediately, while the replacement contract\'s larger credit stays in "premium pending" until it expires or is bought back. See the Open premium pending row.'
      )}
      ${row(
        '= Realized P&L',
        'closed + wheel + open-trade realized',
        realized,
        'var(--color-bridge-realized-bg)',
        valClass(realized, 'rv-pur'),
        'Closed trades + Wheel premium + Open-trade realized.\nRealized-basis: an open short call is not counted until the contract expires or is bought back.\nTax note: assigned-put premium is booked as realized income at assignment (trader convention). Tax reporting instead folds that premium into the stock cost basis, so 1099 realized figures may differ.',
        true
      )}
      ${row(
        '+ Unrealized',
        unrealizedSub,
        unrealized,
        'var(--color-bridge-unrealized-bg)',
        valClass(unrealized),
        'Mark-to-market on open positions, minus per-trade wheel premium already booked above (no double-count).\nIncludes share-side MTM on awaiting-coverage assigned wheels.\nFor trades without a live quote, falls back to raw cashflow — open short options count at full credit (as if expiring worthless), which may understate the buy-back obligation. The Open premium pending row shows how much of this is unearned premium.',
        false,
        coverageChip
      )}
      ${row(
        '= Total P&L',
        'all-in portfolio view',
        total,
        'var(--color-bridge-total-bg)',
        valClass(total),
        'Realized P&L + Unrealized P&L. Portfolio-wide view combining booked cash with MTM exposure on open positions.',
        true
      )}
    `
}

function plClass(v: number): string {
    if (v > 0) return 'rv-pos'
    if (v < 0) return 'rv-neg'
    return 'rv'
}

export function renderGroupedMetrics(this: GroupedMetricsContext, stats: Stats): void {
    const root = document.getElementById('grouped-metrics')
    if (!root) return

    const fmt$ = (v: number) => escapeHtml(this.formatCurrency(v))
    const fmtPct = (v: number) => escapeHtml(this.formatNumber(v, { style: 'percent', decimals: 1 }) ?? '0%')

    const top = stats.collateralByTicker[0]
    const topShare = top ? top.share * 100 : 0
    const topLabel = top ? `${escapeHtml(top.ticker)} ${topShare.toFixed(1)}%` : '—'
    const topOver = !!top && top.band !== 'ok'

    const rrRatio = stats.avgWin > 0 ? stats.avgLoss / stats.avgWin : 0
    const rrText = rrRatio > 0 ? `1 : ${rrRatio.toFixed(2)}` : '—'
    const rrInverted = rrRatio > 1

    const sharpe = Number.isFinite(stats.sharpeRatio) ? stats.sharpeRatio.toFixed(2) : '—'
    const pf = Number.isFinite(stats.profitFactor) ? stats.profitFactor.toFixed(2) : '∞'
    const anomalies = stats.realizationAnomalies.orphanCloseGroups + stats.realizationAnomalies.closeAfterExpiryLegs

    root.innerHTML = `
      <div class="metric-col">
        ${buildBridgeColumn.call(this, stats)}
      </div>
      <div class="metric-col">
        <h3>Risk &amp; Exposure</h3>
        <div class="row"><span class="rl">Collateral at risk</span><span class="rv-warn">${fmt$(stats.collateralAtRisk)}</span></div>
        <div class="row"><span class="rl">Open premium pending&nbsp;${infoPopoverIcon('Net cash already booked on open option contracts (credits minus debits, net of fees), grouped by expiration.\nCollected but NOT yet earned: it becomes Realized only when each contract expires worthless or is closed — buybacks and rolls will reduce it. This is the premium a CSP/wheel seller is still working for.')}</span><span class="${valClass(stats.pendingPremium, 'rv-pur')}">${fmt$(stats.pendingPremium)}</span></div>
        ${anomalies > 0 ? `<div class="row"><span class="rl">&#x26A0; Leg data anomalies&nbsp;${infoPopoverIcon(`The leg-realization engine found ${String(stats.realizationAnomalies.orphanCloseGroups)} option group(s) with more closing than opening contracts and ${String(stats.realizationAnomalies.closeAfterExpiryLegs)} closing leg(s) executed after their recorded expiration date.\nThis usually means a buyback leg carries the wrong expiration — its debit is realized immediately while the matching credit stays pending, understating realized P&L.\nFix: edit the trade and correct the closing leg's expiration date.`)}</span><span class="rv-neg">${escapeHtml(stats.realizationAnomalies.tickers.join(', '))}</span></div>` : ''}
        <div class="row"><span class="rl">Top-ticker concentration</span><span class="${topOver ? 'rv-warn' : 'rv'}">${topLabel}${topOver ? ` <span class="chip chip-warn">&#x26A0; limit ${APP_CONFIG.RISK_RULES.TARGET_SHARE_PCT}%</span>` : ''}</span></div>
        <div class="row"><span class="rl">Active positions</span><span class="rv">${escapeHtml(String(stats.activePositions))} / ${APP_CONFIG.RISK_RULES.TARGET_POSITION_COUNT}</span></div>
        <div class="row"><span class="rl">Assigned (Wheel/PMCC)</span><span class="rv">${escapeHtml(String(stats.assignedPositions))} positions</span></div>
        <div class="row"><span class="rl">Max drawdown&nbsp;${infoPopoverIcon('Largest peak-to-trough dip of the cumulative realized P&L curve, in trade-close order.\nThe percentage is relative to the P&L peak — not to account equity, since GammaLedger does not track account size.')}</span><span class="${stats.maxDrawdown > 20 ? 'rv-neg' : 'rv-warn'}">${fmt$(stats.maxDrawdownDollars)} (${stats.maxDrawdown.toFixed(1)}% of peak)</span></div>
      </div>
      <div class="metric-col">
        <h3>Trade Quality</h3>
        <div class="row"><span class="rl">Total ROI&nbsp;${infoPopoverIcon('Capital-days weighted average of per-trade annualized returns.\nUses simple (non-compounded) annualization — ROI × 365 ÷ days held — the options-industry convention for annualized return on collateral.')}</span><span class="${plClass(stats.totalROI)}">${fmtPct(stats.totalROI)}</span></div>
        <div class="row"><span class="rl">Win rate</span><span class="rv-pos">${stats.winRate.toFixed(1)}%</span></div>
        <div class="win-bar-wrap"><div class="win-bar" style="width:${Math.max(0, Math.min(100, stats.winRate))}%"></div></div>
        <div class="win-bar-foot"><span>${escapeHtml(String(stats.wins))}W</span><span>${escapeHtml(String(stats.losses))}L</span></div>
        <div class="row"><span class="rl">Avg win / avg loss</span><span class="rv"><span class="rv-pos">${fmt$(stats.avgWin)}</span> / <span class="rv-neg">${fmt$(stats.avgLoss)}</span></span></div>
        <div class="row"><span class="rl">Risk / Reward ratio</span><span class="${rrInverted ? 'rv-neg' : 'rv'}">${rrText}${rrInverted ? ' <span class="chip chip-warn">inverted</span>' : ''}</span></div>
        <div class="row"><span class="rl">Profit factor</span><span class="rv">${pf}</span></div>
        <div class="row"><span class="rl">Expectancy</span><span class="${plClass(stats.expectancy)}">${fmt$(stats.expectancy)} / trade</span></div>
        <div class="row"><span class="rl">Sharpe ratio (approx.)&nbsp;${infoPopoverIcon('Trade-level approximation: one daily-equivalent return per closed trade, annualized ×√252.\nIgnores position overlap (not a daily equity curve) and subtracts no risk-free rate — not comparable to fund-reported Sharpe ratios.')}</span><span class="rv">${sharpe}</span></div>
      </div>
      <div class="metric-col" id="collateral-concentration"></div>
    `

    setupInfoPopovers(root)
}
