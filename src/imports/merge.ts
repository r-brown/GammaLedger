// src/imports/merge.js — Wave 7: Trade merge logic.
// Uses the .call(this, …) delegation pattern.

type AnyRecord = Record<string, any>

export function countMergeableTickerGroups(this: any) {
    const tickerCounts = new Map<string, number>();
    this.trades.forEach((trade: AnyRecord) => {
        if (!trade) return;
        const ticker = (trade.ticker || '').toUpperCase();
        if (!ticker) return;
        // Only consider imported trades (have importSource on at least one leg)
        const isImported = (trade.legs || []).some(
            (leg: AnyRecord) => leg.importSource || leg.externalId
        );
        if (!isImported) return;
        tickerCounts.set(ticker, (tickerCounts.get(ticker) || 0) + 1);
    });
    let groups = 0;
    tickerCounts.forEach((count: number) => {
        if (count >= 2) groups += 1;
    });
    return groups;
}

export function refreshImportMergeList(this: any) {
    const container = document.getElementById('import-merge-list');
    const hintElement = document.getElementById('import-merge-hint');
    const hintButton = document.getElementById('import-merge-hint-btn');
    const countBadge = document.getElementById('import-merge-count');
    const mergeButton = document.getElementById('import-merge-btn');
    const reviewTrades: AnyRecord[] = this.getImportReviewTrades();

    // Also count same-ticker trade groups that could be merged
    const mergeableTickers = this.countMergeableTickerGroups();
    const totalMergeOpportunities = reviewTrades.length + mergeableTickers;

    if (!reviewTrades.length) {
        this.importMergeSelection.clear();
    } else {
        const presentIds = new Set(reviewTrades.map((trade: AnyRecord) => trade.id));
        Array.from(this.importMergeSelection).forEach((id: unknown) => {
            if (!presentIds.has(id)) {
                this.importMergeSelection.delete(id);
            }
        });
    }

    if (countBadge) {
        if (totalMergeOpportunities > 0) {
            countBadge.textContent = `(${totalMergeOpportunities})`;
        } else {
            countBadge.textContent = '';
        }
    }

    if (hintElement) {
        if (!totalMergeOpportunities) {
            hintElement.textContent = 'No merge opportunities detected. All trades look clean.';
        } else if (reviewTrades.length && mergeableTickers) {
            hintElement.textContent = `${reviewTrades.length} flagged review trade${reviewTrades.length === 1 ? '' : 's'} and ${mergeableTickers} ticker group${mergeableTickers === 1 ? '' : 's'} with multiple trades that could be combined.`;
        } else if (reviewTrades.length) {
            const tradeLabel = reviewTrades.length === 1 ? 'review trade' : 'review trades';
            hintElement.textContent = `${reviewTrades.length} ${tradeLabel} flagged for merge review. Open the All Trades page to combine them.`;
        } else {
            hintElement.textContent = `${mergeableTickers} ticker group${mergeableTickers === 1 ? '' : 's'} with multiple trades that could be combined.`;
        }
    }

    // Always keep the button enabled so users can review trades at any time
    if (hintButton) {
        (hintButton as HTMLButtonElement).disabled = false;
        (hintButton as HTMLButtonElement).title = totalMergeOpportunities > 0
            ? `Review ${totalMergeOpportunities} potential merge opportunit${totalMergeOpportunities === 1 ? 'y' : 'ies'} on the All Trades page.`
            : 'Open the All Trades page with the Merge Trades panel.';
    }

    if (!container) {
        if (mergeButton) {
            (mergeButton as HTMLButtonElement).disabled = true;
            mergeButton.textContent = 'Merge Selected Trades';
        }
        return;
    }

    if (!reviewTrades.length) {
        container.innerHTML = '<p class="import-merge__empty">No review trades are waiting to be merged.</p>';
        if (mergeButton) {
            (mergeButton as HTMLButtonElement).disabled = true;
            mergeButton.textContent = 'Merge Selected Trades';
        }
        return;
    }

    const dateFormatter = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' });

    container.innerHTML = reviewTrades.map((trade: AnyRecord) => {
        const isChecked = this.importMergeSelection.has(trade.id);
        const legsCount = Array.isArray(trade.legs) ? trade.legs.length : 0;
        const rawDate = trade.openedDate || trade.entryDate || '';
        const parsedDate = rawDate ? new Date(rawDate) : null;
        const dateLabel = parsedDate && !Number.isNaN(parsedDate.getTime()) ? dateFormatter.format(parsedDate) : '—';
        let notePreview = (trade.notes || '').trim();
        if (notePreview.length > 140) {
            notePreview = `${notePreview.slice(0, 137)}…`;
        }
        const batchLabel = trade.importBatchId ? `Batch ${trade.importBatchId}` : 'Manual Review';
        const cardClasses = ['import-merge-card'];
        if (isChecked) {
            cardClasses.push('is-selected');
        }

        return `
            <div class="${cardClasses.join(' ')}" data-trade-id="${this.escapeHTML(trade.id)}">
                <label class="import-merge-card__label">
                    <input type="checkbox" value="${this.escapeHTML(trade.id)}" ${isChecked ? 'checked' : ''} />
                    <div class="import-merge-card__content">
                        <div class="import-merge-card__header">
                            <span class="import-merge-card__ticker">${this.escapeHTML(trade.ticker || '—')}</span>
                            <span class="import-merge-card__legs">${legsCount} leg${legsCount === 1 ? '' : 's'}</span>
                        </div>
                        <div class="import-merge-card__meta">
                            <span>${this.escapeHTML(batchLabel)}</span>
                            <span>${this.escapeHTML(dateLabel)}</span>
                        </div>
                        ${notePreview ? `<p class="import-merge-card__notes">${this.escapeHTML(notePreview)}</p>` : ''}
                    </div>
                </label>
            </div>
        `;
    }).join('');

    container.querySelectorAll('input[type="checkbox"]').forEach((input) => {
        input.addEventListener('change', (event) => {
            const checkbox = event.target as HTMLInputElement;
            const value = checkbox.value;
            if (!value) {
                return;
            }
            if (checkbox.checked) {
                this.importMergeSelection.add(value);
            } else {
                this.importMergeSelection.delete(value);
            }
            const card = checkbox.closest('.import-merge-card');
            if (card) {
                card.classList.toggle('is-selected', checkbox.checked);
            }
            this.updateImportMergeButtonState();
        });
    });

    this.updateImportMergeButtonState();
}

export function updateImportMergeButtonState(this: any) {
    const mergeButton = document.getElementById('import-merge-btn');
    if (!mergeButton) {
        return;
    }

    const count = this.importMergeSelection.size;
    (mergeButton as HTMLButtonElement).disabled = count < 2;
    mergeButton.textContent = count >= 2
        ? `Merge ${count} Trades`
        : 'Merge Selected Trades';
}

export function resolveMergedExitReason(this: any, trades: AnyRecord[] = []) {
    const reasons = Array.isArray(trades)
        ? trades
            .map((trade) => (trade?.exitReason || '').toString().trim())
            .filter(Boolean)
        : [];

    if (reasons.length === 0) {
        return '';
    }

    const uniqueReasons = Array.from(new Set(reasons));
    if (uniqueReasons.length === 1) {
        return uniqueReasons[0];
    }

    return `${uniqueReasons[0]} (+${uniqueReasons.length - 1} more)`;
}

export function buildMergedTradeNote(this: any, trades: AnyRecord[] = [], prefix = '') {
    const timestamp = new Date();
    const safePrefix = (prefix || '').toString().trim().replace(/\.*$/, '');
    const prefixText = safePrefix ? `${safePrefix}. ` : '';
    const count = Array.isArray(trades) ? trades.length : 0;
    const dateLabel = timestamp.toLocaleDateString('en-US', { dateStyle: 'medium' });
    const timeLabel = timestamp.toLocaleTimeString('en-US', { timeStyle: 'short' });
    const header = `${prefixText}Merged ${count} trade${count === 1 ? '' : 's'} on ${dateLabel} at ${timeLabel}.`;
    const idLine = `Source trades: ${trades.map((trade) => trade.id).join(', ')}.`;
    const priorNotes = trades
        .map((trade) => (trade.notes || '').trim())
        .filter(Boolean);

    if (!priorNotes.length) {
        return `${header} ${idLine}`;
    }

    return `${header} ${idLine}\n\n${priorNotes.join('\n\n')}`;
}

export function createMergedTradeFromTrades(this: any, trades: AnyRecord[] = [], options: AnyRecord = {}) {
    const candidates: AnyRecord[] = Array.isArray(trades)
        ? trades.filter((trade: AnyRecord) => trade && Array.isArray(trade.legs) && trade.legs.length > 0)
        : [];

    if (candidates.length < 2) {
        throw new Error('At least two trades with legs are required to merge.');
    }

    const tickerSet = new Set(
        candidates
            .map((trade: AnyRecord) => ((trade.ticker as string) || '').toUpperCase())
            .filter(Boolean)
    );

    if (tickerSet.size > 1) {
        throw new Error('Trades must share the same ticker before merging.');
    }

    const mergedLegs: AnyRecord[] = [];
    let batchId = typeof options.batchId === 'string' ? options.batchId : null;

    candidates.forEach((trade: AnyRecord) => {
        if (!batchId && trade.importBatchId) {
            batchId = trade.importBatchId as string;
        }
        ((trade.legs as AnyRecord[]) || []).forEach((leg: AnyRecord, index: number) => {
            if (!leg) {
                return;
            }
            const clone = { ...(leg as Record<string, unknown>) };
            if (!clone.id) {
                clone.id = `LEG-${trade.id}-${index}`;
            }
            if (batchId && !clone.importBatchId) {
                clone.importBatchId = batchId;
            }
            mergedLegs.push(clone);
        });
    });

    if (!mergedLegs.length) {
        throw new Error('No legs were found to merge.');
    }

    const idPrefix = options.idPrefix || 'MERGED';
    const mergedId = `${idPrefix}-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
    const baseTrade = (options.baseTrade || candidates[0]) as AnyRecord;
    const ticker = tickerSet.size ? Array.from(tickerSet)[0] : 'UNKNOWN';

    const strategyOverride = options.strategyOverride && options.strategyOverride.toString().trim();
    const strategyCandidates = candidates
        .map((trade: AnyRecord) => (trade.strategy || '').toString().trim())
        .filter(Boolean);
    const preferredStrategy = strategyCandidates.find((value: string) => value && value !== 'Import Review' && value !== 'Imported Multi-Leg');
    const fallbackStrategy = strategyCandidates[0] || 'Imported Multi-Leg';
    const strategy = strategyOverride || preferredStrategy || fallbackStrategy;

    const normalizedUnderlying = this.normalizeUnderlyingType(baseTrade?.underlyingType as string, { fallback: 'Stock' });
    const manualStatus = this.normalizeTradeStatusInput(baseTrade?.statusOverride as string);

    const mergedTrade = this.enrichTradeData({
        id: mergedId,
        ticker,
        strategy,
        status: (baseTrade?.status as string) || 'Open',
        statusOverride: manualStatus || null,
        notes: this.buildMergedTradeNote(candidates, options.notePrefix || ''),
        legs: mergedLegs,
        importBatchId: batchId || null,
        importReview: false,
        exitReason: options.exitReasonOverride || this.resolveMergedExitReason(candidates),
        underlyingType: normalizedUnderlying
    });

    return mergedTrade;
}

export function mergeSelectedImportTrades(this: any) {
    const selectedIds = Array.from(this.importMergeSelection) as string[];
    if (selectedIds.length < 2) {
        this.showNotification('Select at least two review trades to merge.', 'info');
        return;
    }

    const tradesToMerge = selectedIds
        .map((id: string) => this.trades.find((trade: AnyRecord) => trade.id === id))
        .filter((trade: AnyRecord | undefined): trade is AnyRecord => Boolean(trade));

    if (tradesToMerge.length < 2) {
        this.showNotification('Unable to locate all selected trades. Refresh the list and try again.', 'error');
        this.refreshImportMergeList();
        return;
    }

    let mergedTrade;
    try {
        mergedTrade = this.createMergedTradeFromTrades(tradesToMerge, {
            idPrefix: 'IMP-MERGED',
            notePrefix: 'Import review merge'
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.showNotification(message, 'error');
        return;
    }

    const removalSet = new Set(tradesToMerge.map((trade: AnyRecord) => trade.id));
    this.trades = this.trades.filter((trade: AnyRecord) => !removalSet.has(trade.id));
    this.trades.push(mergedTrade);

    if (this.importSummary) {
        this.importSummary.mergedTrades = (this.importSummary.mergedTrades || 0) + 1;
        if (Array.isArray(this.importSummary.reviewTradeIds)) {
            this.importSummary.reviewTradeIds = this.importSummary.reviewTradeIds.filter((id: string) => !removalSet.has(id));
        }
    }

    this.importMergeSelection.clear();
    tradesToMerge.forEach((trade: AnyRecord) => this.tradeMergeSelection.delete(trade.id));
    this.saveToStorage({ fileName: this.currentFileName });
    this.markUnsavedChanges();
    this.updateDashboard();
    if (typeof this.updateTradesList === 'function') {
        this.updateTradesList();
    }

    const ticker = mergedTrade.ticker || 'Trade';
    this.appendImportLog({
        type: 'success',
        message: `Merged ${tradesToMerge.length} review trades into a ${mergedTrade.legsCount}-leg trade for ${ticker}.`,
        timestamp: new Date()
    });
    this.showNotification('Review trades merged into a single multi-leg trade.', 'success');

    this.renderImportSummary();
    this.refreshImportMergeList();
this.refreshTradesMergePanelContents();
}

export function mergeSelectedTradesFromList(this: any) {
    const selectedIds = Array.from(this.tradeMergeSelection) as string[];
    if (selectedIds.length < 2) {
        this.showNotification('Select at least two trades to merge.', 'info');
        return;
    }

    const tradesToMerge = selectedIds
        .map((id: string) => this.trades.find((trade: AnyRecord) => trade.id === id))
        .filter((trade: AnyRecord | undefined): trade is AnyRecord => Boolean(trade));

    if (tradesToMerge.length < 2) {
        this.showNotification('Unable to locate all selected trades. Refresh the table and try again.', 'error');
        this.pruneTradeMergeSelection();
        return;
    }

    const tickerSet = new Set(
        tradesToMerge
            .map((trade) => (trade.ticker || '').toUpperCase())
            .filter(Boolean)
    );

    if (tickerSet.size !== 1) {
        this.showNotification('Trades must share the same ticker before merging.', 'error');
        return;
    }

    const ticker = Array.from(tickerSet)[0];
    const totalLegs = tradesToMerge.reduce((acc: number, trade: AnyRecord) => acc + ((trade.legs || []).length || 0), 0);
    const statuses = Array.from(new Set(tradesToMerge.map((trade: AnyRecord) => this.getDisplayStatus(trade)))).filter(Boolean);
    const entryDates = tradesToMerge
        .map((trade: AnyRecord) => this.parseDateValue(trade.openedDate || trade.entryDate))
        .filter((date: unknown): date is Date => date instanceof Date && !Number.isNaN(date.getTime()))
        .sort((a: Date, b: Date) => a.getTime() - b.getTime());
const dateFormatter = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' });
    const entryRange = entryDates.length
        ? `${dateFormatter.format(entryDates[0])} - ${dateFormatter.format(entryDates[entryDates.length - 1])}`
        : 'N/A';
    const netOpenContracts = tradesToMerge.reduce((acc: number, trade: AnyRecord) => acc + Math.max(0, Number(trade.openContracts) || 0), 0);

    const confirmMessage = [
        `Merge ${tradesToMerge.length} trades for ${ticker}?`,
        `Total legs: ${totalLegs}`,
        `Status mix: ${statuses.join(', ') || 'N/A'}`,
        `Entry range: ${entryRange}`,
        `Open contracts (net): ${netOpenContracts}`,
        'The original trades will be replaced by a single multi-leg trade.',
        'Continue?'
    ].join('\n');

    if (!window.confirm(confirmMessage)) {
        return;
    }

    let mergedTrade;
    try {
        mergedTrade = this.createMergedTradeFromTrades(tradesToMerge, {
            idPrefix: 'MANUAL-MERGED',
            notePrefix: 'Manual merge'
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.showNotification(message, 'error');
        return;
    }

    const removalSet = new Set(tradesToMerge.map((trade: AnyRecord) => trade.id));
    this.trades = this.trades.filter((trade: AnyRecord) => !removalSet.has(trade.id));
    this.trades.push(mergedTrade);

    if (this.importSummary) {
        this.importSummary.mergedTrades = (this.importSummary.mergedTrades || 0) + 1;
    }

    this.tradeMergeSelection.clear();
    this.saveToStorage({ fileName: this.currentFileName });
    this.markUnsavedChanges();
    this.filterTrades();
    this.updateDashboard();
    this.renderImportSummary();
    this.refreshImportMergeList();

    this.appendImportLog({
        type: 'success',
        message: `Merged ${tradesToMerge.length} trades into a ${mergedTrade.legsCount}-leg trade for ${mergedTrade.ticker}.`,
        timestamp: new Date()
    });
    this.showNotification(`Merged ${tradesToMerge.length} trades for ${mergedTrade.ticker}.`, 'success');
}

export function renderTradeMergeSelectionSummary(this: any) {
    const summary = document.getElementById('trades-merge-summary');
    if (!summary) {
        return;
    }

    const selectedIds = Array.from(this.tradeMergeSelection) as string[];
    if (!selectedIds.length) {
        summary.textContent = 'Select two or more trades with the same ticker to enable merging.';
        return;
    }

    const selectedTrades = selectedIds
        .map((id: string) => this.trades.find((trade: AnyRecord) => trade.id === id))
        .filter((trade: AnyRecord | undefined): trade is AnyRecord => Boolean(trade));

    if (!selectedTrades.length) {
        this.tradeMergeSelection.clear();
        summary.textContent = 'Select two or more trades with the same ticker to enable merging.';
        return;
    }

    const tickers = Array.from(new Set(selectedTrades.map((trade: AnyRecord) => (trade.ticker || '').toUpperCase()).filter(Boolean)));
    const totalLegs = selectedTrades.reduce((acc: number, trade: AnyRecord) => acc + ((trade.legs || []).length || 0), 0);
    const statuses = Array.from(new Set(selectedTrades.map((trade: AnyRecord) => this.getDisplayStatus(trade)))).filter(Boolean);
    const parts = [
        `<strong>${this.escapeHTML(`${selectedTrades.length} trade${selectedTrades.length === 1 ? '' : 's'} selected`)}</strong>`,
        tickers.length ? `<span>${this.escapeHTML(tickers.length === 1 ? `Ticker: ${tickers[0]}` : `Tickers: ${tickers.join(', ')}`)}</span>` : '',
        `<span>${this.escapeHTML(`Total legs: ${totalLegs}`)}</span>`,
        statuses.length ? `<span>${this.escapeHTML(`Status mix: ${statuses.join(', ')}`)}</span>` : ''
    ];

    if (tickers.length > 1) {
        parts.push(`<span>${this.escapeHTML('Different tickers selected - merge disabled')}</span>`);
    }

    summary.innerHTML = parts.filter(Boolean).join(' ');
}

export function renderTradeMergeGroups(this: any, trades: AnyRecord[] = this.currentFilteredTrades) {
    const container = document.getElementById('trades-merge-groups');
    if (!container) {
        return;
    }

    const list: AnyRecord[] = Array.isArray(trades) ? trades : [];
    const grouped = list.reduce((acc: Map<string, AnyRecord[]>, trade: AnyRecord) => {
        const ticker = (trade.ticker || '').toUpperCase();
        if (!ticker) {
            return acc;
        }
        if (!acc.has(ticker)) {
            acc.set(ticker, []);
        }
        acc.get(ticker)!.push(trade);
        return acc;
    }, new Map());

    const eligible = Array.from(grouped.entries())
        .filter(([, tradesForTicker]) => tradesForTicker.length >= 2)
        .sort(([a], [b]) => a.localeCompare(b));

    if (!eligible.length) {
        container.innerHTML = '<p class="trades-merge-groups__empty">Need at least two trades sharing a ticker to merge.</p>';
        return;
    }

    container.innerHTML = eligible.map(([ticker, tradesForTicker]) => {
        const selectedCount = tradesForTicker.filter((trade: AnyRecord) => this.tradeMergeSelection.has(trade.id)).length;
        const statuses = Array.from(new Set(tradesForTicker.map((trade: AnyRecord) => this.getDisplayStatus(trade)))).filter(Boolean);
        const legCount = tradesForTicker.reduce((acc: number, trade: AnyRecord) => acc + ((trade.legs || []).length || 0), 0);
        const allSelected = selectedCount === tradesForTicker.length;
        const remaining = tradesForTicker.length - selectedCount;
        const buttonLabel = allSelected
            ? `Clear ${ticker} selection`
            : remaining === tradesForTicker.length
                ? `Select ${tradesForTicker.length} trades`
                : `Select remaining (${remaining})`;

        return `
            <div class="trades-merge-group" data-ticker="${this.escapeHTML(ticker)}">
                <div class="trades-merge-group__header">
                    <span class="trades-merge-group__ticker">${this.escapeHTML(ticker)}</span>
                    <span class="trades-merge-group__count">${this.escapeHTML(`${tradesForTicker.length} trades • ${legCount} legs`)}</span>
                </div>
                <div class="trades-merge-group__body">
                    ${statuses.length ? `<span>Statuses: ${this.escapeHTML(statuses.join(', '))}</span>` : ''}
                    <span>Selected: ${this.escapeHTML(`${selectedCount}/${tradesForTicker.length}`)}</span>
                </div>
                <div class="trades-merge-group__actions">
                    <button type="button" class="btn btn--sm btn--secondary trades-merge-group__toggle" data-ticker="${this.escapeHTML(ticker)}">${this.escapeHTML(buttonLabel)}</button>
                </div>
            </div>
        `;
    }).join('');

    container.querySelectorAll('.trades-merge-group__toggle').forEach((button) => {
        button.addEventListener('click', (event) => {
            event.preventDefault();
            const ticker = (button.getAttribute('data-ticker') || '').toUpperCase();
            if (!ticker) {
                return;
            }
            const tradesForTicker = (Array.isArray(this.currentFilteredTrades) ? this.currentFilteredTrades : [])
                .filter((trade: AnyRecord) => (trade.ticker || '').toUpperCase() === ticker);
            if (!tradesForTicker.length) {
                return;
            }
            const allSelected = tradesForTicker.every((trade: AnyRecord) => this.tradeMergeSelection.has(trade.id));
            tradesForTicker.forEach((trade: AnyRecord) => {
                if (allSelected) {
                    this.tradeMergeSelection.delete(trade.id);
                } else {
                    this.tradeMergeSelection.add(trade.id);
                }
            });
            this.syncTradeSelectionCheckboxes();
            this.refreshTradesMergePanelContents();
        });
    });
}

export function updateTradesMergeButtonState(this: any) {
    const mergeButton = document.getElementById('trades-merge-btn') as HTMLButtonElement | null;
    if (!mergeButton) {
        return;
    }

    if (!this.tradesMergePanelOpen) {
        mergeButton.disabled = true;
        mergeButton.textContent = 'Merge Selected Trades';
        mergeButton.title = 'Enable the merge panel to review trade combinations.';
        return;
    }

    const selectedTrades = Array.from(this.tradeMergeSelection)
        .map((id: unknown) => this.trades.find((trade: AnyRecord) => trade.id === id))
        .filter((trade: AnyRecord | undefined): trade is AnyRecord => Boolean(trade));

    if (selectedTrades.length < 2) {
        mergeButton.disabled = true;
        mergeButton.textContent = 'Merge Selected Trades';
        mergeButton.title = 'Select at least two trades to merge.';
        return;
    }

    const tickers = new Set(selectedTrades.map((trade: AnyRecord) => (trade.ticker || '').toString().toUpperCase()).filter(Boolean));
    if (tickers.size !== 1) {
        mergeButton.disabled = true;
        mergeButton.textContent = 'Merge Selected Trades';
        mergeButton.title = 'Select trades that share the same ticker.';
        return;
    }

    mergeButton.disabled = false;
    mergeButton.textContent = `Merge ${selectedTrades.length} Trades`;
    mergeButton.title = `Merge ${selectedTrades.length} trades for ${Array.from(tickers)[0]}.`;
}

export function pruneTradeMergeSelection(this: any) {
    if (!(this.tradeMergeSelection instanceof Set) || this.tradeMergeSelection.size === 0) {
        return;
    }

    const existingIds = new Set(this.trades.map((trade: AnyRecord) => trade.id));
    let changed = false;
    this.tradeMergeSelection.forEach((id: string) => {
        if (!existingIds.has(id)) {
            this.tradeMergeSelection.delete(id);
            changed = true;
        }
    });

    if (changed) {
        this.syncTradeSelectionCheckboxes();
        this.refreshTradesMergePanelContents();
    }
}
