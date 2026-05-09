// src/calculations/stats.ts — Wave 3: Advanced stats, assignment and ticker performance.
// Uses the .call(this, …) delegation pattern.

import type { DollarAmount } from '@types-gl/common'
import type { EnrichedTrade } from '@types-gl/trade'
import type { NormalizedLeg } from '@types-gl/leg'
import type { TickerPerformance, TickerPerformanceItem } from '@types-gl/stats'

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

    // Trade-shape predicates
    isWheelOrPmccTrade(trade: EnrichedTrade): boolean
    isPmccTrade(trade: EnrichedTrade): boolean

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
    const assignedTrades = this.trades.filter(trade => this.isAssignedStatus(trade.status));
    // Awaiting-coverage trades (uncovered/partial wheel/PMCC) live only in the
    // Wheel/PMCC tracker — exclude from Active Trades and from "expired" buckets.
    let openTrades = this.trades.filter(trade =>
        this.isActiveStatus(trade.status) && trade.lifecycleStatus !== 'awaiting_coverage'
    );
    const awaitingCoverageTrades = this.trades.filter(trade => trade.lifecycleStatus === 'awaiting_coverage');
    const wheelPmccTrades = this.trades.filter(trade => {
        const isWheelPmcc = this.isWheelOrPmccTrade(trade);
        const isAssigned = this.isAssignedStatus(trade.status);
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
    // Use calculateRealizedPL (not trade.pl) so assigned-in-flight trades
    // contribute only their option-leg P&L, not the stock-leg cost basis.
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

    // Calculate max drawdown
    let maxDrawdown = 0;
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
        const drawdown = peak > 0 ? ((peak - cumulativePL) / peak) * 100 : 0;
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
    const downsideDeviation = downsideReturns.length
        ? Math.sqrt(downsideReturns.reduce((sum, value) => sum + value * value, 0) / downsideReturns.length)
        : 0;

    // sharpeRatio / sortinoRatio may be null — Stats interface types these as number,
    // acceptable under strictNullChecks: false (Phase 2 permissive mode).
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

    // Realized P&L: Actual profits/losses from fully-realized trades —
    // closed, expired, and assigned (without remaining open options).
    const realizedPL = totalPL;

    // Unrealized P&L: Estimated current P&L on open positions plus
    // mark-to-market on awaiting-coverage wheel/PMCC stock holdings.
    const unrealizedPL = openTrades.reduce((sum, trade) => {
        const pl = Number(trade.pl);
        return Number.isFinite(pl) ? sum + pl : sum;
    }, 0) + awaitingCoverageTrades.reduce((sum, trade) => {
        const pl = Number(trade.unrealizedPL);
        return Number.isFinite(pl) ? sum + pl : sum;
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
        totalROI,
        annualizedROI,
        maxDrawdown,
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
        realizedPL,
        unrealizedPL,
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
        if (positionType === 'other' && this.isAssignedStatus(trade.status)) {
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
