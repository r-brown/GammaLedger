// src/settings/startup-behavior.ts — Database startup behavior (auto-load cache vs. always blank).
// Uses the .call(this, …) delegation pattern so all this.* refs work.

import { STARTUP_BEHAVIOR_STORAGE_KEY } from '../core/config.js';
import { safeLocalStorage } from '@core/storage'

export type StartupBehavior = 'cache' | 'manual'

interface StartupBehaviorContext {
    startupBehavior: StartupBehavior
    saveStartupBehaviorToStorage(): void
}

function describeStartupBehavior(value: StartupBehavior): string {
    return value === 'manual'
        ? 'Always starting blank — use Load Database to open your file.'
        : "Loading automatically from this browser's saved copy on open.";
}

export function initializeStartupBehaviorControls(this: StartupBehaviorContext): void {
    const select = document.getElementById('startup-behavior-select') as HTMLSelectElement | null;
    const status = document.getElementById('startup-behavior-status');
    if (!select) {
        return;
    }

    select.value = this.startupBehavior;
    if (status) {
        status.textContent = describeStartupBehavior(this.startupBehavior);
    }

    select.addEventListener('change', () => {
        this.startupBehavior = select.value === 'manual' ? 'manual' : 'cache';
        this.saveStartupBehaviorToStorage();
        if (status) {
            status.textContent = describeStartupBehavior(this.startupBehavior);
        }
    });
}

export function loadStartupBehaviorFromStorage(this: StartupBehaviorContext): void {
    const stored = safeLocalStorage.getItem(STARTUP_BEHAVIOR_STORAGE_KEY);
    this.startupBehavior = stored === 'manual' ? 'manual' : 'cache';
}

export function saveStartupBehaviorToStorage(this: StartupBehaviorContext): void {
    safeLocalStorage.setItem(STARTUP_BEHAVIOR_STORAGE_KEY, this.startupBehavior);
}
