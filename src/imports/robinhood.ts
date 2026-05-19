// src/imports/robinhood.js — Wave 7: Robinhood CSV import parser.
// Uses the .call(this, …) delegation pattern.

type AnyRecord = Record<string, any>

export function handleRobinhoodCsvFileSelection(this: any, event: Event) {
    const input = event?.target as HTMLInputElement | null;
    if (!input || !input.files || input.files.length === 0) {
        return;
    }

    const [file] = input.files;
    input.value = '';

    if (!file) {
        return;
    }

    this.importRobinhoodCsvFile(file, { fileName: file.name || 'Robinhood CSV import' })
        .catch((error: unknown) => {
            console.error('Robinhood CSV import error:', error);
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.showNotification(`Failed to import Robinhood CSV: ${message}`, 'error');
            this.appendImportLog({
                type: 'error',
                message: `Failed to import ${file.name || 'Robinhood CSV file'}: ${message}`,
                timestamp: new Date()
            });
        })
        .finally(() => {
            this.hideLoadingIndicator();
        });
}

export function parseRobinhoodCsv(this: any, raw: string) {
    if (typeof raw !== 'string') {
        throw new Error('Robinhood CSV payload is invalid.');
    }

    const lines = raw.split(/\r?\n/);
    if (lines.length < 2) {
        throw new Error('Invalid Robinhood CSV: no data rows found.');
    }

    const headerLine = lines[0];
    const headers = this.parseCsvRow(headerLine);
    const headerMap: Record<string, number> = {};
    headers.forEach((header: string, index: number) => {
        headerMap[header.trim()] = index;
    });

    const requiredHeaders = ['Activity Date', 'Process Date', 'Description', 'Trans Code', 'Quantity', 'Price', 'Amount'];
    const missingHeaders = requiredHeaders.filter((h: string) => headerMap[h] === undefined);
    if (missingHeaders.length > 0) {
        throw new Error(`Invalid Robinhood CSV: missing headers: ${missingHeaders.join(', ')}`);
    }

    const transactions: AnyRecord[] = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) {
            continue;
        }

        const values = this.parseCsvRow(line);
        const activityDate = values[headerMap['Activity Date']] || '';
        const processDate = values[headerMap['Process Date']] || '';
        const description = values[headerMap['Description']] || '';
        const transCode = values[headerMap['Trans Code']] || '';
        const instrument = values[headerMap['Instrument']] || '';
        const quantityRaw = values[headerMap['Quantity']] || '';
        const priceRaw = values[headerMap['Price']] || '';
        const amountRaw = values[headerMap['Amount']] || '';

        if (!activityDate || !transCode) {
            continue;
        }

        const transaction = this.parseRobinhoodTransaction({
            activityDate,
            processDate,
            description,
            transCode,
            instrument,
            quantity: quantityRaw,
            price: priceRaw,
            amount: amountRaw,
            rowIndex: i
        });

        if (transaction) {
            transactions.push(transaction);
        }
    }

    return { transactions };
}

export function parseRobinhoodTransaction(this: any, row: AnyRecord) {
    const { activityDate, processDate, description, transCode, instrument, quantity, price, amount, rowIndex } = row;

    const normalizedTransCode = transCode.toString().trim().toUpperCase();

    // OASGN rows record which option was assigned — parse them into an
    // implicit closing leg (BTC for puts, STC for calls) so the original
    // short-option trade is marked as closed.
    if (normalizedTransCode === 'OASGN') {
        return this.parseRobinhoodAssignmentClosingLeg(row);
    }

    // Handle stock purchase from assignment (Buy with CUSIP in description)
    if ((normalizedTransCode === 'BUY' || normalizedTransCode === 'SELL') && description.includes('CUSIP:')) {
        return this.parseRobinhoodAssignedStockTransaction({ ...row, processDate });
    }

    const optionMatch = description.match(/^([A-Z]+)\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+(Put|Call)\s+\$?([\d,.]+)$/i);

    if (optionMatch) {
        return this.parseRobinhoodOptionTransaction({
            activityDate,
            processDate,
            transCode: normalizedTransCode,
            instrument,
            ticker: optionMatch[1],
            expirationRaw: optionMatch[2],
            optionType: optionMatch[3],
            strikeRaw: optionMatch[4],
            quantity,
            price,
            amount,
            rowIndex
        });
    }

    if (normalizedTransCode === 'BUY' || normalizedTransCode === 'SELL') {
        return this.parseRobinhoodStockTransaction({
            activityDate,
            processDate,
            transCode: normalizedTransCode,
            instrument,
            description,
            quantity,
            price,
            amount,
            rowIndex
        });
    }

    return null;
}

export function parseRobinhoodOptionTransaction(this: any, data: AnyRecord) {
    const {
        activityDate,
        processDate,
        transCode,
        instrument,
        ticker,
        expirationRaw,
        optionType,
        strikeRaw,
        quantity,
        price,
        amount,
        rowIndex
    } = data;

    const orderType = this.mapRobinhoodTransCode(transCode);
    if (!orderType) {
        return null;
    }

    // Use Process Date as entry; Description-derived expiration for options
    const tradeDateIso = this.normalizeRobinhoodDate(processDate) || this.normalizeRobinhoodDate(activityDate) || '';
    const expirationIso = this.normalizeRobinhoodDate(expirationRaw) || '';

    const strike = this.parseRobinhoodNumber(strikeRaw);
    const qty = Math.abs(this.parseRobinhoodNumber(quantity) || 0);
    const premium = Math.abs(this.parseRobinhoodNumber(price) || 0);
    const total = this.parseRobinhoodNumber(amount) || 0;

    const fees = this.calculateRobinhoodFees(qty, premium, total);

    const tickerSymbol = (ticker || instrument || '').toUpperCase();
    const actionSide = this.mapOrderTypeToActionSide(orderType);

    // Determine if this is a buy or sell based on orderType
    const isBuyOrder = orderType === 'BTO' || orderType === 'BTC';
    const tag = isBuyOrder ? 'BUYOPT' : 'SELLOPT';

    const timeKey = tradeDateIso.replace(/-/g, '');
    const groupKey = [timeKey, tickerSymbol, actionSide.side, 'OPTION', expirationIso].filter(Boolean).join('|');
    const externalId = `RH-${tradeDateIso}-${tickerSymbol}-${optionType.toUpperCase()}-${strike}-${orderType}-${rowIndex}`;

    return {
        externalId,
        groupKey,
        tag,
        orderType,
        tradeDate: tradeDateIso,
        tradeTimeKey: timeKey,
        ticker: tickerSymbol,
        underlying: tickerSymbol,
        optionType: optionType.toUpperCase(),
        strike,
        expiration: expirationIso,
        multiplier: 100,
        quantity: qty,
        price: premium,
        total,
        fees,
        category: 'OPTION',
        securityId: null,
        memo: '',
        currency: 'USD'
    };
}

export function parseRobinhoodStockTransaction(this: any, data: AnyRecord) {
    const {
        activityDate,
        processDate,
        transCode,
        instrument,
        description,
        quantity,
        price,
        amount,
        rowIndex
    } = data;

    const orderType = transCode === 'BUY' ? 'BTO' : 'STC';
    // Use Process Date as entry date (string-safe, no timezone shift)
    const tradeDateIso = this.normalizeRobinhoodDate(processDate) || this.normalizeRobinhoodDate(activityDate) || '';

    const qty = Math.abs(this.parseRobinhoodNumber(quantity) || 0);
    const unitPrice = Math.abs(this.parseRobinhoodNumber(price) || 0);
    const total = this.parseRobinhoodNumber(amount) || 0;

    const fees = Math.abs(Math.abs(total) - (qty * unitPrice));
    const tickerSymbol = (instrument || '').toUpperCase();

    const actionSide = this.mapOrderTypeToActionSide(orderType);
    const timeKey = tradeDateIso.replace(/-/g, '');
    const groupKey = [timeKey, tickerSymbol, actionSide.side, 'STOCK'].filter(Boolean).join('|');
    const externalId = `RH-${tradeDateIso}-${tickerSymbol}-STOCK-${orderType}-${rowIndex}`;

    return {
        externalId,
        groupKey,
        tag: transCode === 'BUY' ? 'BUYSTOCK' : 'SELLSTOCK',
        orderType,
        tradeDate: tradeDateIso,
        tradeTimeKey: timeKey,
        ticker: tickerSymbol,
        underlying: tickerSymbol,
        optionType: '',
        strike: unitPrice || null,
        expiration: '',
        multiplier: 1,
        quantity: qty,
        price: unitPrice,
        total,
        fees: fees > 0.01 ? fees : 0,
        category: 'STOCK',
        securityId: null,
        memo: '',
        currency: 'USD'
    };
}

export function parseRobinhoodAssignedStockTransaction(this: any, row: AnyRecord) {
    const { activityDate, processDate, description, instrument, quantity, price, amount, rowIndex } = row;

    // Extract number of contracts from description like "2 CRWV Options Assigned".
    // Bounds: ≤10 digits (contract qty), ≤20 letters (ticker), ≤10 whitespace chars each.
    const contractMatch = description.match(/(\d{1,10})\s{1,10}([A-Z]{1,20})\s{1,10}Options?\s{1,10}Assigned/i);
    const tickerSymbol = (instrument || (contractMatch ? contractMatch[2] : '')).toUpperCase();

    // Use Process Date as entry date (string-safe, no timezone shift)
    const tradeDateIso = this.normalizeRobinhoodDate(processDate) || this.normalizeRobinhoodDate(activityDate) || '';

    const qty = Math.abs(this.parseRobinhoodNumber(quantity) || 0);
    const unitPrice = Math.abs(this.parseRobinhoodNumber(price) || 0);
    const total = this.parseRobinhoodNumber(amount) || 0;

    // Stock from put assignment is a BTO (Buy to Open)
    const orderType = 'BTO';
    const timeKey = tradeDateIso.replace(/-/g, '');
    const groupKey = [timeKey, tickerSymbol, 'OPEN', 'STOCK'].filter(Boolean).join('|');
    const externalId = `RH-${tradeDateIso}-${tickerSymbol}-STOCK-ASSIGNED-${rowIndex}`;

    return {
        externalId,
        groupKey,
        tag: 'BUYSTOCK',
        orderType,
        tradeDate: tradeDateIso,
        tradeTimeKey: timeKey,
        ticker: tickerSymbol,
        underlying: tickerSymbol,
        optionType: '',
        strike: unitPrice || null,
        expiration: '',
        multiplier: 1,
        quantity: qty,
        price: unitPrice,
        total,
        fees: 0,
        category: 'STOCK',
        securityId: null,
        memo: 'Shares from put assignment',
        currency: 'USD',
        isAssignment: true
    };
}

export function parseRobinhoodAssignmentClosingLeg(this: any, row: AnyRecord) {
    const { activityDate, processDate, description, instrument, quantity, rowIndex } = row;

    // Reuse the standard option-description regex:
    // "TICKER MM/DD/YYYY Put|Call $STRIKE"
    const optionMatch = (description || '').match(
        /^([A-Z]+)\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+(Put|Call)\s+\$?([\d,.]+)$/i
    );
    if (!optionMatch) {
        return null;
    }

    const ticker = (optionMatch[1] || instrument || '').toUpperCase();
    const expirationRaw = optionMatch[2];
    const optionType = optionMatch[3].toUpperCase();
    const strike = this.parseRobinhoodNumber(optionMatch[4]);

    const tradeDateIso = this.normalizeRobinhoodDate(processDate) || this.normalizeRobinhoodDate(activityDate) || '';
    const expirationIso = this.normalizeRobinhoodDate(expirationRaw) || '';
    const qty = Math.abs(this.parseRobinhoodNumber(quantity) || 0) || 1;

    // Assigned put → exchange buys it back (BTC); assigned call → exchange sells it (STC)
    const orderType = optionType === 'PUT' ? 'BTC' : 'STC';
    const tag = optionType === 'PUT' ? 'BUYOPT' : 'SELLOPT';

    const timeKey = tradeDateIso.replace(/-/g, '');
    const actionSide = this.mapOrderTypeToActionSide(orderType);
    const groupKey = [timeKey, ticker, actionSide.side, 'OPTION', expirationIso].filter(Boolean).join('|');
    const externalId = `RH-${tradeDateIso}-${ticker}-${optionType}-${strike}-OASGN-${rowIndex}`;

    return {
        externalId,
        groupKey,
        tag,
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
        price: 0,       // assignment has no premium
        total: 0,
        fees: 0,
        category: 'OPTION',
        securityId: null,
        memo: `Assigned (${optionType.toLowerCase()})`,
        currency: 'USD',
        isAssignment: true
    };
}

export function mapRobinhoodTransCode(this: any, transCode: unknown) {
    const normalized = (transCode || '').toString().trim().toUpperCase();
    switch (normalized) {
        case 'BTO':
            return 'BTO';
        case 'BTC':
            return 'BTC';
        case 'STO':
            return 'STO';
        case 'STC':
            return 'STC';
        case 'BUY':
            return 'BTO';
        case 'SELL':
            return 'STC';
        default:
            return null;
    }
}

export function parseRobinhoodDate(this: any, value: string) {
    if (!value) {
        return null;
    }

    const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (match) {
        const month = parseInt(match[1], 10) - 1;
        const day = parseInt(match[2], 10);
        const year = parseInt(match[3], 10);
        const date = new Date(year, month, day);
        if (!isNaN(date.getTime())) {
            return date;
        }
    }

    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed;
}

export function normalizeRobinhoodDate(this: any, value: unknown) {
    // Returns YYYY-MM-DD without timezone shifts from MM/DD/YYYY or ISO-ish inputs
    if (!value) {
        return '';
    }

    const str = value.toString().trim();
    const mdy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (mdy) {
        const month = String(parseInt(mdy[1], 10)).padStart(2, '0');
        const day = String(parseInt(mdy[2], 10)).padStart(2, '0');
        const year = mdy[3];
        return `${year}-${month}-${day}`;
    }

    // Try Date parsing but convert back to ISO date-only
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
        return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
    }

    return '';
}

export function parseRobinhoodNumber(this: any, value: unknown) {
    if (value === null || value === undefined || value === '') {
        return 0;
    }

    const cleaned = value.toString()
        .replace(/[$,]/g, '')
        .replace(/\(([^)]{0,50})\)/, '-$1')   // ≤50 chars covers any realistic dollar amount
        .trim();

    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
}

export function calculateRobinhoodFees(this: any, quantity: number, premium: number, total: number) {
    const expectedTotal = quantity * premium * 100;
    const actualTotal = Math.abs(total);
    const difference = Math.abs(actualTotal - expectedTotal);

    if (difference > 0.01 && difference < expectedTotal * 0.1) {
        return Math.round(difference * 100) / 100;
    }
    return 0;
}

export function buildRobinhoodImportPayload(this: any, parsed: unknown, context: Record<string, unknown> = {}) {
    const _parsed = parsed as Record<string, unknown> | null;
    const transactions: AnyRecord[] = Array.isArray(_parsed?.transactions) ? (_parsed!.transactions as AnyRecord[]) : [];
    const batchId = context.batchId || null;
    const updates = new Map<string, AnyRecord[]>();
    const newTrades: AnyRecord[] = [];
    const reviewTradeIds: string[] = [];

    const stats = {
        totalTransactions: transactions.length,
        totalGroups: 0,
        openingLegs: 0,
        closingLegs: 0,
        matchedClosingLegs: 0,
        unmatchedClosingLegs: 0,
        duplicateLegs: 0,
        legsAddedToUpdates: 0,
        legsAddedToNewTrades: 0,
        tradesCreated: 0,
        reviewTradesCreated: 0,
        totalTradesCreated: 0,
        tradesUpdated: 0,
        reviewLegs: 0
    };

    if (!transactions.length) {
        return { newTrades, updates, stats, batchId, reviewTradeIds };
    }

    // Build position index from existing trades for matching closing legs
    const positionIndex = this.buildPositionIndex(this.trades);
    const existingExternalIds = this.buildExistingExternalIdSet();
    const seenExternalIds = new Set<string>();

    // Convert all transactions to legs first
    const allLegs: AnyRecord[] = [];
    transactions.forEach((tx: AnyRecord) => {
        const leg = this.buildLegFromRobinhoodTransaction(tx);
        if (!leg) {
            return;
        }
        if (leg.externalId && (existingExternalIds.has(leg.externalId) || seenExternalIds.has(leg.externalId))) {
            stats.duplicateLegs += 1;
            return;
        }
        if (batchId) {
            leg.importBatchId = batchId;
        }
        if (leg.externalId) {
            seenExternalIds.add(leg.externalId);
        }
        allLegs.push(leg);
    });

    // Separate into opening and closing legs
    const openingLegs = allLegs.filter((leg: AnyRecord) => this.getLegSide(leg) === 'OPEN');
    // Consolidate closing leg split fills (e.g. BTC 2 + BTC 1 → BTC 3)
    const rawClosingLegs = allLegs.filter((leg: AnyRecord) => this.getLegSide(leg) === 'CLOSE');
    const closingLegs = this.consolidateImportLegs(rawClosingLegs);

    stats.openingLegs = openingLegs.length;
    stats.closingLegs = closingLegs.length;

    // Group opening legs by position signature (ticker + optionType + strike + expiration)
    // This groups split orders into single trades
    const openingGroups = new Map<string, AnyRecord>();
    openingLegs.forEach((leg: AnyRecord) => {
        const ticker = (leg.tickerSymbol || '').toUpperCase();
        const type = (leg.type || '').toUpperCase();
        const strike = Number(leg.strike) || 0;
        const expiration = leg.expirationDate || '';
        const positionKey = [ticker, type, strike, expiration].join('|');

        if (!openingGroups.has(positionKey)) {
            openingGroups.set(positionKey, { ticker, legs: [] });
        }
        openingGroups.get(positionKey)!.legs.push(leg);
    });

    // Create trades from opening leg groups and build a new position index for matching closing legs
    const newPositionIndex = new Map<string, AnyRecord[]>();
    const pendingTrades: AnyRecord[] = [];

    openingGroups.forEach((group: AnyRecord, positionKey: string) => {
        const ticker = group.ticker;
        const legs = group.legs;

        // Consolidate legs with same properties (split orders from same trade)
        const consolidatedLegs = this.consolidateImportLegs(legs);

        const tradeId = `TRD-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
        const strategy = this.inferStrategyFromLegs(consolidatedLegs);
        const sanitizedLegs = consolidatedLegs.map((leg: AnyRecord) => this.sanitizeImportedLeg(leg));
        const note = this.composeImportNotes(context, { legCount: sanitizedLegs.length });

        // Determine status
        const hasAssignmentLegs = consolidatedLegs.some((leg: AnyRecord) => leg.isAssignment);
        const status = hasAssignmentLegs ? 'Assigned' : 'Open';

        const newTrade = {
            id: tradeId,
            ticker,
            strategy,
            status,
            notes: note,
            legs: sanitizedLegs,
            importReview: consolidatedLegs.length > 4
        };

        pendingTrades.push({ trade: newTrade, consolidatedLegs, ticker });

        // Add to new position index for matching closing legs
        consolidatedLegs.forEach((leg: AnyRecord) => {
            const key = this.buildPositionKey(ticker, leg);
            if (!key) return;
            const quantity = Math.abs(Number(leg.quantity) || 0);
            if (!quantity) return;

            const bucket = newPositionIndex.get(key) || [];
            bucket.push({ trade: newTrade, remaining: quantity });
            newPositionIndex.set(key, bucket);
        });
    });

    // Match closing legs to existing trades first, then to newly created trades
    const unmatchedClosingLegs: AnyRecord[] = [];

    closingLegs.forEach((closingLeg: AnyRecord) => {
        const ticker = (closingLeg.tickerSymbol || '').toUpperCase();
        const key = this.buildPositionKey(ticker, closingLeg, { forMatching: true });
        let remainingQty = Math.abs(Number(closingLeg.quantity) || 0);

        // First try to match against existing trades
        const existingMatch = this.consumePositionMatches(positionIndex, key, { ...closingLeg, quantity: remainingQty });

        if (existingMatch.matched.length) {
            existingMatch.matched.forEach((entry: AnyRecord) => {
                const targetTrade = entry.trade;
                if (!targetTrade) return;
                if (this.tradeContainsExternalId(targetTrade, closingLeg.externalId)) return;

                const bucket = updates.get(targetTrade.id) || [];
                const legClone: AnyRecord = { ...closingLeg, quantity: entry.quantity };
                if (batchId) legClone.importBatchId = batchId;
                bucket.push(this.sanitizeImportedLeg(legClone));
                updates.set(targetTrade.id, bucket);
                stats.legsAddedToUpdates += 1;
                stats.matchedClosingLegs += entry.quantity;
            });
            remainingQty = existingMatch.unmatched;
        }

        // Then try to match against newly created trades in this import
        if (remainingQty > 0 && newPositionIndex.has(key)) {
            const entries = newPositionIndex.get(key) || [];
            entries.forEach((entry: AnyRecord) => {
                if (remainingQty <= 0 || entry.remaining <= 0) return;
                const matchQty = Math.min(entry.remaining, remainingQty);

                // Add closing leg to the pending trade
                const legClone: AnyRecord = { ...closingLeg, quantity: matchQty };
                if (batchId) legClone.importBatchId = batchId;
                entry.trade.legs.push(this.sanitizeImportedLeg(legClone));

                entry.remaining -= matchQty;
                remainingQty -= matchQty;
                stats.matchedClosingLegs += matchQty;
            });

            // Clean up fully consumed entries
            const filtered = entries.filter((entry: AnyRecord) => entry.remaining > 0);
            if (filtered.length > 0) {
                newPositionIndex.set(key, filtered);
            } else {
                newPositionIndex.delete(key);
            }
        }

        // Any remaining unmatched quantity goes to review
        if (remainingQty > 0) {
            const remainder: AnyRecord = { ...closingLeg, quantity: remainingQty };
            if (batchId) remainder.importBatchId = batchId;
            unmatchedClosingLegs.push(remainder);
            stats.unmatchedClosingLegs += remainingQty;
        }
    });

    // Finalize pending trades - update status based on whether they're fully closed
    pendingTrades.forEach(({ trade, consolidatedLegs, ticker }: AnyRecord) => {
        // Calculate net open contracts
        const openQty = consolidatedLegs.reduce((sum: number, leg: AnyRecord) => sum + Math.abs(Number(leg.quantity) || 0), 0);
        const closeQty = trade.legs.filter((leg: AnyRecord) => this.getLegSide(leg) === 'CLOSE')
            .reduce((sum: number, leg: AnyRecord) => sum + Math.abs(Number(leg.quantity) || 0), 0);

        // Update status if all positions are closed
        if (closeQty >= openQty && trade.status !== 'Assigned') {
            trade.status = 'Closed';
        }

        if (trade.importReview) {
            reviewTradeIds.push(trade.id);
            stats.reviewTradesCreated += 1;
        }

        newTrades.push(trade);
        stats.tradesCreated += 1;
        stats.legsAddedToNewTrades += trade.legs.length;
    });

    // --- Post-import merge passes ---

    // Pass 1: Absorb unmatched OASGN closing legs into stock assignment
    // trades for the same ticker so assignment data stays unified.
    {
        const absorbed: AnyRecord[] = [];
        const remaining: AnyRecord[] = [];
        unmatchedClosingLegs.forEach((leg: AnyRecord) => {
            if (!leg.isAssignment) {
                remaining.push(leg);
                return;
            }
            const ticker = (leg.tickerSymbol || '').toUpperCase();
            const target = newTrades.find((t: AnyRecord) => {
                if ((t.ticker || '').toUpperCase() !== ticker) return false;
                return (t.legs || []).some(
                    (tl: AnyRecord) => tl.isAssignment && (tl.type || '').toUpperCase() === 'STOCK'
                );
            });
            if (target) {
                target.legs.push(this.sanitizeImportedLeg(leg));
                absorbed.push(leg);
            } else {
                remaining.push(leg);
            }
        });
        if (absorbed.length) {
            const absorbedQty = absorbed.reduce(
                (s: number, l: AnyRecord) => s + Math.abs(Number(l.quantity) || 0), 0
            );
            stats.matchedClosingLegs += absorbedQty;
            stats.unmatchedClosingLegs = Math.max(0, stats.unmatchedClosingLegs - absorbedQty);
            unmatchedClosingLegs.length = 0;
            unmatchedClosingLegs.push(...remaining);
        }
    }

    // Pass 2: Roll detection — unmatched BTC legs that share the same
    // ticker, execution date, and option type as an STO opening leg in
    // a newly created trade are almost certainly roll transactions.
    // Merge them into the new trade so the position shows as "Rolling".
    {
        const remaining: AnyRecord[] = [];
        unmatchedClosingLegs.forEach((leg: AnyRecord) => {
            const ticker = (leg.tickerSymbol || '').toUpperCase();
            const legDate = leg.executionDate || '';
            const legType = (leg.type || '').toUpperCase();
            if (!legDate || !legType || legType === 'STOCK') {
                remaining.push(leg);
                return;
            }
            const target = newTrades.find((t: AnyRecord) => {
                if ((t.ticker || '').toUpperCase() !== ticker) return false;
                return (t.legs || []).some((tl: AnyRecord) => {
                    const tlType = (tl.type || '').toUpperCase();
                    const tlDate = tl.executionDate || '';
                    return this.getLegSide(tl) === 'OPEN'
                        && tlType === legType
                        && tlDate === legDate;
                });
            });
            if (target) {
                target.legs.push(this.sanitizeImportedLeg(leg));
                if (target.status === 'Open') {
                    target.status = 'Rolling';
                }
                const qty = Math.abs(Number(leg.quantity) || 0);
                stats.matchedClosingLegs += qty;
                stats.unmatchedClosingLegs = Math.max(0, stats.unmatchedClosingLegs - qty);
            } else {
                remaining.push(leg);
            }
        });
        unmatchedClosingLegs.length = 0;
        unmatchedClosingLegs.push(...remaining);
    }

    // Pass 3: Merge stock assignment trades with other same-ticker trades
    // created in this import (e.g. covered calls written on assigned stock).
    {
        const tickerGroups = new Map<string, Array<{ trade: AnyRecord; idx: number }>>();
        newTrades.forEach((trade: AnyRecord, idx: number) => {
            const tk = (trade.ticker || '').toUpperCase();
            if (!tickerGroups.has(tk)) tickerGroups.set(tk, []);
            tickerGroups.get(tk)!.push({ trade, idx });
        });

        const toRemove = new Set<number>();
        tickerGroups.forEach((entries: Array<{ trade: AnyRecord; idx: number }>) => {
            if (entries.length < 2) return;

            // Find the anchor: stock assignment trade
            const anchor = entries.find(({ trade }: { trade: AnyRecord }) =>
                (trade.legs || []).some(
                    (l: AnyRecord) => l.isAssignment && (l.type || '').toUpperCase() === 'STOCK'
                )
            );
            if (!anchor) return;

            entries.forEach(({ trade, idx }: { trade: AnyRecord; idx: number }) => {
                if (trade === anchor.trade) return;
                if (trade.importReview) return;
                // Absorb legs into anchor trade
                (trade.legs || []).forEach((leg: AnyRecord) => anchor.trade.legs.push(leg));
                toRemove.add(idx);
            });

            // Re-infer strategy on the merged trade
            const inferred = this.inferStrategyFromLegs(anchor.trade.legs);
            anchor.trade.strategy = (inferred === 'Imported Trade' || inferred === 'Short Call')
                ? 'Wheel'
                : inferred;
        });

        // Remove absorbed trades in reverse index order
        [...toRemove].sort((a: number, b: number) => b - a).forEach((i: number) => newTrades.splice(i, 1));
    }

    // Handle unmatched closing legs - create one review trade per ticker
    if (unmatchedClosingLegs.length > 0) {
        const byTicker = new Map<string, AnyRecord[]>();
        unmatchedClosingLegs.forEach((leg: AnyRecord) => {
            const tk = (leg.tickerSymbol || '').toUpperCase() || 'UNKNOWN';
            if (!byTicker.has(tk)) {
                byTicker.set(tk, []);
            }
            byTicker.get(tk)!.push(leg);
        });

        byTicker.forEach((legs: AnyRecord[], tk: string) => {
            const note = this.composeImportNotes(context, {
                legCount: legs.length,
                note: 'Review required: closing legs have no matching open position.'
            });

            const sanitizedLegs = legs.map((leg: AnyRecord) => this.sanitizeImportedLeg(leg));
            const reviewId = `IMP-REVIEW-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

            newTrades.push({
                id: reviewId,
                ticker: tk,
                strategy: 'Import Review',
                status: 'Closed',
                exitReason: '',
                notes: note,
                legs: sanitizedLegs,
                importBatchId: batchId,
                importReview: true
            });

            reviewTradeIds.push(reviewId);
            stats.reviewTradesCreated += 1;
            stats.legsAddedToNewTrades += sanitizedLegs.length;
        });
    }

    stats.totalTradesCreated = newTrades.length;
    stats.tradesUpdated = updates.size;
    stats.reviewLegs = newTrades
        .filter((trade: AnyRecord) => trade.importReview)
        .reduce((acc: number, trade: AnyRecord) => acc + ((trade.legs || []).length), 0);

    return { newTrades, updates, stats, batchId, reviewTradeIds };
}

export function buildLegFromRobinhoodTransaction(this: any, transaction: AnyRecord) {
    if (!transaction) {
        return null;
    }

    const quantity = Math.abs(Number(transaction.quantity) || 0);
    if (!quantity) {
        return null;
    }

    const type = transaction.optionType || (transaction.category === 'STOCK' ? 'STOCK' : 'UNKNOWN');

    const leg: Record<string, unknown> = {
        id: transaction.externalId ? `EXT-${transaction.externalId}` : `LEG-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
        orderType: this.normalizeLegOrderType(transaction.orderType),
        type,
        quantity,
        multiplier: transaction.multiplier || (type === 'STOCK' ? 1 : 100),
        executionDate: transaction.tradeDate || '',
        expirationDate: transaction.expiration || '',
        strike: Number.isFinite(Number(transaction.strike)) ? Number(transaction.strike) : null,
        premium: Number.isFinite(Number(transaction.price)) ? Number(transaction.price) : 0,
        fees: Number.isFinite(Number(transaction.fees)) ? Number(transaction.fees) : 0,
        underlyingPrice: null,
        externalId: transaction.externalId || null,
        importGroupId: transaction.groupKey || null,
        importSource: 'Robinhood',
        tickerSymbol: (transaction.underlying || transaction.ticker || '').toUpperCase()
    };

    // Preserve assignment flag for status determination
    if (transaction.isAssignment) {
        leg.isAssignment = true;
    }

    // Preserve memo if present
    if (transaction.memo) {
        leg.notes = transaction.memo;
    }

    return leg;
}

export function applyRobinhoodImportResult(this: any, importResult: AnyRecord, context: AnyRecord = {}) {
    if (!importResult) {
        return;
    }

    const stats = (importResult.stats as Record<string, unknown>) || {};
    const batchId = importResult.batchId || context.batchId || null;
    const reviewTradeIds = Array.isArray(importResult.reviewTradeIds)
        ? importResult.reviewTradeIds.slice() as string[]
        : [];

    let created = 0;
    let updated = 0;

    if (importResult.updates instanceof Map) {
        importResult.updates.forEach((legs: AnyRecord[], tradeId: string) => {
            if (!Array.isArray(legs) || legs.length === 0) {
                return;
            }

            const index = this.trades.findIndex((trade: AnyRecord) => trade.id === tradeId);
            if (index === -1) {
                return;
            }

            const existing = this.trades[index];
            const mergedLegs = [...existing.legs, ...legs.map((leg: AnyRecord) => ({ ...leg }))];
            const note = this.composeImportNotes(context, {
                legCount: legs.length,
                note: 'Existing trade updated from Robinhood CSV import.'
            });

            const updatedTrade = this.enrichTradeData({
                ...existing,
                legs: mergedLegs,
                notes: existing.notes ? `${existing.notes}\n${note}` : note
            });

            this.trades[index] = updatedTrade;
            updated += 1;
        });
    }

    if (Array.isArray(importResult.newTrades)) {
        importResult.newTrades.forEach((tradeData: AnyRecord) => {
            if (!tradeData || !Array.isArray(tradeData.legs) || tradeData.legs.length === 0) {
                return;
            }
            if (tradeData.importReview && !reviewTradeIds.includes(tradeData.id)) {
                reviewTradeIds.push(tradeData.id);
            }
            const enriched = this.enrichTradeData(tradeData);
            this.trades.push(enriched);
            created += 1;
        });
    }

    const fileName = context?.fileName || 'Robinhood CSV file';

    stats.totalTradesCreated = stats.totalTradesCreated ?? created;
    stats.tradesUpdated = updated;
    stats.reviewTradesCreated = stats.reviewTradesCreated ?? reviewTradeIds.length;

    if (created || updated) {
        this.saveToStorage();
        this.markUnsavedChanges();
        this.updateDashboard();

        const segments: string[] = [];
        if (created) {
            segments.push(`${created} new trade${created === 1 ? '' : 's'}`);
        }
        if (updated) {
            segments.push(`${updated} trade${updated === 1 ? '' : 's'} updated`);
        }

        const summary = segments.join(', ');
        this.showNotification(`Robinhood import complete: ${summary}.`, 'success');
        this.appendImportLog({
            type: 'success',
            message: `Imported from ${fileName}: ${summary}.`,
            timestamp: new Date()
        });
    } else {
        this.showNotification('No new trades or updates found in the Robinhood CSV file.', 'info');
        this.appendImportLog({
            type: 'info',
            message: `No new data in ${fileName}. All transactions may already exist.`,
            timestamp: new Date()
        });
    }

    this.renderImportSummary({
        fileName,
        batchId,
        stats,
        reviewTradeIds,
        created,
        updated
    });
}
