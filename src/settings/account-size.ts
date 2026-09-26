// src/settings/account-size.ts — optional account size (USD) for AI Coach risk sizing.
// Uses the .call(this, …) delegation pattern.

import { ACCOUNT_SIZE_STORAGE_KEY } from '@core/config'
import { AccountSizeSchema } from '@core/schema'
import { safeLocalStorage } from '@core/storage'

interface AccountSizeContext {
    accountSize: number | null
    formatCurrency(value: unknown, opts?: Record<string, unknown>): string
}

/** Plain decimal only ("50000", "62500.5"); rejects separators, exponents, zero and negatives. */
export function parseAccountSize(raw: string | null | undefined): number | null {
    const text = (raw ?? '').trim()
    if (!/^\d+(\.\d+)?$/.test(text)) {
        return null
    }
    const parsed = AccountSizeSchema.safeParse(Number(text))
    return parsed.success ? parsed.data : null
}

export function loadAccountSizeFromStorage(this: AccountSizeContext): void {
    this.accountSize = parseAccountSize(safeLocalStorage.getItem(ACCOUNT_SIZE_STORAGE_KEY))
}

export function initializeAccountSizeControls(this: AccountSizeContext): void {
    const input = document.getElementById('account-size-input') as HTMLInputElement | null
    const save = document.getElementById('account-size-save')
    const clear = document.getElementById('account-size-clear')
    const note = document.getElementById('account-size-note')
    if (!input) {
        return
    }
    const base = note?.textContent ?? ''
    const show = (message: string, variant: 'success' | 'error' | 'neutral') => {
        if (!note) {
            return
        }
        note.textContent = message ? `${message} ${base}` : base
        note.classList.toggle('is-success', variant === 'success')
        note.classList.toggle('is-error', variant === 'error')
    }

    if (this.accountSize !== null) {
        input.value = String(this.accountSize)
    }

    const commit = () => {
        const value = parseAccountSize(input.value)
        if (value === null) {
            show('Enter a positive dollar amount, digits only (for example 60000).', 'error')
            return
        }
        this.accountSize = value
        safeLocalStorage.setItem(ACCOUNT_SIZE_STORAGE_KEY, String(value))
        show(`Saved ${this.formatCurrency(value)}.`, 'success')
    }
    save?.addEventListener('click', (event) => { event.preventDefault(); commit() })
    input.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); commit() } })
    clear?.addEventListener('click', (event) => {
        event.preventDefault()
        this.accountSize = null
        safeLocalStorage.removeItem(ACCOUNT_SIZE_STORAGE_KEY)
        input.value = ''
        show('Cleared.', 'neutral')
    })
}
