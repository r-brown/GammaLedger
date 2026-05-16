// src/ai/local-agent.ts
// LocalInsightsAgent — non-LLM heuristic fallback for the AI coach.
// Migrated verbatim from class GammaLedger's monolith file.

interface AppInterface {
    getCapitalAtRisk(trade: Record<string, unknown>): number
    formatCurrency(value: unknown, options?: Record<string, unknown>): string
    formatPercent?(value: unknown, fallback?: string, options?: Record<string, unknown>): string
    formatNumber?(value: unknown, options?: Record<string, unknown>): string | null
}

interface AgentStats {
    closedTrades?: number
    totalPL?: number
    winRate?: number
    profitFactor?: number
    totalROI?: number
    annualizedROI?: number
    maxDrawdown?: number
    avgLoserDays?: number
    avgWinnerDays?: number
    activePositions?: number
    tickerPerformance?: Record<string, { pl?: number; trades?: number; wins?: number; losses?: number }>
    [key: string]: unknown
}

interface StrategyEntry {
    name: string
    pl: number
    trades: number
    wins: number
    losses: number
}

export class LocalInsightsAgent {
    app: AppInterface
    context: { stats: AgentStats | null; openTrades: Record<string, unknown>[] }

    constructor(app: AppInterface) {
        this.app = app;
        this.context = {
            stats: null,
            openTrades: []
        };
    }

    updateContext({ stats, openTrades }: { stats?: AgentStats; openTrades?: unknown[] } = {}): void {
        if (stats) {
            this.context.stats = stats;
        }
        if (Array.isArray(openTrades)) {
            this.context.openTrades = openTrades as Record<string, unknown>[];
        }
    }

    hasTradeHistory(): boolean {
        const hasOpen = (this.context.openTrades?.length || 0) > 0;
        const hasClosed = (this.context.stats?.closedTrades || 0) > 0;
        return hasOpen || hasClosed;
    }

    getGreeting(): string {
        if (!this.hasTradeHistory()) {
            return 'Hi! I\'m your local AI coach. Add or import a few trades and I\'ll help you analyze risk and performance.';
        }

        const stats = this.context.stats;
        if (!stats) {
            return 'Hi! I\'m your local AI coach. Ask about performance, risk, or next steps.';
        }

        const openCount = this.context.openTrades?.length || 0;
        const closedCount = this.context.stats?.closedTrades || 0;
        return `Hi! I'm your local AI coach. You have ${openCount} active ${openCount === 1 ? 'position' : 'positions'} and ${closedCount} closed trades with realised P&L of ${this.formatCurrency(stats.totalPL)}.`;
    }

    generateResponse(query = ''): string {
        const prompt = query.trim();
        if (!prompt) {
            return 'I can run a portfolio health check, review risk exposure, or suggest strategy adjustments. Try asking for a quick portfolio health check.';
        }

        if (!this.hasTradeHistory()) {
            return 'Log a few trades first and I\'ll start surfacing insights about risk, performance, and strategy.';
        }

        const parts: string[] = [];
        const performance = this.buildPerformanceSummary();
        if (performance) {
            parts.push(performance);
        }

        const risk = this.buildRiskHeadline();
        if (risk) {
            parts.push(risk);
        }

        const strategy = this.buildStrategyHeadline();
        if (strategy) {
            parts.push(strategy);
        }

        const coaching = this.buildCoachingHighlight();
        if (coaching) {
            parts.push(coaching);
        }

        if (!parts.length) {
            parts.push('Portfolio data is limited, but keep logging trades and I\'ll highlight trends as they emerge.');
        }

        return parts.join('\n\n');
    }

    buildPerformanceSummary(): string {
        const stats = this.context.stats;
        if (!stats) {
            return '';
        }

        const closed = stats.closedTrades || 0;
        if (!closed) {
            return 'No closed trades yet. Once you realize some P&L I\'ll summarize your performance here.';
        }

        const winRate = this.formatPercent(stats.winRate, '—', { decimals: 1 });
        const profitFactor = stats.profitFactor === Number.POSITIVE_INFINITY
            ? 'Infinite'
            : Number.isFinite(stats.profitFactor)
                ? (stats.profitFactor as number).toFixed(2)
                : '—';
        const totalROI = this.formatPercent(stats.totalROI, '—');
        return `Closed trades: ${closed}, realised P&L ${this.formatCurrency(stats.totalPL)}, win rate ${winRate}, profit factor ${profitFactor}, total ROI ${totalROI}.`;
    }

    buildRiskHeadline(): string {
        const openTrades = this.context.openTrades || [];
        if (!openTrades.length) {
            return 'No open positions right now, so live risk exposure is minimal.';
        }

        let totalRisk = 0;
        let largestRisk = 0;
        let largestTrade: Record<string, unknown> | null = null;

        openTrades.forEach(trade => {
            const risk = Math.max(0, Number(this.app.getCapitalAtRisk(trade)) || 0);
            totalRisk += risk;
            if (risk > largestRisk) {
                largestRisk = risk;
                largestTrade = trade;
            }
        });

        if (!totalRisk) {
            return 'Open positions detected, but max risk looks minimal based on current data.';
        }

        if (largestTrade && totalRisk) {
            const share = ((largestRisk / totalRisk) * 100).toFixed(0);
            const ticker = ((largestTrade as Record<string, unknown>).ticker || 'Unknown').toString().toUpperCase();
            return `Open risk across ${openTrades.length} ${openTrades.length === 1 ? 'position' : 'positions'} is ${this.formatCurrency(totalRisk)}. ${ticker} carries the largest share at ${share}% of exposure.`;
        }

        return `Open risk across ${openTrades.length} ${openTrades.length === 1 ? 'position' : 'positions'} is ${this.formatCurrency(totalRisk)}.`;
    }

    buildStrategyHeadline(): string {
        const breakdown = this.getStrategyBreakdown();
        if (!breakdown.length) {
            return '';
        }

        const best = breakdown[0];
        if (!best) {
            return '';
        }

        const winRate = best.trades > 0 ? ((best.wins / best.trades) * 100).toFixed(0) : '0';
        return `${best.name} leads with ${this.formatCurrency(best.pl)} across ${best.trades} trades (win rate ${winRate}%).`;
    }

    buildCoachingHighlight(): string {
        const stats = this.context.stats;
        if (!stats) {
            return '';
        }

        const avgLossDays = stats.avgLoserDays;
        const avgWinDays = stats.avgWinnerDays;

        if (Number.isFinite(avgLossDays) && Number.isFinite(avgWinDays)) {
            const diff = (avgLossDays as number) - (avgWinDays as number);
            if (diff >= 2) {
                return `Losing trades stay open about ${Math.round(diff)} days longer than winners—tighten exits to cut risk sooner.`;
            }
            if (diff <= -2) {
                return `You let winners run roughly ${Math.round(Math.abs(diff))} days longer than losers—keep scaling out to lock in gains.`;
            }
        }

        if (Number.isFinite(stats.winRate) && (stats.winRate as number) < 45 && (stats.closedTrades || 0) >= 5) {
            return 'Win rate is under 45%. Focus on highest-conviction setups or scale size down until consistency improves.';
        }

        return '';
    }

    getStrategyBreakdown(): StrategyEntry[] {
        const tickerPerformance = this.context.stats?.tickerPerformance;
        if (!tickerPerformance || typeof tickerPerformance !== 'object') {
            return [];
        }

        return Object.entries(tickerPerformance)
            .map(([ticker, data]) => ({
                name: ticker,
                pl: data.pl || 0,
                trades: data.trades || 0,
                wins: data.wins || 0,
                losses: data.losses || 0
            }))
            .sort((a, b) => b.pl - a.pl);
    }

    formatCurrency(value: unknown, options?: Record<string, unknown>): string {
        return this.app.formatCurrency(value, options);
    }

    formatPercent(value: unknown, fallback = '—', options: Record<string, unknown> = {}): string {
        if (this.app && typeof this.app.formatPercent === 'function') {
            return this.app.formatPercent(value, fallback, options) ?? fallback;
        }

        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
            return fallback;
        }

        const specifiedDecimals = options && Number.isInteger(options.decimals)
            ? Math.max(0, options.decimals as number)
            : 2;
        return `${numeric.toFixed(specifiedDecimals)}%`;
    }
}

