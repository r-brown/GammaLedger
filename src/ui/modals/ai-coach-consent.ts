// src/ui/modals/ai-coach-consent.ts — Wave 8: AI Coach consent modal (native <dialog>).
// Uses the .call(this, …) delegation pattern.

import { AI_COACH_CONSENT_STORAGE_KEY } from '@core/config'
import { safeLocalStorage } from '@core/storage'

export interface AICoachConsentState {
  element: HTMLDialogElement | null
  panel: HTMLElement | null
  agreeButton: Element | null
  agreeHandler: (() => void) | null
  dismissButtons: Element[]
  dismissHandlers: ((event: Event) => void)[]
  cancelHandler: ((event: Event) => void) | null
  backdropHandler: ((event: MouseEvent) => void) | null
  pendingAction: (() => void) | null
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

const HIDE_FADE_MS = 220

export function initializeAICoachConsent(this: AICoachConsentContext): void {
    const consent = this.aiCoachConsent
    const element = document.getElementById('ai-coach-consent') as HTMLDialogElement | null
    if (!element) return

    consent.element = element
    consent.panel = (element.querySelector('.ai-consent-modal__panel') || element) as HTMLElement

    if (consent.agreeButton && consent.agreeHandler) {
        consent.agreeButton.removeEventListener('click', consent.agreeHandler)
    }
    const agreeButton = element.querySelector('[data-action="ai-consent-agree"]')
    consent.agreeButton = agreeButton
    const agreeHandler = () => this.acceptAICoachConsent()
    consent.agreeHandler = agreeHandler
    if (agreeButton) agreeButton.addEventListener('click', agreeHandler)

    consent.dismissButtons.forEach((button, index) => {
        const handler = consent.dismissHandlers[index]
        if (button && handler) button.removeEventListener('click', handler)
    })
    const dismissButtons = Array.from(element.querySelectorAll('[data-action="ai-consent-dismiss"]'))
    consent.dismissButtons = dismissButtons
    consent.dismissHandlers = dismissButtons.map((button) => {
        const handler = (event: Event) => {
            event.preventDefault()
            this.cancelAICoachConsent()
        }
        button.addEventListener('click', handler)
        return handler
    })

    if (consent.cancelHandler) {
        element.removeEventListener('cancel', consent.cancelHandler)
    }
    const cancelHandler = (event: Event) => {
        event.preventDefault() // suppress instant close so the fade-out animation runs
        this.cancelAICoachConsent()
    }
    consent.cancelHandler = cancelHandler
    element.addEventListener('cancel', cancelHandler)

    if (consent.backdropHandler) {
        element.removeEventListener('click', consent.backdropHandler as EventListener)
    }
    const backdropHandler = (event: MouseEvent) => {
        // Click on the dialog element itself = click on the backdrop area outside the panel.
        if (event.target === element) {
            this.cancelAICoachConsent()
        }
    }
    consent.backdropHandler = backdropHandler
    element.addEventListener('click', backdropHandler as EventListener)

    this.updateAIChatHeader()
}

export function showAICoachConsent(this: AICoachConsentContext): void {
    const consent = this.aiCoachConsent
    const { element, panel } = consent
    if (!element) return

    if (!element.open) element.showModal()
    requestAnimationFrame(() => {
        element.classList.add('is-visible')
        consent.isVisible = true
        if (panel && typeof panel.focus === 'function') {
            panel.setAttribute('tabindex', '-1')
            try { panel.focus({ preventScroll: true }) } catch (_e) { panel.focus() }
        }
    })
}

export function hideAICoachConsent(this: AICoachConsentContext, { immediate = false } = {}): void {
    const consent = this.aiCoachConsent
    const { element } = consent
    if (!element) return

    element.classList.remove('is-visible')
    consent.isVisible = false

    if (immediate) {
        if (element.open) element.close()
        return
    }

    setTimeout(() => {
        if (element.open) element.close()
    }, HIDE_FADE_MS)
}

export function promptAICoachConsent(this: AICoachConsentContext, nextAction: (() => void) | null = null): boolean {
    if (!this.aiCoachConsent.element) {
        this.initializeAICoachConsent()
    }

    if (this.hasAICoachConsent()) {
        if (typeof nextAction === 'function') {
            try { nextAction() } catch (error) { console.error('AI Coach consent follow-up failed:', error) }
        }
        return true
    }

    this.aiCoachConsent.pendingAction = typeof nextAction === 'function' ? nextAction : null
    this.showAICoachConsent()
    return false
}

export function acceptAICoachConsent(this: AICoachConsentContext): void {
    this.setAICoachConsent(new Date().toISOString())
    const followUp = this.aiCoachConsent.pendingAction
    this.aiCoachConsent.pendingAction = null
    this.hideAICoachConsent()
    this.updateAIChatHeader()

    if (typeof followUp === 'function') {
        try { followUp() } catch (error) { console.error('AI Coach consent follow-up failed:', error) }
    }
}

export function cancelAICoachConsent(this: AICoachConsentContext): void {
    this.aiCoachConsent.pendingAction = null
    this.hideAICoachConsent()
    this.updateAIChatHeader()
}

export function hasAICoachConsent(this: AICoachConsentContext): boolean {
    return Boolean(this.getAICoachConsent())
}

export function getAICoachConsent(): string | null {
    return safeLocalStorage.getItem(AI_COACH_CONSENT_STORAGE_KEY) || null
}

export function setAICoachConsent(value: string | null): void {
    if (!value) {
        safeLocalStorage.removeItem(AI_COACH_CONSENT_STORAGE_KEY)
        return
    }
    safeLocalStorage.setItem(AI_COACH_CONSENT_STORAGE_KEY, value)
}
