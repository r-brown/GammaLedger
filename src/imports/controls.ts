// src/imports/controls.js — Wave 7: Import UI controls setup.
// Uses the .call(this, …) delegation pattern.

export function setupImportControls() {
    if (this.importControlsInitialized) {
        return;
    }

    const ofxButton = document.getElementById('import-ofx-btn');
    const ofxInput = document.getElementById('import-ofx-input') as HTMLInputElement | null;

    if (ofxButton && ofxInput) {
        ofxButton.addEventListener('click', (event) => {
            event.preventDefault();
            ofxInput.value = '';
            ofxInput.click();
        });

        ofxInput.addEventListener('change', (event) => {
            this.handleOfxFileSelection(event);
        });
    }

    const robinhoodButton = document.getElementById('import-robinhood-btn');
    const robinhoodInput = document.getElementById('import-robinhood-input') as HTMLInputElement | null;

    if (robinhoodButton && robinhoodInput) {
        robinhoodButton.addEventListener('click', (event) => {
            event.preventDefault();
            robinhoodInput.value = '';
            robinhoodInput.click();
        });

        robinhoodInput.addEventListener('change', (event) => {
            this.handleRobinhoodCsvFileSelection(event);
        });
    }

    const mergeButton = document.getElementById('import-merge-btn');
    if (mergeButton) {
        mergeButton.addEventListener('click', (event) => {
            event.preventDefault();
            this.mergeSelectedImportTrades();
        });
    }

    const mergeHintButton = document.getElementById('import-merge-hint-btn');
    if (mergeHintButton) {
        mergeHintButton.addEventListener('click', (event) => {
            event.preventDefault();
            this.showView('trades-list');
            this.setupTradesMergeControls();
            this.toggleTradesMergePanel(true);
        });
    }

    // Drag-and-drop support
    const dropzone = document.getElementById('import-dropzone');
    if (dropzone) {
        ['dragenter', 'dragover'].forEach((evt) => {
            dropzone.addEventListener(evt, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropzone.classList.add('is-drag-over');
            });
        });
        ['dragleave', 'drop'].forEach((evt) => {
            dropzone.addEventListener(evt, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropzone.classList.remove('is-drag-over');
            });
        });
        dropzone.addEventListener('drop', (e) => {
            const files = e.dataTransfer?.files;
            if (!files || files.length === 0) return;
            const file = files[0];
            const name = (file.name || '').toLowerCase();
            if (name.endsWith('.ofx') || name.endsWith('.qfx')) {
                // Trigger the OFX import path
                const dt = new DataTransfer();
                dt.items.add(file);
                if (ofxInput) {
                    ofxInput.files = dt.files;
                    ofxInput.dispatchEvent(new Event('change', { bubbles: true }));
                }
            } else if (name.endsWith('.csv')) {
                // Trigger the Robinhood CSV import path
                const dt = new DataTransfer();
                dt.items.add(file);
                if (robinhoodInput) {
                    robinhoodInput.files = dt.files;
                    robinhoodInput.dispatchEvent(new Event('change', { bubbles: true }));
                }
            } else {
                this.showNotification('Unsupported file type. Please use OFX, QFX, or CSV files.', 'error');
            }
        });
    }

    this.renderImportSummary();
    this.refreshImportMergeList();
    this.importControlsInitialized = true;
}

export async function handleOfxFileSelection(event) {
    const input = event?.target;
    if (!input || !input.files || input.files.length === 0) {
        return;
    }

    const [file] = input.files;
    input.value = '';

    if (!file) {
        return;
    }

    try {
        this.showLoadingIndicator('Importing OFX...');
        await this.importOfxFile(file, { fileName: file.name || 'OFX import' });
    } catch (error) {
        console.error('OFX import error:', error);
        const message = error?.message || 'Unknown error';
        this.showNotification(`Failed to import OFX: ${message}`, 'error');
        this.appendImportLog({
            type: 'error',
            message: `Failed to import ${file.name || 'OFX file'}: ${message}`,
            timestamp: new Date()
        });
    } finally {
        this.hideLoadingIndicator();
    }
}

export async function importOfxFile(file, context = {}) {
    if (!file) {
        throw new Error('No file selected.');
    }

    const text = await file.text();
    await this.importOfxContent(text, { ...context, fileSize: file.size || 0 });
}

export async function importOfxContent(raw: string, context: Record<string, unknown> = {}) {
    const batchId = (context.batchId as string) || `OFX-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const importContext = { ...context, batchId };
    const parsed = this.parseOfx(raw);
    const importResult = this.buildOfxImportPayload(parsed, importContext);
    this.applyOfxImportResult(importResult, importContext);
}

export async function importRobinhoodCsvFile(file, context = {}) {
    if (!file) {
        throw new Error('No file selected.');
    }

    this.showLoadingIndicator('Importing Robinhood CSV...');
    const text = await file.text();
    await this.importRobinhoodCsvContent(text, { ...context, fileSize: file.size || 0 });
}

export async function importRobinhoodCsvContent(raw: string, context: Record<string, unknown> = {}) {
    const batchId = (context.batchId as string) || `RH-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const importContext = { ...context, batchId };
    const parsed = this.parseRobinhoodCsv(raw);
    const importResult = this.buildRobinhoodImportPayload(parsed, importContext);
    this.applyRobinhoodImportResult(importResult, importContext);
}

export function setupTradesMergeControls() {
    const panel = document.getElementById('trades-merge-panel');
    if (!panel) {
        return;
    }

    if (!this.tradesMergeInitialized) {
        const mergeButton = document.getElementById('trades-merge-btn');
        if (mergeButton) {
            mergeButton.addEventListener('click', (event) => {
                event.preventDefault();
                this.mergeSelectedTradesFromList();
            });
        }

        const selectAll = document.getElementById('trades-select-all') as HTMLInputElement | null;
        if (selectAll) {
            selectAll.addEventListener('change', (event) => {
                this.handleSelectAllTrades(Boolean((event.target as HTMLInputElement).checked));
            });
        }

        const toggleButton = document.getElementById('trades-merge-toggle');
        if (toggleButton) {
            toggleButton.addEventListener('click', (event) => {
                event.preventDefault();
                this.toggleTradesMergePanel();
            });
        }

        panel.classList.add('is-collapsed');
        panel.setAttribute('aria-hidden', 'true');
        this.tradesMergePanelOpen = false;
        this.tradesMergeInitialized = true;
    }

    this.updateTradesMergeToggleLabel();
    this.updateMergeColumnVisibility();
    this.syncSelectAllCheckbox();
    this.refreshTradesMergePanelContents();
}

export function toggleTradesMergePanel(forceOpen = null) {
    const targetState = typeof forceOpen === 'boolean'
        ? forceOpen
        : !this.tradesMergePanelOpen;

    this.tradesMergePanelOpen = targetState;

    const panel = document.getElementById('trades-merge-panel');
    if (panel) {
        panel.classList.toggle('is-collapsed', !targetState);
        panel.setAttribute('aria-hidden', String(!targetState));
    }

    this.updateTradesMergeToggleLabel();
    this.updateMergeColumnVisibility();
    this.syncSelectAllCheckbox();
    this.refreshTradesMergePanelContents();
}

export function updateTradesMergeToggleLabel() {
    const toggleButton = document.getElementById('trades-merge-toggle');
    if (!toggleButton) {
        return;
    }

    const expanded = Boolean(this.tradesMergePanelOpen);
    toggleButton.textContent = expanded ? 'Hide Merge Trades' : 'Merge Trades';
    toggleButton.setAttribute('aria-expanded', String(expanded));
    toggleButton.classList.toggle('is-active', expanded);
}

export function updateMergeColumnVisibility() {
    const hidden = !this.tradesMergePanelOpen;
    const headerCell = document.querySelector('.trade-select-header');
    if (headerCell) {
        headerCell.classList.toggle('is-hidden', hidden);
        headerCell.setAttribute('aria-hidden', String(hidden));
    }

    const selectAll = document.getElementById('trades-select-all') as HTMLInputElement | null;
    if (selectAll) {
        if (hidden) {
            selectAll.checked = false;
            selectAll.indeterminate = false;
        }
        selectAll.disabled = hidden;
    }

    document.querySelectorAll('.trade-select-cell').forEach((cell) => {
        cell.classList.toggle('is-hidden', hidden);
    });

    document.querySelectorAll('.trade-merge-checkbox').forEach((checkbox) => {
        (checkbox as HTMLInputElement).disabled = hidden;
        (checkbox as HTMLInputElement).tabIndex = hidden ? -1 : 0;
    });
}

export function refreshTradesMergePanelContents() {
    const summary = document.getElementById('trades-merge-summary');
    const groupsContainer = document.getElementById('trades-merge-groups');
    const mergeButton = document.getElementById('trades-merge-btn');

    if (!this.tradesMergePanelOpen) {
        if (summary) {
            summary.textContent = 'Select "Merge Trades" to analyze possible combinations grouped by ticker.';
        }
        if (groupsContainer) {
            groupsContainer.innerHTML = '<p class="trades-merge-groups__empty">Enable the merge panel to review grouped trades.</p>';
        }
    if (mergeButton) {
        (mergeButton as HTMLButtonElement).disabled = true;
        mergeButton.textContent = 'Merge Selected Trades';
        (mergeButton as HTMLButtonElement).title = 'Enable the merge panel to review trade combinations.';
        }
        return;
    }

    if (mergeButton) {
        mergeButton.title = 'Merge selected trades that share a ticker.';
    }

    this.renderTradeMergeSelectionSummary();
    this.renderTradeMergeGroups(this.currentFilteredTrades);
    this.updateTradesMergeButtonState();
}

export function updateImportSummary(details: Record<string, unknown> = {}) {
    const timestamp = details.timestamp instanceof Date
        ? details.timestamp as Date
        : new Date((details.timestamp as string | number | undefined) || Date.now());

    const summary = {
        timestamp,
        fileName: (details.fileName as string) || 'Broker import',
        batchId: (details.batchId as string | null) || null,
        stats: { ...((details.stats as Record<string, unknown>) || {}) },
        reviewTradeIds: Array.isArray(details.reviewTradeIds)
            ? (details.reviewTradeIds as string[]).slice()
            : [],
        mergedTrades: Number.isFinite(details.mergedTrades) ? Number(details.mergedTrades) : 0
    };

    this.importSummary = summary;
    this.importMergeSelection.clear();
}

export function countImportReviewTrades(batchId = null) {
    return this.trades.filter((trade) => {
        if (!trade?.importReview) {
            return false;
        }
        if (batchId && trade.importBatchId !== batchId) {
            return false;
        }
        return true;
    }).length;
}

export function getImportReviewTrades() {
    return this.trades
        .filter((trade) => trade?.importReview)
        .slice()
        .sort((a, b) => {
            const aDate = new Date(a.openedDate || a.entryDate || 0).getTime();
            const bDate = new Date(b.openedDate || b.entryDate || 0).getTime();
            return bDate - aDate;
        });
}

export function syncTradeSelectionCheckboxes() {
    document.querySelectorAll<HTMLInputElement>('.trade-merge-checkbox').forEach((checkbox) => {
        const id = (checkbox as HTMLElement).dataset.tradeId;
        checkbox.checked = !!id && this.tradeMergeSelection.has(id);
    });
    this.syncSelectAllCheckbox();
}

export function syncSelectAllCheckbox() {
    const selectAll = document.getElementById('trades-select-all') as HTMLInputElement | null;
    if (!selectAll) {
        return;
    }

    const checkboxes = Array.from(document.querySelectorAll<HTMLInputElement>('.trade-merge-checkbox'));
    const mergeEnabled = this.tradesMergePanelOpen && checkboxes.length;

    if (!mergeEnabled) {
        selectAll.checked = false;
        selectAll.indeterminate = false;
        selectAll.disabled = true;
        return;
    }

    selectAll.disabled = false;

    const selectedVisible = checkboxes.filter((checkbox) => {
        const id = (checkbox as HTMLElement).dataset.tradeId;
        return id && this.tradeMergeSelection.has(id);
    }).length;

    if (selectedVisible === 0) {
        selectAll.checked = false;
        selectAll.indeterminate = false;
    } else if (selectedVisible === checkboxes.length) {
        selectAll.checked = true;
        selectAll.indeterminate = false;
    } else {
        selectAll.checked = false;
        selectAll.indeterminate = true;
    }
}

export function handleSelectAllTrades(checked: boolean) {
    if (!this.tradesMergePanelOpen) {
        return;
    }

    const checkboxes = Array.from(document.querySelectorAll<HTMLInputElement>('.trade-merge-checkbox'));
    if (!checkboxes.length) {
        return;
    }

    checkboxes.forEach((checkbox) => {
        const id = (checkbox as HTMLElement).dataset.tradeId;
        if (!id) {
            return;
        }
        if (checked) {
            this.tradeMergeSelection.add(id);
        } else {
            this.tradeMergeSelection.delete(id);
        }
        checkbox.checked = checked;
    });

    this.syncSelectAllCheckbox();
    this.refreshTradesMergePanelContents();
}
