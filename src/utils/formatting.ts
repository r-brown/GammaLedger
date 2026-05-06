// Pure formatting / parsing helpers — no class state required.
// Migrated from class GammaLedger (see docs/refactor/phase1-analysis.md §10).

import type { DollarAmount } from '@types-gl/common'

// ---------------------------------------------------------------------------
// Option bag interfaces
// ---------------------------------------------------------------------------

export interface ParseDecimalOptions {
    allowNegative?: boolean
}

export interface FormatNumberOptions {
    style?: 'number' | 'currency' | 'percent'
    decimals?: number
    currency?: string
    useGrouping?: boolean
}

export interface FormatPercentOptions {
    decimals?: number
}

export interface FormatCurrencyOptions {
    currency?: string
    decimals?: number
    useGrouping?: boolean
}

// ---------------------------------------------------------------------------
// String helpers
// ---------------------------------------------------------------------------

export function sanitizeString(value: unknown, maxLength = 1000): string {
    if (value === null || value === undefined) {
        return '';
    }

    const str = String(value).trim();
    return str.length > maxLength ? str.substring(0, maxLength) : str;
}

// ---------------------------------------------------------------------------
// Number parsers
// ---------------------------------------------------------------------------

export function parseDecimal(
    value: unknown,
    defaultValue: number | null = null,
    { allowNegative = true }: ParseDecimalOptions = {}
): number | null {
    if (value === null || value === undefined) {
        return defaultValue;
    }

    let normalized: string | number = typeof value === 'string' ? value.trim() : (value as number);
    if (typeof normalized === 'string') {
        if (normalized === '') {
            return defaultValue;
        }

        let text = normalized.replace(/\s+/g, '');
        if (!text) {
            return defaultValue;
        }

        const hasComma = text.includes(',');
        const hasDot = text.includes('.');

        if (hasComma && !hasDot) {
            text = text.replace(/,/g, '.');
        } else if (hasComma && hasDot) {
            const lastComma = text.lastIndexOf(',');
            const lastDot = text.lastIndexOf('.');
            if (lastComma > lastDot) {
                text = text.replace(/\./g, '').replace(/,/g, '.');
            } else {
                text = text.replace(/,/g, '');
            }
        }

        text = text.replace(/_/g, '');
        normalized = text;
    }

    const parsedValue = Number(normalized);
    if (!Number.isFinite(parsedValue)) {
        return defaultValue;
    }

    if (!allowNegative && parsedValue < 0) {
        return defaultValue;
    }

    return parsedValue;
}

export function parseInteger(
    value: unknown,
    defaultValue: number | null = null,
    { allowNegative = true }: ParseDecimalOptions = {}
): number | null {
    if (value === null || value === undefined) {
        return defaultValue;
    }

    const normalized = typeof value === 'string' ? value.trim() : String(value);
    if (normalized === '') {
        return defaultValue;
    }

    const parsedValue = parseInt(normalized, 10);
    if (!Number.isFinite(parsedValue)) {
        return defaultValue;
    }

    if (!allowNegative && parsedValue < 0) {
        return defaultValue;
    }

    return parsedValue;
}

/** Parse exit price — allows 0 as valid, rejects negatives. */
export function parseExitPrice(exitPriceValue: unknown): number | null {
    const parsedValue = parseDecimal(exitPriceValue, null, { allowNegative: false });
    return parsedValue === null ? null : parsedValue;
}

// ---------------------------------------------------------------------------
// Number formatters
// ---------------------------------------------------------------------------

export function formatNumber(value: unknown, options: FormatNumberOptions = {}): string | null {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return null;
    }

    const style = options.style || 'number';
    const fallbackDecimals = style === 'currency' ? 2 : 2;
    const decimals = Number.isInteger(options.decimals) ? Math.max(0, options.decimals!) : fallbackDecimals;
    const currencyCode = options.currency || 'USD';
    const groupingDefault = style === 'currency';
    const useGrouping = typeof options.useGrouping === 'boolean' ? options.useGrouping : groupingDefault;

    const formatWithIntl = (num: number, fractionDigits = decimals): string =>
        new Intl.NumberFormat('en-US', {
            useGrouping,
            minimumFractionDigits: fractionDigits,
            maximumFractionDigits: fractionDigits
        }).format(num);

    if (style === 'currency') {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currencyCode,
            useGrouping,
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }).format(numeric);
    }

    if (style === 'percent') {
        const percentDigits = Number.isInteger(options.decimals) ? Math.max(0, options.decimals!) : decimals;
        return `${formatWithIntl(numeric, percentDigits)}%`;
    }

    return formatWithIntl(numeric, decimals);
}

export function formatPercent(
    value: unknown,
    fallback = '—',
    options: FormatPercentOptions = {}
): string {
    const numeric = Number(value);
    if (numeric === Number.POSITIVE_INFINITY) {
        return 'Infinite';
    }
    if (!Number.isFinite(numeric)) {
        return fallback;
    }

    const decimals = Number.isInteger(options.decimals)
        ? Math.max(0, options.decimals!)
        : 2;
    const formatted = formatNumber(numeric, { decimals, useGrouping: true });
    return formatted ? `${formatted}%` : `${numeric.toFixed(decimals)}%`;
}

export function getStrategyDisplayName(strategy: string | undefined = ''): string {
    const raw = String(strategy || '').trim();
    if (!raw) {
        return '';
    }

    if (raw.toUpperCase() === 'PMCC') {
        return "Poor Man's Covered Call";
    }

    return raw;
}

export function formatCurrency(amount: unknown, options: FormatCurrencyOptions = {}): DollarAmount | string {
    const value = Number(amount);
    if (!Number.isFinite(value)) {
        return '—';
    }

    const currency = options.currency || 'USD';
    const decimals = Number.isInteger(options.decimals)
        ? Math.max(0, options.decimals!)
        : 2;
    const useGrouping = options.useGrouping !== undefined
        ? Boolean(options.useGrouping)
        : true;

    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        useGrouping,
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(value);
}

