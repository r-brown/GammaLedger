// src/core/consent.ts — what a stored AI Coach consent record allows.

import type { AIProviderId } from './config.js'
import type { AICoachConsentRecord } from './schema.js'

export interface ConsentRequirement {
    /** 1 = portfolio chat (legacy records qualify); 2 = research data and typed decisions too. */
    minVersion?: 1 | 2
}

export function consentSatisfies(
    record: AICoachConsentRecord | null,
    activeProvider: AIProviderId,
    requirement: ConsentRequirement = {}
): boolean {
    if (!record || record.provider !== activeProvider) return false
    return (record.version ?? 1) >= (requirement.minVersion ?? 1)
}
