// src/ai/usage-format.ts — human-readable token/cost lines for AI Coach replies.

import type { LLMUsage } from '../integrations/llm/types.js';

const integer = new Intl.NumberFormat('en-US');

/** "Numbers checked: 14/15 in your data · 1 not found" */
export function formatGroundingBadge(result: { checked: number; matched: number }): string {
    const base = `Numbers checked: ${result.matched}/${result.checked} in your data`;
    const missing = result.checked - result.matched;
    return missing > 0 ? `${base} · ${missing} not found` : base;
}

export function formatUsd(cost: number): string {
    if (cost === 0) {
        return '$0.00';
    }
    return cost < 0.01 ? `$${cost.toFixed(4)}` : `$${cost.toFixed(2)}`;
}

/** "anthropic/claude-sonnet-5" → "claude-sonnet-5". */
export function shortModelName(model: string | null | undefined): string {
    if (!model) {
        return '';
    }
    return model.slice(model.lastIndexOf('/') + 1);
}

/** "1,234 in · 567 out · $0.0042 · claude-sonnet-5" — parts the provider didn't report are left out. */
export function formatReplyUsage(usage: LLMUsage | null | undefined, model: string | null | undefined): string {
    if (!usage) {
        return '';
    }
    const parts: string[] = [];
    if (usage.inputTokens !== null) {
        parts.push(`${integer.format(usage.inputTokens)} in`);
    }
    if (usage.outputTokens !== null) {
        parts.push(`${integer.format(usage.outputTokens)} out`);
    }
    if (usage.costUsd !== null) {
        parts.push(formatUsd(usage.costUsd));
    }
    const name = shortModelName(model);
    if (name) {
        parts.push(name);
    }
    return parts.join(' · ');
}

/** "This chat: 3 replies · 12,345 tokens · $0.01"; empty when no reply carried usage. */
export function summarizeSessionUsage(messages: ReadonlyArray<{ usage?: LLMUsage | null }>): string {
    let replies = 0;
    let tokens = 0;
    let cost = 0;
    let hasCost = false;
    for (const message of messages) {
        const usage = message.usage;
        if (!usage) {
            continue;
        }
        replies += 1;
        tokens += (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0);
        if (usage.costUsd !== null) {
            cost += usage.costUsd;
            hasCost = true;
        }
    }
    if (!replies) {
        return '';
    }
    const parts = [`This chat: ${replies} ${replies === 1 ? 'reply' : 'replies'}`, `${integer.format(tokens)} tokens`];
    if (hasCost) {
        parts.push(formatUsd(cost));
    }
    return parts.join(' · ');
}
