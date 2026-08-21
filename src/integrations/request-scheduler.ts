// src/integrations/request-scheduler.ts — priority queue + sliding-window rate
// limiter + concurrency pool + per-request timeout for outbound market-data
// calls. Dependency-free on purpose: no imports, structural inputs only, so it
// is directly unit-testable with tsx and carries no module-level mutable state
// (one instance per GammaLedger, held at this.finnhub.scheduler).
//
// WHY THIS EXISTS: quotes used to be chained onto a single promise with an
// untimed fetch() at the head. One stalled connection wedged every quote in the
// app forever. Here a stalled request aborts on its own deadline, and the other
// pool lanes keep draining the queue.

/** Lower numbers run first. */
export const PRIORITY = {
    /** User asked for this exact value right now (form lookups, manual refresh). */
    IMMEDIATE: 0,
    /** Visible cell with no price yet — the thing the user is staring at. */
    VISIBLE_EMPTY: 10,
    /** Visible cell being re-polled; it already shows a number. */
    VISIBLE_REFRESH: 20,
    /** Background enrichment (metrics, profile, earnings…). */
    BACKGROUND: 30
} as const

export interface SchedulerTask<T> {
    /** Dedup identity. A second submit for a live key joins the first. */
    key: string
    /** Cancellation group — typically the view/table that wants the value. */
    scope: string
    /** Lower runs first; ties broken by submission order. */
    priority: number
    /** Performs the actual work. Must honour `signal`. */
    run: (signal: AbortSignal) => Promise<T>
}

export interface SchedulerConfig {
    /** Requests allowed in flight simultaneously. */
    maxConcurrent: number
    /** Abort a request that has not settled within this many ms. */
    requestTimeoutMs: number
    /** Extra attempts after a timeout/network failure (0 = never retry). */
    maxRetries: number
    /** Delay before a retry attempt. */
    retryDelayMs: number
    /** Sliding-window budget. */
    maxRequestsPerWindow: number
    windowMs: number
    now: () => number
    setTimer: (fn: () => void, ms: number) => unknown
    clearTimer: (handle: unknown) => void
}

export interface SchedulerStats {
    queued: number
    inFlight: number
    /** Requests dispatched inside the current window. */
    usedInWindow: number
    capacity: number
    /** ms until the window frees a slot; 0 when a slot is available now. */
    nextSlotInMs: number
}

export interface RequestScheduler {
    submit<T>(task: SchedulerTask<T>): Promise<T>
    /** Drops queued work and aborts in-flight work for `scope`. Returns tasks affected. */
    cancelScope(scope: string): number
    /** Drops and aborts everything. */
    cancelAll(): number
    setRateLimit(maxRequestsPerWindow: number): void
    setMaxConcurrent(maxConcurrent: number): void
    getStats(): SchedulerStats
}

const CANCELLED = 'GammaLedgerRequestCancelled'

/** True when a rejection came from cancelScope/cancelAll rather than a real failure. */
export function isCancelledError(error: unknown): boolean {
    return Boolean(error) && (error as { name?: string }).name === CANCELLED
}

function cancelledError(scope: string): Error {
    const error = new Error(`Request cancelled (${scope})`)
    error.name = CANCELLED
    return error
}

/** True when the failure is worth one more attempt (stall or transport blip). */
function isRetryable(error: unknown): boolean {
    const name = (error as { name?: string } | null)?.name
    if (name === CANCELLED) return false
    if (name === 'AbortError' || name === 'TimeoutError') return true
    const message = ((error as { message?: string } | null)?.message || '').toLowerCase()
    return message.includes('timed out') || message.includes('network')
}

interface QueuedTask {
    key: string
    /** Every scope that has asked for this key. Cancelled only when empty. */
    scopes: Set<string>
    priority: number
    seq: number
    attempt: number
    run: (signal: AbortSignal) => Promise<unknown>
    resolve: (value: unknown) => void
    reject: (reason: unknown) => void
    promise: Promise<unknown>
    controller: AbortController | null
    timeoutHandle: unknown
}

const DEFAULTS: SchedulerConfig = {
    maxConcurrent: 4,
    requestTimeoutMs: 10_000,
    maxRetries: 1,
    retryDelayMs: 750,
    maxRequestsPerWindow: 60,
    windowMs: 60_000,
    now: () => Date.now(),
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>)
}

export function createRequestScheduler(config: Partial<SchedulerConfig> = {}): RequestScheduler {
    const cfg: SchedulerConfig = { ...DEFAULTS, ...config }

    const queue: QueuedTask[] = []
    const live = new Map<string, QueuedTask>()
    const inFlight = new Set<QueuedTask>()
    /** Dispatch timestamps inside the sliding window. */
    let dispatches: number[] = []
    let pumpHandle: unknown = null
    let seqCounter = 0

    function trimWindow(): void {
        const cutoff = cfg.now() - cfg.windowMs
        if (dispatches.length && dispatches[0] <= cutoff) {
            dispatches = dispatches.filter(stamp => stamp > cutoff)
        }
    }

    /** ms until the sliding window frees a slot; 0 when one is free now. */
    function msUntilSlot(): number {
        trimWindow()
        if (dispatches.length < cfg.maxRequestsPerWindow) return 0
        const oldest = dispatches[dispatches.length - cfg.maxRequestsPerWindow]
        return Math.max(1, oldest + cfg.windowMs - cfg.now())
    }

    function armPump(delayMs: number): void {
        if (pumpHandle !== null) return
        pumpHandle = cfg.setTimer(() => {
            pumpHandle = null
            pump()
        }, Math.max(1, delayMs))
    }

    function insert(task: QueuedTask): void {
        // Small queues (tens of entries) — a linear insert keeps ordering
        // obvious and costs nothing measurable.
        let index = queue.length
        for (let i = 0; i < queue.length; i += 1) {
            const other = queue[i]
            if (task.priority < other.priority
                || (task.priority === other.priority && task.seq < other.seq)) {
                index = i
                break
            }
        }
        queue.splice(index, 0, task)
    }

    function settle(task: QueuedTask, ok: boolean, value: unknown): void {
        if (task.timeoutHandle !== null) {
            cfg.clearTimer(task.timeoutHandle)
            task.timeoutHandle = null
        }
        task.controller = null
        inFlight.delete(task)
        if (live.get(task.key) === task) live.delete(task.key)
        if (ok) task.resolve(value)
        else task.reject(value)
        pump()
    }

    function dispatch(task: QueuedTask): void {
        const controller = new AbortController()
        task.controller = controller
        task.attempt += 1
        inFlight.add(task)
        dispatches.push(cfg.now())

        task.timeoutHandle = cfg.setTimer(() => {
            task.timeoutHandle = null
            const timeout = new Error('Request timed out')
            timeout.name = 'TimeoutError'
            // Abort so the underlying fetch releases its connection; the
            // rejection below is what the caller actually observes.
            try { controller.abort(timeout) } catch { /* older engines ignore a reason */ }
        }, cfg.requestTimeoutMs)

        let result: Promise<unknown>
        try {
            result = Promise.resolve(task.run(controller.signal))
        } catch (error) {
            result = Promise.reject(error)
        }

        result.then(
            (value) => {
                if (!inFlight.has(task)) return // already cancelled
                settle(task, true, value)
            },
            (error) => {
                if (!inFlight.has(task)) return // already cancelled
                const timedOut = task.timeoutHandle === null && controller.signal.aborted
                const failure = timedOut && (error as { name?: string })?.name === 'AbortError'
                    ? Object.assign(new Error('Request timed out'), { name: 'TimeoutError' })
                    : error
                if (task.attempt <= cfg.maxRetries && isRetryable(failure)) {
                    if (task.timeoutHandle !== null) {
                        cfg.clearTimer(task.timeoutHandle)
                        task.timeoutHandle = null
                    }
                    task.controller = null
                    inFlight.delete(task)
                    insert(task)
                    armPump(cfg.retryDelayMs)
                    return
                }
                settle(task, false, failure)
            }
        )
    }

    function pump(): void {
        while (queue.length > 0 && inFlight.size < cfg.maxConcurrent) {
            const wait = msUntilSlot()
            if (wait > 0) {
                armPump(wait)
                return
            }
            const task = queue.shift()
            if (task) dispatch(task)
        }
    }

    function abort(task: QueuedTask): void {
        if (task.timeoutHandle !== null) {
            cfg.clearTimer(task.timeoutHandle)
            task.timeoutHandle = null
        }
        const controller = task.controller
        task.controller = null
        inFlight.delete(task)
        if (live.get(task.key) === task) live.delete(task.key)
        const error = cancelledError([...task.scopes].join(',') || 'all')
        task.reject(error)
        if (controller) {
            try { controller.abort(error) } catch { /* older engines ignore a reason */ }
        }
    }

    function submit<T>(task: SchedulerTask<T>): Promise<T> {
        const existing = live.get(task.key)
        if (existing) {
            // Join the in-flight/queued request, but record the new scope so it
            // survives cancellation of the scope that originally asked for it,
            // and promote it if this caller needs it sooner.
            existing.scopes.add(task.scope)
            if (task.priority < existing.priority && !inFlight.has(existing)) {
                const index = queue.indexOf(existing)
                if (index >= 0) {
                    queue.splice(index, 1)
                    existing.priority = task.priority
                    insert(existing)
                }
            }
            return existing.promise as Promise<T>
        }

        seqCounter += 1
        let resolve!: (value: unknown) => void
        let reject!: (reason: unknown) => void
        const promise = new Promise<unknown>((res, rej) => { resolve = res; reject = rej })

        const queued: QueuedTask = {
            key: task.key,
            scopes: new Set([task.scope]),
            priority: task.priority,
            seq: seqCounter,
            attempt: 0,
            run: task.run as (signal: AbortSignal) => Promise<unknown>,
            resolve,
            reject,
            promise,
            controller: null,
            timeoutHandle: null
        }

        // A rejected promise with no attached handler yet would surface as an
        // unhandled rejection when a scope is cancelled before the caller
        // attaches its own .catch — swallow it on a detached copy.
        void promise.catch(() => undefined)

        live.set(queued.key, queued)
        insert(queued)
        pump()
        return promise as Promise<T>
    }

    function cancelScope(scope: string): number {
        let cancelled = 0
        const drop = (task: QueuedTask): void => {
            task.scopes.delete(scope)
            if (task.scopes.size > 0) return // another view still wants it
            const index = queue.indexOf(task)
            if (index >= 0) queue.splice(index, 1)
            abort(task)
            cancelled += 1
        }
        for (const task of [...queue]) drop(task)
        for (const task of [...inFlight]) drop(task)
        if (cancelled > 0) pump()
        return cancelled
    }

    function cancelAll(): number {
        const all = [...queue, ...inFlight]
        queue.length = 0
        all.forEach(abort)
        if (pumpHandle !== null) {
            cfg.clearTimer(pumpHandle)
            pumpHandle = null
        }
        return all.length
    }

    return {
        submit,
        cancelScope,
        cancelAll,
        setRateLimit(maxRequestsPerWindow: number): void {
            const value = Number(maxRequestsPerWindow)
            if (Number.isFinite(value) && value > 0) {
                cfg.maxRequestsPerWindow = Math.floor(value)
                pump()
            }
        },
        setMaxConcurrent(maxConcurrent: number): void {
            const value = Number(maxConcurrent)
            if (Number.isFinite(value) && value > 0) {
                cfg.maxConcurrent = Math.floor(value)
                pump()
            }
        },
        getStats(): SchedulerStats {
            trimWindow()
            return {
                queued: queue.length,
                inFlight: inFlight.size,
                usedInWindow: dispatches.length,
                capacity: cfg.maxRequestsPerWindow,
                nextSlotInMs: msUntilSlot()
            }
        }
    }
}
