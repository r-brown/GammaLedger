// Pure DOM helpers — no class state required. Migrated from
// class GammaLedger during the TypeScript module split.

import { marked } from 'marked'
import DOMPurify from 'dompurify'

export interface TickerElementOptions {
    behavior?: 'external' | 'filter'
    onClick?: ((ticker: string) => void) | null
    title?: string
}

export function escapeHTML(value: unknown): string {
    if (value === null || value === undefined) {
        return '';
    }

    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/** @deprecated Use escapeHTML instead */
export function escapeHtml(text: unknown): string {
    return escapeHTML(text);
}

export function generateTickerLink(ticker: unknown): string {
    const safeTicker = String(ticker ?? '').trim().toUpperCase();
    if (!safeTicker) {
        return 'https://www.investing.com/search/';
    }
    return `https://www.investing.com/search/?q=${encodeURIComponent(safeTicker)}`;
}

export function createTickerElement(
    ticker: unknown,
    className = 'ticker-link',
    options: TickerElementOptions = {}
): HTMLElement {
    const safeTicker = String(ticker ?? '').trim().toUpperCase();

    if (!safeTicker) {
        const placeholder = document.createElement('span');
        placeholder.className = `${className} ticker-link--placeholder`.trim();
        placeholder.textContent = '—';
        return placeholder;
    }

    const { behavior = 'external', onClick = null, title = '' } = options;

    const link = document.createElement('a');
    link.className = className;
    link.textContent = safeTicker;
    if (title) {
        link.title = title;
    }

    if (behavior === 'filter' && typeof onClick === 'function') {
        link.href = '#';
        link.setAttribute('role', 'button');
        link.dataset.ticker = safeTicker;
        link.addEventListener('click', (event) => {
            event.preventDefault();
            onClick(safeTicker);
        });
    } else {
        link.href = generateTickerLink(safeTicker);
        link.target = '_blank';
        link.rel = 'noopener noreferrer';

        link.addEventListener('click', (event) => {
            event.preventDefault();
            window.open(generateTickerLink(safeTicker), '_blank', 'noopener,noreferrer');
        });
    }

    return link;
}

export function applyResponsiveLabels(
    row: HTMLTableRowElement | null | undefined,
    labels: string[] = []
): void {
    if (!row || !Array.isArray(labels) || labels.length === 0) {
        return;
    }

    const cells = Array.from(row.cells);
    cells.forEach((cell, index) => {
        const label = labels[index];
        if (label) {
            cell.setAttribute('data-label', label);
        } else {
            cell.removeAttribute('data-label');
        }
    });
}

// ---------------------------------------------------------------------------
// Markdown rendering — marked + DOMPurify
// Replaces the prior hand-rolled CommonMark subset. AI chat is the only caller.
// ---------------------------------------------------------------------------

marked.use({ gfm: true, breaks: false })

let domPurifyHookInstalled = false
function ensureDomPurifyHook(): void {
    if (domPurifyHookInstalled) return
    DOMPurify.addHook('afterSanitizeAttributes', (node) => {
        if (node instanceof Element && node.tagName === 'A') {
            node.setAttribute('target', '_blank')
            node.setAttribute('rel', 'noopener noreferrer')
        }
    })
    domPurifyHookInstalled = true
}

const MARKDOWN_ALLOWED_TAGS = [
    'p', 'br', 'strong', 'em', 'code', 'pre', 'blockquote',
    'ul', 'ol', 'li',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'hr', 'a',
]
const MARKDOWN_ALLOWED_ATTR = ['href']

export function renderMarkdownToHTML(markdown = ''): string {
    if (!markdown) return ''
    ensureDomPurifyHook()
    const raw = marked.parse(markdown, { async: false }) as string
    return DOMPurify.sanitize(raw, {
        ALLOWED_TAGS: MARKDOWN_ALLOWED_TAGS,
        ALLOWED_ATTR: MARKDOWN_ALLOWED_ATTR,
    })
}
