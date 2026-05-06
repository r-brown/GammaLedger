// src/ui/modals/disclaimer.ts — Wave 8: Disclaimer banner modal.
// Uses the .call(this, …) delegation pattern.

// NOTE: DISCLAIMER_STORAGE_KEY is declared in the host class scope.
declare const DISCLAIMER_STORAGE_KEY: string;

interface DisclaimerBannerState {
  element: HTMLElement | null
  body: HTMLElement | null
  agreeButton: Element | null
  agreeHandler: (() => void) | null
  hideTimeoutId: ReturnType<typeof setTimeout> | null
}

interface DisclaimerContext {
  disclaimerBanner: DisclaimerBannerState
  disclaimerFadeMs: number
  acceptDisclaimer(): void
  getDisclaimerAcceptance(): string | null
  showDisclaimerBanner(): void
  hideDisclaimerBanner(opts?: { immediate?: boolean }): void
  setDisclaimerAcceptance(value: string | null): void
}

export function initializeDisclaimerBanner(this: DisclaimerContext): void {
    const element = document.getElementById('disclaimer-banner');
    if (!element) {
        return;
    }

    if (this.disclaimerBanner.agreeButton && this.disclaimerBanner.agreeHandler) {
        this.disclaimerBanner.agreeButton.removeEventListener('click', this.disclaimerBanner.agreeHandler);
    }

    const agreeButton = element.querySelector('[data-action="disclaimer-agree"]');
    const body = element.querySelector('.disclaimer-banner__body') as HTMLElement | null;

    this.disclaimerBanner.element = element;
    this.disclaimerBanner.body = body;
    this.disclaimerBanner.agreeButton = agreeButton;

    const handler = () => this.acceptDisclaimer();
    this.disclaimerBanner.agreeHandler = handler;
    if (agreeButton) {
        agreeButton.addEventListener('click', handler);
    }

    const acceptedAt = this.getDisclaimerAcceptance();
    if (acceptedAt) {
        this.hideDisclaimerBanner({ immediate: true });
    } else {
        this.showDisclaimerBanner();
    }
}

export function showDisclaimerBanner(this: DisclaimerContext): void {
    const banner = this.disclaimerBanner?.element;
    if (!banner) {
        return;
    }

    if (this.disclaimerBanner.hideTimeoutId) {
        clearTimeout(this.disclaimerBanner.hideTimeoutId);
        this.disclaimerBanner.hideTimeoutId = null;
    }

    banner.classList.remove('is-hidden');
    requestAnimationFrame(() => {
        banner.classList.add('is-visible');
        banner.setAttribute('aria-hidden', 'false');

        const body = this.disclaimerBanner?.body;
        if (body && typeof body.focus === 'function') {
            try {
                body.focus({ preventScroll: true });
            } catch (_error) {
                body.focus();
            }
        }
    });
}

export function hideDisclaimerBanner(this: DisclaimerContext, { immediate = false } = {}): void {
    const banner = this.disclaimerBanner?.element;
    if (!banner) {
        return;
    }

    if (this.disclaimerBanner.hideTimeoutId) {
        clearTimeout(this.disclaimerBanner.hideTimeoutId);
        this.disclaimerBanner.hideTimeoutId = null;
    }

    if (immediate) {
        banner.classList.remove('is-visible');
        banner.classList.add('is-hidden');
        banner.setAttribute('aria-hidden', 'true');
        return;
    }

    banner.classList.remove('is-visible');
    banner.setAttribute('aria-hidden', 'true');

    this.disclaimerBanner.hideTimeoutId = setTimeout(() => {
        banner.classList.add('is-hidden');
        this.disclaimerBanner.hideTimeoutId = null;
    }, this.disclaimerFadeMs);
}

export function acceptDisclaimer(this: DisclaimerContext): void {
    this.setDisclaimerAcceptance(new Date().toISOString());
    this.hideDisclaimerBanner();
}

export function getDisclaimerAcceptance(): string | null {
    try {
        const value = localStorage.getItem(DISCLAIMER_STORAGE_KEY);
        return value || null;
    } catch (error) {
        console.warn('Failed to read disclaimer acceptance from storage:', error);
        return null;
    }
}

export function setDisclaimerAcceptance(value: string | null): void {
    try {
        if (!value) {
            localStorage.removeItem(DISCLAIMER_STORAGE_KEY);
            return;
        }
        localStorage.setItem(DISCLAIMER_STORAGE_KEY, value);
    } catch (error) {
        console.warn('Failed to persist disclaimer acceptance:', error);
    }
}

