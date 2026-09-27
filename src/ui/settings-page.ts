// src/ui/settings-page.ts — Settings page shell: section rail, search, card status badges and
// auto-save. Sections and cards are declared in index.html; this module only adds behaviour:
//   <section class="settings-panel" data-settings-section="id" data-settings-label="…" data-settings-icon="…">
//     <div class="settings-card" data-settings-card="id" data-settings-keywords="…"> … <span data-settings-badge>
//   <input data-autosave="<save button id>" [data-autosave-clear="<clear button id>"]>
// A new section needs markup only; a card's badge needs a getter in CARD_STATUS.
// Uses the .call(this, …) delegation pattern.

type CardTone = 'ok' | 'warn' | 'off' | 'info'
export type SectionTone = 'ok' | 'warn' | 'off' | 'none'

export interface CardStatus {
  tone: CardTone
  text: string
}

interface LLMProviderLike {
  displayName: string
  isConfigured(): boolean
  activeModel(): string
  modelLabel(model: string): string
}

export interface SettingsPageHost {
  settingsSection: string | null
  schwab: { vault: { accessToken?: string; refreshToken?: string } | null; encryptionKey: unknown }
  finnhub: { apiKey: string | null }
  getActiveLLMProvider(): LLMProviderLike
  defaultFeePerContract: number | null
  accountSize: number | null
  externalAnalyticsUrl: string
  startupBehavior: 'cache' | 'manual'
  formatCurrency(value: unknown, opts?: Record<string, unknown>): string
  hasSchwabVault?(): boolean
}

const DEFAULT_ANALYTICS_URL = 'https://www.investing.com/search/?q={ticker}'

/** Badge per card id; cards without an entry show no badge. */
const CARD_STATUS: Record<string, (host: SettingsPageHost) => CardStatus> = {
  schwab: (host) => {
    const unlocked = Boolean(host.schwab.vault && host.schwab.encryptionKey)
    const hasVault = unlocked || Boolean(host.hasSchwabVault?.())
    if (!hasVault) return { tone: 'off', text: 'Not set up' }
    if (!unlocked) return { tone: 'warn', text: 'Locked' }
    const connected = Boolean(host.schwab.vault?.refreshToken || host.schwab.vault?.accessToken)
    return connected ? { tone: 'ok', text: 'Connected' } : { tone: 'warn', text: 'Authorize' }
  },
  finnhub: (host) => (host.finnhub.apiKey ? { tone: 'ok', text: 'Key saved' } : { tone: 'off', text: 'Not set' }),
  'ai-provider': (host) => {
    const provider = host.getActiveLLMProvider()
    if (!provider.isConfigured()) return { tone: 'off', text: `${provider.displayName} · no key` }
    const model = provider.activeModel()
    return { tone: 'ok', text: `${provider.displayName} · ${model ? provider.modelLabel(model) : 'default model'}` }
  },
  'default-fee': (host) => (host.defaultFeePerContract !== null
    ? { tone: 'ok', text: `${host.formatCurrency(host.defaultFeePerContract)} / contract` }
    : { tone: 'off', text: 'Not set' }),
  'account-size': (host) => (host.accountSize !== null
    ? { tone: 'ok', text: host.formatCurrency(host.accountSize) }
    : { tone: 'off', text: 'Not set' }),
  startup: (host) => ({ tone: 'info', text: host.startupBehavior === 'manual' ? 'Start blank' : 'Auto-load' }),
  'analytics-link': (host) => ({
    tone: 'info',
    text: host.externalAnalyticsUrl && host.externalAnalyticsUrl !== DEFAULT_ANALYTICS_URL ? 'Custom' : 'Default'
  })
}

export function getCardStatus(host: SettingsPageHost, cardId: string): CardStatus | null {
  const getter = CARD_STATUS[cardId]
  if (!getter) return null
  try {
    return getter(host)
  } catch {
    return null
  }
}

/** Needs-attention wins; then anything configured; informational-only sections get no dot. */
export function sectionTone(tones: CardTone[]): SectionTone {
  if (tones.includes('warn')) return 'warn'
  if (tones.includes('ok')) return 'ok'
  if (tones.includes('off')) return 'off'
  return 'none'
}

const SECTION_TONE_TEXT: Record<SectionTone, string> = {
  ok: 'Set up',
  warn: 'Needs attention',
  off: 'Not set up',
  none: ''
}

export function matchesSettingsQuery(text: string, query: string): boolean {
  const haystack = text.toLowerCase()
  return query.toLowerCase().split(/\s+/).filter(Boolean).every(term => haystack.includes(term))
}

// ---------------------------------------------------------------------------
// DOM
// ---------------------------------------------------------------------------

const panels = (): HTMLElement[] => Array.from(document.querySelectorAll<HTMLElement>('.settings-view .settings-panel[data-settings-section]'))
const railItems = (): HTMLButtonElement[] => Array.from(document.querySelectorAll<HTMLButtonElement>('#settings-rail .settings-rail__item'))
const searchInput = (): HTMLInputElement | null => document.getElementById('settings-search') as HTMLInputElement | null

function buildRail(this: SettingsPageHost): void {
  const rail = document.getElementById('settings-rail')
  if (!rail) return
  rail.textContent = ''
  for (const panel of panels()) {
    const id = panel.dataset.settingsSection ?? ''
    const tabId = `settings-tab-${id}`
    const item = document.createElement('button')
    item.type = 'button'
    item.className = 'settings-rail__item'
    item.id = tabId
    item.dataset.settingsTarget = id
    item.setAttribute('role', 'tab')
    item.setAttribute('aria-controls', panel.id)
    item.setAttribute('aria-selected', 'false')
    item.tabIndex = -1

    const icon = document.createElement('span')
    icon.className = 'settings-rail__icon'
    icon.setAttribute('aria-hidden', 'true')
    icon.textContent = panel.dataset.settingsIcon ?? ''
    const label = document.createElement('span')
    label.className = 'settings-rail__label'
    label.textContent = panel.dataset.settingsLabel ?? id
    const dot = document.createElement('span')
    dot.className = 'settings-rail__dot'
    dot.dataset.settingsDot = ''
    item.append(icon, label, dot)

    item.addEventListener('click', () => {
      const search = searchInput()
      if (search?.value) {
        search.value = ''
        applySearch('')
      }
      openSettingsSection.call(this, id, { focusTab: true })
    })
    item.addEventListener('keydown', (event) => {
      const items = railItems()
      const index = items.indexOf(item)
      const next = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? items[(index + 1) % items.length]
        : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? items[(index - 1 + items.length) % items.length]
          : event.key === 'Home' ? items[0]
            : event.key === 'End' ? items[items.length - 1]
              : null
      if (!next) return
      event.preventDefault()
      next.click()
    })

    panel.setAttribute('role', 'tabpanel')
    panel.setAttribute('aria-labelledby', tabId)
    rail.appendChild(item)
  }
}

export function openSettingsSection(this: SettingsPageHost, sectionId: string, opts: { focusTab?: boolean } = {}): void {
  const all = panels()
  const target = all.find(panel => panel.dataset.settingsSection === sectionId) ?? all[0]
  if (!target) return
  const id = target.dataset.settingsSection ?? ''
  this.settingsSection = id
  if (searchInput()?.value.trim()) return
  for (const panel of all) panel.hidden = panel !== target
  for (const item of railItems()) {
    const selected = item.dataset.settingsTarget === id
    item.classList.toggle('is-active', selected)
    item.setAttribute('aria-selected', String(selected))
    item.tabIndex = selected ? 0 : -1
    if (selected && opts.focusTab) item.focus()
  }
}

function applySearch(raw: string): void {
  const query = raw.trim()
  const empty = document.getElementById('settings-search-empty')
  const layout = document.querySelector('.settings-layout')
  layout?.classList.toggle('is-searching', Boolean(query))
  let total = 0
  for (const panel of panels()) {
    let matches = 0
    for (const card of Array.from(panel.querySelectorAll<HTMLElement>('.settings-card'))) {
      const text = `${card.textContent ?? ''} ${card.dataset.settingsKeywords ?? ''} ${panel.dataset.settingsLabel ?? ''}`
      const hit = !query || matchesSettingsQuery(text, query)
      card.hidden = !hit
      if (hit) matches += 1
    }
    total += matches
    if (query) panel.hidden = matches === 0
    const item = railItems().find(el => el.dataset.settingsTarget === panel.dataset.settingsSection)
    item?.classList.toggle('is-dimmed', Boolean(query) && matches === 0)
  }
  if (empty) {
    empty.hidden = !query || total > 0
    empty.textContent = query ? `No settings match "${query}".` : ''
  }
}

function setupSearch(this: SettingsPageHost): void {
  const input = searchInput()
  if (!input) return
  input.addEventListener('input', () => {
    applySearch(input.value)
    if (!input.value.trim()) openSettingsSection.call(this, this.settingsSection ?? '')
  })
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && input.value) {
      event.preventDefault()
      input.value = ''
      applySearch('')
      openSettingsSection.call(this, this.settingsSection ?? '')
    }
  })
}

/**
 * Commit on change (blur, Enter, spinner) through the card's own save/clear handler, so the
 * validation and the status line stay exactly what they were with an explicit Save button.
 */
function setupAutosave(): void {
  for (const input of Array.from(document.querySelectorAll<HTMLInputElement>('.settings-view [data-autosave]'))) {
    if (input.dataset.autosaveReady === 'true') continue
    input.dataset.autosaveReady = 'true'
    const label = input.id ? document.querySelector<HTMLLabelElement>(`label[for="${input.id}"]`) : null
    if (label && !label.querySelector('.settings-autosave-hint')) {
      const hint = document.createElement('span')
      hint.className = 'settings-autosave-hint'
      hint.textContent = 'Saves automatically'
      label.appendChild(hint)
    }
    input.addEventListener('change', () => {
      const clearId = input.dataset.autosaveClear
      const targetId = !input.value.trim() && clearId ? clearId : input.dataset.autosave
      const button = targetId ? document.getElementById(targetId) : null
      button?.click()
    })
  }
}

export function refreshSettingsStatus(this: SettingsPageHost): void {
  for (const panel of panels()) {
    const tones: CardTone[] = []
    for (const card of Array.from(panel.querySelectorAll<HTMLElement>('.settings-card[data-settings-card]'))) {
      const badge = card.querySelector<HTMLElement>('[data-settings-badge]')
      const status = getCardStatus(this, card.dataset.settingsCard ?? '')
      if (!badge) continue
      if (!status) {
        badge.hidden = true
        continue
      }
      tones.push(status.tone)
      const className = `settings-badge settings-badge--${status.tone}`
      // Write only on change: the MutationObserver below would otherwise loop on our own edits.
      if (badge.textContent !== status.text) badge.textContent = status.text
      if (badge.className !== className) badge.className = className
      if (badge.hidden) badge.hidden = false
    }
    const tone = sectionTone(tones)
    const item = railItems().find(el => el.dataset.settingsTarget === panel.dataset.settingsSection)
    const dot = item?.querySelector<HTMLElement>('[data-settings-dot]')
    if (!dot) continue
    const dotClass = `settings-rail__dot settings-rail__dot--${tone}`
    if (dot.className !== dotClass) dot.className = dotClass
    const label = SECTION_TONE_TEXT[tone]
    if (dot.title !== label) dot.title = label
    if (label) dot.setAttribute('aria-label', label)
    else dot.removeAttribute('aria-label')
  }
}

/** Every status line lives in the settings view, so any change there can move a badge. */
function observeStatusChanges(this: SettingsPageHost): void {
  const root = document.querySelector('.settings-content')
  if (!root || typeof MutationObserver === 'undefined') return
  let scheduled = false
  const observer = new MutationObserver((mutations) => {
    const relevant = mutations.some(m => {
      const el = m.target instanceof Element ? m.target : m.target.parentElement
      return !el?.closest('[data-settings-badge]')
    })
    if (!relevant || scheduled) return
    scheduled = true
    requestAnimationFrame(() => {
      scheduled = false
      refreshSettingsStatus.call(this)
    })
  })
  observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class', 'hidden'] })
}

export function initializeSettingsPage(this: SettingsPageHost): void {
  if (!document.getElementById('settings-rail')) return
  buildRail.call(this)
  setupSearch.call(this)
  setupAutosave()
  openSettingsSection.call(this, this.settingsSection ?? panels()[0]?.dataset.settingsSection ?? '')
  refreshSettingsStatus.call(this)
  observeStatusChanges.call(this)
}
