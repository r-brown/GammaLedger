// src/ui/notifications.ts — Wave 8: Notification + toast helpers.
// Vanilla queued toast manager with ARIA live regions.
// Uses the .call(this, …) delegation pattern for the unsaved-indicator helpers.

import type { ToastVariant } from '@types-gl/common'

interface NotificationsContext {
  hasUnsavedChanges: boolean
  currentFileName: string
  updateUnsavedIndicator(): void
  updateFileNameDisplay(): void
}

interface ToastOptions {
  duration?: number
  closable?: boolean
}

interface VisibleToast {
  element: HTMLElement
  timeoutId: ReturnType<typeof setTimeout> | null
  remainingMs: number
  expiresAt: number
}

interface QueuedToast {
  message: string
  type: ToastVariant
  options: ToastOptions
}

const MAX_VISIBLE = 3
const DEFAULT_DURATION_MS = 4000
const ERROR_DURATION_MS = 8000
const ANIMATION_MS = 180

const visible: VisibleToast[] = []
const queue: QueuedToast[] = []

function getRegion(): HTMLElement | null {
    return document.getElementById('toast-region')
}

function durationFor(type: ToastVariant, override?: number): number {
    if (typeof override === 'number' && Number.isFinite(override) && override > 0) return override
    return type === 'error' ? ERROR_DURATION_MS : DEFAULT_DURATION_MS
}

function scheduleDismiss(toast: VisibleToast, ms: number): void {
    if (toast.timeoutId) clearTimeout(toast.timeoutId)
    toast.remainingMs = ms
    toast.expiresAt = Date.now() + ms
    toast.timeoutId = setTimeout(() => dismiss(toast.element), ms)
}

function pauseDismiss(toast: VisibleToast): void {
    if (!toast.timeoutId) return
    clearTimeout(toast.timeoutId)
    toast.timeoutId = null
    toast.remainingMs = Math.max(0, toast.expiresAt - Date.now())
}

function resumeDismiss(toast: VisibleToast): void {
    if (toast.timeoutId) return
    if (toast.remainingMs <= 0) {
        dismiss(toast.element)
        return
    }
    scheduleDismiss(toast, toast.remainingMs)
}

function pumpQueue(): void {
    while (queue.length > 0 && visible.length < MAX_VISIBLE) {
        const next = queue.shift()
        if (!next) break
        mount(next.message, next.type, next.options)
    }
}

function dismiss(el: HTMLElement): void {
    const idx = visible.findIndex((t) => t.element === el)
    if (idx === -1) return
    const toast = visible[idx]
    if (toast.timeoutId) clearTimeout(toast.timeoutId)
    visible.splice(idx, 1)

    el.classList.remove('is-visible')
    setTimeout(() => {
        el.remove()
        pumpQueue()
    }, ANIMATION_MS)
}

function mount(message: string, type: ToastVariant, options: ToastOptions): void {
    const region = getRegion()
    if (!region) {
        // Fallback when the region is not in the DOM (older saved html, tests).
        console.log(`${type.toUpperCase()}: ${message}`)
        return
    }

    const el = document.createElement('div')
    el.className = `toast toast--${type}`
    el.setAttribute('role', type === 'error' ? 'alert' : 'status')
    el.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite')
    el.setAttribute('aria-atomic', 'true')

    const messageEl = document.createElement('div')
    messageEl.className = 'toast__message'
    messageEl.textContent = message
    el.appendChild(messageEl)

    const closable = options.closable !== false
    if (closable) {
        const closeBtn = document.createElement('button')
        closeBtn.type = 'button'
        closeBtn.className = 'toast__close'
        closeBtn.setAttribute('aria-label', 'Dismiss notification')
        closeBtn.textContent = '×'
        closeBtn.addEventListener('click', () => dismiss(el))
        el.appendChild(closeBtn)
    }

    region.appendChild(el)
    requestAnimationFrame(() => el.classList.add('is-visible'))

    const toast: VisibleToast = {
        element: el,
        timeoutId: null,
        remainingMs: 0,
        expiresAt: 0,
    }
    visible.push(toast)

    const ms = durationFor(type, options.duration)
    scheduleDismiss(toast, ms)

    el.addEventListener('mouseenter', () => pauseDismiss(toast))
    el.addEventListener('mouseleave', () => resumeDismiss(toast))
    el.addEventListener('focusin', () => pauseDismiss(toast))
    el.addEventListener('focusout', () => resumeDismiss(toast))
}

export function showNotification(message: string, type: ToastVariant = 'info', options: ToastOptions = {}): void {
    if (!message) return
    if (visible.length >= MAX_VISIBLE) {
        queue.push({ message, type, options })
        return
    }
    mount(message, type, options)
}

export function showLoadingIndicator(text = 'Loading...'): void {
    const indicator = document.getElementById('loading-indicator')
    if (indicator) {
        indicator.textContent = text
        indicator.classList.remove('hidden')
    }
}

export function hideLoadingIndicator(): void {
    const indicator = document.getElementById('loading-indicator')
    if (indicator) {
        indicator.classList.add('hidden')
    }
}

export function markUnsavedChanges(this: NotificationsContext): void {
    this.hasUnsavedChanges = true
    this.updateUnsavedIndicator()
}

export function updateFileNameDisplay(this: NotificationsContext): void {
    const nameEl = document.getElementById('current-file-name')
    if (!nameEl) return

    nameEl.textContent = this.currentFileName
    if (this.currentFileName === 'Unsaved Database') {
        nameEl.classList.add('is-unsaved')
    } else {
        nameEl.classList.remove('is-unsaved')
    }
}

export function updateUnsavedIndicator(this: NotificationsContext): void {
    const indicator = document.getElementById('unsaved-indicator')
    if (this.hasUnsavedChanges) {
        indicator?.classList.remove('hidden')
    } else {
        indicator?.classList.add('hidden')
    }
}
