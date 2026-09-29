// src/ui/sidebar.ts — Wave 8: Sidebar toggle and state persistence.
// Uses the .call(this, …) delegation pattern.

import { SIDEBAR_COLLAPSED_STORAGE_KEY, APP_VERSION } from '@core/config'
import { safeLocalStorage } from '@core/storage'

interface SidebarState {
  container: Element | null
  sidebar: Element | null
  toggleButton: HTMLElement | null
  mainContent: Element | null
  mediaQuery: MediaQueryList | null
  preferredCollapsed: boolean
  collapsed: boolean
}

interface SidebarContext {
  sidebarState: SidebarState
  getSidebarCollapsedPreference(): boolean
  setSidebarCollapsed(collapsed: boolean, opts?: { persist?: boolean; animate?: boolean }): void
  setSidebarCollapsedPreference(collapsed: boolean): void
}

export function initializeSidebarToggle(this: SidebarContext): void {
    const container = document.querySelector('.app-container');
    const sidebar = document.querySelector('.sidebar');
    const toggleButton = document.getElementById('sidebar-toggle');
    const mainContent = document.querySelector('.main-content');

    if (!container || !sidebar || !toggleButton) {
        return;
    }

    const versionEl = document.getElementById('app-version')
    if (versionEl) versionEl.textContent = `v${APP_VERSION}`

    this.sidebarState.container = container;
    this.sidebarState.sidebar = sidebar;
    this.sidebarState.toggleButton = toggleButton;
    this.sidebarState.mainContent = mainContent || null;

    if (typeof window.matchMedia === 'function') {
        this.sidebarState.mediaQuery = window.matchMedia('(max-width: 768px)');
    } else {
        this.sidebarState.mediaQuery = null;
    }

    const applyStoredPreference = ({ animate = true } = {}) => {
        const storedPreference = this.getSidebarCollapsedPreference();
        this.setSidebarCollapsed(storedPreference, { persist: false, animate });
    };

    toggleButton.addEventListener('click', () => {
        const nextPreference = !this.sidebarState.preferredCollapsed;
        this.setSidebarCollapsed(nextPreference);
    });

    const mediaQuery = this.sidebarState.mediaQuery;
    if (mediaQuery) {
        const handleMediaChange = () => {
            applyStoredPreference({ animate: true });
        };

        if (typeof mediaQuery.addEventListener === 'function') {
            mediaQuery.addEventListener('change', handleMediaChange);
        } else if (typeof (mediaQuery as MediaQueryList & { addListener?: (fn: () => void) => void }).addListener === 'function') {
            // TODO Phase 3: deprecated MediaQueryList.addListener — safe cast
            (mediaQuery as MediaQueryList & { addListener: (fn: () => void) => void }).addListener(handleMediaChange);
        }
    }

    initializeMobileNav(sidebar);
    applyStoredPreference({ animate: false });
}

/** Phone widths hide the sidebar off-screen; this hamburger is the only way back in. */
function initializeMobileNav(sidebar: Element): void {
    const button = document.getElementById('mobile-nav-toggle');
    if (!button || button.dataset.bound === 'true') {
        return;
    }
    button.dataset.bound = 'true';
    const setOpen = (open: boolean) => {
        sidebar.classList.toggle('open', open);
        document.body.classList.toggle('mobile-nav-open', open);
        button.setAttribute('aria-expanded', String(open));
        button.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    };
    button.addEventListener('click', () => setOpen(!sidebar.classList.contains('open')));
    sidebar.addEventListener('click', (event) => {
        if (event.target instanceof Element && event.target.closest('.nav-item')) {
            setOpen(false);
        }
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && sidebar.classList.contains('open')) {
            setOpen(false);
            button.focus();
        }
    });
    document.getElementById('mobile-nav-scrim')?.addEventListener('click', () => setOpen(false));
}

export function getSidebarCollapsedPreference(): boolean {
    return safeLocalStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === 'true';
}

export function setSidebarCollapsedPreference(collapsed: boolean): void {
    safeLocalStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(Boolean(collapsed)));
}

export function setSidebarCollapsed(
    this: SidebarContext,
    collapsed: boolean,
    { persist = true, animate = true }: { persist?: boolean; animate?: boolean } = {}
): void {
    const state = this.sidebarState;
    const container = state?.container;
    const sidebar = state?.sidebar;
    const toggleButton = state?.toggleButton;
    const mainContent = state?.mainContent;

    if (!container || !sidebar || !toggleButton) {
        return;
    }

    const requestedCollapsed = Boolean(collapsed);
    const isMobile = state.mediaQuery?.matches ?? window.innerWidth <= 768;
    const effectiveCollapsed = isMobile ? false : requestedCollapsed;

    state.preferredCollapsed = requestedCollapsed;
    state.collapsed = effectiveCollapsed;

    const classes = [container, sidebar, mainContent].filter(Boolean) as Element[];

    const toggleTransitions = (enable: boolean) => {
        classes.forEach((element) => {
            if (!element) {
                return;
            }

            if (enable) {
                element.classList.remove('no-transition');
            } else {
                element.classList.add('no-transition');
            }
        });
    };

    if (!animate) {
        toggleTransitions(false);
    }

    container.classList.toggle('is-sidebar-collapsed', effectiveCollapsed);
    sidebar.classList.toggle('is-collapsed', effectiveCollapsed);

    if (!animate) {
        requestAnimationFrame(() => toggleTransitions(true));
    }

    const ariaExpanded = (!effectiveCollapsed).toString();
    const label = effectiveCollapsed ? 'Expand navigation' : 'Collapse navigation';
    toggleButton.setAttribute('aria-expanded', ariaExpanded);
    toggleButton.setAttribute('aria-label', label);
    toggleButton.setAttribute('title', label);

    if (persist) {
        this.setSidebarCollapsedPreference(requestedCollapsed);
    }
}
