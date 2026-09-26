// src/integrations/openrouter.ts — OpenRouter settings: encrypted key storage, model picker,
// fallbacks and privacy routing. Uses the .call(this, …) delegation pattern.

import {
    DEFAULT_OPENROUTER_MODEL,
    OPENROUTER_MAX_FALLBACK_MODELS,
    OPENROUTER_SECRET_STORAGE_KEY,
    OPENROUTER_STORAGE_KEY,
    type AIProviderId
} from '@core/config'
import { OpenRouterConfigSchema, type OpenRouterConfig } from '@core/schema'
import { safeLocalStorage } from '@core/storage'
import { decryptString, encryptString, loadOrCreateAesKey, type EncryptedPayload } from '@utils/crypto'
import type { AIStatusVariant, OpenRouterState } from '@types-gl/integrations'
import { resolveOpenRouterModel } from './llm/openrouter.js'
import {
    availableOpenRouterModels,
    describeOpenRouterModel,
    ensureOpenRouterCatalogue,
    findOpenRouterModel,
    OPENROUTER_CURATED_MODELS,
    isValidOpenRouterModelId
} from './llm/openrouter-models.js'
import type { OpenRouterModel } from './llm/types.js'

interface OpenRouterSettingsContext {
    openRouter: OpenRouterState
    aiProvider: { active: AIProviderId }
    getCrypto(): Crypto | null
    initializeAIChat(): void
    updateAIChatHeader(): void
    renderAIChatMessages(): void
    ensureOpenRouterModels(): Promise<OpenRouterModel[]>
    renderOpenRouterModelOptions(): void
    updateOpenRouterStatus(message: string, variant?: AIStatusVariant, autoClearMs?: number): void
}

type StoredSecret = { payload?: EncryptedPayload; apiKey?: string }

function readStoredConfig(): OpenRouterConfig | null {
    const raw = safeLocalStorage.getItem(OPENROUTER_STORAGE_KEY)
    if (!raw) {
        return null
    }
    try {
        const parsed = OpenRouterConfigSchema.safeParse(JSON.parse(raw))
        return parsed.success ? parsed.data : null
    } catch {
        return null
    }
}

function writeConfig(state: OpenRouterState, secret: StoredSecret): void {
    const config: OpenRouterConfig = {
        version: 1,
        model: state.model,
        fallbackModels: [...state.fallbackModels],
        dataCollection: state.dataCollection,
        ...secret
    }
    safeLocalStorage.setItem(OPENROUTER_STORAGE_KEY, JSON.stringify(config))
}

/** Persists non-secret settings, keeping whatever secret is already stored. */
function saveSettings(state: OpenRouterState): void {
    const stored = readStoredConfig()
    const secret: StoredSecret = stored?.payload ? { payload: stored.payload } : stored?.apiKey ? { apiKey: stored.apiKey } : {}
    writeConfig(state, secret)
}

async function ensureEncryptionKey(this: OpenRouterSettingsContext, cryptoApi: Crypto): Promise<CryptoKey> {
    if (!this.openRouter.encryptionKey) {
        this.openRouter.encryptionKey = await loadOrCreateAesKey(safeLocalStorage, OPENROUTER_SECRET_STORAGE_KEY, cryptoApi)
    }
    return this.openRouter.encryptionKey
}

export async function loadOpenRouterConfigFromStorage(this: OpenRouterSettingsContext): Promise<boolean> {
    if (!safeLocalStorage.getItem(OPENROUTER_STORAGE_KEY)) {
        return false
    }
    const config = readStoredConfig()
    if (!config) {
        console.warn('Stored OpenRouter settings are invalid — ignoring them.')
        this.updateOpenRouterStatus('Stored OpenRouter settings were unreadable. Re-enter your key.', 'error', 9000)
        return false
    }

    const state = this.openRouter
    state.model = resolveOpenRouterModel(config.model)
    state.fallbackModels = config.fallbackModels.filter(isValidOpenRouterModelId)
    state.dataCollection = config.dataCollection

    if (config.payload) {
        const cryptoApi = this.getCrypto()
        if (!cryptoApi?.subtle) {
            this.updateOpenRouterStatus('The stored OpenRouter key is encrypted, but this browser cannot decrypt it. Re-enter it.', 'error', 9000)
            return false
        }
        try {
            const key = await ensureEncryptionKey.call(this, cryptoApi)
            state.apiKey = (await decryptString(config.payload, cryptoApi, key)).trim()
        } catch (error) {
            console.warn('Failed to decrypt stored OpenRouter API key:', error)
            this.updateOpenRouterStatus('Could not decrypt the stored OpenRouter key. Re-enter it.', 'error', 9000)
            return false
        }
    } else if (config.apiKey) {
        state.apiKey = config.apiKey.trim()
    }
    return Boolean(state.apiKey)
}

async function saveApiKey(this: OpenRouterSettingsContext, value: string): Promise<void> {
    const key = value.trim()
    if (!key) {
        clearApiKey.call(this)
        return
    }
    this.openRouter.apiKey = key
    const cryptoApi = this.getCrypto()
    if (cryptoApi?.subtle) {
        try {
            const aesKey = await ensureEncryptionKey.call(this, cryptoApi)
            writeConfig(this.openRouter, { payload: await encryptString(key, cryptoApi, aesKey) })
            this.updateOpenRouterStatus('OpenRouter API key saved securely.', 'success', 5000)
        } catch (error) {
            console.warn('Failed to encrypt OpenRouter API key:', error)
            writeConfig(this.openRouter, { apiKey: key })
            this.updateOpenRouterStatus('OpenRouter API key saved (unencrypted fallback).', 'neutral', 6000)
        }
    } else {
        writeConfig(this.openRouter, { apiKey: key })
        this.updateOpenRouterStatus('OpenRouter API key saved (unencrypted — Web Crypto unavailable).', 'neutral', 6000)
    }
    void this.ensureOpenRouterModels()
    this.initializeAIChat()
    this.updateAIChatHeader()
}

function clearApiKey(this: OpenRouterSettingsContext): void {
    this.openRouter.apiKey = ''
    this.openRouter.encryptionKey = null
    safeLocalStorage.removeItem(OPENROUTER_SECRET_STORAGE_KEY)
    writeConfig(this.openRouter, {})
    const keyInput = this.openRouter.elements.keyInput
    if (keyInput) {
        keyInput.value = ''
    }
    this.updateOpenRouterStatus('OpenRouter API key cleared.', 'neutral', 6000)
    this.initializeAIChat()
    this.updateAIChatHeader()
}

function applyModel(this: OpenRouterSettingsContext, value: string): void {
    const id = value.trim()
    if (!isValidOpenRouterModelId(id)) {
        const info = this.openRouter.elements.modelInfo
        if (info) {
            info.textContent = `"${id || '(empty)'}" is not a valid OpenRouter model ID. Use the provider/model form, e.g. ${DEFAULT_OPENROUTER_MODEL}.`
            info.classList.add('is-error')
        }
        return
    }
    this.openRouter.model = id
    saveSettings(this.openRouter)
    if (this.openRouter.elements.modelInput) {
        this.openRouter.elements.modelInput.value = id
    }
    // The info line under the field now describes the chosen model (or says it is custom).
    this.renderOpenRouterModelOptions()
    this.updateAIChatHeader()
    this.renderAIChatMessages()
}

/** Shows a message next to a field, ahead of its permanent help text (kept in data-base). */
function showFieldNote(note: HTMLElement | null | undefined, message: string, variant: AIStatusVariant): void {
    if (!note) {
        return
    }
    note.dataset.base ??= note.textContent ?? ''
    note.textContent = message ? `${message} ${note.dataset.base}` : note.dataset.base
    note.classList.toggle('is-success', variant === 'success')
    note.classList.toggle('is-error', variant === 'error')
}

function applyFallbacks(this: OpenRouterSettingsContext, value: string): void {
    const note = this.openRouter.elements.fallbackNote
    const ids = value.split(',').map(id => id.trim()).filter(Boolean)
    const invalid = ids.filter(id => !isValidOpenRouterModelId(id))
    if (invalid.length) {
        showFieldNote(note, `Not a valid model ID: ${invalid.join(', ')}.`, 'error')
        return
    }
    if (ids.length > OPENROUTER_MAX_FALLBACK_MODELS) {
        showFieldNote(note, `Use at most ${OPENROUTER_MAX_FALLBACK_MODELS} fallback models.`, 'error')
        return
    }
    this.openRouter.fallbackModels = ids
    saveSettings(this.openRouter)
    showFieldNote(note, ids.length ? `Saved: ${ids.join(', ')}.` : 'Fallback models cleared.', 'success')
}

export function updateOpenRouterStatus(this: OpenRouterSettingsContext, message: string, variant: AIStatusVariant = 'neutral', autoClearMs = 0): void {
    const state = this.openRouter
    const status = state.elements.status
    if (!status) {
        state.pendingStatus = { message, variant, autoClearMs }
        return
    }
    status.textContent = message
    status.classList.toggle('is-success', variant === 'success')
    status.classList.toggle('is-error', variant === 'error')
    if (state.statusTimeoutId) {
        clearTimeout(state.statusTimeoutId)
    }
    state.statusTimeoutId = autoClearMs > 0
        ? setTimeout(() => {
            if (!status.isConnected) return
            const hasKey = Boolean(state.apiKey)
            status.textContent = hasKey ? 'API key loaded' : 'Not set'
            status.classList.toggle('is-success', hasKey)
            status.classList.remove('is-error')
        }, autoClearMs)
        : null
}

export async function ensureOpenRouterModels(this: OpenRouterSettingsContext): Promise<OpenRouterModel[]> {
    const models = await ensureOpenRouterCatalogue(this.openRouter)
    this.renderOpenRouterModelOptions()
    return models
}

const MODEL_LIST_LIMIT = 80

function modelMeta(model: OpenRouterModel): string {
    const parts: string[] = []
    if (model.promptPricePerMillion !== null) {
        parts.push(`$${model.promptPricePerMillion < 0.1 ? model.promptPricePerMillion.toFixed(3) : model.promptPricePerMillion.toFixed(2)}/M in`)
    }
    if (model.vision) {
        parts.push('images')
    }
    return parts.join(' · ')
}

function modelListOptions(list: HTMLElement): HTMLElement[] {
    return Array.from(list.querySelectorAll<HTMLElement>('[role="option"]'))
}

function setActiveModelOption(this: OpenRouterSettingsContext, index: number): void {
    const { modelList, modelInput } = this.openRouter.elements
    if (!modelList || !modelInput) {
        return
    }
    const options = modelListOptions(modelList)
    options.forEach((option, i) => {
        option.classList.toggle('is-active', i === index)
        option.setAttribute('aria-selected', String(i === index))
    })
    const active = options[index]
    if (active) {
        modelInput.setAttribute('aria-activedescendant', active.id)
        active.scrollIntoView({ block: 'nearest' })
    } else {
        modelInput.removeAttribute('aria-activedescendant')
    }
}

function setModelListOpen(this: OpenRouterSettingsContext, open: boolean): void {
    const { modelList, modelInput } = this.openRouter.elements
    if (!modelList || !modelInput) {
        return
    }
    modelList.hidden = !open
    modelInput.setAttribute('aria-expanded', String(open))
    if (open) {
        this.renderOpenRouterModelOptions()
    } else {
        modelInput.removeAttribute('aria-activedescendant')
    }
}

/** Renders the info line and, when open, the filtered model dropdown. */
export function renderOpenRouterModelOptions(this: OpenRouterSettingsContext): void {
    const { modelList, modelInfo, modelInput } = this.openRouter.elements
    if (modelInfo) {
        modelInfo.classList.remove('is-error')
        const known = findOpenRouterModel(this.openRouter, this.openRouter.model)
        const prefix = this.openRouter.modelsError ? 'Model list unavailable — showing defaults. ' : ''
        modelInfo.textContent = prefix + (known ? describeOpenRouterModel(known) : 'Custom model — details unknown.')
    }
    if (!modelList || !modelInput || modelList.hidden) {
        return
    }

    // Right after focusing the pre-filled field, show everything; once the user types, filter.
    const showAll = modelInput.dataset.showAll === '1'
    const query = modelInput.value.trim().toLowerCase()
    const all = availableOpenRouterModels(this.openRouter)
    const filtered = showAll || !query
        ? [...all]
        : all.filter(model => model.id.toLowerCase().includes(query) || model.name.toLowerCase().includes(query))
    // Current model first, then the curated picks, then everything else A–Z (the API lists newest first).
    const rank = (id: string) => (id === this.openRouter.model ? 0 : OPENROUTER_CURATED_MODELS.some(m => m.id === id) ? 1 : 2)
    const matches = filtered.sort((a, b) => rank(a.id) - rank(b.id) || a.id.localeCompare(b.id))

    const fragment = document.createDocumentFragment()
    matches.slice(0, MODEL_LIST_LIMIT).forEach((model, index) => {
        const item = document.createElement('li')
        item.id = `openrouter-model-option-${index}`
        item.className = 'ai-model-picker__option'
        item.setAttribute('role', 'option')
        item.setAttribute('aria-selected', 'false')
        item.dataset.modelId = model.id
        if (model.id === this.openRouter.model) {
            item.classList.add('is-current')
        }
        const id = document.createElement('span')
        id.className = 'ai-model-picker__id'
        id.textContent = model.id
        item.appendChild(id)
        const meta = [model.name.replace(/^[^:]+:\s+/, ''), modelMeta(model)].filter(Boolean).join(' · ')
        if (meta) {
            const detail = document.createElement('span')
            detail.className = 'ai-model-picker__meta'
            detail.textContent = meta
            item.appendChild(detail)
        }
        fragment.appendChild(item)
    })
    if (!matches.length) {
        const note = document.createElement('li')
        note.className = 'ai-model-picker__note'
        note.setAttribute('role', 'presentation')
        note.textContent = 'No matching models. Press Enter to use the ID as typed.'
        fragment.appendChild(note)
    } else if (matches.length > MODEL_LIST_LIMIT) {
        const note = document.createElement('li')
        note.className = 'ai-model-picker__note'
        note.setAttribute('role', 'presentation')
        note.textContent = `${matches.length - MODEL_LIST_LIMIT} more — keep typing to narrow the list.`
        fragment.appendChild(note)
    }
    modelList.replaceChildren(fragment)
    modelInput.removeAttribute('aria-activedescendant')
}

export function initializeOpenRouterControls(this: OpenRouterSettingsContext): void {
    const container = document.getElementById('openrouter-controls')
    if (!container) {
        return
    }
    const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null
    const elements: OpenRouterState['elements'] = {
        container,
        keyInput: byId<HTMLInputElement>('openrouter-api-key'),
        saveButton: byId('openrouter-save'),
        clearButton: byId('openrouter-clear'),
        modelInput: byId<HTMLInputElement>('openrouter-model'),
        modelSaveButton: byId('openrouter-model-save'),
        modelList: byId('openrouter-model-list'),
        modelInfo: byId('openrouter-model-info'),
        fallbackInput: byId<HTMLInputElement>('openrouter-fallback-models'),
        fallbackSaveButton: byId('openrouter-fallback-save'),
        fallbackNote: byId('openrouter-fallback-note'),
        dataCollectionInput: byId<HTMLInputElement>('openrouter-data-collection'),
        status: byId('openrouter-status')
    }
    this.openRouter.elements = elements

    if (elements.keyInput) elements.keyInput.value = this.openRouter.apiKey ?? ''
    if (elements.modelInput) elements.modelInput.value = this.openRouter.model
    if (elements.fallbackInput) elements.fallbackInput.value = this.openRouter.fallbackModels.join(', ')
    if (elements.dataCollectionInput) elements.dataCollectionInput.checked = this.openRouter.dataCollection === 'deny'

    const onEnter = (input: HTMLInputElement | null | undefined, action: () => void) => {
        input?.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault()
                action()
            }
        })
    }
    const onClick = (button: HTMLElement | null | undefined, action: () => void) => {
        button?.addEventListener('click', (event) => {
            event.preventDefault()
            action()
        })
    }

    const commitKey = () => { void saveApiKey.call(this, elements.keyInput?.value ?? '') }
    const commitModel = () => applyModel.call(this, elements.modelInput?.value ?? '')
    const commitFallbacks = () => applyFallbacks.call(this, elements.fallbackInput?.value ?? '')

    onClick(elements.saveButton, commitKey)
    onEnter(elements.keyInput, commitKey)
    onClick(elements.clearButton, () => clearApiKey.call(this))
    onClick(elements.modelSaveButton, commitModel)
    // Picking from the list or clicking away must apply the model too, not only the button.
    elements.modelInput?.addEventListener('change', commitModel)

    const modelInput = elements.modelInput
    const modelList = elements.modelList
    const openList = () => {
        if (modelInput) modelInput.dataset.showAll = '1'
        setModelListOpen.call(this, true)
        void this.ensureOpenRouterModels()
    }
    modelInput?.addEventListener('focus', openList)
    modelInput?.addEventListener('click', openList)
    modelInput?.addEventListener('input', () => {
        delete modelInput.dataset.showAll
        setModelListOpen.call(this, true)
    })
    modelInput?.addEventListener('blur', () => setModelListOpen.call(this, false))
    modelInput?.addEventListener('keydown', (event) => {
        if (!modelList) return
        const options = modelListOptions(modelList)
        const current = options.findIndex(option => option.classList.contains('is-active'))
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            if (modelList.hidden) {
                openList()
                return
            }
            if (!options.length) return
            const step = event.key === 'ArrowDown' ? 1 : -1
            setActiveModelOption.call(this, current === -1 ? (step === 1 ? 0 : options.length - 1) : (current + step + options.length) % options.length)
        } else if (event.key === 'Enter') {
            event.preventDefault()
            const picked = !modelList.hidden && current !== -1 ? options[current]?.dataset.modelId : undefined
            if (picked && modelInput) modelInput.value = picked
            setModelListOpen.call(this, false)
            commitModel()
        } else if (event.key === 'Escape' && !modelList.hidden) {
            event.preventDefault()
            setModelListOpen.call(this, false)
        }
    })
    // mousedown (not click) so the input keeps focus and its blur doesn't close the list first
    modelList?.addEventListener('mousedown', (event) => {
        event.preventDefault()
        const option = (event.target instanceof Element ? event.target.closest<HTMLElement>('[role="option"]') : null)
        const id = option?.dataset.modelId
        if (!id || !modelInput) return
        modelInput.value = id
        setModelListOpen.call(this, false)
        commitModel()
    })
    onClick(elements.fallbackSaveButton, commitFallbacks)
    onEnter(elements.fallbackInput, commitFallbacks)
    elements.fallbackInput?.addEventListener('change', commitFallbacks)
    elements.dataCollectionInput?.addEventListener('change', () => {
        this.openRouter.dataCollection = elements.dataCollectionInput?.checked ? 'deny' : 'allow'
        saveSettings(this.openRouter)
    })

    const pending = this.openRouter.pendingStatus
    if (pending) {
        this.openRouter.pendingStatus = null
        this.updateOpenRouterStatus(pending.message, pending.variant, pending.autoClearMs)
    } else {
        this.updateOpenRouterStatus(this.openRouter.apiKey ? 'API key loaded' : 'Not set', this.openRouter.apiKey ? 'success' : 'neutral')
    }
    this.renderOpenRouterModelOptions()
    if (this.openRouter.apiKey && this.aiProvider.active === 'openrouter') {
        void this.ensureOpenRouterModels()
    }
}
