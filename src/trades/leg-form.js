// src/trades/leg-form.js — Wave 11: Leg form UI helpers.
// Uses the .call(this, …) delegation pattern.

export function getLegsContainer() {
    return document.getElementById('trade-legs-container');
}

export function generateLegId(index = 0) {
    const base = this.currentEditingId || 'NEW';
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).slice(2, 6);
    return `${base}-LEG-${timestamp}-${index}-${random}`;
}

export function clearLegFormRows() {
    const container = this.getLegsContainer();
    if (container) {
        container.innerHTML = '';
    }
}

export function getSelectedUnderlyingType({ fallback = 'Stock' } = {}) {
    const select = document.getElementById('underlyingType');
    return this.normalizeUnderlyingType(select?.value, { fallback });
}

export function getDefaultMultiplierForLegType(legType, underlyingType = 'Stock') {
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

export function syncLegMultiplierVisibility(row, { defaultMultiplier = null } = {}) {
    if (!row) {
        return;
    }

    const multiplierGroup = row.querySelector('[data-leg-group="multiplier"]');
    const multiplierInput = row.querySelector('[data-leg-field="multiplier"]');
    const toggleButton = row.querySelector('.trade-leg__multiplier-toggle');
    const typeSelect = row.querySelector('[data-leg-field="type"]');

    if (!multiplierGroup || !multiplierInput || !toggleButton || !typeSelect) {
        return;
    }

    const underlyingType = this.getSelectedUnderlyingType({ fallback: 'Stock' });
    const normalizedLegType = this.normalizeLegType(typeSelect.value || 'CALL');
    const fallbackMultiplier = Number.isFinite(defaultMultiplier)
        ? defaultMultiplier
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

export function syncLegTypeFieldVisibility(row) {
    if (!row) {
        return;
    }
    const typeSelect = row.querySelector('[data-leg-field="type"]');
    if (!typeSelect) {
        return;
    }
    const legType = this.normalizeLegType(typeSelect.value || 'CALL');
    const isCash = legType === 'CASH';
    const isStock = legType === 'STOCK';

    // Strike: hide for CASH and STOCK types
    const strikeGroup = row.querySelector('[data-leg-group="strike-group"]');
    if (strikeGroup) {
        strikeGroup.classList.toggle('is-hidden', isCash || isStock);
    }

    // Expiration: hide for CASH and STOCK types
    const expirationGroup = row.querySelector('[data-leg-group="expiration-group"]');
    if (expirationGroup) {
        expirationGroup.classList.toggle('is-hidden', isCash || isStock);
    }

    // Premium label: clarify for CASH settlement legs
    const premiumLabel = row.querySelector('[data-leg-label="premium"]');
    if (premiumLabel) {
        if (isCash) {
            premiumLabel.textContent = 'Settlement Amount (per point)';
        } else {
            premiumLabel.textContent = 'Premium (per share)';
        }
    }
}

export function applyUnderlyingTypeToLegMultipliers({ row = null, force = false } = {}) {
    const container = this.getLegsContainer();
    if (!container) {
        return;
    }

    const rows = row ? [row] : Array.from(container.querySelectorAll('.trade-leg'));
    if (!rows.length) {
        return;
    }

    const underlyingType = this.getSelectedUnderlyingType({ fallback: 'Stock' });

    rows.forEach((legRow) => {
        const typeSelect = legRow.querySelector('[data-leg-field="type"]');
        const multiplierInput = legRow.querySelector('[data-leg-field="multiplier"]');
        if (!typeSelect || !multiplierInput) {
            return;
        }

        const defaultMultiplier = this.getDefaultMultiplierForLegType(typeSelect.value || 'CALL', underlyingType);
        const currentValue = Number(multiplierInput.value);
        const isOpen = legRow.classList.contains('trade-leg--multiplier-open');

        if (force || !Number.isFinite(currentValue) || currentValue <= 0) {
            multiplierInput.value = defaultMultiplier;
        } else if (!isOpen) {
            const shouldReset = currentValue === 0;
            if (shouldReset) {
                multiplierInput.value = defaultMultiplier;
            }
        }

        this.syncLegMultiplierVisibility(legRow, { defaultMultiplier });
    });
}

export function renderLegForms(legs = []) {
    const container = this.getLegsContainer();
    if (!container) {
        return;
    }

    this.clearLegFormRows();

    if (Array.isArray(legs) && legs.length > 0) {
        legs.forEach(leg => this.addLegFormRow(leg));
    } else {
        this.addLegFormRow();
    }

    this.updateLegRowNumbers();
    this.applyUnderlyingTypeToLegMultipliers({ force: !Array.isArray(legs) || legs.length === 0 });
}

export function addLegFormRow(leg = null) {
    const container = this.getLegsContainer();
    if (!container) {
        return null;
    }

    const row = document.createElement('div');
    row.className = 'trade-leg';

    const existingRows = container.querySelectorAll('.trade-leg').length;
    const legId = leg?.id || this.generateLegId(existingRows);
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

    const orderTypeSelect = row.querySelector('[data-leg-field="orderType"]');
    const normalizedOrderType = this.normalizeLegOrderType(
        leg?.orderType ||
        leg?.tradeType ||
        leg?.order ||
        this.deriveOrderTypeFromActionSide(leg?.action, leg?.side)
    );
    if (orderTypeSelect) {
        orderTypeSelect.value = normalizedOrderType;
    }

    const typeSelect = row.querySelector('[data-leg-field="type"]');
    const normalizedType = this.normalizeLegType(leg?.type || 'CALL');
    if (typeSelect) {
        typeSelect.value = normalizedType;
        typeSelect.addEventListener('change', () => {
            this.applyUnderlyingTypeToLegMultipliers({ row, force: true });
            this.syncLegTypeFieldVisibility(row);
        });
    }

    const baseUnderlyingType = this.getSelectedUnderlyingType({ fallback: 'Stock' });
    const legUnderlyingType = this.normalizeUnderlyingType(leg?.underlyingType, { fallback: baseUnderlyingType });

    const quantityInput = row.querySelector('[data-leg-field="quantity"]');
    if (quantityInput) {
        if (leg && Number.isFinite(Number(leg.quantity))) {
            quantityInput.value = Math.abs(Number(leg.quantity));
        } else {
            quantityInput.value = 1;
        }
    }

    const executionInput = row.querySelector('[data-leg-field="executionDate"]');
    if (executionInput) {
        executionInput.value = leg?.executionDate || '';
    }

    const expirationInput = row.querySelector('[data-leg-field="expirationDate"]');
    if (expirationInput) {
        expirationInput.value = leg?.expirationDate || '';
    }

    const strikeInput = row.querySelector('[data-leg-field="strike"]');
    if (strikeInput) {
        strikeInput.value = Number.isFinite(Number(leg?.strike)) ? Number(leg.strike) : '';
    }

    const premiumInput = row.querySelector('[data-leg-field="premium"]');
    if (premiumInput) {
        premiumInput.value = Number.isFinite(Number(leg?.premium)) ? Number(leg.premium) : '';
    }

    const feesInput = row.querySelector('[data-leg-field="fees"]');
    if (feesInput) {
        if (Number.isFinite(Number(leg?.fees))) {
            // Existing leg has a fee value
            feesInput.value = Number(leg.fees);
        } else if (!leg && this.defaultFeePerContract !== null) {
            // New leg - apply default fee based on quantity (default quantity is 1)
            const defaultFee = this.getDefaultFeeForQuantity(1);
            if (defaultFee !== null) {
                feesInput.value = defaultFee;
            }
        } else {
            feesInput.value = '';
        }
    }

    // Update fees when quantity changes (only for new legs with default fee set)
    if (!leg && this.defaultFeePerContract !== null) {
        quantityInput?.addEventListener('change', () => {
            const qty = Math.abs(Number(quantityInput.value) || 1);
            const defaultFee = this.getDefaultFeeForQuantity(qty);
            if (defaultFee !== null && feesInput) {
                feesInput.value = defaultFee;
            }
        });
    }

    const multiplierInput = row.querySelector('[data-leg-field="multiplier"]');
    if (multiplierInput) {
        const providedMultiplier = Number.isFinite(Number(leg?.multiplier)) && Number(leg.multiplier) > 0
            ? Number(leg.multiplier)
            : this.getDefaultMultiplierForLegType(normalizedType, legUnderlyingType);
        multiplierInput.value = providedMultiplier;
        ['change', 'input'].forEach((eventName) => {
            multiplierInput.addEventListener(eventName, () => {
                this.syncLegMultiplierVisibility(row);
            });
        });
    }

    const multiplierToggle = row.querySelector('.trade-leg__multiplier-toggle');
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

    const underlyingInput = row.querySelector('[data-leg-field="underlyingPrice"]');
    const shouldAutoFillPrice = underlyingInput && !Number.isFinite(Number(leg?.underlyingPrice));
    
    if (underlyingInput) {
        if (Number.isFinite(Number(leg?.underlyingPrice))) {
            // Use provided underlying price (e.g., when editing existing leg)
            underlyingInput.value = Number(leg.underlyingPrice);
        }
        // Auto-fill will happen after row is appended to DOM
    }

    const removeButton = row.querySelector('.trade-leg__remove');
    if (removeButton) {
        removeButton.addEventListener('click', () => {
            this.removeLegFormRow(row);
        });
    }

    // Close Leg button - creates a closing leg with inverted action
    const closeButton = row.querySelector('.trade-leg__close');
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
    if (shouldAutoFillPrice) {
        this.autoFillUnderlyingPrice(underlyingInput);
    }
    
    return row;
}

export function removeLegFormRow(row) {
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

export function createClosingLegFromRow(sourceRow) {
    if (!sourceRow) {
        return;
    }

    // Extract values from the source leg
    const orderTypeSelect = sourceRow.querySelector('[data-leg-field="orderType"]');
    const typeSelect = sourceRow.querySelector('[data-leg-field="type"]');
    const quantityInput = sourceRow.querySelector('[data-leg-field="quantity"]');
    const executionInput = sourceRow.querySelector('[data-leg-field="executionDate"]');
    const expirationInput = sourceRow.querySelector('[data-leg-field="expirationDate"]');
    const strikeInput = sourceRow.querySelector('[data-leg-field="strike"]');
    const multiplierInput = sourceRow.querySelector('[data-leg-field="multiplier"]');

    const orderType = orderTypeSelect?.value || 'BTO';
    const instrumentType = typeSelect?.value || 'CALL';
    const quantity = quantityInput?.value || 1;
    const executionDate = executionInput?.value || '';
    const expirationDate = expirationInput?.value || '';
    const strike = strikeInput?.value || '';
    const multiplier = multiplierInput?.value || '';

    // Determine the closing order type
    // BTO -> STC (bought to open, sell to close)
    // STO -> BTC (sold to open, buy to close)
    // BTC -> already a close, don't create another
    // STC -> already a close, don't create another
    let closingOrderType;
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
    const closingLeg = {
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
            const premiumInput = newRow.querySelector('[data-leg-field="premium"]');
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

export function updateLegRowNumbers() {
    const container = this.getLegsContainer();
    if (!container) {
        return;
    }

    Array.from(container.querySelectorAll('.trade-leg')).forEach((row, index) => {
        const label = row.querySelector('[data-leg-label]');
        if (label) {
            label.textContent = `Leg ${index + 1}`;
        }

        const removeButton = row.querySelector('.trade-leg__remove');
        if (removeButton) {
            removeButton.disabled = container.children.length === 1;
        }
    });
}

export function collectLegsFromForm() {
    const container = this.getLegsContainer();
    if (!container) {
        return [];
    }

    const rows = Array.from(container.querySelectorAll('.trade-leg'));
    if (rows.length === 0) {
        return [];
    }

    const legs = [];
    const errors = [];
    const tradeUnderlyingType = this.getSelectedUnderlyingType({ fallback: 'Stock' });

    rows.forEach((row, index) => {
        const getFieldValue = (name) => {
            const field = row.querySelector(`[data-leg-field="${name}"]`);
            return field ? field.value : '';
        };

        const orderType = this.normalizeLegOrderType(getFieldValue('orderType') || 'BTO');
        const type = this.normalizeLegType(getFieldValue('type') || 'CALL');

        const quantityRaw = getFieldValue('quantity');
        const quantityParsed = this.parseInteger(quantityRaw, null, { allowNegative: false });
        if (!Number.isFinite(quantityParsed) || quantityParsed <= 0) {
            errors.push(`Leg ${index + 1} must have a quantity greater than 0.`);
            return;
        }

        const multiplierRaw = getFieldValue('multiplier');
        const multiplierParsed = this.parseInteger(multiplierRaw, null, { allowNegative: false });
        const multiplier = Number.isFinite(multiplierParsed) && multiplierParsed > 0
            ? multiplierParsed
            : this.getDefaultMultiplierForLegType(type, tradeUnderlyingType);

        const strikeRaw = getFieldValue('strike');
        const strike = this.parseDecimal(strikeRaw, null, { allowNegative: false });

        const premiumRaw = getFieldValue('premium');
        const premium = this.parseDecimal(premiumRaw, 0, { allowNegative: false });

        const feesRaw = getFieldValue('fees');
        const fees = this.parseDecimal(feesRaw, 0, { allowNegative: true });

        const underlyingRaw = getFieldValue('underlyingPrice');
        const underlyingPrice = this.parseDecimal(underlyingRaw, null, { allowNegative: false });

        const executionDate = getFieldValue('executionDate') || '';
        const expirationDate = getFieldValue('expirationDate') || '';

        const legData = {
            id: row.dataset.legId || this.generateLegId(index),
            orderType,
            type,
            quantity: quantityParsed,
            multiplier,
            executionDate,
            expirationDate,
            strike,
            premium,
            fees,
            underlyingPrice,
            underlyingType: tradeUnderlyingType
        };

        legs.push(legData);
    });

    if (errors.length > 0) {
        this.showNotification(errors.join('\n'), 'error');
        return null;
    }

    return legs;
}
