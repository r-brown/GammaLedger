// src/integrations/gemini.js — Wave 5: Gemini API settings & UI controls.
// The agent class itself lives in src/ai/gemini-agent.js.
// Uses the .call(this, …) delegation pattern so all this.* refs work.

export function initializeGeminiControls() {
    const container = document.getElementById('gemini-controls');
    if (!container) {
        return;
    }

    const keyInput = document.getElementById('gemini-api-key');
    const modelSelect = document.getElementById('gemini-model');
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
            const selectedModel = event.target.value;
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

export function initializeGeminiMaxTokensControls() {
    const maxTokensInput = document.getElementById('gemini-max-tokens');
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
            maxTokensInput.value = DEFAULT_GEMINI_MAX_TOKENS;
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

export function updateGeminiTokensStatus(element, message = null, variant = 'neutral') {
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

export function syncGeminiControlsFromState({ preserveStatus = true } = {}) {
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

export function flushPendingGeminiStatus() {
    const pending = this.gemini?.pendingStatus;
    if (!pending) {
        return;
    }

    this.updateGeminiStatus(pending.message, pending.variant, pending.autoClearMs);
    this.gemini.pendingStatus = null;
}

export function getGeminiModelLabel(model = '') {
    const normalized = (model || '').toLowerCase();
    const labels = {
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

export function getGeminiChatDisplayName() {
    const label = this.getGeminiModelLabel(this.gemini?.model);
    return label ? label : 'Gemini';
}

export function updateGeminiStatus(message, variant = 'neutral', autoClearMs = 0) {
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

export function setGeminiApiKey(value, { persist = false, updateUI = true } = {}) {
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

export function setGeminiModel(value) {
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

export function saveGeminiConfigToStorage({ includeApiKey = false, encryptedPayload = null } = {}) {
    try {
        const payload = {
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

export function removeGeminiEncryptionKey() {
    try {
        this.safeLocalStorage.removeItem(GEMINI_SECRET_STORAGE_KEY);
        this.gemini.encryptionKey = null;
    } catch (error) {
        console.warn('Failed to remove Gemini encryption key:', error);
    }
}

export function loadGeminiMaxTokensFromStorage() {
    try {
        const stored = localStorage.getItem(GEMINI_MAX_TOKENS_STORAGE_KEY);
        if (stored !== null) {
            const value = parseInt(stored, 10);
            if (Number.isFinite(value) && value > 0) {
                return value;
            }
        }
    } catch (error) {
        console.warn('Failed to load Gemini max tokens from storage:', error);
    }
    return DEFAULT_GEMINI_MAX_TOKENS;
}

export function saveGeminiMaxTokensToStorage() {
    try {
        if (this.gemini?.maxOutputTokens) {
            localStorage.setItem(GEMINI_MAX_TOKENS_STORAGE_KEY, String(this.gemini.maxOutputTokens));
        }
    } catch (error) {
        console.warn('Failed to save Gemini max tokens to storage:', error);
    }
}

export function removeGeminiMaxTokensFromStorage() {
    try {
        localStorage.removeItem(GEMINI_MAX_TOKENS_STORAGE_KEY);
    } catch (error) {
        console.warn('Failed to remove Gemini max tokens from storage:', error);
    }
}
