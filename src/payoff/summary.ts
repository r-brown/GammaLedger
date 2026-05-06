// src/payoff/summary.js — Wave 6: Payoff summary and footnote builders.
// Uses the .call(this, …) delegation pattern.

export function buildPayoffSummary({ profileLabel, breakeven, maxProfit, maxLoss, contracts, isCredit = false }) {
    const parts = [];
    if (profileLabel) {
        parts.push(profileLabel);
    }
    if (Number.isFinite(breakeven)) {
        parts.push(`Breakeven ${this.formatCurrency(breakeven)}`);
    }
    if (maxProfit === Infinity) {
        parts.push('Max profit unlimited');
    } else if (Number.isFinite(maxProfit)) {
        parts.push(`Max profit ${this.formatCurrency(maxProfit)}`);
    }
    if (maxLoss === Infinity) {
        parts.push('Max loss unlimited (theoretical)');
    } else if (Number.isFinite(maxLoss)) {
        parts.push(`Max loss ${this.formatCurrency(maxLoss)}`);
    }
    if (Number.isFinite(contracts)) {
        parts.push(`${contracts} contract${contracts === 1 ? '' : 's'}${isCredit ? ' (credit)' : ''}`);
    }
    return parts.join(' • ') || 'Payoff preview unavailable.';
}

export function formatPayoffFooter(payoff, formatter) {
    const formatValue = (value) => {
        if (value === Infinity || value === -Infinity) {
            return 'Unlimited';
        }
        if (Array.isArray(value)) {
            const formatted = value.filter(v => Number.isFinite(v)).map(v => formatter.format(v));
            return formatted.length > 0 ? formatted.join(', ') : '—';
        }
        if (Number.isFinite(value)) {
            return formatter.format(value);
        }
        return '—';
    };

    const maxProfitText = `Max profit ${formatValue(payoff?.maxProfit)}`;
    const maxLossText = `Max loss ${formatValue(payoff?.maxLoss)}`;
    const breakevenText = `Breakeven ${formatValue(payoff?.breakeven)}`;

    return [maxProfitText, maxLossText, breakevenText].join(' • ');
}

export function getTradePayoffMeta(trade) {
    const strategy = (trade.strategy || 'Unspecified strategy').toString();
    const tradeType = this.getTradeType(trade) || '—';
    const status = this.getDisplayStatus(trade);
    const qtyRaw = Math.abs(Number(trade.quantity));
    const quantity = Number.isFinite(qtyRaw) && qtyRaw > 0 ? `${qtyRaw} contract${qtyRaw === 1 ? '' : 's'}` : null;

    return [strategy, tradeType, quantity, status]
        .filter(Boolean)
        .join(' • ');
}
