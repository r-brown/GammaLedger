// src/imports/schwab.ts — Charles Schwab transaction-CSV import parser.
// Emits the same normalized transaction shape as the Robinhood parser and
// reuses its payload builder / apply pipeline (matching, rolls, wheels,
// duplicate detection via externalId).
// Uses the .call(this, …) delegation pattern.

type AnyRecord = Record<string, any>

// "AAPL 08/15/2026 210.00 P" — Schwab's option symbol format.
const OPTION_SYMBOL_RE = /^([A-Z][A-Z0-9./]{0,9})\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+([\d,.]+)\s+([CP])$/i

const SCHWAB_REQUIRED_HEADERS = ['Date', 'Action', 'Symbol', 'Quantity', 'Price', 'Amount'] as const

/** Sniff a CSV payload: dedicated Robinhood / Schwab parser, or the generic mapper. */
export function detectCsvFormat(this: any, raw: string): 'robinhood' | 'schwab' | 'unknown' {
    if (typeof raw !== 'string') return 'unknown';
    const lines = raw.split(/\r?\n/).slice(0, 5);
    for (const line of lines) {
        if (!line.trim()) continue;
        const cells = (this.parseCsvRow(line) as string[]).map(c => c.trim());
        if (cells.includes('Activity Date') && cells.includes('Trans Code')) {
            return 'robinhood';
        }
        if (SCHWAB_REQUIRED_HEADERS.every(h => cells.includes(h)) && cells.includes('Fees & Comm')) {
            return 'schwab';
        }
    }
    return 'unknown';
}

export function handleSchwabCsvFileSelection(this: any, event: Event) {
    const input = event?.target as HTMLInputElement | null;
    if (!input || !input.files || input.files.length === 0) {
        return;
    }

    const [file] = input.files;
    input.value = '';

    if (!file) {
        return;
    }

    this.importSchwabCsvFile(file, { fileName: file.name || 'Schwab CSV import' })
        .catch((error: unknown) => {
            console.error('Schwab CSV import error:', error);
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.showNotification(`Failed to import Schwab CSV: ${message}`, 'error');
            this.appendImportLog({
                type: 'error',
                message: `Failed to import ${file.name || 'Schwab CSV file'}: ${message}`,
                timestamp: new Date()
            });
        })
        .finally(() => {
            this.hideLoadingIndicator();
        });
}

export async function importSchwabCsvFile(this: any, file: File, context: AnyRecord = {}) {
    if (!file) {
        throw new Error('No file selected.');
    }

    this.showLoadingIndicator('Importing Schwab CSV...');
    const text = await file.text();
    await this.importSchwabCsvContent(text, { ...context, fileSize: file.size || 0 });
}

export async function importSchwabCsvContent(this: any, raw: string, context: Record<string, unknown> = {}) {
    const batchId = (context.batchId as string) || `SCHWAB-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const importContext = { ...context, batchId, sourceLabel: 'Schwab' };
    const parsed = this.parseSchwabCsv(raw);
    const importResult = this.buildRobinhoodImportPayload(parsed, importContext);
    this.applyRobinhoodImportResult(importResult, importContext);
    if (parsed.skipped?.length) {
        this.appendImportLog({
            type: 'info',
            message: `Schwab import: skipped ${parsed.skipped.length} non-trade row(s) (${summarizeSkips(parsed.skipped)}).`,
            timestamp: new Date()
        });
    }
}

function summarizeSkips(skipped: Array<{ action: string }>): string {
    const counts = new Map<string, number>();
    skipped.forEach(({ action }) => counts.set(action, (counts.get(action) ?? 0) + 1));
    return Array.from(counts.entries()).map(([action, n]) => `${n}× ${action}`).join(', ');
}

// Strip the "as of MM/DD/YYYY" suffix Schwab appends to settlement-shifted dates.
function cleanSchwabDate(value: string): string {
    return (value || '').split(/\s+as\s+of\s+/i)[0].trim();
}

export function parseSchwabCsv(this: any, raw: string) {
    if (typeof raw !== 'string') {
        throw new Error('Schwab CSV payload is invalid.');
    }

    const lines = raw.split(/\r?\n/);

    // The header row is not always the first line — exports open with a
    // '"Transactions for account …"' title line.
    let headerIndex = -1;
    let headerMap: Record<string, number> = {};
    for (let i = 0; i < Math.min(lines.length, 5); i++) {
        if (!lines[i].trim()) continue;
        const cells = (this.parseCsvRow(lines[i]) as string[]).map((c: string) => c.trim());
        if (SCHWAB_REQUIRED_HEADERS.every(h => cells.includes(h))) {
            headerIndex = i;
            cells.forEach((cell: string, idx: number) => { headerMap[cell] = idx; });
            break;
        }
    }
    if (headerIndex === -1) {
        throw new Error(`Invalid Schwab CSV: header row with ${SCHWAB_REQUIRED_HEADERS.join(', ')} not found.`);
    }

    const col = (cells: string[], name: string): string =>
        headerMap[name] !== undefined ? (cells[headerMap[name]] ?? '').trim() : '';

    const transactions: AnyRecord[] = [];
    const skipped: Array<{ action: string; rowIndex: number }> = [];

    for (let i = headerIndex + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const cells = this.parseCsvRow(line) as string[];
        const action = col(cells, 'Action');
        const dateRaw = cleanSchwabDate(col(cells, 'Date'));
        if (!action || !dateRaw || /^Transactions?\s+Total/i.test(cells[0] ?? '')) {
            continue;
        }

        const tx = this.parseSchwabTransaction({
            action,
            date: dateRaw,
            symbol: col(cells, 'Symbol'),
            description: col(cells, 'Description'),
            quantity: col(cells, 'Quantity'),
            price: col(cells, 'Price'),
            fees: col(cells, 'Fees & Comm'),
            amount: col(cells, 'Amount'),
            rowIndex: i
        });

        if (tx) {
            transactions.push(tx);
        } else {
            skipped.push({ action, rowIndex: i });
        }
    }

    // Flag stock buys that settle an assignment: an Assigned PUT row pairs
    // with a stock Buy of contracts×multiplier shares at the strike price.
    // (Mirrors Robinhood's CUSIP-description detection so the wheel-merge
    // passes in the shared payload builder fire.)
    transactions
        .filter(tx => tx.isAssignment && tx.category === 'OPTION' && tx.optionType === 'PUT')
        .forEach(assignment => {
            const shares = Math.abs(assignment.quantity) * (assignment.multiplier || 100);
            const stockBuy = transactions.find(tx =>
                tx.category === 'STOCK'
                && tx.orderType === 'BTO'
                && !tx.isAssignment
                && tx.ticker === assignment.ticker
                && Math.abs(tx.quantity) === shares
                && (!tx.price || !assignment.strike || Math.abs(tx.price - assignment.strike) < 0.01)
            );
            if (stockBuy) {
                stockBuy.isAssignment = true;
                stockBuy.memo = stockBuy.memo || 'Shares from put assignment';
            }
        });

    return { transactions, skipped };
}

export function mapSchwabAction(this: any, action: unknown): string | null {
    const normalized = (action || '').toString().trim().toLowerCase();
    switch (normalized) {
        case 'sell to open': return 'STO';
        case 'buy to open': return 'BTO';
        case 'buy to close': return 'BTC';
        case 'sell to close': return 'STC';
        case 'buy': return 'BTO';
        case 'sell': return 'STC';
        default: return null;
    }
}

export function parseSchwabTransaction(this: any, row: AnyRecord) {
    const { action, date, symbol, quantity, price, fees, amount, rowIndex } = row;
    const normalizedAction = (action || '').toString().trim().toLowerCase();

    // Expirations are skipped: the lifecycle engine auto-expires open groups
    // past their expiration date, and importing a synthetic close would
    // double-terminate the group. Exercise/assignment of long options is rare
    // enough to leave to the review queue via the unmatched-leg path.
    if (normalizedAction === 'expired' || normalizedAction === 'exchange or exercise') {
        return null;
    }

    const optionMatch = (symbol || '').match(OPTION_SYMBOL_RE);
    const tradeDateIso = this.normalizeRobinhoodDate(date) || '';
    if (!tradeDateIso) return null;

    const qty = Math.abs(this.parseRobinhoodNumber(quantity) || 0);
    const unitPrice = Math.abs(this.parseRobinhoodNumber(price) || 0);
    const feeValue = Math.abs(this.parseRobinhoodNumber(fees) || 0);
    const total = this.parseRobinhoodNumber(amount) || 0;
    const timeKey = tradeDateIso.replace(/-/g, '');

    if (optionMatch) {
        const ticker = optionMatch[1].toUpperCase();
        const expirationIso = this.normalizeRobinhoodDate(optionMatch[2]) || '';
        const strike = this.parseRobinhoodNumber(optionMatch[3]);
        const optionType = optionMatch[4].toUpperCase() === 'P' ? 'PUT' : 'CALL';

        const isAssignment = normalizedAction === 'assigned';
        // Assigned short put → bought back by the OCC (BTC); assigned short
        // call → shares called away, the option leaves as STC. Both at $0.
        const orderType = isAssignment
            ? (optionType === 'PUT' ? 'BTC' : 'STC')
            : this.mapSchwabAction(action);
        if (!orderType) return null;
        if (!qty) return null;

        const actionSide = this.mapOrderTypeToActionSide(orderType);
        const groupKey = [timeKey, ticker, actionSide.side, 'OPTION', expirationIso].filter(Boolean).join('|');

        return {
            externalId: `SCHWAB-${tradeDateIso}-${ticker}-${optionType}-${strike}-${orderType}-${rowIndex}`,
            groupKey,
            tag: orderType.startsWith('B') ? 'BUYOPT' : 'SELLOPT',
            orderType,
            tradeDate: tradeDateIso,
            tradeTimeKey: timeKey,
            ticker,
            underlying: ticker,
            optionType,
            strike,
            expiration: expirationIso,
            multiplier: 100,
            quantity: qty,
            price: isAssignment ? 0 : unitPrice,
            total: isAssignment ? 0 : total,
            fees: feeValue,
            category: 'OPTION',
            securityId: null,
            memo: isAssignment ? `Assigned (${optionType.toLowerCase()})` : '',
            currency: 'USD',
            importSource: 'Schwab',
            ...(isAssignment ? { isAssignment: true } : {})
        };
    }

    // Stock rows — plain ticker symbol, Buy/Sell actions only.
    const orderType = this.mapSchwabAction(action);
    if (!orderType || (orderType !== 'BTO' && orderType !== 'STC')) return null;
    const ticker = (symbol || '').toString().trim().toUpperCase();
    if (!ticker || !qty) return null;

    const actionSide = this.mapOrderTypeToActionSide(orderType);
    const groupKey = [timeKey, ticker, actionSide.side, 'STOCK'].filter(Boolean).join('|');

    return {
        externalId: `SCHWAB-${tradeDateIso}-${ticker}-STOCK-${orderType}-${rowIndex}`,
        groupKey,
        tag: orderType === 'BTO' ? 'BUYSTOCK' : 'SELLSTOCK',
        orderType,
        tradeDate: tradeDateIso,
        tradeTimeKey: timeKey,
        ticker,
        underlying: ticker,
        optionType: '',
        strike: unitPrice || null,
        expiration: '',
        multiplier: 1,
        quantity: qty,
        price: unitPrice,
        total,
        fees: feeValue,
        category: 'STOCK',
        securityId: null,
        memo: '',
        currency: 'USD',
        importSource: 'Schwab'
    };
}
