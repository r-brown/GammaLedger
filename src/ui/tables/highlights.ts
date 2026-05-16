// src/ui/tables/highlights.ts — Wave 9: Row highlight utilities (ITM, expiry).
// Uses the .call(this, …) delegation pattern.

type TradeRecord = Record<string, unknown>

interface HighlightsContext {
  positionHighlightConfig: { expirationWarningDays: number; expirationCriticalDays: number }
  parseInteger(value: unknown, fallback: unknown, opts?: { allowNegative?: boolean }): number | null
  parseDecimal(value: unknown, fallback: unknown, opts?: { allowNegative?: boolean }): number | null
  isInTheMoney(trade: TradeRecord, currentPrice: number | null, row: HTMLTableRowElement): boolean
  updateExpirationHighlight(cell: HTMLTableCellElement, trade: TradeRecord): void
  isWheelOrPmccTrade(trade: TradeRecord): boolean
  summarizeLegs(legs: unknown[]): Record<string, unknown>
  getLegAction(leg: Record<string, unknown>): string
  getLegSide(leg: Record<string, unknown>): string
  getActiveStrikeForDisplay(summary: Record<string, unknown>): number | null
  derivePrimaryStrike(summary: Record<string, unknown>): number | null
  resolveStrikeForHighlight(trade: TradeRecord, row: HTMLTableRowElement): number | null
  inferOptionFlavor(trade: TradeRecord): 'call' | 'put' | null
  updateItmHighlight(row: HTMLTableRowElement, trade: TradeRecord, currentPrice: number | null): void
}

export function applyPositionHighlight(
    this: HighlightsContext,
    row: HTMLTableRowElement,
    trade: TradeRecord,
    currentPrice: number | null = null
): void {
    if (!row) {
        return;
    }
    // Find the DTE cell (5th cell, index 4) to apply expiration highlighting
    const dteCell = row.cells?.[4] as HTMLTableCellElement | undefined;
    if (dteCell) {
        this.updateExpirationHighlight(dteCell, trade);
    }
    this.updateItmHighlight(row, trade, currentPrice);
}

export function updateExpirationHighlight(
    this: HighlightsContext,
    cell: HTMLTableCellElement,
    trade: TradeRecord
): void {
    if (!cell) {
        return;
    }

    cell.classList.remove('position-expiring-critical', 'position-expiring-warning');

    const warningThreshold = this.positionHighlightConfig?.expirationWarningDays ?? 20;
    const criticalThreshold = this.positionHighlightConfig?.expirationCriticalDays ?? 10;
    const rawDte = trade?.dte;
    const dteValue = this.parseInteger(rawDte, null, { allowNegative: true });

    if (!Number.isFinite(dteValue) || (dteValue as number) < 0) {
        return;
    }

    if ((dteValue as number) < criticalThreshold) {
        cell.classList.add('position-expiring-critical');
    } else if ((dteValue as number) < warningThreshold) {
        cell.classList.add('position-expiring-warning');
    }
}

export function updateItmHighlight(
    this: HighlightsContext,
    row: HTMLTableRowElement,
    trade: TradeRecord,
    currentPrice: number | null
): void {
    if (!row) {
        return;
    }
    const isItm = this.isInTheMoney(trade, currentPrice, row);
    row.classList.toggle('position-itm', Boolean(isItm));
}

export function resolveStrikeForHighlight(
    this: HighlightsContext,
    trade: TradeRecord,
    row: HTMLTableRowElement
): number | null {
    const candidateValues: unknown[] = [];

    if ((row as HTMLElement & { dataset: DOMStringMap }).dataset?.strikePrice !== undefined) {
        candidateValues.push((row as HTMLElement & { dataset: DOMStringMap }).dataset.strikePrice);
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

    if (trade && Array.isArray(trade.legs) && (trade.legs as unknown[]).length > 0) {
        const summary = this.summarizeLegs(trade.legs as unknown[]);
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

export function isInTheMoney(
    this: HighlightsContext,
    trade: TradeRecord,
    currentPrice: number | null,
    row: HTMLTableRowElement
): boolean {
    if (!Number.isFinite(currentPrice)) {
        return false;
    }
    // currentPrice is finite at this point
    const price = currentPrice as number;

    if (trade && this.isWheelOrPmccTrade(trade)) {
        const summary = this.summarizeLegs((trade.legs as unknown[]) || []);
        const normalizedLegs = Array.isArray(summary.legs) ? (summary.legs as Record<string, unknown>[]) : [];
        const netShort = new Map<string, number>();

        // Track stock legs to detect PUT assignments
        const stockAssignments = new Map<number, number>();
        normalizedLegs.forEach((leg) => {
            const type = ((leg?.type || leg?.optionType || '') as string).toString().trim().toUpperCase();
            if (type === 'STOCK') {
                const action = this.getLegAction(leg);
                if (action === 'BUY') {
                    const strike = this.parseDecimal(leg?.strike, null, { allowNegative: false });
                    if (Number.isFinite(strike)) {
                        const quantity = Math.abs(Number(leg?.quantity) || 0);
                        const contracts = Math.floor(quantity / 100);
                        if (contracts > 0) {
                            stockAssignments.set(strike as number, (stockAssignments.get(strike as number) || 0) + contracts);
                        }
                    }
                }
            }
        });

        normalizedLegs.forEach((leg) => {
            const type = ((leg?.type || leg?.optionType || '') as string).toString().trim().toUpperCase();
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
            const key = `${type}|${strike as number}|${(leg?.expirationDate as string) || ''}`;

            if (action === 'SELL' && (side === 'OPEN' || side === 'ROLL')) {
                netShort.set(key, (netShort.get(key) || 0) + quantity);
            } else if (action === 'BUY' && side === 'CLOSE') {
                netShort.set(key, (netShort.get(key) || 0) - quantity);
            }
        });

        // Reduce PUT net short counts by stock assignments at the same strike
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
            const isLegItm = type === 'CALL'
                ? price > strike
                : price < strike;
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
        return price > (strike as number);
    }
    if (flavor === 'put') {
        return price < (strike as number);
    }
    return false;
}

