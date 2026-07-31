// src/ui/charts/last-activity.ts — "Last realized activity" headline tile.
// Uses the .call(this, …) delegation pattern.

interface TradeLike { ticker?: unknown }

interface LastActivitySummary {
  realizedByDate: Map<string, number>
}

interface LastActivityContext {
  trades: TradeLike[]
  summarizeLegRealization(trade: TradeLike): LastActivitySummary
  formatCurrency(value: unknown, opts?: Record<string, unknown>): string
}

function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

/** 'YYYY-MM-DD' → 'Tue Jul 28 2026'. Empty string when unparseable. */
function formatLongDate(isoDate: string): string {
    const parsed = new Date(`${isoDate}T00:00:00Z`)
    if (Number.isNaN(parsed.getTime())) return ''
    return parsed.toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
    })
}

export function renderLastActivity(this: LastActivityContext): void {
    const root = document.getElementById('last-activity-summary')
    if (!root) return

    // Realized total per date, and per (date, ticker), across every trade.
    const totals = new Map<string, number>()
    const byTicker = new Map<string, Map<string, number>>()

    for (const trade of this.trades) {
        const ticker = String(trade.ticker ?? '').trim().toUpperCase() || 'UNKNOWN'
        for (const [date, amount] of this.summarizeLegRealization(trade).realizedByDate) {
            if (!date) continue
            totals.set(date, (totals.get(date) ?? 0) + amount)
            let perTicker = byTicker.get(date)
            if (!perTicker) {
                perTicker = new Map<string, number>()
                byTicker.set(date, perTicker)
            }
            perTicker.set(ticker, (perTicker.get(ticker) ?? 0) + amount)
        }
    }

    if (!totals.size) {
        root.innerHTML = `<span class="last-activity__empty">No realized activity yet</span>`
        return
    }

    // The most recent date WITH activity — not today. A dormant day showing
    // $0.00 answers nothing.
    const latest = [...totals.keys()].sort().pop() as string
    const total = totals.get(latest) ?? 0
    const contributors = [...(byTicker.get(latest) ?? new Map<string, number>()).entries()]
        .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))

    const shown = contributors.slice(0, 3)
    const hidden = contributors.length - shown.length
    const sign = (value: number) => (value >= 0 ? '+' : '')
    const parts = shown.map(([ticker, amount]) =>
        `${escapeHtml(ticker)} ${sign(amount)}${escapeHtml(this.formatCurrency(amount))}`)
    if (hidden > 0) parts.push(`+${hidden} more`)

    const toneClass = total > 0 ? 'rv-pos' : total < 0 ? 'rv-neg' : 'rv'

    root.innerHTML = `
      <div class="last-activity__head">
        <span class="last-activity__label">Last realized activity · ${escapeHtml(formatLongDate(latest))}</span>
        <span class="last-activity__value ${toneClass}">${sign(total)}${escapeHtml(this.formatCurrency(total))}</span>
      </div>
      <div class="last-activity__detail">${parts.join(' · ')}</div>
    `
}
