// src/imports/ofx.js — Wave 7: OFX/brokerage statement import parser.
// Uses the .call(this, …) delegation pattern.

type AnyRecord = Record<string, any>

export function parseOfx(this: any, raw: string) {
    if (typeof raw !== 'string') {
        throw new Error('OFX payload is invalid.');
    }

    const startIndex = raw.indexOf('<OFX');
    if (startIndex === -1) {
        throw new Error('Invalid OFX file: missing OFX root.');
    }

    const xmlContent = raw.slice(startIndex).trim();
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlContent, 'application/xml');
    const parserError = doc.querySelector('parsererror');
    if (parserError) {
        throw new Error('Unable to parse OFX document.');
    }

    const securities = this.extractOfxSecurities(doc);
    const transactions = this.extractOfxTransactions(doc, securities);

    return {
        securities,
        transactions
    };
}

export function extractOfxSecurities(this: any, doc: Document) {
    const map = new Map<string, AnyRecord>();
    const secList = doc.getElementsByTagName('SECLIST')[0];
    if (!secList) {
        return map;
    }

    const getText = (root: Element | null, tag: string) => {
        if (!root) {
            return '';
        }
        const node = root.getElementsByTagName(tag)[0];
        return node ? node.textContent.trim() : '';
    };

    Array.from(secList.children).forEach((node) => {
        if (!(node instanceof Element)) {
            return;
        }
        const tagName = node.tagName;
        const secInfo = node.getElementsByTagName('SECINFO')[0];
        if (!secInfo) {
            return;
        }

        const uniqueId = getText(secInfo, 'UNIQUEID');
        if (!uniqueId) {
            return;
        }

        const ticker = getText(secInfo, 'TICKER');
        const name = getText(secInfo, 'SECNAME');
        const info: AnyRecord = {
            id: uniqueId,
            tag: tagName,
            ticker,
            name,
            option: null
        };

        if (tagName === 'OPTINFO') {
            const strikeRaw = getText(node, 'STRIKEPRICE');
            const multiplierRaw = getText(node, 'SHPERCTRCT');
            const expireRaw = getText(node, 'DTEXPIRE');
            const optTypeRaw = getText(node, 'OPTTYPE');

            const parsedSymbol = this.parseOptionContractSymbol(ticker || name);
            const expirationDate = this.parseOfxDate(expireRaw);

            info.option = {
                underlying: parsedSymbol?.underlying || (ticker ? ticker.split(' ')[0].trim() : ''),
                type: (optTypeRaw || parsedSymbol?.type || '').toUpperCase(),
                strike: strikeRaw ? Number(strikeRaw) : parsedSymbol?.strike ?? null,
                expiration: expirationDate ? expirationDate.toISOString().slice(0, 10) : parsedSymbol?.expiration || '',
                multiplier: multiplierRaw ? Number(multiplierRaw) : parsedSymbol?.multiplier ?? 100
            };
        }

        map.set(uniqueId, info);
    });

    return map;
}

export function parseOfxDate(this: any, value: unknown) {
    if (!value) {
        return null;
    }

    const digits = value.toString().replace(/[^0-9]/g, '');
    if (!digits) {
        return null;
    }

    if (digits.length === 6) {
        const yearTwo = Number(digits.slice(0, 2));
        if (!Number.isFinite(yearTwo)) {
            return null;
        }
        const year = yearTwo >= 70 ? 1900 + yearTwo : 2000 + yearTwo;
        const month = Number(digits.slice(2, 4)) - 1;
        const day = Number(digits.slice(4, 6));
        const date = new Date(Date.UTC(year, month, day));
        return Number.isNaN(date.getTime()) ? null : date;
    }

    if (digits.length >= 8) {
        const year = Number(digits.slice(0, 4));
        const month = Number(digits.slice(4, 6)) - 1;
        const day = Number(digits.slice(6, 8));
        const hours = digits.length >= 10 ? Number(digits.slice(8, 10)) : 0;
        const minutes = digits.length >= 12 ? Number(digits.slice(10, 12)) : 0;
        const seconds = digits.length >= 14 ? Number(digits.slice(12, 14)) : 0;
        const date = new Date(Date.UTC(year, month, day, hours, minutes, seconds));
        return Number.isNaN(date.getTime()) ? null : date;
    }

    return null;
}

export function mapOfxOrderType(this: any, tag: string, rawType: unknown, units = 0) {
    const normalized = (rawType || '').toString().trim().toUpperCase();
    switch (tag) {
        case 'BUYOPT':
            return normalized === 'BUYTOCLOSE' ? 'BTC' : 'BTO';
        case 'SELLOPT':
            return normalized === 'SELLTOCLOSE' ? 'STC' : 'STO';
        case 'BUYSTOCK':
            return normalized === 'BUYTOCOVER' ? 'BTC' : 'BTO';
        case 'SELLSTOCK':
            if (normalized === 'SELLSHORT') {
                return 'STO';
            }
            if (normalized === 'SELLTOCLOSE') {
                return 'STC';
            }
            return units < 0 ? 'STO' : 'STC';
        default:
            return 'BTO';
    }
}

export function extractOfxTransactions(this: any, doc: Document, securities: Map<string, AnyRecord>) {
    const transactions: AnyRecord[] = [];
    const invTranList = doc.getElementsByTagName('INVTRANLIST')[0];
    if (!invTranList) {
        return transactions;
    }

    const getText = (root: Element | null, tag: string) => {
        if (!root) {
            return '';
        }
        const node = root.getElementsByTagName(tag)[0];
        return node ? node.textContent.trim() : '';
    };

    Array.from(invTranList.children).forEach((node) => {
        if (!(node instanceof Element)) {
            return;
        }

        const tag = node.tagName;
        if (!['BUYOPT', 'SELLOPT', 'BUYSTOCK', 'SELLSTOCK'].includes(tag)) {
            return;
        }

        const detailNode = tag === 'BUYOPT' || tag === 'BUYSTOCK'
            ? node.getElementsByTagName('INVBUY')[0]
            : node.getElementsByTagName('INVSELL')[0];
        if (!detailNode) {
            return;
        }

        const invTran = detailNode.getElementsByTagName('INVTRAN')[0];
        const externalIdRaw = getText(invTran, 'FITID') || getText(node, 'FITID');
        const sanitizedExternalId = this.sanitizeExternalLegId(externalIdRaw);
        if (!sanitizedExternalId) {
            return;
        }

        const dtTradeRaw = getText(invTran, 'DTTRADE') || getText(node, 'DTTRADE');
        const tradeDate = this.parseOfxDate(dtTradeRaw);
        const tradeDateIso = tradeDate ? tradeDate.toISOString().slice(0, 10) : '';
        const digitKey = (dtTradeRaw || '').replace(/[^0-9]/g, '');
        const timeKey = digitKey.length >= 14 ? digitKey.slice(0, 14) : digitKey.slice(0, 8) || tradeDateIso.replace(/-/g, '');

        const securityId = getText(detailNode, 'UNIQUEID');
        const security = securityId ? securities.get(securityId) : null;

        const units = Number(getText(detailNode, 'UNITS') || '0');
        const unitPrice = Number(getText(detailNode, 'UNITPRICE') || '0');
        const total = Number(getText(detailNode, 'TOTAL') || '0');
        const commissionRaw = Number(getText(detailNode, 'COMMISSION') || '0');

        const rawOrderType = tag === 'BUYOPT'
            ? getText(node, 'OPTBUYTYPE')
            : tag === 'SELLOPT'
                ? getText(node, 'OPTSELLTYPE')
                : tag === 'BUYSTOCK'
                    ? getText(node, 'BUYTYPE')
                    : getText(node, 'SELLTYPE');

        const orderType = this.mapOfxOrderType(tag, rawOrderType, units);
        const actionSide = this.mapOrderTypeToActionSide(orderType);

        const isOption = tag.includes('OPT');
        let underlying = '';
        let optionType = '';
        let strike: number | null = null;
        let expiration = '';
        let multiplier = isOption ? 100 : 1;
        let ticker = '';

        if (security && security.option) {
            underlying = (security.option.underlying || '').toUpperCase();
            optionType = security.option.type || '';
            strike = Number.isFinite(Number(security.option.strike)) ? Number(security.option.strike) : null;
            expiration = security.option.expiration || '';
            multiplier = security.option.multiplier || multiplier;
            ticker = underlying;
        } else if (security) {
            const inferredTicker = (security.ticker || security.name || '').split(' ')[0].trim();
            ticker = inferredTicker.toUpperCase();
            if (isOption) {
                const parsed = this.parseOptionContractSymbol(security.ticker || security.name || '');
                if (parsed) {
                    underlying = parsed.underlying.toUpperCase();
                    optionType = parsed.type;
                    strike = parsed.strike;
                    expiration = parsed.expiration;
                    multiplier = parsed.multiplier || multiplier;
                    ticker = underlying;
                }
            } else {
                underlying = ticker;
            }
        }

        if (!ticker) {
            ticker = (underlying || '').toUpperCase();
        }

        const underlyingSymbol = (underlying || ticker || '').toUpperCase();
        const categoryLabel = isOption ? 'OPTION' : 'STOCK';
        const baseKeyParts = [
            timeKey || tradeDateIso.replace(/-/g, ''),
            underlyingSymbol,
            actionSide.side,
            categoryLabel
        ];
        if (isOption) {
            baseKeyParts.push(expiration || '');
        }
        const groupKey = baseKeyParts.filter(Boolean).join('|') || sanitizedExternalId;

        transactions.push({
            externalId: sanitizedExternalId,
            groupKey,
            tag,
            orderType,
            tradeDate: tradeDateIso,
            tradeTimeKey: timeKey,
            ticker,
            underlying: (underlying || ticker || '').toUpperCase(),
            optionType: optionType || (isOption ? (rawOrderType && rawOrderType.includes('CALL') ? 'CALL' : 'PUT') : ''),
            strike,
            expiration,
            multiplier: multiplier || (isOption ? 100 : 1),
            quantity: Math.abs(units),
            price: Math.abs(unitPrice),
            total,
            fees: Math.abs(commissionRaw),
            category: isOption ? 'OPTION' : 'STOCK',
            securityId,
            memo: getText(invTran, 'MEMO') || '',
            currency: getText(detailNode, 'CURSYM') || getText(node, 'CURSYM') || 'USD'
        });
    });

    return transactions;
}

export function buildOfxImportPayload(this: any, parsed: AnyRecord, context: AnyRecord = {}) {
    const transactions: AnyRecord[] = Array.isArray(parsed?.transactions) ? parsed.transactions : [];
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

    const groups = this.groupTransactionsForImport(transactions);
    const positionIndex = this.buildPositionIndex(this.trades);
const existingExternalIds = this.buildExistingExternalIdSet();
const seenExternalIds = new Set<string>();

    stats.totalGroups = groups.size;

    groups.forEach((group: AnyRecord) => {
        if (!group || !Array.isArray(group.transactions) || group.transactions.length === 0) {
            return;
        }

        const legs: AnyRecord[] = [];
        group.transactions.forEach((tx: AnyRecord) => {
            const leg = this.buildLegFromTransaction(tx);
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
            legs.push(leg);
        });

        if (!legs.length) {
            return;
        }

        const ticker = (group.ticker || legs[0]?.tickerSymbol || '').toUpperCase();
        const openingLegs = legs.filter((leg: AnyRecord) => this.getLegSide(leg) === 'OPEN');
        const closingLegs = legs.filter((leg: AnyRecord) => this.getLegSide(leg) === 'CLOSE');
        const unmatchedClosingLegs: AnyRecord[] = [];

        stats.openingLegs += openingLegs.length;
        stats.closingLegs += closingLegs.length;

        closingLegs.forEach((leg: AnyRecord) => {
            const key = this.buildPositionKey(ticker, leg, { forMatching: true });
            const match = this.consumePositionMatches(positionIndex, key, leg);

            if (match.matched.length) {
                match.matched.forEach((entry: AnyRecord) => {
                    const targetTrade = entry.trade;
                    if (this.tradeContainsExternalId(targetTrade, leg.externalId)) {
                        return;
                    }
                    if (leg.externalId && (existingExternalIds.has(leg.externalId) || seenExternalIds.has(leg.externalId))) {
                        return;
                    }

                    const bucket = updates.get(targetTrade.id) || [];
                    const legClone: AnyRecord = { ...leg, quantity: entry.quantity };
                    if (batchId) {
                        legClone.importBatchId = batchId;
                    }
                    bucket.push(this.sanitizeImportedLeg(legClone));
                    updates.set(targetTrade.id, bucket);
                    stats.legsAddedToUpdates += 1;
                    stats.matchedClosingLegs += entry.quantity;
                });
            }

            const unmatchedQty = Math.max(0, match.unmatched);
            if (!match.matched.length || unmatchedQty > 0) {
                const remainder = { ...leg };
                if (unmatchedQty > 0 && remainder.quantity !== unmatchedQty) {
                    remainder.quantity = unmatchedQty;
                }
                if (match.matched.length && remainder.externalId) {
                    remainder.externalId = `${remainder.externalId}-UNMATCHED`;
                }
                if (batchId) {
                    remainder.importBatchId = batchId;
                }
                unmatchedClosingLegs.push(remainder);
                stats.unmatchedClosingLegs += remainder.quantity || 0;
            }

            if (leg.externalId) {
                seenExternalIds.add(leg.externalId);
            }
        });

        if (openingLegs.length > 0) {
            const note = this.composeImportNotes(context, {
                legCount: openingLegs.length,
                hasClosings: closingLegs.length > 0
            });

            const sanitizedLegs = openingLegs.map((leg: AnyRecord) => {
                if (leg.externalId) {
                    seenExternalIds.add(leg.externalId);
                }
                return this.sanitizeImportedLeg(leg);
            });

            const resolvedTicker = (ticker || (openingLegs[0]?.tickerSymbol || '')).toUpperCase() || 'UNKNOWN';
            const tradeId = `IMP-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

            newTrades.push({
                id: tradeId,
                ticker: resolvedTicker,
                strategy: this.inferStrategyFromLegs(openingLegs),
                exitReason: '',
                notes: note,
                legs: sanitizedLegs,
                importBatchId: batchId,
                importReview: false
            });

            stats.tradesCreated += 1;
            stats.legsAddedToNewTrades += sanitizedLegs.length;
        }

        if (unmatchedClosingLegs.length > 0) {
            const note = this.composeImportNotes(context, {
                legCount: unmatchedClosingLegs.length,
                note: 'Review required: closing legs have no matching open position.'
            });

            const sanitizedLegs = unmatchedClosingLegs.map((leg: AnyRecord) => {
                if (leg.externalId) {
                    seenExternalIds.add(leg.externalId);
                }
                return this.sanitizeImportedLeg(leg);
            });

            const resolvedTicker = (ticker || (unmatchedClosingLegs[0]?.tickerSymbol || '')).toUpperCase() || 'UNKNOWN';
            const reviewId = `IMP-REVIEW-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

            newTrades.push({
                id: reviewId,
                ticker: resolvedTicker,
                strategy: 'Import Review',
                exitReason: '',
                notes: note,
                legs: sanitizedLegs,
                importBatchId: batchId,
                importReview: true
            });

            reviewTradeIds.push(reviewId);
            stats.reviewTradesCreated += 1;
            stats.legsAddedToNewTrades += sanitizedLegs.length;
        }
    });

    stats.totalTradesCreated = newTrades.length;
    stats.tradesUpdated = updates.size;
    stats.reviewLegs = newTrades
        .filter((trade: AnyRecord) => trade.importReview)
        .reduce((acc: number, trade: AnyRecord) => acc + ((trade.legs || []).length), 0);

    return { newTrades, updates, stats, batchId, reviewTradeIds };
}

export function applyOfxImportResult(this: any, importResult: AnyRecord, context: AnyRecord = {}) {
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
                note: 'Existing trade updated from OFX import.'
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

    const fileName = context?.fileName || 'OFX file';

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

        const message = segments.length
            ? `OFX import completed: ${segments.join(', ')}.`
            : 'OFX import completed.';
        this.showNotification(message, 'success');
        this.appendImportLog({
            type: 'success',
            message: `${message} Source: ${fileName}.`,
            timestamp: new Date()
        });
    } else {
        this.showNotification('OFX import completed. No changes detected.', 'info');
        this.appendImportLog({
            type: 'info',
            message: `OFX import from ${fileName} completed with no changes.`,
            timestamp: new Date()
        });
    }

    this.updateImportSummary({
        fileName,
        batchId,
        stats,
        reviewTradeIds,
        timestamp: new Date()
    });
    this.renderImportSummary();
    this.refreshImportMergeList();
    this.initializeAIChat();
}
