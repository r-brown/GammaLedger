// src/ui/dashboard/grouped-metrics.ts — Four-column grouped metric panel (bridge + 3 metric cols).
// Uses the .call(this, …) delegation pattern.

import { APP_CONFIG } from '@core/config.js'
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

    const row = (
        label: string,
        sub: string,
        value: number,
        bg: string,
        cls: string,
        title: string,
        isTotal = false
    ) => `
      <div class="bridge-row${isTotal ? ' bridge-total' : ''}" title="${escapeHtml(title)}">
        <div class="bridge-label"><span>${escapeHtml(label)}</span><small>${escapeHtml(sub)}</small></div>
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
        'Net option premium across every wheel/PMCC cycle (open + closed), net of buy-back debits and fees.\nMatches the sum of the "Premium" column on the Wheel/PMCC Tracker.\nCash-basis: a credit counts the moment the option is sold, regardless of whether the contract is still live.'
      )}
      ${row(
        '= Realized P&L',
        'closed + wheel premium',
        realized,
        'var(--color-bridge-realized-bg)',
        valClass(realized, 'rv-pur'),
        'Closed trades + Wheel premium. Identity holds by construction.\nCash-basis realized: includes premium collected on still-open wheel/PMCC cycles.',
        true
      )}
      ${row(
        '+ Unrealized',
        unrealizedSub,
        unrealized,
        'var(--color-bridge-unrealized-bg)',
        valClass(unrealized),
        'Mark-to-market on open positions, minus per-trade wheel premium already booked above (no double-count).\nIncludes share-side MTM on awaiting-coverage assigned wheels.\nFor trades without a live quote, falls back to raw cashflow — may understate buy-back obligation on short options.'
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

    root.innerHTML = `
      <div class="metric-col">
        ${buildBridgeColumn.call(this, stats)}
      </div>
      <div class="metric-col">
        <h3>Risk &amp; Exposure</h3>
        <div class="row"><span class="rl">Collateral at risk</span><span class="rv-warn">${fmt$(stats.collateralAtRisk)}</span></div>
        <div class="row"><span class="rl">Top-ticker concentration</span><span class="${topOver ? 'rv-warn' : 'rv'}">${topLabel}${topOver ? ` <span class="chip chip-warn">&#x26A0; limit ${APP_CONFIG.RISK_RULES.TARGET_SHARE_PCT}%</span>` : ''}</span></div>
        <div class="row"><span class="rl">Active positions</span><span class="rv">${escapeHtml(String(stats.activePositions))} / ${APP_CONFIG.RISK_RULES.TARGET_POSITION_COUNT}</span></div>
        <div class="row"><span class="rl">Assigned (Wheel/PMCC)</span><span class="rv">${escapeHtml(String(stats.assignedPositions))} positions</span></div>
        <div class="row"><span class="rl">Max drawdown</span><span class="${stats.maxDrawdown > 20 ? 'rv-neg' : 'rv-warn'}">${stats.maxDrawdown.toFixed(1)}%</span></div>
      </div>
      <div class="metric-col">
        <h3>Trade Quality</h3>
        <div class="row"><span class="rl">Total ROI</span><span class="${plClass(stats.totalROI)}">${fmtPct(stats.totalROI)}</span></div>
        <div class="row"><span class="rl">Win rate</span><span class="rv-pos">${stats.winRate.toFixed(1)}%</span></div>
        <div class="win-bar-wrap"><div class="win-bar" style="width:${Math.max(0, Math.min(100, stats.winRate))}%"></div></div>
        <div class="win-bar-foot"><span>${escapeHtml(String(stats.wins))}W</span><span>${escapeHtml(String(stats.losses))}L</span></div>
        <div class="row"><span class="rl">Avg win / avg loss</span><span class="rv"><span class="rv-pos">${fmt$(stats.avgWin)}</span> / <span class="rv-neg">${fmt$(stats.avgLoss)}</span></span></div>
        <div class="row"><span class="rl">Risk / Reward ratio</span><span class="${rrInverted ? 'rv-neg' : 'rv'}">${rrText}${rrInverted ? ' <span class="chip chip-warn">inverted</span>' : ''}</span></div>
        <div class="row"><span class="rl">Profit factor</span><span class="rv">${pf}</span></div>
        <div class="row"><span class="rl">Expectancy</span><span class="${plClass(stats.expectancy)}">${fmt$(stats.expectancy)} / trade</span></div>
        <div class="row"><span class="rl">Sharpe ratio</span><span class="rv">${sharpe}</span></div>
      </div>
      <div class="metric-col" id="collateral-concentration"></div>
    `
}
