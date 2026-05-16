// src/integrations/gemini.ts — Wave 5: Gemini API settings & UI controls.
// The agent class itself lives in src/ai/gemini-agent.ts.
// Uses the .call(this, …) delegation pattern so all this.* refs work.

import {
    GEMINI_ALLOWED_MODELS,
    DEFAULT_GEMINI_MODEL,
    DEFAULT_GEMINI_MAX_TOKENS,
    GEMINI_STORAGE_KEY,
    GEMINI_SECRET_STORAGE_KEY,
    GEMINI_MAX_TOKENS_STORAGE_KEY
} from '@core/config'

type AnyRecord = Record<string, any>
type GeminiStatusVariant = 'success' | 'error' | 'neutral'

interface GeminiPendingStatus {
    message: string
    variant: GeminiStatusVariant
    autoClearMs: number
}

interface GeminiSaveOptions {
    includeApiKey?: boolean
    encryptedPayload?: string | null
}

export function initializeGeminiControls(this: any) {
    const container = document.getElementById('gemini-controls');
    if (!container) {
        return;
    }

    const keyInput = document.getElementById('gemini-api-key') as HTMLInputElement | null;
    const modelSelect = document.getElementById('gemini-model') as HTMLSelectElement | null;
    const saveButton = document.getElementById('gemini-save');
    const clearButton = document.getElementById('gemini-clear');
    const status = document.getElementById('gemini-status');

    this.gemini.elements = {
        container,
        keyInput,
        modelSelect,
        saveButton,
        clearButton,
        status
    };

    if (!GEMINI_ALLOWED_MODELS.includes(this.gemini.model)) {
        this.gemini.model = DEFAULT_GEMINI_MODEL;
    }

    if (modelSelect) {
        const options = Array.from(modelSelect.options).map(option => option.value);
        if (options.length === 0) {
            GEMINI_ALLOWED_MODELS.forEach(model => {
                const option = document.createElement('option');
                option.value = model;
                option.textContent = model.replace(/gemini-2\.5-/, 'Gemini 2.5 ').replace(/-/g, ' ').replace(/\b([a-z])/g, (_, letter) => letter.toUpperCase());
                modelSelect.appendChild(option);
            });
        }

        // Set initial value from current state
        const currentModel = GEMINI_ALLOWED_MODELS.includes(this.gemini.model)
            ? this.gemini.model
            : DEFAULT_GEMINI_MODEL;
        
        modelSelect.value = currentModel;
        
        // Ensure state matches dropdown
        if (this.gemini.model !== currentModel) {
            this.setGeminiModel(currentModel);
        }

        // Add change event listener
        modelSelect.addEventListener('change', (event) => {
            const selectedModel = (event.target as HTMLSelectElement).value;
            this.setGeminiModel(selectedModel);
            this.saveGeminiConfigToStorage();
        });
    }

    // Sync controls after dropdown is fully set up
    this.syncGeminiControlsFromState({ preserveStatus: Boolean(this.gemini.pendingStatus) });

    const commit = async () => {
        const value = (keyInput?.value || '').trim();
        this.setGeminiApiKey(value, { persist: false, updateUI: false });
        const sanitizedValue = this.gemini.apiKey;

        const cryptoApi = this.getCrypto();

        if (!value) {
            this.removeGeminiEncryptionKey();
            this.saveGeminiConfigToStorage();
            if (keyInput) {
                keyInput.value = '';
            }
            this.updateGeminiStatus('API key cleared. Connect your Gemini key via Settings to get tailored analysis.', 'neutral', 6000);
            this.initializeAIChat();
            this.updateAIChatHeader();
            return;
        }

        if (!cryptoApi?.subtle) {
            this.saveGeminiConfigToStorage({ includeApiKey: true });
            this.updateGeminiStatus('Gemini API key saved (unencrypted — Web Crypto unavailable).', 'success', 6000);
            if (keyInput) {
                keyInput.value = sanitizedValue;
            }
            this.initializeAIChat();
            this.updateAIChatHeader();
            return;
        }

        const encrypted = await this.encryptAndStoreGeminiApiKey(cryptoApi);
        if (encrypted) {
            this.updateGeminiStatus('Gemini API key saved securely.', 'success', 5000);
        } else {
            this.saveGeminiConfigToStorage({ includeApiKey: true });
            this.updateGeminiStatus('Gemini API key saved (unencrypted fallback).', 'neutral', 6000);
        }

        if (keyInput) {
            keyInput.value = sanitizedValue;
        }

        this.initializeAIChat();
        this.updateAIChatHeader();
    };

    saveButton?.addEventListener('click', async (event) => {
        event.preventDefault();
        await commit();
    });

    keyInput?.addEventListener('keydown', async (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            await commit();
        }
    });

    clearButton?.addEventListener('click', (event) => {
        event.preventDefault();
        if (keyInput) {
            keyInput.value = '';
        }
        this.setGeminiApiKey('', { persist: false, updateUI: false });
        this.removeGeminiEncryptionKey();
        this.saveGeminiConfigToStorage();
        this.updateGeminiStatus('API key cleared. Connect your Gemini key via Settings to get tailored analysis.', 'neutral', 6000);
        this.initializeAIChat();
        this.updateAIChatHeader();
    });

    // Max tokens controls
    this.initializeGeminiMaxTokensControls();

    this.updateAIChatHeader();
    this.flushPendingGeminiStatus();
}

export function initializeGeminiMaxTokensControls(this: any) {
    const maxTokensInput = document.getElementById('gemini-max-tokens') as HTMLInputElement | null;
    const tokensSaveButton = document.getElementById('gemini-tokens-save');
    const tokensResetButton = document.getElementById('gemini-tokens-reset');
    const tokensStatus = document.getElementById('gemini-tokens-status');

    // Initialize input with current value
    if (maxTokensInput) {
        maxTokensInput.value = this.gemini.maxOutputTokens;
    }

    // Update status display
    this.updateGeminiTokensStatus(tokensStatus);

    // Save button handler
    tokensSaveButton?.addEventListener('click', (event) => {
        event.preventDefault();
        const value = parseInt(maxTokensInput?.value || '', 10);
        
        if (Number.isFinite(value) && value >= 1024) {
            this.gemini.maxOutputTokens = value;
            this.saveGeminiMaxTokensToStorage();
            this.updateGeminiTokensStatus(tokensStatus, `Max tokens set to ${value.toLocaleString()}`, 'success');
        } else {
            this.updateGeminiTokensStatus(tokensStatus, 'Please enter a valid token limit (min 1024)', 'error');
        }
    });

    // Reset button handler
    tokensResetButton?.addEventListener('click', (event) => {
        event.preventDefault();
        this.gemini.maxOutputTokens = DEFAULT_GEMINI_MAX_TOKENS;
        this.removeGeminiMaxTokensFromStorage();
        if (maxTokensInput) {
            maxTokensInput.value = String(DEFAULT_GEMINI_MAX_TOKENS);
        }
        this.updateGeminiTokensStatus(tokensStatus, `Max tokens reset to ${DEFAULT_GEMINI_MAX_TOKENS.toLocaleString()}`, 'neutral');
    });

    // Enter key handler
    maxTokensInput?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            tokensSaveButton?.click();
        }
    });
}

export function updateGeminiTokensStatus(this: any, element: HTMLElement | null, message: string | null = null, variant: GeminiStatusVariant = 'neutral') {
    if (!element) {
        return;
    }

    if (message) {
        element.textContent = message;
        element.className = 'gemini-tokens-status';
        if (variant === 'success') {
            element.classList.add('is-success');
        } else if (variant === 'error') {
            element.classList.add('is-error');
        }
        return;
    }

    // Default status based on current value
    const isDefault = this.gemini.maxOutputTokens === DEFAULT_GEMINI_MAX_TOKENS;
    if (isDefault) {
        element.textContent = `Default: ${DEFAULT_GEMINI_MAX_TOKENS.toLocaleString()}`;
        element.className = 'gemini-tokens-status';
    } else {
        element.textContent = `Custom: ${this.gemini.maxOutputTokens.toLocaleString()}`;
        element.className = 'gemini-tokens-status is-success';
    }
}

export function syncGeminiControlsFromState(this: any, { preserveStatus = true } = {}) {
    const keyInput = this.gemini?.elements?.keyInput;
    const nextValue = this.gemini?.apiKey ? this.gemini.apiKey : '';

    if (keyInput && keyInput.value !== nextValue) {
        keyInput.value = nextValue;
    }

    // Sync model select dropdown with current state
    const modelSelect = this.gemini?.elements?.modelSelect;
    if (modelSelect && this.gemini?.model && modelSelect.value !== this.gemini.model) {
        modelSelect.value = this.gemini.model;
    }

    const hasKey = Boolean(nextValue);
    const shouldUpdateStatus = !preserveStatus && !this.gemini?.pendingStatus;
    const shouldBootstrapStatus = preserveStatus && !this.gemini?.lastStatus && !this.gemini?.pendingStatus;

    if ((shouldUpdateStatus || shouldBootstrapStatus) && this.updateGeminiStatus) {
        const message = hasKey ? 'API key loaded' : 'Not set';
        const variant = hasKey ? 'success' : 'neutral';
        this.updateGeminiStatus(message, variant);
    }

    this.updateAIChatHeader();
}

export function flushPendingGeminiStatus(this: any) {
    const pending = this.gemini?.pendingStatus;
    if (!pending) {
        return;
    }

    this.updateGeminiStatus(pending.message, pending.variant, pending.autoClearMs);
    this.gemini.pendingStatus = null;
}

export function getGeminiModelLabel(this: any, model = '') {
    const normalized = (model || '').toLowerCase();
    const labels: Record<string, string> = {
        'gemini-2.5-flash-lite': 'Gemini 2.5 Flash Lite',
        'gemini-2.5-flash': 'Gemini 2.5 Flash',
        'gemini-2.5-pro': 'Gemini 2.5 Pro'
    };

    if (labels[normalized]) {
        return labels[normalized];
    }

    if (!normalized) {
        return '';
    }

    const fallback = normalized
        .replace(/^gemini[-\s]?/i, 'Gemini ')
        .replace(/-/g, ' ')
        .replace(/\b([a-z])/g, (_, letter) => letter.toUpperCase())
        .trim();

    return fallback || 'Gemini';
}

export function getGeminiChatDisplayName(this: any) {
    const label = this.getGeminiModelLabel(this.gemini?.model);
    return label ? label : 'Gemini';
}

export function updateGeminiStatus(this: any, message: string, variant: GeminiStatusVariant = 'neutral', autoClearMs = 0) {
    const statusEl = this.gemini?.elements?.status;
    if (!statusEl || !message) {
        return;
    }

    const normalizedVariant = ['success', 'error', 'neutral'].includes(variant) ? variant : 'neutral';
    statusEl.textContent = message;
    statusEl.classList.remove('is-success', 'is-error');
    if (normalizedVariant === 'success') {
        statusEl.classList.add('is-success');
    } else if (normalizedVariant === 'error') {
        statusEl.classList.add('is-error');
    }

    if (this.gemini.statusTimeoutId) {
        clearTimeout(this.gemini.statusTimeoutId);
    }

    this.gemini.lastStatus = { message, variant: normalizedVariant };
    this.gemini.pendingStatus = null;

    if (autoClearMs > 0) {
        this.gemini.statusTimeoutId = setTimeout(() => {
            if (!statusEl.isConnected) {
                return;
            }
            statusEl.textContent = normalizedVariant === 'neutral' ? 'Not set' : '';
            statusEl.classList.remove('is-success', 'is-error');
        }, autoClearMs);
    }
}

export function setGeminiApiKey(this: any, value: string, { persist = false, updateUI = true }: { persist?: boolean; updateUI?: boolean } = {}) {
    const sanitized = (value || '').trim();
    if (sanitized === this.gemini.apiKey) {
        return;
    }

    this.gemini.apiKey = sanitized;

    if (updateUI && this.gemini.elements?.keyInput) {
        this.gemini.elements.keyInput.value = sanitized;
    }

    if (persist) {
        this.saveGeminiConfigToStorage({ includeApiKey: true });
    }
}

export function setGeminiModel(this: any, value: string) {
    const sanitized = (value || '').trim();
    const nextModel = GEMINI_ALLOWED_MODELS.includes(sanitized)
        ? sanitized
        : DEFAULT_GEMINI_MODEL;
    const previousModel = this.gemini.model;
    this.gemini.model = nextModel;

    const select = this.gemini.elements?.modelSelect;
    if (select && select.value !== this.gemini.model) {
        select.value = this.gemini.model;
    }

    if (this.gemini.model !== previousModel) {
        this.updateAIChatHeader();
        this.renderAIChatMessages();
    }
}

export async function loadGeminiConfigFromStorage(this: any) {
    let loadedApiKey = '';
    let pendingStatus: GeminiPendingStatus | null = null;

    try {
        const raw = this.safeLocalStorage.getItem(GEMINI_STORAGE_KEY);
        if (!raw) {
            this.setGeminiApiKey('', { persist: false, updateUI: false });
            this.gemini.pendingStatus = null;
            this.syncGeminiControlsFromState({ preserveStatus: true });
            return false;
        }

        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') {
            this.setGeminiApiKey('', { persist: false, updateUI: false });
            this.gemini.pendingStatus = null;
            this.syncGeminiControlsFromState({ preserveStatus: true });
            return false;
        }

        if (typeof parsed.model === 'string' && parsed.model.trim()) {
            this.setGeminiModel(parsed.model.trim());
        }

        if (parsed.enc && parsed.payload) {
            const cryptoApi = this.getCrypto();
            if (!cryptoApi?.subtle) {
                console.warn('Encrypted Gemini API key stored but Web Crypto unavailable.');
                pendingStatus = {
                    message: 'Stored Gemini API key is encrypted, but this browser cannot decrypt it. Please re-enter it in Settings.',
                    variant: 'error',
                    autoClearMs: 9000
                };
            } else {
                try {
                    const key = await this.ensureGeminiEncryptionKey(cryptoApi);
                    if (!key) {
                        throw new Error('Encryption key unavailable');
                    }
                    const decrypted = await this.decryptString(parsed.payload, cryptoApi, key);
                    if (typeof decrypted === 'string') {
                        loadedApiKey = decrypted.trim();
                    }
                } catch (error) {
                    console.warn('Failed to decrypt stored Gemini API key:', error);
                    pendingStatus = {
                        message: 'Failed to decrypt stored Gemini API key. Please re-enter it in Settings.',
                        variant: 'error',
                        autoClearMs: 9000
                    };
                }
            }
        }

        if (!loadedApiKey && typeof parsed.apiKey === 'string') {
            loadedApiKey = parsed.apiKey.trim();
        }

        if (!loadedApiKey && typeof parsed.fallback === 'string' && parsed.fallback.trim()) {
            try {
                loadedApiKey = atob(parsed.fallback.trim()).trim();
            } catch (decodeError) {
                console.warn('Failed to decode Gemini API key fallback:', decodeError);
            }
        }

        if (loadedApiKey && pendingStatus) {
            pendingStatus = {
                message: 'Gemini API key loaded from local backup. Save it again to refresh secure storage when possible.',
                variant: 'neutral',
                autoClearMs: 9000
            };
        }
    } catch (error) {
        console.warn('Failed to load Gemini configuration:', error);
        if (!pendingStatus) {
            pendingStatus = {
                message: 'Failed to load Gemini configuration. Please verify your stored Gemini API key.',
                variant: 'error',
                autoClearMs: 9000
            };
        }
    }

    this.setGeminiApiKey(loadedApiKey, { persist: false, updateUI: false });
    this.gemini.pendingStatus = pendingStatus;
    this.syncGeminiControlsFromState({ preserveStatus: Boolean(pendingStatus) });
    return Boolean(loadedApiKey);
}

export function saveGeminiConfigToStorage(this: any, { includeApiKey = false, encryptedPayload = null }: GeminiSaveOptions = {}) {
    try {
        const payload: Record<string, unknown> = {
            model: this.gemini.model
        };

        // Preserve existing encrypted payload or API key if not explicitly provided
        if (encryptedPayload) {
            payload.enc = true;
            payload.payload = encryptedPayload;
            if (this.gemini.apiKey) {
                try {
                    payload.fallback = btoa(this.gemini.apiKey);
                } catch (_error) {
                    // Ignore fallback encoding issues; encrypted payload remains primary storage.
                }
            }
        } else if (includeApiKey && this.gemini.apiKey) {
            payload.apiKey = this.gemini.apiKey;
        } else {
            // Preserve existing API key/encrypted data when saving other settings
            try {
                const existingRaw = this.safeLocalStorage.getItem(GEMINI_STORAGE_KEY);
                if (existingRaw) {
                    const existing = JSON.parse(existingRaw);
                    if (existing?.enc && existing?.payload) {
                        payload.enc = true;
                        payload.payload = existing.payload;
                        if (existing.fallback) {
                            payload.fallback = existing.fallback;
                        }
                    } else if (existing?.apiKey) {
                        payload.apiKey = existing.apiKey;
                    }
                }
            } catch (error) {
                console.warn('Failed to preserve existing Gemini API key during save:', error);
            }
        }

        // Use safe localStorage wrapper
        this.safeLocalStorage.setItem(GEMINI_STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
        console.warn('Failed to save Gemini configuration:', error);
    }
}

export function removeGeminiEncryptionKey(this: any) {
    try {
        this.safeLocalStorage.removeItem(GEMINI_SECRET_STORAGE_KEY);
        this.gemini.encryptionKey = null;
    } catch (error) {
        console.warn('Failed to remove Gemini encryption key:', error);
    }
}

export async function ensureGeminiEncryptionKey(this: any, cryptoApi = this.getCrypto()) {
    if (!cryptoApi?.subtle) {
        return null;
    }

    if (this.gemini.encryptionKey) {
        return this.gemini.encryptionKey;
    }

    let rawKeyB64 = this.safeLocalStorage.getItem(GEMINI_SECRET_STORAGE_KEY);
    if (!rawKeyB64) {
        const raw = cryptoApi.getRandomValues(new Uint8Array(32));
        rawKeyB64 = this.arrayBufferToBase64(raw.buffer);
        this.safeLocalStorage.setItem(GEMINI_SECRET_STORAGE_KEY, rawKeyB64);
    }

    const rawKey = new Uint8Array(this.base64ToArrayBuffer(rawKeyB64));
    const cryptoKey = await cryptoApi.subtle.importKey('raw', rawKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    this.gemini.encryptionKey = cryptoKey;
    return cryptoKey;
}

export async function encryptAndStoreGeminiApiKey(this: any, cryptoApi = this.getCrypto()) {
    try {
        if (!cryptoApi?.subtle) {
            throw new Error('Web Crypto API unavailable');
        }

        const apiKey = this.gemini.apiKey || '';
        if (!apiKey) {
            this.saveGeminiConfigToStorage();
            return true;
        }

        const key = await this.ensureGeminiEncryptionKey(cryptoApi);
        if (!key) {
            throw new Error('Failed to prepare encryption key');
        }

        const payload = await this.encryptString(apiKey, cryptoApi, key);
        this.saveGeminiConfigToStorage({ encryptedPayload: payload });
        return true;
    } catch (error) {
        console.warn('Failed to encrypt Gemini API key:', error);
        return false;
    }
}

export function loadGeminiMaxTokensFromStorage(this: any) {
    const stored = this.safeLocalStorage.getItem(GEMINI_MAX_TOKENS_STORAGE_KEY);
    if (stored !== null) {
        const value = parseInt(stored, 10);
        if (Number.isFinite(value) && value > 0) {
            return value;
        }
    }
    return DEFAULT_GEMINI_MAX_TOKENS;
}

export function saveGeminiMaxTokensToStorage(this: any) {
    if (this.gemini?.maxOutputTokens) {
        this.safeLocalStorage.setItem(GEMINI_MAX_TOKENS_STORAGE_KEY, String(this.gemini.maxOutputTokens));
    }
}

export function removeGeminiMaxTokensFromStorage(this: any) {
    this.safeLocalStorage.removeItem(GEMINI_MAX_TOKENS_STORAGE_KEY);
}
