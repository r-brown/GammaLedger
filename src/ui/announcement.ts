// src/ui/announcement.ts — Announcement banner (dismissal persisted) and the
// sample-data first-run banner. Uses the .call(this, …) delegation pattern.

import { APP_CONFIG } from '@core/config.js'
import { safeLocalStorage } from '@core/storage.js'

interface AnnouncementContext {
  currentFileName: string
  showView(viewName: string): void
  newDatabase(): void
}

// Hardcoded, trusted content only — this string is injected as innerHTML.
// Bump `id` when the message changes so previously-dismissed users see it again.
const ANNOUNCEMENT = {
    enabled: true,
    id: 'v2-early-access',
    html: '✨&nbsp; Welcome to <strong>GammaLedger v2</strong> — early access! ' +
        'Prefer the classic experience? <a href="https://gammaledger.com/appv1/">Back to v1 →</a>'
} as const

const SAMPLE_DATABASE_NAME = 'Sample Database (Built-in)'

function setAppTopOffset(px: number): void {
    document.documentElement.style.setProperty('--app-top-offset', `${px}px`)
}

export function initializeAnnouncementBanner(this: AnnouncementContext): void {
    const container = document.getElementById('announcement-banner')
    const dismissedId = safeLocalStorage.getItem(APP_CONFIG.STORAGE.ANNOUNCEMENT_DISMISSED)
    const show = ANNOUNCEMENT.enabled && ANNOUNCEMENT.html && dismissedId !== ANNOUNCEMENT.id

    if (!container || !show) {
        container?.remove()
        setAppTopOffset(0)
        return
    }

    container.className = 'announcement-banner'
    container.innerHTML =
        `<span class="announcement-banner__message">${ANNOUNCEMENT.html}</span>` +
        '<button class="announcement-banner__dismiss" aria-label="Dismiss">✕</button>'

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
