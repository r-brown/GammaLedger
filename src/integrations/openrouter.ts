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
    describeOpenRouterModelShort,
    ensureOpenRouterCatalogue,
    findOpenRouterModel,
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
        this.updateOpenRouterStatus(`"${id || '(empty)'}" is not a valid OpenRouter model ID. Use the provider/model form, e.g. ${DEFAULT_OPENROUTER_MODEL}.`, 'error', 8000)
        return
    }
    this.openRouter.model = id
    saveSettings(this.openRouter)
    if (this.openRouter.elements.modelInput) {
        this.openRouter.elements.modelInput.value = id
    }
    const listed = this.openRouter.models ? this.openRouter.models.some(model => model.id === id) : true
    this.updateOpenRouterStatus(
        listed ? `Model set to ${id}.` : `Model set to ${id}. It isn't in OpenRouter's current list — double-check the ID.`,
        listed ? 'success' : 'neutral',
        6000
    )
    this.renderOpenRouterModelOptions()
    this.updateAIChatHeader()
    this.renderAIChatMessages()
}

function applyFallbacks(this: OpenRouterSettingsContext, value: string): void {
    const ids = value.split(',').map(id => id.trim()).filter(Boolean)
    const invalid = ids.filter(id => !isValidOpenRouterModelId(id))
    if (invalid.length) {
        this.updateOpenRouterStatus(`Not a valid model ID: ${invalid.join(', ')}`, 'error', 8000)
        return
    }
    if (ids.length > OPENROUTER_MAX_FALLBACK_MODELS) {
        this.updateOpenRouterStatus(`Use at most ${OPENROUTER_MAX_FALLBACK_MODELS} fallback models.`, 'error', 8000)
        return
    }
    this.openRouter.fallbackModels = ids
    saveSettings(this.openRouter)
    this.updateOpenRouterStatus(ids.length ? `Fallback models: ${ids.join(', ')}` : 'Fallback models cleared.', 'success', 6000)
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

export function renderOpenRouterModelOptions(this: OpenRouterSettingsContext): void {
    const { modelOptions, modelInfo } = this.openRouter.elements
    if (modelOptions) {
        const fragment = document.createDocumentFragment()
        availableOpenRouterModels(this.openRouter).forEach((model) => {
            const option = document.createElement('option')
            option.value = model.id
            option.label = describeOpenRouterModelShort(model)
            fragment.appendChild(option)
        })
        modelOptions.replaceChildren(fragment)
    }
    if (modelInfo) {
        const known = findOpenRouterModel(this.openRouter, this.openRouter.model)
        const prefix = this.openRouter.modelsError ? 'Model list unavailable — showing defaults. ' : ''
        modelInfo.textContent = prefix + (known ? describeOpenRouterModel(known) : 'Custom model — details unknown.')
    }
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
        modelOptions: byId<HTMLDataListElement>('openrouter-model-options'),
        modelInfo: byId('openrouter-model-info'),
        fallbackInput: byId<HTMLInputElement>('openrouter-fallback-models'),
        fallbackSaveButton: byId('openrouter-fallback-save'),
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
    onEnter(elements.modelInput, commitModel)
    // Picking from the list or clicking away must apply the model too, not only the button.
    elements.modelInput?.addEventListener('change', commitModel)
    elements.modelInput?.addEventListener('focus', () => { void this.ensureOpenRouterModels() }, { once: true })
    onClick(elements.fallbackSaveButton, commitFallbacks)
    onEnter(elements.fallbackInput, commitFallbacks)
    elements.fallbackInput?.addEventListener('change', commitFallbacks)
    elements.dataCollectionInput?.addEventListener('change', () => {
        this.openRouter.dataCollection = elements.dataCollectionInput?.checked ? 'deny' : 'allow'
        saveSettings(this.openRouter)
        this.updateOpenRouterStatus(
            this.openRouter.dataCollection === 'deny'
                ? 'Only providers that don\'t train on your data will be used.'
                : 'Any provider may be used, including ones that may train on prompts.',
            'neutral',
            6000
        )
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
