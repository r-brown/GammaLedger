// src/trades/leg-paste.ts — paste-to-parse leg entry for the Add Trade form.
//
// parsePastedLegs is pure and dependency-free (unit-testable via tsx). It turns
// broker fill text — IBKR "Orders & Trades" panel copies, compact fill strings,
// or OCC option symbols — into leg objects addLegFormRow understands.

export interface ParsedPastedLeg {
  ticker: string
  type: 'CALL' | 'PUT' | 'STOCK'
  orderType: 'BTO' | 'STO' | 'BTC' | 'STC'
  quantity: number
  strike: number
  expirationDate: string
  executionDate: string
  executionTimestamp?: string
  brokerTimeZone?: string
  premium: number
  fees: number
  multiplier?: number
  underlyingPrice?: number | null
  isAssignment?: boolean
  importSource?: string
}

export interface LegPasteResult {
  legs: ParsedPastedLeg[]
  warnings: string[]
  source?: 'Robinhood' | 'IBKR' | 'Compact'
  activityType?: 'opening' | 'closing' | 'roll' | 'multi-leg' | 'assignment' | 'activity'
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

function parseMoney(value: string): number {
  const parsed = Number(value.replace(/[$,]/g, '').trim())
  return Number.isFinite(parsed) ? Math.abs(parsed) : 0
}

function valueAfter(lines: string[], label: string, start = 0, end = lines.length): string {
  const normalizedLabel = label.toLowerCase()
  for (let i = start; i < Math.min(end, lines.length - 1); i++) {
    if (lines[i].toLowerCase() === normalizedLabel) return lines[i + 1]
  }
  return ''
}

function parseMonthDay(token: string): { month: number; day: number; year: number | null } | null {
  const match = token.trim().match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/)
  if (!match) return null
  const month = Number(match[1])
  const day = Number(match[2])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const rawYear = match[3] ? Number(match[3]) : null
  return { month, day, year: rawYear === null ? null : rawYear < 100 ? 2000 + rawYear : rawYear }
}

const ROBINHOOD_TIME_ZONE_OFFSETS: Record<string, string> = {
  PST: '-08:00', PDT: '-07:00',
  MST: '-07:00', MDT: '-06:00',
  CST: '-06:00', CDT: '-05:00',
  EST: '-05:00', EDT: '-04:00',
  UTC: '+00:00', GMT: '+00:00',
}

interface RobinhoodDateTime {
  executionDate: string
  executionTimestamp?: string
  brokerTimeZone?: string
  inferredYear: boolean
}

function parseRobinhoodDateTime(value: string, referenceDate: Date): RobinhoodDateTime | null {
  const match = value.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?,\s*(\d{1,2}):(\d{2})\s*(AM|PM)\s*([A-Z]{2,5})$/i)
  if (!match) return null

  const suppliedYear = match[3] ? Number(match[3]) : null
  const year = suppliedYear === null
    ? referenceDate.getFullYear()
    : suppliedYear < 100 ? 2000 + suppliedYear : suppliedYear
  let hour = Number(match[4]) % 12
  if (match[6].toUpperCase() === 'PM') hour += 12
  const zone = match[7].toUpperCase()
  const offset = ROBINHOOD_TIME_ZONE_OFFSETS[zone]
  const executionDate = toIsoDate(year, Number(match[1]), Number(match[2]))

  return {
    executionDate,
    ...(offset ? { executionTimestamp: `${executionDate}T${pad2(hour)}:${match[5]}:00${offset}` } : {}),
    brokerTimeZone: zone,
    inferredYear: suppliedYear === null,
  }
}

function resolveRobinhoodExpiration(token: string, executionDate: string, referenceDate: Date): { date: string; inferredYear: boolean } {
  const parsed = parseMonthDay(token)
  if (!parsed) return { date: '', inferredYear: false }
  if (parsed.year !== null) return { date: toIsoDate(parsed.year, parsed.month, parsed.day), inferredYear: false }

  const execution = parseMonthDay(executionDate.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$2/$3/$1'))
  let year = execution?.year ?? referenceDate.getFullYear()
  if (execution && (parsed.month < execution.month || (parsed.month === execution.month && parsed.day < execution.day))) {
    year += 1
  }
  return { date: toIsoDate(year, parsed.month, parsed.day), inferredYear: true }
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
// Robinhood order-history text
// ---------------------------------------------------------------------------

const ROBINHOOD_OPTION_HEADER_RE = /^(Buy|Sell)\s+([A-Z][A-Z0-9.]{0,9})\s+\$?(\d+(?:\.\d+)?)\s+(Put|Call)\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)$/i
const ROBINHOOD_ASSIGNMENT_RE = /^([A-Z][A-Z0-9.]{0,9})\s+\$?(\d+(?:\.\d+)?)\s+(Put|Call)\s+Assignment$/i
const ROBINHOOD_FILLED_QUANTITY_RE = /^(\d+)\s+contracts?\s+at\s+\$?(\d+(?:\.\d+)?)$/i

interface RobinhoodParseResult {
  fills: RawFill[]
  warnings: string[]
  activityType: NonNullable<LegPasteResult['activityType']>
}

function splitFeeEvenly(totalFee: number, count: number): number[] {
  if (!(count > 0)) return []
  const share = Math.round((totalFee / count) * 1_000_000) / 1_000_000
  const fees = Array.from({ length: count }, () => share)
  fees[count - 1] = Math.round((totalFee - share * (count - 1)) * 1_000_000) / 1_000_000
  return fees
}

function parseRobinhoodAssignment(lines: string[], referenceDate: Date): RobinhoodParseResult | null {
  const headerIndex = lines.findIndex(line => ROBINHOOD_ASSIGNMENT_RE.test(line))
  if (headerIndex < 0) return null
  const header = lines[headerIndex].match(ROBINHOOD_ASSIGNMENT_RE)
  if (!header) return null

  if (header[3].toUpperCase() !== 'PUT') {
    return {
      fills: [],
      warnings: ['Robinhood call assignments are not supported yet; enter the option close and called-away shares manually.'],
      activityType: 'assignment',
    }
  }

  const contracts = Number(valueAfter(lines, 'Contracts', headerIndex))
  const dateToken = valueAfter(lines, 'Date', headerIndex)
  const parsedDate = parseMonthDay(dateToken)
  const executionYear = parsedDate?.year ?? referenceDate.getFullYear()
  const executionDate = parsedDate ? toIsoDate(executionYear, parsedDate.month, parsedDate.day) : ''
  const strike = Number(header[2])
  const underlyingPrice = parseMoney(valueAfter(lines, 'Price at Expiration', headerIndex))
  if (!(contracts > 0) || !executionDate || !(strike > 0)) {
    return {
      fills: [],
      warnings: ['The Robinhood assignment is missing contracts, date, or strike.'],
      activityType: 'assignment',
    }
  }

  const warnings: string[] = []
  if (parsedDate?.year === null) warnings.push(`Robinhood omitted the year; ${executionYear} was inferred. Confirm the date before saving.`)
  const expectedCost = contracts * 100 * strike
  const reportedCost = parseMoney(valueAfter(lines, 'Cost', headerIndex))
  if (reportedCost > 0 && Math.abs(reportedCost - expectedCost) > 0.01) {
    warnings.push(`Reported assignment cost ${reportedCost.toFixed(2)} does not match contracts × strike ${expectedCost.toFixed(2)}.`)
  }

  return {
    fills: [{
      ticker: header[1].toUpperCase(),
      type: 'STOCK',
      orderType: 'BTO',
      quantity: contracts * 100,
      strike,
      expirationDate: '',
      executionDate,
      premium: 0,
      fees: 0,
      multiplier: 1,
      underlyingPrice: underlyingPrice || null,
      isAssignment: true,
      importSource: 'Robinhood',
      looseAction: false,
    }],
    warnings,
    activityType: 'assignment',
  }
}

function parseRobinhoodOptionOrder(lines: string[], referenceDate: Date): RobinhoodParseResult | null {
  const headers = lines
    .map((line, index) => ({ index, match: line.match(ROBINHOOD_OPTION_HEADER_RE) }))
    .filter((entry): entry is { index: number; match: RegExpMatchArray } => Boolean(entry.match))
  if (headers.length === 0) return null

  const warnings: string[] = []
  const fills: RawFill[] = []
  let inferredYear = false
  let unknownTimeZone = false

  headers.forEach((header, headerPosition) => {
    const end = headers[headerPosition + 1]?.index ?? lines.length
    const action = header.match[1].toUpperCase()
    const positionEffect = valueAfter(lines, 'Position effect', header.index, end).toUpperCase()
    const quantityFill = valueAfter(lines, 'Filled quantity', header.index, end).match(ROBINHOOD_FILLED_QUANTITY_RE)
    const quantity = quantityFill ? Number(quantityFill[1]) : Number(valueAfter(lines, 'Quantity', header.index, end))
    const premium = quantityFill ? Number(quantityFill[2]) : 0

    let filledDateTime: RobinhoodDateTime | null = null
    for (let i = header.index + 1; i < end - 1; i++) {
      if (lines[i].toLowerCase() !== 'filled') continue
      filledDateTime = parseRobinhoodDateTime(lines[i + 1], referenceDate)
      if (filledDateTime) break
    }

    const executionDate = filledDateTime?.executionDate ?? ''
    const expiration = resolveRobinhoodExpiration(header.match[5], executionDate, referenceDate)
    const orderType = action === 'BUY'
      ? positionEffect === 'CLOSE' ? 'BTC' : 'BTO'
      : positionEffect === 'CLOSE' ? 'STC' : 'STO'

    if (!(quantity > 0) || !(premium >= 0) || !filledDateTime || !expiration.date || !['OPEN', 'CLOSE'].includes(positionEffect)) {
      warnings.push(`Skipped incomplete Robinhood leg: ${lines[header.index]}.`)
      return
    }

    inferredYear = inferredYear || filledDateTime.inferredYear || expiration.inferredYear
    unknownTimeZone = unknownTimeZone || !filledDateTime.executionTimestamp
    fills.push({
      ticker: header.match[2].toUpperCase(),
      type: header.match[4].toUpperCase() === 'PUT' ? 'PUT' : 'CALL',
      orderType,
      quantity,
      strike: Number(header.match[3]),
      expirationDate: expiration.date,
      executionDate,
      ...(filledDateTime.executionTimestamp ? { executionTimestamp: filledDateTime.executionTimestamp } : {}),
      ...(filledDateTime.brokerTimeZone ? { brokerTimeZone: filledDateTime.brokerTimeZone } : {}),
      premium,
      fees: 0,
      multiplier: 100,
      importSource: 'Robinhood',
      looseAction: false,
    })
  })

  if (fills.length === 0) return { fills, warnings, activityType: 'activity' }

  const totalFee = parseMoney(valueAfter(lines, 'Est regulatory fees'))
  const allocatedFees = splitFeeEvenly(totalFee, fills.length)
  fills.forEach((fill, index) => { fill.fees = allocatedFees[index] ?? 0 })

  if (inferredYear) {
    warnings.push(`Robinhood omitted a year; ${referenceDate.getFullYear()} was inferred where needed. Confirm the dates before saving.`)
  }
  if (unknownTimeZone) {
    warnings.push('The Filled time-zone abbreviation was not recognized; the date was retained but no ISO execution timestamp was stored.')
  }
  if (fills.length > 1 && totalFee > 0) {
    warnings.push(`Robinhood reported one ${totalFee.toFixed(2)} fee; it was divided equally across ${fills.length} legs.`)
  }

  const hasOpen = fills.some(fill => fill.orderType === 'BTO' || fill.orderType === 'STO')
  const hasClose = fills.some(fill => fill.orderType === 'BTC' || fill.orderType === 'STC')
  const activityType: NonNullable<LegPasteResult['activityType']> = hasOpen && hasClose
    ? 'roll'
    : fills.length > 1
      ? 'multi-leg'
      : hasClose ? 'closing' : 'opening'

  return { fills, warnings, activityType }
}

function parseRobinhoodText(lines: string[], referenceDate: Date): RobinhoodParseResult | null {
  return parseRobinhoodAssignment(lines, referenceDate) ?? parseRobinhoodOptionOrder(lines, referenceDate)
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

export function parsePastedLegs(text: string, referenceDate = new Date()): LegPasteResult {
  const warnings: string[] = []
  const lines = (text ?? '').split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  if (lines.length === 0) {
    return { legs: [], warnings: ['Nothing to parse — paste broker fill text first.'] }
  }

  const robinhood = parseRobinhoodText(lines, referenceDate)
  let fills = robinhood?.fills ?? []
  let source: LegPasteResult['source'] = robinhood ? 'Robinhood' : undefined
  let activityType = robinhood?.activityType
  warnings.push(...(robinhood?.warnings ?? []))

  if (!robinhood) {
    fills = parseIbkrBlocks(lines)
    if (fills.length > 0) source = 'IBKR'
  }

  if (!robinhood && fills.length === 0) {
    for (const line of lines) {
      const fill = parseOccLine(line) ?? parseCompactLine(line)
      if (fill) fills.push(fill)
    }
    if (fills.length > 0) source = 'Compact'
  }

  if (fills.length === 0) {
    return {
      legs: [],
      warnings: warnings.length > 0
        ? warnings
        : ['No fills recognized. Paste a completed Robinhood order, IBKR Orders & Trades text, a compact fill string, or an OCC symbol.'],
      ...(source ? { source } : {}),
      ...(activityType ? { activityType } : {}),
    }
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
  return {
    legs,
    warnings,
    ...(source ? { source } : {}),
    ...(activityType ? { activityType } : {}),
  }
}

// ---------------------------------------------------------------------------
// Add Trade form wiring — .call(this, …) delegation pattern
// ---------------------------------------------------------------------------

interface LegPasteContext {
  currentEditingId?: unknown
  getLegsContainer(): HTMLElement | null
  addLegFormRow(leg?: Record<string, unknown> | null, options?: { autoFee?: boolean }): HTMLElement | null
  updateLegRowNumbers(): void
  updateTickerPreview(ticker: string): void
  showNotification(msg: string, type: string): void
  inferStrategyFromLegs?(legs?: Record<string, unknown>[]): string
}

/** A leg row the user has not touched: no premium, strike, or expiration yet. */
function isBlankLegRow(row: HTMLElement): boolean {
  return ['premium', 'strike', 'expirationDate'].every(field => {
    const input = row.querySelector(`[data-leg-field="${field}"]`) as HTMLInputElement | null
    return !input || input.value === ''
  })
}

function legSignature(leg: Record<string, unknown>): string {
  const number = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : null
  return [
    String(leg.orderType ?? '').toUpperCase(),
    String(leg.type ?? '').toUpperCase(),
    number(leg.quantity),
    number(leg.strike),
    String(leg.expirationDate ?? ''),
    String(leg.executionDate ?? ''),
    String(leg.executionTimestamp ?? ''),
    number(leg.premium),
    number(leg.fees),
  ].join('|')
}

function formRowSignature(row: HTMLElement): string {
  const get = (field: string) => (row.querySelector(`[data-leg-field="${field}"]`) as HTMLInputElement | HTMLSelectElement | null)?.value ?? ''
  return legSignature({
    orderType: get('orderType'),
    type: get('type'),
    quantity: get('quantity'),
    strike: get('strike'),
    expirationDate: get('expirationDate'),
    executionDate: get('executionDate'),
    executionTimestamp: row.dataset.executionTimestamp ?? '',
    premium: get('premium'),
    fees: get('fees'),
  })
}

export function applyParsedLegsToForm(this: LegPasteContext, result: LegPasteResult): boolean {
  if (result.legs.length === 0) {
    this.showNotification(result.warnings[0] ?? 'No fills recognized.', 'error')
    return false
  }

  // One trade = one ticker: keep the group matching the form's ticker when set,
  // otherwise the first pasted ticker; report anything skipped.
  const tickerInput = document.getElementById('ticker') as HTMLInputElement | null
  const formTicker = (tickerInput?.value ?? '').trim().toUpperCase()
  const tickers = [...new Set(result.legs.map(leg => leg.ticker))]
  if (formTicker && !tickers.includes(formTicker)) {
    this.showNotification(`Pasted ${tickers.join(', ')}, but this form is for ${formTicker}. Open the matching trade or correct the ticker before applying.`, 'error')
    return false
  }
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
  const existingSignatures = new Set(
    container ? (Array.from(container.querySelectorAll('.trade-leg')) as HTMLElement[]).map(formRowSignature) : []
  )

  let added = 0
  let duplicates = 0
  for (const leg of legs) {
    const signature = legSignature(leg as unknown as Record<string, unknown>)
    if (existingSignatures.has(signature)) {
      duplicates += 1
      continue
    }
    const row = this.addLegFormRow({
      orderType: leg.orderType,
      type: leg.type,
      quantity: leg.quantity,
      strike: leg.strike,
      expirationDate: leg.expirationDate,
      executionDate: leg.executionDate,
      premium: leg.premium,
      fees: leg.fees,
      multiplier: leg.multiplier,
      underlyingPrice: leg.underlyingPrice,
      executionTimestamp: leg.executionTimestamp,
      brokerTimeZone: leg.brokerTimeZone,
      isAssignment: leg.isAssignment,
      importSource: leg.importSource,
    }, { autoFee: false })
    if (row) {
      existingSignatures.add(signature)
      row.classList.add('trade-leg--highlight')
      setTimeout(() => row.classList.remove('trade-leg--highlight'), 1500)
      added += 1
    }
  }

  if (added > 0) {
    blankRows.forEach(row => row.remove())
    this.updateLegRowNumbers()
  }

  const strategySelect = document.getElementById('strategy') as HTMLSelectElement | null
  if (!this.currentEditingId && strategySelect && !strategySelect.value && this.inferStrategyFromLegs) {
    const inferred = this.inferStrategyFromLegs(legs as unknown as Record<string, unknown>[])
    if (Array.from(strategySelect.options).some(option => option.value === inferred)) {
      strategySelect.value = inferred
    }
  }

  const messages = [`Added ${added} leg${added === 1 ? '' : 's'} for ${targetTicker}.`]
  if (duplicates > 0) messages.push(`Skipped ${duplicates} duplicate leg${duplicates === 1 ? '' : 's'} already in the form.`)
  if (skipped.length > 0) {
    messages.push(`Skipped other ticker${skipped.length === 1 ? '' : 's'} (${skipped.join(', ')}) — one trade per ticker; paste again after saving.`)
  }
  messages.push(...result.warnings)
  this.showNotification(messages.join('\n'), skipped.length > 0 || result.warnings.length > 0 ? 'warning' : 'success')
  return added > 0
}

export function initializeLegPasteControls(this: LegPasteContext): void {
  const toggle = document.getElementById('leg-paste-toggle') as HTMLButtonElement | null
  const panel = document.getElementById('leg-paste-panel') as HTMLElement | null
  const editor = document.getElementById('leg-paste-editor') as HTMLElement | null
  const review = document.getElementById('leg-paste-review') as HTMLElement | null
  const reviewTitle = document.getElementById('leg-paste-review-title') as HTMLElement | null
  const reviewSource = document.getElementById('leg-paste-review-source') as HTMLElement | null
  const reviewLegs = document.getElementById('leg-paste-review-legs') as HTMLElement | null
  const reviewWarnings = document.getElementById('leg-paste-review-warnings') as HTMLElement | null
  const parseButton = document.getElementById('leg-paste-parse') as HTMLButtonElement | null
  const applyButton = document.getElementById('leg-paste-apply') as HTMLButtonElement | null
  const editButton = document.getElementById('leg-paste-edit') as HTMLButtonElement | null
  const cancelButton = document.getElementById('leg-paste-cancel') as HTMLButtonElement | null
  const input = document.getElementById('leg-paste-input') as HTMLTextAreaElement | null
  const form = document.getElementById('add-trade-form') as HTMLFormElement | null
  if (!toggle || !panel || !editor || !review || !reviewTitle || !reviewSource || !reviewLegs
      || !reviewWarnings || !parseButton || !applyButton || !editButton || !cancelButton || !input) return

  let pendingResult: LegPasteResult | null = null

  const showEditor = () => {
    pendingResult = null
    editor.hidden = false
    review.hidden = true
    input.focus()
  }

  const closePanel = () => {
    pendingResult = null
    panel.classList.add('is-hidden')
    toggle.setAttribute('aria-expanded', 'false')
    editor.hidden = false
    review.hidden = true
    input.value = ''
  }

  const activityLabels: Record<string, string> = {
    opening: 'Opening activity detected',
    closing: 'Closing activity detected',
    roll: 'Roll detected',
    'multi-leg': 'Multi-leg order detected',
    assignment: 'Put assignment detected',
    activity: 'Activity detected',
  }

  const appendCell = (row: HTMLTableRowElement, text: string) => {
    const cell = document.createElement('td')
    cell.textContent = text
    row.appendChild(cell)
  }

  const renderReview = (result: LegPasteResult) => {
    reviewTitle.textContent = `${activityLabels[result.activityType ?? 'activity']} · ${result.legs.length} leg${result.legs.length === 1 ? '' : 's'}`
    reviewSource.textContent = result.source ? `Source: ${result.source}` : ''
    reviewLegs.replaceChildren()

    result.legs.forEach(leg => {
      const row = document.createElement('tr')
      const contract = leg.type === 'STOCK'
        ? `${leg.ticker} stock @ $${leg.strike}`
        : `${leg.ticker} $${leg.strike} ${leg.type === 'PUT' ? 'Put' : 'Call'} · ${leg.expirationDate}`
      const timestamp = leg.executionTimestamp
        ? `${leg.executionTimestamp.slice(0, 10)} ${leg.executionTimestamp.slice(11, 16)} ${leg.brokerTimeZone ?? ''}`.trim()
        : leg.executionDate
      appendCell(row, leg.orderType)
      appendCell(row, contract)
      appendCell(row, String(leg.quantity))
      appendCell(row, leg.type === 'STOCK' ? `$${leg.strike}` : `$${leg.premium}`)
      appendCell(row, timestamp)
      appendCell(row, `$${leg.fees.toFixed(2)}`)
      reviewLegs.appendChild(row)
    })

    reviewWarnings.hidden = result.warnings.length === 0
    reviewWarnings.textContent = result.warnings.join('\n')
    editor.hidden = true
    review.hidden = false
  }

  toggle.addEventListener('click', () => {
    const isOpen = panel.classList.toggle('is-hidden') === false
    toggle.setAttribute('aria-expanded', String(isOpen))
    if (isOpen) showEditor()
  })

  parseButton.addEventListener('click', () => {
    const result = parsePastedLegs(input.value)
    if (result.legs.length === 0) {
      this.showNotification(result.warnings[0] ?? 'No fills recognized.', 'error')
      return
    }
    pendingResult = result
    renderReview(result)
  })

  applyButton.addEventListener('click', () => {
    if (!pendingResult) return
    if (applyParsedLegsToForm.call(this, pendingResult)) closePanel()
  })

  editButton.addEventListener('click', showEditor)
  cancelButton.addEventListener('click', closePanel)
  form?.addEventListener('reset', closePanel)
}
