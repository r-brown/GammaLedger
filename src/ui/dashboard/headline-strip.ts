// src/ui/dashboard/headline-strip.ts — headline numbers (Total P&L, Realized, capital at
// risk, Θ/day). Uses the .call(this, …) delegation pattern.

import { computePortfolioGreeks, type PortfolioGreeksContext } from './portfolio-greeks.js'
import type { Stats } from '@types-gl/stats'

interface HeadlineContext extends PortfolioGreeksContext {
  hasAssignedInventory(trade: Record<string, unknown>): boolean
  computeWheelEffectiveCostBasis(trade: Record<string, unknown>): { shares: number; assignmentCostBasis: number; effectiveCostBasis: number }
}

function escapeHtml(s: string): string {
    return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] as string))
}

function signClass(v: number): string {
    return v > 0 ? 'rv-pos' : v < 0 ? 'rv-neg' : 'rv'
}

export function renderHeadlineStrip(this: HeadlineContext, stats: Stats): void {
    const root = document.getElementById('headline-strip')
    if (!root) return

    const money = (v: number, signed = false) => escapeHtml(this.formatCurrency(v, { signed, decimals: 0 }))
    const total = stats.realizedPL + stats.unrealizedPL
    const coverage = stats.unrealizedQuoteCoverage ?? { marked: 0, total: 0 }
    const unquoted = coverage.total - coverage.marked
    const isEstimate = unquoted > 0
    const totalNote = isEstimate
        ? `incl. ${money(stats.unrealizedPL, true)} unrealized: ${unquoted} of ${coverage.total} open positions at full credit, not marked to market`
        : 'all open positions marked to market'
    const greeks = computePortfolioGreeks.call(this, stats)
    const theta = greeks ? greeks.thetaPerDay : null

    const cell = (label: string, value: string, cls: string, note: string, estimate = false) => `
      <div class="headline-cell${estimate ? ' is-estimate' : ''}">
        <span class="headline-label">${escapeHtml(label)}${estimate ? ' <span class="estimate-tag">Estimate</span>' : ''}</span>
        <span class="headline-value ${cls}">${value}</span>
        <span class="headline-note">${escapeHtml(note)}</span>
      </div>`

    root.innerHTML =
        cell('Total P&L', money(total, true), signClass(total), totalNote, isEstimate) +
        cell('Realized', money(stats.realizedPL, true), signClass(stats.realizedPL), 'booked, leg-level') +
        cell('Capital at risk', money(stats.collateralAtRisk), 'rv', `${stats.activePositions} active positions`) +
        cell('Θ / day', theta === null ? '—' : money(theta, true), theta === null ? 'rv' : signClass(theta), 'estimated, flat-IV model')
}

/** Held shares from assigned wheels/PMCCs: shares, effective cost basis per share vs mark. */
export function renderInventoryStrip(this: HeadlineContext, stats: Stats): void {
    const root = document.getElementById('inventory-strip')
    if (!root) return

    const held = ((stats.assignedTradesList ?? []) as unknown as Array<Record<string, unknown>>)
        .filter(trade => this.hasAssignedInventory(trade) && Number(trade.shares) > 0)
    root.hidden = held.length === 0
    if (held.length === 0) {
        root.innerHTML = ''
        return
    }

    const money = (v: unknown, signed = false) => {
        const n = Number(v)
        return Number.isFinite(n) ? escapeHtml(this.formatCurrency(n, { signed })) : '—'
    }
    root.innerHTML = `
      <h3>Assigned inventory</h3>
      <table class="inventory-table">
        <thead><tr><th scope="col">Ticker</th><th scope="col">Shares</th><th scope="col">Cost basis / sh</th><th scope="col">Market value</th><th scope="col">Unrealized (shares)</th></tr></thead>
        <tbody>${held.map(t => {
            // Share-only: mark vs what the stock cost. Premium is already in Realized,
            // so netting it into this number would count it twice.
            const stockCost = this.computeWheelEffectiveCostBasis(t).assignmentCostBasis
            const marked = t.marketPriceSource !== 'fallback-strike'
            const pl = marked ? Number(t.marketValue) - stockCost : NaN
            return `<tr>
              <th scope="row">${escapeHtml(String(t.ticker ?? ''))}</th>
              <td>${escapeHtml(String(t.shares))}</td>
              <td>${money(Number(t.effectiveCostBasis) / Number(t.shares))}</td>
              <td>${money(t.marketValue)}</td>
              <td class="${Number.isFinite(pl) ? signClass(pl) : 'rv'}"${marked ? '' : ' title="No quote for this ticker"'}>${money(pl, true)}</td>
            </tr>`
        }).join('')}</tbody>
      </table>
      <p class="expiry-caption">Cost basis is net of option premium collected on the cycle. Unrealized compares the mark with the stock's purchase cost.</p>`
}
