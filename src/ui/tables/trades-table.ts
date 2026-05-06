// src/ui/tables/trades-table.ts — Wave 9: Trades table rendering and actions.
// Uses the .call(this, …) delegation pattern.

type TradeRecord = Record<string, unknown>

interface TradesTableContext {
  trades: TradeRecord[]
  currentFilteredTrades: TradeRecord[]
  currentSort: { key: string; direction: string } | null
  sortDirection: Record<string, string>
  tradesMergePanelOpen: boolean
  tradeMergeSelection: Set<unknown>
  tradeDetailCharts: Map<string, { destroy(): void }> | null
  isClosedStatus(status: unknown): boolean
  formatDate(value: unknown): string
  formatCurrency(value: unknown, opts?: Record<string, unknown>): string
  formatPercent(value: unknown, fallback: string, opts?: Record<string, unknown>): string
  createTickerElement(ticker: unknown, className?: string, opts?: Record<string, unknown>): HTMLElement
  getDisplayStatus(trade: TradeRecord): string
  createFormulaIcon(trade: TradeRecord, field: string): HTMLElement | null
  toggleTradePayoffDetail(row: HTMLTableRowElement, detailRow: HTMLTableRowElement, trade: TradeRecord, chartId: string, footnoteId: string): void
  editTrade(id: unknown): void
  deleteTrade(id: unknown): void
  applyResponsiveLabels(row: HTMLTableRowElement, labels: string[]): void
  setupTradesMergeControls?(): void
  pruneTradeMergeSelection(): void
  syncSelectAllCheckbox(): void
  refreshTradesMergePanelContents(): void
  syncTradeSelectionCheckboxes(): void
  updateMergeColumnVisibility(): void
  applySortToTrades(trades: TradeRecord[], sortKey: string, direction: string): TradeRecord[]
  populateFilters(): void
  filterTrades(): void
  renderTradesTable(trades?: TradeRecord[]): void
  updateDashboard(): void
  resetAddTradeForm(): void
  renderLegForms(legs: unknown[]): void
  showView(viewName: string): void
  normalizeUnderlyingType(value: unknown, opts: { fallback: string }): string
  normalizeTradeStatusInput(value: unknown): string | null
  openTradesFilteredByTicker(ticker: unknown): void
  saveToStorage(): void
  markUnsavedChanges(): void
  enrichTradeData(data: TradeRecord): TradeRecord
  currentEditingId: unknown
  updateTickerPreview(ticker: string): void
  escapeHtml(value: string): string
}

export function updateTradesList(this: TradesTableContext): void {
    this.populateFilters();
    this.filterTrades();
}

export function renderTradesTable(this: TradesTableContext, trades: TradeRecord[] = this.trades): void {
    const tbody = document.querySelector('#trades-table tbody') as HTMLTableSectionElement | null;
    if (!tbody) return;

    const tradesToRender = Array.isArray(trades) ? trades.slice() : [];
    this.currentFilteredTrades = tradesToRender;

    if (typeof this.setupTradesMergeControls === 'function') {
        this.setupTradesMergeControls();
    }

    tbody.innerHTML = '';

    if (this.tradeDetailCharts?.size) {
        this.tradeDetailCharts.forEach(chart => {
            try {
                chart.destroy();
            } catch (error) {
                console.warn('Failed to destroy payoff chart:', error);
            }
        });
        this.tradeDetailCharts.clear();
    }

    this.pruneTradeMergeSelection();

    const safeNumber = (value: unknown): number | null => {
        const num = Number(value);
        return Number.isFinite(num) ? num : null;
    };

    const columnLabels = [
        '', 'Ticker', 'Strategy', 'Strike', 'Qty', 'Entry Date', 'Expiration Date',
        'DTE', 'Exit Date', 'Days Held', 'Max Risk', 'P&L', 'ROI', 'Weekly ROI', 'Monthly ROI', 'Annual ROI', 'Status', 'Actions'
    ];

    tradesToRender.forEach((trade, index) => {
        const row = tbody.insertRow();
        row.classList.add('trade-summary-row');

        const selectionCell = row.insertCell();
        selectionCell.className = 'trade-select-cell';
        selectionCell.classList.toggle('is-hidden', !this.tradesMergePanelOpen);
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'trade-merge-checkbox';
        checkbox.dataset.tradeId = (trade.id as string) || '';
        checkbox.checked = trade.id ? this.tradeMergeSelection.has(trade.id) : false;
        checkbox.disabled = !this.tradesMergePanelOpen;
        checkbox.tabIndex = this.tradesMergePanelOpen ? 0 : -1;
        checkbox.setAttribute('aria-label', `Select trade ${(trade.ticker as string) || ''}`.trim());
        checkbox.addEventListener('change', (event) => {
            event.stopPropagation();
            if (!this.tradesMergePanelOpen) {
                (event.target as HTMLInputElement).checked = trade.id ? this.tradeMergeSelection.has(trade.id) : false;
                return;
            }
            const id = trade.id;
            if (!id) {
                (event.target as HTMLInputElement).checked = false;
                return;
            }
            if ((event.target as HTMLInputElement).checked) {
                this.tradeMergeSelection.add(id);
            } else {
                this.tradeMergeSelection.delete(id);
            }
            this.syncSelectAllCheckbox();
            this.refreshTradesMergePanelContents();
        });
        selectionCell.appendChild(checkbox);

        const tickerCell = row.insertCell();
        tickerCell.appendChild(this.createTickerElement(trade.ticker));

        const strategyCell = row.insertCell();
        strategyCell.textContent = (trade.strategy as string) || '—';

        const strikeCell = row.insertCell();
        const strikeDisplay = trade.displayStrike || null;
        const strikePrice = safeNumber(trade.strikePrice);
        if (strikeDisplay) {
            strikeCell.textContent = strikeDisplay as string;
        } else if (strikePrice !== null) {
            strikeCell.textContent = `$${strikePrice.toFixed(2)}`;
        } else {
            strikeCell.textContent = '—';
        }

        const quantityCell = row.insertCell();
        const quantityValue = safeNumber(trade.quantity);
        quantityCell.textContent = quantityValue !== null ? String(Math.abs(quantityValue)) : '—';

        const entryDateCell = row.insertCell();
        entryDateCell.textContent = this.formatDate(trade.entryDate);

        const expirationCell = row.insertCell();
        expirationCell.textContent = this.formatDate(trade.expirationDate);

        const dteCell = row.insertCell();
        const dteValue = safeNumber(trade.dte);
        dteCell.textContent = dteValue !== null ? String(dteValue) : '—';

        const exitDateCell = row.insertCell();
        const isClosed = this.isClosedStatus(trade.status);
        exitDateCell.textContent = (isClosed && trade.exitDate) ? this.formatDate(trade.exitDate) : '—';

        const daysHeldCell = row.insertCell();
        const daysHeldValue = safeNumber(trade.daysHeld);
        daysHeldCell.textContent = daysHeldValue !== null ? String(daysHeldValue) : '—';

        const maxRiskCell = row.insertCell();
        const maxRiskValue = safeNumber(trade.maxRisk);

        const maxRiskText = document.createTextNode(
            (trade.maxRiskLabel as string) ||
            (maxRiskValue !== null ? this.formatCurrency(maxRiskValue) : '—')
        );

        maxRiskCell.appendChild(maxRiskText);

        if (trade.strategy && (trade.maxRiskLabel || maxRiskValue !== null)) {
            const formulaIcon = this.createFormulaIcon(trade, 'maxRisk');
            if (formulaIcon) {
                maxRiskCell.appendChild(formulaIcon);
            }
        }

        if (trade.maxRiskLabel) {
            maxRiskCell.className = (trade.riskIsUnlimited as boolean) ? 'pl-negative' : 'pl-neutral';
            if (!(trade.riskIsUnlimited as boolean) && maxRiskValue !== null) {
                maxRiskCell.className = 'pl-negative';
            }
        } else if (maxRiskValue !== null) {
            maxRiskCell.className = 'pl-negative';
        } else {
            maxRiskCell.className = 'pl-neutral';
        }

        const plCell = row.insertCell();
        const plValue = safeNumber(trade.pl);

        const plText = document.createTextNode(
            plValue !== null ? this.formatCurrency(plValue) : '—'
        );

        plCell.appendChild(plText);

        if (trade.strategy && plValue !== null) {
            const formulaIcon = this.createFormulaIcon(trade, 'pl');
            if (formulaIcon) {
                plCell.appendChild(formulaIcon);
            }
        }

        if (plValue !== null) {
            plCell.className = plValue > 0 ? 'pl-positive' : plValue < 0 ? 'pl-negative' : 'pl-neutral';
        } else {
            plCell.className = 'pl-neutral';
        }

        const roiCell = row.insertCell();
        const roiValue = safeNumber(trade.roi);
        const roiDisplay = roiValue !== null ? this.formatPercent(roiValue, '—') : '—';
        roiCell.textContent = roiDisplay;
        if (roiDisplay === '—') {
            roiCell.className = 'pl-neutral';
        } else {
            roiCell.className = (roiValue as number) > 0 ? 'pl-positive' : (roiValue as number) < 0 ? 'pl-negative' : 'pl-neutral';
        }

        const weeklyRoiCell = row.insertCell();
        const weeklyROIValue = safeNumber(trade.weeklyROI);
        const hasWeeklyROI = this.isClosedStatus(trade.status) && weeklyROIValue !== null;
        if (hasWeeklyROI) {
            const weeklyDisplay = this.formatPercent(weeklyROIValue, '—');
            weeklyRoiCell.textContent = weeklyDisplay;
            weeklyRoiCell.className = (weeklyROIValue as number) > 0 ? 'pl-positive' : (weeklyROIValue as number) < 0 ? 'pl-negative' : 'pl-neutral';
        } else {
            weeklyRoiCell.textContent = '—';
            weeklyRoiCell.className = 'pl-neutral';
        }

        const monthlyRoiCell = row.insertCell();
        const monthlyROIValue = safeNumber(trade.monthlyROI);
        const hasMonthlyROI = this.isClosedStatus(trade.status) && monthlyROIValue !== null;
        if (hasMonthlyROI) {
            const monthlyDisplay = this.formatPercent(monthlyROIValue, '—');
            monthlyRoiCell.textContent = monthlyDisplay;
            monthlyRoiCell.className = (monthlyROIValue as number) > 0 ? 'pl-positive' : (monthlyROIValue as number) < 0 ? 'pl-negative' : 'pl-neutral';
        } else {
            monthlyRoiCell.textContent = '—';
            monthlyRoiCell.className = 'pl-neutral';
        }

        const annRoiCell = row.insertCell();
        const annualROIValue = safeNumber(trade.annualizedROI);
        const hasAnnualROI = this.isClosedStatus(trade.status) && annualROIValue !== null;
        if (hasAnnualROI) {
            const annualDisplay = this.formatPercent(annualROIValue, '—');
            annRoiCell.textContent = annualDisplay;
            annRoiCell.className = (annualROIValue as number) > 0 ? 'pl-positive' : (annualROIValue as number) < 0 ? 'pl-negative' : 'pl-neutral';
        } else {
            annRoiCell.textContent = '—';
            annRoiCell.className = 'pl-neutral';
        }

        const statusCell = row.insertCell();
        const statusBadge = document.createElement('span');
        const displayStatus = this.getDisplayStatus(trade);
        const statusClass = displayStatus.toLowerCase().replace(/\s+/g, '-');
        statusBadge.className = `status-badge ${statusClass}`.trim();
        statusBadge.textContent = displayStatus;
        statusCell.appendChild(statusBadge);

        const actionsCell = row.insertCell();
        actionsCell.className = 'actions-cell';

        const chartKeyBase = trade.id ?? trade.tradeId ?? trade.uniqueId ?? `${(trade.ticker as string) || 'trade'}-${index}`;
        const safeChartId = `trade-pl-${chartKeyBase}`.toString().replace(/[^a-zA-Z0-9_-]/g, '-');
        const footnoteId = `${safeChartId}-footnote`;

        const plButton = document.createElement('button');
        plButton.type = 'button';
        plButton.className = 'action-btn action-btn--pl';
        plButton.textContent = 'P&L';
        plButton.title = 'View payoff diagram';
        plButton.addEventListener('click', (event) => {
            event.stopPropagation();
            const detailRow = tbody.querySelector(`.trade-detail-row[data-chart-id="${safeChartId}"]`) as HTMLTableRowElement | null;
            if (detailRow) {
                this.toggleTradePayoffDetail(row, detailRow, trade, safeChartId, footnoteId);
            }
        });

        const editButton = document.createElement('button');
        editButton.type = 'button';
        editButton.className = 'action-btn action-btn--edit';
        editButton.textContent = 'Edit';
        editButton.addEventListener('click', (event) => {
            event.stopPropagation();
            this.editTrade(trade.id);
        });

        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'action-btn action-btn--delete';
        deleteButton.textContent = 'Delete';
        deleteButton.addEventListener('click', (event) => {
            event.stopPropagation();
            this.deleteTrade(trade.id);
        });

        actionsCell.append(plButton, editButton, deleteButton);

        row.setAttribute('tabindex', '0');
        row.setAttribute('aria-expanded', 'false');
        row.setAttribute('aria-controls', safeChartId);
        row.dataset.chartId = safeChartId;

        const detailRow = tbody.insertRow();
        detailRow.className = 'trade-detail-row';
        detailRow.setAttribute('aria-hidden', 'true');
        detailRow.style.display = 'none';
        detailRow.dataset.chartId = safeChartId;

        const detailCell = detailRow.insertCell(0);
        detailCell.colSpan = columnLabels.length;

        const diagramContainer = document.createElement('div');
        diagramContainer.className = 'trade-diagram';
        diagramContainer.setAttribute('data-chart-container', safeChartId);

        const canvasWrapper = document.createElement('div');
        canvasWrapper.className = 'trade-diagram__canvas';

        const canvas = document.createElement('canvas');
        canvas.id = safeChartId;
        canvas.setAttribute('aria-hidden', 'true');

        const footnote = document.createElement('p');
        footnote.className = 'trade-diagram__footnote';
        footnote.id = footnoteId;
        footnote.textContent = 'Tap or click the trade row to generate the payoff diagram.';

        canvasWrapper.appendChild(canvas);
        diagramContainer.appendChild(canvasWrapper);
        diagramContainer.appendChild(footnote);
        detailCell.appendChild(diagramContainer);

        const toggleDetail = () => {
            this.toggleTradePayoffDetail(row, detailRow, trade, safeChartId, footnoteId);
        };

        row.addEventListener('click', (event) => {
            const target = event.target as HTMLElement;
            if (target.closest('button') || target.closest('a') || target.closest('input') || target.closest('.trade-diagram')) {
                return;
            }
            toggleDetail();
        });

        row.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                toggleDetail();
            }
        });

        this.applyResponsiveLabels(row, columnLabels);
    });

    this.syncTradeSelectionCheckboxes();
    this.updateMergeColumnVisibility();
    this.refreshTradesMergePanelContents();
}

export function sortTrades(this: TradesTableContext, sortBy: string): void {
    if (!sortBy) {
        return;
    }

    const direction = this.sortDirection[sortBy] === 'asc' ? 'desc' : 'asc';
    this.sortDirection[sortBy] = direction;
    this.currentSort = {
        key: sortBy,
        direction
    };

    const tradesTable = document.getElementById('trades-table');
    if (tradesTable) {
        tradesTable.querySelectorAll('.sortable').forEach((header) => {
            header.classList.remove('asc', 'desc');
            header.removeAttribute('aria-sort');
        });
        const sortHeader = tradesTable.querySelector(`[data-sort="${sortBy}"]`);
        if (sortHeader) {
            sortHeader.classList.add(direction);
            sortHeader.setAttribute('aria-sort', direction === 'asc' ? 'ascending' : 'descending');
        }
    }

    const sourceTrades = Array.isArray(this.currentFilteredTrades)
        ? this.currentFilteredTrades
        : this.trades;
    const sortedTrades = this.applySortToTrades(sourceTrades, sortBy, direction);

    this.currentFilteredTrades = sortedTrades.slice();
    this.renderTradesTable(sortedTrades);
}

export function deleteTrade(this: TradesTableContext, id: unknown): void {
    if (confirm('Are you sure you want to delete this trade?')) {
        this.trades = this.trades.filter(trade => trade.id !== id);
        this.saveToStorage();
        this.markUnsavedChanges();
        this.filterTrades();
        this.updateDashboard();
    }
}

export function editTrade(this: TradesTableContext, id: unknown): void {
    const trade = this.trades.find(t => t.id === id);
    if (!trade) {
        return;
    }

    this.resetAddTradeForm();
    this.currentEditingId = id;

    const form = document.getElementById('add-trade-form') as HTMLFormElement | null;
    if (!form) {
        return;
    }

    const elements = form.elements as HTMLFormControlsCollection & {
        ticker?: HTMLInputElement;
        strategy?: HTMLInputElement;
        exitReason?: HTMLInputElement;
        notes?: HTMLInputElement;
        underlyingType?: HTMLSelectElement;
        tradeStatus?: HTMLSelectElement;
    };

    if (elements.ticker) {
        elements.ticker.value = (trade.ticker as string) || '';
    }
    if (elements.strategy) {
        elements.strategy.value = (trade.strategy as string) || '';
    }
    if (elements.exitReason) {
        elements.exitReason.value = (trade.exitReason as string) || '';
    }
    if (elements.notes) {
        elements.notes.value = (trade.notes as string) || '';
    }
    if (elements.underlyingType) {
        const normalizedUnderlying = this.normalizeUnderlyingType(trade.underlyingType, { fallback: 'Stock' }) || 'Stock';
        elements.underlyingType.value = normalizedUnderlying;
    }
    if (elements.tradeStatus) {
        const manualStatus = this.normalizeTradeStatusInput(trade.statusOverride);
        elements.tradeStatus.value = manualStatus || '';
    }

    this.renderLegForms((trade.legs as unknown[]) || []);
    this.updateTickerPreview((trade.ticker as string) || '');

    this.showView('add-trade');
}

// NOTE: updateTickerPreview is implemented in views.ts and provided to this module
// via the host class mixin — declared in the primary interface above.




