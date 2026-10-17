// src/integrations/jev.ts — Settings → AI → "Quick decisions (JEV)": which JEV release answers typed
// decisions (AI verdict, thesis checks) through the OpenRouter key, and whether it is answering.
// Uses the .call(this, …) delegation pattern.

import { JEV_DEFAULT_MODEL, JEV_KNOWN_MODELS, type AIProviderId } from '@core/config'
import type { JevState, OpenRouterState } from '@types-gl/integrations'
import { resolveJevModel } from './decision/jev.js'
import { isValidOpenRouterModelId } from './llm/openrouter-models.js'
import { saveSettings } from './openrouter.js'

interface JevSettingsContext {
    jev: JevState
    openRouter: OpenRouterState
    aiProvider: { active: AIProviderId }
    refreshJevStatus(): void
}

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null

/** "typesafe/jev-1.14" → "jev-1.14", the part people recognise. */
export function jevModelLabel(model: string): string {
    return model.replace(/^typesafe\//, '')
}

function setNote(message: string, variant: 'success' | 'error' | 'neutral'): void {
    const note = byId('jev-model-note')
    if (!note) return
    note.textContent = message
    note.classList.toggle('is-success', variant === 'success')
    note.classList.toggle('is-error', variant === 'error')
}

function describeChoice(model: string | null): string {
    return model
        ? `Using ${jevModelLabel(model)}, your choice.`
        : `Using ${jevModelLabel(JEV_DEFAULT_MODEL)}, the default. It updates with GammaLedger.`
}

export function refreshJevStatus(this: JevSettingsContext): void {
    const model = resolveJevModel(this.openRouter.jevModel)
    const input = byId<HTMLInputElement>('jev-model')
    if (input && document.activeElement !== input) input.value = model
    const reset = byId<HTMLButtonElement>('jev-model-reset')
    if (reset) reset.disabled = !this.openRouter.jevModel

    const status = byId('jev-status')
    if (!status) return
    // Only speaks up when something is wrong; an empty status line is hidden.
    const reachable = this.jev.reachable
    status.textContent = reachable
        ? ''
        : `${jevModelLabel(model)} couldn't answer this session, so verdicts and thesis checks use your chat model instead (uncalibrated). Pick another release above or reload to try again.`
    status.classList.toggle('is-error', !reachable)
}

function applyJevModel(this: JevSettingsContext, value: string): void {
    const id = value.trim()
    const next = !id || id === JEV_DEFAULT_MODEL ? null : id
    if (next && !isValidOpenRouterModelId(next)) {
        setNote(`"${id}" isn't a valid model ID. Use the provider/model form, e.g. ${JEV_DEFAULT_MODEL}.`, 'error')
        return
    }
    const changed = next !== this.openRouter.jevModel
    this.openRouter.jevModel = next
    saveSettings(this.openRouter)
    // A different release deserves a fresh try even if the previous one failed this session.
    if (changed) this.jev.reachable = true
    setNote(changed ? `Saved. ${describeChoice(next)}` : describeChoice(next), changed ? 'success' : 'neutral')
    this.refreshJevStatus()
}

export function initializeJevControls(this: JevSettingsContext): void {
    const input = byId<HTMLInputElement>('jev-model')
    if (!input) return
    const list = byId('jev-model-list')
    if (list && !list.childElementCount) {
        for (const id of JEV_KNOWN_MODELS) {
            const option = document.createElement('option')
            option.value = id
            list.appendChild(option)
        }
    }
    input.placeholder = JEV_DEFAULT_MODEL
    const commit = () => applyJevModel.call(this, input.value)
    byId('jev-model-save')?.addEventListener('click', (event) => {
        event.preventDefault()
        commit()
    })
    input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault()
            commit()
        }
    })
    byId('jev-model-reset')?.addEventListener('click', (event) => {
        event.preventDefault()
        input.value = ''
        commit()
    })
    setNote(describeChoice(this.openRouter.jevModel), 'neutral')
    this.refreshJevStatus()
}
