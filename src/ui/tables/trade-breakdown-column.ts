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

export function buildBreakdownRows(_legs: PersistedLeg[] | undefined): BreakdownRow[] {
  throw new Error('not implemented')
}

export function renderTradeBreakdownColumn(
  _container: HTMLElement,
  _trade: BreakdownTrade,
  _formatters: BreakdownFormatters
): void {
  throw new Error('not implemented')
}
