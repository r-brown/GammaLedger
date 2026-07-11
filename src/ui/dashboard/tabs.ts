// src/ui/dashboard/tabs.ts — Minimal tab groups for the dashboard cards.
// Static markup contract: a [data-tab-group] root containing [role=tab]
// buttons with data-tab-target and sibling panels with data-tab-panel.
// Hidden panels use the `hidden` attribute; ECharts instances self-resize on
// reveal via their ResizeObserver, and AG Grid handles container resizes.

export function initTabGroup(root: HTMLElement): void {
    if (root.dataset.tabsBound === '1') return
    root.dataset.tabsBound = '1'

    const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-tab-target]'))
    const panels = Array.from(root.querySelectorAll<HTMLElement>('[data-tab-panel]'))

    const activate = (targetId: string) => {
        tabs.forEach(tab => {
            const active = tab.dataset.tabTarget === targetId
            tab.classList.toggle('is-active', active)
            tab.setAttribute('aria-selected', String(active))
            tab.tabIndex = active ? 0 : -1
        })
        panels.forEach(panel => {
            const active = panel.dataset.tabPanel === targetId
            panel.classList.toggle('is-active', active)
            panel.hidden = !active
        })
    }

    tabs.forEach((tab, index) => {
        tab.addEventListener('click', () => activate(tab.dataset.tabTarget ?? ''))
        tab.addEventListener('keydown', (event) => {
            if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
            event.preventDefault()
            const delta = event.key === 'ArrowRight' ? 1 : -1
            const next = tabs[(index + delta + tabs.length) % tabs.length]
            next.focus()
            activate(next.dataset.tabTarget ?? '')
        })
    })
}

/** Wire every [data-tab-group] on the page. Idempotent. */
export function initDashboardTabs(): void {
    document.querySelectorAll<HTMLElement>('[data-tab-group]').forEach(initTabGroup)
}
