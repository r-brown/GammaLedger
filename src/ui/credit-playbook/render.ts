// src/ui/credit-playbook/render.ts — Wave 9: Credit playbook rendering.
// Uses the .call(this, …) delegation pattern.

import {
  createGrid,
  type ColDef,
  type GridApi,
  type GridOptions,
  type ICellRendererParams,
  type SortChangedEvent
} from '../tables/ag-grid.js'

type TradeRecord = Record<string, unknown>
type LegRecord = Record<string, unknown>

interface LegPair {
  tradeId?: string
  ticker?: string
  strategy?: string
  type?: string
  strike?: number | string
  isOpen?: boolean
  isAssigned?: boolean
  isRolling?: boolean
  isExpired?: boolean
  quantity?: number
  pricePerContract?: number
  fees?: number
  premium?: number
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
  currentDate: Date | unknown
  creditPlaybookStatus: string
  creditPlaybookStrategy: string
  creditPlaybookHorizon: string
  creditPlaybookSymbol: string
  creditPlaybookSort: { key: string; direction: string }
  creditPlaybookGridApi?: GridApi<LegPair> | null
  positionHighlightConfig: { expirationCriticalDays: number }
  creditPlaybookQuoteEntries?: Map<string, Record<string, unknown>>
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
  refreshCreditPlaybookQuotes(opts: { force: boolean; immediate: boolean }): void
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
    const strategyFilter = this.creditPlaybookStrategy;
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

        if (strategyFilter !== 'all') {
            const normalizedEntryStrategy = this.normalizeCreditPlaybookStrategyValue(entry.strategy);
            if (normalizedEntryStrategy !== strategyFilter) {
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
    const strategyFilter = this.creditPlaybookStrategy;
    const horizonFilter = this.creditPlaybookHorizon;
    const symbolFilter = this.creditPlaybookSymbol;
    const now = this.currentDate instanceof Date ? this.currentDate as Date : new Date();
    const dayMs = 24 * 60 * 60 * 1000;

    return legPairs.filter((pair) => {
        if (statusFilter === 'active' && !pair.isOpen) {
            return false;
        }
        if (statusFilter === 'closed' && pair.isOpen) {
            return false;
        }
        if (strategyFilter !== 'all') {
            const normalizedPairStrategy = this.normalizeCreditPlaybookStrategyValue((pair.strategy || null) as string | null);
            if (normalizedPairStrategy !== strategyFilter) {
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
                aVal = a.isAssigned ? -1 : (a.isRolling ? 0 : (a.isExpired && a.isOpen ? 2 : (a.isOpen ? 1 : 3)));
                bVal = b.isAssigned ? -1 : (b.isRolling ? 0 : (b.isExpired && b.isOpen ? 2 : (b.isOpen ? 1 : 3)));
                break;
            case 'quantity':
                aVal = Number(a.quantity) || 0;
                bVal = Number(b.quantity) || 0;
                break;
            case 'pricePerContract':
                aVal = Number(a.pricePerContract) || 0;
                bVal = Number(b.pricePerContract) || 0;
                break;
            case 'fees':
                aVal = Number(a.fees) || 0;
                bVal = Number(b.fees) || 0;
                break;
            case 'premium':
                aVal = Number(a.premium) || 0;
                bVal = Number(b.premium) || 0;
                break;
            case 'pl':
                aVal = Number(a.pl) || 0;
                bVal = Number(b.pl) || 0;
                break;
            case 'roi':
                aVal = Number(a.roi) ?? -Infinity;
                bVal = Number(b.roi) ?? -Infinity;
                break;
            case 'currentPrice':
                aVal = Number(a.currentPrice) || 0;
                bVal = Number(b.currentPrice) || 0;
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
                aVal = Number(a.dte) ?? Infinity;
                bVal = Number(b.dte) ?? Infinity;
                break;
            case 'exitDate':
                aVal = a.exitDate instanceof Date ? (a.exitDate as Date).getTime() : 0;
                bVal = b.exitDate instanceof Date ? (b.exitDate as Date).getTime() : 0;
                break;
            case 'daysHeld':
                aVal = Number(a.daysHeld) ?? 0;
                bVal = Number(b.daysHeld) ?? 0;
                break;
            default:
                aVal = a[sortKey];
                bVal = b[sortKey];
        }

        const comparison = this.compareSortableValues(aVal, bVal);
        return direction === 'asc' ? comparison : -comparison;
    });
}

function legPairRowKey(pair: LegPair, index = 0): string {
    return String(pair.tradeId ?? `${pair.ticker || 'credit'}-${pair.entryDate || ''}-${pair.expirationDate || ''}-${index}`)
        .replace(/[^a-zA-Z0-9_-]/g, '-');
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

function getPairStatus(pair: LegPair): { className: string; label: string } {
    if (pair.isAssigned) return { className: 'assigned', label: 'Assigned' };
    if (pair.isRolling) return { className: 'rolling', label: 'Rolling' };
    if (pair.isExpired && pair.isOpen) return { className: 'expired', label: 'Expired' };
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

function createCreditQuoteRenderer(
    this: CreditPlaybookRenderContext,
    quoteEntries: Map<string, Record<string, unknown>>,
    params: ICellRendererParams<LegPair>
): HTMLElement {
    const cell = document.createElement('div');
    cell.className = 'quote-cell';
    const pair = params.data;
    const status = pair ? getPairStatus(pair) : null;
    if (!pair || !pair.isOpen || status?.className === 'closed' || status?.className === 'expired' || status?.className === 'assigned') {
        cell.textContent = '—';
        return cell;
    }

    const rowProxy = document.createElement('div');
    const quoteKey = `${pair.ticker}|${pair.tradeId}|creditPlaybook:${params.node?.rowIndex ?? quoteEntries.size}`;
    rowProxy.dataset.quoteKey = quoteKey;
    rowProxy.dataset.ticker = pair.ticker ?? '';

    if (typeof pair.strike === 'string' && pair.strike.includes('/')) {
        const strikes = pair.strike.split('/').map(s => parseFloat(s.trim()));
        rowProxy.dataset.strikePrice = String(strikes[0]);
    } else if (Number.isFinite(pair.strike)) {
        rowProxy.dataset.strikePrice = String(pair.strike);
    }

    const mockTrade: TradeRecord = {
        ticker: pair.ticker,
        optionType: (pair.type as string | undefined)?.toLowerCase(),
        strategy: pair.strategy,
        dte: pair.dte
    };

    this.populateQuoteCell(cell, mockTrade, rowProxy, { deferNetworkFetch: true });
    quoteEntries.set(quoteKey, {
        trade: mockTrade,
        row: rowProxy,
        cell,
        key: quoteKey,
        pair
    });
    return cell;
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
            cellRenderer: (params: ICellRendererParams<LegPair>) => this.createTickerElement(params.value, 'ticker-pill', {
                behavior: 'filter',
                onClick: (value: unknown) => this.openTradesFilteredByTicker(value),
                title: params.value ? `View trades for ${params.value}` : ''
            }),
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
        { colId: 'quantity', field: 'quantity', headerName: 'Contracts', width: 115, valueFormatter: params => Number.isFinite(params.value as number) ? String(params.value) : '—', filter: 'agNumberColumnFilter' },
        { colId: 'pricePerContract', field: 'pricePerContract', headerName: 'Price/Contract', width: 145, valueFormatter: params => Number.isFinite(params.value as number) ? this.formatCurrency(params.value) : '—', filter: 'agNumberColumnFilter' },
        { colId: 'fees', field: 'fees', headerName: 'Fees', width: 105, valueFormatter: params => Number.isFinite(params.value as number) ? this.formatCurrency(Math.abs(params.value as number)) : '—', cellClass: 'pl-negative', filter: 'agNumberColumnFilter' },
        { colId: 'premium', field: 'premium', headerName: 'Premium', width: 120, valueFormatter: params => Number.isFinite(params.value as number) ? this.formatCurrency(params.value) : '—', cellClass: params => signedClass(params.value), filter: 'agNumberColumnFilter' },
        { colId: 'pl', field: 'pl', headerName: 'P&L', width: 120, valueFormatter: params => Number.isFinite(params.value as number) ? this.formatCurrency(params.value) : '—', cellClass: params => signedClass(params.value), filter: 'agNumberColumnFilter' },
        { colId: 'roi', field: 'roi', headerName: 'ROI', width: 100, valueFormatter: params => formatSignedPercent.call(this, params.value), cellClass: params => signedClass(params.value), filter: 'agNumberColumnFilter' },
        { colId: 'currentPrice', headerName: 'Current Price', width: 135, sortable: false, filter: false, cellRenderer: (params: ICellRendererParams<LegPair>) => createCreditQuoteRenderer.call(this, quoteEntries, params) },
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
        rowData: rows,
        columnDefs: buildCreditPlaybookColumnDefs.call(this, quoteEntries),
        defaultColDef: {
            sortable: true,
            resizable: true,
            filter: true,
            minWidth: 90
        },
        getRowId: params => legPairRowKey(params.data),
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
    const openPairs = legPairs.filter((pair) => pair.isOpen);
    const closedPairs = legPairs.filter((pair) => !pair.isOpen);
    const openCount = openPairs.length;
    const closedCount = closedPairs.length;

    const totalPremium = legPairs.reduce((sum, pair) => sum + (Number(pair.premium) || 0), 0);
    const totalCapital = openPairs.reduce((sum, pair) => sum + (Number(pair.capital) || 0), 0);

    const realizedPL = closedPairs.reduce((sum, pair) => {
        const pl = Number(pair.pl);
        return Number.isFinite(pl) ? sum + pl : sum;
    }, 0);

    const winners = closedPairs.filter((p) => (Number(p.pl) || 0) > 0).length;
    const winRate = closedCount > 0 ? (winners / closedCount) * 100 : null;

    const openDTEs = openPairs.map((p) => Number(p.dte)).filter(Number.isFinite);
    const avgDTE = openDTEs.length > 0
        ? Math.round(openDTEs.reduce((s, d) => s + d, 0) / openDTEs.length)
        : null;

    const metrics = [
        {
            label: 'Positions',
            value: this.formatNumber(totalCount, { decimals: 0, useGrouping: true }) ?? String(totalCount),
            sublabel: `${openCount} active · ${closedCount} closed`,
            valueClass: undefined
        },
        {
            label: 'Net Premium',
            value: this.formatCurrency(totalPremium),
            sublabel: 'Total credit/debit across all legs',
            valueClass: totalPremium >= 0 ? 'pl-positive' : 'pl-negative'
        },
        {
            label: 'Realized P&L',
            value: closedCount > 0 ? this.formatCurrency(realizedPL) : '—',
            sublabel: closedCount > 0 ? `From ${closedCount} closed position${closedCount === 1 ? '' : 's'}` : 'No closed positions yet',
            valueClass: realizedPL > 0 ? 'pl-positive' : (realizedPL < 0 ? 'pl-negative' : undefined)
        },
        {
            label: 'Win Rate',
            value: Number.isFinite(winRate)
                ? `${(this.formatNumber(winRate as number, { decimals: 1, useGrouping: false }) ?? (winRate as number).toFixed(1))}%`
                : '—',
            sublabel: closedCount > 0 ? `${winners}W / ${closedCount - winners}L` : 'No closed positions',
            valueClass: undefined
        },
        {
            label: 'Active Risk',
            value: this.formatCurrency(totalCapital),
            sublabel: openCount > 0 ? `Across ${openCount} open position${openCount === 1 ? '' : 's'}` : 'No open positions',
            valueClass: undefined
        },
        {
            label: 'Avg DTE',
            value: Number.isFinite(avgDTE) ? String(avgDTE) : '—',
            sublabel: openDTEs.length > 0 ? `${openDTEs.length} open with expiration` : 'No active expirations',
            valueClass: undefined
        }
    ];

    metrics.forEach((metric) => {
        const card = document.createElement('div');
        card.className = 'card';

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
        container.appendChild(card);
    });
}

export function renderCreditPlaybookTableFromLegPairs(this: CreditPlaybookRenderContext, legPairs: LegPair[] = []): void {
    const gridRoot = document.getElementById('credit-playbook-table') as HTMLElement | null;
    if (!gridRoot) {
        return;
    }

    const rows = Array.isArray(legPairs) ? legPairs.slice() : [];
    const quoteEntries = new Map<string, Record<string, unknown>>();

    if (!this.creditPlaybookGridApi || this.creditPlaybookGridApi.isDestroyed()) {
        this.creditPlaybookGridApi = createGrid(
            gridRoot,
            createCreditPlaybookGridOptions.call(this, rows, quoteEntries)
        );
    } else {
        this.creditPlaybookGridApi.updateGridOptions({
            columnDefs: buildCreditPlaybookColumnDefs.call(this, quoteEntries),
            rowData: rows
        });
    }

    this.creditPlaybookQuoteEntries = quoteEntries;

    if (quoteEntries.size > 0) {
        this.startQuoteAutoRefreshIfNeeded();
        this.refreshCreditPlaybookQuotes({ force: true, immediate: true });
    }
}
