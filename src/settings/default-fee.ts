// src/settings/default-fee.ts — Wave 5: Default fee per contract settings.
// Uses the .call(this, …) delegation pattern so all this.* refs work.

import { DEFAULT_FEE_STORAGE_KEY } from '../core/config.js';
import { safeLocalStorage } from '@core/storage'

interface DefaultFeeContext {
    defaultFeePerContract: number | null
    loadDefaultFeeFromStorage(): void
    saveDefaultFeeToStorage(): void
    removeDefaultFeeFromStorage(): void
    updateDefaultFeeStatus(element: HTMLElement | null, message?: string | null, variant?: string, duration?: number): void
    formatCurrency(value: unknown, opts?: Record<string, unknown>): string
}

export function initializeDefaultFeeControls(this: DefaultFeeContext): void {
    const container = document.getElementById('default-fees-controls');
    if (!container) {
        return;
    }

    const input = document.getElementById('default-fee-per-contract') as HTMLInputElement | null;
    const saveButton = document.getElementById('default-fee-save') as HTMLButtonElement | null;
    const clearButton = document.getElementById('default-fee-clear') as HTMLButtonElement | null;
    const status = document.getElementById('default-fee-status');

    // Load saved value from durable browser storage.
    this.loadDefaultFeeFromStorage();

    // Initialize input with saved value
    if (input && this.defaultFeePerContract !== null) {
        input.value = String(this.defaultFeePerContract);
    }

    // Update status display
    this.updateDefaultFeeStatus(status);

    // Save button handler
    saveButton?.addEventListener('click', (event) => {
        event.preventDefault();
        const value = parseFloat(input?.value || '');

        if (Number.isFinite(value) && value >= 0) {
            this.defaultFeePerContract = value;
            this.saveDefaultFeeToStorage();
            this.updateDefaultFeeStatus(status, `Default fee set to ${this.formatCurrency(value)} per contract`, 'success');
        } else if (input?.value === '' || input?.value === null) {
            this.defaultFeePerContract = null;
            this.removeDefaultFeeFromStorage();
            this.updateDefaultFeeStatus(status, 'Default fee cleared', 'neutral');
        } else {
            this.updateDefaultFeeStatus(status, 'Please enter a valid fee amount', 'error');
        }
    });

    // Clear button handler
    clearButton?.addEventListener('click', (event) => {
        event.preventDefault();
        this.defaultFeePerContract = null;
        this.removeDefaultFeeFromStorage();
        if (input) {
            input.value = '';
        }
        this.updateDefaultFeeStatus(status, 'Default fee cleared', 'neutral');
    });

    // Enter key handler
    input?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            saveButton?.click();
        }
    });
}

export function loadDefaultFeeFromStorage(this: DefaultFeeContext): void {
    const stored = safeLocalStorage.getItem(DEFAULT_FEE_STORAGE_KEY);
    if (stored !== null) {
        const value = parseFloat(stored);
        if (Number.isFinite(value) && value >= 0) {
            this.defaultFeePerContract = value;
        }
    }
}

export function saveDefaultFeeToStorage(this: DefaultFeeContext): void {
    if (this.defaultFeePerContract !== null) {
        safeLocalStorage.setItem(DEFAULT_FEE_STORAGE_KEY, String(this.defaultFeePerContract));
    }
}

export function removeDefaultFeeFromStorage(this: DefaultFeeContext): void {
    safeLocalStorage.removeItem(DEFAULT_FEE_STORAGE_KEY);
}

export function updateDefaultFeeStatus(
    this: DefaultFeeContext,
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
        element.className = 'default-fee-status';
        if (variant === 'success') {
            element.classList.add('is-success');
        } else if (variant === 'error') {
            element.classList.add('is-error');
        }
        return;
    }

    // Default status based on current value
    if (this.defaultFeePerContract !== null) {
        element.textContent = `Default: ${this.formatCurrency(this.defaultFeePerContract)} per contract`;
        element.className = 'default-fee-status is-success';
    } else {
        element.textContent = 'Not set';
        element.className = 'default-fee-status';
    }
}

export function getDefaultFeeForQuantity(this: DefaultFeeContext, quantity = 1): number | null {
    if (this.defaultFeePerContract === null || !Number.isFinite(this.defaultFeePerContract)) {
        return null;
    }
    const qty = Math.abs(Number(quantity) || 1);
    return this.defaultFeePerContract * qty;
}
