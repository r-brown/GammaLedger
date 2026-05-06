// src/payoff/series.js — Wave 6: Payoff data series calculation.
// Uses the .call(this, …) delegation pattern.

export function getFallbackUnderlyingPrice(trade = {}) {
    const candidates = [
        trade.currentUnderlyingPrice,
        trade.currentPrice,
        trade.marketPrice,
        trade.lastUnderlyingPrice,
        trade.lastPrice,
        trade.markPrice,
        trade.referencePrice,
        trade.stockPriceAtEntry
    ];

    for (const value of candidates) {
        const numeric = Number(value);
        if (Number.isFinite(numeric) && numeric > 0) {
            return numeric;
        }
    }

    return null;
}

export function calculatePayoffSeries(trade) {
    const model = this.determinePayoffModel(trade);
    if (!model || model.type === 'unsupported') {
        return {
            message: model?.reason || 'Payoff diagram not available for this strategy yet.'
        };
    }

    switch (model.type) {
        case 'single':
            return this.calculateSingleLegSeries(trade, model);
        case 'vertical':
            return this.calculateVerticalSpreadSeries(trade, model);
        case 'multi-leg':
            return this.calculateMultiLegSeries(trade, model);
        case 'covered-call':
            return this.calculateCoveredCallSeries(trade, model);
        case 'pmcc':
            return this.calculatePmccSeries(trade, model);
        default:
            return {
                message: 'Payoff diagram not available for this strategy yet.'
            };
    }
}

export function determinePayoffModel(trade) {
    const strategyRaw = (trade.strategy || '').toString().trim();
    const strategy = strategyRaw.toLowerCase();
    const definedWidth = Number(trade.definedRiskWidth);

    if (!strategy) {
        return { type: 'unsupported', reason: 'Add a strategy name to unlock payoff diagrams.' };
    }

    // Analyze actual legs for multi-leg strategies
    const legs = Array.isArray(trade.legs) ? trade.legs : [];
    const activeLegs = legs.filter(leg => {
        const side = this.getLegSide(leg);
        // Only consider OPEN and ROLL legs (exclude CLOSE)
        return side === 'OPEN' || side === 'ROLL';
    });

    const isPmccStrategy = strategy.includes("poor man's covered call")
        || strategy.includes('poor man')
        || strategy.includes('pmcc')
        || this.isPmccBaseLeg(trade)
        || this.isPmccShortCall(trade);

    if (isPmccStrategy) {
        const pmccLegs = this.extractPmccLegs(trade);
        if (!pmccLegs.baseLeg) {
            return {
                type: 'unsupported',
                reason: 'Add the PMCC base leg to this trade to unlock the payoff diagram.'
            };
        }
        return {
            type: 'pmcc',
            strategy,
            ...pmccLegs
        };
    }

    if (strategy.includes('covered call')) {
        return {
            type: 'covered-call',
            strategy
        };
    }

    // Multi-leg support: analyze actual legs
    if (activeLegs.length >= 2) {
        const multiLegModel = this.analyzeMultiLegStrategy(trade, activeLegs, strategy);
        if (multiLegModel) {
            return multiLegModel;
        }
    }

    const complexRegex = /(iron|straddle|strangle|butterfly|ratio|lizard|combo|synthetic|double|calendar|diagonal)/;
    const isComplex = complexRegex.test(strategy);

    const optionType = strategy.includes('put') ? 'put' : strategy.includes('call') ? 'call' : null;

    const isCalendarLike = /calendar|diagonal/.test(strategy);

    if (strategy.includes('spread') && !isCalendarLike && !(definedWidth > 0)) {
        // Try to infer from legs if available
        if (activeLegs.length >= 2) {
            const multiLegModel = this.analyzeMultiLegStrategy(trade, activeLegs, strategy);
            if (multiLegModel) {
                return multiLegModel;
            }
        }
        return {
            type: 'unsupported',
            reason: 'Add the defined risk width to visualize this spread.'
        };
    }

    if (definedWidth > 0 && optionType && strategy.includes('spread') && !isCalendarLike) {
        const orientation = strategy.includes('short') || strategy.includes('credit') || this.inferTradeDirection(trade) === 'short'
            ? 'short'
            : 'long';
        return {
            type: 'vertical',
            optionType,
            orientation,
            width: Number(definedWidth),
            strategy,
            legs: activeLegs
        };
    }

    if (isComplex) {
        // Try multi-leg analysis for complex strategies
        if (activeLegs.length >= 2) {
            const multiLegModel = this.analyzeMultiLegStrategy(trade, activeLegs, strategy);
            if (multiLegModel) {
                return multiLegModel;
            }
        }
        return {
            type: 'unsupported',
            reason: 'Visualization for multi-leg strategies such as condors, straddles, or ratios is coming soon.'
        };
    }

    if (!optionType) {
        return {
            type: 'unsupported',
            reason: 'Unable to infer option type from the strategy name.'
        };
    }

    const direction = this.inferTradeDirection(trade) === 'short' ? 'short' : 'long';

    return {
        type: 'single',
        optionType,
        direction,
        strategy
    };
}

export function calculateSingleLegSeries(trade, model) {
    const strike = Number(trade.strikePrice);
    const premium = Number(trade.entryPrice);
    const fees = Number(trade.fees) || 0;
    const quantity = Math.abs(Number(trade.quantity) || 1);
    const spot = Number(trade.stockPriceAtEntry);

    if (!Number.isFinite(strike) || !Number.isFinite(premium)) {
        return {
            message: 'Provide both a strike price and entry price to view this payoff.'
        };
    }

    const priceRange = this.buildPriceRange({ strikeValues: [strike], spot });
    const multiplier = quantity * 100;
    const steps = 40;
    const points = [];

    for (let i = 0; i <= steps; i++) {
        const price = priceRange.minPrice + ((priceRange.maxPrice - priceRange.minPrice) * i) / steps;
        const intrinsic = this.optionIntrinsic(model.optionType, price, strike);
        const payoffPerShare = model.direction === 'long'
            ? intrinsic - premium
            : premium - intrinsic;
        const payoff = payoffPerShare * multiplier - fees;
        points.push({
            x: parseFloat(price.toFixed(2)),
            y: parseFloat(payoff.toFixed(2))
        });
    }

    const zeroLinePoints = points.map(point => ({ x: point.x, y: 0 }));

    const breakeven = model.optionType === 'call'
        ? strike + premium
        : strike - premium;

    const premiumValue = premium * multiplier;
    let maxProfit;
    let maxLoss;
    if (model.direction === 'long') {
        if (model.optionType === 'call') {
            maxProfit = Infinity;
        } else {
            maxProfit = Math.max((strike - premium) * multiplier - fees, 0);
        }
        maxLoss = premiumValue + fees;
    } else {
        maxProfit = Math.max(premiumValue - fees, 0);
        if (model.optionType === 'call') {
            maxLoss = Infinity;
        } else {
            maxLoss = Math.max((strike - premium) * multiplier + fees, 0);
        }
    }

    // Use trade's Max Risk if available (only for defined risk strategies)
    const tradeMaxRisk = Number(trade.maxRiskOverride || trade.maxRisk);
    if (Number.isFinite(tradeMaxRisk) && tradeMaxRisk > 0 && maxLoss !== Infinity) {
        maxLoss = tradeMaxRisk;
    }

    const summary = this.buildPayoffSummary({
        profileLabel: `${model.direction === 'short' ? 'Short' : 'Long'} ${model.optionType.toUpperCase()}`,
        breakeven,
        maxProfit,
        maxLoss,
        contracts: quantity,
        isCredit: model.direction === 'short'
    });

    return {
        points,
        zeroLinePoints,
        summary,
        breakeven,
        maxProfit,
        maxLoss
    };
}

export function calculateMultiLegSeries(trade, model) {
    const legs = model.legs || [];
    if (legs.length < 2) {
        return {
            message: 'Multi-leg payoff requires at least 2 active option legs.'
        };
    }

    // Get all strikes to determine price range
    const strikes = legs.map(leg => leg.strike).filter(s => Number.isFinite(s) && s > 0);
    const spot = Number(trade.stockPriceAtEntry);
    
    if (strikes.length < 2) {
        return {
            message: 'Unable to determine strike prices from legs.'
        };
    }

    const priceRange = this.buildPriceRange({ strikeValues: strikes, spot });
    const steps = 40;
    const points = [];
    
    // Calculate total premium (net debit/credit)
    let totalPremium = 0;
    let totalFees = Number(trade.fees) || 0;
    
    legs.forEach(leg => {
        const premium = Number(leg.premium) || 0;
        const quantity = Math.abs(Number(leg.quantity) || 1);
        const multiplier = 100 * quantity;

        if (leg.action === 'BUY') {
            totalPremium -= Math.abs(premium) * multiplier;
        } else if (leg.action === 'SELL') {
            totalPremium += Math.abs(premium) * multiplier;
        }
    });

    // Calculate payoff at each price point
    for (let i = 0; i <= steps; i++) {
        const price = priceRange.minPrice + ((priceRange.maxPrice - priceRange.minPrice) * i) / steps;
        let payoff = totalPremium - totalFees;
        
        legs.forEach(leg => {
            const quantity = Math.abs(Number(leg.quantity) || 1);
            const multiplier = 100 * quantity;
            const intrinsic = this.optionIntrinsic(leg.type.toLowerCase(), price, leg.strike);
            
            if (leg.action === 'BUY') {
                // Long position: profit from intrinsic value
                payoff += intrinsic * multiplier;
            } else if (leg.action === 'SELL') {
                // Short position: loss from intrinsic value
                payoff -= intrinsic * multiplier;
            }
        });
        
        points.push({
            x: parseFloat(price.toFixed(2)),
            y: parseFloat(payoff.toFixed(2))
        });
    }

    // Find breakeven points (where payoff crosses zero)
    const breakevens = [];
    for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        if ((prev.y <= 0 && curr.y >= 0) || (prev.y >= 0 && curr.y <= 0)) {
            // Linear interpolation to find exact breakeven
            const slope = (curr.y - prev.y) / (curr.x - prev.x);
            const breakeven = prev.x - (prev.y / slope);
            breakevens.push(breakeven);
        }
    }

    const zeroLinePoints = points.map(point => ({ x: point.x, y: 0 }));
    
    // Calculate max profit and max loss
    const payoffValues = points.map(p => p.y);
    const maxProfit = Math.max(...payoffValues);
    
    // Use trade's Max Risk if available, otherwise calculate from payoff curve
    const tradeMaxRisk = Number(trade.maxRiskOverride || trade.maxRisk);
    const maxLoss = (Number.isFinite(tradeMaxRisk) && tradeMaxRisk > 0)
        ? tradeMaxRisk
        : Math.abs(Math.min(...payoffValues, 0));
    
    const contracts = Math.min(...legs.map(leg => Math.abs(Number(leg.quantity) || 1)));
    const isCredit = totalPremium > 0;
    
    const summary = this.buildPayoffSummary({
        profileLabel: `${model.subtype === 'vertical' ? 'Vertical Spread' : 'Multi-Leg'} (${legs.length} legs)`,
        breakeven: breakevens.length > 0 ? breakevens : null,
        maxProfit: maxProfit > 0 ? maxProfit : null,
        maxLoss: maxLoss > 0 ? maxLoss : null,
        contracts,
        isCredit
    });

    return {
        points,
        zeroLinePoints,
        summary,
        breakeven: breakevens.length > 0 ? breakevens : null,
        maxProfit: maxProfit > 0 ? maxProfit : null,
        maxLoss: maxLoss > 0 ? maxLoss : null
    };
}

export function calculateVerticalSpreadSeries(trade, model) {
    const primaryStrike = Number(trade.strikePrice);
    const entryPrice = Number(trade.entryPrice);
    const fees = Number(trade.fees) || 0;
    const quantity = Math.abs(Number(trade.quantity) || 1);
    const spot = Number(trade.stockPriceAtEntry);

    if (!Number.isFinite(primaryStrike) || !Number.isFinite(entryPrice)) {
        return {
            message: 'Provide strike and entry price to view this spread payoff.'
        };
    }

    if (!(model.width > 0)) {
        return {
            message: 'Add the defined risk width to visualize this spread.'
        };
    }

    let shortStrike;
    let longStrike;
    if (model.optionType === 'call') {
        if (model.orientation === 'short') {
            shortStrike = primaryStrike;
            longStrike = primaryStrike + model.width;
        } else {
            longStrike = primaryStrike;
            shortStrike = primaryStrike + model.width;
        }
    } else {
        if (model.orientation === 'short') {
            shortStrike = primaryStrike;
            longStrike = primaryStrike - model.width;
        } else {
            longStrike = primaryStrike;
            shortStrike = primaryStrike - model.width;
        }
    }

    if (!Number.isFinite(shortStrike) || !Number.isFinite(longStrike)) {
        return {
            message: 'Unable to determine both strikes for this spread.'
        };
    }

    const priceRange = this.buildPriceRange({ strikeValues: [shortStrike, longStrike], spot });
    const multiplier = quantity * 100;
    const steps = 40;
    const points = [];

    for (let i = 0; i <= steps; i++) {
        const price = priceRange.minPrice + ((priceRange.maxPrice - priceRange.minPrice) * i) / steps;
        const intrinsicShort = this.optionIntrinsic(model.optionType, price, shortStrike);
        const intrinsicLong = this.optionIntrinsic(model.optionType, price, longStrike);
        const payoffPerShare = model.orientation === 'short'
            ? entryPrice - (intrinsicShort - intrinsicLong)
            : (intrinsicLong - intrinsicShort) - entryPrice;
        const payoff = payoffPerShare * multiplier - fees;
        points.push({
            x: parseFloat(price.toFixed(2)),
            y: parseFloat(payoff.toFixed(2))
        });
    }

    const zeroLinePoints = points.map(point => ({ x: point.x, y: 0 }));

    const breakeven = this.calculateSpreadBreakeven({
        model,
        shortStrike,
        longStrike,
        entryPrice
    });

    const widthPerShare = Math.abs(shortStrike - longStrike);
    const widthValue = widthPerShare * multiplier;
    const entryValue = entryPrice * multiplier;

    let maxProfit;
    let maxLoss;
    if (model.orientation === 'short') {
        maxProfit = Math.max(entryValue - fees, 0);
        maxLoss = Math.max(widthValue - entryValue, 0) + fees;
    } else {
        maxProfit = Math.max(Math.max(widthValue - entryValue, 0) - fees, 0);
        maxLoss = entryValue + fees;
    }

    // Use trade's Max Risk if available
    const tradeMaxRisk = Number(trade.maxRiskOverride || trade.maxRisk);
    if (Number.isFinite(tradeMaxRisk) && tradeMaxRisk > 0) {
        maxLoss = tradeMaxRisk;
    }

    const summary = this.buildPayoffSummary({
        profileLabel: `${model.orientation === 'short' ? 'Short' : 'Long'} ${model.optionType === 'call' ? 'Call' : 'Put'} Spread`,
        breakeven,
        maxProfit,
        maxLoss,
        contracts: quantity,
        isCredit: model.orientation === 'short'
    });

    return {
        points,
        zeroLinePoints,
        summary,
        breakeven,
        maxProfit,
        maxLoss
    };
}

export function calculateCoveredCallSeries(trade) {
    const strike = Number(trade.strikePrice);
    const premium = Number(trade.entryPrice);
    const stockEntry = Number(trade.stockPriceAtEntry);
    const fees = Number(trade.fees) || 0;
    const quantity = Math.abs(Number(trade.quantity) || 1);

    if (!Number.isFinite(strike) || !Number.isFinite(premium) || !Number.isFinite(stockEntry)) {
        return {
            message: 'Covered call payoff requires strike, option premium, and stock cost basis.'
        };
    }

    const priceRange = this.buildPriceRange({ strikeValues: [strike, stockEntry], spot: stockEntry });
    const multiplier = quantity * 100;
    const steps = 40;
    const points = [];

    for (let i = 0; i <= steps; i++) {
        const price = priceRange.minPrice + ((priceRange.maxPrice - priceRange.minPrice) * i) / steps;
        const stockPnLPerShare = price - stockEntry;
        const optionPnLPerShare = premium - this.optionIntrinsic('call', price, strike);
        const payoff = (stockPnLPerShare + optionPnLPerShare) * multiplier - fees;
        points.push({
            x: parseFloat(price.toFixed(2)),
            y: parseFloat(payoff.toFixed(2))
        });
    }

    const zeroLinePoints = points.map(point => ({ x: point.x, y: 0 }));

    const breakeven = stockEntry - premium;
    const maxProfit = Math.max(((strike - stockEntry) + premium) * multiplier - fees, 0);
    let maxLoss = Math.max((stockEntry - premium) * multiplier + fees, 0);

    // Use trade's Max Risk if available
    const tradeMaxRisk = Number(trade.maxRiskOverride || trade.maxRisk);
    if (Number.isFinite(tradeMaxRisk) && tradeMaxRisk > 0) {
        maxLoss = tradeMaxRisk;
    }

    const summary = this.buildPayoffSummary({
        profileLabel: 'Covered Call (Stock + Short Call)',
        breakeven,
        maxProfit,
        maxLoss,
        contracts: quantity,
        isCredit: true
    });

    return {
        points,
        zeroLinePoints,
        summary,
        breakeven,
        maxProfit,
        maxLoss
    };
}

export function calculatePmccSeries(trade, model) {
    const baseLeg = model.baseLeg;
    if (!baseLeg) {
        return {
            message: 'Add the PMCC base leg to visualize this payoff.'
        };
    }

    const baseStrike = Number(baseLeg.strikePrice);
    const basePremium = Number(baseLeg.entryPrice);
    const baseFees = Number(baseLeg.fees) || 0;
    const baseQuantity = Math.abs(Number(baseLeg.quantity) || 1);

    if (!Number.isFinite(baseStrike) || !Number.isFinite(basePremium)) {
        return {
            message: 'Provide strike and entry price for the PMCC base leg to view this payoff.'
        };
    }

    const shortLeg = model.shortLeg;
    const shortStrike = Number(shortLeg?.strikePrice);
    const shortPremium = Number(shortLeg?.entryPrice);
    const shortFees = Number(shortLeg?.fees) || 0;
    const shortQuantity = Math.abs(Number(shortLeg?.quantity) || 0);
    const shortDirection = shortLeg ? this.inferTradeDirection(shortLeg) : null;

    const strikeValues = [baseStrike];
    if (Number.isFinite(shortStrike)) {
        strikeValues.push(shortStrike);
    }

    const spotFallback = this.getFallbackUnderlyingPrice(baseLeg)
        ?? (shortLeg ? this.getFallbackUnderlyingPrice(shortLeg) : null)
        ?? Number(baseLeg.stockPriceAtEntry);
    const priceRange = this.buildPriceRange({
        strikeValues,
        spot: Number.isFinite(spotFallback) ? spotFallback : Number.NaN
    });

    const steps = 80;
    const longMultiplier = baseQuantity * 100;
    const shortMultiplier = shortQuantity > 0 ? shortQuantity * 100 : longMultiplier;

    const points = [];
    for (let i = 0; i <= steps; i++) {
        const price = priceRange.minPrice + ((priceRange.maxPrice - priceRange.minPrice) * i) / steps;
        const longIntrinsic = Math.max(price - baseStrike, 0);
        const longPayoff = (longIntrinsic - basePremium) * longMultiplier - baseFees;

        let shortPayoff = 0;
        if (shortLeg && Number.isFinite(shortStrike) && Number.isFinite(shortPremium)) {
            const shortIntrinsic = Math.max(price - shortStrike, 0);
            const shortPerShare = shortDirection === 'short'
                ? shortPremium - shortIntrinsic
                : shortIntrinsic - shortPremium;
            shortPayoff = shortPerShare * shortMultiplier - shortFees;
        }

        const totalPayoff = longPayoff + shortPayoff;
        points.push({
            x: parseFloat(price.toFixed(2)),
            y: parseFloat(totalPayoff.toFixed(2))
        });
    }

    const zeroLinePoints = points.map(point => ({ x: point.x, y: 0 }));

    const baseCost = (basePremium * longMultiplier) + baseFees;
    let shortCredit = 0;
    if (shortLeg && Number.isFinite(shortPremium)) {
        if (shortDirection === 'short') {
            shortCredit = (shortPremium * shortMultiplier) - shortFees;
        } else {
            shortCredit = -((shortPremium * shortMultiplier) + shortFees);
        }
    }

    const netOutlay = baseCost - shortCredit;
    const perShareOutlay = longMultiplier > 0 ? netOutlay / longMultiplier : 0;
    const breakeven = Number.isFinite(perShareOutlay)
        ? baseStrike + perShareOutlay
        : null;

    let maxProfit = Infinity;
    if (shortLeg && Number.isFinite(shortStrike) && shortDirection === 'short') {
        const sharedContracts = Math.max(Math.min(baseQuantity, shortQuantity), 0);
        if (sharedContracts > 0) {
            const spreadWidth = shortStrike - baseStrike;
            if (Number.isFinite(spreadWidth)) {
                maxProfit = (spreadWidth * 100 * sharedContracts) - netOutlay;
            }
        }
    }

    let maxLoss = netOutlay > 0 ? netOutlay : 0;

    // Use trade's Max Risk if available
    const tradeMaxRisk = Number(trade.maxRiskOverride || trade.maxRisk);
    if (Number.isFinite(tradeMaxRisk) && tradeMaxRisk > 0) {
        maxLoss = tradeMaxRisk;
    }

    const summary = this.buildPayoffSummary({
        profileLabel: "Poor Man's Covered Call",
        breakeven,
        maxProfit,
        maxLoss,
        contracts: baseQuantity,
        isCredit: netOutlay < 0
    });

    return {
        points,
        zeroLinePoints,
        summary,
        breakeven,
        maxProfit,
        maxLoss
    };
}
