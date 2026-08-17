// src/ui/command-palette.ts — ⌘K command palette: navigation, actions, and
// per-ticker jumps. Uses the .call(this, …) delegation pattern; selection
// index lives on the GammaLedger instance (no module-level mutable state).

import { getThemePreference, type ThemePreference } from './theme.js'

interface PaletteContext {
  trades: Record<string, unknown>[]
  commandPaletteIndex: number
  showView(viewName: string): void
  saveDatabase(): Promise<void> | void
  loadDatabase(): Promise<void> | void
  newDatabase(): void
  exportToCSV(): void
  toggleAIChat(force?: boolean | null): void
  openTradesFilteredByTicker(ticker: unknown): void
  updateTickerPreview(ticker: string): void
  setThemePreference(pref: ThemePreference): void
}

interface PaletteCommand {
  label: string
  hint: string
  keywords: string
  run(): void
}

function getDialog(): HTMLDialogElement | null {
    return document.getElementById('command-palette') as HTMLDialogElement | null
}

function collectTickers(this: PaletteContext): { open: string[]; all: string[] } {
    const open = new Set<string>()
    const all = new Set<string>()
    this.trades.forEach((trade) => {
        const ticker = String(trade?.ticker ?? '').toUpperCase()
        if (!ticker) return
        all.add(ticker)
        const status = String(trade?.status ?? '')
        if (status === 'Open' || status === 'Rolling') open.add(ticker)
    })
    return { open: [...open].sort(), all: [...all].sort() }
}

function buildCommands(this: PaletteContext, query: string): PaletteCommand[] {
    const commands: PaletteCommand[] = [
        { label: 'Go to Dashboard', hint: 'g d', keywords: 'nav home', run: () => this.showView('dashboard') },
        { label: 'Go to All Trades', hint: 'g t', keywords: 'nav list', run: () => this.showView('trades-list') },
        { label: 'Go to Watchlist', hint: 'g w', keywords: 'nav watchlist watch list', run: () => this.showView('watchlist') },
        { label: 'Add New Trade', hint: 'n', keywords: 'nav create new', run: () => this.showView('add-trade') },
        { label: 'Go to Import', hint: 'g i', keywords: 'nav csv ofx broker', run: () => this.showView('import') },
        { label: 'Go to Settings', hint: 'g s', keywords: 'nav preferences api keys', run: () => this.showView('settings') },
        { label: 'Save Database', hint: '', keywords: 'file persist', run: () => { void this.saveDatabase() } },
        { label: 'Load Database', hint: '', keywords: 'file open', run: () => { void this.loadDatabase() } },
        { label: 'New Database', hint: '', keywords: 'file fresh blank', run: () => this.newDatabase() },
        { label: 'Export CSV', hint: '', keywords: 'file download', run: () => this.exportToCSV() },
        { label: 'Toggle AI Coach', hint: '', keywords: 'chat gemini assistant', run: () => this.toggleAIChat() },
        {
            label: 'Theme: switch to light', hint: '', keywords: 'theme color scheme',
            run: () => this.setThemePreference('light')
        },
        {
            label: 'Theme: switch to dark', hint: '', keywords: 'theme color scheme',
            run: () => this.setThemePreference('dark')
        },
        {
            label: 'Theme: follow system', hint: '', keywords: 'theme color scheme auto',
            run: () => this.setThemePreference('auto')
        },
        {
            label: 'Keyboard shortcuts', hint: '?', keywords: 'help keys',
            run: () => (document.getElementById('shortcut-help') as HTMLDialogElement | null)?.showModal()
        }
    ]

    const { open, all } = collectTickers.call(this)
    const q = query.trim().toUpperCase()
    // Without a query only open-position tickers surface; with a query, any
    // known ticker that matches.
    const tickers = q ? all.filter(t => t.includes(q)) : open
    tickers.slice(0, 8).forEach((ticker) => {
        commands.push({
            label: `${ticker}: view trades`, hint: 'ticker', keywords: `ticker ${ticker}`,
            run: () => this.openTradesFilteredByTicker(ticker)
        })
        commands.push({
            label: `${ticker}: add trade`, hint: 'ticker', keywords: `ticker new ${ticker}`,
            run: () => {
                this.showView('add-trade')
                const input = document.getElementById('ticker') as HTMLInputElement | null
                if (input) {
                    input.value = ticker
                    this.updateTickerPreview(ticker)
                }
            }
        })
        commands.push({
            label: `${ticker}: add to watchlist`, hint: 'watchlist', keywords: `watch list ${ticker}`,
            run: () => {
                this.showView('watchlist')
                setTimeout(() => {
                    const input = document.querySelector<HTMLInputElement>('.watchlist-add-input')
                    if (input) {
                        input.value = ticker
                        input.focus()
                    }
                }, 50)
            }
        })
    })

    // Reflect current theme in the labels so the palette shows state.
    const pref = getThemePreference()
    commands.forEach((cmd) => {
        if (cmd.label.startsWith('Theme:') && cmd.label.toLowerCase().includes(pref)) {
            cmd.hint = 'current'
        }
    })

    return commands
}

function scoreCommand(command: PaletteCommand, query: string): number {
    if (!query) return 1
    const q = query.trim().toLowerCase()
    const label = command.label.toLowerCase()
    if (label.startsWith(q)) return 3
    if (label.includes(q)) return 2
    if (command.keywords.toLowerCase().includes(q)) return 1
    return 0
}

function matchCommands(this: PaletteContext, query: string): PaletteCommand[] {
    return buildCommands.call(this, query)
        .map(command => ({ command, score: scoreCommand(command, query) }))
        .filter(entry => entry.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 12)
        .map(entry => entry.command)
}

function renderResults(this: PaletteContext): void {
    const dialog = getDialog()
    const list = document.getElementById('command-palette-list')
    const input = document.getElementById('command-palette-input') as HTMLInputElement | null
    if (!dialog || !list || !input) return

    const matches = matchCommands.call(this, input.value)
    this.commandPaletteIndex = Math.max(0, Math.min(this.commandPaletteIndex, matches.length - 1))

    list.textContent = ''
    matches.forEach((command, index) => {
        const item = document.createElement('li')
        item.className = 'command-palette__item'
        item.setAttribute('role', 'option')
        item.setAttribute('aria-selected', String(index === this.commandPaletteIndex))
        const isActive = index === this.commandPaletteIndex
        if (isActive) item.classList.add('is-active')

        const label = document.createElement('span')
        label.textContent = command.label
        item.appendChild(label)
        if (command.hint) {
            const hint = document.createElement('kbd')
            hint.className = 'command-palette__hint'
            hint.textContent = command.hint
            item.appendChild(hint)
        }

        item.addEventListener('click', () => {
            dialog.close()
            command.run()
        })
        item.addEventListener('mousemove', () => {
            if (this.commandPaletteIndex !== index) {
                this.commandPaletteIndex = index
                renderResults.call(this)
            }
        })
        list.appendChild(item)
        if (isActive) item.scrollIntoView({ block: 'nearest' })
    })

    if (!matches.length) {
        const empty = document.createElement('li')
        empty.className = 'command-palette__empty'
        empty.textContent = 'No matching commands'
        list.appendChild(empty)
    }
}

function runSelected(this: PaletteContext): void {
    const dialog = getDialog()
    const input = document.getElementById('command-palette-input') as HTMLInputElement | null
    if (!dialog || !input) return
    const selected = matchCommands.call(this, input.value)[this.commandPaletteIndex]
    if (!selected) return
    dialog.close()
    selected.run()
}

export function toggleCommandPalette(this: PaletteContext, force?: boolean): void {
    const dialog = getDialog()
    const input = document.getElementById('command-palette-input') as HTMLInputElement | null
    if (!dialog || !input) return

    const shouldOpen = force ?? !dialog.open
    if (!shouldOpen) {
        if (dialog.open) dialog.close()
        return
    }
    if (dialog.open) return
    this.commandPaletteIndex = 0
    input.value = ''
    dialog.showModal()
    renderResults.call(this)
    input.focus()
}

export function setupCommandPalette(this: PaletteContext): void {
    const dialog = getDialog()
    const input = document.getElementById('command-palette-input') as HTMLInputElement | null
    if (!dialog || !input || dialog.dataset.initialized === 'true') return

    input.addEventListener('input', () => {
        this.commandPaletteIndex = 0
        renderResults.call(this)
    })

    input.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowDown') {
            event.preventDefault()
            this.commandPaletteIndex += 1
            renderResults.call(this)
        } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            this.commandPaletteIndex = Math.max(0, this.commandPaletteIndex - 1)
            renderResults.call(this)
        } else if (event.key === 'Enter') {
            event.preventDefault()
            runSelected.call(this)
        } else if (event.key === 'Escape') {
            // Close explicitly rather than relying on the native <dialog>
            // cancel-on-Escape default, which is inconsistent once other
            // global keydown listeners (shortcuts.ts) are in the mix.
            // stopPropagation keeps this from also falling through to
            // shortcuts.ts's own Escape handling once the dialog is gone.
            event.preventDefault()
            event.stopPropagation()
            dialog.close()
        }
    })

    // Click on the backdrop closes (dialog itself is the backdrop target).
    dialog.addEventListener('click', (event) => {
        if (event.target === dialog) dialog.close()
    })

    dialog.dataset.initialized = 'true'
}
