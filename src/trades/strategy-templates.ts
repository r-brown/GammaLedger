// src/trades/strategy-templates.ts — Add-Trade strategy picker helpers:
// leg templates for ⭐ strategies and the type-ahead option filter.
// Uses the .call(this, …) delegation pattern.

interface StrategyTemplatesContext {
    currentEditingId: unknown
    readonly currentDate: Date
    defaultFeePerContract: number | null
    getDefaultFeeForQuantity(quantity?: number): number | null
    renderLegForms(legs?: unknown[]): void
    getLegsContainer(): HTMLElement | null
}

/**
 * Leg scaffolds for the ⭐ strategies. Field names match what
 * addLegFormRow() reads (orderType, type, quantity, executionDate, fees).
 * Returns null for strategies without a template.
 */
export function buildStrategyTemplateLegs(
    this: StrategyTemplatesContext,
    strategy: string
): Record<string, unknown>[] | null {
    const today = (() => {
        const d = this.currentDate
        const y = d.getFullYear()
        const m = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        return `${y}-${m}-${day}`
    })()

    const fee = this.getDefaultFeeForQuantity(1)
    const leg = (orderType: string, type: string): Record<string, unknown> => {
        const scaffold: Record<string, unknown> = {
            orderType,
            type,
            quantity: 1,
            executionDate: today
        }
        if (fee !== null) scaffold.fees = fee
        return scaffold
    }

    switch (strategy) {
        case 'Cash-Secured Put':
        case 'Wheel':
            return [leg('STO', 'PUT')]
        case 'Covered Call':
            return [leg('STO', 'CALL')]
        case "Poor Man's Covered Call":
            return [leg('BTO', 'CALL'), leg('STO', 'CALL')]
        default:
            return null
    }
}

/**
 * True when the legs form holds no user-entered data — scaffolding may
 * safely replace it. More than one row, or any strike/premium/expiration
 * value, counts as user data.
 */
export function legsFormIsPristine(this: StrategyTemplatesContext): boolean {
    const container = this.getLegsContainer()
    if (!container) return false
    const rows = container.querySelectorAll('.trade-leg')
    if (rows.length === 0) return true
    if (rows.length > 1) return false
    const row = rows[0]
    return ['strike', 'premium', 'expirationDate'].every(field => {
        const input = row.querySelector(`[data-leg-field="${field}"]`) as HTMLInputElement | null
        return !input || input.value === ''
    })
}

/**
 * Wires the strategy `change` → template scaffolding and the type-ahead
 * filter input. Call once from setupEventListeners.
 */
export function setupStrategyPicker(this: StrategyTemplatesContext): void {
    const select = document.getElementById('strategy') as HTMLSelectElement | null
    if (!select) return

    select.addEventListener('change', () => {
        if (this.currentEditingId) return
        const template = buildStrategyTemplateLegs.call(this, select.value)
        if (!template) return
        if (!legsFormIsPristine.call(this)) return
        this.renderLegForms(template)
    })

    const search = document.getElementById('strategy-search') as HTMLInputElement | null
    if (!search) return
    search.addEventListener('input', () => {
        const term = search.value.trim().toLowerCase()
        const groups = Array.from(select.querySelectorAll('optgroup'))
        groups.forEach(group => {
            let visible = 0
            Array.from(group.querySelectorAll('option')).forEach(option => {
                const match = !term || option.textContent!.toLowerCase().includes(term)
                option.hidden = !match
                if (match) visible += 1
            })
            group.hidden = visible === 0
        })
    })
}
