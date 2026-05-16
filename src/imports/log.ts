// src/imports/log.js — Wave 7: Import log rendering.
// Uses the .call(this, …) delegation pattern.

type AnyRecord = Record<string, any>

export function appendImportLog(this: any, entry: Record<string, unknown> = {}) {
    const timestamp = entry.timestamp instanceof Date ? entry.timestamp as Date : new Date();
    const type = (entry.type as string) || 'info';
    const message = (entry.message as string) || '';
    if (!message) {
        return;
    }

    this.importLog = [{ timestamp, type, message }, ...this.importLog].slice(0, 12);
    this.renderImportLog();
}

export function renderImportLog(this: any) {
    const container = document.getElementById('import-log');
    if (!container) {
        return;
    }

    if (!Array.isArray(this.importLog) || this.importLog.length === 0) {
        container.innerHTML = '<p>No imports recorded yet.</p>';
        return;
    }

    const formatter = new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short'
    });

    container.innerHTML = this.importLog.map((entry: AnyRecord) => {
        const timeLabel = formatter.format(entry.timestamp);
        const statusLabel = entry.type === 'error' ? 'Error' : entry.type === 'success' ? 'Success' : 'Info';
        return `<div class="import-log__entry"><strong>${statusLabel} · ${timeLabel}</strong><span>${this.escapeHTML(entry.message)}</span></div>`;
    }).join('');
}

export function renderImportSummary(this: any) {
    const container = document.getElementById('import-summary');
    if (!container) {
        return;
    }

    if (!this.importSummary) {
        container.innerHTML = '<p class="import-summary__empty">Import a broker file to see how many trades and legs were created.</p>';
        return;
    }

    const summary = this.importSummary;
    const stats = summary.stats || {};
    const fileName = summary.fileName || 'Broker import';
    const timestamp = summary.timestamp instanceof Date
        ? summary.timestamp
        : new Date(summary.timestamp || Date.now());
    const dateFormatter = new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short'
    });
    const timestampLabel = Number.isNaN(timestamp.getTime()) ? '—' : dateFormatter.format(timestamp);
    const formatValue = (value: unknown) => {
        const numeric = Number(value);
        if (Number.isFinite(numeric)) {
            return this.formatNumber(numeric, { decimals: 0, useGrouping: true }) ?? '0';
        }
        if (value === null || value === undefined) {
            return '0';
        }
        return value.toString();
    };

    const legsImported = (stats.legsAddedToNewTrades || 0) + (stats.legsAddedToUpdates || 0);
    const reviewThisBatch = this.countImportReviewTrades(summary.batchId);
    const reviewAll = this.countImportReviewTrades();

    const metrics = [
        { label: 'Transactions processed', value: stats.totalTransactions ?? 0 },
        { label: 'Trades created', value: stats.totalTradesCreated ?? ((stats.tradesCreated || 0) + (stats.reviewTradesCreated || 0)) },
        { label: 'Trades updated', value: stats.tradesUpdated ?? 0 },
        { label: summary.batchId ? 'Review trades (this import)' : 'Review trades pending', value: reviewThisBatch },
        { label: 'Legs imported', value: legsImported },
        { label: 'Duplicate legs skipped', value: stats.duplicateLegs ?? 0 }
    ];

    if ((summary.mergedTrades || 0) > 0) {
        metrics.push({ label: 'Manual merges', value: summary.mergedTrades });
    }

    if (summary.batchId && reviewAll > reviewThisBatch) {
        metrics.push({ label: 'Review trades (all)', value: reviewAll });
    }

    container.innerHTML = `
        <div class="import-summary__meta">
            <span title="Imported file">${this.escapeHTML(fileName)}</span>
            <span title="Imported at">${this.escapeHTML(timestampLabel)}</span>
        </div>
        <div class="import-summary__grid">
            ${metrics.map((metric: { label: string; value: unknown }) => `
                <div class="import-summary__item">
                    <span class="import-summary__value">${this.escapeHTML(formatValue(metric.value))}</span>
                    <span class="import-summary__label">${this.escapeHTML(metric.label)}</span>
                </div>
            `).join('')}
        </div>
    `;
}
