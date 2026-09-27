// src/integrations/jev.ts — JEV (TypeSafe AI) key storage and settings UI. Saving a key asks for
// consent to send decision data to TypeSafe. Uses the .call(this, …) delegation pattern.

import { JEV_SECRET_STORAGE_KEY, JEV_STORAGE_KEY } from '@core/config'
import { JevConfigSchema, type JevConfig } from '@core/schema'
import type { ConsentRequirement } from '@core/consent'
import { safeLocalStorage } from '@core/storage'
import { decryptString, encryptString, loadOrCreateAesKey } from '@utils/crypto'
import type { JevState } from '@types-gl/integrations'

interface JevSettingsContext {
    jev: JevState
    getCrypto(): Crypto | null
    promptAICoachConsent(nextAction?: (() => void) | null, requirement?: ConsentRequirement): boolean
    refreshAIDecisionViews(): void
}

export function parseJevConfig(raw: string | null): JevConfig | null {
    if (!raw) return null
    try {
        const parsed = JevConfigSchema.safeParse(JSON.parse(raw))
        return parsed.success ? parsed.data : null
    } catch {
        return null
    }
}

function setStatus(this: JevSettingsContext, message: string, variant: 'success' | 'error' | 'neutral', autoClearMs = 0): void {
    const status = this.jev.elements.status
    if (!status) return
    status.textContent = message
    status.classList.toggle('is-success', variant === 'success')
    status.classList.toggle('is-error', variant === 'error')
    if (this.jev.statusTimeoutId) clearTimeout(this.jev.statusTimeoutId)
    this.jev.statusTimeoutId = autoClearMs > 0
        ? setTimeout(() => setStatus.call(this, defaultStatus(this.jev), this.jev.apiKey ? 'success' : 'neutral'), autoClearMs)
        : null
}

function defaultStatus(jev: JevState): string {
    if (!jev.apiKey) return 'Not set — AI Read and thesis checks use your AI provider instead.'
    return jev.reachable
        ? 'JEV key loaded.'
        : 'JEV couldn\'t be reached from this browser (network or CORS). Using your AI provider for now.'
}

export async function loadJevConfigFromStorage(this: JevSettingsContext): Promise<boolean> {
    const config = parseJevConfig(safeLocalStorage.getItem(JEV_STORAGE_KEY))
    if (!config) return false
    if (config.payload) {
        const cryptoApi = this.getCrypto()
        if (!cryptoApi?.subtle) return false
        try {
            this.jev.encryptionKey = await loadOrCreateAesKey(safeLocalStorage, JEV_SECRET_STORAGE_KEY, cryptoApi)
            this.jev.apiKey = (await decryptString(config.payload, cryptoApi, this.jev.encryptionKey)).trim()
        } catch (error) {
            console.warn('Failed to decrypt the stored JEV key:', error)
            return false
        }
    } else if (config.apiKey) {
        this.jev.apiKey = config.apiKey.trim()
    }
    return Boolean(this.jev.apiKey)
}

async function saveKey(this: JevSettingsContext, value: string): Promise<void> {
    const key = value.trim()
    if (!key) {
        clearKey.call(this)
        return
    }
    this.jev.apiKey = key
    this.jev.reachable = true
    const cryptoApi = this.getCrypto()
    let config: JevConfig = { version: 1, apiKey: key }
    if (cryptoApi?.subtle) {
        try {
            this.jev.encryptionKey ??= await loadOrCreateAesKey(safeLocalStorage, JEV_SECRET_STORAGE_KEY, cryptoApi)
            config = { version: 1, payload: await encryptString(key, cryptoApi, this.jev.encryptionKey) }
        } catch (error) {
            console.warn('Failed to encrypt the JEV key; storing it unencrypted:', error)
        }
    }
    safeLocalStorage.setItem(JEV_STORAGE_KEY, JSON.stringify(config))
    setStatus.call(this, config.payload ? 'JEV key saved securely.' : 'JEV key saved (unencrypted fallback).', 'success', 5000)
    // Sending decisions to a new recipient needs its own consent (spec D5).
    this.promptAICoachConsent(() => this.refreshAIDecisionViews(), { minVersion: 2, decision: 'jev' })
}

function clearKey(this: JevSettingsContext): void {
    this.jev.apiKey = null
    this.jev.encryptionKey = null
    this.jev.reachable = true
    safeLocalStorage.removeItem(JEV_STORAGE_KEY)
    safeLocalStorage.removeItem(JEV_SECRET_STORAGE_KEY)
    if (this.jev.elements.keyInput) this.jev.elements.keyInput.value = ''
    setStatus.call(this, 'JEV key cleared.', 'neutral', 5000)
    this.refreshAIDecisionViews()
}

export function initializeJevControls(this: JevSettingsContext): void {
    const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null
    this.jev.elements = {
        keyInput: byId<HTMLInputElement>('jev-api-key'),
        saveButton: byId('jev-save'),
        clearButton: byId('jev-clear'),
        status: byId('jev-status')
    }
    const { keyInput, saveButton, clearButton } = this.jev.elements
    if (keyInput) keyInput.value = this.jev.apiKey ?? ''
    saveButton?.addEventListener('click', (event) => { event.preventDefault(); void saveKey.call(this, keyInput?.value ?? '') })
    keyInput?.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); void saveKey.call(this, keyInput.value) } })
    clearButton?.addEventListener('click', (event) => { event.preventDefault(); clearKey.call(this) })
    setStatus.call(this, defaultStatus(this.jev), this.jev.apiKey ? 'success' : 'neutral')
}

export function refreshJevStatus(this: JevSettingsContext): void {
    setStatus.call(this, defaultStatus(this.jev), this.jev.apiKey && this.jev.reachable ? 'success' : 'neutral')
}
