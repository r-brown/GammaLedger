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
