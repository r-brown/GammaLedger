import type { CreditPlaybookEntry } from './ui'

/**
 * Re-export CreditPlaybookEntry from the ui module for convenience.
 * The credit-playbook types are co-located in ui.ts because the entry
 * shape is purely a UI-layer projection of an EnrichedTrade.
 */
export type { CreditPlaybookEntry }
