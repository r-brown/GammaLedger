// src/ui/dashboard/concentration.ts — Horizontal collateral concentration map.
// Uses the .call(this, …) delegation pattern.

import { APP_CONFIG } from '@core/config.js'
import type { Stats, RiskBand } from '@types-gl/stats'

interface ConcentrationContext {
  formatCurrency(value: unknown, opts?: Record<string, unknown>): string
  createTickerElement(ticker: unknown, className?: string, opts?: Record<string, unknown>): HTMLElement
  openTradesFilteredByTicker(ticker: unknown): void
}

const BAND_CLASS: Record<RiskBand, string> = {
    critical: 'conc-bar--critical',
    high: 'conc-bar--high',
    caution: 'conc-bar--caution',
    ok: 'conc-bar--ok'
}

function escapeHtml(s: string): string {
    return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] as string))
}

export function renderConcentration(this: ConcentrationContext, stats: Stats): void {
    const root = document.getElementById('collateral-concentration')
    if (!root) return

    const rules = APP_CONFIG.RISK_RULES
    const total = stats.collateralAtRisk
    const fmt$ = (v: number) => escapeHtml(this.formatCurrency(v, { decimals: 0 }))

    if (!stats.collateralByTicker.length) {
        root.innerHTML = `<h3>Collateral Concentration</h3><div class="concentration-empty">No open positions.</div>`
        return
    }

    const rows = stats.collateralByTicker.map(row => {
        const widthPct = Math.max(0, Math.min(100, row.share * 100))
        const sharePct = (row.share * 100).toFixed(1)
        const flag = row.band !== 'ok' ? ' &#x26A0;' : ''
        return `
          <div class="conc-row">
            <span class="conc-ticker" data-ticker="${escapeHtml(row.ticker)}"></span>
            <div class="conc-bar-wrap"><div class="conc-bar ${escapeHtml(BAND_CLASS[row.band])}" style="width:${widthPct}%"></div></div>
            <span class="conc-pct conc-pct--${escapeHtml(String(row.band))}">${sharePct}%${flag}</span>
            <span class="conc-amount">${fmt$(row.capital)}</span>
          </div>
        `
    }).join('')

    root.innerHTML = `
      <h3>Collateral Concentration</h3>
      ${rows}
      <div class="conc-legend">
        <span><span class="conc-swatch conc-swatch--critical"></span>Critical (&gt;${rules.CRITICAL_SHARE_PCT}%)</span>
        <span><span class="conc-swatch conc-swatch--high"></span>High (&gt;${rules.TARGET_SHARE_PCT}%)</span>
        <span><span class="conc-swatch conc-swatch--ok"></span>On target (&le;${rules.TARGET_SHARE_PCT}%)</span>
        <span class="conc-rule">Rule: &le;${rules.TARGET_SHARE_PCT}% / $${rules.MAX_COLLATERAL_PER_TRADE_USD} per trade</span>
      </div>
    `

    root.querySelectorAll<HTMLElement>('.conc-ticker[data-ticker]').forEach(slot => {
        const ticker = slot.dataset.ticker || ''
        const link = this.createTickerElement(ticker, 'ticker-pill', {
            behavior: 'filter',
            onClick: (value: unknown) => this.openTradesFilteredByTicker(value),
            title: ticker ? `View all trades for ${ticker}` : ''
        })
        slot.replaceChildren(link)
    })
}
