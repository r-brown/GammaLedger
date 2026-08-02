// src/ui/tables/roll-chain.ts — roll-chain timeline for the trade detail panel.
//
// buildRollChains is pure and dependency-free (structural input type) so it can
// be unit-tested directly with tsx without a build step.

/** Structural subset of PersistedLeg/NormalizedLeg the chain builder needs. */
export interface RollChainLeg {
  orderType?: string | null
  type?: string
  quantity?: number
  multiplier?: number
  executionDate?: string
  expirationDate?: string
  strike?: number | null
  premium?: number
  fees?: number
}

export interface RollChainSegment {
  optionType: 'CALL' | 'PUT'
  direction: 'long' | 'short'
  strike: number
  expirationDate: string
  quantity: number
  openDate: string
  closeDate: string | null
  /** Net cash of the opening execution (signed, fees deducted). */
  openCash: number
  /** Net cash of the closing execution (signed, fees deducted). 0 while open. */
  closeCash: number
  status: 'open' | 'closed'
}

export interface RollChain {
  optionType: 'CALL' | 'PUT'
  direction: 'long' | 'short'
  segments: RollChainSegment[]
  /** Sum of open+close cash across every segment in the chain. */
  netCash: number
}

const OPEN_ORDERS = new Set(['BTO', 'STO'])
const CLOSE_ORDERS = new Set(['BTC', 'STC'])

function num(v: unknown, def = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : def
}

function round2(v: number): number {
  return Math.round(v * 100) / 100
}

function legCash(leg: RollChainLeg, orderType: string): number {
  const qty = Math.abs(num(leg.quantity))
  const multiplier = num(leg.multiplier, 1) || 1
  const gross = num(leg.premium) * qty * multiplier
  const fees = Math.abs(num(leg.fees))
  const sign = orderType === 'STO' || orderType === 'STC' ? 1 : -1
  return round2(sign * gross - fees)
}

/**
 * Pairs option opens with their closes (STO→BTC, BTO→STC, matched on
 * type+strike+expiration) and groups the resulting segments into chains per
 * option type + direction, ordered by open date. A rolled short put shows up
 * as one 'short PUT' chain with one segment per strike/expiration hop.
 */
export function buildRollChains(legs: RollChainLeg[] | undefined): RollChain[] {
  if (!Array.isArray(legs) || legs.length === 0) return []

  const optionLegs = legs
    .filter(leg => {
      const type = typeof leg.type === 'string' ? leg.type.toUpperCase() : ''
      const order = typeof leg.orderType === 'string' ? leg.orderType.toUpperCase() : ''
      return (type === 'CALL' || type === 'PUT')
        && Number.isFinite(leg.strike as number)
        && (OPEN_ORDERS.has(order) || CLOSE_ORDERS.has(order))
    })
    .map(leg => ({ leg, order: (leg.orderType as string).toUpperCase() }))
    .sort((a, b) => {
      const da = a.leg.executionDate || ''
      const db = b.leg.executionDate || ''
      if (da !== db) return da < db ? -1 : 1
      // Same-day roll: process the close before the next open.
      const aClose = CLOSE_ORDERS.has(a.order) ? 0 : 1
      const bClose = CLOSE_ORDERS.has(b.order) ? 0 : 1
      return aClose - bClose
    })

  const segments: RollChainSegment[] = []

  for (const { leg, order } of optionLegs) {
    const optionType = (leg.type as string).toUpperCase() as 'CALL' | 'PUT'
    const strike = leg.strike as number
    const expirationDate = leg.expirationDate || ''

    if (OPEN_ORDERS.has(order)) {
      segments.push({
        optionType,
        direction: order === 'STO' ? 'short' : 'long',
        strike,
        expirationDate,
        quantity: Math.abs(num(leg.quantity)) || 1,
        openDate: leg.executionDate || '',
        closeDate: null,
        openCash: legCash(leg, order),
        closeCash: 0,
        status: 'open'
      })
      continue
    }

    // BTC closes a short segment, STC closes a long one.
    const direction = order === 'BTC' ? 'short' : 'long'
    const target = segments.find(seg =>
      seg.status === 'open'
      && seg.direction === direction
      && seg.optionType === optionType
      && seg.strike === strike
      && seg.expirationDate === expirationDate)
    if (target) {
      target.closeDate = leg.executionDate || ''
      target.closeCash = legCash(leg, order)
      target.status = 'closed'
    }
  }

  const chains = new Map<string, RollChain>()
  for (const seg of segments) {
    const key = `${seg.optionType}|${seg.direction}`
    let chain = chains.get(key)
    if (!chain) {
      chain = { optionType: seg.optionType, direction: seg.direction, segments: [], netCash: 0 }
      chains.set(key, chain)
    }
    chain.segments.push(seg)
    chain.netCash = round2(chain.netCash + seg.openCash + seg.closeCash)
  }

  return Array.from(chains.values())
}

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

export interface RollChainFormatters {
  formatCurrency(v: unknown): string
  formatDate(v: unknown): string
}

function el(tag: string, className?: string): HTMLElement {
  const e = document.createElement(tag)
  if (className) e.className = className
  return e
}

function txt(s: string): Text {
  return document.createTextNode(s)
}

function cashClass(v: number): string {
  if (v > 0.005) return 'pdp-rc-cash--pos'
  if (v < -0.005) return 'pdp-rc-cash--neg'
  return ''
}

/**
 * Renders one timeline per chain that actually rolled (≥ 2 segments).
 * Appends nothing when the trade never rolled.
 */
export function renderRollChains(
  container: HTMLElement,
  legs: RollChainLeg[] | undefined,
  formatters: RollChainFormatters
): void {
  const rolled = buildRollChains(legs).filter(chain => chain.segments.length >= 2)
  if (rolled.length === 0) return

  for (const chain of rolled) {
    const block = el('div', 'pdp-rc-block')

    const header = el('div', 'pdp-rc-header')
    const title = el('span', 'pdp-rc-title')
    title.appendChild(txt(`🔁 Roll chain — ${chain.direction} ${chain.optionType.toLowerCase()}`))
    header.appendChild(title)
    const net = el('span', `pdp-rc-net ${cashClass(chain.netCash)}`)
    net.appendChild(txt(`net ${formatters.formatCurrency(chain.netCash)}`))
    header.appendChild(net)
    block.appendChild(header)

    const rail = el('div', 'pdp-rc-rail')
    chain.segments.forEach((seg, index) => {
      if (index > 0) {
        const prev = chain.segments[index - 1]
        const arrow = el('span', 'pdp-rc-arrow')
        arrow.appendChild(txt('→'))
        if (prev.closeDate && prev.closeDate === seg.openDate) {
          arrow.title = `Rolled ${formatters.formatDate(seg.openDate)}`
          arrow.classList.add('pdp-rc-arrow--roll')
        }
        rail.appendChild(arrow)
      }

      const node = el('div', `pdp-rc-node${seg.status === 'open' ? ' pdp-rc-node--open' : ''}`)

      const strikeLine = el('div', 'pdp-rc-strike')
      const qtySuffix = seg.quantity > 1 ? ` ×${seg.quantity}` : ''
      strikeLine.appendChild(txt(`$${seg.strike} ${seg.optionType === 'CALL' ? 'C' : 'P'}${qtySuffix}`))
      node.appendChild(strikeLine)

      const expLine = el('div', 'pdp-rc-exp')
      expLine.appendChild(txt(seg.expirationDate ? formatters.formatDate(seg.expirationDate) : '—'))
      node.appendChild(expLine)

      const cashLine = el('div', 'pdp-rc-cashline')
      const openChip = el('span', `pdp-rc-cash ${cashClass(seg.openCash)}`)
      openChip.appendChild(txt(formatters.formatCurrency(seg.openCash)))
      openChip.title = `Opened ${seg.openDate ? formatters.formatDate(seg.openDate) : '—'}`
      cashLine.appendChild(openChip)
      if (seg.status === 'closed') {
        const closeChip = el('span', `pdp-rc-cash ${cashClass(seg.closeCash)}`)
        closeChip.appendChild(txt(formatters.formatCurrency(seg.closeCash)))
        closeChip.title = `Closed ${seg.closeDate ? formatters.formatDate(seg.closeDate) : '—'}`
        cashLine.appendChild(closeChip)
      } else {
        const badge = el('span', 'pdp-rc-badge')
        badge.appendChild(txt('open'))
        cashLine.appendChild(badge)
      }
      node.appendChild(cashLine)

      rail.appendChild(node)
    })

    block.appendChild(rail)
    container.appendChild(block)
  }
}
