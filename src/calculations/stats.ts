// src/calculations/stats.ts — Wave 3: Advanced stats, assignment and ticker performance.
// Uses the .call(this, …) delegation pattern.

import type { DollarAmount } from '@types-gl/common'
import type { EnrichedTrade } from '@types-gl/trade'
import type { NormalizedLeg } from '@types-gl/leg'
import type { TickerPerformance, TickerPerformanceItem, RiskBand, CollateralConcentration } from '@types-gl/stats'
import type { LegRealizationSummary } from './leg-realization.js'
import { APP_CONFIG } from '@core/config.js'

/**
 * Minimum GammaLedger context surface required by stats calculations.
 * GammaLedger fulfils this interface at runtime via .call(this, …).
 * TODO Phase 3: replace with typed GammaLedger reference once src/index.ts is converted.
 *
 * NOTE: Several return types below use `unknown` for intermediate values
 * (e.g. leg wrappers) where the full type is defined in other modules that
 * would create circular imports at this stage.
 */
interface StatsContext {
    trades: EnrichedTrade[]

    // Status helpers
    isClosedStatus(status: string | null | undefined): boolean
    isAssignedStatus(status: string | null | undefined): boolean
    isActiveStatus(status: string | null | undefined): boolean
    isFullyRealizedTrade(trade: EnrichedTrade): boolean
    calculateRealizedPL(trade: EnrichedTrade): DollarAmount
    summarizeLegRealization(trade: EnrichedTrade): LegRealizationSummary

    // Trade-shape predicates
    isWheelOrPmccTrade(trade: EnrichedTrade): boolean
    isPmccTrade(trade: EnrichedTrade): boolean
    hasAssignedInventory(trade: EnrichedTrade): boolean

    // Open-leg helpers
    hasNetOpenOptionLegs(trade: EnrichedTrade): boolean
    getNetOpenShortCalls(legs: NormalizedLeg[]): { contracts: number; details: unknown[] }

    // P&L helpers — implemented in pnl.ts, also present on this
    getCapitalAtRisk(trade: EnrichedTrade): DollarAmount

    // Self-references (class methods delegate to these module functions)
    calculateAssignmentStats(trades: EnrichedTrade[]): ReturnType<typeof calculateAssignmentStats>
    calculateTickerPerformance(trades: EnrichedTrade[]): TickerPerformance

    // Leg helpers
    getLegAction(leg: NormalizedLeg): string
    getLegSide(leg: NormalizedLeg): string
    getLegMultiplier(leg: NormalizedLeg): number
    calculateLegCashFlow(leg: NormalizedLeg): number

    // Date / format helpers
    parseDateValue(value: unknown): Date | null
    formatDate(dateString: string): string
}

function classifyShare(sharePct: number): RiskBand {
    const { TARGET_SHARE_PCT, CRITICAL_SHARE_PCT } = APP_CONFIG.RISK_RULES
    if (sharePct > CRITICAL_SHARE_PCT) return 'critical'
    if (sharePct > TARGET_SHARE_PCT) return 'high'
    return 'ok'
}

function assertPositiveMultiplier(value: unknown, context: string): number {
    const multiplier = Number(value);
    if (!Number.isFinite(multiplier) || multiplier <= 0) {
        throw new Error(`Invalid ${context} multiplier: ${String(value)}`);
    }
    return multiplier;
}

// ---------------------------------------------------------------------------
// calculateAdvancedStats
// NOTE: The Stats interface in src/types/stats.ts has minor mismatches with
// the actual return shape:
//   - sharpeRatio / sortinoRatio may be null (typed as number in Stats)
//   - feeShareOfGross / grossExposure are returned but not in Stats
//   - assignedTradesList is AssignmentRecord[], not EnrichedTrade[]
// These are acceptable in permissive mode (strictNullChecks: false).
// TODO Phase 5 strict: align Stats type with actual return.
// ---------------------------------------------------------------------------
export function calculateAdvancedStats(this: StatsContext) {
    // Fully-realized trades for P&L purposes: closed, expired, and assigned
    // trades whose option exposure has fully unwound (i.e. not promoted to
    // active via the wheel/PMCC active-short-calls path).
    const closedTrades = this.trades.filter(trade => this.isFullyRealizedTrade(trade));
    // Use hasAssignedInventory (event + shares still held) so fully-closed
    // wheel cycles aren't re-promoted into openTrades via assignedWithActiveOptions.
    // Assigned options never get explicit closing legs, so hasNetOpenOptionLegs
    // alone would let closed wheels slip through and inflate collateralAtRisk.
    const assignedTrades = this.trades.filter(trade => this.hasAssignedInventory(trade));
    // Awaiting-coverage trades (uncovered/partial wheel/PMCC) live only in the
    // Wheel/PMCC tracker — exclude from Active Trades and from "expired" buckets.
    let openTrades = this.trades.filter(trade =>
        this.isActiveStatus(trade.status) && trade.lifecycleStatus !== 'awaiting_coverage'
    );
    const awaitingCoverageTrades = this.trades.filter(trade => trade.lifecycleStatus === 'awaiting_coverage');
    const wheelPmccTrades = this.trades.filter(trade => {
        const isWheelPmcc = this.isWheelOrPmccTrade(trade);
        const meta = (trade as unknown as Record<string, unknown>).lifecycleMeta as { hasAssignmentEvent?: boolean } | undefined;
        const isAssigned = Boolean(meta?.hasAssignmentEvent);
        // Include all Wheel/PMCC and Assigned trades — closed ones are shown
        // when the user selects the "Closed" filter in the tracker table.
        return isWheelPmcc || isAssigned;
    });

    // Promote assigned wheel/PMCC trades to "open" only when coverage is full
    // (active short calls covering all assigned shares). Partial/uncovered are
    // routed to the Wheel/PMCC tracker via `awaitingCoverageTrades`.
    const assignedWithActiveOptions = assignedTrades.filter(trade =>
        this.isWheelOrPmccTrade(trade)
        && trade.lifecycleStatus !== 'awaiting_coverage'
        && this.hasNetOpenOptionLegs(trade)
    );
    if (assignedWithActiveOptions.length) {
        const openTradeMap = new Map<string, EnrichedTrade>();
        openTrades.forEach(trade => {
            if (trade) {
                const key = String(trade.id ?? `${trade.ticker || 'trade'}-${trade.openedDate || ''}`);
                openTradeMap.set(key, trade);
            }
        });
        assignedWithActiveOptions.forEach(trade => {
            if (trade) {
                const key = String(trade.id ?? `${trade.ticker || 'assigned'}-${trade.openedDate || ''}`);
                openTradeMap.set(key, trade);
            }
        });
        openTrades = Array.from(openTradeMap.values());
    }

    // closedTrades is now the canonical set of realized trades (closed + expired
    // + assigned-without-active-options). Assigned trades with active short
    // calls remain promoted to openTrades and contribute to unrealizedPL.
    //
    // Use calculateRealizedPL (not trade.pl) so non-closed trades contribute
    // only realized option P&L from terminated contract groups — never the
    // stock-leg cost basis or premiums from still-open legs.
    const realizedPLByTrade = new Map<EnrichedTrade, number>();
    closedTrades.forEach(trade => {
        const pl = Number(this.calculateRealizedPL(trade));
        realizedPLByTrade.set(trade, Number.isFinite(pl) ? pl : 0);
    });
    const realizedPLOf = (trade: EnrichedTrade): number => realizedPLByTrade.get(trade) ?? 0;

    const winningTrades = closedTrades.filter(trade => realizedPLOf(trade) > 0);
    const losingTrades = closedTrades.filter(trade => realizedPLOf(trade) < 0);

    const totalPL = closedTrades.reduce((sum, trade) => sum + realizedPLOf(trade), 0);

    const totalMaxRisk = closedTrades.reduce((sum, trade) => {
        const capital = this.getCapitalAtRisk(trade);
        return Number.isFinite(capital) && capital > 0 ? sum + capital : sum;
    }, 0);
    const winRate = closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0;

    const totalWins = winningTrades.reduce((sum, trade) => sum + Math.max(realizedPLOf(trade), 0), 0);
    const totalLosses = losingTrades.reduce((sum, trade) => sum + Math.abs(realizedPLOf(trade)), 0);
    let profitFactor = 0;
    if (totalLosses > 0) {
        profitFactor = totalWins / totalLosses;
    } else if (totalWins > 0) {
        profitFactor = Number.POSITIVE_INFINITY;
    }

    // Max drawdown of the trade-ordered cumulative realized P&L curve.
    // Dollars are the primary metric: without an account-capital base,
    // percent-of-peak-P&L is not an equity drawdown and can read absurdly
    // large early in a track record. The percent is kept for existing
    // consumers (MCP context, AI agents) and shown as "% of peak" in the UI.
    let maxDrawdown = 0;
    let maxDrawdownDollars = 0;
    let peak = 0;
    let cumulativePL = 0;

    const sortedTrades = [...closedTrades].sort((a, b) => {
        const aTime = new Date((a.closedDate || a.openedDate) as string).getTime();
        const bTime = new Date((b.closedDate || b.openedDate) as string).getTime();
        return (Number.isFinite(aTime) ? aTime : 0) - (Number.isFinite(bTime) ? bTime : 0);
    });
    sortedTrades.forEach(trade => {
        cumulativePL += realizedPLOf(trade);
        if (cumulativePL > peak) {
            peak = cumulativePL;
        }
        const drawdownDollars = peak - cumulativePL;
        if (drawdownDollars > maxDrawdownDollars) {
            maxDrawdownDollars = drawdownDollars;
        }
        const drawdown = peak > 0 ? (drawdownDollars / peak) * 100 : 0;
        if (drawdown > maxDrawdown) {
            maxDrawdown = drawdown;
        }
    });

    // Calculate Total ROI (Annualized) using capital-days weighted average
    // This is the financially correct aggregation across trades of varying size and duration
    // Formula: Σ(trade_annualized_ROI × trade_weight) / Σ(trade_weight)
    // where trade_weight = collateral_used × days_held (capital-days at risk)
    let totalWeight = 0;
    let weightedAnnualizedROISum = 0;

    closedTrades.forEach(trade => {
        const collateral = this.getCapitalAtRisk(trade);
        const daysHeld = Math.max(1, Number(trade.daysHeld) || 0);
        // Compute annualizedROI from realizedPLOf (not trade.annualizedROI) so
        // assigned-in-flight trades use option-leg P&L, not raw cashFlow that
        // includes stock-leg debits.
        const realized = realizedPLOf(trade);
        const roiPercent = collateral > 0 ? (realized / collateral) * 100 : 0;
        const tradeAnnualizedROI = (365 * roiPercent) / daysHeld;

        if (Number.isFinite(collateral) && collateral > 0 && Number.isFinite(tradeAnnualizedROI)) {
            const tradeWeight = collateral * daysHeld;
            totalWeight += tradeWeight;
            weightedAnnualizedROISum += tradeAnnualizedROI * tradeWeight;
        }
    });

    // Total ROI is now the weighted average annualized ROI
    const totalROI = totalWeight > 0 ? weightedAnnualizedROISum / totalWeight : 0;

    // Keep avgDaysHeld for reference/other uses, annualizedROI is now same as totalROI
    const avgDaysHeld = closedTrades.length > 0 ? closedTrades.reduce((sum, trade) => sum + trade.daysHeld, 0) / closedTrades.length : 0;
    const annualizedROI = totalROI;

    const totalFees = closedTrades.reduce((sum, trade) => {
        const fees = Number(trade.totalFees);
        if (Number.isFinite(fees)) {
            return sum + fees;
        }
        const fallback = Number(trade.fees);
        return Number.isFinite(fallback) ? sum + fallback : sum;
    }, 0);

    const grossExposure = totalFees + totalWins + totalLosses;
    const feeShareOfGross = grossExposure > 0 ? (totalFees / grossExposure) * 100 : 0;

    const dailyReturns: number[] = closedTrades
        .map(trade => {
            // Derive ROI from realizedPLOf so assigned-in-flight trades use
            // option-leg-only P&L, not the raw cashFlow that includes stock cost.
            const capital = this.getCapitalAtRisk(trade);
            const realized = realizedPLOf(trade);
            const daysHeldValue = Math.max(1, Number(trade.daysHeld) || 0);

            if (!(capital > 0)) {
                return null;
            }
            const derivedRoi = (realized / capital) * 100;
            if (!Number.isFinite(derivedRoi)) {
                return null;
            }
            const growth = 1 + derivedRoi / 100;
            if (growth > 0) {
                return Math.pow(growth, 1 / daysHeldValue) - 1;
            }
            return (derivedRoi / 100) / daysHeldValue;
        })
        .filter((value): value is number => Number.isFinite(value as number));

    const meanDailyReturn = dailyReturns.length
        ? dailyReturns.reduce((sum, value) => sum + value, 0) / dailyReturns.length
        : 0;

    let dailyStdDev = 0;
    if (dailyReturns.length > 1) {
        const variance = dailyReturns.reduce((sum, value) => sum + Math.pow(value - meanDailyReturn, 2), 0) / (dailyReturns.length - 1);
        dailyStdDev = variance > 0 ? Math.sqrt(variance) : 0;
    }

    const downsideReturns = dailyReturns.filter(value => value < 0);
    // Standard Sortino denominator: sum of squared downside returns over the
    // FULL sample size N (MAR = 0). Dividing by only the losing count would
    // overstate downside deviation and understate the ratio vs. convention.
    const downsideDeviation = dailyReturns.length
        ? Math.sqrt(downsideReturns.reduce((sum, value) => sum + value * value, 0) / dailyReturns.length)
        : 0;

    // sharpeRatio / sortinoRatio may be null — Stats interface types these as number,
    // acceptable under strictNullChecks: false (Phase 2 permissive mode).
    // Both are trade-level approximations: one daily-equivalent return per
    // closed trade (not a daily equity curve), position overlap ignored, no
    // risk-free rate — labeled "(approx.)" in the UI.
    const sharpeRatio: number | null = dailyStdDev > 0 ? (meanDailyReturn / dailyStdDev) * Math.sqrt(252) : null;
    const sortinoRatio: number | null = downsideDeviation > 0
        ? (meanDailyReturn / downsideDeviation) * Math.sqrt(252)
        : (downsideReturns.length === 0 && meanDailyReturn > 0 ? Number.POSITIVE_INFINITY : null);

    const avgWinnerDays = winningTrades.length > 0
        ? winningTrades.reduce((sum, trade) => sum + (Number(trade.daysHeld) || 0), 0) / winningTrades.length
        : 0;

    const avgLoserDays = losingTrades.length > 0
        ? losingTrades.reduce((sum, trade) => sum + (Number(trade.daysHeld) || 0), 0) / losingTrades.length
        : 0;

    const tickerPerformance = this.calculateTickerPerformance(closedTrades);

    // Calculate new metrics for dashboard widgets
    // Collateral at Risk: Total capital tied up in open positions
    const collateralAtRisk = openTrades.reduce((sum, trade) => {
        const capital = this.getCapitalAtRisk(trade);
        return Number.isFinite(capital) && capital > 0 ? sum + capital : sum;
    }, 0);

    const collateralByTickerMap = new Map<string, number>()
    for (const trade of openTrades) {
        const capital = this.getCapitalAtRisk(trade)
        if (!Number.isFinite(capital) || capital <= 0) continue
        const ticker = String((trade as { ticker?: unknown }).ticker ?? '').trim() || '—'
        collateralByTickerMap.set(ticker, (collateralByTickerMap.get(ticker) ?? 0) + capital)
    }
    const collateralByTicker: CollateralConcentration[] = Array.from(collateralByTickerMap.entries())
        .map(([ticker, capital]) => {
            const share = collateralAtRisk > 0 ? capital / collateralAtRisk : 0
            return { ticker, capital, share, band: classifyShare(share * 100) }
        })
        .sort((a, b) => b.capital - a.capital)

    // Non-closed trades (open/rolling/promoted-assigned) can hold realized
    // option P&L from terminated contract groups: an assigned wheel's CSP
    // credit and finished CC cycles, a PMCC's expired short calls, a rolling
    // CSP's completed roll cycles. Compute it once per trade so we can add it
    // to realizedPL and subtract it from the unrealizedPL contribution (it is
    // embedded in trade.pl either via the effectiveCostBasis reduction in the
    // priced branch or via raw cashFlow in the fallback — consistent either way).
    // Awaiting-coverage actives are included — see awaitingCoverageActives above.

    // Active awaiting-coverage trades (e.g. an uncovered PMCC whose earlier
    // short calls already terminated) are excluded from openTrades but can
    // still hold realized leg P&L. Fully-realized awaiting-coverage trades
    // (assigned wheels) are already inside closedTrades/totalPL — exclude
    // them here to avoid double counting.
    const awaitingCoverageActives = awaitingCoverageTrades.filter(
        trade => !this.isFullyRealizedTrade(trade));

    const openTradeRealizedPL = new Map<EnrichedTrade, number>();
    let openTradeRealizedPLTotal = 0;
    for (const trade of [...openTrades, ...awaitingCoverageActives]) {
        const realized = Number(this.calculateRealizedPL(trade));
        const finite = Number.isFinite(realized) ? realized : 0;
        if (finite !== 0) openTradeRealizedPL.set(trade, finite);
        openTradeRealizedPLTotal += finite;
    }

    // Disclosure metrics over all non-closed trades:
    //   pendingPremium — net cash already booked on open option groups
    //     ("collected but not yet earned"): the number a premium seller
    //     watches. Realized in full only if the contracts expire worthless.
    //   realizationAnomalies — data-integrity flags from the realization
    //     engine (orphan closing legs / closes dated after expiration) that
    //     silently distort realized P&L until the leg data is corrected.
    let pendingPremium = 0;
    let anomalyOrphanGroups = 0;
    let anomalyCloseAfterExpiry = 0;
    const anomalyTickers = new Set<string>();
    for (const trade of this.trades) {
        if (this.isClosedStatus(trade.status)) continue;
        const realization = this.summarizeLegRealization(trade);
        pendingPremium += realization.openCashFlow;
        if (realization.orphanCloseGroups > 0 || realization.closeAfterExpiryLegs > 0) {
            anomalyOrphanGroups += realization.orphanCloseGroups;
            anomalyCloseAfterExpiry += realization.closeAfterExpiryLegs;
            anomalyTickers.add(String(trade.ticker ?? trade.id ?? '?'));
        }
    }
    const realizationAnomalies = {
        orphanCloseGroups: anomalyOrphanGroups,
        closeAfterExpiryLegs: anomalyCloseAfterExpiry,
        tickers: Array.from(anomalyTickers)
    };

    // wheelAssignedPremium stays scoped to in-flight assigned wheel/PMCC
    // positions (see types/stats.ts) — the dashboard renders it as
    // "Wheel premium", so the broader open-trade realized total must not
    // leak into it.
    const wheelAssignedPremiumTotal = assignedWithActiveOptions.reduce(
        (sum, trade) => sum + (openTradeRealizedPL.get(trade) ?? 0), 0);

    // Realized P&L inside open positions that is NOT wheel-assigned premium
    // (PMCC short-call cycles, rolling CSP cycles, expired legs of open
    // trades). Third term of the dashboard bridge:
    // realizedPL = closedTradesPL + wheelAssignedPremium + openTradeRealizedPL.
    const openTradeRealizedPLResidual = openTradeRealizedPLTotal - wheelAssignedPremiumTotal;

    // Realized P&L: closed/expired trades + realized option premiums from
    // terminated contract groups inside non-closed trades.
    const realizedPL = totalPL + openTradeRealizedPLTotal;

    // Unrealized P&L: estimated current P&L on open positions plus mark-to-market
    // on awaiting-coverage wheel/PMCC stock holdings, minus the realized portion
    // moved to realizedPL above.
    const unrealizedPL = openTrades.reduce((sum, trade) => {
        const pl = Number(trade.pl);
        if (!Number.isFinite(pl)) return sum;
        const adjustment = openTradeRealizedPL.get(trade) ?? 0;
        return sum + pl - adjustment;
    }, 0) + awaitingCoverageTrades.reduce((sum, trade) => {
        const pl = Number(trade.unrealizedPL);
        if (!Number.isFinite(pl)) return sum;
        const adjustment = openTradeRealizedPL.get(trade) ?? 0;
        return sum + pl - adjustment;
    }, 0);

    // Calculate average win and average loss
    const avgWin: DollarAmount = winningTrades.length > 0
        ? winningTrades.reduce((sum, trade) => sum + realizedPLOf(trade), 0) / winningTrades.length
        : 0;
    const avgLoss: DollarAmount = losingTrades.length > 0
        ? Math.abs(losingTrades.reduce((sum, trade) => sum + realizedPLOf(trade), 0) / losingTrades.length)
        : 0;

    // Calculate expectancy: (Win Rate × Avg Win) - (Loss Rate × Avg Loss)
    const winRateDecimal = closedTrades.length > 0 ? winningTrades.length / closedTrades.length : 0;
    const lossRateDecimal = closedTrades.length > 0 ? losingTrades.length / closedTrades.length : 0;
    const expectancy: DollarAmount = (winRateDecimal * avgWin) - (lossRateDecimal * avgLoss);

    // Calculate assignment statistics
    const assignmentStats = this.calculateAssignmentStats(wheelPmccTrades);

    return {
        totalTrades: this.trades.length,
        totalPL,
        winRate,
        wins: winningTrades.length,
        losses: losingTrades.length,
        profitFactor,
        activePositions: openTrades.length,
        assignedPositions: assignmentStats.totalAssignments,
        awaitingCoveragePositions: awaitingCoverageTrades.length,
        totalROI,
        annualizedROI,
        maxDrawdown,
        maxDrawdownDollars,
        closedTrades: closedTrades.length,
        totalInvestment: totalMaxRisk,
        totalMaxRisk,
        closedTradesList: closedTrades,
        openTradesList: openTrades,
        assignedTradesList: assignmentStats.assignments,
        totalFees,
        feeShareOfGross,
        dailyReturns,
        meanDailyReturn,
        dailyStdDev,
        downsideDeviation,
        sharpeRatio,
        sortinoRatio,
        avgWinnerDays,
        avgLoserDays,
        avgDaysHeld,
        tickerPerformance,
        collateralAtRisk,
        closedTradesPL: totalPL,
        wheelAssignedPremium: wheelAssignedPremiumTotal,
        openTradeRealizedPL: openTradeRealizedPLResidual,
        collateralByTicker,
        realizedPL,
        unrealizedPL,
        pendingPremium: parseFloat(pendingPremium.toFixed(2)),
        realizationAnomalies,
        avgWin,
        avgLoss,
        expectancy,
        assignmentStats
    };
}

// ---------------------------------------------------------------------------
// calculateAssignmentStats
// NOTE: Return type is inferred — richer than AssignmentStats in types library.
// TODO Phase 5 strict: reconcile with src/types/stats.ts AssignmentStats.
// ---------------------------------------------------------------------------
export function calculateAssignmentStats(this: StatsContext, assignedTrades: EnrichedTrade[]) {
    const assignments = assignedTrades
        .map(trade => {
        const legs = Array.isArray(trade.legs) ? trade.legs : [];
        let positionType: string = 'other';
        const isPmcc = this.isPmccTrade(trade);
        if (isPmcc) {
            positionType = 'pmcc';
        } else if (this.isWheelOrPmccTrade(trade)) {
            positionType = 'wheel';
        }

        const normalizedLegs = legs.map(leg => {
            const type = (leg.type || leg.optionType || '').toString().trim().toUpperCase();
            const action = this.getLegAction(leg);
            const side = this.getLegSide(leg);
            const executionDate = this.parseDateValue(leg.executionDate);
            const quantity = Math.abs(Number(leg.quantity) || 0);
            const multiplier = this.getLegMultiplier(leg) || 1;
            const premium = Number(leg.premium) || 0;

            return {
                leg,
                type,
                action,
                side,
                executionDate,
                quantity,
                multiplier,
                premium
            };
        });

        // Find ALL stock legs (not just the first one)
        const stockLegs = normalizedLegs.filter(item => item.type === 'STOCK' && item.action === 'BUY' && item.side === 'OPEN');
        const stockLegInfo = stockLegs[0]; // Keep first for compatibility with strike/date logic

        if (positionType === 'other' && stockLegs.length > 0) {
            positionType = 'wheel';
        }

        // Assigned CSP trades may not have stock legs (e.g. import created
        // the stock in a separate trade entry).  Treat them as wheel so they
        // show up in the wheel/assignment tracker.
        const tradeMeta = (trade as unknown as Record<string, unknown>).lifecycleMeta as { hasAssignmentEvent?: boolean } | undefined;
        if (positionType === 'other' && Boolean(tradeMeta?.hasAssignmentEvent)) {
            positionType = 'wheel';
        }
        const stockDate = stockLegInfo?.executionDate || null;

        let shares = 100;
        if (stockLegs.length > 0) {
            // Sum shares from ALL stock assignments
            const totalShares = stockLegs.reduce((sum, item) => {
                const legShares = (item.quantity || 0) * assertPositiveMultiplier(item.multiplier, 'assignment stock leg');
                return sum + legShares;
            }, 0);
            if (totalShares > 0) {
                shares = totalShares;
            }
        } else {
            const referenceLeg = normalizedLegs.find(item => ['CALL', 'PUT'].includes(item.type) && item.quantity > 0 && item.multiplier > 0);
            if (referenceLeg) {
                const computedShares = referenceLeg.quantity * referenceLeg.multiplier;
                if (computedShares > 0) {
                    shares = computedShares;
                }
            }
        }

        let assignmentStrike: number = Number(trade.strikePrice) || 0;
        if (stockLegs.length > 0) {
            // Calculate weighted average assignment strike from all stock legs
            let totalCost = 0;
            let totalShares = 0;

            stockLegs.forEach(item => {
                const legShares = (item.quantity || 0) * assertPositiveMultiplier(item.multiplier, 'assignment stock leg');
                const premiumPerShare = Number(item.leg.premium);
                const strikeFromLeg = Number(item.leg.strike);

                let pricePerShare = 0;
                if (Number.isFinite(strikeFromLeg) && strikeFromLeg > 0) {
                    pricePerShare = strikeFromLeg;
                } else if (Number.isFinite(premiumPerShare) && premiumPerShare > 0) {
                    pricePerShare = premiumPerShare;
                }

                if (pricePerShare > 0 && legShares > 0) {
                    totalCost += pricePerShare * legShares;
                    totalShares += legShares;
                }
            });

            if (totalShares > 0) {
                assignmentStrike = totalCost / totalShares; // Weighted average
            }
        }

        const premiumHistory: Array<{ date: string; amount: DollarAmount; label: string; category: string }> = [];
        const addPremiumEvent = (item: typeof normalizedLegs[number], amount: number, category: string): void => {
            const rawDate: string = item.leg.executionDate || (item.executionDate ? item.executionDate.toISOString().slice(0, 10) : '');
            const formattedDate = this.formatDate(rawDate);
            const actionParts: string[] = [];
            if (item.action === 'SELL') {
                actionParts.push('Sell');
            } else if (item.action === 'BUY') {
                actionParts.push('Buy');
            }

            if (item.type === 'CALL') {
                actionParts.push('Call');
            } else if (item.type === 'PUT') {
                actionParts.push('Put');
            }

            if (item.side === 'OPEN') {
                actionParts.push('to Open');
            } else if (item.side === 'CLOSE') {
                actionParts.push('to Close');
            } else if (item.side === 'ROLL') {
                actionParts.push('Roll');
            }

            const label = actionParts.length > 0 ? `${formattedDate} · ${actionParts.join(' ')}` : formattedDate;

            premiumHistory.push({
                date: rawDate,
                amount,
                label,
                category
            });
        };

        const chronologicalLegs = [...normalizedLegs].sort((a, b) => {
            const aDate = a.executionDate instanceof Date ? a.executionDate.getTime() : Number.NEGATIVE_INFINITY;
            const bDate = b.executionDate instanceof Date ? b.executionDate.getTime() : Number.NEGATIVE_INFINITY;
            if (aDate === bDate) {
                return 0;
            }
            return aDate - bDate;
        });

        let initialPutPremiumTotal = 0;
        let callPremiumNet = 0;
        let coveredCallSellCount = 0;
        let longCallCost = 0;
        let shortCallNet = 0;
        let pmccShortStrike = 0;
        let pmccSellCount = 0;

        const pmccLongCallLegs = positionType === 'pmcc'
            ? chronologicalLegs.filter(item => item.type === 'CALL' && item.action === 'BUY' && item.side === 'OPEN')
            : [];
        const longCallLegIds = new Set(pmccLongCallLegs.map(item => item.leg.id));
        const primaryLongCall = pmccLongCallLegs.length > 0
            ? pmccLongCallLegs.reduce((latest, current) => {
                const latestExp = this.parseDateValue(latest?.leg?.expirationDate) || this.parseDateValue(latest?.leg?.expiration) || null;
                const currentExp = this.parseDateValue(current?.leg?.expirationDate) || this.parseDateValue(current?.leg?.expiration) || null;
                if (!latestExp) {
                    return currentExp ? current : latest;
                }
                if (!currentExp) {
                    return latest;
                }
                return currentExp.getTime() > latestExp.getTime() ? current : latest;
            })
            : null;

        let assignmentDateValue: string | null = trade.closedDate || null;
        if (positionType === 'pmcc') {
            const longCallExecution = primaryLongCall?.executionDate;
            if (longCallExecution instanceof Date) {
                assignmentDateValue = longCallExecution.toISOString().slice(0, 10);
            } else if (primaryLongCall?.leg?.executionDate) {
                assignmentDateValue = primaryLongCall.leg.executionDate;
            }
        } else if (stockDate instanceof Date) {
            assignmentDateValue = stockDate.toISOString().slice(0, 10);
        } else if (stockLegInfo?.leg?.executionDate) {
            assignmentDateValue = stockLegInfo.leg.executionDate;
        }

        chronologicalLegs.forEach(item => {
            if (!['PUT', 'CALL'].includes(item.type)) {
                return;
            }

            const cashFlow = this.calculateLegCashFlow(item.leg);
            if (!Number.isFinite(cashFlow) || cashFlow === 0) {
                return;
            }

            if (positionType === 'pmcc') {
                if (item.type === 'CALL') {
                    const isLongCallOpenLeg = longCallLegIds.has(item.leg.id);
                    if (isLongCallOpenLeg) {
                        longCallCost += Math.abs(cashFlow);
                        addPremiumEvent(item, cashFlow, 'LONG_CALL');
                        if (!assignmentStrike) {
                            const lcStrike = Number(item.leg.strike);
                            if (Number.isFinite(lcStrike) && lcStrike > 0) {
                                assignmentStrike = lcStrike;
                            }
                        }
                        return;
                    }

                    shortCallNet += cashFlow;
                    addPremiumEvent(item, cashFlow, 'CALL');

                    if (item.action === 'SELL' && (item.side === 'OPEN' || item.side === 'ROLL')) {
                        pmccSellCount += Math.max(item.quantity || 1, 1);
                        const strikeValue = Number(item.leg.strike);
                        if (Number.isFinite(strikeValue) && strikeValue > 0) {
                            pmccShortStrike = strikeValue;
                        }
                    }
                }
                return;
            }

            const occursBeforeOrOnAssignment = stockDate
                ? (!item.executionDate || item.executionDate <= stockDate)
                : true;

            const occursAfterAssignment = stockDate
                ? (!item.executionDate || item.executionDate >= stockDate)
                : true;

            if (item.type === 'PUT' && occursBeforeOrOnAssignment) {
                initialPutPremiumTotal += cashFlow;
                addPremiumEvent(item, cashFlow, 'PUT');

                if (!assignmentStrike) {
                    const strikeFromPut = Number(item.leg.strike);
                    if (Number.isFinite(strikeFromPut) && strikeFromPut > 0) {
                        assignmentStrike = strikeFromPut;
                    }
                }
                return;
            }

            if (item.type === 'CALL' && occursAfterAssignment) {
                callPremiumNet += cashFlow;
                addPremiumEvent(item, cashFlow, 'CALL');

                if (item.action === 'SELL' && (item.side === 'OPEN' || item.side === 'ROLL')) {
                    coveredCallSellCount += Math.max(item.quantity || 1, 1);
                    if (!assignmentStrike) {
                        const strikeValue = Number(item.leg.strike);
                        if (Number.isFinite(strikeValue) && strikeValue > 0) {
                            assignmentStrike = strikeValue;
                        }
                    }
                }
            }
        });

        premiumHistory.sort((a, b) => {
            const aDate = this.parseDateValue(a.date);
            const bDate = this.parseDateValue(b.date);
            const aTime = aDate ? aDate.getTime() : 0;
            const bTime = bDate ? bDate.getTime() : 0;
            return aTime - bTime;
        });

        if (positionType === 'pmcc') {
            if (pmccShortStrike && !stockLegInfo) {
                assignmentStrike = pmccShortStrike;
            }
            if (!assignmentStrike && primaryLongCall) {
                const longStrike = Number(primaryLongCall.leg.strike);
                if (Number.isFinite(longStrike) && longStrike > 0) {
                    assignmentStrike = longStrike;
                }
            }
        }

        let totalPremiumCollected: DollarAmount;
        let perSharePutCredit = 0;
        let perShareCallCredit = 0;
        let costBasisPerShare: DollarAmount = 0;
        let effectiveCostBasis: DollarAmount = 0;
        let assignmentCostBasis: DollarAmount = 0;

        if (positionType === 'pmcc') {
            totalPremiumCollected = shortCallNet;
            const longCallTotalCost = longCallCost;
            assignmentCostBasis = longCallTotalCost;
            const effectiveTotal = longCallTotalCost - shortCallNet;
            effectiveCostBasis = effectiveTotal;
            costBasisPerShare = shares > 0 ? effectiveTotal / shares : 0;
        } else {
            totalPremiumCollected = initialPutPremiumTotal + callPremiumNet;
            perSharePutCredit = shares > 0 ? initialPutPremiumTotal / shares : 0;
            perShareCallCredit = shares > 0 ? callPremiumNet / shares : 0;

            if (Number.isFinite(assignmentStrike) && assignmentStrike !== 0) {
                costBasisPerShare = assignmentStrike - perSharePutCredit - perShareCallCredit;
                effectiveCostBasis = shares > 0 ? costBasisPerShare * shares : 0;
                assignmentCostBasis = assignmentStrike * shares;
            }
        }
        if (positionType === 'pmcc' && !Number.isFinite(assignmentCostBasis)) {
            assignmentCostBasis = 0;
        }
        if (positionType === 'pmcc' && !Number.isFinite(effectiveCostBasis)) {
            effectiveCostBasis = 0;
            costBasisPerShare = 0;
        }

        if (positionType === 'other') {
            return null;
        }

        // Calculate coverage: how many shares are covered by active short calls
        const rawLegs = Array.isArray(trade.legs) ? trade.legs : [];
        const shortCallInfo = this.getNetOpenShortCalls(rawLegs as NormalizedLeg[]);
        const activeShortCalls = shortCallInfo.contracts;

        // Standard contract = 100 shares per contract
        const multiplier = 100;
        const coveredShares = activeShortCalls * multiplier;
        const uncoveredShares = Math.max(0, shares - coveredShares);

        // Coverage status: 'full', 'partial', 'none'
        let coverageStatus: 'full' | 'partial' | 'none' = 'none';
        if (coveredShares >= shares && shares > 0) {
            coverageStatus = 'full';
        } else if (coveredShares > 0 && coveredShares < shares) {
            coverageStatus = 'partial';
        }

        return {
            trade,
            positionType,
            strike: assignmentStrike,
            initialPutPremium: initialPutPremiumTotal,
            callPremium: positionType === 'pmcc' ? shortCallNet : callPremiumNet,
            longCallCost: positionType === 'pmcc' ? longCallCost : 0,
            premiumCollected: totalPremiumCollected,
            premiumHistory,
            coveredCallCount: positionType === 'pmcc' ? pmccSellCount : coveredCallSellCount,
            costBasisPerShare,
            effectiveCostBasis,
            shares,
            assignmentCostBasis,
            assignmentDate: assignmentDateValue,
            // Coverage tracking
            activeShortCalls,
            activeShortCallDetails: shortCallInfo.details,
            coveredShares,
            uncoveredShares,
            coverageStatus
        };
    })
        .filter(Boolean);

    const totalAssignments = assignments.filter(assignment => !this.isClosedStatus(assignment!.trade.status)).length;

    const totalPremiumCollectedNet = assignments.reduce((sum, assignment) => sum + assignment!.premiumCollected, 0);
    const avgPremiumPerAssignment = totalAssignments > 0 ? totalPremiumCollectedNet / totalAssignments : 0;
    const totalCoveredCalls = assignments.reduce((sum, assignment) => sum + assignment!.coveredCallCount, 0);

    return {
        totalAssignments,
        totalPremiumCollected: totalPremiumCollectedNet,
        avgPremiumPerAssignment,
        totalCoveredCalls,
        assignments
    };
}

/** Per-ticker P&L performance summary over a list of closed trades. */
export function calculateTickerPerformance(
    this: StatsContext,
    trades: EnrichedTrade[] = []
): TickerPerformance {
    const map = new Map<string, TickerPerformanceItem>();

    trades.forEach(trade => {
        const ticker = (trade.ticker || 'Unknown').toString().trim().toUpperCase() || 'UNKNOWN';
        if (!map.has(ticker)) {
            map.set(ticker, {
                ticker,
                totalPL: 0,
                tradeCount: 0,
                wins: 0,
                losses: 0,
                avgPL: 0,
                winRate: 0
            });
        }

        const entry = map.get(ticker)!;
        const plValue = Number(this.calculateRealizedPL(trade)) || 0;
        entry.totalPL += plValue;
        entry.tradeCount += 1;
        if (plValue > 0) {
            entry.wins += 1;
        } else if (plValue < 0) {
            entry.losses += 1;
        }
    });

    const items: TickerPerformanceItem[] = Array.from(map.values())
        .map(entry => {
            const winRate = entry.tradeCount > 0 ? (entry.wins / entry.tradeCount) * 100 : 0;
            const avgPL = entry.tradeCount > 0 ? entry.totalPL / entry.tradeCount : 0;
            return {
                ...entry,
                avgPL,
                winRate
            };
        })
        .sort((a, b) => Math.abs(b.totalPL) - Math.abs(a.totalPL));

    const maxMagnitude: DollarAmount = items.length ? Math.max(...items.map(item => Math.abs(item.totalPL))) : 0;

    return {
        items,
        maxMagnitude
    };
}
