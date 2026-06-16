// src/ui/dashboard/bridge.ts — P&L decomposition bridge widget.
// Uses the .call(this, …) delegation pattern.

import type { EnrichedTrade } from '@types-gl/trade'
import type { Stats } from '@types-gl/stats'

interface BridgeContext {
  formatCurrency(value: unknown, opts?: Record<string, unknown>): string
  calculateRealizedPL(trade: EnrichedTrade): number
}

interface PerTickerPremium { ticker: string; amount: number }

function escapeHtml(s: string): string {
    return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] as string))
}

function premiumByTicker(this: BridgeContext, assigned: EnrichedTrade[]): PerTickerPremium[] {
    const m = new Map<string, number>()
    for (const t of assigned) {
        const ticker = String((t as { ticker?: unknown }).ticker ?? '').trim() || '—'
        const pl = Number(this.calculateRealizedPL(t))
        if (!Number.isFinite(pl)) continue
        m.set(ticker, (m.get(ticker) ?? 0) + pl)
    }
    return Array.from(m.entries())
        .map(([ticker, amount]) => ({ ticker, amount }))
        .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
}

function bar(widthPct: number, bg: string, fg: string, label: string): string {
    const w = Math.max(0, Math.min(100, widthPct))
    return `<div class="bridge-bar" style="width:${w}%;background:${bg};color:${fg}">${escapeHtml(label)}</div>`
}

export function renderBridge(this: BridgeContext, stats: Stats): void {
    const root = document.getElementById('pl-bridge')
    if (!root) return

    const closed = stats.closedTradesPL
    const wheel = stats.wheelAssignedPremium
    const openRealized = stats.openTradeRealizedPL
    const realized = stats.realizedPL
    const unrealized = stats.unrealizedPL
    const total = realized + unrealized
    const scale = Math.max(Math.abs(closed), Math.abs(realized), Math.abs(total), 1)
    const fmt = (v: number) => escapeHtml(this.formatCurrency(v))

    const assigned = (stats.assignedTradesList ?? []) as EnrichedTrade[]
    const ticks = premiumByTicker.call(this, assigned)
    const top = ticks.slice(0, 4)
    const rest = ticks.slice(4)
    const restSum = rest.reduce((s, x) => s + x.amount, 0)
    const restLabel = rest.length ? rest.map(t => t.ticker).join(' · ') : ''

    root.innerHTML = `
      <div class="bridge-grid">
        <div>
          <div class="bridge-caption">How realized P&amp;L is built</div>
          <div class="bridge-row">
            <div class="bridge-label"><span>Closed trades</span><small>${escapeHtml(String(stats.closedTrades))} closed</small></div>
            <div class="bridge-bar-area">${bar((Math.abs(closed)/scale)*100, 'var(--color-bridge-closed-bg)', 'var(--color-bridge-closed-fg)', fmt(closed))}<span class="bridge-val">${fmt(closed)}</span></div>
          </div>
          <div class="bridge-row">
            <div class="bridge-label"><span>+ Wheel premium</span><small>${escapeHtml(String(assigned.length))} assigned</small></div>
            <div class="bridge-bar-area">${bar((Math.abs(wheel)/scale)*100, 'var(--color-bridge-wheel-bg)', 'var(--color-bridge-wheel-fg)', '+' + fmt(wheel))}<span class="bridge-val">${fmt(wheel)}</span></div>
          </div>
          <div class="bridge-row">
            <div class="bridge-label"><span>+ Open-trade realized</span><small>terminated legs, open positions</small></div>
            <div class="bridge-bar-area">${bar((Math.abs(openRealized)/scale)*100, 'var(--color-bridge-wheel-bg)', 'var(--color-bridge-wheel-fg)', (openRealized >= 0 ? '+' : '') + fmt(openRealized))}<span class="bridge-val">${fmt(openRealized)}</span></div>
          </div>
          <div class="bridge-row bridge-total">
            <div class="bridge-label"><strong>= Realized P&amp;L</strong><small>all completed option flows</small></div>
            <div class="bridge-bar-area">${bar((Math.abs(realized)/scale)*100, 'var(--color-bridge-realized-bg)', 'var(--color-bridge-realized-fg)', fmt(realized))}<span class="bridge-val bridge-val-large">${fmt(realized)}</span></div>
          </div>
          <div class="bridge-row">
            <div class="bridge-label"><span>+ Unrealized</span><small>${escapeHtml(String(stats.activePositions))} open positions MTM</small></div>
            <div class="bridge-bar-area">${bar((Math.abs(unrealized)/scale)*100, 'var(--color-bridge-unrealized-bg)', 'var(--color-bridge-unrealized-fg)', (unrealized >= 0 ? '+' : '') + fmt(unrealized))}<span class="bridge-val">${fmt(unrealized)}</span></div>
          </div>
          <div class="bridge-row bridge-total">
            <div class="bridge-label"><strong>= Total P&amp;L</strong><small>all-in portfolio view</small></div>
            <div class="bridge-bar-area">${bar((Math.abs(total)/scale)*100, 'var(--color-bridge-total-bg)', 'var(--color-bridge-total-fg)', fmt(total))}<span class="bridge-val bridge-val-large">${fmt(total)}</span></div>
          </div>
        </div>
        <div>
          <div class="bridge-caption">Why Cumulative (${fmt(closed)}) &ne; Realized (${fmt(realized)})</div>
          <div class="bridge-explainer">
            Cumulative P&amp;L tracks <em>fully exited</em> positions only. Realized adds option premiums earned on Wheel/PMCC cycles still holding shares, plus realized legs inside other open positions (PMCC short-call cycles, completed roll cycles).
          </div>
          ${top.length === 0
            ? `<div class="bridge-row"><span class="rl">No assigned wheel positions</span></div>`
            : top.map(t => `<div class="bridge-row"><span class="rl">${escapeHtml(t.ticker)} wheel premium</span><span class="rv-pos">${(t.amount >= 0 ? '+' : '') + fmt(t.amount)}</span></div>`).join('') +
              (rest.length ? `<div class="bridge-row"><span class="rl">${escapeHtml(restLabel)}</span><span class="rv-pos">${(restSum >= 0 ? '+' : '') + fmt(restSum)}</span></div>` : '')
          }
          <div class="bridge-row bridge-total"><span class="rl">= Realized P&amp;L</span><span class="rv-pos">${fmt(realized)}</span></div>
        </div>
      </div>
    `
}
