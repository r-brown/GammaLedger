// Pure DOM helpers — no class state required. Migrated from
// class GammaLedger (see docs/refactor/phase1-analysis.md §10).

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
// Markdown rendering helpers
// Note: these were extracted with this.* calls during Phase 1 extraction;
// converted to direct function calls during Phase 2 TypeScript migration.
// ---------------------------------------------------------------------------

export function renderMarkdownToHTML(markdown = ''): string {
    if (!markdown) {
        return '';
    }

    const segments: Array<{ type: 'text' | 'code'; value: string }> = [];
    const codeBlockRegex = /```([\s\S]*?)```/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = codeBlockRegex.exec(markdown)) !== null) {
        if (match.index > lastIndex) {
            segments.push({ type: 'text', value: markdown.slice(lastIndex, match.index) });
        }
        segments.push({ type: 'code', value: match[1] });
        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < markdown.length) {
        segments.push({ type: 'text', value: markdown.slice(lastIndex) });
    }

    return segments.map(segment => {
        if (segment.type === 'code') {
            const code = segment.value.replace(/^\n+|\n+$/g, '');
            return `<pre class="ai-chat__code"><code>${escapeHTML(code)}</code></pre>`;
        }
        return renderMarkdownTextSegment(segment.value);
    }).join('');
}

export function renderMarkdownTextSegment(text = ''): string {
    if (!text) {
        return '';
    }

    const lines = text.replace(/\r/g, '').split('\n');
    const htmlParts: string[] = [];
    let paragraphBuffer: string[] = [];
    let inUnordered = false;
    let inOrdered = false;

    const closeLists = (): void => {
        if (inUnordered) {
            htmlParts.push('</ul>');
            inUnordered = false;
        }
        if (inOrdered) {
            htmlParts.push('</ol>');
            inOrdered = false;
        }
    };

    const flushParagraph = (): void => {
        if (!paragraphBuffer.length) {
            return;
        }
        const content = paragraphBuffer.join(' ').trim();
        if (content) {
            htmlParts.push(`<p>${formatMarkdownInline(content)}</p>`);
        }
        paragraphBuffer = [];
    };

    lines.forEach((lineRaw) => {
        const trimmed = lineRaw.trim();

        if (!trimmed) {
            flushParagraph();
            closeLists();
            return;
        }

        const headingMatch = trimmed.match(/^(#{1,3})\s+(.*)$/);
        if (headingMatch) {
            flushParagraph();
            closeLists();
            const level = Math.min(headingMatch[1].length + 2, 6);
            htmlParts.push(`<h${level}>${formatMarkdownInline(headingMatch[2])}</h${level}>`);
            return;
        }

        if (/^([-*_])\1{2,}$/.test(trimmed)) {
            flushParagraph();
            closeLists();
            htmlParts.push('<hr class="ai-chat__rule">');
            return;
        }

        if (trimmed.startsWith('>')) {
            flushParagraph();
            closeLists();
            const quoteText = trimmed.replace(/^>\s?/, '');
            htmlParts.push(`<blockquote class="ai-chat__quote">${formatMarkdownInline(quoteText)}</blockquote>`);
            return;
        }

        const unorderedMatch = trimmed.match(/^[-*]\s+(.*)$/);
        if (unorderedMatch) {
            flushParagraph();
            if (!inUnordered) {
                closeLists();
                htmlParts.push('<ul>');
                inUnordered = true;
            }
            htmlParts.push(`<li>${formatMarkdownInline(unorderedMatch[1])}</li>`);
            return;
        }

        const orderedMatch = trimmed.match(/^\d+\.\s+(.*)$/);
        if (orderedMatch) {
            flushParagraph();
            if (!inOrdered) {
                closeLists();
                htmlParts.push('<ol>');
                inOrdered = true;
            }
            htmlParts.push(`<li>${formatMarkdownInline(orderedMatch[1])}</li>`);
            return;
        }

        paragraphBuffer.push(lineRaw);
    });

    flushParagraph();
    closeLists();

    return htmlParts.join('');
}

export function formatMarkdownInline(text = ''): string {
    if (!text) {
        return '';
    }

    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let lastIndex = 0;
    let result = '';
    let match: RegExpExecArray | null;

    while ((match = linkRegex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            const preceding = text.slice(lastIndex, match.index);
            result += applyBasicInlineFormatting(preceding);
        }

        const label = applyBasicInlineFormatting(match[1]);
        const safeUrl = escapeHTML(sanitizeMarkdownUrl(match[2]));
        result += `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${label}</a>`;
        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
        result += applyBasicInlineFormatting(text.slice(lastIndex));
    }

    return result;
}

export function applyBasicInlineFormatting(text = ''): string {
    if (!text) {
        return '';
    }

    let safe = escapeHTML(text);
    safe = safe.replace(/`([^`]+)`/g, '<code>$1</code>');
    safe = safe.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    safe = safe.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    safe = safe.replace(/\*(?!\s)([^*]+?)\*(?!\*)/g, '<em>$1</em>');
    safe = safe.replace(/_([^_]+)_/g, '<em>$1</em>');
    return safe;
}

export function sanitizeMarkdownUrl(url = ''): string {
    try {
        const trimmed = url.trim();
        if (!trimmed) {
            return '#';
        }
        if (trimmed.startsWith('#')) {
            const anchor = trimmed.slice(1);
            if (anchor && /^[a-z0-9_-]{1,64}$/i.test(anchor)) {
                return `#${anchor}`;
            }
            return '#';
        }
        const lower = trimmed.toLowerCase();
        if (!lower.startsWith('http://') && !lower.startsWith('https://')) {
            return '#';
        }
        return trimmed;
    } catch (_error) {
        return '#';
    }
}

