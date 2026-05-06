// src/ui/notifications.ts — Wave 8: Notification display helpers.
// Uses the .call(this, …) delegation pattern.

interface NotificationsContext {
  hasUnsavedChanges: boolean
  currentFileName: string
  updateUnsavedIndicator(): void
  updateFileNameDisplay(): void
}

export function showLoadingIndicator(text = 'Loading...'): void {
    const indicator = document.getElementById('loading-indicator');
    if (indicator) {
        indicator.textContent = text;
        indicator.classList.remove('hidden');
    }
}

export function hideLoadingIndicator(): void {
    const indicator = document.getElementById('loading-indicator');
    if (indicator) {
        indicator.classList.add('hidden');
    }
}

export function showNotification(message: string, type = 'info'): void {
    if (type === 'error') {
        alert(`Error: ${message}`);
    } else {
        console.log(`${type.toUpperCase()}: ${message}`);
    }
}

export function markUnsavedChanges(this: NotificationsContext): void {
    this.hasUnsavedChanges = true;
    this.updateUnsavedIndicator();
}

export function updateFileNameDisplay(this: NotificationsContext): void {
    const nameEl = document.getElementById('current-file-name');
    if (!nameEl) return;

    nameEl.textContent = this.currentFileName;
    if (this.currentFileName === 'Unsaved Database') {
        nameEl.classList.add('is-unsaved');
    } else {
        nameEl.classList.remove('is-unsaved');
    }
}

export function updateUnsavedIndicator(this: NotificationsContext): void {
    const indicator = document.getElementById('unsaved-indicator');
    if (this.hasUnsavedChanges) {
        indicator?.classList.remove('hidden');
    } else {
        indicator?.classList.add('hidden');
    }
}

