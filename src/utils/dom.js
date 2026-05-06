// Pure DOM helpers — no class state required. Migrated from
// class GammaLedger (see docs/refactor/phase1-analysis.md §10).

export function escapeHTML(value) {
    if (value === null || value === undefined) {
        return '';
    }

    return value.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Deprecated alias kept for compatibility with existing call sites.
export function escapeHtml(text) {
    return escapeHTML(text);
}

export function generateTickerLink(ticker) {
    const safeTicker = (ticker ?? '').toString().trim().toUpperCase();
    if (!safeTicker) {
        return 'https://www.investing.com/search/';
    }
    return `https://www.investing.com/search/?q=${encodeURIComponent(safeTicker)}`;
}

export function createTickerElement(ticker, className = 'ticker-link', options = {}) {
    const safeTicker = (ticker ?? '').toString().trim().toUpperCase();

    if (!safeTicker) {
        const placeholder = document.createElement('span');
        placeholder.className = `${className} ticker-link--placeholder`.trim();
        placeholder.textContent = '—';
        return placeholder;
    }

    const { behavior = 'external', onClick = null, title = '' } = options || {};

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

export function applyResponsiveLabels(row, labels = []) {
    if (!row || !Array.isArray(labels) || labels.length === 0) {
        return;
    }

    const cells = Array.from(row.cells || []);
    cells.forEach((cell, index) => {
        const label = labels[index];
        if (label) {
            cell.setAttribute('data-label', label);
        } else {
            cell.removeAttribute('data-label');
        }
    });
}

// src/utils/dom.js additions — markdown rendering helpers.
// Uses the .call(this, …) delegation pattern.

export function renderMarkdownToHTML(markdown = '') {
    if (!markdown) {
        return '';
    }

    const segments = [];
    const codeBlockRegex = /```([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;

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
            return `<pre class="ai-chat__code"><code>${this.escapeHTML(code)}</code></pre>`;
        }
        return this.renderMarkdownTextSegment(segment.value);
    }).join('');
}

export function renderMarkdownTextSegment(text = '') {
    if (!text) {
        return '';
    }

    const lines = text.replace(/\r/g, '').split('\n');
    const htmlParts = [];
    let paragraphBuffer = [];
    let inUnordered = false;
    let inOrdered = false;

    const closeLists = () => {
        if (inUnordered) {
            htmlParts.push('</ul>');
            inUnordered = false;
        }
        if (inOrdered) {
            htmlParts.push('</ol>');
            inOrdered = false;
        }
    };

    const flushParagraph = () => {
        if (!paragraphBuffer.length) {
            return;
        }
        const content = paragraphBuffer.join(' ').trim();
        if (content) {
            htmlParts.push(`<p>${this.formatMarkdownInline(content)}</p>`);
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
            htmlParts.push(`<h${level}>${this.formatMarkdownInline(headingMatch[2])}</h${level}>`);
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
            htmlParts.push(`<blockquote class="ai-chat__quote">${this.formatMarkdownInline(quoteText)}</blockquote>`);
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
            htmlParts.push(`<li>${this.formatMarkdownInline(unorderedMatch[1])}</li>`);
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
            htmlParts.push(`<li>${this.formatMarkdownInline(orderedMatch[1])}</li>`);
            return;
        }

        paragraphBuffer.push(lineRaw);
    });

    flushParagraph();
    closeLists();

    return htmlParts.join('');
}

export function formatMarkdownInline(text = '') {
    if (!text) {
        return '';
    }

    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let lastIndex = 0;
    let result = '';
    let match;

    while ((match = linkRegex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            const preceding = text.slice(lastIndex, match.index);
            result += this.applyBasicInlineFormatting(preceding);
        }

        const label = this.applyBasicInlineFormatting(match[1]);
        const safeUrl = this.escapeHTML(this.sanitizeMarkdownUrl(match[2]));
        result += `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${label}</a>`;
        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
        result += this.applyBasicInlineFormatting(text.slice(lastIndex));
    }

    return result;
}

export function applyBasicInlineFormatting(text = '') {
    if (!text) {
        return '';
    }

    let safe = this.escapeHTML(text);
    safe = safe.replace(/`([^`]+)`/g, '<code>$1</code>');
    safe = safe.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    safe = safe.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    safe = safe.replace(/\*(?!\s)([^*]+?)\*(?!\*)/g, '<em>$1</em>');
    safe = safe.replace(/_([^_]+)_/g, '<em>$1</em>');
    return safe;
}

export function sanitizeMarkdownUrl(url = '') {
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
