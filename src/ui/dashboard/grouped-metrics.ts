// src/ui/dashboard/grouped-metrics.ts — Three-column grouped metric panel.
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

function ytdRealized(closed: EnrichedTrade[]): number {
    const year = new Date().getUTCFullYear()
    let sum = 0
    for (const t of closed) {
        const d = String((t as { closedDate?: unknown }).closedDate ?? '')
        if (d.length < 4) continue
        if (Number(d.slice(0, 4)) !== year) continue
        const pl = Number((t as { pl?: unknown }).pl)
        if (Number.isFinite(pl)) sum += pl
    }
    return sum
}

function plClass(v: number): string {
    if (v > 0) return 'rv-pos'
    if (v < 0) return 'rv-neg'
    return 'rv'
}

export function renderGroupedMetrics(this: GroupedMetricsContext, stats: Stats): void {
    const root = document.getElementById('grouped-metrics')
    if (!root) return

    const fmt$ = (v: number) => this.formatCurrency(v)
    const fmtPct = (v: number) => this.formatNumber(v, { style: 'percent', decimals: 1 }) ?? '0%'

    const top = stats.collateralByTicker[0]
    const topShare = top ? top.share * 100 : 0
    const topLabel = top ? `${escapeHtml(top.ticker)} ${topShare.toFixed(1)}%` : '—'
    const topOver = !!top && top.band !== 'ok'

    const rrRatio = stats.avgWin > 0 ? stats.avgLoss / stats.avgWin : 0
    const rrText = rrRatio > 0 ? `1 : ${rrRatio.toFixed(2)}` : '—'
    const rrInverted = rrRatio > 1

    const ytd = ytdRealized(stats.closedTradesList)
    const cumulative = stats.closedTradesPL

    const sharpe = Number.isFinite(stats.sharpeRatio) ? stats.sharpeRatio.toFixed(2) : '—'
    const pf = Number.isFinite(stats.profitFactor) ? stats.profitFactor.toFixed(2) : '∞'

    root.innerHTML = `
      <div class="metric-col">
        <div class="metric-col-head">P&amp;L performance</div>
        <div class="row"><span class="rl">Realized P&amp;L</span><span class="rv-pur">${fmt$(stats.realizedPL)}</span></div>
        <div class="row"><span class="rl">Unrealized P&amp;L</span><span class="${plClass(stats.unrealizedPL)}">${fmt$(stats.unrealizedPL)}</span></div>
        <div class="row"><span class="rl">YTD P&amp;L</span><span class="${plClass(ytd)}">${fmt$(ytd)}</span></div>
        <div class="row"><span class="rl">Cumulative (all-time)</span><span class="${plClass(cumulative)}">${fmt$(cumulative)}</span></div>
        <div class="row"><span class="rl">Total ROI</span><span class="${plClass(stats.totalROI)}">${fmtPct(stats.totalROI)}</span></div>
      </div>
      <div class="metric-col">
        <div class="metric-col-head">Risk &amp; exposure</div>
        <div class="row"><span class="rl">Collateral at risk</span><span class="rv-warn">${fmt$(stats.collateralAtRisk)}</span></div>
        <div class="row"><span class="rl">Top-ticker concentration</span><span class="${topOver ? 'rv-warn' : 'rv'}">${topLabel}${topOver ? ` <span class="chip chip-warn">&#x26A0; limit ${APP_CONFIG.RISK_RULES.TARGET_SHARE_PCT}%</span>` : ''}</span></div>
        <div class="row"><span class="rl">Active positions</span><span class="rv">${stats.activePositions} / ${APP_CONFIG.RISK_RULES.TARGET_POSITION_COUNT}</span></div>
        <div class="row"><span class="rl">Assigned (Wheel/PMCC)</span><span class="rv">${stats.assignedPositions} positions</span></div>
        <div class="row"><span class="rl">Max drawdown</span><span class="${stats.maxDrawdown > 20 ? 'rv-neg' : 'rv-warn'}">${stats.maxDrawdown.toFixed(1)}%</span></div>
      </div>
      <div class="metric-col">
        <div class="metric-col-head">Trade quality</div>
        <div class="row"><span class="rl">Win rate</span><span class="rv-pos">${stats.winRate.toFixed(1)}%</span></div>
        <div class="win-bar-wrap"><div class="win-bar" style="width:${Math.max(0, Math.min(100, stats.winRate))}%"></div></div>
        <div class="win-bar-foot"><span>${stats.wins}W</span><span>${stats.losses}L</span></div>
        <div class="row"><span class="rl">Avg win / avg loss</span><span class="rv"><span class="rv-pos">${fmt$(stats.avgWin)}</span> / <span class="rv-neg">${fmt$(stats.avgLoss)}</span></span></div>
        <div class="row"><span class="rl">Risk:reward ratio</span><span class="${rrInverted ? 'rv-neg' : 'rv'}">${rrText}${rrInverted ? ' <span class="chip chip-warn">inverted</span>' : ''}</span></div>
        <div class="row"><span class="rl">Profit factor</span><span class="rv">${pf}</span></div>
        <div class="row"><span class="rl">Expectancy</span><span class="${plClass(stats.expectancy)}">${fmt$(stats.expectancy)} / trade</span></div>
        <div class="row"><span class="rl">Sharpe ratio</span><span class="rv">${sharpe}</span></div>
      </div>
    `
}
