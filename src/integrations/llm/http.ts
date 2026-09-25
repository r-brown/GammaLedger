// src/integrations/llm/http.ts — shared fetch plumbing for LLM providers.

import { LLMError } from './types.js'

/**
 * Runs `run` with an AbortSignal that fires after `timeoutMs` or when
 * `externalSignal` aborts. The timer covers the whole callback, so a streamed
 * body read inside `run` is bounded too. Failures come out as LLMError.
 */
export async function runWithTimeout<T>(
    timeoutMs: number,
    externalSignal: AbortSignal | undefined,
    run: (signal: AbortSignal) => Promise<T>
): Promise<T> {
    const controller = new AbortController()
    let timedOut = false
    const timer = setTimeout(() => {
        timedOut = true
        controller.abort()
    }, timeoutMs)
    const forwardAbort = () => controller.abort()
    if (externalSignal?.aborted) {
        controller.abort()
    }
    externalSignal?.addEventListener('abort', forwardAbort, { once: true })

    try {
        return await run(controller.signal)
    } catch (error) {
        if (timedOut) {
            throw new LLMError('timeout', `No response after ${Math.round(timeoutMs / 1000)} s`)
        }
        if (externalSignal?.aborted) {
            throw new LLMError('aborted', 'Request cancelled')
        }
        if (error instanceof LLMError) {
            throw error
        }
        const message = error instanceof Error && error.message ? error.message : String(error)
        throw new LLMError('network', message)
    } finally {
        clearTimeout(timer)
        externalSignal?.removeEventListener('abort', forwardAbort)
    }
}

/** Parses a JSON body, falling back to `{}` so shape checks always get a value. */
export async function readJson(response: Response): Promise<unknown> {
    return response.json().catch(() => ({}))
}

export function finiteOrNull(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null
}
