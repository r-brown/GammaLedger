// src/ui/sidebar.js — Wave 8: Sidebar toggle and state persistence.
// Uses the .call(this, …) delegation pattern.

export function initializeSidebarToggle() {
    const container = document.querySelector('.app-container');
    const sidebar = document.querySelector('.sidebar');
    const toggleButton = document.getElementById('sidebar-toggle');
    const mainContent = document.querySelector('.main-content');

    if (!container || !sidebar || !toggleButton) {
        return;
    }

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
        } else if (typeof mediaQuery.addListener === 'function') {
            mediaQuery.addListener(handleMediaChange);
        }
    }

    applyStoredPreference({ animate: false });
}

export function getSidebarCollapsedPreference() {
    try {
        const value = localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY);
        return value === 'true';
    } catch (error) {
        console.warn('Failed to read sidebar preference from storage:', error);
        return false;
    }
}

export function setSidebarCollapsedPreference(collapsed) {
    try {
        localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(Boolean(collapsed)));
    } catch (error) {
        console.warn('Failed to persist sidebar preference:', error);
    }
}

export function setSidebarCollapsed(collapsed, { persist = true, animate = true } = {}) {
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

    const classes = [container, sidebar, mainContent].filter(Boolean);

    const toggleTransitions = (enable) => {
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
