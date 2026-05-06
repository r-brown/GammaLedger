// src/ui/modals/ai-coach-consent.ts — Wave 8: AI Coach consent modal.
// Uses the .call(this, …) delegation pattern.

// NOTE: AI_COACH_CONSENT_STORAGE_KEY is declared in the host class scope.
declare const AI_COACH_CONSENT_STORAGE_KEY: string;

interface AICoachConsentState {
  element: HTMLElement | null
  panel: HTMLElement | null
  agreeButton: Element | null
  agreeHandler: (() => void) | null
  dismissButtons: Element[]
  dismissHandlers: ((event: Event) => void)[]
  escapeHandler: ((event: KeyboardEvent) => void) | null
  pendingAction: (() => void) | null
  restoreFocus: HTMLElement | null
  isVisible: boolean
}

interface AICoachConsentContext {
  aiCoachConsent: AICoachConsentState
  initializeAICoachConsent(): void
  showAICoachConsent(): void
  hideAICoachConsent(opts?: { immediate?: boolean }): void
  acceptAICoachConsent(): void
  cancelAICoachConsent(): void
  hasAICoachConsent(): boolean
  getAICoachConsent(): string | null
  setAICoachConsent(value: string | null): void
  updateAIChatHeader(): void
}

export function initializeAICoachConsent(this: AICoachConsentContext): void {
    const consent = this.aiCoachConsent;
    const element = document.getElementById('ai-coach-consent');
    if (!element) {
        return;
    }

    consent.element = element;
    consent.panel = (element.querySelector('.ai-consent-modal__panel') || element) as HTMLElement;
    const agreeButton = element.querySelector('[data-action="ai-consent-agree"]');

    if (consent.agreeButton && consent.agreeHandler) {
        consent.agreeButton.removeEventListener('click', consent.agreeHandler);
    }

    consent.agreeButton = agreeButton;
    const agreeHandler = () => this.acceptAICoachConsent();
    consent.agreeHandler = agreeHandler;
    if (agreeButton) {
        agreeButton.addEventListener('click', agreeHandler);
    }

    consent.dismissButtons.forEach((button, index) => {
        const handler = consent.dismissHandlers[index];
        if (button && handler) {
            button.removeEventListener('click', handler);
        }
    });

    const dismissButtons = Array.from(element.querySelectorAll('[data-action="ai-consent-dismiss"]'));
    consent.dismissButtons = dismissButtons;
    consent.dismissHandlers = dismissButtons.map((button) => {
        const handler = (event: Event) => {
            event.preventDefault();
            this.cancelAICoachConsent();
        };
        button.addEventListener('click', handler);
        return handler;
    });

    if (consent.escapeHandler) {
        element.removeEventListener('keydown', consent.escapeHandler as EventListener);
    }

    const escapeHandler = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            this.cancelAICoachConsent();
        }
    };
    consent.escapeHandler = escapeHandler;
    element.addEventListener('keydown', escapeHandler as EventListener);

    element.setAttribute('aria-hidden', 'true');

    if (!element.classList.contains('is-hidden')) {
        element.classList.add('is-hidden');
    }

    this.updateAIChatHeader();
}

export function showAICoachConsent(this: AICoachConsentContext): void {
    const consent = this.aiCoachConsent;
    const { element, panel } = consent;
    if (!element) {
        return;
    }

    consent.restoreFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    element.classList.remove('is-hidden');
    requestAnimationFrame(() => {
        element.classList.add('is-visible');
        element.setAttribute('aria-hidden', 'false');
        consent.isVisible = true;

        if (panel && typeof panel.focus === 'function') {
            panel.setAttribute('tabindex', '-1');
            try {
                panel.focus({ preventScroll: true });
            } catch (_error) {
                panel.focus();
            }
        }
    });
}

export function hideAICoachConsent(this: AICoachConsentContext, { immediate = false } = {}): void {
    const consent = this.aiCoachConsent;
    const { element } = consent;
    if (!element) {
        return;
    }

    const finalize = () => {
        element.classList.add('is-hidden');
        element.setAttribute('aria-hidden', 'true');
        consent.isVisible = false;

        const target = consent.restoreFocus;
        consent.restoreFocus = null;
        if (target && typeof target.focus === 'function') {
            try {
                target.focus({ preventScroll: true });
            } catch (_error) {
                target.focus();
            }
        }
    };

    if (immediate) {
        element.classList.remove('is-visible');
        finalize();
        return;
    }

    element.classList.remove('is-visible');
    element.setAttribute('aria-hidden', 'true');
    consent.isVisible = false;

    setTimeout(() => {
        if (!element.classList.contains('is-visible')) {
            finalize();
        }
    }, 220);
}

export function promptAICoachConsent(this: AICoachConsentContext, nextAction: (() => void) | null = null): boolean {
    if (!this.aiCoachConsent.element) {
        this.initializeAICoachConsent();
    }

    if (this.hasAICoachConsent()) {
        if (typeof nextAction === 'function') {
            try {
                nextAction();
            } catch (error) {
                console.error('AI Coach consent follow-up failed:', error);
            }
        }
        return true;
    }

    this.aiCoachConsent.pendingAction = typeof nextAction === 'function' ? nextAction : null;
    this.showAICoachConsent();
    return false;
}

export function acceptAICoachConsent(this: AICoachConsentContext): void {
    this.setAICoachConsent(new Date().toISOString());
    const followUp = this.aiCoachConsent.pendingAction;
    this.aiCoachConsent.pendingAction = null;
    this.hideAICoachConsent();
    this.updateAIChatHeader();

    if (typeof followUp === 'function') {
        try {
            followUp();
        } catch (error) {
            console.error('AI Coach consent follow-up failed:', error);
        }
    }
}

export function cancelAICoachConsent(this: AICoachConsentContext): void {
    this.aiCoachConsent.pendingAction = null;
    this.hideAICoachConsent();
    this.updateAIChatHeader();
}

export function hasAICoachConsent(this: AICoachConsentContext): boolean {
    return Boolean(this.getAICoachConsent());
}

export function getAICoachConsent(): string | null {
    try {
        const value = localStorage.getItem(AI_COACH_CONSENT_STORAGE_KEY);
        return value || null;
    } catch (error) {
        console.warn('Failed to read AI Coach consent from storage:', error);
        return null;
    }
}

export function setAICoachConsent(value: string | null): void {
    try {
        if (!value) {
            localStorage.removeItem(AI_COACH_CONSENT_STORAGE_KEY);
            return;
        }
        localStorage.setItem(AI_COACH_CONSENT_STORAGE_KEY, value);
    } catch (error) {
        console.warn('Failed to persist AI Coach consent:', error);
    }
}

