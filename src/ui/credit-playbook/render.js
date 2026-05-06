// src/ui/credit-playbook/render.js — Wave 9: Credit playbook rendering.
// Uses the .call(this, …) delegation pattern.

export function renderCreditPlaybookDetailCell(cell, entry) {
    cell.innerHTML = '';

    const stageContainer = document.createElement('div');
    stageContainer.className = 'credit-stage-group';
    cell.appendChild(stageContainer);

    const summary = entry.summary;
    const primaryLeg = summary?.primaryLeg;
    
    // Build primary leg label with more detail
    if (primaryLeg) {
        const action = this.getLegAction(primaryLeg) || '';
        const type = (primaryLeg.type || '').toUpperCase();
        const strike = Number(primaryLeg.strike);
        const expiration = primaryLeg.expirationDate;
        
        const actionLabel = action ? `${action.charAt(0)}${action.slice(1).toLowerCase()}` : '';
        let stageLabel = actionLabel;
        
        if (Number.isFinite(strike) && ['CALL', 'PUT'].includes(type)) {
            const formattedStrike = this.formatNumber(strike, { decimals: 2, useGrouping: false }) ?? strike.toFixed(2);
            const typeSuffix = type === 'CALL' ? 'C' : 'P';
            stageLabel = `${stageLabel ? `${stageLabel} ` : ''}${formattedStrike}${typeSuffix}`;
            
            // Add expiration if available
            if (expiration) {
                const expText = this.formatDate(expiration);
                if (expText && expText !== '—') {
                    stageLabel += ` ${expText}`;
                }
            }
        } else if (type) {
            stageLabel = `${stageLabel ? `${stageLabel} ` : ''}${type}`;
        }
        
        stageContainer.appendChild(this.createCreditStage(stageLabel || entry.strategy, 'primary'));
    } else {
        stageContainer.appendChild(this.createCreditStage(entry.strategy || entry.ticker, 'primary'));
    }

    // Show number of legs if multi-leg strategy
    if (summary && summary.legsCount > 1) {
        const legTypeBreakdown = [];
        if (summary.openLegs > 0) legTypeBreakdown.push(`${summary.openLegs} open`);
        if (summary.closeLegs > 0) legTypeBreakdown.push(`${summary.closeLegs} close`);
        if (summary.rollLegs > 0) legTypeBreakdown.push(`${summary.rollLegs} roll`);
        
        const legLabel = legTypeBreakdown.length 
            ? `${summary.legsCount} legs (${legTypeBreakdown.join(', ')})`
            : `${summary.legsCount} legs`;
        stageContainer.appendChild(this.createCreditStage(legLabel));
    }

    if (Number.isFinite(entry.premium) && entry.premium !== 0) {
        const premiumLabel = entry.premium >= 0 
            ? `Credit ${this.formatCurrency(entry.premium)}`
            : `Debit ${this.formatCurrency(Math.abs(entry.premium))}`;
        stageContainer.appendChild(this.createCreditStage(premiumLabel));
    }

    if (entry.contracts > 0) {
        const contractsLabel = `${entry.contracts} contract${entry.contracts === 1 ? '' : 's'}`;
        stageContainer.appendChild(this.createCreditStage(contractsLabel));
    }

    if (entry.expirationLabel) {
        const expirationText = this.formatDate(entry.expirationLabel);
        if (expirationText && expirationText !== '—') {
            const dte = Number(entry.dte);
            const variant = Number.isFinite(dte) && dte <= this.positionHighlightConfig.expirationCriticalDays
                ? 'warning'
                : 'default';
            const dteLabel = Number.isFinite(dte) ? ` (${dte}d)` : '';
            stageContainer.appendChild(this.createCreditStage(`Exp ${expirationText}${dteLabel}`, variant));
        }
    }

    const metaParts = [];
    
    // Add entry and exit prices if available
    if (Number.isFinite(summary?.entryPrice) && summary.entryPrice > 0) {
        metaParts.push(`Entry ${this.formatCurrency(summary.entryPrice)}`);
    }
    if (Number.isFinite(summary?.exitPrice) && summary.exitPrice > 0) {
        metaParts.push(`Exit ${this.formatCurrency(summary.exitPrice)}`);
    }
    
    if (Number.isFinite(entry.capitalAtRisk) && entry.capitalAtRisk > 0) {
        metaParts.push(`Risk ${this.formatCurrency(entry.capitalAtRisk)}`);
    }
    
    if (Number.isFinite(entry.capitalPerContract) && entry.capitalPerContract > 0) {
        metaParts.push(`Risk/contract ${this.formatCurrency(entry.capitalPerContract)}`);
    }
    
    if (Number.isFinite(entry.premiumPerContract)) {
        const perContractLabel = entry.premiumPerContract >= 0
            ? `Credit/contract ${this.formatCurrency(entry.premiumPerContract)}`
            : `Debit/contract ${this.formatCurrency(Math.abs(entry.premiumPerContract))}`;
        metaParts.push(perContractLabel);
    }
    
    // Add fees if significant
    if (Number.isFinite(summary?.totalFees) && summary.totalFees > 0) {
        metaParts.push(`Fees ${this.formatCurrency(summary.totalFees)}`);
    }

    if (metaParts.length) {
        const meta = document.createElement('span');
        meta.className = 'credit-playbook-detail-meta';
        meta.textContent = metaParts.join(' • ');
        cell.appendChild(meta);
    }
}

export function createCreditStage(label, variant = 'default') {
    const stage = document.createElement('span');
    stage.className = 'credit-stage';
    if (variant && variant !== 'default') {
        stage.classList.add(`credit-stage--${variant}`);
    }
    stage.textContent = label;
    return stage;
}

export function isCreditStrategyTrade(trade = {}) {
    const normalized = this.normalizeCreditPlaybookStrategyValue(trade.strategy);
    return Boolean(normalized);
}

export function mapCreditTradeToEntry(trade = {}) {
    const ticker = (trade.ticker || '').toString().trim().toUpperCase();
    if (!ticker) {
        return null;
    }

    const strategy = this.normalizeCreditPlaybookStrategyValue(trade.strategy) || (trade.strategy || '').toString().trim();
    const normalizedStatus = this.normalizeStatus(trade.status);
    const isOpen = !this.isClosedStatus(trade.status);

    const summary = this.summarizeLegs(trade.legs || []);
    const openedAt = this.resolveCreditPlaybookOpenedAt(trade, summary);
    const openedDate = openedAt ? openedAt.toISOString().slice(0, 10) : '';

    let dte = this.parseInteger(trade.dte, null, { allowNegative: true });
    if (!Number.isFinite(dte) && summary.latestExpiration instanceof Date) {
        const diffMs = summary.latestExpiration.getTime() - this.currentDate.getTime();
        if (Number.isFinite(diffMs)) {
            dte = Math.round(diffMs / (24 * 60 * 60 * 1000));
        }
    }

    const expiration = summary.nextShortCallExpiration
        || summary.nearestShortCallExpiration
        || summary.latestExpiration
        || summary.earliestExpiration;
    const expirationLabel = expiration instanceof Date
        ? expiration.toISOString().slice(0, 10)
        : '';

    const netOptionContracts = this.getNetOpenOptionContracts(summary.legs);
    const contracts = netOptionContracts > 0
        ? netOptionContracts
        : Number(summary.openBaseContracts || summary.openContracts || 0);
    const netPremium = Number(summary.openCashFlow) || 0;
    const capitalAtRisk = this.getCapitalAtRisk(trade);
    const capitalValue = Number.isFinite(capitalAtRisk) && capitalAtRisk >= 0 ? capitalAtRisk : null;
    const plValue = Number(trade.pl);
    const roiValue = Number(trade.roi);

    let derivedRoi = Number.isFinite(roiValue) ? roiValue : null;
    if (derivedRoi === null && Number.isFinite(plValue) && Number.isFinite(capitalValue) && capitalValue > 0) {
        derivedRoi = (plValue / capitalValue) * 100;
    }

    const currentPrice = this.deriveCreditPlaybookPrice(trade);

    const premiumPerContract = contracts > 0 ? netPremium / contracts : null;
    const capitalPerContract = Number.isFinite(capitalValue) && contracts > 0 ? capitalValue / contracts : null;

    return {
        trade,
        ticker,
        strategy: strategy || '—',
        normalizedStatus,
        status: this.getDisplayStatus(trade),
        isOpen,
        openedDate,
        openedDateValue: openedAt,
        expiration,
        expirationLabel,
        dte: Number.isFinite(dte) ? dte : null,
        premium: Number.isFinite(netPremium) ? netPremium : 0,
        capital: capitalValue,
        capitalAtRisk: capitalValue,
        premiumPerContract: Number.isFinite(premiumPerContract) ? premiumPerContract : null,
        capitalPerContract: Number.isFinite(capitalPerContract) ? capitalPerContract : null,
        contracts,
        currentPrice: Number.isFinite(currentPrice) ? currentPrice : null,
        pl: Number.isFinite(plValue) ? plValue : null,
        roi: Number.isFinite(derivedRoi) ? derivedRoi : null,
        position: strategy || ticker,
        summary
    };
}

export function resolveCreditPlaybookOpenedAt(trade = {}, summary = {}) {
    const candidates = [
        this.parseDateValue(trade.openedDate),
        this.parseDateValue(trade.entryDate),
        this.parseDateValue(trade.tradeDate),
        this.parseDateValue(trade.openDate),
        summary?.openedDate instanceof Date ? summary.openedDate : null
    ];

    for (const candidate of candidates) {
        if (candidate instanceof Date && !Number.isNaN(candidate.getTime())) {
            return candidate;
        }
    }

    if (Array.isArray(trade.legs)) {
        const dates = trade.legs
            .map((leg) => this.parseDateValue(leg?.executionDate))
            .filter((date) => date instanceof Date && !Number.isNaN(date.getTime()))
            .sort((a, b) => a.getTime() - b.getTime());
        if (dates.length > 0) {
            return dates[0];
        }
    }

    return null;
}

export function deriveCreditPlaybookPrice(trade = {}) {
    const candidates = [
        trade.currentPrice,
        trade.marketPrice,
        trade.lastPrice,
        trade.stockPrice,
        trade.underlyingPrice,
        trade.stockPriceAtEntry
    ];

    for (const candidate of candidates) {
        const parsed = this.parseDecimal(candidate, null, { allowNegative: false });
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }

    return null;
}

export function filterCreditPlaybookEntries(entries = []) {
    const statusFilter = this.creditPlaybookStatus;
    const strategyFilter = this.creditPlaybookStrategy;
    const horizonFilter = this.creditPlaybookHorizon;
    const symbolFilter = this.creditPlaybookSymbol;
    const now = this.currentDate instanceof Date ? this.currentDate : new Date();
    const dayMs = 24 * 60 * 60 * 1000;

    return entries.filter((entry) => {
        if (statusFilter === 'active' && !entry.isOpen) {
            return false;
        }
        if (statusFilter === 'closed' && entry.isOpen) {
            return false;
        }

        if (strategyFilter !== 'all') {
            const normalizedEntryStrategy = this.normalizeCreditPlaybookStrategyValue(entry.strategy);
            if (normalizedEntryStrategy !== strategyFilter) {
                return false;
            }
        }

        if (symbolFilter && (!entry.ticker || !entry.ticker.includes(symbolFilter))) {
            return false;
        }

        if (horizonFilter !== 'all') {
            const openedAt = entry.openedDateValue instanceof Date ? entry.openedDateValue : null;
            if (!openedAt) {
                return false;
            }

            if (horizonFilter === 'ytd') {
                if (openedAt.getFullYear() !== now.getFullYear()) {
                    return false;
                }
            } else if (horizonFilter === 'mtd') {
                if (openedAt.getFullYear() !== now.getFullYear() || openedAt.getMonth() !== now.getMonth()) {
                    return false;
                }
            } else {
                const days = Number.parseInt(horizonFilter, 10);
                if (Number.isFinite(days)) {
                    const cutoff = new Date(now.getTime() - (days * dayMs));
                    if (openedAt < cutoff) {
                        return false;
                    }
                }
            }
        }

        return true;
    });
}

export function filterCreditPlaybookLegPairs(legPairs = []) {
    const statusFilter = this.creditPlaybookStatus;
    const strategyFilter = this.creditPlaybookStrategy;
    const horizonFilter = this.creditPlaybookHorizon;
    const symbolFilter = this.creditPlaybookSymbol;
    const now = this.currentDate instanceof Date ? this.currentDate : new Date();
    const dayMs = 24 * 60 * 60 * 1000;

    return legPairs.filter((pair) => {
        // Status filter
        if (statusFilter === 'active' && !pair.isOpen) {
            return false;
        }
        if (statusFilter === 'closed' && pair.isOpen) {
            return false;
        }
        if (strategyFilter !== 'all') {
            const normalizedPairStrategy = this.normalizeCreditPlaybookStrategyValue(pair.strategy);
            if (normalizedPairStrategy !== strategyFilter) {
                return false;
            }
        }

        if (symbolFilter && (!pair.ticker || !pair.ticker.includes(symbolFilter))) {
            return false;
        }

        if (horizonFilter !== 'all') {
            const entryDate = pair.entryDate instanceof Date ? pair.entryDate : null;
            if (!entryDate) {
                return false;
            }

            if (horizonFilter === 'ytd') {
                if (entryDate.getFullYear() !== now.getFullYear()) {
                    return false;
                }
            } else if (horizonFilter === 'mtd') {
                if (entryDate.getFullYear() !== now.getFullYear() || entryDate.getMonth() !== now.getMonth()) {
                    return false;
                }
            } else {
                const days = Number.parseInt(horizonFilter, 10);
                if (Number.isFinite(days)) {
                    const cutoff = new Date(now.getTime() - (days * dayMs));
                    if (entryDate < cutoff) {
                        return false;
                    }
                }
            }
        }

        return true;
    });
}

export function applyCreditPlaybookSort(entries = []) {
    const sortKey = this.creditPlaybookSort?.key || 'openedDate';
    const direction = this.creditPlaybookSort?.direction === 'asc' ? 'asc' : 'desc';

    return entries.slice().sort((a, b) => {
        const aVal = this.getSortableValue(a, sortKey);
        const bVal = this.getSortableValue(b, sortKey);
        const comparison = this.compareSortableValues(aVal, bVal);
        return direction === 'asc' ? comparison : -comparison;
    });
}

export function applyCreditPlaybookSortToLegPairs(legPairs = []) {
    const sortKey = this.creditPlaybookSort?.key || 'entryDate';
    const direction = this.creditPlaybookSort?.direction === 'asc' ? 'asc' : 'desc';

    return legPairs.slice().sort((a, b) => {
        let aVal, bVal;

        // Map sort keys to leg pair properties
        switch (sortKey) {
            case 'ticker':
                aVal = a.ticker || '';
                bVal = b.ticker || '';
                break;
            case 'strategy':
                aVal = a.strategy || '';
                bVal = b.strategy || '';
                break;
            case 'type':
                aVal = a.type || '';
                bVal = b.type || '';
                break;
            case 'strike':
                // Handle both numeric strikes and spread strikes (e.g., "100/105")
                if (typeof a.strike === 'string' && a.strike.includes('/')) {
                    aVal = parseFloat(a.strike.split('/')[0]) || 0;
                } else {
                    aVal = Number(a.strike) || 0;
                }
                if (typeof b.strike === 'string' && b.strike.includes('/')) {
                    bVal = parseFloat(b.strike.split('/')[0]) || 0;
                } else {
                    bVal = Number(b.strike) || 0;
                }
                break;
            case 'status':
                // Assigned > Rolling > Open > Expired > Closed
                aVal = a.isAssigned ? -1 : (a.isRolling ? 0 : (a.isExpired && a.isOpen ? 2 : (a.isOpen ? 1 : 3)));
                bVal = b.isAssigned ? -1 : (b.isRolling ? 0 : (b.isExpired && b.isOpen ? 2 : (b.isOpen ? 1 : 3)));
                break;
            case 'quantity':
                aVal = Number(a.quantity) || 0;
                bVal = Number(b.quantity) || 0;
                break;
            case 'pricePerContract':
                aVal = Number(a.pricePerContract) || 0;
                bVal = Number(b.pricePerContract) || 0;
                break;
            case 'fees':
                aVal = Number(a.fees) || 0;
                bVal = Number(b.fees) || 0;
                break;
            case 'premium':
                aVal = Number(a.premium) || 0;
                bVal = Number(b.premium) || 0;
                break;
            case 'pl':
                aVal = Number(a.pl) || 0;
                bVal = Number(b.pl) || 0;
                break;
            case 'roi':
                aVal = Number(a.roi) ?? -Infinity;
                bVal = Number(b.roi) ?? -Infinity;
                break;
            case 'currentPrice':
                aVal = Number(a.currentPrice) || 0;
                bVal = Number(b.currentPrice) || 0;
                break;
            case 'entryDate':
                aVal = a.entryDate instanceof Date ? a.entryDate.getTime() : 0;
                bVal = b.entryDate instanceof Date ? b.entryDate.getTime() : 0;
                break;
            case 'expirationDate':
                aVal = a.expirationDate ? new Date(a.expirationDate).getTime() : 0;
                bVal = b.expirationDate ? new Date(b.expirationDate).getTime() : 0;
                break;
            case 'dte':
                aVal = Number(a.dte) ?? Infinity;
                bVal = Number(b.dte) ?? Infinity;
                break;
            case 'exitDate':
                aVal = a.exitDate instanceof Date ? a.exitDate.getTime() : 0;
                bVal = b.exitDate instanceof Date ? b.exitDate.getTime() : 0;
                break;
            case 'daysHeld':
                aVal = Number(a.daysHeld) ?? 0;
                bVal = Number(b.daysHeld) ?? 0;
                break;
            default:
                aVal = a[sortKey];
                bVal = b[sortKey];
        }

        const comparison = this.compareSortableValues(aVal, bVal);
        return direction === 'asc' ? comparison : -comparison;
    });
}

export function applyCreditPlaybookSortIndicators() {
    const table = document.getElementById('credit-playbook-table');
    if (!table) {
        return;
    }

    const headers = table.querySelectorAll('.sortable');
    headers.forEach((header) => {
        const sortKey = header.getAttribute('data-sort');
        const isActive = sortKey === this.creditPlaybookSort.key;
        header.classList.toggle('asc', isActive && this.creditPlaybookSort.direction === 'asc');
        header.classList.toggle('desc', isActive && this.creditPlaybookSort.direction === 'desc');
        header.setAttribute('aria-sort', isActive
            ? (this.creditPlaybookSort.direction === 'asc' ? 'ascending' : 'descending')
            : 'none');
    });
}

export function renderCreditPlaybookMetrics(legPairs = []) {
    const container = document.getElementById('credit-playbook-metrics');
    if (!container) {
        return;
    }

    container.innerHTML = '';

    const totalCount = legPairs.length;
    const openPairs = legPairs.filter((pair) => pair.isOpen);
    const closedPairs = legPairs.filter((pair) => !pair.isOpen);
    const openCount = openPairs.length;
    const closedCount = closedPairs.length;

    const totalPremium = legPairs.reduce((sum, pair) => sum + (Number(pair.premium) || 0), 0);
    const totalCapital = openPairs.reduce((sum, pair) => sum + (Number(pair.capital) || 0), 0);

    // Realized P&L from closed positions
    const realizedPL = closedPairs.reduce((sum, pair) => {
        const pl = Number(pair.pl);
        return Number.isFinite(pl) ? sum + pl : sum;
    }, 0);

    // Win rate from closed positions
    const winners = closedPairs.filter((p) => (Number(p.pl) || 0) > 0).length;
    const winRate = closedCount > 0 ? (winners / closedCount) * 100 : null;

    // Average DTE for open positions
    const openDTEs = openPairs.map((p) => Number(p.dte)).filter(Number.isFinite);
    const avgDTE = openDTEs.length > 0
        ? Math.round(openDTEs.reduce((s, d) => s + d, 0) / openDTEs.length)
        : null;

    const metrics = [
        {
            label: 'Positions',
            value: this.formatNumber(totalCount, { decimals: 0, useGrouping: true }) ?? String(totalCount),
            sublabel: `${openCount} active · ${closedCount} closed`
        },
        {
            label: 'Net Premium',
            value: this.formatCurrency(totalPremium),
            sublabel: 'Total credit/debit across all legs',
            valueClass: totalPremium >= 0 ? 'pl-positive' : 'pl-negative'
        },
        {
            label: 'Realized P&L',
            value: closedCount > 0 ? this.formatCurrency(realizedPL) : '—',
            sublabel: closedCount > 0 ? `From ${closedCount} closed position${closedCount === 1 ? '' : 's'}` : 'No closed positions yet',
            valueClass: realizedPL > 0 ? 'pl-positive' : (realizedPL < 0 ? 'pl-negative' : '')
        },
        {
            label: 'Win Rate',
            value: Number.isFinite(winRate)
                ? `${(this.formatNumber(winRate, { decimals: 1, useGrouping: false }) ?? winRate.toFixed(1))}%`
                : '—',
            sublabel: closedCount > 0 ? `${winners}W / ${closedCount - winners}L` : 'No closed positions'
        },
        {
            label: 'Active Risk',
            value: this.formatCurrency(totalCapital),
            sublabel: openCount > 0 ? `Across ${openCount} open position${openCount === 1 ? '' : 's'}` : 'No open positions'
        },
        {
            label: 'Avg DTE',
            value: Number.isFinite(avgDTE) ? String(avgDTE) : '—',
            sublabel: openDTEs.length > 0 ? `${openDTEs.length} open with expiration` : 'No active expirations'
        }
    ];

    metrics.forEach((metric) => {
        const card = document.createElement('div');
        card.className = 'card';

        const body = document.createElement('div');
        body.className = 'card__body';

        const valueEl = document.createElement('div');
        valueEl.className = 'card-value';
        if (metric.valueClass) {
            valueEl.classList.add(metric.valueClass);
        }
        valueEl.textContent = metric.value;

        const labelEl = document.createElement('small');
        labelEl.className = 'card-subtitle';
        labelEl.textContent = metric.label;

        body.appendChild(valueEl);
        body.appendChild(labelEl);

        if (metric.sublabel) {
            const sublabelEl = document.createElement('span');
            sublabelEl.className = 'credit-playbook-detail-meta';
            sublabelEl.textContent = metric.sublabel;
            body.appendChild(sublabelEl);
        }

        card.appendChild(body);
        container.appendChild(card);
    });
}

export function renderCreditPlaybookTableFromLegPairs(legPairs = []) {
    const table = document.getElementById('credit-playbook-table');
    if (!table) {
        return;
    }

    const tbody = table.querySelector('tbody');
    if (!tbody) {
        return;
    }

    tbody.innerHTML = '';

    if (!legPairs.length) {
        const row = tbody.insertRow();
        const cell = row.insertCell();
        const columnCount = table.tHead?.rows?.[0]?.cells?.length || 15;
        cell.colSpan = columnCount;
        cell.className = 'empty-table-message';
        cell.textContent = 'No positions match the current filters.';
        return;
    }

    legPairs.forEach((pair) => {
        const row = tbody.insertRow();
        row.dataset.tradeId = pair.tradeId || '';
        if (pair.ticker) {
            row.dataset.ticker = pair.ticker;
        }

        let columnIndex = 0;

        // Ticker
        const tickerCell = row.insertCell(columnIndex++);
        tickerCell.appendChild(this.createTickerElement(pair.ticker, 'ticker-pill', {
            behavior: 'filter',
            onClick: (value) => this.openTradesFilteredByTicker(value),
            title: pair.ticker ? `View trades for ${pair.ticker}` : ''
        }));

        // Strategy
        const strategyCell = row.insertCell(columnIndex++);
        strategyCell.textContent = pair.strategy || '—';

        // Type (CALL/PUT)
        const typeCell = row.insertCell(columnIndex++);
        const typeSpan = document.createElement('span');
        typeSpan.className = 'option-type-badge';
        if (pair.type === 'CALL') {
            typeSpan.classList.add('type-call');
            typeSpan.textContent = 'CALL';
        } else if (pair.type === 'PUT') {
            typeSpan.classList.add('type-put');
            typeSpan.textContent = 'PUT';
        } else if (pair.type === 'CALL/PUT') {
            typeSpan.classList.add('type-multi');
            typeSpan.textContent = 'C/P';
        } else {
            typeSpan.textContent = pair.type || '—';
        }
        typeCell.appendChild(typeSpan);

        // Strike Price
        const strikeCell = row.insertCell(columnIndex++);
        if (typeof pair.strike === 'string') {
            // Spread with multiple strikes
            strikeCell.textContent = pair.strike;
        } else if (Number.isFinite(pair.strike)) {
            strikeCell.textContent = this.formatNumber(pair.strike, { decimals: 2, useGrouping: false });
        } else {
            strikeCell.textContent = '—';
        }

        // Status
        const statusCell = row.insertCell(columnIndex++);
        const statusBadge = document.createElement('span');
        statusBadge.className = 'status-badge';
        
        let statusClass, statusText;
        if (pair.isAssigned) {
            statusClass = 'assigned';
            statusText = 'Assigned';
        } else if (pair.isRolling) {
            statusClass = 'rolling';
            statusText = 'Rolling';
        } else if (pair.isExpired && pair.isOpen) {
            statusClass = 'expired';
            statusText = 'Expired';
        } else if (pair.isOpen) {
            statusClass = 'open';
            statusText = 'Open';
        } else {
            statusClass = 'closed';
            statusText = 'Closed';
        }
        
        statusBadge.classList.add(statusClass);
        statusBadge.textContent = statusText;
        statusCell.appendChild(statusBadge);

        // Contracts / Quantity
        const quantityCell = row.insertCell(columnIndex++);
        quantityCell.textContent = Number.isFinite(pair.quantity) ? pair.quantity : '—';

        // Price per Contract
        const pricePerContractCell = row.insertCell(columnIndex++);
        pricePerContractCell.textContent = Number.isFinite(pair.pricePerContract)
            ? this.formatCurrency(pair.pricePerContract)
            : '—';

        // Fees
        const feesCell = row.insertCell(columnIndex++);
        feesCell.textContent = Number.isFinite(pair.fees)
            ? this.formatCurrency(Math.abs(pair.fees))
            : '—';
        feesCell.className = 'pl-negative';

        // Premium
        const premiumCell = row.insertCell(columnIndex++);
        premiumCell.textContent = Number.isFinite(pair.premium)
            ? this.formatCurrency(pair.premium)
            : '—';
        premiumCell.className = pair.premium >= 0 ? 'pl-positive' : 'pl-negative';

        // P&L
        const plCell = row.insertCell(columnIndex++);
        if (Number.isFinite(pair.pl)) {
            plCell.textContent = this.formatCurrency(pair.pl);
            plCell.className = pair.pl > 0 ? 'pl-positive' : (pair.pl < 0 ? 'pl-negative' : 'pl-neutral');
        } else {
            plCell.textContent = '—';
        }

        // ROI
        const roiCell = row.insertCell(columnIndex++);
        if (Number.isFinite(pair.roi)) {
            const roiAbs = Math.abs(pair.roi);
            const roiStr = this.formatNumber(roiAbs, { decimals: 1, useGrouping: false }) ?? roiAbs.toFixed(1);
            const roiPrefix = pair.roi > 0 ? '+' : (pair.roi < 0 ? '-' : '');
            roiCell.textContent = `${roiPrefix}${roiStr}%`;
            roiCell.className = pair.roi > 0 ? 'pl-positive' : (pair.roi < 0 ? 'pl-negative' : 'pl-neutral');
        } else {
            roiCell.textContent = '—';
        }

        // Current Price (only for open positions)
        const currentPriceCell = row.insertCell(columnIndex++);
        currentPriceCell.className = 'quote-cell';
        if (!pair.isOpen || statusClass === 'closed' || statusClass === 'expired' || statusClass === 'assigned') {
            currentPriceCell.textContent = '—';
        } else {
            // Set up for live price fetching
            const baseQuoteKey = `${pair.ticker}|${pair.tradeId}`;
            const quoteKey = `${baseQuoteKey}|creditPlaybook:${legPairs.indexOf(pair)}`;
            row.dataset.quoteKey = quoteKey;
            row.dataset.ticker = pair.ticker;
            
            // Store strike for ITM detection
            if (typeof pair.strike === 'string' && pair.strike.includes('/')) {
                // For spreads, use first strike for highlighting
                const strikes = pair.strike.split('/').map(s => parseFloat(s.trim()));
                row.dataset.strikePrice = String(strikes[0]);
            } else if (Number.isFinite(pair.strike)) {
                row.dataset.strikePrice = String(pair.strike);
            }
            
            // Create mock trade object for quote fetching
            const mockTrade = {
                ticker: pair.ticker,
                optionType: pair.type?.toLowerCase(),
                strategy: pair.strategy,
                dte: pair.dte
            };
            
            // Populate quote cell with deferred fetch
            this.populateQuoteCell(currentPriceCell, mockTrade, row, { deferNetworkFetch: true });
            
            // Track for quote updates
            if (!this.creditPlaybookQuoteEntries) {
                this.creditPlaybookQuoteEntries = new Map();
            }
            this.creditPlaybookQuoteEntries.set(quoteKey, {
                trade: mockTrade,
                row,
                cell: currentPriceCell,
                key: quoteKey,
                pair
            });
        }

        // Entry Date
        const entryDateCell = row.insertCell(columnIndex++);
        entryDateCell.textContent = this.formatDate(pair.entryDate);

        // Expiration Date
        const expirationCell = row.insertCell(columnIndex++);
        expirationCell.textContent = this.formatDate(pair.expirationDate);

        // DTE
        const dteCell = row.insertCell(columnIndex++);
        if (Number.isFinite(pair.dte)) {
            dteCell.textContent = pair.dte;
        } else if (pair.isExpired || statusClass === 'expired') {
            dteCell.textContent = '0';
        } else if (!pair.isOpen) {
            dteCell.textContent = '—';
        } else {
            dteCell.textContent = '—';
        }

        // Apply DTE highlighting for open positions
        if (pair.isOpen && statusClass !== 'closed' && statusClass !== 'expired') {
            const mockTrade = { dte: pair.dte };
            this.updateExpirationHighlight(dteCell, mockTrade);
        }

        // Exit Date
        const exitDateCell = row.insertCell(columnIndex++);
        exitDateCell.textContent = pair.exitDate ? this.formatDate(pair.exitDate) : '—';

        // Days Held
        const daysHeldCell = row.insertCell(columnIndex++);
        daysHeldCell.textContent = Number.isFinite(pair.daysHeld) ? pair.daysHeld : '—';

        this.applyResponsiveLabels(row, [
            'Ticker',
            'Strategy',
            'Type',
            'Strike Price',
            'Status',
            'Contracts',
            'Price/Contract',
            'Fees',
            'Premium',
            'P&L',
            'ROI',
            'Current Price',
            'Entry Date',
            'Expiration Date',
            'DTE',
            'Exit Date',
            'Days Held'
        ]);
    });

    // Trigger quote fetching and auto-refresh for Credit Playbook if we have entries
    if (this.creditPlaybookQuoteEntries && this.creditPlaybookQuoteEntries.size > 0) {
        this.startQuoteAutoRefreshIfNeeded();
        this.refreshCreditPlaybookQuotes({ force: true, immediate: true });
    }
}
