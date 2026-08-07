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

import { safeLocalStorage } from '../core/storage.js';
import { EXTERNAL_ANALYTICS_STORAGE_KEY, DEFAULT_EXTERNAL_ANALYTICS_URL } from '../core/config.js';

export const EXTERNAL_ANALYTICS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>`;

export function generateTickerLink(ticker: unknown): string {
    const safeTicker = String(ticker ?? '').trim().toUpperCase();
    let baseUrl = safeLocalStorage.getItem(EXTERNAL_ANALYTICS_STORAGE_KEY) || DEFAULT_EXTERNAL_ANALYTICS_URL;
    if (!safeTicker) {
        return baseUrl.replace('{ticker}', '');
    }
    
    if (baseUrl.includes('{ticker}')) {
        return baseUrl.replace('{ticker}', encodeURIComponent(safeTicker));
    }
    
    return `${baseUrl}${encodeURIComponent(safeTicker)}`;
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
        const wrapper = document.createElement('span');
        wrapper.className = 'ticker-filter-wrapper';
        wrapper.style.display = 'inline-flex';
        wrapper.style.alignItems = 'center';
        wrapper.style.gap = '4px';

        link.href = '#';
        link.setAttribute('role', 'button');
        link.dataset.ticker = safeTicker;
        link.addEventListener('click', (event) => {
            event.preventDefault();
            onClick(safeTicker);
        });

        const externalLink = document.createElement('a');
        externalLink.href = generateTickerLink(safeTicker);
        externalLink.target = '_blank';
        externalLink.rel = 'noopener noreferrer';
        externalLink.className = 'external-analytics-icon';
        externalLink.title = `Open ${safeTicker} analytics`;
        // Simple external link SVG icon
        externalLink.innerHTML = EXTERNAL_ANALYTICS_SVG;
        externalLink.style.display = 'inline-flex';
        externalLink.style.alignItems = 'center';
        externalLink.style.color = 'inherit';
        externalLink.style.opacity = '0.6';
        externalLink.style.transition = 'opacity 0.2s, color 0.2s';
        
        externalLink.addEventListener('mouseenter', () => {
            externalLink.style.opacity = '1';
            externalLink.style.color = 'var(--color-primary, inherit)';
        });
        externalLink.addEventListener('mouseleave', () => {
            externalLink.style.opacity = '0.6';
            externalLink.style.color = 'inherit';
        });

        externalLink.addEventListener('click', (event) => {
            event.stopPropagation();
        });

        wrapper.appendChild(link);
        wrapper.appendChild(externalLink);
        return wrapper;
    } else {
        link.href = generateTickerLink(safeTicker);
        link.target = '_blank';
        link.rel = 'noopener noreferrer';

        const iconSpan = document.createElement('span');
        iconSpan.innerHTML = EXTERNAL_ANALYTICS_SVG;
        iconSpan.className = 'external-analytics-icon';
        iconSpan.style.display = 'inline-flex';
        iconSpan.style.alignItems = 'center';
        iconSpan.style.marginLeft = '4px';
        iconSpan.style.opacity = '0.6';
        
        link.style.display = 'inline-flex';
        link.style.alignItems = 'center';
        link.appendChild(iconSpan);

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
