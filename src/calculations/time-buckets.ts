// src/calculations/time-buckets.ts — pure date-bucketing helpers.
// Deliberately dependency-free so it can be unit-tested standalone.
//
// All bucket keys sort lexically in chronological order:
//   day   '2026-07-28' · week '2026-07-27' (the ISO week's Monday) · month '2026-07'
// Week keys use the Monday DATE, not an ISO week number, so that comparison
// still works across a year boundary ('2026-12-28' < '2027-01-04').

export type Granularity = 'day' | 'week' | 'month'

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                     'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

/** Parse 'YYYY-MM-DD' as UTC midnight. Returns null when unparseable, INCLUDING
 *  calendar overflow — `new Date('2026-02-30T00:00:00Z')` silently rolls over
 *  to March 2 rather than erroring, so the reconstructed y/m/d is checked
 *  against the input instead of trusting Date's leniency (Finding 2). */
function parseIsoDay(isoDate: string): Date | null {
    const day = isoDate.slice(0, 10)
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day)
    if (!match) return null
    const [, y, m, d] = match
    const parsed = new Date(`${day}T00:00:00Z`)
    if (Number.isNaN(parsed.getTime())) return null
    if (parsed.getUTCFullYear() !== Number(y) ||
        parsed.getUTCMonth() !== Number(m) - 1 ||
        parsed.getUTCDate() !== Number(d)) {
        return null
    }
    return parsed
}

/** Parse the 'YYYY-MM' bucket prefix of an ISO date, validated the same way
 *  as day/week (Finding 1: the old `isoDate.slice(0, 7)` accepted garbage
 *  strings like 'not-a-real-date' unvalidated). */
function parseIsoMonth(isoDate: string): string | null {
    const parsed = parseIsoDay(isoDate)
    if (!parsed) return null
    const year = String(parsed.getUTCFullYear()).padStart(4, '0')
    const month = String(parsed.getUTCMonth() + 1).padStart(2, '0')
    return `${year}-${month}`
}

/** The Monday of the ISO week containing `date`, as 'YYYY-MM-DD'. */
function mondayOf(date: Date): string {
    const monday = new Date(date)
    const weekday = monday.getUTCDay()            // 0=Sun … 6=Sat
    const shift = weekday === 0 ? -6 : 1 - weekday
    monday.setUTCDate(monday.getUTCDate() + shift)
    return monday.toISOString().slice(0, 10)
}

/** Bucket key for an ISO date at the given granularity. '' when unparseable —
 *  honoured uniformly across all three granularities (Findings 1 & 2), so a
 *  malformed or calendar-overflowed date can never survive into a bucket map. */
export function bucketKeyOf(isoDate: string, granularity: Granularity): string {
    if (!isoDate) return ''
    if (granularity === 'month') return parseIsoMonth(isoDate) ?? ''
    const parsed = parseIsoDay(isoDate)
    if (!parsed) return ''
    if (granularity === 'day') return isoDate.slice(0, 10)
    return mondayOf(parsed)
}

/** Re-key a date-keyed map into coarser buckets, summing collisions.
 *  Result is sorted by key (== chronological). */
export function rollUpBuckets(
    byDate: Map<string, number>,
    granularity: Granularity
): Map<string, number> {
    const out = new Map<string, number>()
    for (const [isoDate, amount] of byDate) {
        const key = bucketKeyOf(isoDate, granularity)
        if (!key) continue
        out.set(key, (out.get(key) ?? 0) + amount)
    }
    return new Map([...out.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
}

/** Every bucket key in [start, end] inclusive, including empty ones, so the axis
 *  shows real elapsed time instead of compressing inactive periods.
 *  Weekends are omitted at day granularity — options do not settle on weekends.
 *
 *  Callers must pass concrete dates. `getCumulativePLRangeWindow` returns
 *  { start: null, end: null } for the ALL range (src/ui/share-card.ts:139-141);
 *  substitute the data extent before calling. */
export function enumerateBuckets(
    start: Date,
    end: Date,
    granularity: Granularity
): string[] {
    const keys: string[] = []
    const seen = new Set<string>()
    const cursor = new Date(Date.UTC(
        start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()))
    const last = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate())

    while (cursor.getTime() <= last) {
        const weekday = cursor.getUTCDay()
        const isWeekend = weekday === 0 || weekday === 6
        if (!(granularity === 'day' && isWeekend)) {
            const key = bucketKeyOf(cursor.toISOString().slice(0, 10), granularity)
            if (key && !seen.has(key)) {
                seen.add(key)
                keys.push(key)
            }
        }
        cursor.setUTCDate(cursor.getUTCDate() + 1)
    }

    // A window shorter than one bucket (or one that lands entirely on a weekend
    // at day grain) must still yield the bucket containing `start`.
    if (!keys.length) {
        const fallback = bucketKeyOf(start.toISOString().slice(0, 10), granularity)
        if (fallback) keys.push(fallback)
    }
    return keys
}

/** Display label for a bucket key. */
export function bucketLabel(key: string, granularity: Granularity): string {
    if (granularity === 'month') {
        const [year, month] = key.split('-')
        const index = Number(month) - 1
        const name = MONTH_NAMES[index] ?? month
        return `${name} ${year.slice(2)}`
    }
    const parsed = parseIsoDay(key)
    if (!parsed) return key
    return `${MONTH_NAMES[parsed.getUTCMonth()]} ${parsed.getUTCDate()}`
}

/** The granularity implied by a range preset. Unknown ranges fall back to month. */
export function defaultGranularityFor(range: string): Granularity {
    switch (String(range).toUpperCase()) {
        case '7D':
        case 'MTD':
        case '1M':
            return 'day'
        case '3M':
            return 'week'
        default:
            return 'month'
    }
}
