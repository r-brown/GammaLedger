// src/ui/announcement.ts — Announcement banner (dismissal persisted) and the
// sample-data first-run banner. Uses the .call(this, …) delegation pattern.

import { APP_CONFIG } from '@core/config.js'
import { safeLocalStorage } from '@core/storage.js'

interface AnnouncementContext {
  currentFileName: string
  showView(viewName: string): void
  newDatabase(): void
}

// Bump `id` when the banner changes so previously-dismissed users see it again.
// Messages are plain text (rendered with textContent); one is picked per page load.
// Keep claims to what is true of the project: free, open source, local-first, no accounts.
const REPO_URL = 'https://github.com/r-brown/GammaLedger'
const SPONSOR_URL = 'https://github.com/sponsors/r-brown'

const ANNOUNCEMENT = {
    enabled: true,
    id: 'support-the-project',
    messages: [
        '👋 GammaLedger is free, open source and keeps your data in your browser. If it\u2019s saving you time, a star or a sponsorship helps me keep building it.',
        '📈 Private by design, free to use. The only premium I\u2019m asking for is a ⭐ on GitHub \u2014 or a sponsorship if you\u2019re feeling generous.',
        '🙏 No accounts, no servers, no subscription \u2014 just an independent open-source project. If it earns a place in your routine, a star tells me it\u2019s worth the effort.',
        '☕ Good journals compound, and so do small gestures. If GammaLedger helps you trade with a cooler head, consider starring it or sponsoring the project.'
    ],
    links: [
        { label: '⭐ Star on GitHub', href: REPO_URL },
        { label: '💖 Sponsor', href: SPONSOR_URL }
    ]
} as const

const SAMPLE_DATABASE_NAME = 'Sample Database (Built-in)'

function setAppTopOffset(px: number): void {
    document.documentElement.style.setProperty('--app-top-offset', `${px}px`)
}

function buildAnnouncementContent(): HTMLElement {
    const content = document.createElement('div')
    content.className = 'announcement-banner__content'

    const message = document.createElement('span')
    message.className = 'announcement-banner__message'
    message.textContent = ANNOUNCEMENT.messages[Math.floor(Math.random() * ANNOUNCEMENT.messages.length)]

    const actions = document.createElement('span')
    actions.className = 'announcement-banner__actions'
    for (const link of ANNOUNCEMENT.links) {
        const anchor = document.createElement('a')
        anchor.className = 'announcement-banner__cta'
        anchor.href = link.href
        anchor.target = '_blank'
        anchor.rel = 'noopener noreferrer'
        anchor.textContent = link.label
        actions.appendChild(anchor)
    }

    content.append(message, actions)
    return content
}

function buildDismissButton(): HTMLButtonElement {
    const button = document.createElement('button')
    button.className = 'announcement-banner__dismiss'
    button.setAttribute('aria-label', 'Dismiss')
    button.textContent = '✕'
    return button
}

export function initializeAnnouncementBanner(this: AnnouncementContext): void {
    const container = document.getElementById('announcement-banner')
    const dismissedId = safeLocalStorage.getItem(APP_CONFIG.STORAGE.ANNOUNCEMENT_DISMISSED)
    const show = ANNOUNCEMENT.enabled && dismissedId !== ANNOUNCEMENT.id

    if (!container || !show) {
        container?.remove()
        setAppTopOffset(0)
        return
    }

    container.className = 'announcement-banner'
    container.replaceChildren(buildAnnouncementContent(), buildDismissButton())

    const syncAppTopOffset = () => {
        const isHidden = container.classList.contains('announcement-banner--hidden')
        setAppTopOffset(isHidden ? 0 : container.offsetHeight)
    }

    container.querySelector('.announcement-banner__dismiss')?.addEventListener('click', () => {
        safeLocalStorage.setItem(APP_CONFIG.STORAGE.ANNOUNCEMENT_DISMISSED, ANNOUNCEMENT.id)
        container.classList.add('announcement-banner--hidden')
        syncAppTopOffset()
    })

    window.addEventListener('resize', syncAppTopOffset)
    syncAppTopOffset()
}

/** Show the sample-data banner iff the built-in sample database is loaded. */
export function updateSampleDataBanner(this: AnnouncementContext): void {
    const banner = document.getElementById('sample-data-banner')
    if (!banner) return
    banner.classList.toggle('hidden', this.currentFileName !== SAMPLE_DATABASE_NAME)
}

export function setupSampleDataBannerActions(this: AnnouncementContext): void {
    document.getElementById('sample-banner-import')?.addEventListener('click', () => {
        this.showView('import')
    })
    document.getElementById('sample-banner-fresh')?.addEventListener('click', () => {
        this.newDatabase()
    })
}
