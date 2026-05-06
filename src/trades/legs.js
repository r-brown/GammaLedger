// src/trades/legs.js — Wave 3: Leg normalisation and analysis helpers.
// All functions use the `.call(this, …)` delegation pattern: when invoked
// from a GammaLedger class method via `legsModule.fn.call(this, …)` the
// function body's `this.xxx` references resolve to the class instance, so
// cross-module calls (e.g. this.normalizeUnderlyingType, this.parseDateValue)
// continue to work without any signature changes.

export function normalizeLegOrderType(orderType) {
    const value = (orderType || '').toString().trim().toUpperCase();
    if (['BTO', 'STO', 'BTC', 'STC'].includes(value)) {
        return value;
    }
    const normalized = value
        .replace('BUY TO OPEN', 'BTO')
        .replace('SELL TO OPEN', 'STO')
        .replace('BUY TO CLOSE', 'BTC')
        .replace('SELL TO CLOSE', 'STC');
    if (['BTO', 'STO', 'BTC', 'STC'].includes(normalized)) {
        return normalized;
    }
    if (value.startsWith('B')) {
        return value.includes('C') ? 'BTC' : 'BTO';
    }
    if (value.startsWith('S')) {
        return value.includes('C') ? 'STC' : 'STO';
    }
    return 'BTO';
}

export function mapOrderTypeToActionSide(orderType) {
    switch (this.normalizeLegOrderType(orderType)) {
        case 'BTO':
            return { action: 'BUY', side: 'OPEN' };
        case 'STO':
            return { action: 'SELL', side: 'OPEN' };
        case 'BTC':
            return { action: 'BUY', side: 'CLOSE' };
        case 'STC':
            return { action: 'SELL', side: 'CLOSE' };
        default:
            return { action: 'BUY', side: 'OPEN' };
    }
}

export function getLegOrderDescriptor(leg = {}) {
    const normalizedOrderType = this.normalizeLegOrderType(leg?.orderType || leg?.order || leg?.tradeType);
    if (normalizedOrderType) {
        return this.mapOrderTypeToActionSide(normalizedOrderType);
    }
    const normalizedAction = this.normalizeLegAction(leg?.action);
    const normalizedSide = this.normalizeLegSide(leg?.side);
    if (normalizedAction || normalizedSide) {
        return this.mapOrderTypeToActionSide(
            this.deriveOrderTypeFromActionSide(normalizedAction || 'BUY', normalizedSide || 'OPEN')
        );
    }
    return { action: 'BUY', side: 'OPEN' };
}

export function getLegAction(leg = {}) {
    return this.getLegOrderDescriptor(leg).action;
}

export function getLegSide(leg = {}) {
    return this.getLegOrderDescriptor(leg).side;
}

export function deriveOrderTypeFromActionSide(action, side) {
    const normalizedAction = this.normalizeLegAction(action);
    const normalizedSide = this.normalizeLegSide(side);
    if (normalizedSide === 'ROLL') {
        return normalizedAction === 'SELL' ? 'STO' : 'BTO';
    }
    if (normalizedAction === 'BUY' && normalizedSide === 'OPEN') return 'BTO';
    if (normalizedAction === 'SELL' && normalizedSide === 'OPEN') return 'STO';
    if (normalizedAction === 'BUY' && normalizedSide === 'CLOSE') return 'BTC';
    if (normalizedAction === 'SELL' && normalizedSide === 'CLOSE') return 'STC';
    return 'BTO';
}

export function normalizeLegAction(action) {
    const value = (action || '').toString().trim().toUpperCase();
    if (['SELL', 'SHORT', 'STO', 'STC'].includes(value)) {
        return 'SELL';
    }
    return 'BUY';
}

export function normalizeLegSide(side) {
    const value = (side || '').toString().trim().toUpperCase();
    if (value.startsWith('ROL')) return 'ROLL';
    if (["CALL", "PUT", "STOCK"].includes(value)) return 'CLOSE';
    if (['CASH', 'FUTURE', 'ETF', 'SHARES', 'STK'].includes(value)) return 'STOCK';
    if (['BTO', 'STO'].includes(value)) return 'OPEN';
    if (['BTC', 'STC'].includes(value)) return 'CLOSE';
    return 'OPEN';
}

export function normalizeLegType(type) {
    const value = (type || '').toString().trim().toUpperCase();
    if (['CALL', 'PUT', 'STOCK', 'CASH', 'FUTURE', 'ETF'].includes(value)) {
        return value;
    }
    if (value === 'SHARES') return 'STOCK';
    return value || 'UNKNOWN';
}

export function getLegMultiplier(leg) {
    const provided = Number(leg?.multiplier);
    if (Number.isFinite(provided) && provided > 0) {
        return provided;
    }
    const type = this.normalizeLegType(leg?.type);
    if (type === 'STOCK' || type === 'CASH') {
        return 1;
    }
    const underlyingType = this.normalizeUnderlyingType(leg?.underlyingType, { fallback: 'Stock' });
    return this.getDefaultMultiplierForLegType(type, underlyingType);
}

export function normalizeLeg(leg, index = 0) {
    const quantityRaw = Number(leg?.quantity);
    const normalizedQuantity = Number.isFinite(quantityRaw) ? quantityRaw : 0;

    const executionDate = leg?.executionDate ? new Date(leg.executionDate) : null;
    const executionDateIso = executionDate && !Number.isNaN(executionDate.getTime())
        ? executionDate.toISOString().slice(0, 10)
        : '';

    const expirationDate = leg?.expirationDate ? new Date(leg.expirationDate) : null;
    const expirationDateIso = expirationDate && !Number.isNaN(expirationDate.getTime())
        ? expirationDate.toISOString().slice(0, 10)
        : '';

    const inferredOrderType = this.normalizeLegOrderType(
        leg?.orderType ||
        leg?.tradeType ||
        leg?.order ||
        this.deriveOrderTypeFromActionSide(leg?.action, leg?.side)
    );
    const externalIdValue = leg?.externalId;
    const importGroupIdValue = leg?.importGroupId;
    const importSourceValue = leg?.importSource;

    return {
        id: leg?.id || `LEG-${Date.now()}-${index}`,
        orderType: inferredOrderType,
        type: this.normalizeLegType(leg?.type),
        quantity: normalizedQuantity,
        multiplier: this.getLegMultiplier(leg),
        executionDate: executionDateIso,
        expirationDate: expirationDateIso,
        strike: Number.isFinite(Number(leg?.strike)) ? Number(leg.strike) : null,
        premium: Number.isFinite(Number(leg?.premium)) ? Number(leg.premium) : 0,
        fees: Number.isFinite(Number(leg?.fees)) ? Number(leg.fees) : 0,
        underlyingPrice: Number.isFinite(Number(leg?.underlyingPrice)) ? Number(leg.underlyingPrice) : null,
        underlyingType: this.normalizeUnderlyingType(leg?.underlyingType, { fallback: 'Stock' }),
        externalId: externalIdValue === undefined || externalIdValue === null ? null : externalIdValue.toString().trim() || null,
        importGroupId: importGroupIdValue === undefined || importGroupIdValue === null ? null : importGroupIdValue.toString().trim() || null,
        importSource: importSourceValue === undefined || importSourceValue === null ? null : importSourceValue.toString().trim() || null
    };
}

export function calculateLegCashFlow(leg) {
    if (!leg) return 0;
    const quantity = Math.abs(Number(leg.quantity) || 0);
    if (!quantity) return -(Number(leg.fees) || 0);
    const multiplier = this.getLegMultiplier(leg);
    let premium = Number(leg.premium) || 0;
    const legType = this.normalizeLegType(leg.type);
    if (legType === 'STOCK' && premium === 0) {
        premium = Number(leg.strike) || 0;
    }
    const fees = Number(leg.fees) || 0;
    const direction = this.getLegAction(leg) === 'SELL' ? 1 : -1;
    return direction * premium * multiplier * quantity - fees;
}

export function summarizeLegs(legs = []) {
    const summary = {
        legs: [],
        legsCount: 0,
        openLegs: 0,
        closeLegs: 0,
        rollLegs: 0,
        totalFees: 0,
        totalDebit: 0,
        totalCredit: 0,
        cashFlow: 0,
        openCashFlow: 0,
        closeCashFlow: 0,
        openedDate: null,
        closedDate: null,
        earliestExpiration: null,
        latestExpiration: null,
        primaryLeg: null,
        openContracts: 0,
        closeContracts: 0,
        capitalAtRisk: 0,
        entryPrice: null,
        exitPrice: null,
        openCreditGross: 0,
        openDebitGross: 0,
        openFees: 0,
        openBaseContracts: 0,
        verticalSpread: null,
        nearestShortCallExpiration: null,
        nextShortCallExpiration: null
    };

    if (!Array.isArray(legs) || legs.length === 0) {
        return summary;
    }

    const normalizedLegs = legs.map((leg, index) => this.normalizeLeg(leg, index));
    summary.legs = normalizedLegs;
    summary.legsCount = normalizedLegs.length;
    const openOptionGroups = new Map();
    const now = this.currentDate instanceof Date ? this.currentDate : new Date();
    const shortCallPositions = new Map();
    const openBaseContractsByKey = new Map();

    normalizedLegs.forEach((leg, index) => {
        const originalLeg = Array.isArray(legs) ? legs[index] : null;
        const derivedAction = this.getLegAction(leg);
        const derivedSide = this.getLegSide(leg);
        const originalAction = this.normalizeLegAction(originalLeg?.action);
        const originalSide = this.normalizeLegSide(originalLeg?.side);
        const action = derivedAction || originalAction;
        const side = originalSide === 'ROLL' ? 'ROLL' : derivedSide;
        const cashFlow = this.calculateLegCashFlow(leg);
        summary.cashFlow += cashFlow;
        summary.totalFees += Number(leg.fees) || 0;

        const quantity = Math.abs(Number(leg.quantity) || 0);
        if (quantity) {
            if (side === 'OPEN') {
                summary.openLegs += 1;
                summary.openContracts += quantity;
                summary.openCashFlow += cashFlow;

                const multiplier = this.getLegMultiplier(leg) || 1;
                const grossPremium = Math.abs(Number(leg.premium) || 0) * multiplier * quantity;
                if (action === 'SELL') {
                    summary.openCreditGross += grossPremium;
                } else {
                    summary.openDebitGross += grossPremium;
                }
                summary.openFees += Number(leg.fees) || 0;
                const openLifecycleKey = this.buildLegLifecycleKey(leg);
                openBaseContractsByKey.set(openLifecycleKey, (openBaseContractsByKey.get(openLifecycleKey) || 0) + quantity);

                if (['CALL', 'PUT'].includes(leg.type) && Number.isFinite(Number(leg.strike))) {
                    const key = `${leg.type}|${leg.expirationDate || ''}`;
                    if (!openOptionGroups.has(key)) openOptionGroups.set(key, []);
                    openOptionGroups.get(key).push({ leg, action, side });
                }
            } else if (side === 'CLOSE') {
                summary.closeLegs += 1;
                summary.closeContracts += quantity;
                summary.closeCashFlow += cashFlow;
            } else if (side === 'ROLL') {
                summary.rollLegs += 1;
            }
        }

        if (action === 'BUY') {
            summary.totalDebit += Math.abs(cashFlow + (Number(leg.fees) || 0));
        } else {
            summary.totalCredit += Math.abs(cashFlow + (Number(leg.fees) || 0));
        }

        if (leg.executionDate) {
            const exec = new Date(leg.executionDate);
            if (!Number.isNaN(exec.getTime())) {
                if (!summary.openedDate || exec < summary.openedDate) summary.openedDate = exec;
                if (!summary.closedDate || exec > summary.closedDate) summary.closedDate = exec;
            }
        }

        if (leg.expirationDate) {
            const exp = new Date(leg.expirationDate);
            if (!Number.isNaN(exp.getTime())) {
                if (!summary.earliestExpiration || exp < summary.earliestExpiration) summary.earliestExpiration = exp;
                if (!summary.latestExpiration || exp > summary.latestExpiration) summary.latestExpiration = exp;

                if (action === 'SELL' && leg.type === 'CALL') {
                    const key = `${leg.strike}|${leg.expirationDate}`;
                    const qty = Math.abs(Number(leg.quantity) || 0);
                    if (side === 'OPEN') {
                        shortCallPositions.set(key, (shortCallPositions.get(key) || 0) + qty);
                    } else if (side === 'CLOSE') {
                        shortCallPositions.set(key, (shortCallPositions.get(key) || 0) - qty);
                    }
                } else if (action === 'BUY' && leg.type === 'CALL' && side === 'CLOSE') {
                    const key = `${leg.strike}|${leg.expirationDate}`;
                    const qty = Math.abs(Number(leg.quantity) || 0);
                    shortCallPositions.set(key, (shortCallPositions.get(key) || 0) - qty);
                }
            }
        }

        if (!summary.primaryLeg && side !== 'CLOSE') summary.primaryLeg = leg;
    });

    if (!summary.primaryLeg) summary.primaryLeg = normalizedLegs[0];

    shortCallPositions.forEach((netQuantity, key) => {
        if (netQuantity <= 0) return;
        const [, expirationStr] = key.split('|');
        const exp = expirationStr ? new Date(expirationStr) : null;
        if (!exp || Number.isNaN(exp.getTime())) return;
        if (!summary.nearestShortCallExpiration || exp < summary.nearestShortCallExpiration) {
            summary.nearestShortCallExpiration = exp;
        }
        const expWithMarketClose = new Date(Date.UTC(
            exp.getUTCFullYear(), exp.getUTCMonth(), exp.getUTCDate(), 21, 0, 0
        ));
        if (expWithMarketClose >= now) {
            if (!summary.nextShortCallExpiration || exp < summary.nextShortCallExpiration) {
                summary.nextShortCallExpiration = exp;
            }
        }
    });

    openBaseContractsByKey.forEach((qty) => {
        if (qty > summary.openBaseContracts) summary.openBaseContracts = qty;
    });

    const netPositionMap = new Map();
    normalizedLegs.forEach((leg) => {
        const type = (leg.type || '').toUpperCase();
        if (!['CALL', 'PUT'].includes(type)) return;
        const quantity = Math.abs(Number(leg.quantity) || 0);
        if (!quantity) return;
        const key = this.buildLegLifecycleKey(leg);
        const side = this.getLegSide(leg);
        if (!netPositionMap.has(key)) netPositionMap.set(key, { openQty: 0, closeQty: 0, openLegs: [] });
        const entry = netPositionMap.get(key);
        if (side === 'OPEN') { entry.openQty += quantity; entry.openLegs.push(leg); }
        else if (side === 'CLOSE') { entry.closeQty += quantity; }
    });

    const activeOpenLegs = [];
    let hasClosedOutOpenLegs = false;
    netPositionMap.forEach((entry) => {
        const net = entry.openQty - entry.closeQty;
        if (net <= 0) {
            if (entry.openQty > 0 && entry.closeQty > 0) hasClosedOutOpenLegs = true;
            return;
        }
        if (entry.closeQty > 0) hasClosedOutOpenLegs = true;
        let remaining = net;
        const reversedLegs = [...entry.openLegs].reverse();
        for (const leg of reversedLegs) {
            if (remaining <= 0) break;
            const legQty = Math.abs(Number(leg.quantity) || 0);
            const activeQty = Math.min(legQty, remaining);
            if (activeQty > 0) {
                activeOpenLegs.push({ ...leg, quantity: activeQty });
                remaining -= activeQty;
            }
        }
    });

    summary.activeOpenLegs = activeOpenLegs;
    summary.hasClosedOutOpenLegs = hasClosedOutOpenLegs;

    if (hasClosedOutOpenLegs && activeOpenLegs.length > 0) {
        const activeOptionGroups = new Map();
        let activeBaseContracts = 0;
        let activeCreditGross = 0;
        let activeDebitGross = 0;
        let activeFees = 0;
        let activeOpenCashFlow = 0;

        activeOpenLegs.forEach((leg) => {
            const action = this.getLegAction(leg);
            const quantity = Math.abs(Number(leg.quantity) || 0);
            const multiplier = this.getLegMultiplier(leg) || 1;
            const premium = Number(leg.premium) || 0;
            const fees = Number(leg.fees) || 0;
            const cashFlow = this.calculateLegCashFlow(leg);
            activeOpenCashFlow += cashFlow;
            activeFees += fees;
            const grossPremium = Math.abs(premium) * multiplier * quantity;
            if (action === 'SELL') activeCreditGross += grossPremium;
            else activeDebitGross += grossPremium;
            if (['CALL', 'PUT'].includes(leg.type) && Number.isFinite(Number(leg.strike))) {
                const key = `${leg.type}|${leg.expirationDate || ''}`;
                if (!activeOptionGroups.has(key)) activeOptionGroups.set(key, []);
                activeOptionGroups.get(key).push({ leg, action, side: 'OPEN' });
            }
        });

        const activeStrikeQty = new Map();
        activeOpenLegs.forEach((leg) => {
            const quantity = Math.abs(Number(leg.quantity) || 0);
            if (!quantity) return;
            const key = this.buildLegLifecycleKey(leg);
            activeStrikeQty.set(key, (activeStrikeQty.get(key) || 0) + quantity);
        });
        activeStrikeQty.forEach((qty) => {
            if (qty > activeBaseContracts) activeBaseContracts = qty;
        });

        summary.openBaseContracts = activeBaseContracts || summary.openBaseContracts;
        summary.openCreditGross = activeCreditGross;
        summary.openDebitGross = activeDebitGross;
        summary.openFees = activeFees;
        summary.openCashFlow = activeOpenCashFlow;

        const activePrimaryLeg = activeOpenLegs.find(
            leg => this.getLegAction(leg) === 'SELL' && Number.isFinite(Number(leg.strike))
        );
        if (activePrimaryLeg) summary.primaryLeg = activePrimaryLeg;
        else if (activeOpenLegs.length > 0) summary.primaryLeg = activeOpenLegs[0];

        openOptionGroups.clear();
        activeOptionGroups.forEach((value, key) => openOptionGroups.set(key, value));
    }

    let verticalSpreadInfo = null;
    for (const legsGroup of openOptionGroups.values()) {
        if (!Array.isArray(legsGroup) || legsGroup.length < 2) continue;
        const hasBuy = legsGroup.some(({ action }) => action === 'BUY');
        const hasSell = legsGroup.some(({ action }) => action === 'SELL');
        if (!hasBuy || !hasSell) continue;
        const strikes = legsGroup.map(({ leg }) => Number(leg.strike)).filter(Number.isFinite);
        if (strikes.length < 2) continue;
        const spreadWidth = Math.abs(Math.max(...strikes) - Math.min(...strikes));
        if (!(spreadWidth > 0)) continue;
        const multiplier = this.getLegMultiplier(legsGroup[0]?.leg) || 1;
        const buyQty = legsGroup.filter(({ action }) => action === 'BUY').reduce((sum, { leg }) => sum + Math.abs(Number(leg.quantity) || 0), 0);
        const sellQty = legsGroup.filter(({ action }) => action === 'SELL').reduce((sum, { leg }) => sum + Math.abs(Number(leg.quantity) || 0), 0);
        const contracts = Math.min(buyQty || 1, sellQty || 1);
        verticalSpreadInfo = { width: spreadWidth, multiplier, contracts: contracts || 1 };
        break;
    }
    summary.verticalSpread = verticalSpreadInfo;

    const primaryMultiplier = this.getLegMultiplier(summary.primaryLeg) || 1;
    const contractsForEntryRaw = summary.openContracts || Math.abs(Number(summary.primaryLeg?.quantity) || 0);
    const fallbackContracts = contractsForEntryRaw || 1;
    const effectiveContractsForEntry = verticalSpreadInfo?.contracts || summary.openBaseContracts || fallbackContracts;
    const contractsForExit = summary.closeContracts || 0;

    const openEntryCash = Number(summary.openCashFlow);
    if (Number.isFinite(openEntryCash) && effectiveContractsForEntry > 0 && primaryMultiplier > 0) {
        summary.entryPrice = Math.abs(openEntryCash) / (effectiveContractsForEntry * primaryMultiplier);
    } else if (fallbackContracts > 0 && primaryMultiplier > 0) {
        summary.entryPrice = Math.abs(summary.openCashFlow) / (fallbackContracts * primaryMultiplier);
    }

    if (contractsForExit > 0) {
        summary.exitPrice = Math.abs(summary.closeCashFlow) / (contractsForExit * primaryMultiplier);
    }

    summary.capitalAtRisk = this.computeMaxRiskUsingFormula({ legs: normalizedLegs }, summary);

    return summary;
}

export function hasNetOpenOptionLegs(trade = {}) {
    const legs = Array.isArray(trade?.legs) ? trade.legs : [];
    if (!legs.length) return false;

    const summary = this.summarizeLegs(legs);
    const normalizedLegs = Array.isArray(summary?.legs) ? summary.legs : [];
    if (!normalizedLegs.length) return false;

    const optionNet = new Map();
    normalizedLegs.forEach((leg) => {
        if (!leg || !['CALL', 'PUT'].includes((leg.type || '').toUpperCase())) return;
        const quantity = Math.abs(Number(leg.quantity) || 0);
        if (!quantity) return;
        const key = `${leg.type}|${leg.strike ?? ''}|${leg.expirationDate ?? ''}`;
        const side = this.getLegSide(leg);
        if (side === 'OPEN') optionNet.set(key, (optionNet.get(key) || 0) + quantity);
        else if (side === 'CLOSE') optionNet.set(key, (optionNet.get(key) || 0) - quantity);
    });

    if (!optionNet.size) return false;
    return Array.from(optionNet.values()).some(count => count > 0);
}

export function hasNonExpiredOpenShortOptions(trade = {}) {
    const legs = Array.isArray(trade?.legs) ? trade.legs : [];
    if (!legs.length) return false;

    const summary = this.summarizeLegs(legs);
    const normalizedLegs = Array.isArray(summary?.legs) ? summary.legs : [];
    if (!normalizedLegs.length) return false;

    const now = this.currentDate instanceof Date ? this.currentDate : new Date();
    const shortNet = new Map();

    normalizedLegs.forEach((leg) => {
        if (!leg || !['CALL', 'PUT'].includes((leg.type || '').toUpperCase())) return;
        const quantity = Math.abs(Number(leg.quantity) || 0);
        if (!quantity) return;
        const orderType = this.getNormalizedLegOrderType(leg);
        if (orderType !== 'STO' && orderType !== 'BTC') return;
        const key = `${leg.type}|${leg.strike ?? ''}|${leg.expirationDate ?? ''}`;
        if (!shortNet.has(key)) shortNet.set(key, { net: 0, expiration: leg.expirationDate || '' });
        const entry = shortNet.get(key);
        if (orderType === 'STO') entry.net += quantity;
        else if (orderType === 'BTC') entry.net -= quantity;
    });

    if (!shortNet.size) return false;

    for (const [, entry] of shortNet) {
        if (entry.net <= 0) continue;
        if (!entry.expiration) return true;
        const expDate = this.parseDateValue(entry.expiration);
        if (!expDate) return true;
        const expWithMarketClose = new Date(Date.UTC(
            expDate.getUTCFullYear(), expDate.getUTCMonth(), expDate.getUTCDate(), 21, 0, 0
        ));
        if (now.getTime() <= expWithMarketClose.getTime()) return true;
    }
    return false;
}

export function getNetOpenOptionContracts(legs = []) {
    const normalizedLegs = Array.isArray(legs) ? legs : [];
    if (!normalizedLegs.length) return 0;

    const optionNet = new Map();
    normalizedLegs.forEach((leg) => {
        if (!leg || !['CALL', 'PUT'].includes((leg.type || '').toUpperCase())) return;
        const quantity = Math.abs(Number(leg.quantity) || 0);
        if (!quantity) return;
        const key = `${leg.type}|${leg.strike ?? ''}|${leg.expirationDate ?? ''}`;
        const side = this.getLegSide(leg);
        if (side === 'OPEN') optionNet.set(key, (optionNet.get(key) || 0) + quantity);
        else if (side === 'CLOSE') optionNet.set(key, (optionNet.get(key) || 0) - quantity);
    });

    if (!optionNet.size) return 0;
    return Array.from(optionNet.values()).reduce((sum, count) => sum + Math.max(0, Number(count) || 0), 0);
}

export function getNetOpenShortCalls(legs = []) {
    const normalizedLegs = Array.isArray(legs) ? legs : [];
    if (!normalizedLegs.length) return { contracts: 0, details: [] };

    const now = this.currentDate instanceof Date ? this.currentDate : new Date();
    const shortCallNet = new Map();

    normalizedLegs.forEach((leg) => {
        const type = (leg.type || leg.optionType || '').toString().trim().toUpperCase();
        if (type !== 'CALL') return;
        const quantity = Math.abs(Number(leg.quantity) || 0);
        if (!quantity) return;
        const action = this.getLegAction(leg);
        const side = this.getLegSide(leg);
        const strike = leg.strike ?? '';
        const expiration = leg.expirationDate ?? '';
        const key = `${strike}|${expiration}`;

        if (action === 'SELL' && (side === 'OPEN' || side === 'ROLL')) {
            if (!shortCallNet.has(key)) shortCallNet.set(key, { net: 0, strike, expiration });
            shortCallNet.get(key).net += quantity;
        } else if (action === 'BUY' && side === 'CLOSE') {
            if (!shortCallNet.has(key)) shortCallNet.set(key, { net: 0, strike, expiration });
            shortCallNet.get(key).net -= quantity;
        } else if (action === 'SELL' && side === 'CLOSE') {
            if (!shortCallNet.has(key)) shortCallNet.set(key, { net: 0, strike, expiration });
            shortCallNet.get(key).net -= quantity;
        }
    });

    const openPositions = [];
    let totalContracts = 0;

    shortCallNet.forEach((data) => {
        if (data.net <= 0) return;
        if (data.expiration) {
            const expDate = this.parseDateValue(data.expiration);
            if (expDate) {
                const expWithMarketClose = new Date(expDate);
                expWithMarketClose.setUTCHours(21, 0, 0, 0);
                if (expWithMarketClose < now) return;
            }
        }
        totalContracts += data.net;
        openPositions.push({ strike: data.strike, expiration: data.expiration, contracts: data.net });
    });

    return { contracts: totalContracts, details: openPositions };
}

export function buildLegLifecycleKey(leg = {}) {
    const type = this.normalizeLegType(leg.type);
    const strikeValue = Number(leg.strike);
    const strike = Number.isFinite(strikeValue) ? strikeValue.toFixed(4) : 'NA';
    const expiration = (leg.expirationDate || '').toString();
    const multiplier = this.getLegMultiplier(leg) || 1;
    return `${type}|${strike}|${expiration}|${multiplier}`;
}

export function getNormalizedLegOrderType(leg = {}) {
    const rawOrder = leg.orderType || leg.tradeType || leg.order;
    const normalizedOrder = this.normalizeLegOrderType(rawOrder);
    if (normalizedOrder) return normalizedOrder;
    const { action, side } = this.getLegOrderDescriptor(leg);
    return this.normalizeLegOrderType(this.deriveOrderTypeFromActionSide(action, side));
}

export function determineTradeLifecycleStatus(trade = {}, summary = {}) {
    const legs = Array.isArray(summary?.legs) ? summary.legs : [];
    const result = {
        status: 'Open',
        exitReason: null,
        effectiveClosedDate: null,
        openContractsOverride: undefined,
        meta: {
            matchedPairs: false,
            unmatchedExposure: 0,
            expirationPassed: false,
            hasRollLegs: false,
            hasCloseActivity: false,
            hasAssignmentEvent: false,
            hasExpirationEvent: false,
            hasOpenStockPosition: false
        }
    };

    if (legs.length === 0) {
        result.meta.matchedPairs = true;
        return result;
    }

    const pairMap = new Map();
    let hasRollLegs = false;
    let hasCloseActivity = false;
    let hasAssignmentEvent = false;
    let hasExpirationEvent = false;
    let hasCashSettlementEvent = false;

    // Track stock position separately (stocks don't expire)
    let stockBought = 0;
    let stockSold = 0;
    // Track assignment strikes from BTO STOCK legs (strike = assignment price)
    const assignmentStrikes = new Map(); // strike → total shares

    legs.forEach((leg) => {
        const quantity = Math.abs(Number(leg.quantity) || 0);
        if (!quantity) {
            return;
        }

        const orderType = this.getNormalizedLegOrderType(leg);
        const legType = this.normalizeLegType(leg.type);

        // Track stock positions separately — do not add to pairMap.
        // Stock buy/sell prices naturally differ so using strike in the
        // lifecycle key would create mismatched entries.
        if (legType === 'STOCK') {
            // Stock legs store quantity as contracts (e.g. 1) with a separate
            // multiplier (e.g. 100).  We need actual share counts here so that
            // the later `shares / multiplier` arithmetic produces the correct
            // contract count (100 shares / 100 = 1 contract, not 1/100 = 0).
            const stockMultiplier = Math.abs(Number(leg.multiplier) || 100);
            const shares = quantity * stockMultiplier;
            if (orderType === 'BTO') {
                stockBought += shares;
                const strike = Number(leg.strike);
                if (Number.isFinite(strike) && strike > 0) {
                    assignmentStrikes.set(strike, (assignmentStrikes.get(strike) || 0) + shares);
                }
            } else if (orderType === 'STC') {
                stockSold += shares;
                hasCloseActivity = true;
            }
            // Skip adding STOCK legs to pairMap
            const rawOrder = (leg.orderType || leg.tradeType || leg.order || '').toString().toUpperCase();
            if (rawOrder.includes('ROLL')) {
                hasRollLegs = true;
            }
            if (rawOrder.includes('ASSIGN') || leg.isAssignment) {
                hasAssignmentEvent = true;
            }
            if (rawOrder.includes('EXPIRE') || rawOrder.includes('EXPIRY')) {
                hasExpirationEvent = true;
            }
            return;
        }

        // Cash settlement legs — used for cash-settled options (VIX, SPX, NDX, etc.).
        // BTC = settlement payment on a short ITM option (debit).
        // STC = settlement receipt on a long ITM option (credit).
        if (legType === 'CASH' && (orderType === 'BTC' || orderType === 'STC')) {
            hasCashSettlementEvent = true;
            hasAssignmentEvent = true;
            hasCloseActivity = true;

            // Credit the matching open option legs in pairMap so that
            // unmatchedExposure collapses to 0 (resolves the position).
            const cashStrike = Number(leg.strike);
            const hasStrike = Number.isFinite(cashStrike) && cashStrike > 0;

            pairMap.forEach((bucket, key) => {
                const parts = key.split('|');
                const keyStrike = parseFloat(parts[1]);
                if (hasStrike && Number.isFinite(keyStrike) && Math.abs(keyStrike - cashStrike) > 0.01) {
                    return; // Strike mismatch — skip
                }
                // Credit unmatched short open (BTC = closing short positions)
                if (orderType === 'BTC') {
                    const unmatched = bucket.shortOpen - bucket.shortClose;
                    if (unmatched > 0) {
                        bucket.shortClose += Math.min(unmatched, quantity);
                    }
                }
                // Credit unmatched long open (STC = closing long positions)
                if (orderType === 'STC') {
                    const unmatched = bucket.longOpen - bucket.longClose;
                    if (unmatched > 0) {
                        bucket.longClose += Math.min(unmatched, quantity);
                    }
                }
            });
            return;
        }

        const key = this.buildLegLifecycleKey(leg);
        if (!pairMap.has(key)) {
            pairMap.set(key, {
                longOpen: 0,
                longClose: 0,
                shortOpen: 0,
                shortClose: 0
            });
        }

        const bucket = pairMap.get(key);

        switch (orderType) {
            case 'BTO':
                bucket.longOpen += quantity;
                break;
            case 'STC':
                bucket.longClose += quantity;
                hasCloseActivity = true;
                break;
            case 'STO':
                bucket.shortOpen += quantity;
                break;
            case 'BTC':
                bucket.shortClose += quantity;
                hasCloseActivity = true;
                break;
            default:
                break;
        }

        const rawOrder = (leg.orderType || leg.tradeType || leg.order || '').toString().toUpperCase();
        if (rawOrder.includes('ROLL')) {
            hasRollLegs = true;
        }
        if (rawOrder.includes('ASSIGN') || leg.isAssignment) {
            hasAssignmentEvent = true;
        }
        if (rawOrder.includes('EXPIRE') || rawOrder.includes('EXPIRY')) {
            hasExpirationEvent = true;
        }
    });
    
    // Check if there's an open stock position (stock bought but not sold)
    const hasOpenStockPosition = stockBought > stockSold;

    // When stock was assigned (BTO STOCK), the short puts at the assignment
    // strike are implicitly closed by the exchange.  Credit their close count
    // so that the lifecycle can detect a fully-closed position.
    //
    // If the BTO STOCK leg has no strike recorded (common when brokers don't
    // stamp a strike on the stock transaction), we still mark hasAssignmentEvent
    // true and fall back to crediting unmatched short options proportionally by
    // shares / multiplier.  Without this fallback, a "assign then immediately sell"
    // trade is incorrectly classified as Expired because hasAssignmentEvent stays
    // false and the option expiration date drives the status.
    if (stockBought > 0) {
        hasAssignmentEvent = true;

        if (assignmentStrikes.size > 0) {
            // Preferred path: precise per-strike matching.
            assignmentStrikes.forEach((shares, strike) => {
                // Find pairMap entries for short puts at this strike
                pairMap.forEach((bucket, key) => {
                    // Key format: "TYPE|STRIKE|EXPIRATION|MULTIPLIER"
                    if (!key.startsWith('PUT|')) {
                        return;
                    }
                    const parts = key.split('|');
                    const keyStrike = parseFloat(parts[1]);
                    const multiplier = parseInt(parts[3], 10) || 100;

                    if (!Number.isFinite(keyStrike) || Math.abs(keyStrike - strike) > 0.01) {
                        return;
                    }

                    // How many contracts does this stock assignment cover?
                    const unmatched = bucket.shortOpen - bucket.shortClose;
                    if (unmatched <= 0) {
                        return;
                    }

                    const assignedContracts = Math.min(unmatched, Math.floor(shares / multiplier));
                    if (assignedContracts > 0) {
                        bucket.shortClose += assignedContracts;
                        hasCloseActivity = true;
                    }
                });
            });
        } else {
            // Fallback: no strike info on the BTO STOCK leg.
            // Credit unmatched short put contracts first (put assignment is most
            // common), then short call contracts (covered call assignment).
            let sharesRemaining = stockBought;
            for (const prefix of ['PUT|', 'CALL|']) {
                if (sharesRemaining <= 0) break;
                pairMap.forEach((bucket, key) => {
                    if (!key.startsWith(prefix) || sharesRemaining <= 0) return;
                    const parts = key.split('|');
                    const multiplier = parseInt(parts[3], 10) || 100;
                    const unmatched = bucket.shortOpen - bucket.shortClose;
                    if (unmatched <= 0) return;
                    const assignedContracts = Math.min(unmatched, Math.floor(sharesRemaining / multiplier));
                    if (assignedContracts > 0) {
                        bucket.shortClose += assignedContracts;
                        sharesRemaining -= assignedContracts * multiplier;
                        hasCloseActivity = true;
                    }
                });
            }
        }
    }

    // When all assigned stock has been sold (STC STOCK leg present and
    // stockSold >= stockBought), any remaining unmatched short CALLs in pairMap
    // are implicitly closed — the shares backing those covered calls are gone.
    // This covers scenario 6b (shares called away at CC strike — no explicit BTC
    // leg) and 6a (voluntary stock sale while a CC had already expired OTM).
    //
    // Guard: stockBought > 0 keeps this unreachable for pure-option strategies
    // (Iron Condor, Spreads, PMCC, etc.) where stockBought is always zero.
    if (stockBought > 0 && stockSold >= stockBought) {
        let sharesRemaining = stockSold;
        pairMap.forEach((bucket, key) => {
            if (!key.startsWith('CALL|') || sharesRemaining <= 0) return;
            const parts = key.split('|');
            const multiplier = parseInt(parts[3], 10) || 100;
            const unmatched = bucket.shortOpen - bucket.shortClose;
            if (unmatched <= 0) return;
            const contracts = Math.min(unmatched, Math.floor(sharesRemaining / multiplier));
            if (contracts > 0) {
                bucket.shortClose += contracts;
                sharesRemaining -= contracts * multiplier;
                hasCloseActivity = true;
            }
        });
    }

    let matchedPairs = true;
    let unmatchedExposure = 0;

    pairMap.forEach((bucket) => {
        const longDiff = Math.abs(bucket.longOpen - bucket.longClose);
        const shortDiff = Math.abs(bucket.shortOpen - bucket.shortClose);
        if (longDiff > 0 || shortDiff > 0) {
            matchedPairs = false;
        }
        unmatchedExposure += longDiff + shortDiff;
    });

    const expirationDate = this.parseDateValue(trade.expirationDate || summary.latestExpiration);
    const now = this.currentDate instanceof Date ? this.currentDate : new Date();
    // Options expire at 4 PM ET (market close), not midnight. 
    // Create expiration timestamp at 4 PM ET (16:00) plus 5 hours for UTC offset (21:00 UTC).
    // This ensures positions show as active on expiration day until after market close.
    const expirationWithMarketClose = expirationDate 
        ? new Date(Date.UTC(
            expirationDate.getUTCFullYear(),
            expirationDate.getUTCMonth(),
            expirationDate.getUTCDate(),
            21, // 21:00 UTC = 16:00 ET (4 PM Eastern)
            0,
            0
          ))
        : null;
    const expirationPassed = expirationWithMarketClose ? now.getTime() > expirationWithMarketClose.getTime() : false;

    const lastActivityDate = summary.closedDate instanceof Date
        ? summary.closedDate
        : this.parseDateValue(trade.closedDate || trade.exitDate);
    const activityAfterExpiration = expirationPassed && lastActivityDate && expirationDate
        ? lastActivityDate.getTime() >= expirationDate.getTime()
        : false;

    result.meta = {
        matchedPairs,
        unmatchedExposure,
        expirationPassed,
        hasRollLegs,
        hasCloseActivity,
        hasAssignmentEvent,
        hasExpirationEvent,
        hasCashSettlementEvent,
        activityAfterExpiration,
        hasOpenStockPosition
    };

    const normalizedStatus = this.normalizeStatus(trade.status);
    if (!hasAssignmentEvent && this.isAssignmentTrade(trade)) {
        hasAssignmentEvent = true;
    }

    // Cash-settled assignment (VIX, SPX, etc.): no stock position will ever
    // follow, so the trade is always fully Closed after settlement.
    if (hasCashSettlementEvent) {
        result.status = 'Closed';
        result.exitReason = trade.exitReason || 'Cash Settlement';
        result.openContractsOverride = 0;
        if (!result.effectiveClosedDate && lastActivityDate) {
            result.effectiveClosedDate = lastActivityDate.toISOString().slice(0, 10);
        }
        return result;
    }

    // For Wheel trades: if stock position is still open, don't mark as Assigned/closed
    // The stock keeps the trade open even after option assignment

    // Assignment happened, stock was sold, all positions matched → fully Closed
    if (hasAssignmentEvent && !hasOpenStockPosition && stockBought > 0 && stockSold >= stockBought && (matchedPairs || unmatchedExposure === 0)) {
        result.status = 'Closed';
        result.exitReason = trade.exitReason || 'Assignment resolved';
        result.openContractsOverride = 0;
        if (!result.effectiveClosedDate && lastActivityDate) {
            result.effectiveClosedDate = lastActivityDate.toISOString().slice(0, 10);
        }
        return result;
    }

    // Assignment happened, no open stock, but some option legs still unmatched
    if (hasAssignmentEvent && !hasOpenStockPosition) {
        result.status = 'Assigned';
        result.exitReason = trade.exitReason || 'Assigned';
        result.openContractsOverride = 0;
        if (!result.effectiveClosedDate && lastActivityDate) {
            result.effectiveClosedDate = lastActivityDate.toISOString().slice(0, 10);
        }
        return result;
    }
    
    // Wheel trade with open stock position - stays Open for continued Wheel strategy
    if (hasAssignmentEvent && hasOpenStockPosition) {
        result.status = 'Open';
        result.exitReason = null;
        // Don't set openContractsOverride - position is still active
        return result;
    }

    if (matchedPairs || unmatchedExposure === 0) {
        // Even if all options matched, if stock is still held, position is Open (Wheel)
        if (hasOpenStockPosition) {
            result.status = 'Open';
            return result;
        }
        result.status = 'Closed';
        if (hasExpirationEvent && !trade.exitReason) {
            result.exitReason = 'Expired OTM';
        }
        result.openContractsOverride = 0;
        if (!result.effectiveClosedDate && lastActivityDate) {
            result.effectiveClosedDate = lastActivityDate.toISOString().slice(0, 10);
        }
        return result;
    }

    // For Wheel trades with open stock, option expiration doesn't close the position
    // The stock is still held and can have new covered calls written
    if (expirationPassed && !hasAssignmentEvent && !hasOpenStockPosition) {
        result.status = 'Expired';
        if (!trade.exitReason) {
            result.exitReason = 'Expired OTM';
        }
        result.openContractsOverride = 0;
        if (expirationDate) {
            result.effectiveClosedDate = expirationDate.toISOString().slice(0, 10);
        }
        return result;
    }

    if (hasRollLegs || (hasCloseActivity && unmatchedExposure > 0)) {
        result.status = 'Rolling';
        return result;
    }

    if (activityAfterExpiration && !hasAssignmentEvent && !hasOpenStockPosition) {
        result.status = 'Closed';
        if (!trade.exitReason) {
            result.exitReason = 'Closed post-expiration';
        }
        result.openContractsOverride = 0;
        if (lastActivityDate) {
            result.effectiveClosedDate = lastActivityDate.toISOString().slice(0, 10);
        }
        return result;
    }

    // Wheel trades with open stock: even if status was explicitly set to expired, 
    // stock position keeps the trade open
    if (normalizedStatus === 'expired' && expirationDate && !hasOpenStockPosition) {
        result.status = 'Expired';
        result.openContractsOverride = 0;
        if (!trade.exitReason) {
            result.exitReason = 'Expired OTM';
        }
        if (!result.effectiveClosedDate) {
            result.effectiveClosedDate = expirationDate.toISOString().slice(0, 10);
        }
        return result;
    }

    result.status = 'Open';
    return result;
}

export function enrichTradeData(trade) {
    const enriched = { ...trade };
    delete enriched.optionType;

    const rawStrategy = (enriched.strategy || '').toString().trim();
    enriched.strategy = this.getStrategyDisplayName(rawStrategy);

    enriched.underlyingType = this.normalizeUnderlyingType(trade.underlyingType, { fallback: 'Stock' });

    const legSummary = this.summarizeLegs(enriched.legs);
    enriched.legs = legSummary.legs;
    enriched.legsCount = legSummary.legsCount;
    enriched.openContracts = Math.max(0, legSummary.openContracts - legSummary.closeContracts);
    enriched.closeContracts = legSummary.closeContracts;
    enriched.openLegs = Math.max(0, legSummary.openLegs - legSummary.closeLegs);
    enriched.rollLegs = legSummary.rollLegs;
    enriched.totalFees = Number(legSummary.totalFees.toFixed(4));
    enriched.totalDebit = Number(legSummary.totalDebit.toFixed(2));
    enriched.totalCredit = Number(legSummary.totalCredit.toFixed(2));
    enriched.cashFlow = Number(legSummary.cashFlow.toFixed(2));
    const initialCapitalAtRisk = Number(legSummary.capitalAtRisk);
    enriched.capitalAtRisk = Number.isFinite(initialCapitalAtRisk)
        ? Number(initialCapitalAtRisk.toFixed(2))
        : initialCapitalAtRisk;
    enriched.fees = enriched.totalFees;
    enriched.primaryLeg = legSummary.primaryLeg;

    const userRiskOverride = Number(trade.maxRiskOverride);
    if (Number.isFinite(userRiskOverride) && userRiskOverride > 0) {
        enriched.maxRiskOverride = userRiskOverride;
    } else {
        enriched.maxRiskOverride = null;
    }

    const primaryLeg = legSummary.primaryLeg;
    enriched.tradeType = this.deriveTradeTypeFromLeg(primaryLeg);
    enriched.tradeDirection = this.deriveTradeDirectionFromLeg(primaryLeg);

    // For trades with stock assignments, use total stock shares as quantity
    const openLegsForStock = legSummary.legs.filter(leg => this.getLegSide(leg) === 'OPEN');
    const stockLegs = openLegsForStock.filter(leg => leg.type === 'STOCK');
    
    if (stockLegs.length > 0) {
        // Sum only OPEN stock shares (currently held)
        const totalShares = stockLegs.reduce((sum, leg) => {
            const quantity = leg.quantity * this.getLegMultiplier(leg);
            return sum + (this.getLegAction(leg) === 'BUY' ? quantity : -quantity);
        }, 0);
        const absShares = Math.abs(Math.round(totalShares));
        // Only use stock quantity if there are actually shares held
        if (absShares > 0) {
            enriched.quantity = absShares;
        } else {
            // Fall back to primary leg for closed stock trades
            const normalizedQuantity = primaryLeg ? Math.abs(Number(primaryLeg.quantity) || 0) : 0;
            enriched.quantity = enriched.tradeDirection === 'short' ? -normalizedQuantity : normalizedQuantity;
        }
    } else {
        // Sum quantities from all opening legs of the same type as primary leg
        // This handles split orders that were filled in multiple parts
        const primaryType = (primaryLeg?.type || '').toUpperCase();
        const primaryStrike = Number(primaryLeg?.strike) || 0;
        const primaryExpiration = primaryLeg?.expirationDate || '';
        
        const matchingOpenLegs = openLegsForStock.filter(leg => {
            const type = (leg.type || '').toUpperCase();
            const strike = Number(leg.strike) || 0;
            const expiration = leg.expirationDate || '';
            return type === primaryType && strike === primaryStrike && expiration === primaryExpiration;
        });
        
        let totalQuantity = 0;
        if (matchingOpenLegs.length > 0) {
            totalQuantity = matchingOpenLegs.reduce((sum, leg) => sum + Math.abs(Number(leg.quantity) || 0), 0);
        } else {
            // Fall back to primary leg quantity
            totalQuantity = primaryLeg ? Math.abs(Number(primaryLeg.quantity) || 0) : 0;
        }
        
        enriched.quantity = enriched.tradeDirection === 'short' ? -totalQuantity : totalQuantity;
    }
    
    enriched.strikePrice = this.derivePrimaryStrike(legSummary);
    enriched.multiplier = this.getLegMultiplier(primaryLeg);
    enriched.displayStrike = this.buildStrikeDisplay(enriched, legSummary);

    const activeStrike = this.getActiveStrikeForDisplay(legSummary);
    enriched.activeStrikePrice = Number.isFinite(activeStrike) ? Number(activeStrike) : null;

    const entryPrice = legSummary.entryPrice;
    const exitPrice = legSummary.exitPrice;
    enriched.entryPrice = Number.isFinite(entryPrice) ? Number(entryPrice.toFixed(4)) : null;
    enriched.exitPrice = Number.isFinite(exitPrice) ? Number(exitPrice.toFixed(4)) : null;

    const riskInfo = this.assessRisk(enriched, legSummary);
    if (enriched.maxRiskOverride) {
        riskInfo.maxRiskValue = enriched.maxRiskOverride;
        riskInfo.maxRiskLabel = this.formatCurrency(enriched.maxRiskOverride);
        riskInfo.unlimited = false;
        legSummary.capitalAtRisk = enriched.maxRiskOverride;
    }

    enriched.capitalAtRisk = riskInfo.maxRiskValue;
    if (Number.isFinite(enriched.capitalAtRisk)) {
        enriched.capitalAtRisk = Number(enriched.capitalAtRisk.toFixed(2));
    }
    enriched.maxRiskLabel = riskInfo.maxRiskLabel;
    enriched.riskIsUnlimited = riskInfo.unlimited;

    const openedDate = this.parseDateValue(enriched.openedDate || enriched.entryDate || legSummary.openedDate);
    const closedDate = this.parseDateValue(enriched.closedDate || enriched.exitDate || (legSummary.closeLegs > 0 ? legSummary.closedDate : null));

    let expirationDate = this.parseDateValue(enriched.expirationDate);
    if (!expirationDate && legSummary.latestExpiration) {
        expirationDate = legSummary.latestExpiration;
    }

    const pmccShortExpiration = legSummary.nextShortCallExpiration || legSummary.nearestShortCallExpiration || null;
    if (this.isPmccTrade(enriched) && pmccShortExpiration) {
        expirationDate = pmccShortExpiration;
    }

    if (!this.isPmccTrade(enriched) && this.isWheelOrPmccTrade(enriched) && pmccShortExpiration) {
        const hasActiveOptions = this.hasNetOpenOptionLegs({ ...enriched, legs: legSummary.legs });
        if (hasActiveOptions) {
            expirationDate = pmccShortExpiration;
        }
    }

    enriched.pmccShortExpiration = pmccShortExpiration ? pmccShortExpiration.toISOString().slice(0, 10) : '';
    enriched.longExpirationDate = legSummary.latestExpiration ? legSummary.latestExpiration.toISOString().slice(0, 10) : '';

    enriched.openedDate = openedDate ? openedDate.toISOString().slice(0, 10) : '';
    enriched.closedDate = closedDate ? closedDate.toISOString().slice(0, 10) : '';
    enriched.entryDate = enriched.openedDate;
    enriched.exitDate = enriched.closedDate;
    enriched.expirationDate = expirationDate ? expirationDate.toISOString().slice(0, 10) : '';

    enriched.pl = this.calculatePL(enriched);
    enriched.roi = this.calculateROI(enriched);
    enriched.maxRisk = this.calculateMaxRisk(enriched);
    if (!enriched.maxRiskLabel) {
        enriched.maxRiskLabel = Number.isFinite(enriched.maxRisk)
            ? this.formatCurrency(enriched.maxRisk)
            : enriched.maxRisk === Number.POSITIVE_INFINITY
                ? 'Unlimited'
                : '—';
    }

    const lifecycle = this.determineTradeLifecycleStatus(enriched, legSummary);
    enriched.lifecycleMeta = lifecycle.meta;
    enriched.lifecycleStatus = lifecycle.status;

    // Wheel/PMCC coverage tag — independent descriptive field.
    enriched.wheelCoverage = this.getTradeWheelCoverage(enriched);

    // Awaiting-coverage flag: assigned wheel/PMCC with shares held and NO
    // active short call. Surfaced only in the Wheel/PMCC tracker, not Active
    // Trades. Partially-covered trades (≥1 active short call) keep their
    // normal lifecycle so the active CC remains visible in Active Trades.
    if (enriched.wheelCoverage === 'uncovered') {
        enriched.lifecycleStatus = 'awaiting_coverage';
    }

    // Mark-to-market unrealized P&L for any open wheel/PMCC trade with held
    // exposure (stock shares, or LEAP for PMCC). Without this, raw cashflow
    // includes the stock purchase cost and shows a phantom loss equal to the
    // share value. Applies to all coverage states (covered / partial /
    // uncovered) and to status='Assigned'. Closed trades are skipped — their
    // pl is the realized cashflow which is already correct.
    const heldStockShares = this.getTradeOpenStockShares(enriched);
    const heldLongCallContracts = this.isPmccTrade(enriched)
        ? this.getNetOpenLongCallContracts(enriched)
        : 0;
    const hasHeldExposure = !this.isClosedStatus(enriched.status)
        && (heldStockShares > 0 || heldLongCallContracts > 0);

    if (hasHeldExposure) {
        const cb = this.computeWheelEffectiveCostBasis(enriched);
        enriched.shares = cb.shares;
        enriched.effectiveCostBasis = Number.isFinite(cb.effectiveCostBasis)
            ? Number(cb.effectiveCostBasis.toFixed(2))
            : null;

        // Resolve a current price for MTM. Priority:
        //  1. persisted marketPriceSnapshot (last save)
        //  2. live Finnhub quote cache (if available in memory)
        //  3. fallback: assignment cost-per-share (≈ entry strike) — conservative,
        //     pretends stock hasn't moved. Triggers a one-time warning so the
        //     user knows the number is a placeholder until a real quote loads.
        let resolvedPrice = Number(trade.marketPriceSnapshot);
        let priceSource = 'snapshot';
        if (!Number.isFinite(resolvedPrice) || resolvedPrice <= 0) {
            const ticker = (trade.ticker || '').toString().trim().toUpperCase();
            const cachedQuote = this.getCachedQuote ? this.getCachedQuote(ticker) : null;
            const livePrice = Number(cachedQuote?.value?.price);
            if (Number.isFinite(livePrice) && livePrice > 0) {
                resolvedPrice = livePrice;
                priceSource = 'live';
            } else if (cb.shares > 0 && Number.isFinite(cb.assignmentCostBasis) && cb.assignmentCostBasis > 0) {
                resolvedPrice = cb.assignmentCostBasis / cb.shares;
                priceSource = 'fallback-strike';
                if (!this._wheelPriceFallbackWarned) {
                    console.warn('[GammaLedger] No market price for wheel/PMCC position(s); falling back to entry strike for unrealized P&L. Set Finnhub API key in Settings for live quotes.');
                    this._wheelPriceFallbackWarned = true;
                }
            }
        }

        if (Number.isFinite(resolvedPrice) && resolvedPrice > 0 && cb.shares > 0 && Number.isFinite(cb.effectiveCostBasis)) {
            const marketValue = resolvedPrice * cb.shares;
            const unrealizedPL = marketValue - cb.effectiveCostBasis;
            enriched.marketValue = Number(marketValue.toFixed(2));
            enriched.unrealizedPL = Number(unrealizedPL.toFixed(2));
            enriched.marketPriceSource = priceSource;
            // Override raw cashflow-based pl so dashboards & MCP report the
            // mark-to-market figure for held-stock positions.
            enriched.pl = enriched.unrealizedPL;
            enriched.roi = cb.effectiveCostBasis !== 0
                ? Number(((unrealizedPL / cb.effectiveCostBasis) * 100).toFixed(2))
                : 0;
        } else {
            enriched.marketValue = null;
            enriched.unrealizedPL = null;
            enriched.marketPriceSource = null;
            if (enriched.lifecycleStatus === 'awaiting_coverage') {
                // Keep historical behavior: hide phantom cashflow loss.
                enriched.pl = 0;
                enriched.roi = 0;
            }
            // For covered/assigned without any price hint, leave pl as cashFlow.
        }
    } else {
        enriched.shares = null;
        enriched.effectiveCostBasis = null;
        enriched.marketValue = null;
        enriched.unrealizedPL = null;
    }

    if (typeof lifecycle.openContractsOverride === 'number') {
        enriched.openContracts = Math.max(0, lifecycle.openContractsOverride);
    }

    if (lifecycle.effectiveClosedDate) {
        enriched.closedDate = lifecycle.effectiveClosedDate;
        enriched.exitDate = lifecycle.effectiveClosedDate;
    }

    if (lifecycle.exitReason && !enriched.exitReason) {
        enriched.exitReason = lifecycle.exitReason;
    }

    enriched.partialClose = Boolean(lifecycle.meta?.hasCloseActivity && lifecycle.meta?.unmatchedExposure > 0);
    enriched.rolledForward = Boolean(lifecycle.meta?.hasRollLegs);
    enriched.autoExpired = lifecycle.status === 'Expired' && Boolean(lifecycle.meta?.expirationPassed);

    const manualStatus = this.normalizeTradeStatusInput(trade.statusOverride);
    if (manualStatus) {
        enriched.statusOverride = manualStatus;
        enriched.status = manualStatus;
    } else {
        if ('statusOverride' in enriched) {
            delete enriched.statusOverride;
        }
        enriched.status = lifecycle.status;
    }

    enriched.daysHeld = this.calculateDaysHeld(enriched);
    enriched.dte = this.calculateDTE(enriched.expirationDate, enriched);
    enriched.weeklyROI = this.calculateWeeklyROI(enriched);
    enriched.monthlyROI = this.calculateMonthlyROI(enriched);
    enriched.annualizedROI = this.calculateAnnualizedROI(enriched);

    return enriched;
}

export function getPrimaryLeg(trade = {}) {
    if (trade.primaryLeg && trade.primaryLeg.id) {
        return this.normalizeLeg(trade.primaryLeg);
    }
    if (Array.isArray(trade.legs) && trade.legs.length > 0) {
        const candidates = trade.legs.map((leg, index) => this.normalizeLeg(leg, index));
        const firstOpen = candidates.find(leg => this.getLegSide(leg) === 'OPEN') || candidates[0];
        return firstOpen;
    }
    return null;
}

export function deriveTradeTypeFromLeg(leg) {
    if (!leg) {
        return 'BTO';
    }
    const action = this.getLegAction(leg);
    const side = this.getLegSide(leg);
    if (action === 'BUY' && side === 'OPEN') {
        return 'BTO';
    }
    if (action === 'SELL' && side === 'OPEN') {
        return 'STO';
    }
    if (action === 'SELL' && side === 'CLOSE') {
        return 'STC';
    }
    if (action === 'BUY' && side === 'CLOSE') {
        return 'BTC';
    }
    // ROLL legs inherit previous action semantics
    return action === 'SELL' ? 'STO' : 'BTO';
}

export function deriveTradeDirectionFromLeg(leg) {
    if (!leg) {
        return 'long';
    }
    const action = this.getLegAction(leg);
    if (action === 'SELL') {
        return 'short';
    }
    return 'long';
}

export function getTradeType(trade) {
    const primaryLeg = this.getPrimaryLeg(trade);
    return this.deriveTradeTypeFromLeg(primaryLeg);
}

export function inferTradeDirection(trade) {
    const primaryLeg = this.getPrimaryLeg(trade);
    return this.deriveTradeDirectionFromLeg(primaryLeg);
}
