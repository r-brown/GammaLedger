// src/imports/ofx.js — Wave 7: OFX/brokerage statement import parser.
// Uses the .call(this, …) delegation pattern.

type AnyRecord = Record<string, any>

interface OfxElementNode {
    tagName: string
    children: OfxElementNode[]
    textContent: string
    getElementsByTagName(tagName: string): OfxElementNode[]
}

class ParsedOfxElement implements OfxElementNode {
    readonly tagName: string
    readonly children: ParsedOfxElement[] = []
    private readonly contentParts: Array<string | ParsedOfxElement> = []

    constructor(tagName: string) {
        this.tagName = normalizeOfxTagName(tagName);
    }

    appendChild(child: ParsedOfxElement): void {
        this.children.push(child);
        this.contentParts.push(child);
    }

    appendText(value: string): void {
        if (value) {
            this.contentParts.push(decodeXmlEntities(value));
        }
    }

    get textContent(): string {
        return this.contentParts
            .map(part => typeof part === 'string' ? part : part.textContent)
            .join('');
    }

    getElementsByTagName(tagName: string): ParsedOfxElement[] {
        const normalizedTagName = normalizeOfxTagName(tagName);
        const matches: ParsedOfxElement[] = [];

        const visit = (node: ParsedOfxElement): void => {
            node.children.forEach((child) => {
                if (child.tagName === normalizedTagName) {
                    matches.push(child);
                }
                visit(child);
            });
        };

        visit(this);
        return matches;
    }
}

const ACTIVE_BROWSER_TAG_NAMES = new Set([
    'BASE',
    'BODY',
    'BUTTON',
    'EMBED',
    'FORM',
    'FRAME',
    'FRAMESET',
    'HTML',
    'IFRAME',
    'IMG',
    'INPUT',
    'LINK',
    'MATH',
    'META',
    'OBJECT',
    'OPTION',
    'SCRIPT',
    'SELECT',
    'STYLE',
    'SVG',
    'TEXTAREA'
]);

const URL_ATTRIBUTE_NAMES = new Set([
    'ACTION',
    'FORMACTION',
    'HREF',
    'SRC',
    'XLINK:HREF'
]);

function normalizeOfxTagName(tagName: string): string {
    return tagName.trim().toUpperCase();
}

function isValidXmlCodePoint(codePoint: number): boolean {
    return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff;
}

function decodeXmlEntities(value: string): string {
    let decoded = '';
    let cursor = 0;
    while (cursor < value.length) {
        const ampIndex = value.indexOf('&', cursor);
        if (ampIndex === -1) {
            decoded += value.slice(cursor);
            break;
        }

        decoded += value.slice(cursor, ampIndex);
        const semiIndex = value.indexOf(';', ampIndex + 1);
        if (semiIndex === -1) {
            decoded += value.slice(ampIndex);
            break;
        }

        const entity = value.slice(ampIndex + 1, semiIndex);
        const replacement = decodeXmlEntity(entity);
        decoded += replacement ?? value.slice(ampIndex, semiIndex + 1);
        cursor = semiIndex + 1;
    }
    return decoded;
}

function decodeXmlEntity(entity: string): string | null {
    const normalized = entity.toLowerCase();
    if (normalized === 'amp') return '&';
    if (normalized === 'apos') return "'";
    if (normalized === 'gt') return '>';
    if (normalized === 'lt') return '<';
    if (normalized === 'quot') return '"';
    if (normalized.startsWith('#x')) {
        const codePoint = Number.parseInt(normalized.slice(2), 16);
        return isValidXmlCodePoint(codePoint) ? String.fromCodePoint(codePoint) : null;
    }
    if (normalized.startsWith('#')) {
        const codePoint = Number.parseInt(normalized.slice(1), 10);
        return isValidXmlCodePoint(codePoint) ? String.fromCodePoint(codePoint) : null;
    }
    return null;
}

function isWhitespace(value: string, index: number): boolean {
    const char = value.charCodeAt(index);
    return char === 9 || char === 10 || char === 12 || char === 13 || char === 32;
}

function skipWhitespace(value: string, index: number, end: number): number {
    let cursor = index;
    while (cursor < end && isWhitespace(value, cursor)) {
        cursor += 1;
    }
    return cursor;
}

function isAsciiLetter(code: number): boolean {
    return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

function isNameStart(value: string, index: number): boolean {
    const code = value.charCodeAt(index);
    return isAsciiLetter(code) || code === 95;
}

function isNameChar(value: string, index: number): boolean {
    const code = value.charCodeAt(index);
    return isNameStart(value, index) || (code >= 48 && code <= 57) || code === 45 || code === 46 || code === 58;
}

function readName(value: string, index: number, end: number): { name: string, end: number } {
    if (index >= end || !isNameStart(value, index)) {
        throw new Error('Unable to parse OFX document.');
    }

    let cursor = index + 1;
    while (cursor < end && isNameChar(value, cursor)) {
        cursor += 1;
    }

    return {
        name: normalizeOfxTagName(value.slice(index, cursor)),
        end: cursor
    };
}

function assertSafeOfxTagName(tagName: string): void {
    if (ACTIVE_BROWSER_TAG_NAMES.has(tagName)) {
        throw new Error('OFX document contains unsupported active markup.');
    }
}

function assertSafeOfxAttributeName(attributeName: string): void {
    if (
        URL_ATTRIBUTE_NAMES.has(attributeName) ||
        (attributeName.length > 2 && attributeName.startsWith('ON') && isAsciiLetter(attributeName.charCodeAt(2)))
    ) {
        throw new Error('OFX document contains unsupported active markup.');
    }
}

function readTag(xmlContent: string, openIndex: number): { end: number, tagName: string, closing: boolean, selfClosing: boolean } {
    const closeIndex = xmlContent.indexOf('>', openIndex + 1);
    const innerOpenIndex = xmlContent.indexOf('<', openIndex + 1);
    if (closeIndex === -1 || (innerOpenIndex !== -1 && innerOpenIndex < closeIndex)) {
        throw new Error('Unable to parse OFX document.');
    }

    let cursor = openIndex + 1;
    const closing = xmlContent.charAt(cursor) === '/';
    if (closing) {
        cursor += 1;
    }
    cursor = skipWhitespace(xmlContent, cursor, closeIndex);

    const nameToken = readName(xmlContent, cursor, closeIndex);
    const tagName = nameToken.name;
    assertSafeOfxTagName(tagName);
    cursor = skipWhitespace(xmlContent, nameToken.end, closeIndex);

    if (closing) {
        if (cursor !== closeIndex) {
            throw new Error('Unable to parse OFX document.');
        }
        return { end: closeIndex + 1, tagName, closing, selfClosing: false };
    }

    const selfClosing = readAttributes(xmlContent, cursor, closeIndex);
    return { end: closeIndex + 1, tagName, closing, selfClosing };
}

function readAttributes(xmlContent: string, index: number, end: number): boolean {
    let cursor = index;
    while (cursor < end) {
        cursor = skipWhitespace(xmlContent, cursor, end);
        if (cursor >= end) {
            return false;
        }

        if (xmlContent.charAt(cursor) === '/') {
            cursor = skipWhitespace(xmlContent, cursor + 1, end);
            if (cursor !== end) {
                throw new Error('Unable to parse OFX document.');
            }
            return true;
        }

        const attribute = readName(xmlContent, cursor, end);
        assertSafeOfxAttributeName(attribute.name);
        cursor = skipWhitespace(xmlContent, attribute.end, end);
        if (xmlContent.charAt(cursor) !== '=') {
            throw new Error('Unable to parse OFX document.');
        }

        cursor = skipWhitespace(xmlContent, cursor + 1, end);
        const quote = xmlContent.charAt(cursor);
        if (quote !== '"' && quote !== "'") {
            throw new Error('Unable to parse OFX document.');
        }

        cursor += 1;
        const valueEnd = xmlContent.indexOf(quote, cursor);
        if (valueEnd === -1 || valueEnd > end) {
            throw new Error('Unable to parse OFX document.');
        }
        cursor = valueEnd + 1;
    }

    return false;
}

function appendOfxText(parent: ParsedOfxElement | undefined, text: string): void {
    if (!text) {
        return;
    }
    if (!parent || text.includes('<')) {
        throw new Error('Unable to parse OFX document.');
    }
    if (parent.tagName === '#DOCUMENT') {
        if (text.trim()) {
            throw new Error('Unable to parse OFX document.');
        }
        return;
    }
    parent.appendText(text);
}

function parseOfxXmlDocument(xmlContent: string): ParsedOfxElement {
    const documentNode = new ParsedOfxElement('#document');
    const stack: ParsedOfxElement[] = [documentNode];
    let cursor = 0;

    while (cursor < xmlContent.length) {
        const tokenStart = xmlContent.indexOf('<', cursor);
        if (tokenStart === -1) {
            appendOfxText(stack[stack.length - 1], xmlContent.slice(cursor));
            break;
        }

        const parent = stack[stack.length - 1];
        const text = xmlContent.slice(cursor, tokenStart);
        appendOfxText(parent, text);

        if (xmlContent.startsWith('<!--', tokenStart)) {
            const commentEnd = xmlContent.indexOf('-->', tokenStart + 4);
            if (commentEnd === -1) {
                throw new Error('Unable to parse OFX document.');
            }
            cursor = commentEnd + 3;
            continue;
        }

        if (xmlContent.startsWith('<?', tokenStart)) {
            const processingInstructionEnd = xmlContent.indexOf('?>', tokenStart + 2);
            if (processingInstructionEnd === -1) {
                throw new Error('Unable to parse OFX document.');
            }
            cursor = processingInstructionEnd + 2;
            continue;
        }

        if (xmlContent.startsWith('<![CDATA[', tokenStart)) {
            const cdataEnd = xmlContent.indexOf(']]>', tokenStart + 9);
            if (cdataEnd === -1) {
                throw new Error('Unable to parse OFX document.');
            }
            const cdataText = xmlContent.slice(tokenStart + 9, cdataEnd);
            if (!parent || (parent === documentNode && cdataText.trim())) {
                throw new Error('Unable to parse OFX document.');
            }
            if (parent !== documentNode) {
                parent.appendText(cdataText);
            }
            cursor = cdataEnd + 3;
            continue;
        }

        if (xmlContent.startsWith('<!', tokenStart)) {
            throw new Error('OFX document contains unsupported XML declarations.');
        }

        const tag = readTag(xmlContent, tokenStart);

        if (tag.closing) {
            const current = stack.pop();
            if (!current || current.tagName !== tag.tagName || current === documentNode) {
                throw new Error('Unable to parse OFX document.');
            }
        } else {
            if (parent === documentNode && documentNode.children.length > 0) {
                throw new Error('Unable to parse OFX document.');
            }
            const child = new ParsedOfxElement(tag.tagName);
            parent?.appendChild(child);
            if (!tag.selfClosing) {
                stack.push(child);
            }
        }

        cursor = tag.end;
    }

    if (stack.length !== 1) {
        throw new Error('Unable to parse OFX document.');
    }

    const root = documentNode.children[0];
    if (!root || root.tagName !== 'OFX') {
        throw new Error('Invalid OFX file: missing OFX root.');
    }

    return documentNode;
}

export function parseOfx(this: any, raw: string) {
    if (typeof raw !== 'string') {
        throw new Error('OFX payload is invalid.');
    }

    const startIndex = raw.indexOf('<OFX');
    if (startIndex === -1) {
        throw new Error('Invalid OFX file: missing OFX root.');
    }

    const xmlContent = raw.slice(startIndex).trim();
    const doc = parseOfxXmlDocument(xmlContent);

    const securities = this.extractOfxSecurities(doc);
    const transactions = this.extractOfxTransactions(doc, securities);

    return {
        securities,
        transactions
    };
}

export function extractOfxSecurities(this: any, doc: OfxElementNode) {
    const map = new Map<string, AnyRecord>();
    const secList = doc.getElementsByTagName('SECLIST')[0];
    if (!secList) {
        return map;
    }

    const getText = (root: OfxElementNode | null, tag: string) => {
        if (!root) {
            return '';
        }
        const node = root.getElementsByTagName(tag)[0];
        return node ? (node.textContent ?? '').trim().replace(/[<>]/g, '') : '';
    };

    Array.from(secList.children).forEach((node) => {
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

export function extractOfxTransactions(this: any, doc: OfxElementNode, securities: Map<string, AnyRecord>) {
    const transactions: AnyRecord[] = [];
    const invTranList = doc.getElementsByTagName('INVTRANLIST')[0];
    if (!invTranList) {
        return transactions;
    }

    const getText = (root: OfxElementNode | null, tag: string) => {
        if (!root) {
            return '';
        }
        const node = root.getElementsByTagName(tag)[0];
        return node ? (node.textContent ?? '').trim().replace(/[<>]/g, '') : '';
    };

    Array.from(invTranList.children).forEach((node) => {
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
