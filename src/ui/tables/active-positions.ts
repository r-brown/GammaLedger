// src/ui/tables/active-positions.ts — Wave 9: Active positions table rendering.
// Uses the .call(this, …) delegation pattern.

type TradeRecord = Record<string, unknown>

interface ActivePositionsContext {
  trades: TradeRecord[]
  activeQuoteEntries: Map<string, Record<string, unknown>>
  isActiveStatus(status: unknown): boolean
  isWheelOrPmccTrade(trade: TradeRecord): boolean
  isAssignmentTrade(trade: TradeRecord): boolean
  hasNonExpiredOpenShortOptions(trade: TradeRecord): boolean
  lifecycleStatus?: string
  parseInteger(value: unknown, fallback: unknown, opts?: { allowNegative?: boolean }): number | null
  parseDecimal(value: unknown, fallback: unknown, opts?: { allowNegative?: boolean }): number | null
  createTickerElement(ticker: unknown, className?: string, opts?: Record<string, unknown>): HTMLElement
  openTradesFilteredByTicker(ticker: unknown): void
  summarizeLegs(legs: unknown[]): Record<string, unknown>
  getActiveStrikeForDisplay(summary: Record<string, unknown>): number | null
  formatNumber(value: unknown, opts: Record<string, unknown>): string | null
  formatCurrency(value: unknown, opts?: Record<string, unknown>): string
  getQuoteEntryKey(trade: TradeRecord): string
  populateQuoteCell(cell: HTMLTableCellElement, trade: TradeRecord, row: HTMLTableRowElement, opts: Record<string, unknown>): void
  updateExpirationHighlight(cell: HTMLTableCellElement, trade: TradeRecord): void
  applyResponsiveLabels(row: HTMLTableRowElement, labels: string[]): void
  rebuildQuoteRefreshSchedule(): void
  startQuoteAutoRefreshIfNeeded(): void
  refreshActivePositionsQuotes(opts: { force: boolean; immediate: boolean }): void
}

export function updateActivePositionsTable(
    this: ActivePositionsContext,
    openTrades: TradeRecord[] = (this.trades as TradeRecord[]).filter(trade => {
        if ((trade as TradeRecord & { lifecycleStatus?: string }).lifecycleStatus === 'awaiting_coverage') {
            return false;
        }
        if (this.isActiveStatus(trade.status)) {
            if (this.isWheelOrPmccTrade(trade) || this.isAssignmentTrade(trade)) {
                return this.hasNonExpiredOpenShortOptions(trade);
            }
            return true;
        }
        if (this.isAssignmentTrade(trade) && this.isWheelOrPmccTrade(trade)) {
            return this.hasNonExpiredOpenShortOptions(trade);
        }
        return false;
    })
): void {
    const tbody = document.querySelector('#active-positions-table tbody') as HTMLTableSectionElement | null;

    if (tbody) {
        tbody.innerHTML = '';

        const sortedTrades = [...(Array.isArray(openTrades) ? openTrades : [])].sort((a, b) => {
            const dteA = this.parseInteger(a.dte, Number.POSITIVE_INFINITY, { allowNegative: false }) ?? Number.POSITIVE_INFINITY;
            const dteB = this.parseInteger(b.dte, Number.POSITIVE_INFINITY, { allowNegative: false }) ?? Number.POSITIVE_INFINITY;
            return dteA - dteB;
        });

        const columnLabels = ['Ticker', 'Strategy', 'Strike', 'Current Price', 'DTE', 'Max Risk', 'Notes'];
        const quoteEntries = new Map<string, Record<string, unknown>>();

        sortedTrades.forEach(trade => {
            const row = tbody.insertRow();
            row.dataset.tradeId = String(trade.id ?? '');

            const tickerCell = row.insertCell(0);
            const tickerValue = ((trade.ticker ?? '') as string).toString().trim().toUpperCase();
            const tickerLink = this.createTickerElement(trade.ticker, 'ticker-pill', {
                behavior: 'filter',
                onClick: (value: unknown) => this.openTradesFilteredByTicker(value),
                title: tickerValue ? `View all trades for ${tickerValue}` : ''
            });
            tickerCell.appendChild(tickerLink);

            row.dataset.ticker = tickerValue;

            row.insertCell(1).textContent = (trade.strategy as string) || '—';

            const strikeCell = row.insertCell(2);
            let resolvedStrike = this.parseDecimal(trade.activeStrikePrice, null, { allowNegative: false });

            if (resolvedStrike === null && Array.isArray(trade.legs) && (trade.legs as unknown[]).length > 0) {
                const strikeSummary = this.summarizeLegs(trade.legs as unknown[]);
                const summaryStrike = this.getActiveStrikeForDisplay(strikeSummary);
                if (Number.isFinite(summaryStrike)) {
                    resolvedStrike = summaryStrike;
                }
            }

            if (resolvedStrike === null) {
                resolvedStrike = this.parseDecimal(trade.strikePrice, null, { allowNegative: false });
            }

            if (Number.isFinite(resolvedStrike)) {
                const strikeLabel = this.formatNumber(resolvedStrike, { style: 'currency', decimals: 2 });
                strikeCell.textContent = strikeLabel ?? '—';
                row.dataset.strikePrice = String(resolvedStrike);
            } else {
                strikeCell.textContent = '—';
                delete row.dataset.strikePrice;
            }

            const priceCell = row.insertCell(3);
            priceCell.className = 'quote-cell';
            const baseQuoteKey = this.getQuoteEntryKey(trade);
            const quoteKey = `${baseQuoteKey}|row:${quoteEntries.size}`;
            row.dataset.quoteKey = quoteKey;
            this.populateQuoteCell(priceCell, trade, row, { deferNetworkFetch: true });
            quoteEntries.set(quoteKey, { trade, row, cell: priceCell, key: quoteKey });

            const dteValue = this.parseInteger(trade.dte, null, { allowNegative: false });
            const dteCell = row.insertCell(4);
            dteCell.textContent = dteValue !== null ? String(dteValue) : '—';
            if (Number.isFinite(dteValue)) {
                row.dataset.dte = String(dteValue);
            } else {
                delete row.dataset.dte;
            }

            const maxRiskCell = row.insertCell(5);
            const maxRiskValue = this.parseDecimal(trade.maxRisk, null, { allowNegative: false });
            if (maxRiskValue !== null) {
                maxRiskCell.textContent = this.formatCurrency(maxRiskValue);
                maxRiskCell.className = 'pl-negative';
            } else {
                maxRiskCell.textContent = '—';
                maxRiskCell.className = 'pl-neutral';
            }

            const notesCell = row.insertCell(6);
            const noteText = ((trade.notes || '') as string).trim();
            notesCell.textContent = noteText || '—';
            notesCell.classList.add('notes-cell');
            if (noteText) {
                notesCell.title = noteText;
            }

            this.updateExpirationHighlight(dteCell as HTMLTableCellElement, trade);

            this.applyResponsiveLabels(row, columnLabels);
        });

        this.activeQuoteEntries = quoteEntries;
        this.rebuildQuoteRefreshSchedule();
        this.startQuoteAutoRefreshIfNeeded();
        this.refreshActivePositionsQuotes({ force: true, immediate: true });
    }
}

