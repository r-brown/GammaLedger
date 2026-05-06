// src/ui/tables/recent-trades.ts — Wave 9: Recent trades table rendering.
// Uses the .call(this, …) delegation pattern.

type TradeRecord = Record<string, unknown>

interface RecentTradesContext {
  trades: TradeRecord[]
  isClosedStatus(status: unknown): boolean
  isActiveStatus(status: unknown): boolean
  formatDate(value: unknown): string
  formatCurrency(value: unknown, opts?: Record<string, unknown>): string
  formatPercent(value: unknown, fallback: string, opts?: Record<string, unknown>): string
  createTickerElement(ticker: unknown, className?: string, opts?: Record<string, unknown>): HTMLElement
  openTradesFilteredByTicker(ticker: unknown): void
  applyResponsiveLabels(row: HTMLTableRowElement, labels: string[]): void
}

export function updateRecentTradesTable(
    this: RecentTradesContext,
    closedTrades: TradeRecord[] = (this.trades as TradeRecord[]).filter(trade => this.isClosedStatus(trade.status)),
    activeCount: number = (this.trades as TradeRecord[]).filter(trade => this.isActiveStatus(trade.status)).length
): void {
    const normalizedActiveCount = Number(activeCount);
    const desiredRowCount = Math.max(Number.isFinite(normalizedActiveCount) ? normalizedActiveCount : 0, 10);

    const recentTrades = [...(Array.isArray(closedTrades) ? closedTrades : [])]
        .sort((a, b) => new Date(b.exitDate as string).getTime() - new Date(a.exitDate as string).getTime())
        .slice(0, desiredRowCount);

    const tbody = document.querySelector('#recent-trades-table tbody') as HTMLTableSectionElement | null;
    if (tbody) {
        tbody.innerHTML = '';

        const columnLabels = ['Ticker', 'Strategy', 'Exit Date', 'Days Held', 'P&L', 'ROI', 'Weekly ROI'];

        recentTrades.forEach(trade => {
            const row = tbody.insertRow();
            const tickerCell = row.insertCell(0);
            const tickerValue = ((trade.ticker ?? '') as string).toString().trim().toUpperCase();
            const tickerLink = this.createTickerElement(trade.ticker, 'ticker-pill', {
                behavior: 'filter',
                onClick: (value: unknown) => this.openTradesFilteredByTicker(value),
                title: tickerValue ? `View all trades for ${tickerValue}` : ''
            });
            tickerCell.appendChild(tickerLink);

            row.insertCell(1).textContent = (trade.strategy as string) || '—';
            row.insertCell(2).textContent = this.formatDate(trade.exitDate);

            const daysHeldCell = row.insertCell(3);
            const daysHeldValue = Number(trade.daysHeld);
            daysHeldCell.textContent = Number.isFinite(daysHeldValue) ? String(daysHeldValue) : '—';

            const plCell = row.insertCell(4);
            plCell.textContent = this.formatCurrency(trade.pl);
            plCell.className = (trade.pl as number) >= 0 ? 'pl-positive' : 'pl-negative';

            const roiCell = row.insertCell(5);
            const roiValue = Number(trade.roi);
            const roiDisplay = this.formatPercent(roiValue, '—');
            roiCell.textContent = roiDisplay;
            if (roiDisplay === '—') {
                roiCell.className = 'pl-neutral';
            } else {
                roiCell.className = roiValue >= 0 ? 'pl-positive' : 'pl-negative';
            }

            const weeklyRoiCell = row.insertCell(6);
            const weeklyRoiValue = Number(trade.weeklyROI);
            const weeklyRoiDisplay = this.formatPercent(weeklyRoiValue, '—');
            weeklyRoiCell.textContent = weeklyRoiDisplay;
            if (weeklyRoiDisplay === '—') {
                weeklyRoiCell.className = 'pl-neutral';
            } else {
                weeklyRoiCell.className = weeklyRoiValue >= 0 ? 'pl-positive' : 'pl-negative';
            }

            this.applyResponsiveLabels(row, columnLabels);
        });
    }
}

