// Pure date helpers — no class state required. Migrated from
// class GammaLedger during the TypeScript module split.

import type { ISODate } from '@types-gl/common'

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parses a date for display. A date-only string ("2026-10-16") is a calendar day, so it is read
 * at local midnight: `new Date('2026-10-16')` is UTC midnight, which is the previous evening
 * anywhere west of UTC and showed every date one day early in the Americas.
 */
export function parseCalendarDate(value: string | Date | null | undefined): Date | null {
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
    }
    const text = String(value ?? '').trim();
    if (!text) {
        return null;
    }
    const match = DATE_ONLY.exec(text);
    const date = match
        ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
        : new Date(text);
    return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * The calendar day of an expiration as a UTC day number. A date-only string is its literal day;
 * a Date is read by its UTC day, matching parseDateValue (date-only strings parse at UTC midnight)
 * and the market-close cutoff in trades/legs.ts.
 */
function expirationDayUTC(expiration: string | Date | null | undefined): number | null {
    if (expiration instanceof Date) {
        return Number.isNaN(expiration.getTime())
            ? null
            : Date.UTC(expiration.getUTCFullYear(), expiration.getUTCMonth(), expiration.getUTCDate());
    }
    const text = String(expiration ?? '').trim();
    if (!text) {
        return null;
    }
    const match = DATE_ONLY.exec(text);
    if (match) {
        return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    }
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? null : Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/**
 * Whole calendar days from today (local) to the expiration day: 0 on expiration day, 1 the day
 * before, whatever the hour or time zone.
 */
export function calendarDaysUntil(expiration: string | Date | null | undefined, now: Date): number | null {
    const expDay = expirationDayUTC(expiration);
    if (expDay === null) {
        return null;
    }
    const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((expDay - today) / 86_400_000);
}

/** Options stop trading at the close: 21:00 UTC (4 PM ET in winter, 5 PM in summer) on expiration day. */
export function isPastExpiryCutoff(expiration: string | Date | null | undefined, now: Date): boolean {
    const expDay = expirationDayUTC(expiration);
    return expDay !== null && now.getTime() > expDay + 21 * 3_600_000;
}

export function formatDate(dateString: string | null | undefined): string {
    const date = parseCalendarDate(dateString);
    if (!date) {
        return '—';
    }

    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

export function formatDateForInput(dateString: string | null | undefined): string {
    const date = parseCalendarDate(dateString);
    if (!date) return '';

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function calculateDaysBetween(date1: string | Date, date2: string | Date): number {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const timeDiff = Math.abs(d2.getTime() - d1.getTime());
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
}

export function parseDateValue(value: unknown): Date | null {
    if (!value) {
        return null;
    }

    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
    }

    const normalized = String(value).trim();
    if (!normalized) {
        return null;
    }

    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) {
        return null;
    }

    return parsed;
}

export function getWeekEndingFriday(dateInput: string | Date): Date | null {
    const date = parseCalendarDate(dateInput);
    if (!date) {
        return null;
    }

    const weekEnd = new Date(date);
    weekEnd.setHours(0, 0, 0, 0);
    const day = weekEnd.getDay();

    if (day === 5) {
        return weekEnd;
    }

    if (day === 6) {
        weekEnd.setDate(weekEnd.getDate() - 1);
        return weekEnd;
    }

    if (day === 0) {
        weekEnd.setDate(weekEnd.getDate() - 2);
        return weekEnd;
    }

    weekEnd.setDate(weekEnd.getDate() + (5 - day));
    return weekEnd;
}

export function getWeekKey(dateInput: string | Date): ISODate {
    const date = parseCalendarDate(dateInput);
    if (!date) {
        return '';
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function formatDayLabel(dateInput: string | Date): string {
    const date = parseCalendarDate(dateInput);
    if (!date) {
        return '';
    }

    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric'
    });
}

export function formatWeekLabel(dateInput: string | Date): string {
    const date = parseCalendarDate(dateInput);
    if (!date) {
        return '';
    }

    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric'
    });
}
