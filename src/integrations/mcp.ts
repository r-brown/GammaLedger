// src/integrations/mcp.ts — Wave 5: MCP context building functions.
// Uses the .call(this, …) delegation pattern so all this.* refs work.

type AnyRecord = Record<string, any>
type Streak = { type: 'win' | 'loss' | null; count: number }

interface MCPContextBuilderContext {
  trades: Record<string, unknown>[]
  currentDate: Date | unknown
  calculateAdvancedStats(): any
  getClosedTradesInRange(range: string): Record<string, unknown>[]
  isClosedStatus(status: unknown): boolean
  hasAssignedInventory(trade: Record<string, unknown>): boolean
  isActiveStatus(status: unknown): boolean
  buildMCPTrade(trade: Record<string, unknown>, opts?: Record<string, unknown>): Record<string, unknown> | null
  buildMCPAssignment(a: Record<string, unknown>): Record<string, unknown> | null
}

export function buildMCPContext(this: MCPContextBuilderContext) {
    try {
        const stats = this.calculateAdvancedStats();
        const closedTrades: AnyRecord[] = stats.closedTradesList || [];
        const openTrades: AnyRecord[] = stats.openTradesList || [];
        const r2 = (v: unknown) => {
            if (v === null || v === undefined || v === '') return null;
            const n = Number(v);
            return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
        };
        const r4 = (v: unknown) => {
            if (v === null || v === undefined || v === '') return null;
            const n = Number(v);
            return Number.isFinite(n) ? Math.round(n * 10000) / 10000 : null;
        };
        const compact = (obj: AnyRecord) => Object.fromEntries(
            Object.entries(obj).filter(([, v]) => v !== null && v !== undefined && v !== '')
        );

        // Time-windowed realized P&L using existing getClosedTradesInRange logic
        const sumPL = (trades: Record<string, unknown>[]) => trades.reduce((s, t) => s + (Number(t.pl) || 0), 0);
        const plByRange: Record<string, number | null> = {};
        ['7D', 'MTD', '1M', '3M', 'YTD', '1Y'].forEach((range: string) => {
            plByRange[range] = r2(sumPL(this.getClosedTradesInRange(range)));
        });

        // Current win/loss streak from most-recent closed trades backwards
        const sortedByExit = [...closedTrades]
            .filter((t: AnyRecord) => t.closedDate)
            .sort((a, b) =>
                new Date(b.closedDate).getTime() - new Date(a.closedDate).getTime()
            );
        let streak: Streak = { type: null, count: 0 };
        for (const t of sortedByExit) {
            const pl = Number(t.pl) || 0;
            if (pl > 0) {
                if (streak.type === 'win') streak.count++;
                else if (streak.type === null) streak = { type: 'win', count: 1 };
                else break;
            } else if (pl < 0) {
                if (streak.type === 'loss') streak.count++;
                else if (streak.type === null) streak = { type: 'loss', count: 1 };
                else break;
            }
        }

        // Days since last trade activity (last open or close event)
        const today = (this.currentDate instanceof Date ? this.currentDate : new Date()).getTime();
        const lastActivityMs = this.trades.reduce((max: number, t: AnyRecord) => {
            const closed = t.closedDate ? new Date(t.closedDate).getTime() : 0;
            const opened = t.openedDate ? new Date(t.openedDate).getTime() : 0;
            return Math.max(max, closed || 0, opened || 0);
        }, 0);
        const daysSinceLastTrade = lastActivityMs > 0
            ? Math.max(0, Math.floor((today - lastActivityMs) / 86400000))
            : null;

        // Largest winner / loser (closed trades only)
        const sortedByPL = [...closedTrades]
            .filter((t: AnyRecord) => Number.isFinite(Number(t.pl)))
            .sort((a, b) => (Number(a.pl) || 0) - (Number(b.pl) || 0));
        const briefTrade = (t: AnyRecord | null) => t ? compact({
            id: t.id,
            ticker: t.ticker,
            strategy: t.strategy,
            pl: r2(t.pl),
            roi: r2(t.roi),
            closedDate: t.closedDate || null,
        }) : null;
        const largestWinner = sortedByPL.length ? briefTrade(sortedByPL[sortedByPL.length - 1]) : null;
        const largestLoser = sortedByPL.length ? briefTrade(sortedByPL[0]) : null;

        // Strategy breakdown (full lifecycle counts + closed-trade P&L stats)
        const strategyMap = new Map<string, AnyRecord>();
        this.trades.forEach((t: AnyRecord) => {
            const key = t.strategy || 'Unknown';
            if (!strategyMap.has(key)) {
                strategyMap.set(key, {
                    strategy: key, total: 0, open: 0, closed: 0, assigned: 0,
                    wins: 0, losses: 0, totalPL: 0
                });
            }
            const e = strategyMap.get(key);
            if (!e) return;
            e.total++;
            if (this.isClosedStatus(t.status)) {
                e.closed++;
                const pl = Number(t.pl) || 0;
                e.totalPL += pl;
                if (pl > 0) e.wins++;
                else if (pl < 0) e.losses++;
            } else if (this.hasAssignedInventory(t) && !this.isClosedStatus(t.status)) {
                e.assigned++;
            } else if (this.isActiveStatus(t.status)) {
                e.open++;
            }
        });
        const strategyBreakdown = Array.from(strategyMap.values())
            .map((e: AnyRecord) => compact({
                strategy: e.strategy,
                total: e.total,
                open: e.open || null,
                closed: e.closed || null,
                assigned: e.assigned || null,
                wins: e.wins || null,
                losses: e.losses || null,
                totalPL: r2(e.totalPL),
                winRate: e.closed > 0 ? r2((e.wins / e.closed) * 100) : null,
                avgPL: e.closed > 0 ? r2(e.totalPL / e.closed) : null,
            }))
            .sort((a: AnyRecord, b: AnyRecord) => Math.abs((b.totalPL as number) || 0) - Math.abs((a.totalPL as number) || 0));

        // Underlying-type breakdown (Stock / ETF / Index / Future)
        const underlyingMap = new Map<string, AnyRecord>();
        this.trades.forEach((t: AnyRecord) => {
            const type = t.underlyingType || 'Unknown';
            if (!underlyingMap.has(type)) {
                underlyingMap.set(type, { type, count: 0, totalPL: 0, capitalAtRisk: 0 });
            }
            const e = underlyingMap.get(type);
            if (!e) return;
            e.count++;
            if (this.isClosedStatus(t.status)) e.totalPL += Number(t.pl) || 0;
            if (this.isActiveStatus(t.status)) e.capitalAtRisk += Number(t.capitalAtRisk) || 0;
        });
        const underlyingBreakdown = Array.from(underlyingMap.values()).map((e: AnyRecord) => compact({
            type: e.type,
            count: e.count,
            totalPL: r2(e.totalPL),
            capitalAtRisk: r2(e.capitalAtRisk),
        }));

        // DTE buckets for active positions (technical risk indicator)
        const dteDistribution = { expired: 0, '0-7d': 0, '8-30d': 0, '31-60d': 0, '61-90d': 0, '90d+': 0 };
        openTrades.forEach((t: AnyRecord) => {
            const dte = Number(t.dte);
            if (!Number.isFinite(dte) || dte < 0) dteDistribution.expired++;
            else if (dte <= 7) dteDistribution['0-7d']++;
            else if (dte <= 30) dteDistribution['8-30d']++;
            else if (dte <= 60) dteDistribution['31-60d']++;
            else if (dte <= 90) dteDistribution['61-90d']++;
            else dteDistribution['90d+']++;
        });

        // Concentration: top 5 active positions by capital at risk
        const collateral = Number(stats.collateralAtRisk) || 0;
        const concentration = [...openTrades]
            .filter((t: AnyRecord) => Number.isFinite(Number(t.capitalAtRisk)) && Number(t.capitalAtRisk) > 0)
            .sort((a, b) => (Number(b.capitalAtRisk) || 0) - (Number(a.capitalAtRisk) || 0))
            .slice(0, 5)
            .map((t: AnyRecord) => compact({
                id: t.id,
                ticker: t.ticker,
                strategy: t.strategy,
                capitalAtRisk: r2(t.capitalAtRisk),
                sharePct: collateral > 0
                    ? r2((Number(t.capitalAtRisk) || 0) / collateral * 100)
                    : null,
            }));

        return {
            generatedAt: new Date().toISOString(),
            asOfDate: (this.currentDate instanceof Date ? this.currentDate : new Date())
                .toISOString().slice(0, 10),

            portfolio: {
                counts: {
                    totalTrades: stats.totalTrades,
                    closed: stats.closedTrades,
                    active: stats.activePositions,
                    assigned: stats.assignedPositions,
                    awaitingCoverage: this.trades.filter((t: AnyRecord) => t.lifecycleStatus === 'awaiting_coverage').length,
                },

                pl: compact({
                    total: r2(stats.totalPL),
                    realized: r2(stats.realizedPL),
                    unrealized: r2(stats.unrealizedPL),
                    pendingPremium: r2(stats.pendingPremium),
                    ytd: plByRange.YTD,
                    mtd: plByRange.MTD,
                    last7d: plByRange['7D'],
                    last30d: plByRange['1M'],
                    last90d: plByRange['3M'],
                    last1y: plByRange['1Y'],
                }),

                performance: compact({
                    winRate: r2(stats.winRate),
                    wins: stats.wins,
                    losses: stats.losses,
                    profitFactor: Number.isFinite(stats.profitFactor) ? r4(stats.profitFactor) : null,
                    avgWin: r2(stats.avgWin),
                    avgLoss: r2(stats.avgLoss),
                    expectancy: r2(stats.expectancy),
                    totalROI: r2(stats.totalROI),
                    annualizedROI: r2(stats.annualizedROI),
                    maxDrawdown: r2(stats.maxDrawdown),
                    maxDrawdownDollars: r2(stats.maxDrawdownDollars),
                    sharpeRatio: r4(stats.sharpeRatio),
                    sortinoRatio: r4(stats.sortinoRatio),
                }),

                risk: compact({
                    collateralAtRisk: r2(stats.collateralAtRisk),
                    totalMaxRisk: r2(stats.totalMaxRisk),
                }),

                fees: compact({
                    total: r2(stats.totalFees),
                    shareOfGross: r2(stats.feeShareOfGross),
                }),

                trading: compact({
                    avgWinnerDays: r2(stats.avgWinnerDays),
                    avgLoserDays: r2(stats.avgLoserDays),
                    currentStreak: streak.count > 0 ? streak : null,
                    daysSinceLastTrade,
                }),

                largestWinner,
                largestLoser,
            },

            strategyBreakdown,
            underlyingBreakdown,
            dteDistribution,
            concentration,

            activePositions: openTrades.map((t: AnyRecord) => this.buildMCPTrade(t, { isOpen: true })),

            wheelPmccPositions: (stats.assignmentStats?.assignments || [])
                .filter(({ trade }: { trade: AnyRecord }) => !this.isClosedStatus(trade.status))
                .map((a: AnyRecord) => this.buildMCPAssignment(a)),

            tickerExposure: (stats.tickerPerformance?.items || [])
                .slice(0, 15)
                .map((item: AnyRecord) => compact({
                    ticker: item.ticker,
                    totalPL: r2(item.totalPL),
                    trades: item.tradeCount,
                    wins: item.wins,
                    losses: item.losses,
                    winRate: r2(item.winRate),
                    avgPL: r2(item.avgPL),
                })),

            recentClosedTrades: sortedByExit.slice(0, 10)
                .map((t: AnyRecord) => this.buildMCPTrade(t, { isOpen: false })),
        };
    } catch (e) {
        console.warn('Failed to build MCP context:', e);
        return null;
    }
}

export function buildMCPTrade(this: any, trade: AnyRecord, { isOpen = false }: { isOpen?: boolean } = {}) {
    if (!trade) return null;
    const r2 = (v: unknown) => {
        if (v === null || v === undefined || v === '') return null;
        const n = Number(v);
        return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
    };
    const out: Record<string, unknown> = {
        id: trade.id,
        ticker: trade.ticker,
        strategy: trade.strategy,
        status: trade.status,
        direction: trade.tradeDirection,

        opened: trade.openedDate,
        expires: trade.expirationDate,
        quantity: trade.quantity,
        strike: trade.displayStrike ?? trade.strikePrice ?? null,
        entryPrice: r2(trade.entryPrice),

        pl: r2(trade.pl),
        roi: r2(trade.roi),
        annualizedROI: r2(trade.annualizedROI),

        capitalAtRisk: r2(trade.capitalAtRisk),
        maxRiskLabel: trade.maxRiskLabel,

        cashFlow: r2(trade.cashFlow),
        fees: r2(trade.totalFees),
        daysHeld: trade.daysHeld,
    };

    if (isOpen) {
        out.dte = trade.dte;
        if (trade.riskIsUnlimited) out.riskIsUnlimited = true;
    } else {
        out.closed = trade.closedDate;
        out.exitPrice = r2(trade.exitPrice);
        if (trade.exitReason) out.exitReason = trade.exitReason;
    }

    if (trade.partialClose) out.partialClose = true;
    if (trade.rolledForward) out.rolledForward = true;
    if (trade.autoExpired) out.autoExpired = true;

    // Wheel/PMCC coverage signal — present on every trade so MCP clients can
    // distinguish covered/partial/uncovered/n/a without re-deriving from legs.
    if (trade.wheelCoverage && trade.wheelCoverage !== 'n/a') {
        out.wheelCoverage = trade.wheelCoverage;
    }
    if (trade.lifecycleStatus && trade.lifecycleStatus !== trade.status) {
        out.lifecycleStatus = trade.lifecycleStatus;
    }
    // Mark-to-market fields for trades with held stock/LEAP exposure.
    if (Number.isFinite(Number(trade.unrealizedPL))) {
        out.unrealizedPL = r2(trade.unrealizedPL);
        out.marketValue = r2(trade.marketValue);
        out.effectiveCostBasis = r2(trade.effectiveCostBasis);
        out.shares = trade.shares;
        if (Number.isFinite(Number(trade.marketPriceSnapshot))) {
            out.marketPriceSnapshot = r2(trade.marketPriceSnapshot);
        }
        if (trade.marketPriceSource) {
            out.marketPriceSource = trade.marketPriceSource;
        }
    }

    if (trade.notes) {
        const notes = String(trade.notes).trim();
        if (notes) {
            out.notes = notes.length > 280 ? notes.slice(0, 277) + '...' : notes;
        }
    }

    return Object.fromEntries(
        Object.entries(out).filter(([, v]) => v !== null && v !== undefined && v !== '')
    );
}

export function buildMCPAssignment(this: any, a: AnyRecord) {
    if (!a) return null;
    const r2 = (v: unknown) => {
        if (v === null || v === undefined || v === '') return null;
        const n = Number(v);
        return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
    };
    const history: AnyRecord[] = Array.isArray(a.premiumHistory) ? a.premiumHistory : [];
    const totalPremium = history.reduce((s: number, h: AnyRecord) => s + (Number(h.amount) || 0), 0);

    const out: Record<string, unknown> = {
        id: a.trade?.id,
        ticker: a.trade?.ticker,
        strategy: a.trade?.strategy,
        type: a.positionType, // 'pmcc' | 'wheel' | 'other'
        status: a.trade?.status,

        opened: a.trade?.openedDate,
        assignedOn: a.assignmentDate,
        shares: a.shares,
        strike: r2(a.strike),

        costBasis: r2(a.assignmentCostBasis),
        costBasisPerShare: r2(a.costBasisPerShare),
        effectiveCostBasis: r2(a.effectiveCostBasis),

        initialPutPremium: r2(a.initialPutPremium),
        callPremium: r2(a.callPremium),
        longCallCost: r2(a.longCallCost),
        premiumCollected: r2(a.premiumCollected),
        coveredCallCount: a.coveredCallCount,

        coverageStatus: a.coverageStatus,
        wheelCoverage: a.trade?.wheelCoverage,
        lifecycleStatus: a.trade?.lifecycleStatus,
        marketPriceSnapshot: r2(a.trade?.marketPriceSnapshot),
        marketPriceSnapshotAt: a.trade?.marketPriceSnapshotAt,
        marketValue: r2(a.trade?.marketValue),
        unrealizedPL: r2(a.trade?.unrealizedPL),
        coveredShares: a.coveredShares,
        uncoveredShares: a.uncoveredShares,
        activeShortCalls: a.activeShortCalls,
        activeShortCallDetails: (a.activeShortCallDetails || []).map((d: AnyRecord) => ({
            strike: r2(d.strike),
            expiration: d.expiration,
            contracts: d.contracts,
        })),

        premiumHistorySummary: history.length ? {
            events: history.length,
            total: r2(totalPremium),
            recent: history.slice(-5).map((h: AnyRecord) => ({
                date: h.date,
                amount: r2(h.amount),
                category: h.category,
                label: h.label,
            })),
        } : null,

        pl: r2(a.trade?.pl),
        roi: r2(a.trade?.roi),
    };

    if (a.trade?.notes) {
        const notes = String(a.trade.notes).trim();
        if (notes) {
            out.notes = notes.length > 280 ? notes.slice(0, 277) + '...' : notes;
        }
    }

    if (Array.isArray(out.activeShortCallDetails) && out.activeShortCallDetails.length === 0) {
        delete out.activeShortCallDetails;
    }

    return Object.fromEntries(
        Object.entries(out).filter(([, v]) => v !== null && v !== undefined && v !== '')
    );
}
