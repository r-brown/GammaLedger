// src/ui/modals/disclaimer.ts — Wave 8: Disclaimer banner modal (native <dialog>).
// Uses the .call(this, …) delegation pattern.

import { DISCLAIMER_STORAGE_KEY } from '@core/config'
import { safeLocalStorage } from '@core/storage'

interface DisclaimerBannerState {
  element: HTMLDialogElement | null
  agreeButton: Element | null
  agreeHandler: (() => void) | null
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
    const element = document.getElementById('disclaimer-banner') as HTMLDialogElement | null
    if (!element) return

    if (this.disclaimerBanner.agreeButton && this.disclaimerBanner.agreeHandler) {
        this.disclaimerBanner.agreeButton.removeEventListener('click', this.disclaimerBanner.agreeHandler)
    }

    const agreeButton = element.querySelector('[data-action="disclaimer-agree"]')
    this.disclaimerBanner.element = element
    this.disclaimerBanner.agreeButton = agreeButton

    const handler = () => this.acceptDisclaimer()
    this.disclaimerBanner.agreeHandler = handler
    if (agreeButton) {
        agreeButton.addEventListener('click', handler)
    }

    const acceptedAt = this.getDisclaimerAcceptance()
    if (acceptedAt) {
        this.hideDisclaimerBanner({ immediate: true })
    } else {
        this.showDisclaimerBanner()
    }
}

export function showDisclaimerBanner(this: DisclaimerContext): void {
    const banner = this.disclaimerBanner.element
    if (!banner) return
    if (!banner.open) banner.showModal()
    requestAnimationFrame(() => {
        banner.classList.add('is-visible')
    })
}

export function hideDisclaimerBanner(this: DisclaimerContext, { immediate = false } = {}): void {
    const banner = this.disclaimerBanner.element
    if (!banner) return

    banner.classList.remove('is-visible')

    if (immediate) {
        if (banner.open) banner.close()
        return
    }

    setTimeout(() => {
        if (banner.open) banner.close()
    }, this.disclaimerFadeMs)
}

export function acceptDisclaimer(this: DisclaimerContext): void {
    this.setDisclaimerAcceptance(new Date().toISOString())
    this.hideDisclaimerBanner()
}

export function getDisclaimerAcceptance(): string | null {
    return safeLocalStorage.getItem(DISCLAIMER_STORAGE_KEY) || null
}

export function setDisclaimerAcceptance(value: string | null): void {
    if (!value) {
        safeLocalStorage.removeItem(DISCLAIMER_STORAGE_KEY)
        return
    }
    safeLocalStorage.setItem(DISCLAIMER_STORAGE_KEY, value)
}
