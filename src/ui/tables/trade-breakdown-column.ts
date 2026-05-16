// src/ui/tables/trade-breakdown-column.ts

import type { PersistedLeg } from '../../types/leg.js'

export interface BreakdownRow {
  num: number
  date: string
  dateSortKey: string
  action: string
  legType: string
  strike: number | null
  qty: number
  fees: number
  netCash: number
  cumulative: number
}

export interface BreakdownFormatters {
  formatCurrency(v: unknown): string
  formatDate(v: unknown): string
}

export interface BreakdownTrade {
  id?: string
  ticker?: string
  strategy?: string
  cashFlow?: number
  lifecycleStatus?: string
  legs?: PersistedLeg[]
}

const CREDIT_ACTIONS = new Set(['STO', 'STC'])
const DEBIT_ACTIONS = new Set(['BTO', 'BTC'])

function parseLegOrdinal(legId: string | undefined, fallback: number): number {
  if (typeof legId !== 'string') return fallback
  const match = legId.match(/L(\d+)$/i)
  return match ? Number(match[1]) : fallback
}

function actionSign(orderType: string | null | undefined): 1 | -1 {
  if (orderType && DEBIT_ACTIONS.has(orderType)) return -1
  return 1 // STO/STC and unknown default to +1
}

function num(v: unknown, def = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : def
}

function round2(v: number): number {
  return Math.round(v * 100) / 100
}

function el(tag: string, className?: string): HTMLElement {
  const e = document.createElement(tag)
  if (className) e.className = className
  return e
}

function txt(s: string): Text {
  return document.createTextNode(s)
}

function actionChipClass(action: string): string {
  if (CREDIT_ACTIONS.has(action)) return 'pdp-tb-chip--action-credit'
  if (DEBIT_ACTIONS.has(action)) return 'pdp-tb-chip--action-debit'
  return 'pdp-tb-chip--action-neutral'
}

function typeChipClass(legType: string): string {
  switch (legType) {
    case 'CALL':  return 'pdp-tb-chip--type-call'
    case 'PUT':   return 'pdp-tb-chip--type-put'
    case 'STOCK': return 'pdp-tb-chip--type-stock'
    case 'CASH':  return 'pdp-tb-chip--type-cash'
    default:      return 'pdp-tb-chip--type-other'
  }
}

function cashClass(v: number): string {
  if (v > 0.005) return 'pdp-kv-value--pos'
  if (v < -0.005) return 'pdp-kv-value--neg'
  return ''
}

export function buildBreakdownRows(legs: PersistedLeg[] | undefined): BreakdownRow[] {
  if (!Array.isArray(legs) || legs.length === 0) return []

  const rows: Omit<BreakdownRow, 'cumulative'>[] = legs.map((leg, idx) => {
    const quantity = Math.abs(num(leg.quantity))
    const multiplier = num(leg.multiplier, 1) || 1
    const premium = num(leg.premium)
    const fees = Math.abs(num(leg.fees))
    const sign = actionSign(leg.orderType)
    const gross = sign * premium * quantity * multiplier
    const netCash = round2(gross - fees)

    const isShareLike = leg.type === 'STOCK' || leg.type === 'CASH'
    const strike: number | null = isShareLike ? null : (typeof leg.strike === 'number' ? leg.strike : null)

    return {
      num: parseLegOrdinal(leg.id, idx + 1),
      date: '', // populated by renderer using formatters
      dateSortKey: typeof leg.executionDate === 'string' ? leg.executionDate : '',
      action: typeof leg.orderType === 'string' ? leg.orderType : '',
      legType: typeof leg.type === 'string' ? leg.type : '',
      strike,
      qty: quantity,
      fees,
      netCash
    }
  })

  rows.sort((a, b) => {
    if (a.dateSortKey !== b.dateSortKey) return a.dateSortKey < b.dateSortKey ? -1 : 1
    return a.num - b.num
  })

  let running = 0
  return rows.map(r => {
    running = round2(running + r.netCash)
    return { ...r, cumulative: running }
  })
}

export function renderTradeBreakdownColumn(
  container: HTMLElement,
  trade: BreakdownTrade,
  formatters: BreakdownFormatters
): void {
  container.textContent = ''

  const header = el('div', 'pdp-section-header')
  header.appendChild(txt('Trade Breakdown'))
  container.appendChild(header)

  const rows = buildBreakdownRows(trade.legs)
  for (const r of rows) {
    r.date = r.dateSortKey ? formatters.formatDate(r.dateSortKey) : '—'
  }

  const meta = el('div', 'pdp-tb-meta')
  const ticker = String(trade.ticker ?? '')
  const strategy = String(trade.strategy ?? '')
  const tradeId = String(trade.id ?? '')
  const parts: string[] = []
  parts.push(`${rows.length} ${rows.length === 1 ? 'leg' : 'legs'}`)
  if (tradeId) parts.push(tradeId)
  if (ticker || strategy) parts.push(`${ticker}${ticker && strategy ? ' ' : ''}${strategy}`.trim())
  meta.appendChild(txt(parts.join(' · ')))
  container.appendChild(meta)

  if (rows.length === 0) {
    const empty = el('div', 'pdp-tb-empty')
    empty.appendChild(txt('No legs recorded for this trade.'))
    container.appendChild(empty)
    return
  }

  const wrap = el('div', 'pdp-tb-table-wrap')
  if (rows.length > 8) wrap.classList.add('pdp-tb-table-wrap--scroll')

  const table = el('table', 'pdp-tb-table')
  const thead = el('thead')
  const headRow = el('tr')
  const headers = [
    { label: '#', className: 'pdp-tb-head--num pdp-tb-head--narrow' },
    { label: 'Date' },
    { label: 'Action' },
    { label: 'Type' },
    { label: 'Strike', className: 'pdp-tb-head--cash' },
    { label: 'Qty', className: 'pdp-tb-head--num pdp-tb-head--narrow' },
    { label: 'Net Cash', className: 'pdp-tb-head--cash' },
    { label: 'Cum.', className: 'pdp-tb-head--cash' }
  ]
  for (const { label, className } of headers) {
    const th = el('th', className)
    th.appendChild(txt(label))
    headRow.appendChild(th)
  }
  thead.appendChild(headRow)
  table.appendChild(thead)

  const tbody = el('tbody')
  let opensCount = 0
  let feesTotal = 0
  for (const r of rows) {
    if (r.action === 'STO' || r.action === 'BTO') opensCount += r.qty
    feesTotal += r.fees

    const tr = el('tr', 'pdp-tb-row')

    const numCell = el('td', 'pdp-tb-cell pdp-tb-cell--num')
    numCell.appendChild(txt(String(r.num)))
    tr.appendChild(numCell)

    const dateCell = el('td', 'pdp-tb-cell')
    dateCell.appendChild(txt(r.date))
    tr.appendChild(dateCell)

    const actionCell = el('td', 'pdp-tb-cell')
    const actionChip = el('span', `pdp-tb-chip ${actionChipClass(r.action)}`)
    actionChip.appendChild(txt(r.action || '—'))
    actionCell.appendChild(actionChip)
    tr.appendChild(actionCell)

    const typeCell = el('td', 'pdp-tb-cell')
    const typeChip = el('span', `pdp-tb-chip ${typeChipClass(r.legType)}`)
    typeChip.appendChild(txt(r.legType || '—'))
    typeCell.appendChild(typeChip)
    tr.appendChild(typeCell)

    const strikeCell = el('td', 'pdp-tb-cell pdp-tb-cell--amount')
    strikeCell.appendChild(txt(r.strike !== null ? formatters.formatCurrency(r.strike) : '—'))
    tr.appendChild(strikeCell)

    const qtyCell = el('td', 'pdp-tb-cell pdp-tb-cell--num')
    qtyCell.appendChild(txt(String(r.qty)))
    tr.appendChild(qtyCell)

    const cashCell = el('td', `pdp-tb-cell pdp-tb-cell--cash ${cashClass(r.netCash)}`)
    cashCell.appendChild(txt(formatters.formatCurrency(r.netCash)))
    tr.appendChild(cashCell)

    const cumCell = el('td', `pdp-tb-cell pdp-tb-cell--cash pdp-tb-cell--cum ${cashClass(r.cumulative)}`)
    cumCell.appendChild(txt(formatters.formatCurrency(r.cumulative)))
    tr.appendChild(cumCell)

    tbody.appendChild(tr)
  }
  feesTotal = Math.round(feesTotal * 100) / 100
  table.appendChild(tbody)
  wrap.appendChild(table)
  container.appendChild(wrap)

  const footer = el('div', 'pdp-tb-footer')
  const cumulativeFinal = rows[rows.length - 1].cumulative

  const line1 = el('div', 'pdp-tb-footer-line')
  line1.appendChild(txt(`Opens: ${opensCount} · Net Cash: ${formatters.formatCurrency(cumulativeFinal)}`))
  footer.appendChild(line1)

  const line2 = el('div', 'pdp-tb-footer-line pdp-tb-footer-line--muted')
  line2.appendChild(txt(`Fees: ${formatters.formatCurrency(feesTotal)}`))
  footer.appendChild(line2)

  if (typeof trade.cashFlow === 'number' && Number.isFinite(trade.cashFlow) &&
      Math.abs(cumulativeFinal - trade.cashFlow) > 0.01) {
    const line3 = el('div', 'pdp-tb-footer-line pdp-tb-footer-line--muted')
    line3.appendChild(txt(`Realized P&L: ${formatters.formatCurrency(trade.cashFlow)}`))
    footer.appendChild(line3)
    if (trade.lifecycleStatus === 'closed') {
      // Dev-only divergence warning; never throws.
      // eslint-disable-next-line no-console
      console.warn('[trade-breakdown] cumulative diverges from trade.cashFlow', {
        tradeId: trade.id, cumulative: cumulativeFinal, cashFlow: trade.cashFlow
      })
    }
  }

  container.appendChild(footer)
}
