// src/integrations/jev.ts — the settings line that says how typed decisions are answered: JEV
// (TypeSafe AI) through the OpenRouter key, or the active model when JEV isn't available.
// Uses the .call(this, …) delegation pattern.

import type { AIProviderId } from '@core/config'
import type { JevState } from '@types-gl/integrations'

interface JevStatusContext {
    jev: JevState
    aiProvider: { active: AIProviderId }
}

export function refreshJevStatus(this: JevStatusContext): void {
    const status = document.getElementById('jev-status')
    if (!status) return
    const reachable = this.jev.reachable
    status.textContent = reachable
        ? 'AI verdicts, thesis checks and digest order use JEV (TypeSafe AI) through this key: fast, calibrated and nearly free. No extra key needed.'
        : 'JEV couldn\'t answer this session, so AI verdicts and thesis checks use your OpenRouter model instead (uncalibrated). Reload to try JEV again.'
    status.classList.toggle('is-error', !reachable)
}
