// src/ui/tables/trades-table.js — Wave 9: Trades table rendering and actions.
// Uses the .call(this, …) delegation pattern.

export function updateTradesList() {
    this.populateFilters();
    this.filterTrades();
}

export function renderTradesTable(trades = this.trades) {
    const tbody = document.querySelector('#trades-table tbody');
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

    const safeNumber = (value) => {
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
        checkbox.dataset.tradeId = trade.id || '';
        checkbox.checked = trade.id ? this.tradeMergeSelection.has(trade.id) : false;
        checkbox.disabled = !this.tradesMergePanelOpen;
        checkbox.tabIndex = this.tradesMergePanelOpen ? 0 : -1;
        checkbox.setAttribute('aria-label', `Select trade ${trade.ticker || ''}`.trim());
        checkbox.addEventListener('change', (event) => {
            event.stopPropagation();
            if (!this.tradesMergePanelOpen) {
                event.target.checked = trade.id ? this.tradeMergeSelection.has(trade.id) : false;
                return;
            }
            const id = trade.id;
            if (!id) {
                event.target.checked = false;
                return;
            }
            if (event.target.checked) {
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
        strategyCell.textContent = trade.strategy || '—';

        const strikeCell = row.insertCell();
        const strikeDisplay = trade.displayStrike || null;
        const strikePrice = safeNumber(trade.strikePrice);
        if (strikeDisplay) {
            strikeCell.textContent = strikeDisplay;
        } else if (strikePrice !== null) {
            strikeCell.textContent = `$${strikePrice.toFixed(2)}`;
        } else {
            strikeCell.textContent = '—';
        }

        const quantityCell = row.insertCell();
        const quantityValue = safeNumber(trade.quantity);
        quantityCell.textContent = quantityValue !== null ? Math.abs(quantityValue) : '—';

        const entryDateCell = row.insertCell();
        entryDateCell.textContent = this.formatDate(trade.entryDate);

        const expirationCell = row.insertCell();
        expirationCell.textContent = this.formatDate(trade.expirationDate);

        const dteCell = row.insertCell();
        const dteValue = safeNumber(trade.dte);
        dteCell.textContent = dteValue !== null ? dteValue : '—';

        const exitDateCell = row.insertCell();
        // Only show exit date for closed statuses (Closed, Expired)
        const isClosed = this.isClosedStatus(trade.status);
        exitDateCell.textContent = (isClosed && trade.exitDate) ? this.formatDate(trade.exitDate) : '—';

        const daysHeldCell = row.insertCell();
        const daysHeldValue = safeNumber(trade.daysHeld);
        daysHeldCell.textContent = daysHeldValue !== null ? daysHeldValue : '—';

        const maxRiskCell = row.insertCell();
        const maxRiskValue = safeNumber(trade.maxRisk);
        
        // Create text node for the value
        const maxRiskText = document.createTextNode(
            trade.maxRiskLabel || 
            (maxRiskValue !== null ? this.formatCurrency(maxRiskValue) : '—')
        );
        
        // Add the value
        maxRiskCell.appendChild(maxRiskText);
        
        // Add formula icon if we have a valid strategy
        if (trade.strategy && (trade.maxRiskLabel || maxRiskValue !== null)) {
            const formulaIcon = this.createFormulaIcon(trade, 'maxRisk');
            if (formulaIcon) {
                maxRiskCell.appendChild(formulaIcon);
            }
        }
        
        // Set cell class
        if (trade.maxRiskLabel) {
            maxRiskCell.className = trade.riskIsUnlimited ? 'pl-negative' : 'pl-neutral';
            if (!trade.riskIsUnlimited && maxRiskValue !== null) {
                maxRiskCell.className = 'pl-negative';
            }
        } else if (maxRiskValue !== null) {
            maxRiskCell.className = 'pl-negative';
        } else {
            maxRiskCell.className = 'pl-neutral';
        }

        const plCell = row.insertCell();
        const plValue = safeNumber(trade.pl);
        
        // Create text node for P&L value
        const plText = document.createTextNode(
            plValue !== null ? this.formatCurrency(plValue) : '—'
        );
        
        // Add the value
        plCell.appendChild(plText);
        
        // Add formula icon if we have a valid P&L value and strategy
        if (trade.strategy && plValue !== null) {
            const formulaIcon = this.createFormulaIcon(trade, 'pl');
            if (formulaIcon) {
                plCell.appendChild(formulaIcon);
            }
        }
        
        // Set cell class
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
            roiCell.className = roiValue > 0 ? 'pl-positive' : roiValue < 0 ? 'pl-negative' : 'pl-neutral';
        }

        const weeklyRoiCell = row.insertCell();
        const weeklyROIValue = safeNumber(trade.weeklyROI);
        const hasWeeklyROI = this.isClosedStatus(trade.status) && weeklyROIValue !== null;
        if (hasWeeklyROI) {
            const weeklyDisplay = this.formatPercent(weeklyROIValue, '—');
            weeklyRoiCell.textContent = weeklyDisplay;
            weeklyRoiCell.className = weeklyROIValue > 0 ? 'pl-positive' : weeklyROIValue < 0 ? 'pl-negative' : 'pl-neutral';
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
            monthlyRoiCell.className = monthlyROIValue > 0 ? 'pl-positive' : monthlyROIValue < 0 ? 'pl-negative' : 'pl-neutral';
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
            annRoiCell.className = annualROIValue > 0 ? 'pl-positive' : annualROIValue < 0 ? 'pl-negative' : 'pl-neutral';
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

        const chartKeyBase = trade.id ?? trade.tradeId ?? trade.uniqueId ?? `${trade.ticker || 'trade'}-${index}`;
        const safeChartId = `trade-pl-${chartKeyBase}`.toString().replace(/[^a-zA-Z0-9_-]/g, '-');
        const footnoteId = `${safeChartId}-footnote`;
        
        const plButton = document.createElement('button');
        plButton.type = 'button';
        plButton.className = 'action-btn action-btn--pl';
        plButton.textContent = 'P&L';
        plButton.title = 'View payoff diagram';
        plButton.addEventListener('click', (event) => {
            event.stopPropagation();
            const detailRow = tbody.querySelector(`.trade-detail-row[data-chart-id="${safeChartId}"]`);
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
        
        // Create elements using DOM methods to avoid XSS risk
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
            if (event.target.closest('button') || event.target.closest('a') || event.target.closest('input') || event.target.closest('.trade-diagram')) {
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

export function sortTrades(sortBy) {
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

export function deleteTrade(id) {
    if (confirm('Are you sure you want to delete this trade?')) {
        this.trades = this.trades.filter(trade => trade.id !== id);
        this.saveToStorage();
        this.markUnsavedChanges();
        this.filterTrades();
        this.updateDashboard();
    }
}

export function editTrade(id) {
    const trade = this.trades.find(t => t.id === id);
    if (!trade) {
        return;
    }

    this.resetAddTradeForm();
    this.currentEditingId = id;

    const form = document.getElementById('add-trade-form');
    if (!form) {
        return;
    }

    const elements = form.elements;

    if (elements.ticker) {
        elements.ticker.value = trade.ticker || '';
    }
    if (elements.strategy) {
        elements.strategy.value = trade.strategy || '';
    }
    if (elements.exitReason) {
        elements.exitReason.value = trade.exitReason || '';
    }
    if (elements.notes) {
        elements.notes.value = trade.notes || '';
    }
    if (elements.underlyingType) {
        const normalizedUnderlying = this.normalizeUnderlyingType(trade.underlyingType, { fallback: 'Stock' }) || 'Stock';
        elements.underlyingType.value = normalizedUnderlying;
    }
    if (elements.tradeStatus) {
        const manualStatus = this.normalizeTradeStatusInput(trade.statusOverride);
        elements.tradeStatus.value = manualStatus || '';
    }

    this.renderLegForms(trade.legs || []);
    this.updateTickerPreview(trade.ticker || '');

    this.showView('add-trade');
}
