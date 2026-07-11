// src/imports/csv-mapper.ts — Generic CSV column-mapper for unrecognized
// broker exports. Shows a preview, lets the user map columns to trade fields
// and action values to order types, then feeds the shared import pipeline.
// The dialog is built with DOM APIs (no innerHTML with file content).
// Uses the .call(this, …) delegation pattern.

type AnyRecord = Record<string, any>

const DIALOG_ID = 'csv-mapper-dialog'

interface FieldSpec {
    key: string
    label: string
    required: boolean
    /** header-name fragments used to prefill the column pick */
    hints: string[]
}

const FIELDS: FieldSpec[] = [
    { key: 'date', label: 'Trade date', required: true, hints: ['date'] },
    { key: 'action', label: 'Action / order type', required: true, hints: ['action', 'trans', 'type', 'side'] },
    { key: 'symbol', label: 'Symbol / ticker', required: true, hints: ['symbol', 'ticker', 'instrument'] },
    { key: 'quantity', label: 'Quantity', required: true, hints: ['quantity', 'qty', 'contracts', 'shares'] },
    { key: 'price', label: 'Price / premium', required: true, hints: ['price', 'premium'] },
    { key: 'amount', label: 'Amount (net cash)', required: false, hints: ['amount', 'net', 'total', 'value'] },
    { key: 'fees', label: 'Fees / commission', required: false, hints: ['fee', 'comm'] },
    { key: 'optionType', label: 'Option type (Call/Put)', required: false, hints: ['option type', 'call/put', 'put/call', 'right'] },
    { key: 'strike', label: 'Strike', required: false, hints: ['strike'] },
    { key: 'expiration', label: 'Expiration', required: false, hints: ['expir', 'maturity'] }
]

const ACTION_CHOICES = [
    { value: '', label: 'Skip row' },
    { value: 'BTO', label: 'BTO (Buy to Open)' },
    { value: 'STO', label: 'STO (Sell to Open)' },
    { value: 'BTC', label: 'BTC (Buy to Close)' },
    { value: 'STC', label: 'STC (Sell to Close)' }
]

function guessOrderType(actionValue: string): string {
    const v = actionValue.toLowerCase()
    if (/(sell|sold).*(open)|^sto\b/.test(v)) return 'STO'
    if (/(buy|bought).*(open)|^bto\b/.test(v)) return 'BTO'
    if (/(buy|bought).*(close)|^btc\b/.test(v)) return 'BTC'
    if (/(sell|sold).*(close)|^stc\b/.test(v)) return 'STC'
    if (/^buy$|^bought$/.test(v)) return 'BTO'
    if (/^sell$|^sold$/.test(v)) return 'STC'
    return ''
}

function guessColumn(headers: string[], hints: string[]): number {
    const lower = headers.map(h => h.toLowerCase())
    for (const hint of hints) {
        const idx = lower.findIndex(h => h.includes(hint))
        if (idx !== -1) return idx
    }
    return -1
}

export function openCsvColumnMapper(this: any, raw: string, context: AnyRecord = {}) {
    const lines = (raw || '').split(/\r?\n/).filter((l: string) => l.trim())
    if (lines.length < 2) {
        this.showNotification('CSV file has no data rows to map.', 'error')
        return
    }

    const headers = (this.parseCsvRow(lines[0]) as string[]).map((h: string) => h.trim())
    const dataRows: string[][] = lines.slice(1).map((l: string) => this.parseCsvRow(l) as string[])
    const previewRows = dataRows.slice(0, 5)

    document.getElementById(DIALOG_ID)?.remove()
    const dialog = document.createElement('dialog')
    dialog.id = DIALOG_ID
    dialog.className = 'csv-mapper'

    const panel = document.createElement('div')
    panel.className = 'csv-mapper__panel'
    dialog.appendChild(panel)

    const title = document.createElement('h2')
    title.className = 'csv-mapper__title'
    title.textContent = `Map CSV columns — ${context.fileName || 'unknown format'}`
    panel.appendChild(title)

    const intro = document.createElement('p')
    intro.className = 'csv-mapper__intro'
    intro.textContent = 'This CSV is not a recognized Robinhood or Schwab export. Match its columns to trade fields, then map each Action value to an order type.'
    panel.appendChild(intro)

    // Preview table (first 5 rows)
    const previewWrap = document.createElement('div')
    previewWrap.className = 'csv-mapper__preview'
    const table = document.createElement('table')
    const thead = document.createElement('thead')
    const headRow = document.createElement('tr')
    headers.forEach(h => {
        const th = document.createElement('th')
        th.textContent = h
        headRow.appendChild(th)
    })
    thead.appendChild(headRow)
    table.appendChild(thead)
    const tbody = document.createElement('tbody')
    previewRows.forEach(cells => {
        const tr = document.createElement('tr')
        headers.forEach((_, i) => {
            const td = document.createElement('td')
            td.textContent = cells[i] ?? ''
            tr.appendChild(td)
        })
        tbody.appendChild(tr)
    })
    table.appendChild(tbody)
    previewWrap.appendChild(table)
    panel.appendChild(previewWrap)

    // Field → column selects
    const fieldGrid = document.createElement('div')
    fieldGrid.className = 'csv-mapper__fields'
    const fieldSelects = new Map<string, HTMLSelectElement>()
    FIELDS.forEach(field => {
        const wrap = document.createElement('label')
        wrap.className = 'csv-mapper__field'
        const caption = document.createElement('span')
        caption.textContent = field.required ? `${field.label} *` : field.label
        wrap.appendChild(caption)
        const select = document.createElement('select')
        select.className = 'form-control'
        const none = document.createElement('option')
        none.value = ''
        none.textContent = '— not present —'
        select.appendChild(none)
        headers.forEach((h, idx) => {
            const opt = document.createElement('option')
            opt.value = String(idx)
            opt.textContent = h
            select.appendChild(opt)
        })
        const guess = guessColumn(headers, field.hints)
        if (guess !== -1) select.value = String(guess)
        fieldSelects.set(field.key, select)
        wrap.appendChild(select)
        fieldGrid.appendChild(wrap)
    })
    panel.appendChild(fieldGrid)

    // Action-value → order-type mapping (rebuilt when the action column changes)
    const actionSection = document.createElement('div')
    actionSection.className = 'csv-mapper__actions-map'
    panel.appendChild(actionSection)
    const actionValueSelects = new Map<string, HTMLSelectElement>()

    const rebuildActionMap = () => {
        actionSection.textContent = ''
        actionValueSelects.clear()
        const colIdx = Number(fieldSelects.get('action')!.value)
        if (!Number.isFinite(colIdx) || fieldSelects.get('action')!.value === '') return
        const label = document.createElement('h3')
        label.className = 'csv-mapper__subtitle'
        label.textContent = 'Action values'
        actionSection.appendChild(label)
        const distinct = Array.from(new Set(dataRows.map(r => (r[colIdx] ?? '').trim()).filter(Boolean))).slice(0, 20)
        distinct.forEach(value => {
            const rowEl = document.createElement('label')
            rowEl.className = 'csv-mapper__field'
            const caption = document.createElement('span')
            caption.textContent = value
            rowEl.appendChild(caption)
            const select = document.createElement('select')
            select.className = 'form-control'
            ACTION_CHOICES.forEach(choice => {
                const opt = document.createElement('option')
                opt.value = choice.value
                opt.textContent = choice.label
                select.appendChild(opt)
            })
            select.value = guessOrderType(value)
            actionValueSelects.set(value, select)
            rowEl.appendChild(select)
            actionSection.appendChild(rowEl)
        })
    }
    fieldSelects.get('action')!.addEventListener('change', rebuildActionMap)
    rebuildActionMap()

    const actions = document.createElement('div')
    actions.className = 'csv-mapper__buttons'
    const cancelBtn = document.createElement('button')
    cancelBtn.type = 'button'
    cancelBtn.className = 'btn btn--secondary'
    cancelBtn.textContent = 'Cancel'
    cancelBtn.addEventListener('click', () => { dialog.close(); dialog.remove() })
    const importBtn = document.createElement('button')
    importBtn.type = 'button'
    importBtn.className = 'btn btn--primary'
    importBtn.textContent = 'Import'
    actions.appendChild(cancelBtn)
    actions.appendChild(importBtn)
    panel.appendChild(actions)

    importBtn.addEventListener('click', () => {
        const missing = FIELDS.filter(f => f.required && fieldSelects.get(f.key)!.value === '')
        if (missing.length) {
            this.showNotification(`Map the required columns first: ${missing.map(f => f.label).join(', ')}.`, 'error')
            return
        }
        const columnOf = (key: string): number | null => {
            const v = fieldSelects.get(key)!.value
            return v === '' ? null : Number(v)
        }
        const mapping: Record<string, number | null> = {}
        FIELDS.forEach(f => { mapping[f.key] = columnOf(f.key) })
        const actionMap: Record<string, string> = {}
        actionValueSelects.forEach((select, value) => { actionMap[value] = select.value })

        const transactions = buildMappedTransactions.call(this, dataRows, mapping, actionMap)
        if (!transactions.length) {
            this.showNotification('No importable rows after mapping — check the Action value assignments.', 'error')
            return
        }
        dialog.close()
        dialog.remove()
        this.importMappedCsvTransactions(transactions, context)
    })

    document.body.appendChild(dialog)
    dialog.showModal()
}

function buildMappedTransactions(this: any, rows: string[][], mapping: Record<string, number | null>, actionMap: Record<string, string>): AnyRecord[] {
    const cell = (row: string[], key: string): string => {
        const idx = mapping[key]
        return idx === null || idx === undefined ? '' : (row[idx] ?? '').trim()
    }

    const transactions: AnyRecord[] = []
    rows.forEach((row, rowIndex) => {
        const actionValue = cell(row, 'action')
        const orderType = actionMap[actionValue] || ''
        if (!orderType) return

        const tradeDateIso = this.normalizeRobinhoodDate(cell(row, 'date'))
        const symbol = cell(row, 'symbol').toUpperCase()
        const qty = Math.abs(this.parseRobinhoodNumber(cell(row, 'quantity')) || 0)
        if (!tradeDateIso || !symbol || !qty) return

        const price = Math.abs(this.parseRobinhoodNumber(cell(row, 'price')) || 0)
        const fees = Math.abs(this.parseRobinhoodNumber(cell(row, 'fees')) || 0)
        const total = this.parseRobinhoodNumber(cell(row, 'amount')) || 0

        const optionTypeRaw = cell(row, 'optionType').toUpperCase()
        const optionType = optionTypeRaw.startsWith('P') ? 'PUT' : optionTypeRaw.startsWith('C') ? 'CALL' : ''
        const strike = this.parseRobinhoodNumber(cell(row, 'strike'))
        const expirationIso = this.normalizeRobinhoodDate(cell(row, 'expiration'))
        const isOption = Boolean(optionType && strike && expirationIso)

        const timeKey = tradeDateIso.replace(/-/g, '')
        const actionSide = this.mapOrderTypeToActionSide(orderType)
        const category = isOption ? 'OPTION' : 'STOCK'
        const groupKey = [timeKey, symbol, actionSide.side, category, isOption ? expirationIso : ''].filter(Boolean).join('|')

        transactions.push({
            externalId: `CSV-${tradeDateIso}-${symbol}-${isOption ? `${optionType}-${strike}` : 'STOCK'}-${orderType}-${rowIndex}`,
            groupKey,
            tag: `${orderType.startsWith('B') ? 'BUY' : 'SELL'}${isOption ? 'OPT' : 'STOCK'}`,
            orderType,
            tradeDate: tradeDateIso,
            tradeTimeKey: timeKey,
            ticker: symbol,
            underlying: symbol,
            optionType,
            strike: isOption ? strike : (price || null),
            expiration: isOption ? expirationIso : '',
            multiplier: isOption ? 100 : 1,
            quantity: qty,
            price,
            total,
            fees,
            category,
            securityId: null,
            memo: '',
            currency: 'USD',
            importSource: 'CSV'
        })
    })
    return transactions
}

export async function importMappedCsvTransactions(this: any, transactions: AnyRecord[], context: AnyRecord = {}) {
    const batchId = (context.batchId as string) || `CSV-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
    const importContext = { ...context, batchId, sourceLabel: 'CSV' }
    const importResult = this.buildRobinhoodImportPayload({ transactions }, importContext)
    this.applyRobinhoodImportResult(importResult, importContext)
}
