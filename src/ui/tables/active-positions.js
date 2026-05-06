// src/ui/tables/active-positions.js — Wave 9: Active positions table rendering.
// Uses the .call(this, …) delegation pattern.

export function updateActivePositionsTable(openTrades = this.trades.filter(trade => {
    // Awaiting-coverage wheel/PMCC trades belong only to the Wheel/PMCC tracker.
    if (trade.lifecycleStatus === 'awaiting_coverage') {
        return false;
    }
    // Include trades with Open or Rolling status
    if (this.isActiveStatus(trade.status)) {
        // Exclude uncovered/expired: Wheel, PMCC, or assigned trades where
        // all short option legs have been closed or expired (only stock/LEAP remains)
        if (this.isWheelOrPmccTrade(trade) || this.isAssignmentTrade(trade)) {
            return this.hasNonExpiredOpenShortOptions(trade);
        }
        return true;
    }

    // Also include Assigned Wheel/PMCC trades that have non-expired open short options
    if (this.isAssignmentTrade(trade) && this.isWheelOrPmccTrade(trade)) {
        return this.hasNonExpiredOpenShortOptions(trade);
    }

    return false;
})) {
    const tbody = document.querySelector('#active-positions-table tbody');

    if (tbody) {
        tbody.innerHTML = '';

        const sortedTrades = [...(Array.isArray(openTrades) ? openTrades : [])].sort((a, b) => {
            const dteA = this.parseInteger(a.dte, Number.POSITIVE_INFINITY, { allowNegative: false });
            const dteB = this.parseInteger(b.dte, Number.POSITIVE_INFINITY, { allowNegative: false });
            return dteA - dteB;
        });

        const columnLabels = ['Ticker', 'Strategy', 'Strike', 'Current Price', 'DTE', 'Max Risk', 'Notes'];
        const quoteEntries = new Map();

        sortedTrades.forEach(trade => {
            const row = tbody.insertRow();
            row.dataset.tradeId = String(trade.id ?? '');

            const tickerCell = row.insertCell(0);
            const tickerValue = (trade.ticker ?? '').toString().trim().toUpperCase();
            const tickerLink = this.createTickerElement(trade.ticker, 'ticker-pill', {
                behavior: 'filter',
                onClick: (value) => this.openTradesFilteredByTicker(value),
                title: tickerValue ? `View all trades for ${tickerValue}` : ''
            });
            tickerCell.appendChild(tickerLink);

            row.dataset.ticker = tickerValue;

            row.insertCell(1).textContent = trade.strategy || '—';

            const strikeCell = row.insertCell(2);
            let resolvedStrike = this.parseDecimal(trade.activeStrikePrice, null, { allowNegative: false });

            if (resolvedStrike === null && Array.isArray(trade.legs) && trade.legs.length > 0) {
                const strikeSummary = this.summarizeLegs(trade.legs);
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
            dteCell.textContent = dteValue !== null ? dteValue : '—';
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
            const noteText = (trade.notes || '').trim();
            notesCell.textContent = noteText || '—';
            notesCell.classList.add('notes-cell');
            if (noteText) {
                notesCell.title = noteText;
            }

            this.updateExpirationHighlight(dteCell, trade);

            this.applyResponsiveLabels(row, columnLabels);
        });

        this.activeQuoteEntries = quoteEntries;
        this.rebuildQuoteRefreshSchedule();
        this.startQuoteAutoRefreshIfNeeded();
        this.refreshActivePositionsQuotes({ force: true, immediate: true });
    }
}
