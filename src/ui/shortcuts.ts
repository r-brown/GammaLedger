// src/ui/shortcuts.ts — Global keyboard shortcuts and the `?` help dialog.
// Uses the .call(this, …) delegation pattern; chord state lives on the
// GammaLedger instance (no module-level mutable state).

interface ShortcutsContext {
  showView(viewName: string): void
  toggleAIChat(force?: boolean): void
  _shortcutChordUntil?: number
}

const CHORD_WINDOW_MS = 1200

const CHORD_VIEWS: Record<string, string> = {
    d: 'dashboard',
    t: 'trades-list',
    i: 'import',
    s: 'settings'
}

function isTypingTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false
    return Boolean(target.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]'))
}

export function setupKeyboardShortcuts(this: ShortcutsContext): void {
    const helpDialog = document.getElementById('shortcut-help') as HTMLDialogElement | null
    helpDialog?.querySelector('[data-action="shortcut-help-close"]')
        ?.addEventListener('click', () => helpDialog.close())

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            // Open <dialog>s and info popovers close themselves; otherwise
            // Esc collapses the AI chat panel.
            if (document.querySelector('dialog[open]')) return
            const popover = document.getElementById('gl-info-popover')
            if (popover?.classList.contains('is-open')) return
            const aiPanel = document.getElementById('ai-chat-panel')
            if (aiPanel && !aiPanel.classList.contains('hidden')) {
                this.toggleAIChat(false)
            }
            return
        }

        if (event.metaKey || event.ctrlKey || event.altKey) return
        if (isTypingTarget(event.target)) return
        if (document.querySelector('.ag-cell-inline-editing')) return
        if (helpDialog?.open && event.key !== '?') return

        const now = Date.now()
        if ((this._shortcutChordUntil ?? 0) > now) {
            this._shortcutChordUntil = 0
            const view = CHORD_VIEWS[event.key.toLowerCase()]
            if (view) {
                event.preventDefault()
                this.showView(view)
            }
            return
        }

        switch (event.key) {
            case 'n':
                event.preventDefault()
                this.showView('add-trade')
                break
            case '/': {
                event.preventDefault()
                this.showView('trades-list')
                const search = document.getElementById('search-ticker') as HTMLInputElement | null
                search?.focus()
                search?.select()
                break
            }
            case 'g':
                this._shortcutChordUntil = now + CHORD_WINDOW_MS
                break
            case '?':
                event.preventDefault()
                if (!helpDialog) break
                if (helpDialog.open) helpDialog.close()
                else helpDialog.showModal()
                break
        }
    })
}
