// src/ui/filter-chips.ts — Checkbox-chip UI over the All Trades multi-selects.
// The (visually hidden) <select multiple> elements remain the canonical filter
// state, so filterTrades / reset / restore / deep-link helpers work unchanged;
// chips just read and mutate option.selected.
// Uses the .call(this, …) delegation pattern.

interface FilterChipsContext {
  normalizeFilterSelect(selectElement: HTMLSelectElement | null): void
  filterTrades(): void
  renderFilterChips(): void
}

const CHIP_GROUPS: ReadonlyArray<{ selectId: string; chipsId: string; allLabel: string }> = [
    { selectId: 'filter-strategy', chipsId: 'filter-strategy-chips', allLabel: 'All strategies' },
    { selectId: 'filter-status', chipsId: 'filter-status-chips', allLabel: 'All statuses' }
]

function renderGroup(this: FilterChipsContext, selectId: string, chipsId: string, allLabel: string): void {
    const select = document.getElementById(selectId) as HTMLSelectElement | null
    const container = document.getElementById(chipsId)
    if (!select || !container) return

    container.textContent = ''
    Array.from(select.options).forEach(option => {
        const chip = document.createElement('button')
        chip.type = 'button'
        chip.className = 'filter-chip'
        chip.textContent = option.value === '' ? allLabel : option.textContent ?? option.value
        const active = option.selected
        chip.classList.toggle('is-active', active)
        chip.setAttribute('aria-pressed', String(active))
        chip.addEventListener('click', () => {
            if (option.value === '') {
                // "All" clears every specific selection
                Array.from(select.options).forEach(o => { o.selected = o.value === '' })
            } else {
                option.selected = !option.selected
                // Drop "All" so normalizeFilterSelect keeps the specific pick
                // (it resolves All+specific in favor of All otherwise).
                const allOption = Array.from(select.options).find(o => o.value === '')
                if (allOption) allOption.selected = false
            }
            this.normalizeFilterSelect(select)
            this.filterTrades() // re-renders the chips via filterTrades → renderFilterChips
        })
        container.appendChild(chip)
    })
}

/** Rebuild both chip groups from the current select state. Idempotent. */
export function renderFilterChips(this: FilterChipsContext): void {
    CHIP_GROUPS.forEach(({ selectId, chipsId, allLabel }) =>
        renderGroup.call(this, selectId, chipsId, allLabel))
}
