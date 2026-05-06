// src/ui/dashboard.js — Wave 10: Main dashboard update orchestration.
// Uses the .call(this, …) delegation pattern.

export function updateDashboard() {
    const stats = this.calculateAdvancedStats();
    const {
        openTradesList,
        closedTradesList
    } = stats;

    this.latestStats = stats;

    if (this.aiAgent) {
        this.aiAgent.updateContext({
            stats,
            openTrades: openTradesList
        });
    }

    // Update overview cards
    const winRateFormatted = this.formatNumber(stats.winRate, { style: 'percent', decimals: 1 });
    document.getElementById('win-rate').textContent = winRateFormatted ?? '—';
    document.getElementById('win-loss-count').textContent = `${stats.wins}W / ${stats.losses}L`;
    const profitFactorValue = Number(stats.profitFactor);
    document.getElementById('profit-factor').textContent = Number.isFinite(profitFactorValue)
        ? this.formatNumber(profitFactorValue, { decimals: 2, useGrouping: false }).toString()
        : 'Infinite';
    document.getElementById('active-positions').textContent = stats.activePositions;
    document.getElementById('assigned-positions').textContent = stats.assignedPositions;
    
    // Update new metrics
    document.getElementById('collateral-at-risk').textContent = this.formatCurrency(stats.collateralAtRisk);
    
    const realizedPLElement = document.getElementById('realized-pl');
    realizedPLElement.textContent = this.formatCurrency(stats.realizedPL);
    realizedPLElement.className = 'card-value';
    if (stats.realizedPL > 0) {
        realizedPLElement.classList.add('pl-positive');
    } else if (stats.realizedPL < 0) {
        realizedPLElement.classList.add('pl-negative');
    }
    
    const unrealizedPLElement = document.getElementById('unrealized-pl');
    unrealizedPLElement.textContent = this.formatCurrency(stats.unrealizedPL);
    unrealizedPLElement.className = 'card-value';
    if (stats.unrealizedPL > 0) {
        unrealizedPLElement.classList.add('pl-positive');
    } else if (stats.unrealizedPL < 0) {
        unrealizedPLElement.classList.add('pl-negative');
    }
    
    document.getElementById('total-roi').textContent = this.formatNumber(stats.totalROI, { style: 'percent' }) ?? '—';

    // Update new advanced metrics
    const maxDrawdownElement = document.getElementById('max-drawdown');
    if (maxDrawdownElement) {
        maxDrawdownElement.textContent = this.formatNumber(stats.maxDrawdown, { style: 'percent', decimals: 1 }) ?? '0%';
        maxDrawdownElement.className = 'card-value';
        if (stats.maxDrawdown > 20) {
            maxDrawdownElement.classList.add('pl-negative');
        } else if (stats.maxDrawdown > 10) {
            maxDrawdownElement.classList.add('pl-warning');
        }
    }

    const avgWinLossElement = document.getElementById('avg-win-loss');
    if (avgWinLossElement) {
        const avgWinFormatted = this.formatCurrency(stats.avgWin, { compact: true });
        const avgLossFormatted = this.formatCurrency(stats.avgLoss, { compact: true });
        avgWinLossElement.textContent = `${avgWinFormatted} / ${avgLossFormatted}`;
    }

    const expectancyElement = document.getElementById('expectancy');
    if (expectancyElement) {
        expectancyElement.textContent = this.formatCurrency(stats.expectancy);
        expectancyElement.className = 'card-value';
        if (stats.expectancy > 0) {
            expectancyElement.classList.add('pl-positive');
        } else if (stats.expectancy < 0) {
            expectancyElement.classList.add('pl-negative');
        }
    }

    const sharpeElement = document.getElementById('sharpe-ratio');
    if (sharpeElement) {
        const sharpeValue = stats.sharpeRatio;
        if (Number.isFinite(sharpeValue)) {
            sharpeElement.textContent = sharpeValue.toFixed(2);
            sharpeElement.className = 'card-value';
            if (sharpeValue >= 1) {
                sharpeElement.classList.add('pl-positive');
            } else if (sharpeValue < 0) {
                sharpeElement.classList.add('pl-negative');
            }
        } else {
            sharpeElement.textContent = '—';
        }
    }

    // Update tables
    this.updateActivePositionsTable(openTradesList);
    this.updateRecentTradesTable(closedTradesList, stats.activePositions);
    this.updateAssignedPositionsTable();
    this.updateShareCard(stats);
    this.refreshShareCardChart();
    this.syncCumulativePLControls();

    this.creditPlaybookNeedsRefresh = true;
    if (this.currentView === 'credit-playbook') {
        this.updateCreditPlaybookView();
    }

    // Update charts with delay
    setTimeout(() => {
        this.updateAllCharts();
    }, 200);
}

export function initializeAssignedPositionsStatusFilter() {
    const controls = document.getElementById('assigned-positions-status-filter');
    if (!controls) {
        return;
    }

    if (controls.dataset.initialized === 'true') {
        this.syncAssignedPositionsStatusFilter();
        return;
    }

    controls.addEventListener('click', (event) => {
        const target = event.target instanceof HTMLElement
            ? event.target.closest('button[data-status]')
            : null;
        if (!target) {
            return;
        }

        const { status } = target.dataset;
        if (!status) {
            return;
        }

        this.setAssignedPositionsStatusFilter(status);
    });

    controls.dataset.initialized = 'true';
    this.syncAssignedPositionsStatusFilter();
}

export function setAssignedPositionsStatusFilter(status) {
    const normalized = status === 'closed' ? 'closed' : 'open';
    if (normalized === this.assignedPositionsStatusFilter) {
        return;
    }

    this.assignedPositionsStatusFilter = normalized;
    this.syncAssignedPositionsStatusFilter();
    this.updateAssignedPositionsTable();
}

export function syncAssignedPositionsStatusFilter() {
    const controls = document.getElementById('assigned-positions-status-filter');
    if (!controls) {
        return;
    }

    const currentStatus = this.assignedPositionsStatusFilter;
    controls.querySelectorAll('button[data-status]').forEach((button) => {
        const buttonStatus = button.dataset.status;
        const isActive = buttonStatus === currentStatus;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', String(isActive));
    });
}
