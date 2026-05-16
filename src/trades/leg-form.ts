// src/trades/leg-form.ts — Wave 11: Leg form UI helpers.
// Uses the .call(this, …) delegation pattern.

import { LegFormInputSchema, formatZodIssues } from '@core/schema'

interface LegFormContext {
    currentView: string
    currentEditingId: string | null | undefined
    defaultFeePerContract: number | null
    finnhub?: { apiKey?: string | null } | null
    normalizeLegType(type: unknown): string
    normalizeUnderlyingType(type: unknown, opts?: { fallback?: string }): string
    normalizeLegOrderType(orderType: unknown): string
    deriveOrderTypeFromActionSide(action: unknown, side: unknown): string
    getSelectedUnderlyingType(opts?: { fallback?: string }): string
    getDefaultMultiplierForLegType(legType: string, underlyingType?: string): number
    syncLegMultiplierVisibility(row: HTMLElement, opts?: { defaultMultiplier?: number | null }): void
    syncLegTypeFieldVisibility(row: HTMLElement): void
    applyUnderlyingTypeToLegMultipliers(opts?: { row?: HTMLElement | null; force?: boolean }): void
    getLegsContainer(): HTMLElement | null
    addLegFormRow(leg?: Record<string, unknown> | null): HTMLElement | null
    removeLegFormRow(row: HTMLElement): void
    clearLegFormRows(): void
    updateLegRowNumbers(): void
    generateLegId(index?: number): string
    renderLegForms(legs?: unknown[]): void
    createClosingLegFromRow(sourceRow: HTMLElement): void
    collectLegsFromForm(): Record<string, unknown>[] | null
    autoFillUnderlyingPrice(input: HTMLInputElement | null): Promise<void>
    autoFillUnderlyingPricesForLegs(): Promise<void>
    getCurrentPrice(ticker: string): Promise<{ price?: unknown }>
    getDefaultFeeForQuantity(qty: number): number | null
    showNotification(msg: string, type: string): void
}

export function getLegsContainer(this: LegFormContext): HTMLElement | null {
    return document.getElementById('trade-legs-container');
}

export function generateLegId(this: LegFormContext, index = 0): string {
    const base = this.currentEditingId || 'NEW';
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).slice(2, 6);
    return `${base}-LEG-${timestamp}-${index}-${random}`;
}

export function clearLegFormRows(this: LegFormContext): void {
    const container = this.getLegsContainer();
    if (container) {
        container.innerHTML = '';
    }
}

export function getSelectedUnderlyingType(
    this: LegFormContext,
    { fallback = 'Stock' }: { fallback?: string } = {}
): string {
    const select = document.getElementById('underlyingType') as HTMLSelectElement | null;
    return this.normalizeUnderlyingType(select?.value, { fallback });
}

export function getDefaultMultiplierForLegType(
    this: LegFormContext,
    legType: string,
    underlyingType = 'Stock'
): number {
    const normalizedLegType = this.normalizeLegType(legType || 'CALL');
    if (normalizedLegType === 'STOCK') {
        return 1;
    }
    // CASH settlement legs use the same multiplier as the option contract they settle
    if (normalizedLegType === 'CASH') {
        return 100;
    }
    const normalizedUnderlying = this.normalizeUnderlyingType(underlyingType, { fallback: 'Stock' });
    if (normalizedUnderlying === 'Stock') {
        return 100;
    }
    if (normalizedUnderlying === 'ETF' || normalizedUnderlying === 'Index' || normalizedUnderlying === 'Future') {
        return 100;
    }
    return 100;
}

export function syncLegMultiplierVisibility(
    this: LegFormContext,
    row: HTMLElement,
    { defaultMultiplier = null }: { defaultMultiplier?: number | null } = {}
): void {
    if (!row) {
        return;
    }

    const multiplierGroup = row.querySelector('[data-leg-group="multiplier"]') as HTMLElement | null;
    const multiplierInput = row.querySelector('[data-leg-field="multiplier"]') as HTMLInputElement | null;
    const toggleButton = row.querySelector('.trade-leg__multiplier-toggle') as HTMLElement | null;
    const typeSelect = row.querySelector('[data-leg-field="type"]') as HTMLSelectElement | null;

    if (!multiplierGroup || !multiplierInput || !toggleButton || !typeSelect) {
        return;
    }

    const underlyingType = this.getSelectedUnderlyingType({ fallback: 'Stock' });
    const normalizedLegType = this.normalizeLegType(typeSelect.value || 'CALL');
    const fallbackMultiplier = Number.isFinite(defaultMultiplier as number)
        ? (defaultMultiplier as number)
        : this.getDefaultMultiplierForLegType(normalizedLegType, underlyingType);

    const value = Number(multiplierInput.value);
    const hasCustomValue = Number.isFinite(value) && value > 0 && value !== fallbackMultiplier;
    const isOpen = row.classList.contains('trade-leg--multiplier-open');

    if (isOpen) {
        multiplierGroup.classList.remove('is-hidden');
        toggleButton.textContent = 'Hide multiplier';
        return;
    }

    multiplierGroup.classList.toggle('is-hidden', !hasCustomValue);
    toggleButton.textContent = hasCustomValue ? 'Hide multiplier' : 'Override multiplier';
}

export function syncLegTypeFieldVisibility(
    this: LegFormContext,
    row: HTMLElement
): void {
    if (!row) {
        return;
    }
    const typeSelect = row.querySelector('[data-leg-field="type"]') as HTMLSelectElement | null;
    if (!typeSelect) {
        return;
    }
    const legType = this.normalizeLegType(typeSelect.value || 'CALL');
    const isCash = legType === 'CASH';
    const isStock = legType === 'STOCK';

    // Strike: hide for CASH and STOCK types
    const strikeGroup = row.querySelector('[data-leg-group="strike-group"]') as HTMLElement | null;
    if (strikeGroup) {
        strikeGroup.classList.toggle('is-hidden', isCash || isStock);
    }

    // Expiration: hide for CASH and STOCK types
    const expirationGroup = row.querySelector('[data-leg-group="expiration-group"]') as HTMLElement | null;
    if (expirationGroup) {
        expirationGroup.classList.toggle('is-hidden', isCash || isStock);
    }

    // Premium label: clarify for CASH settlement legs
    const premiumLabel = row.querySelector('[data-leg-label="premium"]') as HTMLElement | null;
    if (premiumLabel) {
        if (isCash) {
            premiumLabel.textContent = 'Settlement Amount (per point)';
        } else {
            premiumLabel.textContent = 'Premium (per share)';
        }
    }
}

export function applyUnderlyingTypeToLegMultipliers(
    this: LegFormContext,
    { row = null, force = false }: { row?: HTMLElement | null; force?: boolean } = {}
): void {
    const container = this.getLegsContainer();
    if (!container) {
        return;
    }

    const rows = row ? [row] : Array.from(container.querySelectorAll('.trade-leg')) as HTMLElement[];
    if (!rows.length) {
        return;
    }

    const underlyingType = this.getSelectedUnderlyingType({ fallback: 'Stock' });

    rows.forEach((legRow) => {
        const typeSelect = legRow.querySelector('[data-leg-field="type"]') as HTMLSelectElement | null;
        const multiplierInput = legRow.querySelector('[data-leg-field="multiplier"]') as HTMLInputElement | null;
        if (!typeSelect || !multiplierInput) {
            return;
        }

        const defaultMultiplier = this.getDefaultMultiplierForLegType(typeSelect.value || 'CALL', underlyingType);
        const currentValue = Number(multiplierInput.value);
        const isOpen = legRow.classList.contains('trade-leg--multiplier-open');

        if (force || !Number.isFinite(currentValue) || currentValue <= 0) {
            multiplierInput.value = String(defaultMultiplier);
        } else if (!isOpen) {
            const shouldReset = currentValue === 0;
            if (shouldReset) {
                multiplierInput.value = String(defaultMultiplier);
            }
        }

        this.syncLegMultiplierVisibility(legRow, { defaultMultiplier });
    });
}

export function renderLegForms(
    this: LegFormContext,
    legs: unknown[] = []
): void {
    const container = this.getLegsContainer();
    if (!container) {
        return;
    }

    this.clearLegFormRows();

    if (Array.isArray(legs) && legs.length > 0) {
        (legs as Record<string, unknown>[]).forEach(leg => this.addLegFormRow(leg));
    } else {
        this.addLegFormRow();
    }

    this.updateLegRowNumbers();
    this.applyUnderlyingTypeToLegMultipliers({ force: !Array.isArray(legs) || legs.length === 0 });
}

export async function autoFillUnderlyingPrice(
    this: LegFormContext,
    inputElement: HTMLInputElement | null
): Promise<void> {
    if (!inputElement) {
        return;
    }

    if (this.currentView !== 'add-trade') {
        return;
    }

    const tickerInput = document.getElementById('ticker') as HTMLInputElement | null;
    const ticker = (tickerInput?.value || '').trim().toUpperCase();
    if (!ticker || !this.finnhub?.apiKey) {
        return;
    }

    try {
        const quote = await this.getCurrentPrice(ticker);
        const price = Number(quote?.price);
        if (Number.isFinite(price) && price > 0 && !inputElement.value) {
            inputElement.value = String(price);
        }
    } catch (_error) {
        // Price autofill is a convenience; leave manual input uninterrupted.
    }
}

export async function autoFillUnderlyingPricesForLegs(this: LegFormContext): Promise<void> {
    if (this.currentView !== 'add-trade') {
        return;
    }

    const tickerInput = document.getElementById('ticker') as HTMLInputElement | null;
    const ticker = (tickerInput?.value || '').trim().toUpperCase();
    const container = document.getElementById('add-trade-view') || document;
    if (!container) {
        return;
    }

    const emptyInputs = Array.from(container.querySelectorAll<HTMLInputElement>('[data-leg-field="underlyingPrice"]'))
        .filter(input => !input.value);

    if (emptyInputs.length === 0) {
        return;
    }

    try {
        const quote = await this.getCurrentPrice(ticker);
        const price = Number(quote?.price);
        if (Number.isFinite(price) && price > 0) {
            emptyInputs.forEach(input => {
                if (!input.value) {
                    input.value = String(price);
                }
            });
        }
    } catch (_error) {
        // Price autofill is a convenience; leave manual input uninterrupted.
    }
}

export function addLegFormRow(
    this: LegFormContext,
    leg: Record<string, unknown> | null = null
): HTMLElement | null {
    const container = this.getLegsContainer();
    if (!container) {
        return null;
    }

    const row = document.createElement('div');
    row.className = 'trade-leg';

    const existingRows = container.querySelectorAll('.trade-leg').length;
    const legId = (leg?.id as string) || this.generateLegId(existingRows);
    row.dataset.legId = legId;

    row.innerHTML = `
        <div class="trade-leg__header">
            <span class="trade-leg__title" data-leg-label></span>
            <div class="trade-leg__actions">
                <button type="button" class="btn btn--sm btn--accent trade-leg__close" title="Create a closing leg with pre-filled data">Close Leg</button>
                <button type="button" class="btn btn--sm btn--secondary trade-leg__remove">Remove Leg</button>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label class="form-label">Action</label>
                <select class="form-control" data-leg-field="orderType">
                    <option value="BTO">BTO (Buy to Open)</option>
                    <option value="STO">STO (Sell to Open)</option>
                    <option value="BTC">BTC (Buy to Close)</option>
                    <option value="STC">STC (Sell to Close)</option>
                </select>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label class="form-label">Instrument</label>
                <select class="form-control" data-leg-field="type">
                    <option value="CALL">Call</option>
                    <option value="PUT">Put</option>
                    <option value="STOCK">Stock</option>
                    <option value="CASH">Cash Settlement</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Quantity</label>
                <input type="number" class="form-control" data-leg-field="quantity" min="0" step="1">
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label class="form-label">Entry Date</label>
                <input type="date" class="form-control" data-leg-field="executionDate">
            </div>
            <div class="form-group" data-leg-group="expiration-group">
                <label class="form-label">Expiration Date</label>
                <input type="date" class="form-control" data-leg-field="expirationDate">
            </div>
        </div>
        <div class="form-row">
            <div class="form-group" data-leg-group="strike-group">
                <label class="form-label">Strike</label>
                <input type="number" class="form-control" data-leg-field="strike" step="0.01">
            </div>
            <div class="form-group">
                <label class="form-label" data-leg-label="premium">Premium (per share)</label>
                <input type="number" class="form-control" data-leg-field="premium" step="0.000001" min="0">
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label class="form-label">Fees</label>
                <input type="number" class="form-control" data-leg-field="fees" step="0.0000001">
            </div>
            <div class="form-group is-hidden" data-leg-group="multiplier">
                <label class="form-label">Multiplier</label>
                <input type="number" class="form-control" data-leg-field="multiplier" step="1" min="1">
                <span class="form-help-text">Used to scale option premiums (100 for standard contracts, 1 for stock).</span>
            </div>
        </div>
        <div class="form-row trade-leg__multiplier-row">
            <div class="form-group">
                <button type="button" class="btn btn--sm btn--secondary trade-leg__multiplier-toggle">Override multiplier</button>
                <span class="form-help-text">Hidden by default - standard contracts use 100, stock legs use 1.</span>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label class="form-label">Entry Underlying Price</label>
                <input type="number" class="form-control" data-leg-field="underlyingPrice" step="0.0000001" min="0">
            </div>
        </div>
    `;

    const orderTypeSelect = row.querySelector('[data-leg-field="orderType"]') as HTMLSelectElement | null;
    const normalizedOrderType = this.normalizeLegOrderType(
        (leg?.orderType as string) ||
        (leg?.tradeType as string) ||
        (leg?.order as string) ||
        this.deriveOrderTypeFromActionSide(leg?.action, leg?.side)
    );
    if (orderTypeSelect) {
        orderTypeSelect.value = normalizedOrderType;
    }

    const typeSelect = row.querySelector('[data-leg-field="type"]') as HTMLSelectElement | null;
    const normalizedType = this.normalizeLegType((leg?.type as string) || 'CALL');
    if (typeSelect) {
        typeSelect.value = normalizedType;
        typeSelect.addEventListener('change', () => {
            this.applyUnderlyingTypeToLegMultipliers({ row, force: true });
            this.syncLegTypeFieldVisibility(row);
        });
    }

    const baseUnderlyingType = this.getSelectedUnderlyingType({ fallback: 'Stock' });

    const quantityInput = row.querySelector('[data-leg-field="quantity"]') as HTMLInputElement | null;
    if (quantityInput) {
        if (leg && Number.isFinite(Number(leg.quantity))) {
            quantityInput.value = String(Math.abs(Number(leg.quantity)));
        } else {
            quantityInput.value = '1';
        }
    }

    const executionInput = row.querySelector('[data-leg-field="executionDate"]') as HTMLInputElement | null;
    if (executionInput) {
        executionInput.value = (leg?.executionDate as string) || '';
    }

    const expirationInput = row.querySelector('[data-leg-field="expirationDate"]') as HTMLInputElement | null;
    if (expirationInput) {
        expirationInput.value = (leg?.expirationDate as string) || '';
    }

    const strikeInput = row.querySelector('[data-leg-field="strike"]') as HTMLInputElement | null;
    if (strikeInput) {
        strikeInput.value = Number.isFinite(Number(leg?.strike)) ? String(Number(leg!.strike)) : '';
    }

    const premiumInput = row.querySelector('[data-leg-field="premium"]') as HTMLInputElement | null;
    if (premiumInput) {
        premiumInput.value = Number.isFinite(Number(leg?.premium)) ? String(Number(leg!.premium)) : '';
    }

    const feesInput = row.querySelector('[data-leg-field="fees"]') as HTMLInputElement | null;
    if (feesInput) {
        if (Number.isFinite(Number(leg?.fees))) {
            // Existing leg has a fee value
            feesInput.value = String(Number(leg!.fees));
        } else if (!leg && this.defaultFeePerContract !== null) {
            // New leg - apply default fee based on quantity (default quantity is 1)
            const defaultFee = this.getDefaultFeeForQuantity(1);
            if (defaultFee !== null) {
                feesInput.value = String(defaultFee);
            }
        } else {
            feesInput.value = '';
        }
    }

    // Update fees when quantity changes (only for new legs with default fee set)
    if (!leg && this.defaultFeePerContract !== null) {
        quantityInput?.addEventListener('change', () => {
            const qty = Math.abs(Number(quantityInput!.value) || 1);
            const defaultFee = this.getDefaultFeeForQuantity(qty);
            if (defaultFee !== null && feesInput) {
                feesInput.value = String(defaultFee);
            }
        });
    }

    const multiplierInput = row.querySelector('[data-leg-field="multiplier"]') as HTMLInputElement | null;
    if (multiplierInput) {
        const providedMultiplier = Number.isFinite(Number(leg?.multiplier)) && Number(leg!.multiplier) > 0
            ? Number(leg!.multiplier)
            : this.getDefaultMultiplierForLegType(normalizedType, baseUnderlyingType);
        multiplierInput.value = String(providedMultiplier);
        ['change', 'input'].forEach((eventName) => {
            multiplierInput.addEventListener(eventName, () => {
                this.syncLegMultiplierVisibility(row);
            });
        });
    }

    const multiplierToggle = row.querySelector('.trade-leg__multiplier-toggle') as HTMLButtonElement | null;
    if (multiplierToggle) {
        multiplierToggle.addEventListener('click', (event) => {
            event.preventDefault();
            const isOpen = row.classList.toggle('trade-leg--multiplier-open');
            if (!isOpen) {
                this.applyUnderlyingTypeToLegMultipliers({ row, force: false });
            }
            this.syncLegMultiplierVisibility(row);
        });
    }

    const underlyingInput = row.querySelector('[data-leg-field="underlyingPrice"]') as HTMLInputElement | null;
    const shouldAutoFillPrice = underlyingInput && !Number.isFinite(Number(leg?.underlyingPrice));

    if (underlyingInput) {
        if (Number.isFinite(Number(leg?.underlyingPrice))) {
            // Use provided underlying price (e.g., when editing existing leg)
            underlyingInput.value = String(Number(leg!.underlyingPrice));
        }
        // Auto-fill will happen after row is appended to DOM
    }

    const removeButton = row.querySelector('.trade-leg__remove') as HTMLButtonElement | null;
    if (removeButton) {
        removeButton.addEventListener('click', () => {
            this.removeLegFormRow(row);
        });
    }

    // Close Leg button - creates a closing leg with inverted action
    const closeButton = row.querySelector('.trade-leg__close') as HTMLButtonElement | null;
    if (closeButton) {
        closeButton.addEventListener('click', () => {
            this.createClosingLegFromRow(row);
        });
    }

    container.appendChild(row);
    this.applyUnderlyingTypeToLegMultipliers({ row, force: !leg });
    this.syncLegMultiplierVisibility(row);
    this.syncLegTypeFieldVisibility(row);
    this.updateLegRowNumbers();

    // Auto-fill underlying price AFTER row is in the DOM
    if (shouldAutoFillPrice && underlyingInput) {
        this.autoFillUnderlyingPrice(underlyingInput);
    }

    return row;
}

export function removeLegFormRow(
    this: LegFormContext,
    row: HTMLElement
): void {
    const container = this.getLegsContainer();
    if (!container || !row) {
        return;
    }

    container.removeChild(row);

    if (container.children.length === 0) {
        this.addLegFormRow();
    } else {
        this.updateLegRowNumbers();
        this.applyUnderlyingTypeToLegMultipliers({ force: false });
    }
}

export function createClosingLegFromRow(
    this: LegFormContext,
    sourceRow: HTMLElement
): void {
    if (!sourceRow) {
        return;
    }

    // Extract values from the source leg
    const orderTypeSelect = sourceRow.querySelector('[data-leg-field="orderType"]') as HTMLSelectElement | null;
    const typeSelect = sourceRow.querySelector('[data-leg-field="type"]') as HTMLSelectElement | null;
    const quantityInput = sourceRow.querySelector('[data-leg-field="quantity"]') as HTMLInputElement | null;
    const executionInput = sourceRow.querySelector('[data-leg-field="executionDate"]') as HTMLInputElement | null;
    const expirationInput = sourceRow.querySelector('[data-leg-field="expirationDate"]') as HTMLInputElement | null;
    const strikeInput = sourceRow.querySelector('[data-leg-field="strike"]') as HTMLInputElement | null;
    const multiplierInput = sourceRow.querySelector('[data-leg-field="multiplier"]') as HTMLInputElement | null;

    const orderType = orderTypeSelect?.value || 'BTO';
    const instrumentType = typeSelect?.value || 'CALL';
    const quantity = quantityInput?.value || '1';
    const executionDate = executionInput?.value || '';
    const expirationDate = expirationInput?.value || '';
    const strike = strikeInput?.value || '';
    const multiplier = multiplierInput?.value || '';

    // Determine the closing order type
    // BTO -> STC (bought to open, sell to close)
    // STO -> BTC (sold to open, buy to close)
    // BTC -> already a close, don't create another
    // STC -> already a close, don't create another
    let closingOrderType: string;
    if (orderType === 'BTO') {
        closingOrderType = 'STC';
    } else if (orderType === 'STO') {
        closingOrderType = 'BTC';
    } else {
        // Already a closing leg - show notification
        this.showNotification('This leg is already a closing position.', 'warning');
        return;
    }

    // Get today's date as the default execution date for the closing leg
    const today = new Date().toISOString().slice(0, 10);

    // Calculate default fee based on quantity
    const qty = Math.abs(Number(quantity) || 1);
    const defaultFee = this.getDefaultFeeForQuantity(qty);

    // Build the closing leg data
    const closingLeg: Record<string, unknown> = {
        orderType: closingOrderType,
        type: instrumentType,
        quantity: qty,
        executionDate: today,
        expirationDate: expirationDate,
        strike: strike,
        premium: '', // User must enter
        fees: defaultFee !== null ? defaultFee : '',
        multiplier: multiplier
    };

    // Add the closing leg
    const newRow = this.addLegFormRow(closingLeg);

    // Highlight the new leg briefly
    if (newRow) {
        newRow.classList.add('trade-leg--highlight');
        newRow.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Focus on the premium field since that's what the user needs to enter
        setTimeout(() => {
            const premiumInput = newRow.querySelector('[data-leg-field="premium"]') as HTMLInputElement | null;
            if (premiumInput) {
                premiumInput.focus();
            }
            // Remove highlight after animation
            setTimeout(() => {
                newRow.classList.remove('trade-leg--highlight');
            }, 1500);
        }, 100);
    }
}

export function updateLegRowNumbers(this: LegFormContext): void {
    const container = this.getLegsContainer();
    if (!container) {
        return;
    }

    Array.from(container.querySelectorAll('.trade-leg')).forEach((row, index) => {
        const label = row.querySelector('[data-leg-label]') as HTMLElement | null;
        if (label) {
            label.textContent = `Leg ${index + 1}`;
        }

        const removeButton = row.querySelector('.trade-leg__remove') as HTMLButtonElement | null;
        if (removeButton) {
            removeButton.disabled = container.children.length === 1;
        }
    });
}

export function collectLegsFromForm(this: LegFormContext): Record<string, unknown>[] | null {
    const container = this.getLegsContainer();
    if (!container) {
        return [];
    }

    const rows = Array.from(container.querySelectorAll('.trade-leg')) as HTMLElement[];
    if (rows.length === 0) {
        return [];
    }

    const legs: Record<string, unknown>[] = [];
    const errors: string[] = [];

    rows.forEach((row, index) => {
        const getFieldValue = (name: string): string => {
            const field = row.querySelector(`[data-leg-field="${name}"]`) as HTMLInputElement | HTMLSelectElement | null;
            return field ? field.value : '';
        };

        const orderType = this.normalizeLegOrderType(getFieldValue('orderType') || 'BTO');
        const type = this.normalizeLegType(getFieldValue('type') || 'CALL');

        const parsed = LegFormInputSchema.safeParse({
            id: (row as HTMLElement & { dataset: DOMStringMap }).dataset.legId || this.generateLegId(index),
            orderType,
            type,
            quantity: getFieldValue('quantity'),
            multiplier: getFieldValue('multiplier'),
            executionDate: getFieldValue('executionDate'),
            expirationDate: getFieldValue('expirationDate'),
            strike: getFieldValue('strike'),
            premium: getFieldValue('premium'),
            fees: getFieldValue('fees'),
            underlyingPrice: getFieldValue('underlyingPrice'),
        });

        if (!parsed.success) {
            errors.push(formatZodIssues(parsed.error, `Leg ${index + 1}`));
            return;
        }

        const parsedLeg = parsed.data;
        const multiplier = Number.isFinite(parsedLeg.multiplier)
            ? parsedLeg.multiplier as number
            : this.getDefaultMultiplierForLegType(parsedLeg.type);

        const legData: Record<string, unknown> = {
            ...parsedLeg,
            multiplier
        };

        legs.push(legData);
    });

    if (errors.length > 0) {
        this.showNotification(errors.join('\n'), 'error');
        return null;
    }

    return legs;
}
