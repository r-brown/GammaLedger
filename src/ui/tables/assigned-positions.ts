// src/ui/tables/assigned-positions.ts — Wave 9: Assigned positions table rendering.
// Uses the .call(this, …) delegation pattern.

type TradeRecord = Record<string, unknown>

interface AssignmentEntry {
  trade: TradeRecord
  strike: number
  premiumCollected: number
  premiumHistory: Array<{ label: string; amount: number }>
  effectiveCostBasis: number
  shares: number
  initialPutPremium: number
  callPremium: number
  longCallCost: number
  positionType: string
  assignmentCostBasis: number
  assignmentDate: string
  activeShortCalls: number
  activeShortCallDetails: Array<{ strike: number; expiration: string; contracts: number }>
  coveredShares: number
  uncoveredShares: number
  coverageStatus: string
}

interface AssignedPositionsContext {
  latestStats: Record<string, unknown> | null
  assignedPositionsStatusFilter: string
  assignedPositionsQuoteEntries?: Map<string, Record<string, unknown>>
  activeQuoteEntries: Map<string, Record<string, unknown>>
  finnhub: { apiKey?: string }
  isClosedStatus(status: unknown): boolean
  createTickerElement(ticker: unknown, className?: string, opts?: Record<string, unknown>): HTMLElement
  openTradesFilteredByTicker(ticker: unknown): void
  formatCurrency(value: unknown, opts?: Record<string, unknown>): string
  formatDate(value: unknown): string
  formatNumber(value: unknown, opts: Record<string, unknown>): string | null
  positionFormulaTooltip(wrapper: HTMLElement, tooltip: HTMLElement): void
  escapeHtml(value: string): string
  getQuoteEntryKey(trade: TradeRecord): string
  applyResponsiveLabels(row: HTMLTableRowElement, labels: string[]): void
  rebuildQuoteRefreshSchedule(): void
  startQuoteAutoRefreshIfNeeded(): void
  refreshAssignedPositionsQuotes(opts: { immediate: boolean }): void
  updateAssignedPositionMetrics(entry: Record<string, unknown>, quote: Record<string, unknown>): void
}

export function updateAssignedPositionsTable(this: AssignedPositionsContext): void {
    const stats = this.latestStats;
    const assignmentStats = (stats?.assignmentStats as Record<string, unknown> | undefined);
    const assignments = (assignmentStats?.assignments as AssignmentEntry[] | undefined) || [];

    const tbody = document.querySelector('#assigned-positions-table tbody') as HTMLTableSectionElement | null;
    if (tbody) {
        tbody.innerHTML = '';

        const columnLabels = [
            'Ticker', 'Strategy', 'Status', 'Coverage', 'Assignment Date',
            'Shares', 'Strike Price', 'Assignment Cost Basis', 'Premium Collected',
            'Eff. Cost Basis', 'Current Price', 'Market Value', 'Unrealized Gain/Loss', 'Notes'
        ];

        const currentFilter = this.assignedPositionsStatusFilter;
        const filteredAssignments = assignments.filter(({ trade }) => {
            if (currentFilter === 'open') {
                return !this.isClosedStatus(trade.status);
            } else if (currentFilter === 'closed') {
                return this.isClosedStatus(trade.status);
            }
            return true;
        });

        const quoteEntries = new Map<string, Record<string, unknown>>();

        filteredAssignments.forEach(({
            trade, strike, premiumCollected, premiumHistory, effectiveCostBasis, shares,
            initialPutPremium, callPremium, longCallCost, positionType, assignmentCostBasis,
            assignmentDate, activeShortCalls, activeShortCallDetails, coveredShares,
            uncoveredShares, coverageStatus
        }) => {
            const row = tbody.insertRow();

            // Ticker
            const tickerCell = row.insertCell(0);
            const tickerValue = ((trade.ticker ?? '') as string).toString().trim().toUpperCase();
            const tickerLink = this.createTickerElement(trade.ticker, 'ticker-pill', {
                behavior: 'filter',
                onClick: (value: unknown) => this.openTradesFilteredByTicker(value),
                title: tickerValue ? `View all trades for ${tickerValue}` : ''
            });
            tickerCell.appendChild(tickerLink);

            // Strategy
            const strategyCell = row.insertCell(1);
            strategyCell.textContent = (trade.strategy as string) || '—';

            // Status
            const statusCell = row.insertCell(2);
            const statusBadge = document.createElement('span');
            statusBadge.className = 'status-badge';
            const isOpen = !this.isClosedStatus(trade.status);
            statusBadge.classList.add(isOpen ? 'open' : 'closed');
            statusBadge.textContent = isOpen ? 'Open' : 'Closed';
            statusCell.appendChild(statusBadge);

            // Coverage
            const coverageCell = row.insertCell(3);
            const coverageWrapper = document.createElement('div');
            coverageWrapper.className = 'coverage-indicator-wrapper';

            const coverageBadge = document.createElement('span');
            coverageBadge.className = 'coverage-badge';

            if (!isOpen) {
                coverageBadge.classList.add('coverage-na');
                coverageBadge.textContent = '—';
                coverageBadge.title = 'Position is closed';
            } else if (coverageStatus === 'full') {
                coverageBadge.classList.add('coverage-full');
                coverageBadge.textContent = '✓ Covered';
                const tooltipParts = [`${activeShortCalls} contract${activeShortCalls !== 1 ? 's' : ''} sold`];
                if (activeShortCallDetails && activeShortCallDetails.length > 0) {
                    activeShortCallDetails.forEach(detail => {
                        const strikeStr = this.formatCurrency(detail.strike);
                        const expStr = this.formatDate(detail.expiration);
                        tooltipParts.push(`${detail.contracts}x ${strikeStr} Call exp ${expStr}`);
                    });
                }
                coverageBadge.title = tooltipParts.join('\n');
            } else if (coverageStatus === 'partial') {
                coverageBadge.classList.add('coverage-partial');
                coverageBadge.innerHTML = `<span class="coverage-warning-icon">⚠</span> Partial`;
                coverageBadge.title = `${uncoveredShares} of ${shares} shares uncovered\n${activeShortCalls} contract${activeShortCalls !== 1 ? 's' : ''} sold (covers ${coveredShares} shares)`;
            } else {
                coverageBadge.classList.add('coverage-none');
                coverageBadge.innerHTML = `<span class="coverage-alert-icon">⚡</span> Uncovered`;
                coverageBadge.title = `${shares} shares have no active covered call\nSell a call to collect premium and reduce cost basis`;
            }

            coverageWrapper.appendChild(coverageBadge);
            coverageCell.appendChild(coverageWrapper);

            row.insertCell(4).textContent = this.formatDate(assignmentDate);

            const sharesCell = row.insertCell(5);
            sharesCell.textContent = this.formatNumber(shares, { decimals: 0, useGrouping: true }) ?? String(shares);

            row.insertCell(6).textContent = this.formatCurrency(strike);

            const assignmentCostBasisCell = row.insertCell(7);
            assignmentCostBasisCell.textContent = this.formatCurrency(assignmentCostBasis);

            // Premium Collected with formula tooltip
            const premiumCell = row.insertCell(8);
            const premiumWrapper = document.createElement('span');
            premiumWrapper.className = 'formula-value-wrapper';

            const premiumText = document.createElement('span');
            premiumText.textContent = this.formatCurrency(premiumCollected);
            premiumWrapper.appendChild(premiumText);

            const icon = document.createElement('span');
            icon.className = 'formula-info-icon';
            icon.textContent = 'i';
            icon.setAttribute('aria-label', 'View premium breakdown');

            const tooltip = document.createElement('div');
            tooltip.className = 'formula-tooltip';
            tooltip.setAttribute('role', 'tooltip');

            const isPmccPosition = positionType === 'pmcc';
            const componentRows = isPmccPosition
                ? [
                    { name: 'LEAP Cost', value: this.formatCurrency(-Math.abs(longCallCost)) },
                    { name: 'Short Calls Net', value: this.formatCurrency(callPremium) }
                ]
                : [
                    { name: 'Initial CSP Net', value: this.formatCurrency(initialPutPremium) },
                    { name: 'Covered Calls Net', value: this.formatCurrency(callPremium) }
                ];

            let tooltipHTML = '';
            tooltipHTML += '<div class="formula-tooltip__title">Premium Breakdown</div>';
            tooltipHTML += '<div class="formula-tooltip__section">';
            tooltipHTML += '<div class="formula-tooltip__label">Net Premium Collected</div>';
            tooltipHTML += `<div class="formula-tooltip__formula">${this.escapeHtml(this.formatCurrency(premiumCollected))}</div>`;
            tooltipHTML += '</div>';
            tooltipHTML += '<div class="formula-tooltip__section">';
            tooltipHTML += '<div class="formula-tooltip__label">Components</div>';
            tooltipHTML += '<div class="formula-tooltip__variables">';
            componentRows.forEach(r => {
                tooltipHTML += '<div class="formula-tooltip__variable">';
                tooltipHTML += `<span class="formula-tooltip__variable-name">${this.escapeHtml(r.name)}</span>`;
                tooltipHTML += `<span class="formula-tooltip__variable-value">${this.escapeHtml(r.value)}</span>`;
                tooltipHTML += '</div>';
            });
            tooltipHTML += '</div></div>';
            tooltipHTML += '<div class="formula-tooltip__section">';
            tooltipHTML += '<div class="formula-tooltip__label">Activity Log</div>';
            if (premiumHistory && premiumHistory.length > 0) {
                tooltipHTML += '<div class="formula-tooltip__variables">';
                premiumHistory.forEach(item => {
                    tooltipHTML += '<div class="formula-tooltip__variable">';
                    tooltipHTML += `<span class="formula-tooltip__variable-name">${this.escapeHtml(item.label)}</span>`;
                    tooltipHTML += `<span class="formula-tooltip__variable-value">${this.escapeHtml(this.formatCurrency(item.amount))}</span>`;
                    tooltipHTML += '</div>';
                });
                tooltipHTML += '</div>';
            } else {
                tooltipHTML += '<div class="formula-tooltip__explanation">No option premium activity recorded yet.</div>';
            }
            tooltipHTML += '</div>';
            tooltipHTML += '<div class="formula-tooltip__section">';
            if (isPmccPosition) {
                tooltipHTML += '<div class="formula-tooltip__explanation">Net premium reflects short-call activity. Effective basis subtracts these credits from the LEAP cost.</div>';
            } else {
                tooltipHTML += '<div class="formula-tooltip__explanation">Includes initial cash-secured put credit and all covered call legs net of buybacks and fees.</div>';
            }
            tooltipHTML += '</div>';

            tooltip.innerHTML = tooltipHTML;

            premiumWrapper.appendChild(icon);
            premiumWrapper.appendChild(tooltip);

            premiumWrapper.addEventListener('mouseenter', () => {
                this.positionFormulaTooltip(premiumWrapper, tooltip);
            });

            const handleScroll = () => {
                if (premiumWrapper.matches(':hover')) {
                    this.positionFormulaTooltip(premiumWrapper, tooltip);
                }
            };

            window.addEventListener('scroll', handleScroll, { passive: true });
            premiumWrapper.addEventListener('mouseleave', () => {
                window.removeEventListener('scroll', handleScroll);
            }, { once: true });

            premiumCell.appendChild(premiumWrapper);

            // Eff. Cost Basis
            row.insertCell(9).textContent = this.formatCurrency(effectiveCostBasis);

            // Current Price — populated when quote loads
            const currentPriceCell = row.insertCell(10);
            currentPriceCell.className = 'current-price-cell quote-dependent';
            currentPriceCell.textContent = '—';

            // Market Value — populated when quote loads
            const marketValueCell = row.insertCell(11);
            marketValueCell.className = 'market-value-cell quote-dependent';
            marketValueCell.textContent = '—';
            marketValueCell.dataset.shares = String(shares);
            marketValueCell.dataset.effectiveCostBasis = String(effectiveCostBasis);

            // Unrealized Gain/Loss — populated when quote loads
            const unrealizedGLCell = row.insertCell(12);
            unrealizedGLCell.className = 'unrealized-gl-cell quote-dependent';
            unrealizedGLCell.textContent = '—';

            const ticker = ((trade.ticker || '') as string).toString().trim().toUpperCase();
            if (ticker && this.finnhub.apiKey) {
                const baseQuoteKey = this.getQuoteEntryKey(trade);
                const quoteKey = `assigned|${baseQuoteKey}|row:${quoteEntries.size}`;
                row.dataset.quoteKey = quoteKey;
                quoteEntries.set(quoteKey, {
                    trade,
                    row,
                    currentPriceCell,
                    marketValueCell,
                    unrealizedGLCell,
                    shares,
                    effectiveCostBasis,
                    key: quoteKey
                });
            }

            // Notes
            const notesCell = row.insertCell(13);
            notesCell.textContent = (trade.notes as string) || '—';
            notesCell.className = 'notes-col';

            this.applyResponsiveLabels(row, columnLabels);
        });

        if (!this.assignedPositionsQuoteEntries) {
            this.assignedPositionsQuoteEntries = new Map();
        }
        this.assignedPositionsQuoteEntries = quoteEntries;

        if (quoteEntries.size > 0) {
            quoteEntries.forEach((entry, key) => {
                this.activeQuoteEntries.set(key, entry);
            });
            this.rebuildQuoteRefreshSchedule();
            this.startQuoteAutoRefreshIfNeeded();
            this.refreshAssignedPositionsQuotes({ immediate: true });
        }
    }
}

export function updateAssignedPositionMetrics(
    this: AssignedPositionsContext,
    entry: Record<string, unknown>,
    quote: Record<string, unknown>
): void {
    if (!entry || !quote) {
        return;
    }

    const currentPrice = Number(quote?.price);
    const shares = Number(entry.shares);
    const effectiveCostBasis = Number(entry.effectiveCostBasis);

    if (!Number.isFinite(currentPrice) || !Number.isFinite(shares) || !Number.isFinite(effectiveCostBasis)) {
        return;
    }

    const marketValue = currentPrice * shares;
    const unrealizedGL = marketValue - effectiveCostBasis;
    const unrealizedGLPercent = effectiveCostBasis !== 0 ? (unrealizedGL / effectiveCostBasis) * 100 : 0;

    const currentPriceCell = entry.currentPriceCell as HTMLTableCellElement | undefined;
    if (currentPriceCell) {
        currentPriceCell.textContent = this.formatCurrency(currentPrice);
    }

    const marketValueCell = entry.marketValueCell as HTMLTableCellElement | undefined;
    if (marketValueCell) {
        marketValueCell.textContent = this.formatCurrency(marketValue);
    }

    const unrealizedGLCell = entry.unrealizedGLCell as HTMLTableCellElement | undefined;
    if (unrealizedGLCell) {
        unrealizedGLCell.innerHTML = '';

        const absValueEl = document.createElement('span');
        absValueEl.className = 'gl-absolute';
        absValueEl.textContent = this.formatCurrency(unrealizedGL);
        unrealizedGLCell.appendChild(absValueEl);

        const percentEl = document.createElement('span');
        percentEl.className = 'gl-percent';
        const percentMagnitude = Math.abs(unrealizedGLPercent);
        const percentNumber = this.formatNumber(percentMagnitude, { decimals: 2, useGrouping: true })
            ?? percentMagnitude.toFixed(2);
        const percentPrefix = unrealizedGL > 0 ? '+' : unrealizedGL < 0 ? '-' : '';
        percentEl.textContent = `${percentPrefix}${percentNumber}%`;
        unrealizedGLCell.appendChild(percentEl);

        unrealizedGLCell.classList.remove('pl-positive', 'pl-negative', 'pl-neutral');
        if (unrealizedGL > 0) {
            unrealizedGLCell.classList.add('pl-positive');
        } else if (unrealizedGL < 0) {
            unrealizedGLCell.classList.add('pl-negative');
        } else {
            unrealizedGLCell.classList.add('pl-neutral');
        }
    }
}

