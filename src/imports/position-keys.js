// src/imports/position-keys.js — Wave 7: Position key building for trade matching.
// Uses the .call(this, …) delegation pattern.

export function buildPositionKey(ticker, leg, options = {}) {
    if (!leg) {
        return '';
    }
    const symbol = (ticker || '').toString().trim().toUpperCase();
    if (!symbol) {
        return '';
    }

    const type = (leg.type || '').toString().trim().toUpperCase();
    if (!type) {
        return '';
    }

    // Determine position direction based on the underlying position, not the action
    // For closing legs, we need to match the position they're closing
    const side = this.getLegSide(leg);
    const action = this.getLegAction(leg);
    
    let direction;
    if (options.forMatching && side === 'CLOSE') {
        // For closing legs when matching, invert the direction to find the position
        // BTC (Buy to Close) closes a short position -> look for 'short'
        // STC (Sell to Close) closes a long position -> look for 'long'
        direction = action === 'BUY' ? 'short' : 'long';
    } else {
        // For opening legs or general use, direction follows the action
        direction = action === 'SELL' ? 'short' : 'long';
    }

    if (type === 'STOCK') {
        return [symbol, type, direction].join('|');
    }

    const strike = Number.isFinite(Number(leg.strike)) ? Number(leg.strike) : 0;
    const expiration = (leg.expirationDate || '').toString().trim();

    return [symbol, type, strike || 0, expiration || '', direction].join('|');
}

export function buildLegFromTransaction(transaction) {
    if (!transaction) {
        return null;
    }

    const quantity = Math.abs(Number(transaction.quantity) || 0);
    if (!quantity) {
        return null;
    }

    const type = transaction.optionType || (transaction.category === 'STOCK' ? 'STOCK' : 'UNKNOWN');

    return {
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
        importSource: 'OFX',
        tickerSymbol: (transaction.underlying || transaction.ticker || '').toUpperCase()
    };
}

export function consolidateImportLegs(legs = []) {
    if (!Array.isArray(legs) || legs.length <= 1) {
        return legs;
    }

    // Group by unique leg signature (same orderType, type, strike, expiration, executionDate)
    const groups = new Map();
    legs.forEach((leg) => {
        const key = [
            leg.orderType || '',
            leg.type || '',
            leg.strike ?? '',
            leg.expirationDate || '',
            leg.executionDate || ''
        ].join('|');

        if (!groups.has(key)) {
            groups.set(key, []);
        }
        groups.get(key).push(leg);
    });

    // Consolidate each group
    const result = [];
    groups.forEach((groupLegs) => {
        if (groupLegs.length === 1) {
            result.push(groupLegs[0]);
            return;
        }

        // Aggregate quantities, premiums, and fees
        let totalQty = 0;
        let weightedPremiumSum = 0;
        let totalFees = 0;
        const externalIds = [];

        groupLegs.forEach((leg) => {
            const qty = Math.abs(Number(leg.quantity) || 0);
            const premium = Number(leg.premium) || 0;
            const fees = Number(leg.fees) || 0;

            totalQty += qty;
            weightedPremiumSum += premium * qty;
            totalFees += fees;

            if (leg.externalId) {
                externalIds.push(leg.externalId);
            }
        });

        // Create consolidated leg (use first leg as template)
        const consolidated = { ...groupLegs[0] };
        consolidated.quantity = totalQty;
        consolidated.premium = totalQty > 0 ? weightedPremiumSum / totalQty : 0;
        consolidated.fees = totalFees;

        // Generate a new ID that references all originals
        if (externalIds.length > 1) {
            consolidated.id = `CONS-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
            consolidated.consolidatedFrom = externalIds;
        }

        // Preserve assignment flag if any source leg is an assignment
        if (!consolidated.isAssignment && groupLegs.some((leg) => leg.isAssignment)) {
            consolidated.isAssignment = true;
        }

        result.push(consolidated);
    });

    return result;
}

export function parseOptionContractSymbol(symbol = '') {
    const compact = (symbol || '').toString().replace(/\s+/g, '').toUpperCase();
    const match = compact.match(/^([A-Z]{1,6})(\d{6})([CP])(\d{8})/);
    if (!match) {
        return null;
    }

    const underlying = match[1];
    const dateDigits = match[2];
    const typeChar = match[3];
    const strikeDigits = match[4];

    const expirationDate = this.parseOfxDate(dateDigits);
    const strike = Number(parseInt(strikeDigits, 10) / 1000);

    return {
        underlying,
        expiration: expirationDate ? expirationDate.toISOString().slice(0, 10) : '',
        type: typeChar === 'P' ? 'PUT' : 'CALL',
        strike,
        multiplier: 100
    };
}

export function sanitizeExternalLegId(value) {
    if (!value) {
        return '';
    }
    return value.toString().replace(/[^A-Za-z0-9]/g, '');
}

export function groupTransactionsForImport(transactions = []) {
    const groups = new Map();
    transactions.forEach((tx) => {
        if (!tx || !tx.groupKey) {
            return;
        }
        let group = groups.get(tx.groupKey);
        if (!group) {
            group = {
                key: tx.groupKey,
                ticker: (tx.underlying || tx.ticker || '').toUpperCase(),
                transactions: []
            };
            groups.set(tx.groupKey, group);
        }
        if (!group.ticker && (tx.underlying || tx.ticker)) {
            group.ticker = (tx.underlying || tx.ticker || '').toUpperCase();
        }
        group.transactions.push(tx);
    });
    return groups;
}

export function sanitizeImportedLeg(leg) {
    if (!leg) {
        return null;
    }
    const clone = { ...leg };
    delete clone.tickerSymbol;
    return clone;
}

export function buildPositionIndex(trades = []) {
    const index = new Map();

    trades.forEach((trade) => {
        if (!trade || !Array.isArray(trade.legs) || trade.legs.length === 0) {
            return;
        }

        const ticker = (trade.ticker || '').toUpperCase();
        if (!ticker) {
            return;
        }

        const aggregates = new Map();
        trade.legs.forEach((leg) => {
            if (!leg) {
                return;
            }
            const key = this.buildPositionKey(ticker, leg);
            if (!key) {
                return;
            }

            const quantity = Math.abs(Number(leg.quantity) || 0);
            if (!quantity) {
                return;
            }

            const side = this.getLegSide(leg);
            let direction = 0;
            if (side === 'OPEN') {
                direction = 1;
            } else if (side === 'CLOSE') {
                direction = -1;
            }

            if (!direction) {
                return;
            }

            const current = aggregates.get(key) || 0;
            aggregates.set(key, current + direction * quantity);
        });

        aggregates.forEach((net, key) => {
            if (net > 0) {
                const bucket = index.get(key) || [];
                bucket.push({ trade, remaining: net });
                index.set(key, bucket);
            }
        });
    });

    return index;
}

export function consumePositionMatches(index, key, leg) {
    const result = { matched: [], unmatched: Math.abs(Number(leg?.quantity) || 0) };
    if (!key || !index.has(key) || !leg) {
        return result;
    }

    let remaining = result.unmatched;
    const entries = index.get(key) || [];

    entries.forEach((entry) => {
        if (remaining <= 0 || entry.remaining <= 0) {
            return;
        }
        const quantity = Math.min(entry.remaining, remaining);
        result.matched.push({ trade: entry.trade, quantity });
        entry.remaining -= quantity;
        remaining -= quantity;
    });

    result.unmatched = remaining;

    const filtered = entries.filter((entry) => entry.remaining > 0);
    if (filtered.length > 0) {
        index.set(key, filtered);
    } else {
        index.delete(key);
    }

    return result;
}

export function buildExistingExternalIdSet() {
    const ids = new Set();
    this.trades.forEach((trade) => {
        if (!trade || !Array.isArray(trade.legs)) {
            return;
        }
        trade.legs.forEach((leg) => {
            if (leg?.externalId) {
                ids.add(leg.externalId);
            }
        });
    });
    return ids;
}

export function tradeContainsExternalId(trade, externalId) {
    if (!externalId || !trade || !Array.isArray(trade.legs)) {
        return false;
    }
    return trade.legs.some((leg) => leg?.externalId && leg.externalId === externalId);
}

export function inferStrategyFromLegs(legs = []) {
    if (!Array.isArray(legs) || legs.length === 0) {
        return 'Imported Trade';
    }

    // Check if any leg is a stock assignment (from put assignment)
    const hasAssignment = legs.some((leg) => leg.isAssignment === true);

    const openLegs = legs.filter((leg) => this.getLegSide(leg) === 'OPEN');
    // Exclude CASH settlement legs from strategy inference — they record the
    // settlement payment, not an independent position type.
    const filterForStrategy = (legList) => legList.filter((leg) => this.normalizeLegType(leg?.type) !== 'CASH');
    const relevant = filterForStrategy(openLegs.length ? openLegs : legs);

    // Check for Wheel: stock leg (usually from assignment) + option legs (covered calls)
    const stockLegs = relevant.filter((leg) => (leg.type || '').toUpperCase() === 'STOCK');
    const callLegs = relevant.filter((leg) => (leg.type || '').toUpperCase() === 'CALL');
    const putLegs = relevant.filter((leg) => (leg.type || '').toUpperCase() === 'PUT');
    
    // Wheel: stock + covered calls (STO CALL), or stock from assignment
    if (stockLegs.length > 0) {
        const hasShortCalls = callLegs.some((leg) => this.getLegAction(leg) === 'SELL');
        if (hasAssignment || hasShortCalls) {
            return 'Wheel';
        }
    }

    if (relevant.length === 1) {
        const leg = relevant[0];
        if (!leg) {
            return 'Imported Trade';
        }
        if (leg.type === 'PUT') {
            return this.getLegAction(leg) === 'SELL' ? 'Cash-Secured Put' : 'Long Put';
        }
        if (leg.type === 'CALL') {
            return this.getLegAction(leg) === 'SELL' ? 'Short Call' : 'Long Call';
        }
        if (leg.type === 'STOCK') {
            // If this is a stock assignment, identify as Wheel trade
            if (hasAssignment || leg.isAssignment) {
                return 'Wheel';
            }
            return this.getLegAction(leg) === 'SELL' ? 'Stock Sale' : 'Stock Purchase';
        }
    }

    const optionLegs = relevant.filter((leg) => leg.type === 'PUT' || leg.type === 'CALL');
    if (optionLegs.length === 2) {
        const [first, second] = optionLegs;
        if (first && second && first.type === second.type) {
            const shortLeg = optionLegs.find((leg) => this.getLegAction(leg) === 'SELL');
            if (shortLeg) {
                const longLeg = optionLegs.find((leg) => leg !== shortLeg);
                if (longLeg) {
                    const shortStrike = Number(shortLeg.strike) || 0;
                    const longStrike = Number(longLeg.strike) || 0;
                    if (shortLeg.type === 'PUT') {
                        return shortStrike > longStrike ? 'Bull Put Spread' : 'Bear Put Spread';
                    }
                    return shortStrike < longStrike ? 'Bear Call Spread' : 'Bull Call Spread';
                }
            }
        }
    }

    return 'Imported Multi-Leg';
}

export function composeImportNotes(context = {}, options = {}) {
const fileName = context.fileName || 'OFX file';
const timestamp = new Date();
const dateLabel = timestamp.toLocaleDateString('en-US', { dateStyle: 'medium' });
const timeLabel = timestamp.toLocaleTimeString('en-US', { timeStyle: 'short' });
const parts = [`Imported from ${fileName} on ${dateLabel} at ${timeLabel}.`];

    if (options.legCount) {
        parts.push(`${options.legCount} leg${options.legCount === 1 ? '' : 's'} detected.`);
    }

    if (options.hasClosings) {
        parts.push('Includes adjustments to existing positions.');
    }

    if (options.note) {
        parts.push(options.note);
    }

    return parts.join(' ');
}
