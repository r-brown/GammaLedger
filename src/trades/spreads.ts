// src/trades/spreads.ts — Wave 3: Credit Playbook spread extraction helpers.
// Uses the .call(this, …) delegation pattern.

interface SpreadPair {
    tradeId: string
    ticker: string
    strategy: string
    strike: string | number
    type: string
    quantity: number
    pricePerContract: number
    fees: number
    premium: number
    entryDate: Date | null
    expirationDate: string | null
    dte: number | null
    exitDate: Date | null
    daysHeld: number | null
    pl: number
    roi: number | null
    isOpen: boolean
    isExpired: boolean
    isRolling: boolean
    isAssigned: boolean
    capital: number
}

interface SpreadsContext {
    getLegSide(leg: Record<string, unknown>): string
    getLegAction(leg: Record<string, unknown>): string
    getLegMultiplier(leg: Record<string, unknown>): number
    parseDateValue(value: unknown): Date | null
    isClosedStatus(status: unknown): boolean
    isAssignedStatus(status: unknown): boolean
    extractRolledSpread(trade: Record<string, unknown>, allLegs: Record<string, unknown>[], now: Date, pairs: SpreadPair[]): void
    extractSingleSpread(trade: Record<string, unknown>, groupLegs: Record<string, unknown>[], expiration: string, now: Date, pairs: SpreadPair[]): void
    detectRollChain(sortedLegs: Record<string, unknown>[]): boolean
    extractRolledPositionAcrossStrikes(trade: Record<string, unknown>, allLegs: Record<string, unknown>[], type: string, now: Date, pairs: SpreadPair[]): void
    extractRolledPosition(trade: Record<string, unknown>, allLegs: Record<string, unknown>[], strike: number, type: string, now: Date, pairs: SpreadPair[]): void
    extractSingleLegPair(trade: Record<string, unknown>, groupLegs: Record<string, unknown>[], strike: number, type: string, expiration: string, now: Date, pairs: SpreadPair[]): void
}

export function extractSpreadPair(
    this: SpreadsContext,
    trade: Record<string, unknown>,
    legs: Record<string, unknown>[],
    now: Date,
    pairs: SpreadPair[]
): void {
    const optionLegs = legs.filter(leg => leg.type === 'CALL' || leg.type === 'PUT');
    if (optionLegs.length === 0) return;

    const expirationGroups = new Map<string, Record<string, unknown>[]>();
    optionLegs.forEach(leg => {
        const expiration = (leg.expirationDate as string) || '';
        if (!expirationGroups.has(expiration)) expirationGroups.set(expiration, []);
        expirationGroups.get(expiration)!.push(leg);
    });

    const hasMultipleExpirations = expirationGroups.size > 1;
    const tradeStatus = ((trade.status as string) || '').toLowerCase();
    const isRolling = tradeStatus === 'rolling' || tradeStatus === 'rolled';

    if (hasMultipleExpirations || isRolling) {
        this.extractRolledSpread(trade, optionLegs, now, pairs);
    } else {
        const expiration = Array.from(expirationGroups.keys())[0];
        const groupLegs = expirationGroups.get(expiration)!;
        this.extractSingleSpread(trade, groupLegs, expiration, now, pairs);
    }
}

export function extractRolledSpread(
    this: SpreadsContext,
    trade: Record<string, unknown>,
    allLegs: Record<string, unknown>[],
    now: Date,
    pairs: SpreadPair[]
): void {
    const isTradeClosed = this.isClosedStatus(trade.status);
    const tradeClosedAt = isTradeClosed ? this.parseDateValue(trade.closedDate) : null;

    const sortedLegs = allLegs.slice().sort((a, b) => {
        const dateA = this.parseDateValue(a.executionDate);
        const dateB = this.parseDateValue(b.executionDate);
        if (!dateA || !dateB) return 0;
        return dateA.getTime() - dateB.getTime();
    });

    const legTypes = new Set(sortedLegs.map(l => l.type as string).filter(Boolean));
    let type: string;
    if (legTypes.size === 1) {
        type = legTypes.values().next().value as string;
    } else if (legTypes.has('CALL') && legTypes.has('PUT')) {
        type = 'CALL/PUT';
    } else {
        type = (sortedLegs[0]?.type as string) || 'CALL';
    }

    let totalGrossPremium = 0, totalFees = 0, quantity = 0;
    let entryDate: Date | null = null, exitDate: Date | null = null, currentExpiration: string | null = null;
    const currentStrikes: number[] = [];

    const openingLegs = sortedLegs.filter(leg => this.getLegSide(leg) === 'OPEN');
    const closingLegs = sortedLegs.filter(leg => this.getLegSide(leg) === 'CLOSE');

    sortedLegs.forEach(leg => {
        const legSide = this.getLegSide(leg);
        const legAction = this.getLegAction(leg);
        const legQuantity = Math.abs(Number(leg.quantity) || 0);
        const legPremium = Number(leg.premium) || 0;
        const multiplier = this.getLegMultiplier(leg);
        const direction = legAction === 'SELL' ? 1 : -1;

        totalGrossPremium += direction * legPremium * multiplier * legQuantity;
        totalFees += Number(leg.fees) || 0;

        if (legSide === 'OPEN') {
            quantity = Math.max(quantity, Math.abs(Number(leg.quantity) || 0));
            currentExpiration = (leg.expirationDate as string) || null;
            const strike = Number(leg.strike);
            if (Number.isFinite(strike)) currentStrikes.push(strike);
        }

        const legDate = this.parseDateValue(leg.executionDate);
        if (legDate) {
            if (!entryDate || legDate < entryDate) entryDate = legDate;
            if (legSide === 'CLOSE' && (!exitDate || legDate > exitDate)) exitDate = legDate;
        }
    });

    const uniqueStrikes = [...new Set(currentStrikes)].sort((a, b) => a - b);
    const spreadStrike: string = uniqueStrikes.length >= 2
        ? `${uniqueStrikes[0]}/${uniqueStrikes[uniqueStrikes.length - 1]}`
        : (uniqueStrikes.length === 1 ? String(uniqueStrikes[0]) : '—');

    const expirationDate = currentExpiration ? this.parseDateValue(currentExpiration) : null;
    const hasExpired = expirationDate && expirationDate < now;
    const hasOpenLegs = openingLegs.length > 0;
    const hasCloseLegs = closingLegs.length > 0;
    const isRollingNow = hasOpenLegs && hasCloseLegs && !isTradeClosed;
    const isOpen = hasOpenLegs && !hasExpired && !isTradeClosed;

    const dte = isOpen && expirationDate && !isRollingNow
        ? Math.ceil((expirationDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)) : null;

    const effectiveExitDate = exitDate || (hasExpired ? expirationDate : null) || tradeClosedAt;

    const daysHeld = entryDate && (effectiveExitDate || hasExpired)
        ? Math.ceil((((effectiveExitDate || expirationDate || now) as Date).getTime() - (entryDate as Date).getTime()) / (24 * 60 * 60 * 1000))
        : (entryDate ? Math.ceil((now.getTime() - (entryDate as Date).getTime()) / (24 * 60 * 60 * 1000)) : null);

    const multiplier = 100;
    const pricePerContract = quantity > 0 ? totalGrossPremium / (quantity * multiplier) : 0;
    const width = uniqueStrikes.length >= 2 ? uniqueStrikes[uniqueStrikes.length - 1] - uniqueStrikes[0] : 0;
    const capital = width > 0 ? Math.abs(width * quantity * multiplier) : 0;
    const netPremium = totalGrossPremium - totalFees;
    const pl = netPremium;
    const roi = capital > 0 ? (pl / capital) * 100 : null;

    pairs.push({
        tradeId: trade.id as string, ticker: trade.ticker as string, strategy: trade.strategy as string,
        strike: spreadStrike, type, quantity, pricePerContract, fees: totalFees,
        premium: netPremium, entryDate, expirationDate: currentExpiration, dte,
        exitDate: effectiveExitDate, daysHeld,
        pl, roi, isOpen: Boolean(isOpen), isExpired: Boolean(hasExpired), isRolling: isRollingNow,
        isAssigned: this.isAssignedStatus(trade.status), capital
    });
}

export function extractSingleSpread(
    this: SpreadsContext,
    trade: Record<string, unknown>,
    groupLegs: Record<string, unknown>[],
    expiration: string,
    now: Date,
    pairs: SpreadPair[]
): void {
    const isTradeClosed = this.isClosedStatus(trade.status);
    const tradeClosedAt = isTradeClosed ? this.parseDateValue(trade.closedDate) : null;

    const openingLegs = groupLegs.filter(leg => this.getLegSide(leg) === 'OPEN');
    const closingLegs = groupLegs.filter(leg => this.getLegSide(leg) === 'CLOSE');

    const allLegsForType = openingLegs.length > 0 ? openingLegs : closingLegs;
    const legTypes = new Set(allLegsForType.map(l => l.type as string).filter(Boolean));
    let type: string;
    if (legTypes.size === 1) {
        type = legTypes.values().next().value as string;
    } else if (legTypes.has('CALL') && legTypes.has('PUT')) {
        type = 'CALL/PUT';
    } else {
        type = (allLegsForType[0]?.type as string) || 'CALL';
    }

    const strikes = openingLegs.map(leg => Number(leg.strike)).filter(s => Number.isFinite(s));
    const uniqueStrikes = [...new Set(strikes)].sort((a, b) => a - b);
    let spreadStrike: string;
    if (uniqueStrikes.length >= 2) {
        spreadStrike = uniqueStrikes.join('/');
    } else if (uniqueStrikes.length === 1) {
        spreadStrike = String(uniqueStrikes[0]);
    } else {
        spreadStrike = '—';
    }

    let totalGrossPremium = 0, totalFees = 0, entryDate: Date | null = null, exitDate: Date | null = null, quantity = 0;

    openingLegs.forEach(leg => {
        const legAction = this.getLegAction(leg);
        const legQuantity = Math.abs(Number(leg.quantity) || 0);
        const legPremium = Number(leg.premium) || 0;
        const multiplier = this.getLegMultiplier(leg);
        const direction = legAction === 'SELL' ? 1 : -1;
        totalGrossPremium += direction * legPremium * multiplier * legQuantity;
        totalFees += Number(leg.fees) || 0;
        quantity = Math.max(quantity, Math.abs(Number(leg.quantity) || 0));
        const legDate = this.parseDateValue(leg.executionDate);
        if (legDate && (!entryDate || legDate < entryDate)) entryDate = legDate;
    });

    closingLegs.forEach(leg => {
        const legAction = this.getLegAction(leg);
        const legQuantity = Math.abs(Number(leg.quantity) || 0);
        const legPremium = Number(leg.premium) || 0;
        const multiplier = this.getLegMultiplier(leg);
        const direction = legAction === 'SELL' ? 1 : -1;
        totalGrossPremium += direction * legPremium * multiplier * legQuantity;
        totalFees += Number(leg.fees) || 0;
        const legDate = this.parseDateValue(leg.executionDate);
        if (legDate && (!exitDate || legDate > exitDate)) exitDate = legDate;
    });

    const expirationDate = this.parseDateValue(expiration);
    const hasExpired = expirationDate && expirationDate < now;
    const isOpen = openingLegs.length > 0 && closingLegs.length === 0 && !hasExpired && !isTradeClosed;

    const dte = isOpen && expirationDate
        ? Math.ceil((expirationDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)) : null;

    const effectiveExitDate = exitDate || (hasExpired ? expirationDate : null) || tradeClosedAt;

    const daysHeld = entryDate && (effectiveExitDate || hasExpired)
        ? Math.ceil((((effectiveExitDate || expirationDate || now) as Date).getTime() - (entryDate as Date).getTime()) / (24 * 60 * 60 * 1000))
        : (entryDate ? Math.ceil((now.getTime() - (entryDate as Date).getTime()) / (24 * 60 * 60 * 1000)) : null);

    const multiplier = 100;
    const pricePerContract = quantity > 0 ? totalGrossPremium / (quantity * multiplier) : 0;

    let width = 0;
    if (type === 'CALL/PUT' && strikes.length >= 4) {
        const callStrikes = openingLegs.filter(l => l.type === 'CALL').map(l => Number(l.strike)).filter(Number.isFinite);
        const putStrikes = openingLegs.filter(l => l.type === 'PUT').map(l => Number(l.strike)).filter(Number.isFinite);
        const callWidth = callStrikes.length >= 2 ? Math.max(...callStrikes) - Math.min(...callStrikes) : 0;
        const putWidth = putStrikes.length >= 2 ? Math.max(...putStrikes) - Math.min(...putStrikes) : 0;
        width = Math.max(callWidth, putWidth);
    } else {
        width = strikes.length >= 2 ? Math.max(...strikes) - Math.min(...strikes) : 0;
    }
    const capital = width > 0 ? Math.abs(width * quantity * multiplier) : 0;
    const netPremium = totalGrossPremium - totalFees;
    const pl = netPremium;
    const roi = capital > 0 ? (pl / capital) * 100 : null;

    pairs.push({
        tradeId: trade.id as string, ticker: trade.ticker as string, strategy: trade.strategy as string,
        strike: spreadStrike, type, quantity, pricePerContract, fees: totalFees,
        premium: netPremium, entryDate, expirationDate: expiration, dte,
        exitDate: effectiveExitDate, daysHeld,
        pl, roi, isOpen: Boolean(isOpen), isExpired: Boolean(hasExpired), isRolling: false,
        isAssigned: this.isAssignedStatus(trade.status), capital
    });
}

export function extractIndividualLegPairs(
    this: SpreadsContext,
    trade: Record<string, unknown>,
    legs: Record<string, unknown>[],
    now: Date,
    pairs: SpreadPair[]
): void {
    const tradeStatus = ((trade.status as string) || '').toLowerCase();
    const isTradeRolling = tradeStatus === 'rolling' || tradeStatus === 'rolled';

    const typeGroups = new Map<string, Record<string, unknown>[]>();
    legs.forEach((leg) => {
        if (leg.type !== 'CALL' && leg.type !== 'PUT') return;
        const type = leg.type as string;
        if (!typeGroups.has(type)) typeGroups.set(type, []);
        typeGroups.get(type)!.push(leg);
    });

    typeGroups.forEach((typeLegs, type) => {
        const sorted = typeLegs.slice().sort((a, b) => {
            const dA = this.parseDateValue(a.executionDate);
            const dB = this.parseDateValue(b.executionDate);
            if (!dA || !dB) return 0;
            return dA.getTime() - dB.getTime();
        });

        const hasRollChain = this.detectRollChain(sorted);

        if (isTradeRolling || hasRollChain) {
            this.extractRolledPositionAcrossStrikes(trade, sorted, type, now, pairs);
        } else {
            const strikeGroups = new Map<string, Record<string, unknown>[]>();
            sorted.forEach(leg => {
                const strike = Number(leg.strike);
                const key = `${strike}`;
                if (!strikeGroups.has(key)) strikeGroups.set(key, []);
                strikeGroups.get(key)!.push(leg);
            });

            strikeGroups.forEach((groupLegs, strikeStr) => {
                const strike = Number(strikeStr);
                const expirationGroups = new Map<string, Record<string, unknown>[]>();
                groupLegs.forEach(leg => {
                    const expiration = (leg.expirationDate as string) || '';
                    if (!expirationGroups.has(expiration)) expirationGroups.set(expiration, []);
                    expirationGroups.get(expiration)!.push(leg);
                });

                const isRolled = expirationGroups.size > 1;
                if (isRolled) {
                    this.extractRolledPosition(trade, groupLegs, strike, type, now, pairs);
                } else {
                    expirationGroups.forEach((expLegs, expiration) => {
                        this.extractSingleLegPair(trade, expLegs, strike, type, expiration, now, pairs);
                    });
                }
            });
        }
    });
}

export function detectRollChain(
    this: SpreadsContext,
    sortedLegs: Record<string, unknown>[]
): boolean {
    for (let i = 0; i < sortedLegs.length - 1; i++) {
        const legA = sortedLegs[i];
        const legB = sortedLegs[i + 1];
        const sideA = this.getLegSide(legA);
        const sideB = this.getLegSide(legB);

        if (sideA === 'CLOSE' && sideB === 'OPEN') {
            const dateA = this.parseDateValue(legA.executionDate);
            const dateB = this.parseDateValue(legB.executionDate);
            if (dateA && dateB) {
                const dayDiff = Math.abs(dateB.getTime() - dateA.getTime()) / (24 * 60 * 60 * 1000);
                if (dayDiff <= 1) {
                    const strikeA = Number(legA.strike);
                    const strikeB = Number(legB.strike);
                    if (strikeA !== strikeB || legA.expirationDate !== legB.expirationDate) {
                        return true;
                    }
                }
            }
        }
    }
    return false;
}

export function extractRolledPositionAcrossStrikes(
    this: SpreadsContext,
    trade: Record<string, unknown>,
    allLegs: Record<string, unknown>[],
    type: string,
    now: Date,
    pairs: SpreadPair[]
): void {
    const isTradeClosed = this.isClosedStatus(trade.status);
    const tradeClosedAt = isTradeClosed ? this.parseDateValue(trade.closedDate) : null;

    let totalGrossPremium = 0, totalFees = 0, entryDate: Date | null = null, exitDate: Date | null = null;
    let currentStrike: number | null = null, currentExpiration: string | null = null, netQuantity = 0;

    allLegs.forEach(leg => {
        const legSide = this.getLegSide(leg);
        const action = this.getLegAction(leg);
        const quantity = Math.abs(Number(leg.quantity) || 0);
        const legPremium = Number(leg.premium) || 0;
        const multiplier = this.getLegMultiplier(leg);
        const direction = action === 'SELL' ? 1 : -1;

        totalGrossPremium += direction * legPremium * multiplier * quantity;
        totalFees += Number(leg.fees) || 0;

        if (legSide === 'OPEN') {
            if (action === 'SELL') netQuantity += quantity;
            else netQuantity -= quantity;
            currentStrike = Number(leg.strike);
            currentExpiration = (leg.expirationDate as string) || null;
        } else if (legSide === 'CLOSE') {
            if (action === 'BUY') netQuantity -= quantity;
            else netQuantity += quantity;
        }

        const legDate = this.parseDateValue(leg.executionDate);
        if (legDate) {
            if (!entryDate || legDate < entryDate) entryDate = legDate;
            if (legSide === 'CLOSE' && (!exitDate || legDate > exitDate)) exitDate = legDate;
        }
    });

    const strike = typeof currentStrike === 'number' && Number.isFinite(currentStrike)
        ? currentStrike
        : Number(allLegs[0]?.strike);
    const expirationDate = currentExpiration ? this.parseDateValue(currentExpiration) : null;
    const hasExpired = expirationDate && expirationDate < now;
    const hasOpenLegs = allLegs.some(leg => this.getLegSide(leg) === 'OPEN');
    const hasCloseLegs = allLegs.some(leg => this.getLegSide(leg) === 'CLOSE');
    const isRolling = hasOpenLegs && hasCloseLegs && netQuantity !== 0 && !isTradeClosed;
    const isOpen = netQuantity !== 0 && !hasExpired && !isTradeClosed;

    if (netQuantity === 0 && !isOpen) {
        netQuantity = Math.abs(allLegs
            .filter(leg => this.getLegSide(leg) === 'OPEN')
            .reduce((sum, leg) => sum + Math.abs(Number(leg.quantity) || 0), 0));
    }

    const absoluteQuantity = Math.abs(netQuantity);
    const dte = isOpen && expirationDate && !isRolling
        ? Math.ceil((expirationDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)) : null;

    const effectiveExitDate = exitDate || (hasExpired ? expirationDate : null) || tradeClosedAt;

    const daysHeld = entryDate && (effectiveExitDate || hasExpired)
        ? Math.ceil((((effectiveExitDate || expirationDate || now) as Date).getTime() - (entryDate as Date).getTime()) / (24 * 60 * 60 * 1000))
        : (entryDate ? Math.ceil((now.getTime() - (entryDate as Date).getTime()) / (24 * 60 * 60 * 1000)) : null);

    const multiplier = 100;
    const pricePerContract = absoluteQuantity > 0 ? totalGrossPremium / (absoluteQuantity * multiplier) : 0;
    const capital = Math.abs(strike * absoluteQuantity * multiplier);
    const netPremium = totalGrossPremium - totalFees;
    const pl = netPremium;
    const roi = capital > 0 ? (pl / capital) * 100 : null;

    pairs.push({
        tradeId: trade.id as string, ticker: trade.ticker as string, strategy: trade.strategy as string,
        strike, type, quantity: absoluteQuantity, pricePerContract, fees: totalFees,
        premium: netPremium, entryDate, expirationDate: currentExpiration, dte,
        exitDate: effectiveExitDate, daysHeld,
        pl, roi, isOpen: Boolean(isOpen), isExpired: Boolean(hasExpired), isRolling,
        isAssigned: this.isAssignedStatus(trade.status), capital
    });
}

export function extractRolledPosition(
    this: SpreadsContext,
    trade: Record<string, unknown>,
    allLegs: Record<string, unknown>[],
    strike: number,
    type: string,
    now: Date,
    pairs: SpreadPair[]
): void {
    const isTradeClosed = this.isClosedStatus(trade.status);
    const tradeClosedAt = isTradeClosed ? this.parseDateValue(trade.closedDate) : null;

    const sortedLegs = allLegs.slice().sort((a, b) => {
        const dateA = this.parseDateValue(a.executionDate);
        const dateB = this.parseDateValue(b.executionDate);
        if (!dateA || !dateB) return 0;
        return dateA.getTime() - dateB.getTime();
    });

    let totalGrossPremium = 0, totalFees = 0, netQuantity = 0;
    let entryDate: Date | null = null, exitDate: Date | null = null, currentExpiration: string | null = null;

    sortedLegs.forEach(leg => {
        const legSide = this.getLegSide(leg);
        const action = this.getLegAction(leg);
        const quantity = Math.abs(Number(leg.quantity) || 0);
        const legPremium = Number(leg.premium) || 0;
        const multiplier = this.getLegMultiplier(leg);
        const direction = action === 'SELL' ? 1 : -1;

        totalGrossPremium += direction * legPremium * multiplier * quantity;
        totalFees += Number(leg.fees) || 0;

        if (legSide === 'OPEN') {
            if (action === 'SELL') { netQuantity += quantity; currentExpiration = (leg.expirationDate as string) || null; }
            else if (action === 'BUY') netQuantity -= quantity;
        } else if (legSide === 'CLOSE') {
            if (action === 'BUY') netQuantity -= quantity;
            else if (action === 'SELL') netQuantity += quantity;
        }

        const legDate = this.parseDateValue(leg.executionDate);
        if (legDate) {
            if (!entryDate || legDate < entryDate) entryDate = legDate;
            if (legSide === 'CLOSE' && (!exitDate || legDate > exitDate)) exitDate = legDate;
        }
    });

    const expirationDate = currentExpiration ? this.parseDateValue(currentExpiration) : null;
    const hasExpired = expirationDate && expirationDate < now;
    const hasOpenLegs = sortedLegs.some(leg => this.getLegSide(leg) === 'OPEN');
    const hasCloseLegs = sortedLegs.some(leg => this.getLegSide(leg) === 'CLOSE');
    const isRolling = hasOpenLegs && hasCloseLegs && netQuantity !== 0 && !isTradeClosed;
    const isOpen = netQuantity !== 0 && !hasExpired && !isTradeClosed;

    if (netQuantity === 0 && !isOpen) {
        netQuantity = Math.abs(sortedLegs
            .filter(leg => this.getLegSide(leg) === 'OPEN')
            .reduce((sum, leg) => sum + Math.abs(Number(leg.quantity) || 0), 0));
    }

    const absoluteQuantity = Math.abs(netQuantity);
    const dte = isOpen && expirationDate && !isRolling
        ? Math.ceil((expirationDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)) : null;

    const effectiveExitDate = exitDate || (hasExpired ? expirationDate : null) || tradeClosedAt;

    const daysHeld = entryDate && (effectiveExitDate || hasExpired)
        ? Math.ceil((((effectiveExitDate || expirationDate || now) as Date).getTime() - (entryDate as Date).getTime()) / (24 * 60 * 60 * 1000))
        : (entryDate ? Math.ceil((now.getTime() - (entryDate as Date).getTime()) / (24 * 60 * 60 * 1000)) : null);

    const multiplier = 100;
    const pricePerContract = absoluteQuantity > 0 ? totalGrossPremium / (absoluteQuantity * multiplier) : 0;
    const capital = Math.abs(strike * absoluteQuantity * multiplier);
    const netPremium = totalGrossPremium - totalFees;
    const pl = netPremium;
    const roi = capital > 0 ? (pl / capital) * 100 : null;

    pairs.push({
        tradeId: trade.id as string, ticker: trade.ticker as string, strategy: trade.strategy as string,
        strike, type, quantity: absoluteQuantity, pricePerContract, fees: totalFees,
        premium: netPremium, entryDate, expirationDate: currentExpiration, dte,
        exitDate: effectiveExitDate, daysHeld,
        pl, roi, isOpen: Boolean(isOpen), isExpired: Boolean(hasExpired), isRolling,
        isAssigned: this.isAssignedStatus(trade.status), capital
    });
}

export function extractSingleLegPair(
    this: SpreadsContext,
    trade: Record<string, unknown>,
    groupLegs: Record<string, unknown>[],
    strike: number,
    type: string,
    expiration: string,
    now: Date,
    pairs: SpreadPair[]
): void {
    const isTradeClosed = this.isClosedStatus(trade.status);
    const tradeClosedAt = isTradeClosed ? this.parseDateValue(trade.closedDate) : null;

    const openingLegs = groupLegs.filter(leg => this.getLegSide(leg) === 'OPEN');
    const closingLegs = groupLegs.filter(leg => this.getLegSide(leg) === 'CLOSE');

    let netQuantity = 0, totalGrossPremium = 0, totalFees = 0, entryDate: Date | null = null, exitDate: Date | null = null;

    openingLegs.forEach(leg => {
        const action = this.getLegAction(leg);
        const quantity = Math.abs(Number(leg.quantity) || 0);
        const legPremium = Number(leg.premium) || 0;
        const multiplier = this.getLegMultiplier(leg);
        const direction = action === 'SELL' ? 1 : -1;

        if (action === 'SELL') netQuantity += quantity;
        else if (action === 'BUY') netQuantity -= quantity;

        totalGrossPremium += direction * legPremium * multiplier * quantity;
        totalFees += Number(leg.fees) || 0;

        const legDate = this.parseDateValue(leg.executionDate);
        if (legDate && (!entryDate || legDate < entryDate)) entryDate = legDate;
    });

    closingLegs.forEach(leg => {
        const action = this.getLegAction(leg);
        const quantity = Math.abs(Number(leg.quantity) || 0);
        const legPremium = Number(leg.premium) || 0;
        const multiplier = this.getLegMultiplier(leg);
        const direction = action === 'SELL' ? 1 : -1;

        if (action === 'BUY') netQuantity -= quantity;
        else if (action === 'SELL') netQuantity += quantity;

        totalGrossPremium += direction * legPremium * multiplier * quantity;
        totalFees += Number(leg.fees) || 0;

        const legDate = this.parseDateValue(leg.executionDate);
        if (legDate && (!exitDate || legDate > exitDate)) exitDate = legDate;
    });

    const expirationDate = this.parseDateValue(expiration);
    const hasExpired = expirationDate && expirationDate < now;
    const isOpen = openingLegs.length > 0 && closingLegs.length === 0 && !hasExpired && !isTradeClosed;

    if (netQuantity === 0 && !isOpen) {
        netQuantity = Math.abs(openingLegs.reduce((sum, leg) => {
            return Math.max(sum, Math.abs(Number(leg.quantity) || 0));
        }, 0));
    }

    const absoluteQuantity = Math.abs(netQuantity);
    const dte = isOpen && expirationDate
        ? Math.ceil((expirationDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)) : null;

    const effectiveExitDate = exitDate || (hasExpired ? expirationDate : null) || tradeClosedAt;

    const daysHeld = entryDate && (effectiveExitDate || hasExpired)
        ? Math.ceil((((effectiveExitDate || expirationDate || now) as Date).getTime() - (entryDate as Date).getTime()) / (24 * 60 * 60 * 1000))
        : (entryDate ? Math.ceil((now.getTime() - (entryDate as Date).getTime()) / (24 * 60 * 60 * 1000)) : null);

    const multiplier = 100;
    const pricePerContract = absoluteQuantity > 0 ? totalGrossPremium / (absoluteQuantity * multiplier) : 0;
    const capital = Math.abs(strike * absoluteQuantity * multiplier);
    const netPremium = totalGrossPremium - totalFees;
    const pl = netPremium;
    const roi = capital > 0 ? (pl / capital) * 100 : null;

    pairs.push({
        tradeId: trade.id as string, ticker: trade.ticker as string, strategy: trade.strategy as string,
        strike, type, quantity: absoluteQuantity, pricePerContract, fees: totalFees,
        premium: netPremium, entryDate, expirationDate: expiration, dte,
        exitDate: effectiveExitDate, daysHeld,
        pl, roi, isOpen: Boolean(isOpen), isExpired: Boolean(hasExpired), isRolling: false,
        isAssigned: this.isAssignedStatus(trade.status), capital
    });
}
