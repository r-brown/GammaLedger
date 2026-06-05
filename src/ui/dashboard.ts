// src/ui/dashboard.ts — Wave 10: Main dashboard update orchestration.
// Uses the .call(this, …) delegation pattern.

import type { Stats } from '@types-gl/stats'
import type { EnrichedTrade } from '@types-gl/trade'

interface DashboardContext {
  currentView: string
  latestStats: Stats | null
  assignedPositionsStatusFilter: string
  aiAgent: { updateContext(ctx: Record<string, unknown>): void } | null
  updateActivePositionsTable(trades: EnrichedTrade[]): void
  updateRecentTradesTable(trades: EnrichedTrade[], activeCount: number): void
  updateAssignedPositionsTable(): void
  updateShareCard(stats: Stats): void
  refreshShareCardChart(): void
  syncCumulativePLControls(): void
  updateCreditPlaybookView(): void
  updateAllCharts(): void
  creditPlaybookNeedsRefresh: boolean
  setAssignedPositionsStatusFilter(status: string): void
  syncAssignedPositionsStatusFilter(): void
  calculateAdvancedStats(): Stats
  renderBridge(stats: Stats): void
  renderGroupedMetrics(stats: Stats): void
  renderConcentration(stats: Stats): void
}

export function updateDashboard(this: DashboardContext): void {
    const stats = this.calculateAdvancedStats()
    const { openTradesList, closedTradesList } = stats

    this.latestStats = stats

    if (this.aiAgent) {
        this.aiAgent.updateContext({ stats, openTrades: openTradesList })
    }

    this.renderBridge(stats)
    this.renderGroupedMetrics(stats)
    this.renderConcentration(stats)

    this.updateActivePositionsTable(openTradesList)
    this.updateRecentTradesTable(closedTradesList, stats.activePositions)
    this.updateAssignedPositionsTable()
    this.updateShareCard(stats)
    this.refreshShareCardChart()
    this.syncCumulativePLControls()

    this.creditPlaybookNeedsRefresh = true
    if (this.currentView === 'credit-playbook') {
        this.updateCreditPlaybookView()
    }

    setTimeout(() => {
        this.updateAllCharts()
    }, 200)
}

export function initializeAssignedPositionsStatusFilter(this: DashboardContext): void {
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

        const { status } = (target as HTMLElement).dataset;
        if (!status) {
            return;
        }

        this.setAssignedPositionsStatusFilter(status);
    });

    controls.dataset.initialized = 'true';
    this.syncAssignedPositionsStatusFilter();
}

export function setAssignedPositionsStatusFilter(this: DashboardContext, status: string): void {
    const normalized = status === 'closed' ? 'closed' : 'open';
    if (normalized === this.assignedPositionsStatusFilter) {
        return;
    }

    this.assignedPositionsStatusFilter = normalized;
    this.syncAssignedPositionsStatusFilter();
    this.updateAssignedPositionsTable();
}

export function syncAssignedPositionsStatusFilter(this: DashboardContext): void {
    const controls = document.getElementById('assigned-positions-status-filter');
    if (!controls) {
        return;
    }

    const currentStatus = this.assignedPositionsStatusFilter;
    controls.querySelectorAll('button[data-status]').forEach((button) => {
        const buttonStatus = (button as HTMLElement).dataset.status;
        const isActive = buttonStatus === currentStatus;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', String(isActive));
    });
}
