// src/settings/external-analytics.ts — External Analytics URL settings.
// Uses the .call(this, …) delegation pattern so all this.* refs work.

import { EXTERNAL_ANALYTICS_STORAGE_KEY, DEFAULT_EXTERNAL_ANALYTICS_URL } from '../core/config.js';
import { safeLocalStorage } from '@core/storage'

interface ExternalAnalyticsContext {
    externalAnalyticsUrl: string;
    loadExternalAnalyticsFromStorage(): void;
    saveExternalAnalyticsToStorage(): void;
    removeExternalAnalyticsFromStorage(): void;
    updateExternalAnalyticsStatus(element: HTMLElement | null, message?: string | null, variant?: string, duration?: number): void;
}

export function initializeExternalAnalyticsControls(this: ExternalAnalyticsContext): void {
    const container = document.getElementById('external-analytics-controls');
    if (!container) {
        return;
    }

    const input = document.getElementById('external-analytics-url') as HTMLInputElement | null;
    const saveButton = document.getElementById('external-analytics-save') as HTMLButtonElement | null;
    const clearButton = document.getElementById('external-analytics-clear') as HTMLButtonElement | null;
    const status = document.getElementById('external-analytics-status');

    // Load saved value from durable browser storage.
    this.loadExternalAnalyticsFromStorage();

    // Initialize input with saved value
    if (input) {
        input.value = this.externalAnalyticsUrl === DEFAULT_EXTERNAL_ANALYTICS_URL ? '' : this.externalAnalyticsUrl;
    }

    // Save button handler
    saveButton?.addEventListener('click', (event) => {
        event.preventDefault();
        const value = (input?.value || '').trim();

        if (value) {
            this.externalAnalyticsUrl = value;
            this.saveExternalAnalyticsToStorage();
            this.updateExternalAnalyticsStatus(status, `External analytics URL saved`, 'success');
        } else {
            this.externalAnalyticsUrl = DEFAULT_EXTERNAL_ANALYTICS_URL;
            this.removeExternalAnalyticsFromStorage();
            this.updateExternalAnalyticsStatus(status, 'Reverted to default analytics URL', 'neutral');
        }
    });

    // Clear button handler
    clearButton?.addEventListener('click', (event) => {
        event.preventDefault();
        this.externalAnalyticsUrl = DEFAULT_EXTERNAL_ANALYTICS_URL;
        this.removeExternalAnalyticsFromStorage();
        if (input) {
            input.value = '';
        }
        this.updateExternalAnalyticsStatus(status, 'Reverted to default analytics URL', 'neutral');
    });

    // Enter key handler
    input?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            saveButton?.click();
        }
    });
}

export function loadExternalAnalyticsFromStorage(this: ExternalAnalyticsContext): void {
    const stored = safeLocalStorage.getItem(EXTERNAL_ANALYTICS_STORAGE_KEY);
    this.externalAnalyticsUrl = stored || DEFAULT_EXTERNAL_ANALYTICS_URL;
}

export function saveExternalAnalyticsToStorage(this: ExternalAnalyticsContext): void {
    if (this.externalAnalyticsUrl && this.externalAnalyticsUrl !== DEFAULT_EXTERNAL_ANALYTICS_URL) {
        safeLocalStorage.setItem(EXTERNAL_ANALYTICS_STORAGE_KEY, this.externalAnalyticsUrl);
    } else {
        safeLocalStorage.removeItem(EXTERNAL_ANALYTICS_STORAGE_KEY);
    }
}

export function removeExternalAnalyticsFromStorage(this: ExternalAnalyticsContext): void {
    safeLocalStorage.removeItem(EXTERNAL_ANALYTICS_STORAGE_KEY);
}

export function updateExternalAnalyticsStatus(
    this: ExternalAnalyticsContext,
    element: HTMLElement | null,
    message: string | null = null,
    variant = 'neutral',
    _duration = 4000
): void {
    if (!element) {
        return;
    }

    if (message) {
        element.textContent = message;
        element.className = 'default-fee-status'; // Reusing this class for general status
        if (variant === 'success') {
            element.classList.add('is-success');
        } else if (variant === 'error') {
            element.classList.add('is-error');
        }
        
        setTimeout(() => {
            element.textContent = '';
            element.className = 'default-fee-status';
        }, _duration);
    }
}
