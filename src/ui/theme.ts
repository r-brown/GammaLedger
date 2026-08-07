// src/ui/theme.ts — Manual theme preference (auto / light / dark).
// Uses the .call(this, …) delegation pattern. Sets data-color-scheme on <html>;
// the token blocks in app.css (see the [data-color-scheme] selectors) do the rest.

import { APP_CONFIG } from '@core/config'
import { safeLocalStorage } from '@core/storage'

export type ThemePreference = 'auto' | 'light' | 'dark'

interface ThemeContext {
  currentView: string
  updateDashboard(): void
}

const CYCLE: ThemePreference[] = ['auto', 'light', 'dark']

const BUTTON_STATE: Record<ThemePreference, { icon: string; label: string }> = {
    auto: { icon: '◐', label: 'Theme: system — click for light' },
    light: { icon: '☀️', label: 'Theme: light — click for dark' },
    dark: { icon: '🌙', label: 'Theme: dark — click for system' }
}

export function getThemePreference(): ThemePreference {
    const stored = safeLocalStorage.getItem(APP_CONFIG.STORAGE.THEME)
    return stored === 'light' || stored === 'dark' ? stored : 'auto'
}

export function applyThemePreference(pref: ThemePreference): void {
    const root = document.documentElement
    if (pref === 'auto') {
        delete root.dataset.colorScheme
    } else {
        root.dataset.colorScheme = pref
    }
}

function syncThemeButton(pref: ThemePreference): void {
    const button = document.getElementById('theme-toggle')
    if (!button) return
    const state = BUTTON_STATE[pref]
    button.textContent = state.icon
    button.setAttribute('aria-label', state.label)
    button.setAttribute('title', state.label)
}

export function setThemePreference(this: ThemeContext, pref: ThemePreference): void {
    if (pref === 'auto') {
        safeLocalStorage.removeItem(APP_CONFIG.STORAGE.THEME)
    } else {
        safeLocalStorage.setItem(APP_CONFIG.STORAGE.THEME, pref)
    }
    applyThemePreference(pref)
    syncThemeButton(pref)
    // Charts sample theme colors at render time — re-render the dashboard set.
    if (this.currentView === 'dashboard') {
        this.updateDashboard()
    }
}

export function initializeThemeControls(this: ThemeContext): void {
    applyThemePreference(getThemePreference())
    syncThemeButton(getThemePreference())
    const button = document.getElementById('theme-toggle')
    if (!button || button.dataset.initialized === 'true') return
    button.addEventListener('click', () => {
        const next = CYCLE[(CYCLE.indexOf(getThemePreference()) + 1) % CYCLE.length]
        setThemePreference.call(this, next)
    })
    button.dataset.initialized = 'true'
}
