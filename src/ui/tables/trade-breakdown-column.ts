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
  _container: HTMLElement,
  _trade: BreakdownTrade,
  _formatters: BreakdownFormatters
): void {
  throw new Error('not implemented')
}
