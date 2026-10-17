// src/ui/announcement.ts — Announcement banner (dismissal persisted) and the
// sample-data first-run banner. Uses the .call(this, …) delegation pattern.

import { APP_CONFIG } from '@core/config.js'
import { safeLocalStorage } from '@core/storage.js'

interface AnnouncementContext {
  currentFileName: string
  showView(viewName: string): void
  newDatabase(): void
}

// The banner holds several announcements in one slot. They rotate automatically and can
// be browsed with the arrows/dots; the dismiss button hides the whole banner. It returns
// after DISMISS_DURATION_MS, or immediately when an announcement whose `id` the visitor
// hadn't seen at dismissal time is added. Bump an `id` when an announcement changes.
// Messages are plain text (rendered with textContent); one per announcement is picked per
// page load. Keep claims to what is true of the project: free, open source, local-first,
// no accounts. List the newest announcement first.
const REPO_URL = 'https://github.com/r-brown/GammaLedger'
const SPONSOR_URL = 'https://github.com/sponsors/r-brown'
const GAME_URL = 'https://gammaledger.com/keep-the-economy-afloat/'

interface Announcement {
    readonly id: string
    readonly enabled: boolean
    readonly messages: readonly string[]
    readonly links: readonly { readonly label: string; readonly href: string }[]
}

const ANNOUNCEMENTS: readonly Announcement[] = [
    {
        id: 'keep-the-economy-afloat',
        enabled: true,
        messages: [
            '🎮 New on the site: Keep the Economy Afloat, a free browser game. Run a central bank on a MONIAC water computer and keep inflation, jobs and markets in the safe zone.',
            '🏦 Ever wondered what a rate hike really does? Set interest rates on a MONIAC water computer in our new free game. No sign-up, plays in your browser.'
        ],
        links: [{ label: '🎮 Play free', href: GAME_URL }]
    },
    {
        id: 'support-the-project',
        enabled: true,
        messages: [
            '👋 GammaLedger is free, open source and keeps your data in your browser. If it’s saving you time, a star or a sponsorship helps me keep building it.',
            '📈 Private by design, free to use. The only premium I’m asking for is a ⭐ on GitHub — or a sponsorship if you’re feeling generous.',
            '🙏 No accounts, no servers, no subscription — just an independent open-source project. If it earns a place in your routine, a star tells me it’s worth the effort.',
            '☕ Good journals compound, and so do small gestures. If GammaLedger helps you trade with a cooler head, consider starring it or sponsoring the project.'
        ],
        links: [
            { label: '⭐ Star on GitHub', href: REPO_URL },
            { label: '💖 Sponsor', href: SPONSOR_URL }
        ]
    }
]

const AUTOPLAY_INTERVAL_MS = 9000
const DISMISS_DURATION_MS = 30 * 24 * 60 * 60 * 1000

const SAMPLE_DATABASE_NAME = 'Sample Database (Built-in)'

function setAppTopOffset(px: number): void {
    document.documentElement.style.setProperty('--app-top-offset', `${px}px`)
}

interface DismissalRecord {
    ids: string[]
    at: number
}

function isDismissalRecord(value: unknown): value is DismissalRecord {
    if (typeof value !== 'object' || value === null) return false
    if (!('ids' in value) || !('at' in value)) return false
    const { ids, at } = value
    return Array.isArray(ids) && ids.every(id => typeof id === 'string') && typeof at === 'number'
}

/** Reads the stored dismissal; anything missing or malformed (e.g. the old bare-id value) means "not dismissed". */
function readDismissal(): DismissalRecord | null {
    const raw = safeLocalStorage.getItem(APP_CONFIG.STORAGE.ANNOUNCEMENT_DISMISSED)
    if (!raw) return null
    try {
        const parsed: unknown = JSON.parse(raw)
        return isDismissalRecord(parsed) ? parsed : null
    } catch {
        return null
    }
}

function shouldShowBanner(announcements: readonly Announcement[]): boolean {
    const dismissal = readDismissal()
    if (!dismissal) return true
    const expired = Date.now() - dismissal.at >= DISMISS_DURATION_MS
    const hasNew = announcements.some(a => !dismissal.ids.includes(a.id))
    return expired || hasNew
}

function writeDismissal(announcements: readonly Announcement[]): void {
    const record: DismissalRecord = { ids: announcements.map(a => a.id), at: Date.now() }
    safeLocalStorage.setItem(APP_CONFIG.STORAGE.ANNOUNCEMENT_DISMISSED, JSON.stringify(record))
}

function buildSlide(announcement: Announcement, index: number, total: number): HTMLElement {
    const slide = document.createElement('div')
    slide.className = 'announcement-banner__slide'
    slide.setAttribute('role', 'group')
    slide.setAttribute('aria-roledescription', 'announcement')
    slide.setAttribute('aria-label', `${index + 1} of ${total}`)
    slide.dataset.announcementId = announcement.id

    const message = document.createElement('span')
    message.className = 'announcement-banner__message'
    message.textContent = announcement.messages[Math.floor(Math.random() * announcement.messages.length)]

    const actions = document.createElement('span')
    actions.className = 'announcement-banner__actions'
    for (const link of announcement.links) {
        const anchor = document.createElement('a')
        anchor.className = 'announcement-banner__cta'
        anchor.href = link.href
        anchor.target = '_blank'
        anchor.rel = 'noopener noreferrer'
        anchor.textContent = link.label
        actions.appendChild(anchor)
    }

    slide.append(message, actions)
    return slide
}

function buildControlButton(className: string, label: string, text: string): HTMLButtonElement {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = className
    button.setAttribute('aria-label', label)
    button.textContent = text
    return button
}

export function initializeAnnouncementBanner(this: AnnouncementContext): void {
    const container = document.getElementById('announcement-banner')
    if (!container) {
        setAppTopOffset(0)
        return
    }

    const announcements = ANNOUNCEMENTS.filter(a => a.enabled)
    if (announcements.length === 0 || !shouldShowBanner(announcements)) {
        container.remove()
        setAppTopOffset(0)
        return
    }

    container.className = 'announcement-banner'
    container.setAttribute('role', 'region')
    container.setAttribute('aria-roledescription', 'carousel')
    container.setAttribute('aria-label', 'Announcements')

    const viewport = document.createElement('div')
    viewport.className = 'announcement-banner__viewport'
    const slides = announcements.map((a, i) => buildSlide(a, i, announcements.length))
    viewport.append(...slides)

    const nav = document.createElement('div')
    nav.className = 'announcement-banner__nav'
    const prev = buildControlButton('announcement-banner__arrow', 'Previous announcement', '‹')
    const next = buildControlButton('announcement-banner__arrow', 'Next announcement', '›')
    const dots = announcements.map((a, i) =>
        buildControlButton('announcement-banner__dot', `Show announcement ${i + 1}`, '')
    )
    nav.append(prev, ...dots, next)

    const dismiss = buildControlButton('announcement-banner__dismiss', 'Dismiss announcements', '✕')
    container.replaceChildren(viewport, nav, dismiss)

    let activeIndex = 0
    let timer: number | undefined
    let paused = false
    let autoplay = !window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const syncAppTopOffset = () => {
        const isHidden = container.classList.contains('announcement-banner--hidden')
        setAppTopOffset(isHidden ? 0 : container.offsetHeight)
    }

    const render = () => {
        slides.forEach((slide, i) => slide.classList.toggle('announcement-banner__slide--active', i === activeIndex))
        dots.forEach((dot, i) => {
            const isActive = i === activeIndex
            dot.classList.toggle('announcement-banner__dot--active', isActive)
            if (isActive) dot.setAttribute('aria-current', 'true')
            else dot.removeAttribute('aria-current')
        })
        nav.hidden = slides.length < 2
        viewport.setAttribute('aria-live', autoplay ? 'off' : 'polite')
    }

    const stopTimer = () => {
        if (timer !== undefined) window.clearInterval(timer)
        timer = undefined
    }

    const goTo = (index: number) => {
        activeIndex = (index + slides.length) % slides.length
        render()
    }

    const startTimer = () => {
        stopTimer()
        if (!autoplay || paused || slides.length < 2) return
        timer = window.setInterval(() => goTo(activeIndex + 1), AUTOPLAY_INTERVAL_MS)
    }

    // A deliberate click means the visitor is reading: stop auto-rotating for this page load.
    const userNavigate = (index: number) => {
        autoplay = false
        stopTimer()
        goTo(index)
    }

    prev.addEventListener('click', () => userNavigate(activeIndex - 1))
    next.addEventListener('click', () => userNavigate(activeIndex + 1))
    dots.forEach((dot, i) => dot.addEventListener('click', () => userNavigate(i)))

    const setPaused = (value: boolean) => {
        paused = value
        startTimer()
    }
    container.addEventListener('mouseenter', () => setPaused(true))
    container.addEventListener('mouseleave', () => setPaused(false))
    container.addEventListener('focusin', () => setPaused(true))
    container.addEventListener('focusout', () => setPaused(false))

    dismiss.addEventListener('click', () => {
        writeDismissal(announcements)
        stopTimer()
        container.classList.add('announcement-banner--hidden')
        syncAppTopOffset()
    })

    // Follows font loading and text wrapping too, not just window resizes.
    new ResizeObserver(syncAppTopOffset).observe(container)
    render()
    startTimer()
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
