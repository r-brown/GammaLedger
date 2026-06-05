// src/ai/chat.ts — Wave 10: AI chat UI panel.
// Uses the .call(this, …) delegation pattern.

import type { GeminiDraftLegExtraction } from './gemini-agent.js'

interface ChatMessage {
    id: string
    sender: 'ai' | 'user'
    text: string
    timestamp: Date
    pending: boolean
}

interface AIAgent {
    updateContext(ctx: Record<string, unknown>): void
    getGreeting(): string
    generateResponse(query: string, options?: Record<string, unknown>): Promise<string> | string
    extractDraftLegsFromImage?(input: {
        mimeType: string
        data: string
        metadata?: Record<string, unknown>
    }): Promise<GeminiDraftLegExtraction>
}

interface AIChatContext {
    aiAgent: AIAgent | null
    aiChatMessages: ChatMessage[]
    aiChatSessionId: number | null
    aiChatPendingRequest: boolean | Promise<unknown> | null
    aiChatOpen: boolean
    aiDraftImport: AIDraftImportState | null
    trades: Record<string, unknown>[]
    gemini?: { apiKey?: string | null } | null
    renderAIChatMessages(): void
    appendAIChatMessage(sender: string, text: string, options?: Record<string, unknown>): string | null
    calculateAdvancedStats(): Record<string, unknown>
    hasAICoachConsent(): boolean
    promptAICoachConsent(callback: () => void): void
    handleAIChatSubmit(): Promise<void>
    handleAIQuickPrompt(prompt: string, options?: { promptType?: string | null; [key: string]: unknown }): Promise<void>
    toggleAIChat(forceOpen?: boolean | null): void
    getGeminiChatDisplayName(): string
    renderMarkdownToHTML(text: string): string
    updateAIChatHeader(): void
    updateActivePositionsTable(): void
    setupAIChatDraftImport(): void
    handleAIChatImageFile(file: File): Promise<void>
    extractAIDraftLegsFromScreenshot(): Promise<void>
    clearAIDraftImport(): void
    renderAIDraftImport(): void
    importAIDraftTrades(): void
    resetAddTradeForm(): void
    renderLegForms(legs?: unknown[]): void
    showView(viewName: string): void
    updateTickerPreview(ticker: string): void
    inferStrategyFromLegs?(legs?: unknown[]): string
    normalizeLegOrderType(orderType: unknown): string
    normalizeLegType(type: unknown): string
    getDefaultMultiplierForLegType(legType: string, underlyingType?: string): number
    showNotification(msg: string, type: string): void
    escapeHTML(value: unknown): string
    enrichTradeData(trade: Record<string, unknown>): Record<string, unknown>
    saveToStorage(metadata?: Record<string, unknown>): void
    markUnsavedChanges(): void
    updateDashboard(): void
    updateImportSummary(details: Record<string, unknown>): void
    appendImportLog(entry?: Record<string, unknown>): void
    refreshImportMergeList(): void
    renderImportSummary(): void
}

interface PreparedScreenshotImage {
    mimeType: string
    data: string
    dataUrl: string
    width: number | null
    height: number | null
    sizeBytes: number
    wasResized: boolean
}

interface AIDraftImportState {
    status: 'empty' | 'ready' | 'extracting' | 'review' | 'error'
    fileName: string
    image: PreparedScreenshotImage | null
    extraction: GeminiDraftLegExtraction | null
    error: string | null
}

interface SanitizedDraftRow {
    underlying: string
    orderType: string
    type: string
    quantity: number | ''
    executionDate: string
    expirationDate: string
    strike: number | ''
    premium: number | ''
    fees: number | ''
    confidence: number
    fieldConfidence: Record<string, number>
    needsUserReview: boolean
    warnings: string[]
    rawText: string
}

const MAX_SCREENSHOT_BYTES = 10 * 1024 * 1024;
const MAX_SCREENSHOT_DIMENSION = 1600;
const SUPPORTED_SCREENSHOT_TYPES = new Set([
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/heic',
    'image/heif'
]);

function dataUrlToBase64(dataUrl: string): string {
    const commaIndex = dataUrl.indexOf(',');
    return commaIndex === -1 ? dataUrl : dataUrl.slice(commaIndex + 1);
}

function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error || new Error('Could not read screenshot.'));
        reader.readAsDataURL(blob);
    });
}

async function blobToImageDimensions(blob: Blob): Promise<{ width: number | null; height: number | null }> {
    try {
        const bitmap = await createImageBitmap(blob);
        const dimensions = { width: bitmap.width, height: bitmap.height };
        bitmap.close?.();
        return dimensions;
    } catch (_error) {
        return { width: null, height: null };
    }
}

async function preprocessScreenshotFile(file: File): Promise<PreparedScreenshotImage> {
    const mimeType = (file.type || '').toLowerCase();
    if (!SUPPORTED_SCREENSHOT_TYPES.has(mimeType)) {
        throw new Error('Use a PNG, JPEG, WebP, HEIC, or HEIF screenshot.');
    }
    if (file.size > MAX_SCREENSHOT_BYTES) {
        throw new Error('Screenshot is larger than 10 MB. Crop or compress it before sending to Gemini.');
    }

    try {
        const bitmap = await createImageBitmap(file);
        const scale = Math.min(1, MAX_SCREENSHOT_DIMENSION / Math.max(bitmap.width, bitmap.height));
        const targetWidth = Math.max(1, Math.round(bitmap.width * scale));
        const targetHeight = Math.max(1, Math.round(bitmap.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Could not prepare screenshot canvas.');
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
        bitmap.close?.();

        const outputType = mimeType === 'image/jpeg' ? 'image/jpeg' : 'image/png';
        const blob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(
                value => value ? resolve(value) : reject(new Error('Could not encode screenshot.')),
                outputType,
                outputType === 'image/jpeg' ? 0.92 : undefined
            );
        });
        const dataUrl = await blobToDataUrl(blob);
        return {
            mimeType: outputType,
            data: dataUrlToBase64(dataUrl),
            dataUrl,
            width: targetWidth,
            height: targetHeight,
            sizeBytes: blob.size,
            wasResized: scale < 1
        };
    } catch (_error) {
        const dataUrl = await blobToDataUrl(file);
        const dimensions = await blobToImageDimensions(file);
        return {
            mimeType,
            data: dataUrlToBase64(dataUrl),
            dataUrl,
            width: dimensions.width,
            height: dimensions.height,
            sizeBytes: file.size,
            wasResized: false
        };
    }
}

function numberOrEmpty(value: unknown): number | '' {
    if (value === null || value === undefined || value === '') {
        return '';
    }
    const numeric = Number(String(value).replace(/,/g, '.'));
    return Number.isFinite(numeric) ? numeric : '';
}

function textOrEmpty(value: unknown): string {
    return value === null || value === undefined ? '' : String(value).trim();
}

function isoDateOrEmpty(value: unknown): string {
    const text = textOrEmpty(value);
    if (!text) {
        return '';
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
        return text;
    }
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function normalizeDraftOptionAction(value: unknown): string {
    const text = textOrEmpty(value).toUpperCase();
    const aliases: Record<string, string> = {
        BTO: 'BTO',
        STO: 'STO',
        BTC: 'BTC',
        STC: 'STC'
    };
    return aliases[text] || '';
}

function normalizeDraftStockAction(value: unknown): string {
    const text = textOrEmpty(value).toUpperCase();
    if (text === 'BUY') return 'BTO';
    if (text === 'SELL') return 'STC';
    return '';
}

function normalizeDraftType(row: Record<string, unknown>): string {
    const assetType = textOrEmpty(row.assetType).toUpperCase();
    const optionType = textOrEmpty(row.optionType).toUpperCase();
    if (optionType === 'CALL' || optionType === 'PUT') {
        return optionType;
    }
    if (assetType === 'STOCK' || assetType === 'SHARES') {
        return 'STOCK';
    }
    if (assetType === 'CASH') {
        return 'CASH';
    }
    return '';
}

function sanitizeDraftRow(row: Record<string, unknown>): SanitizedDraftRow {
    const warnings = Array.isArray(row.warnings)
        ? row.warnings.filter((warning: unknown): warning is string => typeof warning === 'string' && warning.trim().length > 0)
        : [];
    const type = normalizeDraftType(row);
    const orderType = type === 'STOCK'
        ? normalizeDraftStockAction(row.stockAction)
        : normalizeDraftOptionAction(row.optionAction);
    const confidenceRecord = row.confidence && typeof row.confidence === 'object' && !Array.isArray(row.confidence)
        ? row.confidence as Record<string, unknown>
        : {};
    const confidenceValue = Number(confidenceRecord.row ?? row.confidence);
    const confidence = Number.isFinite(confidenceValue)
        ? Math.min(Math.max(confidenceValue, 0), 1)
        : 0;
    const fieldConfidence = Object.fromEntries(
        Object.entries(confidenceRecord)
            .filter(([, value]) => Number.isFinite(Number(value)))
            .map(([key, value]) => [key, Math.min(Math.max(Number(value), 0), 1)])
    );
    const underlying = textOrEmpty(row.underlying).toUpperCase();
    const lowConfidenceFields = Object.entries(fieldConfidence)
        .filter(([key, value]) => key !== 'row' && value < 0.85)
        .map(([key]) => key);

    if (!underlying) warnings.push('Ticker missing');
    if (!orderType) warnings.push('Action unclear');
    if (!type) warnings.push('Instrument type unclear');
    if (!row.tradeDate) warnings.push('Trade date missing');
    if (lowConfidenceFields.length) warnings.push(`Low confidence fields: ${lowConfidenceFields.join(', ')}`);

    return {
        underlying,
        orderType,
        type,
        quantity: numberOrEmpty(row.quantity),
        executionDate: isoDateOrEmpty(row.tradeDate),
        expirationDate: isoDateOrEmpty(row.expiration),
        strike: numberOrEmpty(row.strike),
        premium: numberOrEmpty(row.price),
        fees: numberOrEmpty(row.fees),
        confidence,
        fieldConfidence,
        needsUserReview: Boolean(row.needsUserReview) || confidence < 0.85 || warnings.length > 0,
        warnings,
        rawText: textOrEmpty(row.rawText)
    };
}

function defaultAIDraftImportState(): AIDraftImportState {
    return {
        status: 'empty',
        fileName: '',
        image: null,
        extraction: null,
        error: null
    };
}

function readDraftRowsFromReview(root: HTMLElement): SanitizedDraftRow[] {
    const rows = Array.from(root.querySelectorAll<HTMLTableRowElement>('tr[data-draft-row]'));
    return rows
        .filter(row => {
            const selected = row.querySelector<HTMLInputElement>('[data-draft-field="selected"]');
            return selected ? selected.checked : true;
        })
        .map(row => {
            const getValue = (field: string): string => {
                const input = row.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-draft-field="${field}"]`);
                return input ? input.value : '';
            };
            const confidence = Number(row.dataset.confidence || '0');
            const warningsText = row.dataset.warnings || '';
            return {
                underlying: getValue('underlying').trim().toUpperCase(),
                orderType: getValue('orderType').trim().toUpperCase(),
                type: getValue('type').trim().toUpperCase(),
                quantity: numberOrEmpty(getValue('quantity')),
                executionDate: isoDateOrEmpty(getValue('executionDate')),
                expirationDate: isoDateOrEmpty(getValue('expirationDate')),
                strike: numberOrEmpty(getValue('strike')),
                premium: numberOrEmpty(getValue('premium')),
                fees: numberOrEmpty(getValue('fees')),
                confidence: Number.isFinite(confidence) ? confidence : 0,
                needsUserReview: row.dataset.needsReview === 'true',
                warnings: warningsText ? warningsText.split('\n').filter(Boolean) : [],
                rawText: row.dataset.rawText || '',
                fieldConfidence: {}
            };
        });
}

function selectHasOption(select: HTMLSelectElement, value: string): boolean {
    return Array.from(select.options).some(option => option.value === value);
}

function inferSingleLegStrategy(rows: SanitizedDraftRow[]): string {
    if (rows.length !== 1) {
        return '';
    }
    const row = rows[0];
    if (row.type === 'PUT' && row.orderType === 'STO') return 'Cash-Secured Put';
    if (row.type === 'PUT' && row.orderType === 'BTO') return 'Long Put';
    if (row.type === 'CALL' && row.orderType === 'BTO') return 'Long Call';
    if (row.type === 'CALL' && row.orderType === 'STO') return 'Short Call';
    if (row.type === 'STOCK') return 'Synthetic Long Stock';
    return '';
}

function resolveDraftStrategy(
    rows: SanitizedDraftRow[],
    legs: Record<string, unknown>[],
    select: HTMLSelectElement,
    inferStrategy?: (legs?: unknown[]) => string
): string {
    const candidates = [
        inferSingleLegStrategy(rows),
        inferStrategy ? inferStrategy(legs) : ''
    ].filter(Boolean);

    for (const candidate of candidates) {
        if (selectHasOption(select, candidate)) {
            return candidate;
        }
    }

    return '';
}

export function setupAIChatResizeHandle(): void {
    const panel = document.getElementById('ai-chat-panel');
    const handle = (document.getElementById('ai-chat-resize-handle') || panel?.querySelector('.ai-chat__resize-handle')) as HTMLElement | null;

    if (!panel || !handle || handle.dataset.initialized === 'true') {
        if (handle) {
            handle.dataset.initialized = 'true';
        }
        return;
    }

    const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

    const state = {
        resizing: false,
        startX: 0,
        startY: 0,
        startWidth: 0,
        startHeight: 0,
        maxWidth: 0,
        maxHeight: 0,
        minWidth: 280,
        minHeight: 280,
        rightMargin: 24,
        bottomMargin: 24,
        viewportPadding: 24
    };

    const stopResizing = (event?: PointerEvent): void => {
        if (!state.resizing) {
            return;
        }

        state.resizing = false;
        panel.classList.remove('ai-chat__panel--resizing');

        if (event) {
            try {
                handle.releasePointerCapture(event.pointerId);
            } catch (_error) {
                // Pointer may already be released; ignore.
            }
        }

        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', stopResizing as EventListener);
        document.removeEventListener('pointercancel', stopResizing as EventListener);
    };

    const onPointerMove = (moveEvent: PointerEvent): void => {
        if (!state.resizing) {
            return;
        }

        moveEvent.preventDefault();

        const deltaX = moveEvent.clientX - state.startX;
        const deltaY = moveEvent.clientY - state.startY;

        const nextWidth = clamp(state.startWidth - deltaX, state.minWidth, state.maxWidth);
        const nextHeight = clamp(state.startHeight - deltaY, state.minHeight, state.maxHeight);

        panel.style.width = `${nextWidth}px`;
        panel.style.height = `${nextHeight}px`;
    };

    handle.addEventListener('pointerdown', (event: PointerEvent) => {
        if (event.button !== 0 && event.pointerType !== 'touch') {
            return;
        }

        event.preventDefault();

        const rect = panel.getBoundingClientRect();

        state.resizing = true;
        state.startX = event.clientX;
        state.startY = event.clientY;
        state.startWidth = rect.width;
        state.startHeight = rect.height;
        state.rightMargin = Math.max(state.viewportPadding, Math.round(window.innerWidth - rect.right));
        state.bottomMargin = Math.max(state.viewportPadding, Math.round(window.innerHeight - rect.bottom));
        state.maxWidth = Math.max(state.minWidth, window.innerWidth - state.rightMargin - state.viewportPadding);
        state.maxHeight = Math.max(state.minHeight, window.innerHeight - state.bottomMargin - state.viewportPadding);

        panel.classList.add('ai-chat__panel--resizing');
        panel.style.removeProperty('transform');

        try {
            handle.setPointerCapture(event.pointerId);
        } catch (_error) {
            // Not all pointers support capture; ignore.
        }

        document.addEventListener('pointermove', onPointerMove, { passive: false });
        document.addEventListener('pointerup', stopResizing as EventListener);
        document.addEventListener('pointercancel', stopResizing as EventListener);
    });

    handle.dataset.initialized = 'true';
}

export function setupAIChatDraftImport(this: AIChatContext): void {
    const attachButton = document.getElementById('ai-chat-attach-image');
    const imageInput = document.getElementById('ai-chat-image-input') as HTMLInputElement | null;
    const panel = document.getElementById('ai-chat-panel');

    if (attachButton && imageInput && attachButton.getAttribute('data-draft-import-ready') !== 'true') {
        attachButton.addEventListener('click', (event) => {
            event.preventDefault();
            imageInput.value = '';
            imageInput.click();
        });

        imageInput.addEventListener('change', (event) => {
            const target = event.target as HTMLInputElement | null;
            const file = target?.files?.[0] || null;
            if (file) {
                void this.handleAIChatImageFile(file);
            }
        });

        attachButton.setAttribute('data-draft-import-ready', 'true');
    }

    if (panel && panel.getAttribute('data-draft-paste-ready') !== 'true') {
        panel.addEventListener('paste', (event: ClipboardEvent) => {
            const items = Array.from(event.clipboardData?.items || []);
            const imageItem = items.find(item => item.type.startsWith('image/'));
            const file = imageItem?.getAsFile() || null;
            if (!file) {
                return;
            }
            event.preventDefault();
            void this.handleAIChatImageFile(file);
        });

        panel.setAttribute('data-draft-paste-ready', 'true');
    }
}

export async function handleAIChatImageFile(this: AIChatContext, file: File): Promise<void> {
    if (!file) {
        return;
    }

    if (!this.hasAICoachConsent()) {
        this.promptAICoachConsent(() => {
            void this.handleAIChatImageFile(file);
        });
        return;
    }

    this.toggleAIChat(true);
    this.aiDraftImport = {
        status: 'ready',
        fileName: file.name || 'Pasted screenshot',
        image: null,
        extraction: null,
        error: null
    };
    this.renderAIDraftImport();

    try {
        const image = await preprocessScreenshotFile(file);
        this.aiDraftImport = {
            status: 'ready',
            fileName: file.name || 'Pasted screenshot',
            image,
            extraction: null,
            error: null
        };
        this.appendAIChatMessage('user', `Attached broker screenshot: ${file.name || 'pasted image'}`);
    } catch (error) {
        this.aiDraftImport = {
            status: 'error',
            fileName: file.name || 'Pasted screenshot',
            image: null,
            extraction: null,
            error: (error as Error)?.message || 'Could not prepare screenshot.'
        };
    }

    this.renderAIDraftImport();
}

export async function extractAIDraftLegsFromScreenshot(this: AIChatContext): Promise<void> {
    const state = this.aiDraftImport || defaultAIDraftImportState();
    if (!state.image) {
        this.showNotification('Attach a broker screenshot first.', 'error');
        return;
    }
    if (!this.aiAgent?.extractDraftLegsFromImage) {
        this.showNotification('Gemini screenshot extraction is unavailable.', 'error');
        return;
    }
    if (this.aiChatPendingRequest) {
        return;
    }

    this.aiChatPendingRequest = true;
    this.aiDraftImport = {
        ...state,
        status: 'extracting',
        error: null
    };
    this.renderAIDraftImport();

    try {
        const extraction = await this.aiAgent.extractDraftLegsFromImage({
            mimeType: state.image.mimeType,
            data: state.image.data,
            metadata: {
                source: 'ai_coach_screenshot',
                currentDate: new Date().toISOString().slice(0, 10),
                fileName: state.fileName,
                imageWidth: state.image.width,
                imageHeight: state.image.height,
                sizeBytes: state.image.sizeBytes,
                wasResized: state.image.wasResized,
                appContext: 'GammaLedger draft trade leg import'
            }
        });
        this.aiDraftImport = {
            ...state,
            status: 'review',
            extraction,
            error: null
        };
        const count = extraction.detectedRows.length;
        this.appendAIChatMessage('ai', count
            ? `Prepared ${count} draft leg${count === 1 ? '' : 's'} from the screenshot. Review every row before using it.`
            : 'I did not find visible trade rows in that screenshot. Try a tighter crop around the trade log and column headers.');
    } catch (error) {
        this.aiDraftImport = {
            ...state,
            status: 'error',
            extraction: null,
            error: (error as Error)?.message || 'Gemini could not extract draft legs.'
        };
    } finally {
        this.aiChatPendingRequest = false;
        this.renderAIDraftImport();
    }
}

export function clearAIDraftImport(this: AIChatContext): void {
    this.aiDraftImport = defaultAIDraftImportState();
    this.renderAIDraftImport();
}

export function renderAIDraftImport(this: AIChatContext): void {
    const container = document.getElementById('ai-draft-import');
    if (!container) {
        return;
    }

    const state = this.aiDraftImport || defaultAIDraftImportState();
    if (state.status === 'empty' || (!state.image && !state.error)) {
        container.classList.add('hidden');
        container.innerHTML = '';
        return;
    }

    container.classList.remove('hidden');
    const image = state.image;
    const metaParts = [
        state.fileName,
        image?.width && image?.height ? `${image.width}×${image.height}` : '',
        image?.wasResized ? 'resized for analysis' : ''
    ].filter(Boolean);
    const rows = Array.isArray(state.extraction?.detectedRows)
        ? state.extraction.detectedRows.map(row => sanitizeDraftRow(row))
        : [];
    const globalWarnings = Array.isArray(state.extraction?.warnings)
        ? state.extraction.warnings.filter((warning: unknown): warning is string => typeof warning === 'string' && warning.trim().length > 0)
        : [];

    const renderRow = (row: SanitizedDraftRow, index: number): string => {
        const confidenceLabel = `${Math.round(row.confidence * 100)}%`;
        const warnings = [
            ...row.warnings,
            row.needsUserReview && row.warnings.length === 0 ? 'Review recommended' : ''
        ].filter(Boolean);
        return `
            <tr data-draft-row="${index}" data-confidence="${row.confidence}" data-needs-review="${row.needsUserReview}" data-warnings="${this.escapeHTML(warnings.join('\n'))}" data-raw-text="${this.escapeHTML(row.rawText)}">
                <td><input type="checkbox" name="draft-${index}-selected" data-draft-field="selected" checked aria-label="Select draft row ${index + 1}"></td>
                <td><input type="text" name="draft-${index}-underlying" data-draft-field="underlying" value="${this.escapeHTML(row.underlying)}" aria-label="Ticker"></td>
                <td>
                    <select name="draft-${index}-orderType" data-draft-field="orderType" aria-label="Action">
                        ${['', 'BTO', 'STO', 'BTC', 'STC'].map(value => `<option value="${value}"${row.orderType === value ? ' selected' : ''}>${value || 'Review'}</option>`).join('')}
                    </select>
                </td>
                <td>
                    <select name="draft-${index}-type" data-draft-field="type" aria-label="Instrument">
                        ${['', 'CALL', 'PUT', 'STOCK', 'CASH'].map(value => `<option value="${value}"${row.type === value ? ' selected' : ''}>${value || 'Review'}</option>`).join('')}
                    </select>
                </td>
                <td><input type="number" name="draft-${index}-quantity" data-draft-field="quantity" min="0" step="1" value="${this.escapeHTML(row.quantity)}" aria-label="Quantity"></td>
                <td><input type="date" name="draft-${index}-executionDate" data-draft-field="executionDate" value="${this.escapeHTML(row.executionDate)}" aria-label="Trade date"></td>
                <td><input type="date" name="draft-${index}-expirationDate" data-draft-field="expirationDate" value="${this.escapeHTML(row.expirationDate)}" aria-label="Expiration"></td>
                <td><input type="number" name="draft-${index}-strike" data-draft-field="strike" step="0.01" value="${this.escapeHTML(row.strike)}" aria-label="Strike"></td>
                <td><input type="number" name="draft-${index}-premium" data-draft-field="premium" step="0.000001" min="0" value="${this.escapeHTML(row.premium)}" aria-label="Price"></td>
                <td><input type="number" name="draft-${index}-fees" data-draft-field="fees" step="0.0000001" value="${this.escapeHTML(row.fees)}" aria-label="Fees"></td>
                <td class="ai-draft-import__confidence">${confidenceLabel}</td>
                <td class="ai-draft-import__row-warning">${this.escapeHTML(warnings.join('; '))}</td>
            </tr>
        `;
    };

    container.innerHTML = `
        <div class="ai-draft-import__header">
            <div>
                <h4 class="ai-draft-import__title">Broker Screenshot Draft</h4>
                <p class="ai-draft-import__meta">${this.escapeHTML(metaParts.join(' · ') || 'Screenshot attached')}</p>
            </div>
            <button type="button" class="btn btn--sm btn--secondary" id="ai-draft-clear">Clear</button>
        </div>
        ${image?.dataUrl ? `<img class="ai-draft-import__preview" src="${this.escapeHTML(image.dataUrl)}" alt="Attached broker screenshot preview">` : ''}
        ${state.error ? `<p class="ai-draft-import__warning">${this.escapeHTML(state.error)}</p>` : ''}
        ${state.status === 'ready' ? '<p class="ai-draft-import__help">Crop around trade rows and column headers before attaching for best results. Account numbers and balances are not needed.</p>' : ''}
        ${state.status === 'extracting' ? '<p class="ai-draft-import__help">Extracting visible trade rows...</p>' : ''}
        ${globalWarnings.length ? `<p class="ai-draft-import__warning">${this.escapeHTML(globalWarnings.join(' '))}</p>` : ''}
        ${rows.length ? `
            <div class="ai-draft-import__table-wrap">
                <table class="ai-draft-import__table">
                    <thead>
                        <tr>
                            <th>Use</th>
                            <th>Ticker</th>
                            <th>Action</th>
                            <th>Type</th>
                            <th>Qty</th>
                            <th>Date</th>
                            <th>Exp.</th>
                            <th>Strike</th>
                            <th>Price</th>
                            <th>Fees</th>
                            <th>Conf.</th>
                            <th>Warnings</th>
                        </tr>
                    </thead>
                    <tbody>${rows.map(renderRow).join('')}</tbody>
                </table>
            </div>
        ` : ''}
        <div class="ai-draft-import__actions">
            ${image && state.status !== 'extracting' ? '<button type="button" class="btn btn--primary btn--sm" id="ai-draft-extract">Extract draft legs</button>' : ''}
            ${rows.length ? '<button type="button" class="btn btn--secondary btn--sm" id="ai-draft-import-trades">Import to Trades</button>' : ''}
        </div>
    `;

    container.querySelector('#ai-draft-clear')?.addEventListener('click', () => this.clearAIDraftImport());
    container.querySelector('#ai-draft-extract')?.addEventListener('click', () => {
        void this.extractAIDraftLegsFromScreenshot();
    });
    container.querySelector('#ai-draft-import-trades')?.addEventListener('click', () => this.importAIDraftTrades());
}

export function importAIDraftTrades(this: AIChatContext): void {
    const container = document.getElementById('ai-draft-import');
    if (!container) {
        return;
    }
    const rows = readDraftRowsFromReview(container);
    if (!rows.length) {
        this.showNotification('Select at least one draft row to import.', 'error');
        return;
    }

    const today = new Date().toISOString().slice(0, 10);
    let defaultedDate = 0;
    let defaultedQuantity = 0;
    for (const row of rows) {
        if (!row.executionDate) {
            row.executionDate = today;
            defaultedDate += 1;
        }
        if (row.quantity === '') {
            row.quantity = 1;
            defaultedQuantity += 1;
        }
    }

    const incompleteRows = rows.filter(row => !row.orderType || !row.type);
    if (incompleteRows.length || defaultedDate || defaultedQuantity) {
        const parts: string[] = [];
        if (incompleteRows.length) {
            parts.push(`${incompleteRows.length} row${incompleteRows.length === 1 ? '' : 's'} missing action or type`);
        }
        if (defaultedDate) {
            parts.push(`${defaultedDate} date${defaultedDate === 1 ? '' : 's'} set to today`);
        }
        if (defaultedQuantity) {
            parts.push(`${defaultedQuantity} quantity${defaultedQuantity === 1 ? '' : ' values'} set to 1`);
        }
        this.showNotification(
            `Imported with defaults: ${parts.join(', ')} — review and complete on the Import page.`,
            'info'
        );
    }

    const batchId = `AI-SCREENSHOT-${Date.now()}`;
    const fileName = this.aiDraftImport?.fileName || 'broker screenshot';
    const now = new Date();

    // Group rows by ticker
    const byTicker = new Map<string, SanitizedDraftRow[]>();
    for (const row of rows) {
        const ticker = row.underlying || 'UNKNOWN';
        const group = byTicker.get(ticker) ?? [];
        group.push(row);
        byTicker.set(ticker, group);
    }

    let created = 0;
    const reviewTradeIds: string[] = [];

    for (const [ticker, tickerRows] of byTicker) {
        const legs = tickerRows.map((row, index) => {
            const type = this.normalizeLegType(row.type || 'CALL');
            const quantity = Number(row.quantity) || 1;
            return {
                id: `AI-${batchId}-${ticker}-L${index + 1}`,
                orderType: this.normalizeLegOrderType(row.orderType),
                type,
                quantity,
                multiplier: this.getDefaultMultiplierForLegType(type),
                executionDate: row.executionDate,
                expirationDate: type === 'CALL' || type === 'PUT' ? row.expirationDate : '',
                strike: type === 'CALL' || type === 'PUT' ? (row.strike === '' ? null : Number(row.strike)) : null,
                premium: row.premium === '' ? 0 : Number(row.premium),
                fees: row.fees === '' ? 0 : Number(row.fees),
                importBatchId: batchId,
                importSource: 'AI Screenshot'
            };
        });

        const strategy = this.inferStrategyFromLegs ? this.inferStrategyFromLegs(legs) : 'Import Review';
        const openedDate = tickerRows.reduce((earliest, row) => {
            if (!row.executionDate) return earliest;
            return !earliest || row.executionDate < earliest ? row.executionDate : earliest;
        }, '');
        const warningRows = tickerRows.filter(row => row.needsUserReview || row.warnings.length > 0).length;
        const notes = [
            `AI screenshot draft from ${fileName}.`,
            warningRows ? `${warningRows} row${warningRows === 1 ? '' : 's'} flagged for review.` : 'All rows require manual review before saving.'
        ].join('\n');

        const tradeId = `AI-${batchId}-${ticker}`;
        const trade = this.enrichTradeData({
            id: tradeId,
            ticker,
            strategy,
            status: 'Open',
            underlyingType: 'Stock',
            openedDate,
            closedDate: '',
            expirationDate: '',
            exitReason: '',
            notes,
            legs,
            importBatchId: batchId,
            importReview: true
        });

        this.trades.push(trade);
        reviewTradeIds.push(tradeId);
        created += 1;
    }

    if (!created) {
        this.showNotification('No trades could be created from the selected rows.', 'error');
        return;
    }

    this.saveToStorage({});
    this.markUnsavedChanges();
    this.updateDashboard();

    this.updateImportSummary({
        fileName,
        batchId,
        stats: {
            totalTradesCreated: created,
            tradesUpdated: 0,
            reviewTradesCreated: created,
            totalTransactions: rows.length,
            legsAddedToNewTrades: rows.length,
            duplicateLegs: 0
        },
        reviewTradeIds,
        timestamp: now
    });
    this.renderImportSummary();
    this.refreshImportMergeList();

    const tradeLabel = created === 1 ? '1 trade' : `${created} trades`;
    this.appendImportLog({
        type: 'success',
        message: `AI screenshot import: ${tradeLabel} added for review. Source: ${fileName}.`,
        timestamp: now
    });

    this.showView('import');
    this.toggleAIChat(false);
    this.showNotification(`${tradeLabel} imported for review. Confirm or edit on the Import page.`, 'success');
}

/** @deprecated Use importAIDraftTrades instead */
export function applyAIDraftLegsToTradeForm(this: AIChatContext): void {
    return importAIDraftTrades.call(this);
}

export function initializeAIChat(this: AIChatContext): void {
    this.updateAIChatHeader();
    if (!this.aiAgent) {
        this.aiChatMessages = [];
        return;
    }

    const snapshot = this.calculateAdvancedStats();
    this.aiAgent.updateContext({
        stats: snapshot,
        openTrades: (snapshot as { openTradesList?: unknown[] }).openTradesList
    });

    this.aiChatSessionId = Date.now();
    this.aiChatMessages = [];
    this.aiChatPendingRequest = false;

    const greeting = this.aiAgent.getGreeting();
    if (greeting) {
        this.appendAIChatMessage('ai', greeting);
    } else {
        this.renderAIChatMessages();
    }
}

export function toggleAIChat(this: AIChatContext, forceOpen: boolean | null = null): void {
    const panel = document.getElementById('ai-chat-panel');
    const toggle = document.getElementById('ai-chat-toggle');
    const input = document.getElementById('ai-chat-input') as HTMLInputElement | null;
    if (!panel || !toggle) {
        return;
    }

    const shouldOpen = forceOpen === null ? panel.classList.contains('hidden') : Boolean(forceOpen);

    if (shouldOpen) {
        if (!this.hasAICoachConsent()) {
            this.promptAICoachConsent(() => this.toggleAIChat(true));
            return;
        }
        panel.classList.remove('hidden');
        panel.setAttribute('aria-hidden', 'false');
        toggle.setAttribute('aria-expanded', 'true');
        this.aiChatOpen = true;
        if (input) {
            setTimeout(() => input.focus(), 80);
        }
    } else {
        panel.classList.add('hidden');
        panel.setAttribute('aria-hidden', 'true');
        toggle.setAttribute('aria-expanded', 'false');
        this.aiChatOpen = false;
    }
}

export async function handleAIChatSubmit(this: AIChatContext): Promise<void> {
    if (this.aiChatPendingRequest) {
        return;
    }

    const input = document.getElementById('ai-chat-input') as HTMLInputElement | null;
    if (!input) {
        return;
    }

    const query = input.value.trim();
    if (!query) {
        return;
    }

    if (!this.hasAICoachConsent()) {
        this.promptAICoachConsent(() => {
            if (!input.value.trim()) {
                input.value = query;
            }
            this.handleAIChatSubmit();
        });
        return;
    }

    this.appendAIChatMessage('user', query);
    input.value = '';

    const placeholderId = this.appendAIChatMessage('ai', 'Analyzing your portfolio...', { pending: true });
    const historySnapshot = this.aiChatMessages
        .filter(message => message.id !== placeholderId)
        .slice(-10)
        .map(message => ({ ...message }));

    this.aiChatPendingRequest = true;

    try {
        const response = this.aiAgent
            ? await this.aiAgent.generateResponse(query, { history: historySnapshot })
            : 'AI assistant is unavailable at the moment.';
        this.appendAIChatMessage('ai', response, { replaceId: placeholderId, pending: false });
    } catch (error) {
        const message = error?.message || 'Unknown error';
        const fallback = 'Sorry, I could not reach Gemini right now. Please try again soon.';
        this.appendAIChatMessage('ai', `${fallback} (${message})`, { replaceId: placeholderId, pending: false });
    } finally {
        this.aiChatPendingRequest = false;
        if (input) {
            input.focus();
        }
    }
}

export async function handleAIQuickPrompt(
    this: AIChatContext,
    prompt: string,
    options: { promptType?: string | null; [key: string]: unknown } = {}
): Promise<void> {
    if (this.aiChatPendingRequest || !prompt) {
        return;
    }

    if (!this.hasAICoachConsent()) {
        this.promptAICoachConsent(() => this.handleAIQuickPrompt(prompt, options));
        return;
    }

    this.toggleAIChat(true);

    const input = document.getElementById('ai-chat-input') as HTMLInputElement | null;
    if (input) {
        input.value = '';
    }

    this.appendAIChatMessage('user', prompt);

    const placeholderId = this.appendAIChatMessage('ai', 'Analyzing your portfolio...', { pending: true });
    const historySnapshot = this.aiChatMessages
        .filter(message => message.id !== placeholderId)
        .slice(-10)
        .map(message => ({ ...message }));

    this.aiChatPendingRequest = true;

    try {
        const response = this.aiAgent
            ? await this.aiAgent.generateResponse(prompt, { history: historySnapshot, promptType: options.promptType || null })
            : 'AI assistant is unavailable at the moment.';
        this.appendAIChatMessage('ai', response, { replaceId: placeholderId, pending: false });
    } catch (error) {
        const message = error?.message || 'Unknown error';
        const fallback = 'Sorry, I could not reach Gemini right now. Please try again soon.';
        this.appendAIChatMessage('ai', `${fallback} (${message})`, { replaceId: placeholderId, pending: false });
    } finally {
        this.aiChatPendingRequest = false;
        if (input) {
            input.focus();
        }
    }
}

export function appendAIChatMessage(
    this: AIChatContext,
    sender: string,
    text: string,
    options: { suppressRender?: boolean; replaceId?: string | null; id?: string | null; pending?: boolean } = {}
): string | null {
    const normalizedSender = sender === 'ai' ? 'ai' : 'user';
    const {
        suppressRender = false,
        replaceId = null,
        id = null,
        pending = false
    } = options || {};

    if (!replaceId && (typeof text !== 'string' || text.length === 0)) {
        return null;
    }

    const timestamp = new Date();

    if (replaceId) {
        const index = this.aiChatMessages.findIndex(message => message.id === replaceId);
        if (index !== -1) {
            const existing = this.aiChatMessages[index];
            this.aiChatMessages[index] = {
                ...existing,
                sender: normalizedSender as 'ai' | 'user',
                text: text || '',
                timestamp,
                pending: Boolean(pending)
            };

            if (!suppressRender) {
                this.renderAIChatMessages();
            }

            return this.aiChatMessages[index].id;
        }
    }

    const entry: ChatMessage = {
        id: id || `${this.aiChatSessionId}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        sender: normalizedSender as 'ai' | 'user',
        text: text || '',
        timestamp,
        pending: Boolean(pending)
    };

    this.aiChatMessages = [...this.aiChatMessages, entry].slice(-200);

    if (!suppressRender) {
        this.renderAIChatMessages();
    }

    return entry.id;
}

export function renderAIChatMessages(this: AIChatContext): void {
    const history = document.getElementById('ai-chat-history');
    if (!history) {
        return;
    }

    history.innerHTML = '';

    this.aiChatMessages.forEach(message => {
        const item = document.createElement('div');
        item.className = `ai-chat__message ai-chat__message--${message.sender}`;

        if (message.pending) {
            item.classList.add('ai-chat__message--pending');
        }

        const label = document.createElement('span');
        label.textContent = message.sender === 'ai'
            ? this.getGeminiChatDisplayName()
            : 'You';
        item.appendChild(label);

        const bubble = document.createElement('div');
        bubble.className = 'ai-chat__bubble';
        if (message.pending) {
            bubble.setAttribute('data-pending', 'true');
        }
        if (message.sender === 'ai') {
            bubble.innerHTML = this.renderMarkdownToHTML(message.text);
        } else {
            bubble.textContent = message.text;
        }
        item.appendChild(bubble);

        history.appendChild(item);
    });

    history.scrollTop = history.scrollHeight;
}

export function updateAIChatHeader(this: AIChatContext): void {
    const titleEl = document.getElementById('ai-chat-title');
    const subtitleEl = document.getElementById('ai-chat-subtitle');

    if (!titleEl && !subtitleEl) {
        return;
    }

    if (titleEl) {
        titleEl.textContent = 'Portfolio AI Coach';
    }

    if (!subtitleEl) {
        return;
    }

    const hasKey = Boolean(this.gemini?.apiKey);
    const hasConsent = this.hasAICoachConsent();

    if (!hasKey) {
        subtitleEl.textContent = '';
        const text1 = document.createTextNode('Connect your Gemini API key in ');
        const link = document.createElement('a');
        link.href = '#settings';
        link.className = 'ai-chat__settings-link';
        link.textContent = 'Settings';
        const text2 = document.createTextNode(' to get tailored analysis.');
        subtitleEl.appendChild(text1);
        subtitleEl.appendChild(link);
        subtitleEl.appendChild(text2);
    } else if (!hasConsent) {
        subtitleEl.textContent = 'Review and accept the AI Coach data-sharing notice to start asking questions.';
    } else {
        subtitleEl.textContent = 'Ask about your portfolio for AI-guided insights.';
    }
}
