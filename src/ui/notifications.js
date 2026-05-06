// src/ui/notifications.js — Wave 8: Notification display helpers.
// Uses the .call(this, …) delegation pattern.

export function showLoadingIndicator(text = 'Loading...') {
    const indicator = document.getElementById('loading-indicator');
    if (indicator) {
        indicator.textContent = text;
        indicator.classList.remove('hidden');
    }
}

export function hideLoadingIndicator() {
    const indicator = document.getElementById('loading-indicator');
    if (indicator) {
        indicator.classList.add('hidden');
    }
}

export function showNotification(message, type = 'info') {
    if (type === 'error') {
        alert(`Error: ${message}`);
    } else {
        console.log(`${type.toUpperCase()}: ${message}`);
    }
}

export function markUnsavedChanges() {
    this.hasUnsavedChanges = true;
    this.updateUnsavedIndicator();
}

export function updateFileNameDisplay() {
    const nameEl = document.getElementById('current-file-name');
    if (!nameEl) return;

    nameEl.textContent = this.currentFileName;
    if (this.currentFileName === 'Unsaved Database') {
        nameEl.classList.add('is-unsaved');
    } else {
        nameEl.classList.remove('is-unsaved');
    }
}

export function updateUnsavedIndicator() {
    const indicator = document.getElementById('unsaved-indicator');
    if (this.hasUnsavedChanges) {
        indicator.classList.remove('hidden');
    } else {
        indicator.classList.add('hidden');
    }
}
