// src/settings/default-fee.js — Wave 5: Default fee per contract settings.
// Uses the .call(this, …) delegation pattern so all this.* refs work.

export function initializeDefaultFeeControls() {
    const container = document.getElementById('default-fees-controls');
    if (!container) {
        return;
    }

    const input = document.getElementById('default-fee-per-contract');
    const saveButton = document.getElementById('default-fee-save');
    const clearButton = document.getElementById('default-fee-clear');
    const status = document.getElementById('default-fee-status');

    // Load saved value from localStorage
    this.loadDefaultFeeFromStorage();

    // Initialize input with saved value
    if (input && this.defaultFeePerContract !== null) {
        input.value = this.defaultFeePerContract;
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

export function loadDefaultFeeFromStorage() {
    try {
        const stored = localStorage.getItem(DEFAULT_FEE_STORAGE_KEY);
        if (stored !== null) {
            const value = parseFloat(stored);
            if (Number.isFinite(value) && value >= 0) {
                this.defaultFeePerContract = value;
            }
        }
    } catch (error) {
        console.warn('Failed to load default fee from storage:', error);
    }
}

export function saveDefaultFeeToStorage() {
    try {
        if (this.defaultFeePerContract !== null) {
            localStorage.setItem(DEFAULT_FEE_STORAGE_KEY, String(this.defaultFeePerContract));
        }
    } catch (error) {
        console.warn('Failed to save default fee to storage:', error);
    }
}

export function removeDefaultFeeFromStorage() {
    try {
        localStorage.removeItem(DEFAULT_FEE_STORAGE_KEY);
    } catch (error) {
        console.warn('Failed to remove default fee from storage:', error);
    }
}

export function updateDefaultFeeStatus(element, message = null, variant = 'neutral', duration = 4000) {
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

export function getDefaultFeeForQuantity(quantity = 1) {
    if (this.defaultFeePerContract === null || !Number.isFinite(this.defaultFeePerContract)) {
        return null;
    }
    const qty = Math.abs(Number(quantity) || 1);
    return this.defaultFeePerContract * qty;
}
