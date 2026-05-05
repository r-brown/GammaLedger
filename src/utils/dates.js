// Pure date helpers — no class state required. Migrated from
// class GammaLedger (see docs/refactor/phase1-analysis.md §10).

export function formatDate(dateString) {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
        return '—';
    }

    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

export function formatDateForInput(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function calculateDaysBetween(date1, date2) {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const timeDiff = Math.abs(d2.getTime() - d1.getTime());
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
}

export function parseDateValue(value) {
    if (!value) {
        return null;
    }

    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
    }

    const normalized = value.toString().trim();
    if (!normalized) {
        return null;
    }

    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) {
        return null;
    }

    return parsed;
}

export function getWeekEndingFriday(dateInput) {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) {
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

export function getWeekKey(dateInput) {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) {
        return '';
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function formatDayLabel(dateInput) {
    const date = new Date(dateInput);
    if (Number.isNaN(date.getTime())) {
        return '';
    }

    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric'
    });
}

export function formatWeekLabel(dateInput) {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) {
        return '';
    }

    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric'
    });
}
