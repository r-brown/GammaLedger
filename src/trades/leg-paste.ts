// src/trades/leg-paste.ts — paste-to-parse leg entry for the Add Trade form.
//
// parsePastedLegs is pure and dependency-free (unit-testable via tsx). It turns
// broker fill text — IBKR "Orders & Trades" panel copies, compact fill strings,
// or OCC option symbols — into leg objects addLegFormRow understands.

export interface ParsedPastedLeg {
  ticker: string
  type: 'CALL' | 'PUT'
  orderType: 'BTO' | 'STO' | 'BTC' | 'STC'
  quantity: number
  strike: number
  expirationDate: string
  executionDate: string
  premium: number
  fees: number
}

export interface LegPasteResult {
  legs: ParsedPastedLeg[]
  warnings: string[]
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
}

const ACTION_WORDS: Record<string, ParsedPastedLeg['orderType']> = {
  bto: 'BTO', sto: 'STO', btc: 'BTC', stc: 'STC',
  bot: 'BTO', bought: 'BTO', buy: 'BTO',
  sold: 'STO', sell: 'STO',
}

// Tokens that must never be mistaken for a ticker symbol.
const RESERVED_TOKENS = new Set([
  'BTO', 'STO', 'BTC', 'STC', 'BOT', 'BOUGHT', 'BUY', 'SOLD', 'SELL',
  'P', 'C', 'PUT', 'CALL', 'PUTS', 'CALLS', 'AM', 'PM', 'ON', 'AT', 'FILLED',
])

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

function toIsoDate(year: number, month: number, day: number): string {
  const fullYear = year < 100 ? 2000 + year : year
  return `${fullYear}-${pad2(month)}-${pad2(day)}`
}

/** "Aug21'26" → 2026-08-21. Returns '' when the token is not that shape. */
function parseIbkrExpiry(token: string): string {
  const m = token.match(/^([A-Za-z]{3})(\d{1,2})'(\d{2})$/)
  if (!m) return ''
  const month = MONTHS[m[1].toLowerCase()]
  if (!month) return ''
  return toIsoDate(Number(m[3]), month, Number(m[2]))
}

/** "7/31/2026" / "08/15/25" / "2026-07-31" → ISO date, '' when unparseable. */
function parseLooseDate(token: string): string {
  const iso = token.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) return token
  const us = token.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (us) return toIsoDate(Number(us[3]), Number(us[1]), Number(us[2]))
  return ''
}

function normalizeRight(token: string): 'CALL' | 'PUT' | null {
  const t = token.toLowerCase()
  if (t === 'c' || t === 'call' || t === 'calls') return 'CALL'
  if (t === 'p' || t === 'put' || t === 'puts') return 'PUT'
  return null
}

interface RawFill extends ParsedPastedLeg {
  /** True when the action came from Bot/Bought/Sold-style words (open/close ambiguous). */
  looseAction: boolean
}

// ---------------------------------------------------------------------------
// IBKR "Orders & Trades" panel format
// ---------------------------------------------------------------------------

const IBKR_CONTRACT_RE = /^([A-Z]{1,6})\s+([A-Za-z]{3}\d{1,2}'\d{2})\s+(\d+(?:\.\d+)?)\s+(Put|Call)$/
const IBKR_ACTION_RE = /^(Bot|Sold)\s+(\d+)\s+@\s+(\d+(?:\.\d+)?)(?:\s+on\s+\S+)?$/
const IBKR_DATETIME_RE = /^(?:(\d{1,2}\/\d{1,2}\/\d{4}),?\s+)?\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?$/i
const IBKR_FEES_RE = /^Fees:\s*(-?\d+(?:\.\d+)?)$/i

function parseIbkrBlocks(lines: string[]): RawFill[] {
  const fills: RawFill[] = []
  let current: RawFill | null = null

  for (const line of lines) {
    const contract = line.match(IBKR_CONTRACT_RE)
    if (contract) {
      if (current) fills.push(current)
      current = {
        ticker: contract[1],
        type: contract[4].toUpperCase() === 'PUT' ? 'PUT' : 'CALL',
        orderType: 'BTO',
        quantity: 0,
        strike: Number(contract[3]),
        expirationDate: parseIbkrExpiry(contract[2]),
        executionDate: '',
        premium: 0,
        fees: 0,
        looseAction: true,
      }
      continue
    }
    if (!current) continue

    const action = line.match(IBKR_ACTION_RE)
    if (action && current.quantity === 0) {
      current.orderType = action[1] === 'Sold' ? 'STO' : 'BTO'
      current.quantity = Number(action[2])
      current.premium = Number(action[3])
      continue
    }

    const datetime = line.match(IBKR_DATETIME_RE)
    if (datetime && !current.executionDate) {
      if (datetime[1]) {
        current.executionDate = parseLooseDate(datetime[1])
      } else {
        const today = new Date()
        current.executionDate = toIsoDate(today.getFullYear(), today.getMonth() + 1, today.getDate())
      }
      continue
    }

    const fees = line.match(IBKR_FEES_RE)
    if (fees) {
      current.fees = Number(fees[1])
    }
  }
  if (current) fills.push(current)

  return fills.filter(fill => fill.quantity > 0)
}

// ---------------------------------------------------------------------------
// OCC option symbol — e.g. "SPY250815P00450000", optionally "STO 2 @ 1.25"
// ---------------------------------------------------------------------------

const OCC_RE = /^([A-Z]{1,6})\s*(\d{2})(\d{2})(\d{2})([CP])(\d{8})(?:\s+(.*))?$/

function parseOccLine(line: string): RawFill | null {
  const m = line.match(OCC_RE)
  if (!m) return null
  const strike = Number(m[6]) / 1000
  if (!Number.isFinite(strike) || strike <= 0) return null

  const fill: RawFill = {
    ticker: m[1],
    type: m[5] === 'P' ? 'PUT' : 'CALL',
    orderType: 'BTO',
    quantity: 1,
    strike,
    expirationDate: toIsoDate(Number(m[2]), Number(m[3]), Number(m[4])),
    executionDate: '',
    premium: 0,
    fees: 0,
    looseAction: true,
  }

  const rest = (m[7] ?? '').trim()
  if (rest) {
    const action = rest.match(/\b(BTO|STO|BTC|STC|Bot|Bought|Buy|Sold|Sell)\b/i)
    if (action) {
      fill.orderType = ACTION_WORDS[action[1].toLowerCase()]
      fill.looseAction = !/^(BTO|STO|BTC|STC)$/i.test(action[1])
      const qty = rest.slice((action.index ?? 0) + action[1].length).match(/^\s+(\d+)\b/)
      if (qty) fill.quantity = Number(qty[1])
    }
    const price = rest.match(/@\s*(\d+(?:\.\d+)?)/)
    if (price) fill.premium = Number(price[1])
  }
  return fill
}

// ---------------------------------------------------------------------------
// Compact fill strings — "SPY 08/15/2025 450P STO 2 @ 1.25",
// "STO 2 SPY 450P 8/15/2025 @1.25", "NEM Aug21'26 80 Put Sold 1 @ 0.32"
// ---------------------------------------------------------------------------

function parseCompactLine(line: string): RawFill | null {
  const price = line.match(/@\s*(\d+(?:\.\d+)?)/)
  const beforePrice = price ? line.slice(0, price.index) : line
  const tokens = beforePrice.split(/[\s,]+/).filter(Boolean)
  if (tokens.length < 2) return null

  let ticker = ''
  let orderType: ParsedPastedLeg['orderType'] | null = null
  let looseAction = false
  let quantity = 0
  let strike: number | null = null
  let right: 'CALL' | 'PUT' | null = null
  let expirationDate = ''
  let pendingStrike: number | null = null

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    const upper = token.toUpperCase()

    if (!orderType && ACTION_WORDS[token.toLowerCase()] !== undefined
        && (upper.length !== 1)) {
      orderType = ACTION_WORDS[token.toLowerCase()]
      looseAction = !/^(BTO|STO|BTC|STC)$/.test(upper)
      const next = tokens[i + 1]
      if (next && /^\d+$/.test(next)) {
        quantity = Number(next)
        i++
      }
      continue
    }

    if (!expirationDate) {
      const loose = parseLooseDate(token)
      const ibkr = loose || parseIbkrExpiry(token)
      if (ibkr) {
        expirationDate = ibkr
        continue
      }
    }

    // "450P" / "16C" combined strike+right
    const combined = token.match(/^(\d+(?:\.\d+)?)([CPcp])$/)
    if (combined && strike === null) {
      strike = Number(combined[1])
      right = normalizeRight(combined[2])
      continue
    }

    // "80 Put" split strike+right
    if (strike === null && /^\d+(?:\.\d+)?$/.test(token)) {
      const nextRight = tokens[i + 1] ? normalizeRight(tokens[i + 1]) : null
      if (nextRight) {
        strike = Number(token)
        right = nextRight
        i++
        continue
      }
      if (pendingStrike === null && !/^\d+$/.test(token)) {
        pendingStrike = Number(token)
      }
      continue
    }

    if (!ticker && /^[A-Z]{1,6}$/.test(token) && !RESERVED_TOKENS.has(upper)) {
      ticker = token
    }
  }

  if (strike === null && pendingStrike !== null) strike = pendingStrike
  if (!ticker || strike === null || right === null) return null

  return {
    ticker,
    type: right,
    orderType: orderType ?? 'BTO',
    quantity: quantity > 0 ? quantity : 1,
    strike,
    expirationDate,
    executionDate: '',
    premium: price ? Number(price[1]) : 0,
    fees: 0,
    looseAction: orderType === null ? true : looseAction,
  }
}

// ---------------------------------------------------------------------------
// Consolidation + entry point
// ---------------------------------------------------------------------------

function round2(v: number): number {
  return Math.round(v * 100) / 100
}

/** Split fills of the same order merge: qty summed, premium qty-weighted, fees summed. */
function consolidateFills(fills: RawFill[]): RawFill[] {
  const byKey = new Map<string, RawFill>()
  for (const fill of fills) {
    const key = [fill.ticker, fill.type, fill.strike, fill.expirationDate, fill.orderType, fill.executionDate].join('|')
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, { ...fill })
      continue
    }
    const totalQty = existing.quantity + fill.quantity
    if (totalQty > 0) {
      const weighted = ((existing.premium * existing.quantity) + (fill.premium * fill.quantity)) / totalQty
      existing.premium = Math.round(weighted * 10000) / 10000
    }
    existing.quantity = totalQty
    existing.fees = round2(existing.fees + fill.fees)
    existing.looseAction = existing.looseAction || fill.looseAction
  }
  return Array.from(byKey.values())
}

export function parsePastedLegs(text: string): LegPasteResult {
  const warnings: string[] = []
  const lines = (text ?? '').split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  if (lines.length === 0) {
    return { legs: [], warnings: ['Nothing to parse — paste broker fill text first.'] }
  }

  let fills = parseIbkrBlocks(lines)

  if (fills.length === 0) {
    for (const line of lines) {
      const fill = parseOccLine(line) ?? parseCompactLine(line)
      if (fill) fills.push(fill)
    }
  }

  if (fills.length === 0) {
    return { legs: [], warnings: ['No fills recognized. Supported: IBKR Orders & Trades text, "SPY 08/15/2025 450P STO 2 @ 1.25", or OCC symbols.'] }
  }

  const before = fills.length
  fills = consolidateFills(fills)
  if (fills.length < before) {
    warnings.push(`${before - fills.length} split fill(s) consolidated (quantity-weighted price, summed fees).`)
  }

  if (fills.some(fill => fill.looseAction)) {
    warnings.push('Bot/Sold were mapped to BTO/STO — flip the Action to BTC/STC on legs that close an existing position.')
  }

  const legs = fills.map(({ looseAction: _looseAction, ...leg }) => leg)
  return { legs, warnings }
}

// ---------------------------------------------------------------------------
// Add Trade form wiring — .call(this, …) delegation pattern
// ---------------------------------------------------------------------------

interface LegPasteContext {
  getLegsContainer(): HTMLElement | null
  addLegFormRow(leg?: Record<string, unknown> | null, options?: { autoFee?: boolean }): HTMLElement | null
  updateLegRowNumbers(): void
  updateTickerPreview(ticker: string): void
  showNotification(msg: string, type: string): void
}

/** A leg row the user has not touched: no premium, strike, or expiration yet. */
function isBlankLegRow(row: HTMLElement): boolean {
  return ['premium', 'strike', 'expirationDate', 'executionDate'].every(field => {
    const input = row.querySelector(`[data-leg-field="${field}"]`) as HTMLInputElement | null
    return !input || input.value === ''
  })
}

export function applyParsedLegsToForm(this: LegPasteContext, result: LegPasteResult): void {
  if (result.legs.length === 0) {
    this.showNotification(result.warnings[0] ?? 'No fills recognized.', 'error')
    return
  }

  // One trade = one ticker: keep the group matching the form's ticker when set,
  // otherwise the first pasted ticker; report anything skipped.
  const tickerInput = document.getElementById('ticker') as HTMLInputElement | null
  const formTicker = (tickerInput?.value ?? '').trim().toUpperCase()
  const tickers = [...new Set(result.legs.map(leg => leg.ticker))]
  const targetTicker = formTicker && tickers.includes(formTicker) ? formTicker : tickers[0]
  const legs = result.legs.filter(leg => leg.ticker === targetTicker)
  const skipped = tickers.filter(ticker => ticker !== targetTicker)

  if (tickerInput && !formTicker) {
    tickerInput.value = targetTicker
    this.updateTickerPreview(targetTicker)
  }

  const container = this.getLegsContainer()
  const blankRows = container
    ? (Array.from(container.querySelectorAll('.trade-leg')) as HTMLElement[]).filter(isBlankLegRow)
    : []

  let added = 0
  for (const leg of legs) {
    const row = this.addLegFormRow({
      orderType: leg.orderType,
      type: leg.type,
      quantity: leg.quantity,
      strike: leg.strike,
      expirationDate: leg.expirationDate,
      executionDate: leg.executionDate,
      premium: leg.premium,
      fees: leg.fees,
    }, { autoFee: false })
    if (row) {
      row.classList.add('trade-leg--highlight')
      setTimeout(() => row.classList.remove('trade-leg--highlight'), 1500)
      added += 1
    }
  }

  if (added > 0) {
    blankRows.forEach(row => row.remove())
    this.updateLegRowNumbers()
  }

  const messages = [`Added ${added} leg${added === 1 ? '' : 's'} for ${targetTicker}.`]
  if (skipped.length > 0) {
    messages.push(`Skipped other ticker${skipped.length === 1 ? '' : 's'} (${skipped.join(', ')}) — one trade per ticker; paste again after saving.`)
  }
  messages.push(...result.warnings)
  this.showNotification(messages.join('\n'), skipped.length > 0 || result.warnings.length > 0 ? 'warning' : 'success')
}

export function initializeLegPasteControls(this: LegPasteContext): void {
  const toggle = document.getElementById('leg-paste-toggle')
  const panel = document.getElementById('leg-paste-panel')
  const parseButton = document.getElementById('leg-paste-parse')
  const input = document.getElementById('leg-paste-input') as HTMLTextAreaElement | null
  if (!toggle || !panel || !parseButton || !input) return

  toggle.addEventListener('click', () => {
    const isOpen = panel.classList.toggle('is-hidden') === false
    toggle.setAttribute('aria-expanded', String(isOpen))
    if (isOpen) input.focus()
  })

  parseButton.addEventListener('click', () => {
    const result = parsePastedLegs(input.value)
    applyParsedLegsToForm.call(this, result)
    if (result.legs.length > 0) input.value = ''
  })
}
