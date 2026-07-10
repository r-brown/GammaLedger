// src/ui/dashboard/popover.ts — Click/focus-driven info popovers for metric rows.
// Replaces `title`-attribute tooltips (invisible on touch, keyboard-inaccessible).
// One shared floating panel lives on <body>; open state is tracked on the panel
// element itself (no module-level mutable state).

function escapeHtml(s: string): string {
    return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

const PANEL_ID = 'gl-info-popover'

interface PopoverPanel extends HTMLDivElement {
    _anchor?: HTMLButtonElement | null
}

/**
 * Markup for an ⓘ affordance plus its hidden explanation payload.
 * `content` is plain text; blank-line/`\n` breaks become paragraphs on open.
 */
export function infoPopoverIcon(content: string): string {
    return `<button type="button" class="info-pop" aria-expanded="false" aria-label="Explain this metric" aria-haspopup="dialog">i</button>` +
        `<span class="info-pop__content" hidden>${escapeHtml(content)}</span>`
}

/**
 * A visible-label popover trigger (e.g. the MTM coverage chip). `className`
 * styles the button; the shared panel/open behavior is identical to the ⓘ icon.
 */
export function infoPopoverTrigger(label: string, content: string, className: string): string {
    return `<button type="button" class="info-pop-trigger ${className}" aria-expanded="false" aria-haspopup="dialog">${escapeHtml(label)}</button>` +
        `<span class="info-pop__content" hidden>${escapeHtml(content)}</span>`
}

function getPanel(): PopoverPanel {
    let panel = document.getElementById(PANEL_ID) as PopoverPanel | null
    if (!panel) {
        panel = document.createElement('div') as PopoverPanel
        panel.id = PANEL_ID
        panel.className = 'info-popover'
        panel.setAttribute('role', 'note')
        document.body.appendChild(panel)

        document.addEventListener('click', (event) => {
            const p = document.getElementById(PANEL_ID) as PopoverPanel | null
            if (!p || !p.classList.contains('is-open')) return
            const target = event.target as Node
            if (p.contains(target)) return
            if (p._anchor && p._anchor.contains(target)) return
            closePanel(p, false)
        })

        document.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape') return
            const p = document.getElementById(PANEL_ID) as PopoverPanel | null
            if (p && p.classList.contains('is-open')) {
                event.stopPropagation()
                closePanel(p, true)
            }
        })

        window.addEventListener('scroll', () => {
            const p = document.getElementById(PANEL_ID) as PopoverPanel | null
            if (p && p.classList.contains('is-open') && p._anchor) positionPanel(p, p._anchor)
        }, { passive: true })
    }
    return panel
}

function positionPanel(panel: PopoverPanel, anchor: HTMLElement): void {
    const iconRect = anchor.getBoundingClientRect()
    const panelRect = panel.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    let top = iconRect.top - panelRect.height - 10
    let left = iconRect.left + iconRect.width / 2 - panelRect.width / 2
    if (top < 10) top = iconRect.bottom + 10
    if (left < 10) left = 10
    else if (left + panelRect.width > viewportWidth - 10) left = viewportWidth - panelRect.width - 10
    panel.style.top = `${top}px`
    panel.style.left = `${left}px`
}

function closePanel(panel: PopoverPanel, refocus: boolean): void {
    panel.classList.remove('is-open')
    const anchor = panel._anchor
    if (anchor) {
        anchor.setAttribute('aria-expanded', 'false')
        if (refocus) anchor.focus()
    }
    panel._anchor = null
}

function openPanel(anchor: HTMLButtonElement): void {
    const panel = getPanel()
    if (panel._anchor === anchor && panel.classList.contains('is-open')) {
        closePanel(panel, false)
        return
    }
    if (panel._anchor) closePanel(panel, false)

    const payload = anchor.nextElementSibling
    const text = payload && payload.classList.contains('info-pop__content')
        ? (payload.textContent ?? '')
        : ''
    if (!text) return

    panel.textContent = ''
    text.split('\n').map(line => line.trim()).filter(Boolean).forEach(line => {
        const p = document.createElement('p')
        p.textContent = line
        panel.appendChild(p)
    })

    panel._anchor = anchor
    anchor.setAttribute('aria-expanded', 'true')
    panel.classList.add('is-open')
    positionPanel(panel, anchor)
}

/**
 * Delegated open/close handling for every `.info-pop` inside `root`.
 * Safe to call after each re-render: the listener binds once per root element.
 */
export function setupInfoPopovers(root: HTMLElement): void {
    if (root.dataset.infoPopBound === '1') return
    root.dataset.infoPopBound = '1'
    root.addEventListener('click', (event) => {
        const button = (event.target as HTMLElement).closest('.info-pop, .info-pop-trigger')
        if (!(button instanceof HTMLButtonElement) || !root.contains(button)) return
        event.preventDefault()
        event.stopPropagation()
        openPanel(button)
    })
}
