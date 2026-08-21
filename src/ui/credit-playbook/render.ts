// src/ui/credit-playbook/render.ts — Wave 9: Credit playbook rendering.
// Uses the .call(this, …) delegation pattern.

import {
  createGrid,
  type ColumnState,
  type ColDef,
  type GridApi,
  type GridOptions,
  type ICellRendererParams,
  type SortChangedEvent
} from '../tables/ag-grid.js'
import { renderTradeBreakdownColumn, type BreakdownTrade } from '../tables/trade-breakdown-column.js'

type TradeRecord = Record<string, unknown>
type LegRecord = Record<string, unknown>
const SORT_LOW_VALUE = -Number.MAX_SAFE_INTEGER
const SORT_HIGH_VALUE = Number.MAX_SAFE_INTEGER

function numericSortValue(value: unknown, fallback: number): number {
    if (value === null || value === undefined || value === '') {
        return fallback;
    }
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
}

interface LegPair {
  tradeId?: string
  ticker?: string
  strategy?: string
  type?: string
  strike?: number | string
  isOpen?: boolean
  isAssigned?: boolean
  wasAssigned?: boolean
  isRolling?: boolean
  isExpired?: boolean
  expiredWithoutClose?: boolean
  isCreditAggregate?: boolean
  aggregateKind?: 'wheel' | 'covered-call' | 'cash-secured-put'
  heldShares?: number
  openCallContracts?: number
  realizedOptionPL?: number
  unrealizedOptionPL?: number
  hasRealizedOptionActivity?: boolean
  childPairs?: LegPair[]
  trade?: TradeRecord
  _isDetailRow?: boolean
  _parentPair?: LegPair
  quantity?: number
  pricePerContract?: number
  fees?: number
  premium?: number
  optionPL?: number
  stockPL?: number
  realizedStockPL?: number
  unrealizedStockPL?: number
  allInPL?: number
  pl?: number
  roi?: number
  dte?: number
  entryDate?: Date | unknown
  expirationDate?: unknown
  exitDate?: Date | unknown
  daysHeld?: number
  currentPrice?: number
  capital?: number
  [key: string]: unknown
}

interface CreditPlaybookEntry {
  trade: TradeRecord
  ticker: string
  strategy: string
  dte: number | null
  premium: number
  capitalAtRisk: number | null
  contracts: number
  expirationLabel: string
  summary: Record<string, unknown>
  [key: string]: unknown
}

interface CreditPlaybookRenderContext {
  trades: TradeRecord[]
  currentDate: Date | unknown
  creditPlaybookStatus: string
  creditPlaybookStrategies: string[]
  creditPlaybookHorizon: string
  creditPlaybookSymbol: string
  creditPlaybookSort: { key: string; direction: string }
  creditPlaybookGridApi?: GridApi<LegPair> | null
  creditPlaybookGridState?: { filterModel: Record<string, unknown>; columnState: ColumnState[] } | null
  creditPlaybookExpandedTradeId: string | null
  creditPlaybookRows: LegPair[]
  positionHighlightConfig: { expirationCriticalDays: number }
  creditPlaybookQuoteEntries?: Map<string, Record<string, unknown>>
  creditPlaybookQuoteRefreshSuppressed: boolean
  getLegAction(leg: LegRecord): string
  formatNumber(value: unknown, opts: Record<string, unknown>): string | null
  formatCurrency(value: unknown, opts?: Record<string, unknown>): string
  formatDate(value: unknown): string
  createCreditStage(label: string, variant?: string): HTMLElement
  createTickerElement(ticker: unknown, className?: string, opts?: Record<string, unknown>): HTMLElement
  openTradesFilteredByTicker(ticker: unknown): void
  normalizeCreditPlaybookStrategyValue(strategy: unknown): string | null
  normalizeCreditPlaybookStrategyValue(strategy: string | null): string | null
  normalizeStatus(status: unknown): string
  isClosedStatus(status: unknown): boolean
  getDisplayStatus(trade: TradeRecord): string
  summarizeLegs(legs: unknown[]): Record<string, unknown>
  parseInteger(value: unknown, fallback: unknown, opts?: { allowNegative?: boolean }): number | null
  parseDecimal(value: unknown, fallback: unknown, opts?: { allowNegative?: boolean }): number | null
  parseDateValue(value: unknown): Date | null
  resolveCreditPlaybookOpenedAt(trade: TradeRecord, summary: Record<string, unknown>): Date | null
  deriveCreditPlaybookPrice(trade: TradeRecord): number | null
  getCapitalAtRisk(trade: TradeRecord): number | null
  getNetOpenOptionContracts(legs: unknown[]): number
  getSortableValue(entry: Record<string, unknown>, key: string): unknown
  compareSortableValues(a: unknown, b: unknown): number
  populateQuoteCell(cell: HTMLElement, trade: TradeRecord, row: HTMLElement, opts: Record<string, unknown>): void
  updateExpirationHighlight(cell: HTMLElement, trade: TradeRecord): void
  applyResponsiveLabels(row: HTMLTableRowElement, labels: string[]): void
  startQuoteAutoRefreshIfNeeded(): void
  refreshCreditPlaybookQuotes(opts: { force?: boolean; immediate?: boolean; manual?: boolean; prime?: boolean }): void
  renderSchwabTradeQuoteCell(cell: HTMLElement, trade: TradeRecord): HTMLElement
  extractSpreadPair(trade: TradeRecord, legs: unknown[], now: Date, pairs: LegPair[]): void
  extractIndividualLegPairs(trade: TradeRecord, legs: unknown[], now: Date, pairs: LegPair[]): void
  filterCreditPlaybookEntries(entries: CreditPlaybookEntry[]): CreditPlaybookEntry[]
  filterCreditPlaybookLegPairs(pairs: LegPair[]): LegPair[]
  renderCreditPlaybookMetrics(pairs: LegPair[]): void
  renderCreditPlaybookTableFromLegPairs(pairs: LegPair[]): void
  applyCreditPlaybookSortIndicators(): void
  applyCreditPlaybookSortToLegPairs(pairs: LegPair[]): LegPair[]
  applyCreditPlaybookSort(entries: CreditPlaybookEntry[]): CreditPlaybookEntry[]
  isCreditStrategyTrade(trade: TradeRecord): boolean
  mapCreditTradeToEntry(trade: TradeRecord): CreditPlaybookEntry | null
}

export function renderCreditPlaybookDetailCell(this: CreditPlaybookRenderContext, cell: HTMLTableCellElement, entry: CreditPlaybookEntry): void {
    cell.innerHTML = '';

    const stageContainer = document.createElement('div');
    stageContainer.className = 'credit-stage-group';
    cell.appendChild(stageContainer);

    const summary = entry.summary;
    const primaryLeg = summary?.primaryLeg as LegRecord | undefined;

    if (primaryLeg) {
        const action = this.getLegAction(primaryLeg) || '';
        const type = ((primaryLeg.type || '') as string).toUpperCase();
        const strike = Number(primaryLeg.strike);
        const expiration = primaryLeg.expirationDate as string | undefined;

        const actionLabel = action ? `${action.charAt(0)}${action.slice(1).toLowerCase()}` : '';
        let stageLabel = actionLabel;

        if (Number.isFinite(strike) && ['CALL', 'PUT'].includes(type)) {
            const formattedStrike = this.formatNumber(strike, { decimals: 2, useGrouping: false }) ?? strike.toFixed(2);
            const typeSuffix = type === 'CALL' ? 'C' : 'P';
            stageLabel = `${stageLabel ? `${stageLabel} ` : ''}${formattedStrike}${typeSuffix}`;

            if (expiration) {
                const expText = this.formatDate(expiration);
                if (expText && expText !== '—') {
                    stageLabel += ` ${expText}`;
                }
            }
        } else if (type) {
            stageLabel = `${stageLabel ? `${stageLabel} ` : ''}${type}`;
        }

        stageContainer.appendChild(this.createCreditStage(stageLabel || entry.strategy, 'primary'));
    } else {
        stageContainer.appendChild(this.createCreditStage(entry.strategy || entry.ticker, 'primary'));
    }

    if (summary && (summary.legsCount as number) > 1) {
        const legTypeBreakdown: string[] = [];
        if ((summary.openLegs as number) > 0) legTypeBreakdown.push(`${summary.openLegs} open`);
        if ((summary.closeLegs as number) > 0) legTypeBreakdown.push(`${summary.closeLegs} close`);
        if ((summary.rollLegs as number) > 0) legTypeBreakdown.push(`${summary.rollLegs} roll`);

        const legLabel = legTypeBreakdown.length
            ? `${summary.legsCount} legs (${legTypeBreakdown.join(', ')})`
            : `${summary.legsCount} legs`;
        stageContainer.appendChild(this.createCreditStage(legLabel as string));
    }

    if (Number.isFinite(entry.premium) && entry.premium !== 0) {
        const premiumLabel = entry.premium >= 0
            ? `Credit ${this.formatCurrency(entry.premium)}`
            : `Debit ${this.formatCurrency(Math.abs(entry.premium))}`;
        stageContainer.appendChild(this.createCreditStage(premiumLabel));
    }

    if (entry.contracts > 0) {
        const contractsLabel = `${entry.contracts} contract${entry.contracts === 1 ? '' : 's'}`;
        stageContainer.appendChild(this.createCreditStage(contractsLabel));
    }

    if (entry.expirationLabel) {
        const expirationText = this.formatDate(entry.expirationLabel);
        if (expirationText && expirationText !== '—') {
            const dte = Number(entry.dte);
            const variant = Number.isFinite(dte) && dte <= this.positionHighlightConfig.expirationCriticalDays
                ? 'warning'
                : 'default';
            const dteLabel = Number.isFinite(dte) ? ` (${dte}d)` : '';
            stageContainer.appendChild(this.createCreditStage(`Exp ${expirationText}${dteLabel}`, variant));
        }
    }

    const metaParts: string[] = [];

    if (Number.isFinite((summary as Record<string, unknown>)?.entryPrice) && (summary as Record<string, number>).entryPrice > 0) {
        metaParts.push(`Entry ${this.formatCurrency((summary as Record<string, number>).entryPrice)}`);
    }
    if (Number.isFinite((summary as Record<string, unknown>)?.exitPrice) && (summary as Record<string, number>).exitPrice > 0) {
        metaParts.push(`Exit ${this.formatCurrency((summary as Record<string, number>).exitPrice)}`);
    }
    if (Number.isFinite(entry.capitalAtRisk) && (entry.capitalAtRisk as number) > 0) {
        metaParts.push(`Risk ${this.formatCurrency(entry.capitalAtRisk)}`);
    }
    if (Number.isFinite((entry as Record<string, unknown>).capitalPerContract) && (entry as Record<string, number>).capitalPerContract > 0) {
        metaParts.push(`Risk/contract ${this.formatCurrency((entry as Record<string, number>).capitalPerContract)}`);
    }
    if (Number.isFinite((entry as Record<string, unknown>).premiumPerContract)) {
        const perContractLabel = (entry as Record<string, number>).premiumPerContract >= 0
            ? `Credit/contract ${this.formatCurrency((entry as Record<string, number>).premiumPerContract)}`
            : `Debit/contract ${this.formatCurrency(Math.abs((entry as Record<string, number>).premiumPerContract))}`;
        metaParts.push(perContractLabel);
    }
    if (Number.isFinite((summary as Record<string, unknown>)?.totalFees) && (summary as Record<string, number>).totalFees > 0) {
        metaParts.push(`Fees ${this.formatCurrency((summary as Record<string, number>).totalFees)}`);
    }

    if (metaParts.length) {
        const meta = document.createElement('span');
        meta.className = 'credit-playbook-detail-meta';
        meta.textContent = metaParts.join(' • ');
        cell.appendChild(meta);
    }
}

export function createCreditStage(label: string, variant = 'default'): HTMLElement {
    const stage = document.createElement('span');
    stage.className = 'credit-stage';
    if (variant && variant !== 'default') {
        stage.classList.add(`credit-stage--${variant}`);
    }
    stage.textContent = label;
    return stage;
}

export function isCreditStrategyTrade(this: CreditPlaybookRenderContext, trade: TradeRecord): boolean {
    const normalized = this.normalizeCreditPlaybookStrategyValue((trade.strategy || null) as string | null);
    return Boolean(normalized);
}

export function mapCreditTradeToEntry(this: CreditPlaybookRenderContext, trade: TradeRecord = {}): CreditPlaybookEntry | null {
    const ticker = ((trade.ticker || '') as string).toString().trim().toUpperCase();
    if (!ticker) {
        return null;
    }

    const strategy = this.normalizeCreditPlaybookStrategyValue((trade.strategy || null) as string | null) || ((trade.strategy || '') as string).toString().trim();
    const normalizedStatus = this.normalizeStatus(trade.status);
    const isOpen = !this.isClosedStatus(trade.status);

    const summary = this.summarizeLegs((trade.legs as unknown[]) || []);
    const openedAt = this.resolveCreditPlaybookOpenedAt(trade, summary);
    const openedDate = openedAt ? openedAt.toISOString().slice(0, 10) : '';

    let dte = this.parseInteger(trade.dte, null, { allowNegative: true });
    if (!Number.isFinite(dte) && summary.latestExpiration instanceof Date) {
        const diffMs = (summary.latestExpiration as Date).getTime() - (this.currentDate as Date).getTime();
        if (Number.isFinite(diffMs)) {
            dte = Math.round(diffMs / (24 * 60 * 60 * 1000));
        }
    }

    const expiration = summary.nextShortCallExpiration
        || summary.nearestShortCallExpiration
        || summary.latestExpiration
        || summary.earliestExpiration;
    const expirationLabel = expiration instanceof Date
        ? (expiration as Date).toISOString().slice(0, 10)
        : '';

    const netOptionContracts = this.getNetOpenOptionContracts(summary.legs as unknown[]);
    const contracts = netOptionContracts > 0
        ? netOptionContracts
        : Number(summary.openBaseContracts || summary.openContracts || 0);
    const netPremium = Number(summary.openCashFlow) || 0;
    const capitalAtRisk = this.getCapitalAtRisk(trade);
    const capitalValue = Number.isFinite(capitalAtRisk) && (capitalAtRisk as number) >= 0 ? capitalAtRisk : null;
    const plValue = Number(trade.pl);
    const roiValue = Number(trade.roi);

    let derivedRoi: number | null = Number.isFinite(roiValue) ? roiValue : null;
    if (derivedRoi === null && Number.isFinite(plValue) && Number.isFinite(capitalValue) && (capitalValue as number) > 0) {
        derivedRoi = (plValue / (capitalValue as number)) * 100;
    }

    const currentPrice = this.deriveCreditPlaybookPrice(trade);

    const premiumPerContract = contracts > 0 ? netPremium / contracts : null;
    const capitalPerContract = Number.isFinite(capitalValue) && contracts > 0 ? (capitalValue as number) / contracts : null;

    return {
        trade,
        ticker,
        strategy: strategy || '—',
        normalizedStatus,
        status: this.getDisplayStatus(trade),
        isOpen,
        openedDate,
        openedDateValue: openedAt,
        expiration,
        expirationLabel,
        dte: Number.isFinite(dte) ? dte : null,
        premium: Number.isFinite(netPremium) ? netPremium : 0,
        capital: capitalValue,
        capitalAtRisk: capitalValue,
        premiumPerContract: Number.isFinite(premiumPerContract) ? premiumPerContract : null,
        capitalPerContract: Number.isFinite(capitalPerContract) ? capitalPerContract : null,
        contracts,
        currentPrice: Number.isFinite(currentPrice) ? currentPrice : null,
        pl: Number.isFinite(plValue) ? plValue : null,
        roi: Number.isFinite(derivedRoi) ? derivedRoi : null,
        position: strategy || ticker,
        summary
    };
}

export function resolveCreditPlaybookOpenedAt(this: CreditPlaybookRenderContext, trade: TradeRecord = {}, summary: Record<string, unknown> = {}): Date | null {
    const candidates = [
        this.parseDateValue(trade.openedDate),
        this.parseDateValue(trade.tradeDate),
        this.parseDateValue(trade.openDate),
        summary?.openedDate instanceof Date ? summary.openedDate as Date : null
    ];

    for (const candidate of candidates) {
        if (candidate instanceof Date && !Number.isNaN(candidate.getTime())) {
            return candidate;
        }
    }

    if (Array.isArray(trade.legs)) {
        const dates = (trade.legs as LegRecord[])
            .map((leg) => this.parseDateValue(leg?.executionDate))
            .filter((date): date is Date => date instanceof Date && !Number.isNaN(date.getTime()))
            .sort((a, b) => a.getTime() - b.getTime());
        if (dates.length > 0) {
            return dates[0];
        }
    }

    return null;
}

export function deriveCreditPlaybookPrice(this: CreditPlaybookRenderContext, trade: TradeRecord = {}): number | null {
    const candidates = [
        trade.currentPrice,
        trade.marketPrice,
        trade.lastPrice,
        trade.stockPrice,
        trade.underlyingPrice,
        trade.stockPriceAtEntry
    ];

    for (const candidate of candidates) {
        const parsed = this.parseDecimal(candidate, null, { allowNegative: false });
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }

    return null;
}

export function filterCreditPlaybookEntries(this: CreditPlaybookRenderContext, entries: CreditPlaybookEntry[] = []): CreditPlaybookEntry[] {
    const statusFilter = this.creditPlaybookStatus;
    const strategyFilters = this.creditPlaybookStrategies;
    const horizonFilter = this.creditPlaybookHorizon;
    const symbolFilter = this.creditPlaybookSymbol;
    const now = this.currentDate instanceof Date ? this.currentDate as Date : new Date();
    const dayMs = 24 * 60 * 60 * 1000;

    return entries.filter((entry) => {
        if (statusFilter === 'active' && !entry.isOpen) {
            return false;
        }
        if (statusFilter === 'closed' && entry.isOpen) {
            return false;
        }

        if (strategyFilters.length > 0) {
            const normalizedEntryStrategy = this.normalizeCreditPlaybookStrategyValue(entry.strategy);
            if (!normalizedEntryStrategy || !strategyFilters.includes(normalizedEntryStrategy)) {
                return false;
            }
        }

        if (symbolFilter && (!entry.ticker || !entry.ticker.includes(symbolFilter))) {
            return false;
        }

        if (horizonFilter !== 'all') {
            const openedAt = (entry as Record<string, unknown>).openedDateValue instanceof Date
                ? (entry as Record<string, unknown>).openedDateValue as Date
                : null;
            if (!openedAt) {
                return false;
            }

            if (horizonFilter === 'ytd') {
                if (openedAt.getFullYear() !== now.getFullYear()) {
                    return false;
                }
            } else if (horizonFilter === 'mtd') {
                if (openedAt.getFullYear() !== now.getFullYear() || openedAt.getMonth() !== now.getMonth()) {
                    return false;
                }
            } else {
                const days = Number.parseInt(horizonFilter, 10);
                if (Number.isFinite(days)) {
                    const cutoff = new Date(now.getTime() - (days * dayMs));
                    if (openedAt < cutoff) {
                        return false;
                    }
                }
            }
        }

        return true;
    });
}

export function filterCreditPlaybookLegPairs(this: CreditPlaybookRenderContext, legPairs: LegPair[] = []): LegPair[] {
    const statusFilter = this.creditPlaybookStatus;
    const strategyFilters = this.creditPlaybookStrategies;
    const horizonFilter = this.creditPlaybookHorizon;
    const symbolFilter = this.creditPlaybookSymbol;
    const now = this.currentDate instanceof Date ? this.currentDate as Date : new Date();
    const dayMs = 24 * 60 * 60 * 1000;

    return legPairs.filter((pair) => {
        const isActive = Boolean(pair.isOpen || pair.isAssigned);

        if (statusFilter === 'active' && !isActive) {
            return false;
        }
        if (statusFilter === 'closed' && isActive) {
            return false;
        }
        if (strategyFilters.length > 0) {
            const normalizedPairStrategy = this.normalizeCreditPlaybookStrategyValue((pair.strategy || null) as string | null);
            if (!normalizedPairStrategy || !strategyFilters.includes(normalizedPairStrategy)) {
                return false;
            }
        }

        if (symbolFilter && (!pair.ticker || !pair.ticker.includes(symbolFilter))) {
            return false;
        }

        if (horizonFilter !== 'all') {
            const entryDate = pair.entryDate instanceof Date ? pair.entryDate as Date : null;
            if (!entryDate) {
                return false;
            }

            if (horizonFilter === 'ytd') {
                if (entryDate.getFullYear() !== now.getFullYear()) {
                    return false;
                }
            } else if (horizonFilter === 'mtd') {
                if (entryDate.getFullYear() !== now.getFullYear() || entryDate.getMonth() !== now.getMonth()) {
                    return false;
                }
            } else {
                const days = Number.parseInt(horizonFilter, 10);
                if (Number.isFinite(days)) {
                    const cutoff = new Date(now.getTime() - (days * dayMs));
                    if (entryDate < cutoff) {
                        return false;
                    }
                }
            }
        }

        return true;
    });
}

export function applyCreditPlaybookSort(this: CreditPlaybookRenderContext, entries: CreditPlaybookEntry[] = []): CreditPlaybookEntry[] {
    const sortKey = this.creditPlaybookSort?.key || 'openedDate';
    const direction = this.creditPlaybookSort?.direction === 'asc' ? 'asc' : 'desc';

    return entries.slice().sort((a, b) => {
        const aVal = this.getSortableValue(a as Record<string, unknown>, sortKey);
        const bVal = this.getSortableValue(b as Record<string, unknown>, sortKey);
        const comparison = this.compareSortableValues(aVal, bVal);
        return direction === 'asc' ? comparison : -comparison;
    });
}

export function applyCreditPlaybookSortToLegPairs(this: CreditPlaybookRenderContext, legPairs: LegPair[] = []): LegPair[] {
    const sortKey = this.creditPlaybookSort?.key || 'entryDate';
    const direction = this.creditPlaybookSort?.direction === 'asc' ? 'asc' : 'desc';

    return legPairs.slice().sort((a, b) => {
        let aVal: unknown;
        let bVal: unknown;

        switch (sortKey) {
            case 'ticker':
                aVal = a.ticker || '';
                bVal = b.ticker || '';
                break;
            case 'strategy':
                aVal = a.strategy || '';
                bVal = b.strategy || '';
                break;
            case 'type':
                aVal = a.type || '';
                bVal = b.type || '';
                break;
            case 'strike':
                if (typeof a.strike === 'string' && a.strike.includes('/')) {
                    aVal = parseFloat(a.strike.split('/')[0]) || 0;
                } else {
                    aVal = Number(a.strike) || 0;
                }
                if (typeof b.strike === 'string' && b.strike.includes('/')) {
                    bVal = parseFloat(b.strike.split('/')[0]) || 0;
                } else {
                    bVal = Number(b.strike) || 0;
                }
                break;
            case 'status':
                // Mirrors getPairStatus: assigned < rolling < open < expired < closed.
                // `isExpired && isOpen` never held (isOpen already excludes expired),
                // so the expired bucket was unreachable before expiredWithoutClose.
                aVal = a.isAssigned ? -1 : (a.isRolling ? 0 : (a.isOpen ? 1 : (a.expiredWithoutClose ? 2 : 3)));
                bVal = b.isAssigned ? -1 : (b.isRolling ? 0 : (b.isOpen ? 1 : (b.expiredWithoutClose ? 2 : 3)));
                break;
            case 'quantity':
                aVal = numericSortValue(a.quantity, 0);
                bVal = numericSortValue(b.quantity, 0);
                break;
            case 'pricePerContract':
                aVal = numericSortValue(a.pricePerContract, 0);
                bVal = numericSortValue(b.pricePerContract, 0);
                break;
            case 'fees':
                aVal = numericSortValue(a.fees, 0);
                bVal = numericSortValue(b.fees, 0);
                break;
            case 'premium':
                aVal = numericSortValue(a.premium, 0);
                bVal = numericSortValue(b.premium, 0);
                break;
            case 'optionPL':
                aVal = numericSortValue(a.optionPL, 0);
                bVal = numericSortValue(b.optionPL, 0);
                break;
            case 'stockPL':
                aVal = numericSortValue(a.stockPL, 0);
                bVal = numericSortValue(b.stockPL, 0);
                break;
            case 'pl':
                aVal = numericSortValue(a.allInPL ?? a.pl, 0);
                bVal = numericSortValue(b.allInPL ?? b.pl, 0);
                break;
            case 'roi':
                aVal = numericSortValue(a.roi, SORT_LOW_VALUE);
                bVal = numericSortValue(b.roi, SORT_LOW_VALUE);
                break;
            case 'currentPrice':
                aVal = numericSortValue(a.currentPrice, 0);
                bVal = numericSortValue(b.currentPrice, 0);
                break;
            case 'entryDate':
                aVal = a.entryDate instanceof Date ? (a.entryDate as Date).getTime() : 0;
                bVal = b.entryDate instanceof Date ? (b.entryDate as Date).getTime() : 0;
                break;
            case 'expirationDate':
                aVal = a.expirationDate ? new Date(a.expirationDate as string).getTime() : 0;
                bVal = b.expirationDate ? new Date(b.expirationDate as string).getTime() : 0;
                break;
            case 'dte':
                aVal = numericSortValue(a.dte, SORT_HIGH_VALUE);
                bVal = numericSortValue(b.dte, SORT_HIGH_VALUE);
                break;
            case 'exitDate':
                aVal = a.exitDate instanceof Date ? (a.exitDate as Date).getTime() : 0;
                bVal = b.exitDate instanceof Date ? (b.exitDate as Date).getTime() : 0;
                break;
            case 'daysHeld':
                aVal = numericSortValue(a.daysHeld, 0);
                bVal = numericSortValue(b.daysHeld, 0);
                break;
            default:
                aVal = a[sortKey];
                bVal = b[sortKey];
        }

        const comparison = this.compareSortableValues(aVal, bVal);
        return direction === 'asc' ? comparison : -comparison;
    });
}

function legPairRowKey(pair: LegPair): string {
    const parts = [
        pair.tradeId ?? pair.ticker ?? 'credit',
        pair.type ?? '',
        pair.strike ?? '',
        pair.entryDate instanceof Date ? pair.entryDate.toISOString() : pair.entryDate ?? '',
        pair.expirationDate ?? '',
        pair.exitDate instanceof Date ? pair.exitDate.toISOString() : pair.exitDate ?? ''
    ];

    return parts.map(value => String(value).replace(/[^a-zA-Z0-9_-]/g, '-')).join('-');
}

function formatSignedPercent(this: CreditPlaybookRenderContext, value: unknown): string {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return '—';
    }
    const magnitude = Math.abs(numeric);
    const text = this.formatNumber(magnitude, { decimals: 1, useGrouping: false }) ?? magnitude.toFixed(1);
    const prefix = numeric > 0 ? '+' : numeric < 0 ? '-' : '';
    return `${prefix}${text}%`;
}

function signedClass(value: unknown): string {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return 'pl-neutral';
    }
    return numeric > 0 ? 'pl-positive' : numeric < 0 ? 'pl-negative' : 'pl-neutral';
}

function buildCreditPlaybookRowsWithDetail(rows: LegPair[], expandedTradeId: string | null): LegPair[] {
    const result: LegPair[] = [];
    rows.forEach((row) => {
        result.push(row);
        if (row.isCreditAggregate && expandedTradeId && String(row.tradeId) === expandedTradeId) {
            result.push({
                ...row,
                tradeId: `detail-${expandedTradeId}`,
                _isDetailRow: true,
                _parentPair: row
            });
        }
    });
    return result;
}

function appendTextCell(row: HTMLTableRowElement, text: string, className = 'pdp-tb-cell'): void {
    const cell = document.createElement('td');
    cell.className = className;
    cell.textContent = text;
    row.appendChild(cell);
}

function renderCreditStrategyBreakdown(context: CreditPlaybookRenderContext, pair: LegPair): HTMLElement {
    const section = document.createElement('section');
    section.className = 'credit-playbook-trade-detail__section';

    const heading = document.createElement('div');
    heading.className = 'pdp-section-header';
    heading.textContent = 'Reconciled option groups';
    section.appendChild(heading);

    const children = pair.childPairs ?? [];
    const meta = document.createElement('div');
    meta.className = 'pdp-tb-meta';
    meta.textContent = `${children.length} option group${children.length === 1 ? '' : 's'} · parent totals count once`;
    section.appendChild(meta);

    if (children.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'pdp-tb-empty';
        empty.textContent = `No option groups recorded for this ${pair.strategy || 'trade'}.`;
        section.appendChild(empty);
        return section;
    }

    const wrap = document.createElement('div');
    wrap.className = 'pdp-tb-table-wrap';
    const table = document.createElement('table');
    table.className = 'pdp-tb-table';
    const head = document.createElement('thead');
    const headerRow = document.createElement('tr');
    ['Type', 'Strike', 'Status', 'Net Premium', 'Option P&L', 'Stock P&L', 'All-in P&L', 'Entry', 'Expiration', 'Exit']
        .forEach((label) => {
            const cell = document.createElement('th');
            cell.textContent = label;
            headerRow.appendChild(cell);
        });
    head.appendChild(headerRow);
    table.appendChild(head);

    const body = document.createElement('tbody');
    children.forEach((child) => {
        const row = document.createElement('tr');
        row.className = 'pdp-tb-row';
        const status = getPairStatus(child).label;
        const recognizedOptionPL = child.isOpen ? null : Number(child.optionPL ?? child.premium);
        const stockPL = Number(child.stockPL) || 0;
        const recognizedAllInPL = (Number.isFinite(recognizedOptionPL) ? (recognizedOptionPL as number) : 0) + stockPL;
        const strike = typeof child.strike === 'string'
            ? child.strike
            : (Number.isFinite(child.strike) ? (context.formatNumber(child.strike, { decimals: 2, useGrouping: false }) ?? '—') : '—');
        appendTextCell(row, String(child.type || '—'));
        appendTextCell(row, strike);
        appendTextCell(row, status);
        appendTextCell(row, context.formatCurrency(child.premium), `pdp-tb-cell pdp-tb-cell--cash ${signedClass(child.premium)}`);
        appendTextCell(row, recognizedOptionPL === null ? '—' : context.formatCurrency(recognizedOptionPL), `pdp-tb-cell pdp-tb-cell--cash ${signedClass(recognizedOptionPL)}`);
        appendTextCell(row, stockPL ? context.formatCurrency(stockPL) : '—', `pdp-tb-cell pdp-tb-cell--cash ${signedClass(stockPL)}`);
        appendTextCell(row, recognizedOptionPL === null && !stockPL ? '—' : context.formatCurrency(recognizedAllInPL), `pdp-tb-cell pdp-tb-cell--cash ${signedClass(recognizedAllInPL)}`);
        appendTextCell(row, context.formatDate(child.entryDate));
        appendTextCell(row, context.formatDate(child.expirationDate));
        appendTextCell(row, child.exitDate ? context.formatDate(child.exitDate) : '—');
        body.appendChild(row);
    });
    table.appendChild(body);
    wrap.appendChild(table);
    section.appendChild(wrap);
    return section;
}

function createCreditStrategyDetailRenderer(context: CreditPlaybookRenderContext) {
    return class {
        private container!: HTMLElement
        private resizeObserver: ResizeObserver | null = null
        private rowHeight = 0
        private resizeFrame: number | null = null

        init(params: { node: { data: LegPair; setRowHeight(height: number): void }; api: { onRowHeightChanged(): void } }): void {
            const pair = params.node.data._parentPair;
            this.container = document.createElement('div');
            this.container.className = 'credit-playbook-trade-detail';
            if (!pair) return;

            this.container.appendChild(renderCreditStrategyBreakdown(context, pair));
            const activity = document.createElement('section');
            activity.className = 'credit-playbook-trade-detail__section';
            renderTradeBreakdownColumn(activity, (pair.trade ?? {}) as BreakdownTrade, {
                formatCurrency: (value: unknown) => context.formatCurrency(value),
                formatDate: (value: unknown) => context.formatDate(value)
            });
            this.container.appendChild(activity);

            this.resizeObserver = new ResizeObserver((entries) => {
                const height = Math.ceil(entries[0]?.contentRect.height ?? this.container.offsetHeight);
                if (height > 0 && height !== this.rowHeight) {
                    this.rowHeight = height;
                    if (this.resizeFrame !== null) cancelAnimationFrame(this.resizeFrame);
                    this.resizeFrame = requestAnimationFrame(() => {
                        params.node.setRowHeight(height);
                        params.api.onRowHeightChanged();
                        this.resizeFrame = null;
                    });
                }
            });
            this.resizeObserver.observe(this.container);
        }

        getGui(): HTMLElement {
            return this.container;
        }

        destroy(): void {
            this.resizeObserver?.disconnect();
            if (this.resizeFrame !== null) cancelAnimationFrame(this.resizeFrame);
        }
    };
}

function getPairStatus(pair: LegPair): { className: string; label: string } {
    if (pair.isCreditAggregate && Number(pair.openCallContracts) > 0) return { className: 'open', label: 'Open' };
    if (pair.isAssigned || pair.wasAssigned) return { className: 'assigned', label: 'Assigned' };
    if (pair.isRolling) return { className: 'rolling', label: 'Rolling' };
    // isExpired is date-only and stays true for positions closed before their
    // expiration passed — those are Closed, not Expired.
    if (pair.expiredWithoutClose) return { className: 'expired', label: 'Expired' };
    if (pair.isOpen) return { className: 'open', label: 'Open' };
    return { className: 'closed', label: 'Closed' };
}

function createOptionTypeBadge(pair: LegPair): HTMLElement {
    const badge = document.createElement('span');
    badge.className = 'option-type-badge';
    if (pair.type === 'CALL') {
        badge.classList.add('type-call');
        badge.textContent = 'CALL';
    } else if (pair.type === 'PUT') {
        badge.classList.add('type-put');
        badge.textContent = 'PUT';
    } else if (pair.type === 'CALL/PUT') {
        badge.classList.add('type-multi');
        badge.textContent = 'C/P';
    } else {
        badge.textContent = (pair.type as string) || '—';
    }
    return badge;
}

function createStatusBadge(pair: LegPair): HTMLElement {
    const status = getPairStatus(pair);
    const badge = document.createElement('span');
    badge.className = `status-badge ${status.className}`;
    badge.textContent = status.label;
    return badge;
}

/**
 * True when a pair is live enough to be worth a quote — the same predicate the
 * Current Price cell renderer uses to decide between a value and a dash.
 */
function pairWantsQuote(pair: LegPair | undefined | null): pair is LegPair {
    if (!pair || !pair.ticker) return false;
    if (!pair.isOpen && !pair.isAssigned) return false;
    const status = getPairStatus(pair);
    return status.className !== 'closed' && status.className !== 'expired';
}

/**
 * Builds the quote entry for one pair. The DOM cell is attached later, if and
 * when AG Grid actually renders that column.
 */
function buildCreditQuoteEntry(pair: LegPair, key: string): Record<string, unknown> {
    const rowProxy = document.createElement('div');
    rowProxy.dataset.quoteKey = key;
    rowProxy.dataset.ticker = pair.ticker ?? '';

    if (typeof pair.strike === 'string' && pair.strike.includes('/')) {
        const strikes = pair.strike.split('/').map(s => parseFloat(s.trim()));
        rowProxy.dataset.strikePrice = String(strikes[0]);
    } else if (Number.isFinite(pair.strike)) {
        rowProxy.dataset.strikePrice = String(pair.strike);
    }

    const mockTrade: TradeRecord = {
        ticker: pair.ticker,
        tradeId: pair.tradeId,
        optionType: (pair.type as string | undefined)?.toLowerCase(),
        strategy: pair.strategy,
        dte: pair.dte
    };

    return { trade: mockTrade, row: rowProxy, cell: null, key, pair };
}

/**
 * Registers a quote entry for every live pair, straight from the row data.
 *
 * WHY NOT FROM THE CELL RENDERER: this table carries 21 columns totalling
 * ~2790px, so at any normal window width AG Grid's column virtualisation never
 * instantiates the Current Price cell — it sits ~1900px in. Registration used
 * to be a side effect of that renderer, so `creditPlaybookQuoteEntries` stayed
 * empty and the Credit Playbook fetched no quotes at all unless the window was
 * roughly 2560px wide. Row data is always present; the DOM cell is optional.
 */
function syncCreditQuoteEntries(
    rows: LegPair[],
    quoteEntries: Map<string, Record<string, unknown>>
): void {
    const wanted = new Set<string>();
    rows.forEach((pair) => {
        if (!pairWantsQuote(pair)) return;
        const key = legPairRowKey(pair);
        wanted.add(key);
        const existing = quoteEntries.get(key);
        if (existing) {
            // Keep the entry (and any cell already attached to it) but refresh
            // the pair snapshot so downstream reads see current values.
            existing.pair = pair;
            return;
        }
        quoteEntries.set(key, buildCreditQuoteEntry(pair, key));
    });

    for (const key of [...quoteEntries.keys()]) {
        if (!wanted.has(key)) quoteEntries.delete(key);
    }
}

function createCreditQuoteRenderer(
    this: CreditPlaybookRenderContext,
    quoteEntries: Map<string, Record<string, unknown>>,
    params: ICellRendererParams<LegPair>
): HTMLElement {
    const cell = document.createElement('div');
    cell.className = 'quote-cell';
    const pair = params.data;
    if (!pairWantsQuote(pair)) {
        cell.textContent = '—';
        return cell;
    }

    const quoteKey = legPairRowKey(pair);
    let entry = quoteEntries.get(quoteKey);
    if (!entry) {
        entry = buildCreditQuoteEntry(pair, quoteKey);
        quoteEntries.set(quoteKey, entry);
    }
    // Late binding: the row was registered when the table was built, this is
    // just the column finally scrolling into view.
    entry.cell = cell;
    entry.pair = pair;

    this.populateQuoteCell(cell, entry.trade as TradeRecord, entry.row as HTMLElement, {
        deferNetworkFetch: true,
        scope: 'credit-playbook'
    });
    return cell;
}

function createCreditTickerRenderer(
    context: CreditPlaybookRenderContext,
    params: ICellRendererParams<LegPair>
): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'credit-playbook-ticker-cell';
    const pair = params.data;

    if (pair?.isCreditAggregate) {
        const tradeId = String(pair.tradeId ?? '');
        const expanded = context.creditPlaybookExpandedTradeId === tradeId;
        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'credit-playbook-row-toggle';
        toggle.textContent = expanded ? '▾' : '▸';
        toggle.setAttribute('aria-expanded', String(expanded));
        toggle.setAttribute('aria-label', `${expanded ? 'Collapse' : 'Expand'} ${pair.ticker || 'trade'} activity`);
        toggle.addEventListener('click', (event) => {
            event.stopPropagation();
            context.creditPlaybookExpandedTradeId = expanded ? null : tradeId;
            const nowExpanded = context.creditPlaybookExpandedTradeId === tradeId;
            toggle.textContent = nowExpanded ? '▾' : '▸';
            toggle.setAttribute('aria-expanded', String(nowExpanded));
            toggle.setAttribute('aria-label', `${nowExpanded ? 'Collapse' : 'Expand'} ${pair.ticker || 'trade'} activity`);
            params.api.setGridOption(
                'rowData',
                buildCreditPlaybookRowsWithDetail(context.creditPlaybookRows, context.creditPlaybookExpandedTradeId)
            );
            params.api.refreshCells({ force: true });
        });
        wrapper.appendChild(toggle);
    }

    wrapper.appendChild(context.createTickerElement(params.value, 'ticker-pill', {
        behavior: 'filter',
        onClick: (value: unknown) => context.openTradesFilteredByTicker(value),
        title: params.value ? `View trades for ${params.value}` : ''
    }));
    return wrapper;
}

function formatCreditExposure(pair: LegPair | undefined): string {
    if (!pair) return '—';
    if (!pair.isCreditAggregate) {
        return Number.isFinite(pair.quantity) ? `${pair.quantity} contract${pair.quantity === 1 ? '' : 's'}` : '—';
    }

    const parts: string[] = [];
    const shares = Number(pair.heldShares);
    const calls = Number(pair.openCallContracts);
    if (Number.isFinite(shares) && shares > 0) parts.push(`${shares} shares`);
    if (Number.isFinite(calls) && calls > 0) parts.push(`${calls} call${calls === 1 ? '' : 's'}`);
    if (parts.length === 0 && Number.isFinite(pair.quantity) && (pair.quantity as number) > 0) {
        const type = String(pair.type || 'option').toLowerCase();
        parts.push(`${pair.quantity} ${type}${pair.quantity === 1 ? '' : 's'}`);
    }
    return parts.join(' · ') || '—';
}

function buildCreditPlaybookColumnDefs(
    this: CreditPlaybookRenderContext,
    quoteEntries: Map<string, Record<string, unknown>>
): ColDef<LegPair>[] {
    return [
        {
            colId: 'ticker',
            field: 'ticker',
            headerName: 'Ticker',
            width: 120,
            pinned: 'left',
            headerClass: 'ag-right-aligned-header',
            cellRenderer: (params: ICellRendererParams<LegPair>) => createCreditTickerRenderer(this, params),
            filter: 'agTextColumnFilter'
        },
        { colId: 'strategy', field: 'strategy', headerName: 'Strategy', minWidth: 180, flex: 1, valueFormatter: params => (params.value as string) || '—', filter: 'agTextColumnFilter' },
        { colId: 'type', field: 'type', headerName: 'Type', width: 95, cellRenderer: (params: ICellRendererParams<LegPair>) => params.data ? createOptionTypeBadge(params.data) : '—', filter: 'agTextColumnFilter' },
        {
            colId: 'strike',
            field: 'strike',
            headerName: 'Strike Price',
            width: 125,
            valueFormatter: params => {
                if (typeof params.value === 'string') return params.value;
                const numeric = Number(params.value);
                return Number.isFinite(numeric) ? (this.formatNumber(numeric, { decimals: 2, useGrouping: false }) ?? '—') : '—';
            },
            filter: 'agNumberColumnFilter'
        },
        { colId: 'status', headerName: 'Status', width: 115, valueGetter: params => params.data ? getPairStatus(params.data).label : '', cellRenderer: (params: ICellRendererParams<LegPair>) => params.data ? createStatusBadge(params.data) : '—', filter: 'agTextColumnFilter' },
        { colId: 'quantity', field: 'quantity', headerName: 'Exposure', width: 170, valueFormatter: params => formatCreditExposure(params.data), filter: 'agNumberColumnFilter' },
        { colId: 'pricePerContract', field: 'pricePerContract', headerName: 'Price/Contract', width: 145, valueFormatter: params => Number.isFinite(params.value as number) ? this.formatCurrency(params.value) : '—', filter: 'agNumberColumnFilter' },
        { colId: 'fees', field: 'fees', headerName: 'Fees', width: 105, valueFormatter: params => Number.isFinite(params.value as number) ? this.formatCurrency(Math.abs(params.value as number)) : '—', cellClass: 'pl-negative', filter: 'agNumberColumnFilter' },
        { colId: 'premium', field: 'premium', headerName: 'Net Premium', width: 130, valueFormatter: params => Number.isFinite(params.value as number) ? this.formatCurrency(params.value) : '—', cellClass: params => signedClass(params.value), filter: 'agNumberColumnFilter' },
        { colId: 'optionPL', field: 'optionPL', headerName: 'Realized Option P&L', width: 165, valueFormatter: params => Number.isFinite(params.value as number) ? this.formatCurrency(params.value) : '—', cellClass: params => signedClass(params.value), filter: 'agNumberColumnFilter' },
        { colId: 'unrealizedOptionPL', field: 'unrealizedOptionPL', headerName: 'Unrealized Option P&L', width: 175, valueFormatter: params => Number.isFinite(params.value as number) ? this.formatCurrency(params.value) : '—', cellClass: params => signedClass(params.value), filter: 'agNumberColumnFilter' },
        { colId: 'stockPL', field: 'stockPL', headerName: 'Stock P&L', width: 125, valueFormatter: params => Number.isFinite(params.value as number) && params.value !== 0 ? this.formatCurrency(params.value) : '—', cellClass: params => signedClass(params.value), filter: 'agNumberColumnFilter' },
        { colId: 'pl', field: 'allInPL', headerName: 'All-in P&L', width: 130, valueFormatter: params => Number.isFinite(params.value as number) ? this.formatCurrency(params.value) : '—', cellClass: params => signedClass(params.value), filter: 'agNumberColumnFilter' },
        { colId: 'roi', field: 'roi', headerName: 'ROI', width: 100, valueFormatter: params => formatSignedPercent.call(this, params.value), cellClass: params => signedClass(params.value), filter: 'agNumberColumnFilter' },
        { colId: 'currentPrice', headerName: 'Current Price', width: 135, sortable: false, filter: false, cellRenderer: (params: ICellRendererParams<LegPair>) => createCreditQuoteRenderer.call(this, quoteEntries, params) },
        {
            colId: 'optionSpreadMark',
            headerName: 'Option / Spread Mark',
            headerTooltip: 'Current Schwab mark per option or strategy unit. Multi-leg values are calculated from the open leg marks.',
            width: 175,
            sortable: false,
            filter: false,
            cellRenderer: (params: ICellRendererParams<LegPair>) => {
                const cell = document.createElement('div');
                cell.className = 'quote-cell';
                const trade = params.data?.trade
                    ?? this.trades.find(item => String(item.id || '') === String(params.data?.tradeId || ''));
                return trade ? this.renderSchwabTradeQuoteCell(cell, trade) : cell;
            }
        },
        { colId: 'entryDate', field: 'entryDate', headerName: 'Entry Date', width: 125, valueFormatter: params => this.formatDate(params.value), filter: 'agDateColumnFilter' },
        { colId: 'expirationDate', field: 'expirationDate', headerName: 'Expiration Date', width: 145, valueFormatter: params => this.formatDate(params.value), filter: 'agDateColumnFilter' },
        {
            colId: 'dte',
            field: 'dte',
            headerName: 'DTE',
            width: 90,
            valueFormatter: params => {
                const pair = params.data;
                return Number.isFinite(params.value as number) ? String(params.value) : (pair?.isExpired ? '0' : '—');
            },
            cellClass: params => {
                const pair = params.data;
                const status = pair ? getPairStatus(pair) : null;
                if (!pair || !pair.isOpen || status?.className === 'closed' || status?.className === 'expired') {
                    return '';
                }
                const probe = document.createElement('span');
                this.updateExpirationHighlight(probe, { dte: pair.dte });
                return Array.from(probe.classList).join(' ');
            },
            filter: 'agNumberColumnFilter'
        },
        { colId: 'exitDate', field: 'exitDate', headerName: 'Exit Date', width: 125, valueFormatter: params => params.value ? this.formatDate(params.value) : '—', filter: 'agDateColumnFilter' },
        { colId: 'daysHeld', field: 'daysHeld', headerName: 'Days Held', width: 115, valueFormatter: params => Number.isFinite(params.value as number) ? String(params.value) : '—', filter: 'agNumberColumnFilter' }
    ];
}

function createCreditPlaybookGridOptions(
    this: CreditPlaybookRenderContext,
    rows: LegPair[],
    quoteEntries: Map<string, Record<string, unknown>>
): GridOptions<LegPair> {
    return {
        rowData: buildCreditPlaybookRowsWithDetail(rows, this.creditPlaybookExpandedTradeId),
        columnDefs: buildCreditPlaybookColumnDefs.call(this, quoteEntries),
        defaultColDef: {
            sortable: true,
            resizable: true,
            filter: true,
            minWidth: 90
        },
        getRowId: params => params.data._isDetailRow
            ? String(params.data.tradeId)
            : legPairRowKey(params.data),
        isFullWidthRow: params => Boolean((params.rowNode.data as LegPair)?._isDetailRow),
        fullWidthCellRenderer: createCreditStrategyDetailRenderer(this),
        getRowHeight: params => (params.node.data as LegPair)?._isDetailRow ? 420 : 46,
        rowHeight: 46,
        headerHeight: 44,
        rowBuffer: 16,
        animateRows: false,
        onSortChanged: (event: SortChangedEvent<LegPair>) => {
            const sortedColumn = event.api.getColumnState().find(column => column.sort);
            if (!sortedColumn?.colId) return;
            this.creditPlaybookSort = {
                key: sortedColumn.colId,
                direction: sortedColumn.sort === 'desc' ? 'desc' : 'asc'
            };
        },
        overlayNoRowsTemplate: '<span class="ag-overlay-no-rows-center">No positions match the current filters.</span>'
    };
}

export function applyCreditPlaybookSortIndicators(this: CreditPlaybookRenderContext): void {
    const api = this.creditPlaybookGridApi;
    if (!api || api.isDestroyed() || !this.creditPlaybookSort?.key) {
        return;
    }

    api.applyColumnState({
        defaultState: { sort: null },
        state: [{
            colId: this.creditPlaybookSort.key,
            sort: this.creditPlaybookSort.direction === 'desc' ? 'desc' : 'asc'
        }]
    });
}

export function renderCreditPlaybookMetrics(this: CreditPlaybookRenderContext, legPairs: LegPair[] = []): void {
    const container = document.getElementById('credit-playbook-metrics');
    if (!container) {
        return;
    }

    container.innerHTML = '';

    const totalCount = legPairs.length;
    const activePairs = legPairs.filter((pair) => pair.isOpen || pair.isAssigned);
    const closedPairs = legPairs.filter((pair) => !pair.isOpen && !pair.isAssigned);
    const openCount = activePairs.length;
    const closedCount = closedPairs.length;

    const totalPremium = legPairs.reduce((sum, pair) => sum + (Number(pair.premium) || 0), 0);
    const totalCapital = activePairs.reduce((sum, pair) => sum + (Number(pair.capital) || 0), 0);

    const realizedOptionPL = legPairs.reduce((sum, pair) => {
        const optionPL = Number(pair.realizedOptionPL);
        return Number.isFinite(optionPL) ? sum + optionPL : sum;
    }, 0);
    const realizedOptionGroupCount = legPairs.filter((pair) => !pair.isCreditAggregate && pair.hasRealizedOptionActivity).length;
    const aggregateRealizedTradeCount = legPairs.filter((pair) => pair.isCreditAggregate && pair.hasRealizedOptionActivity).length;
    const hasRealizedOptions = realizedOptionGroupCount > 0 || aggregateRealizedTradeCount > 0;
    const realizedStockPL = legPairs.reduce((sum, pair) => {
        const stockPL = Number(pair.realizedStockPL);
        return Number.isFinite(stockPL) ? sum + stockPL : sum;
    }, 0);
    const unrealizedStockPL = legPairs.reduce((sum, pair) => {
        const stockPL = Number(pair.unrealizedStockPL);
        return Number.isFinite(stockPL) ? sum + stockPL : sum;
    }, 0);
    const unrealizedOptionPL = legPairs.reduce((sum, pair) => {
        const optionPL = Number(pair.unrealizedOptionPL);
        return Number.isFinite(optionPL) ? sum + optionPL : sum;
    }, 0);
    const markedOptionCount = legPairs.filter(pair => Number.isFinite(Number(pair.unrealizedOptionPL))).length;
    const allInMarkedPL = realizedOptionPL + unrealizedOptionPL + realizedStockPL + unrealizedStockPL;

    const winners = closedPairs.filter((p) => (Number(p.allInPL ?? p.pl) || 0) > 0).length;
    const winRate = closedCount > 0 ? (winners / closedCount) * 100 : null;

    const openDTEs = activePairs.map((p) => Number(p.dte)).filter(Number.isFinite);
    const avgDTE = openDTEs.length > 0
        ? Math.round(openDTEs.reduce((s, d) => s + d, 0) / openDTEs.length)
        : null;

    const metrics = [
        {
            group: 'overview',
            label: 'Positions',
            value: this.formatNumber(totalCount, { decimals: 0, useGrouping: true }) ?? String(totalCount),
            sublabel: `${openCount} active · ${closedCount} closed`,
            valueClass: undefined
        },
        {
            group: 'accounting',
            label: 'Net Premium',
            value: this.formatCurrency(totalPremium),
            sublabel: 'Total credit/debit across all legs',
            valueClass: totalPremium >= 0 ? 'pl-positive' : 'pl-negative'
        },
        {
            group: 'accounting',
            label: 'All-in marked P&L',
            value: this.formatCurrency(allInMarkedPL),
            sublabel: 'Realized + unrealized options + stock P&L',
            valueClass: allInMarkedPL > 0 ? 'pl-positive' : (allInMarkedPL < 0 ? 'pl-negative' : undefined)
        },
        {
            group: 'accounting',
            label: 'Unrealized option P&L',
            value: markedOptionCount > 0 ? this.formatCurrency(unrealizedOptionPL) : '—',
            sublabel: markedOptionCount > 0
                ? `Current Schwab marks across ${markedOptionCount} position${markedOptionCount === 1 ? '' : 's'}`
                : 'Refresh Schwab prices to mark open options',
            valueClass: unrealizedOptionPL > 0 ? 'pl-positive' : (unrealizedOptionPL < 0 ? 'pl-negative' : undefined)
        },
        {
            group: 'accounting',
            label: 'Realized option P&L',
            value: hasRealizedOptions ? this.formatCurrency(realizedOptionPL) : '—',
            sublabel: aggregateRealizedTradeCount > 0
                ? 'Across ' + aggregateRealizedTradeCount + ' parent trade' + (aggregateRealizedTradeCount === 1 ? '' : 's') + ' with terminated options'
                : realizedOptionGroupCount > 0
                    ? 'From ' + realizedOptionGroupCount + ' terminated option group' + (realizedOptionGroupCount === 1 ? '' : 's')
                    : 'No terminated option groups',
            valueClass: realizedOptionPL > 0 ? 'pl-positive' : (realizedOptionPL < 0 ? 'pl-negative' : undefined)
        },
        {
            group: 'accounting',
            label: 'Realized stock P&L',
            value: this.formatCurrency(realizedStockPL),
            sublabel: realizedStockPL !== 0 ? 'Sold or closed assigned shares' : 'No sold stock',
            valueClass: realizedStockPL > 0 ? 'pl-positive' : (realizedStockPL < 0 ? 'pl-negative' : undefined)
        },
        {
            group: 'accounting',
            label: 'Unrealized stock P&L',
            value: this.formatCurrency(unrealizedStockPL),
            sublabel: unrealizedStockPL !== 0 ? 'Held assigned shares; not sold' : 'No held stock mark',
            valueClass: unrealizedStockPL > 0 ? 'pl-positive' : (unrealizedStockPL < 0 ? 'pl-negative' : undefined)
        },
        {
            group: 'overview',
            label: 'Win Rate',
            value: Number.isFinite(winRate)
                ? `${(this.formatNumber(winRate as number, { decimals: 1, useGrouping: false }) ?? (winRate as number).toFixed(1))}%`
                : '—',
            sublabel: closedCount > 0 ? `${winners}W / ${closedCount - winners}L` : 'No closed positions',
            valueClass: undefined
        },
        {
            group: 'overview',
            label: 'Active Risk',
            value: this.formatCurrency(totalCapital),
            sublabel: openCount > 0 ? `Across ${openCount} open position${openCount === 1 ? '' : 's'}` : 'No open positions',
            valueClass: undefined
        },
        {
            group: 'overview',
            label: 'Avg DTE',
            value: Number.isFinite(avgDTE) ? String(avgDTE) : '—',
            sublabel: openDTEs.length > 0 ? `${openDTEs.length} open with expiration` : 'No active expirations',
            valueClass: undefined
        }
    ];

    const metricGroups = [
        { key: 'accounting', label: 'P&L accounting' },
        { key: 'overview', label: 'Position overview' }
    ];

    metricGroups.forEach((group, groupIndex) => {
        const section = document.createElement('section');
        section.className = 'credit-playbook-metric-group';
        const headingId = 'credit-playbook-metric-group-' + groupIndex;
        section.setAttribute('aria-labelledby', headingId);

        const heading = document.createElement('h2');
        heading.className = 'credit-playbook-metric-group__title';
        heading.id = headingId;
        heading.textContent = group.label;
        section.appendChild(heading);

        const grid = document.createElement('div');
        grid.className = 'credit-playbook-metric-grid';

        metrics.filter((metric) => metric.group === group.key).forEach((metric) => {
            const card = document.createElement('div');
            card.className = metric.label === 'All-in marked P&L'
                ? 'card credit-playbook-metric--featured'
                : 'card';

            const body = document.createElement('div');
            body.className = 'card__body';

            const valueEl = document.createElement('div');
            valueEl.className = 'card-value';
            if (metric.valueClass) {
                valueEl.classList.add(metric.valueClass);
            }
            valueEl.textContent = metric.value;

            const labelEl = document.createElement('small');
            labelEl.className = 'card-subtitle';
            labelEl.textContent = metric.label;

            body.appendChild(valueEl);
            body.appendChild(labelEl);

            if (metric.sublabel) {
                const sublabelEl = document.createElement('span');
                sublabelEl.className = 'credit-playbook-detail-meta';
                sublabelEl.textContent = metric.sublabel;
                body.appendChild(sublabelEl);
            }

            card.appendChild(body);
            grid.appendChild(card);
        });

        section.appendChild(grid);
        container.appendChild(section);
    });
}

export function renderCreditPlaybookTableFromLegPairs(this: CreditPlaybookRenderContext, legPairs: LegPair[] = []): void {
    const gridRoot = document.getElementById('credit-playbook-table') as HTMLElement | null;
    if (!gridRoot) {
        return;
    }

    const rows = Array.isArray(legPairs) ? legPairs.slice() : [];
    this.creditPlaybookRows = rows;
    if (this.creditPlaybookExpandedTradeId
        && !rows.some((row) => row.isCreditAggregate && String(row.tradeId) === this.creditPlaybookExpandedTradeId)) {
        this.creditPlaybookExpandedTradeId = null;
    }
    const quoteEntries = this.creditPlaybookQuoteEntries instanceof Map
        ? this.creditPlaybookQuoteEntries
        : new Map<string, Record<string, unknown>>();

    // Register from row data before the grid renders, so quotes do not depend on
    // whether AG Grid virtualised the Current Price column into existence.
    syncCreditQuoteEntries(rows, quoteEntries);
    this.creditPlaybookQuoteEntries = quoteEntries;

    if (!this.creditPlaybookGridApi || this.creditPlaybookGridApi.isDestroyed()) {
        this.creditPlaybookGridApi = createGrid(
            gridRoot,
            createCreditPlaybookGridOptions.call(this, rows, quoteEntries)
        );
        if (this.creditPlaybookGridState) {
            this.creditPlaybookGridApi.applyColumnState({
                state: this.creditPlaybookGridState.columnState,
                applyOrder: true
            });
            this.creditPlaybookGridApi.setFilterModel(this.creditPlaybookGridState.filterModel);
        }
    } else {
        this.creditPlaybookGridApi.setGridOption(
            'rowData',
            buildCreditPlaybookRowsWithDetail(rows, this.creditPlaybookExpandedTradeId)
        );
    }

    // A detached cell just means that column is not currently rendered — drop the
    // stale element but keep the entry so its quote still refreshes.
    for (const entry of quoteEntries.values()) {
        if (!(entry.cell as HTMLElement | null)?.isConnected) entry.cell = null;
    }

    if (quoteEntries.size > 0) {
        this.startQuoteAutoRefreshIfNeeded();
        if (!this.creditPlaybookQuoteRefreshSuppressed) {
            this.refreshCreditPlaybookQuotes({ prime: true });
        }
    }
}

export function releaseCreditPlaybookGrid(this: CreditPlaybookRenderContext): void {
    const api = this.creditPlaybookGridApi;
    if (api && !api.isDestroyed()) {
        this.creditPlaybookGridState = {
            filterModel: api.getFilterModel(),
            columnState: api.getColumnState()
        };
        api.destroy();
    }
    this.creditPlaybookGridApi = null;
    this.creditPlaybookQuoteEntries?.clear();
}
