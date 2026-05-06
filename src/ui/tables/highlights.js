// src/ui/tables/highlights.js — Wave 9: Row highlight utilities (ITM, expiry).
// Uses the .call(this, …) delegation pattern.

export function applyPositionHighlight(row, trade, currentPrice = null) {
    if (!row) {
        return;
    }
    // Find the DTE cell (5th cell, index 4) to apply expiration highlighting
    const dteCell = row.cells?.[4];
    if (dteCell) {
        this.updateExpirationHighlight(dteCell, trade);
    }
    this.updateItmHighlight(row, trade, currentPrice);
}

export function updateExpirationHighlight(cell, trade) {
    if (!cell) {
        return;
    }

    cell.classList.remove('position-expiring-critical', 'position-expiring-warning');

    const warningThreshold = this.positionHighlightConfig?.expirationWarningDays ?? 20;
    const criticalThreshold = this.positionHighlightConfig?.expirationCriticalDays ?? 10;
    const rawDte = trade?.dte;
    const dteValue = this.parseInteger(rawDte, null, { allowNegative: true });

    if (!Number.isFinite(dteValue) || dteValue < 0) {
        return;
    }

    if (dteValue < criticalThreshold) {
        cell.classList.add('position-expiring-critical');
    } else if (dteValue < warningThreshold) {
        cell.classList.add('position-expiring-warning');
    }
}

export function updateItmHighlight(row, trade, currentPrice) {
    if (!row) {
        return;
    }
    const isItm = this.isInTheMoney(trade, currentPrice, row);
    row.classList.toggle('position-itm', Boolean(isItm));
}

export function resolveStrikeForHighlight(trade, row) {
    const candidateValues = [];

    if (row?.dataset?.strikePrice !== undefined) {
        candidateValues.push(row.dataset.strikePrice);
    }

    if (trade) {
        candidateValues.push(
            trade.activeStrikePrice,
            trade.strikePrice,
            trade.primaryStrike,
            trade.shortStrike,
            trade.longStrike
        );
    }

    for (const candidate of candidateValues) {
        const numeric = this.parseDecimal(candidate, null, { allowNegative: false });
        if (Number.isFinite(numeric)) {
            return numeric;
        }
    }

    if (trade && Array.isArray(trade.legs) && trade.legs.length > 0) {
        const summary = this.summarizeLegs(trade.legs);
        const activeStrike = this.getActiveStrikeForDisplay(summary);
        if (Number.isFinite(activeStrike)) {
            return activeStrike;
        }
        const primaryStrike = this.derivePrimaryStrike(summary);
        if (Number.isFinite(primaryStrike)) {
            return primaryStrike;
        }
    }

    return null;
}

export function isInTheMoney(trade, currentPrice, row) {
    if (!Number.isFinite(currentPrice)) {
        return false;
    }

    if (trade && this.isWheelOrPmccTrade(trade)) {
        const summary = this.summarizeLegs(trade.legs || []);
        const normalizedLegs = Array.isArray(summary.legs) ? summary.legs : [];
        const netShort = new Map();

        // Track stock legs to detect PUT assignments
        // When a PUT is assigned, a BTO STOCK appears at the same strike
        const stockAssignments = new Map();
        normalizedLegs.forEach((leg) => {
            const type = (leg?.type || leg?.optionType || '').toString().trim().toUpperCase();
            if (type === 'STOCK') {
                const action = this.getLegAction(leg);
                if (action === 'BUY') {
                    // BTO STOCK indicates PUT assignment at the strike price
                    const strike = this.parseDecimal(leg?.strike, null, { allowNegative: false });
                    if (Number.isFinite(strike)) {
                        const quantity = Math.abs(Number(leg?.quantity) || 0);
                        // Convert shares to contracts (100 shares = 1 contract)
                        const contracts = Math.floor(quantity / 100);
                        if (contracts > 0) {
                            stockAssignments.set(strike, (stockAssignments.get(strike) || 0) + contracts);
                        }
                    }
                }
            }
        });

        normalizedLegs.forEach((leg) => {
            const type = (leg?.type || leg?.optionType || '').toString().trim().toUpperCase();
            if (!['CALL', 'PUT'].includes(type)) {
                return;
            }

            const strike = this.parseDecimal(leg?.strike, null, { allowNegative: false });
            if (!Number.isFinite(strike)) {
                return;
            }

            const quantity = Math.abs(Number(leg?.quantity) || 0);
            if (!quantity) {
                return;
            }

            const action = this.getLegAction(leg);
            const side = this.getLegSide(leg);
            const key = `${type}|${strike}|${leg?.expirationDate || ''}`;

            if (action === 'SELL' && (side === 'OPEN' || side === 'ROLL')) {
                netShort.set(key, (netShort.get(key) || 0) + quantity);
            } else if (action === 'BUY' && side === 'CLOSE') {
                netShort.set(key, (netShort.get(key) || 0) - quantity);
            }
        });

        // Reduce PUT net short counts by stock assignments at the same strike
        // This handles PUT assignments where BTO STOCK closes the PUT position
        for (const [key, netQty] of netShort.entries()) {
            if (netQty <= 0) {
                continue;
            }
            const [type, strikeValue] = key.split('|');
            if (type !== 'PUT') {
                continue;
            }
            const strike = Number(strikeValue);
            if (!Number.isFinite(strike)) {
                continue;
            }
            const assignedContracts = stockAssignments.get(strike) || 0;
            if (assignedContracts > 0) {
                const newNetQty = Math.max(0, netQty - assignedContracts);
                netShort.set(key, newNetQty);
                // Reduce the available assignments for this strike
                stockAssignments.set(strike, Math.max(0, assignedContracts - netQty));
            }
        }

        for (const [key, netQty] of netShort.entries()) {
            if (netQty <= 0) {
                continue;
            }
            const [type, strikeValue] = key.split('|');
            const strike = Number(strikeValue);
            if (!Number.isFinite(strike)) {
                continue;
            }
            // For SHORT positions: CALL is ITM when price > strike, PUT is ITM when price < strike
            const isLegItm = type === 'CALL'
                ? currentPrice > strike
                : currentPrice < strike;
            if (isLegItm) {
                return true;
            }
        }
    }

    const strike = this.resolveStrikeForHighlight(trade, row);
    if (!Number.isFinite(strike)) {
        return false;
    }

    const flavor = this.inferOptionFlavor(trade);
    if (flavor === 'call') {
        return currentPrice > strike;
    }
    if (flavor === 'put') {
        return currentPrice < strike;
    }
    return false;
}
