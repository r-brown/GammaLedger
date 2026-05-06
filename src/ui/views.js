// src/ui/views.js — Wave 9: View switching, form resets, and trade submission.
// Uses the .call(this, …) delegation pattern.

export function showView(viewName) {
    // Update navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    const navItem = document.querySelector(`[data-view="${viewName}"]`);
    if (navItem) {
        navItem.classList.add('active');
    }

    // Update views
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });
    const targetView = document.querySelector(`.${viewName}-view`);
    if (targetView) {
        targetView.classList.add('active');
    }

    // Update page title
    const titles = {
        dashboard: 'Options Trading Dashboard',
        'add-trade': this.currentEditingId ? 'Edit Trade' : 'Add New Trade',
        'trades-list': 'All Trades',
        import: 'Import Trades',
        settings: 'Settings',
        'credit-playbook': 'Credit Playbook (beta)'
    };
    const titleText = titles[viewName] || 'GammaLedger';
    document.getElementById('page-title').textContent = titleText;

    this.currentView = viewName;

    // Load view-specific data
    switch (viewName) {
        case 'dashboard':
            this.updateDashboard();
            break;
        case 'add-trade':
            if (!this.currentEditingId) {
                this.resetAddTradeForm();
            }
            break;
        case 'trades-list':
            this.updateTradesList();
            break;
        case 'import':
            this.setupImportControls();
            this.renderImportLog();
            break;
        case 'credit-playbook':
            this.initializeCreditPlaybookControls();
            this.updateCreditPlaybookView();
            break;
        case 'settings': {
            const lastStatus = this.finnhub?.lastStatus;
            if (lastStatus && this.finnhub?.elements?.status) {
                this.updateFinnhubStatus(lastStatus.message, lastStatus.variant, 0);
            }
            break;
        }
    }
}

export function resetAddTradeForm() {
    const form = document.getElementById('add-trade-form');
    if (form) {
        form.reset();
    }

    const underlyingTypeSelect = document.getElementById('underlyingType');
    if (underlyingTypeSelect) {
        underlyingTypeSelect.value = 'Stock';
    }

    const tradeStatusSelect = document.getElementById('tradeStatus');
    if (tradeStatusSelect) {
        tradeStatusSelect.value = '';
    }

    this.currentEditingId = null;
    this.renderLegForms([]);

    this.setTodayDate();
    this.updateTickerPreview('');
    }

export function handleTradeSubmit() {
    const form = document.getElementById('add-trade-form');
    if (!form) {
        return;
    }

    const formData = new FormData(form);
    const legs = this.collectLegsFromForm();
    if (legs === null) {
        return;
    }
    if (legs.length === 0) {
        this.showNotification('Add at least one leg before saving the trade.', 'error');
        return;
    }

    const tickerRaw = (formData.get('ticker') || '').toString().trim().toUpperCase();
    if (!tickerRaw) {
        this.showNotification('Ticker is required.', 'error');
        return;
    }

    const strategyRaw = (formData.get('strategy') || '').toString().trim();
    if (!strategyRaw) {
        this.showNotification('Strategy is required.', 'error');
        return;
    }

    const underlyingType = this.normalizeUnderlyingType(formData.get('underlyingType'), { fallback: 'Stock' });
    const statusOverride = this.normalizeTradeStatusInput(formData.get('tradeStatus'));

    const tradeData = {
        ticker: tickerRaw,
        strategy: strategyRaw,
        exitReason: (formData.get('exitReason') || '').toString().trim(),
        notes: (formData.get('notes') || '').toString().trim(),
        legs,
        underlyingType
    };

    if (statusOverride) {
        tradeData.statusOverride = statusOverride;
    }

    if (this.currentEditingId) {
        tradeData.id = this.currentEditingId;
        if (this.updateTrade(tradeData)) {
            this.showNotification('Trade updated successfully', 'success');
            this.resetAddTradeForm();
            this.showView('trades-list');
        }
        return;
    }

    tradeData.id = Date.now();
    const enrichedTrade = this.enrichTradeData(tradeData);
    this.trades.push(enrichedTrade);
    this.saveToStorage();
    this.markUnsavedChanges();

    this.resetAddTradeForm();
    this.showView('dashboard');
}

export function updateTrade(tradeData) {
    try {
        tradeData.id = this.currentEditingId;
        const enrichedTrade = this.enrichTradeData(tradeData);

        const index = this.trades.findIndex(t => t.id === this.currentEditingId);
        if (index !== -1) {
            this.trades[index] = enrichedTrade;
            this.saveToStorage();
            this.markUnsavedChanges();
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error updating trade:', error);
        return false;
    }
}

export function setTodayDate() {
    const today = this.currentDate;
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayString = `${year}-${month}-${day}`;

    const entryDateField = document.getElementById('entryDate');
    if (entryDateField && !this.currentEditingId) {
        entryDateField.value = todayString;
    }
}

export function updateTickerPreview(ticker) {
    const preview = document.getElementById('ticker-preview');
    if (ticker && ticker.trim()) {
        const tickerUpper = ticker.toUpperCase().trim();
        const url = this.generateTickerLink(tickerUpper);

        preview.innerHTML = '';
        const text = document.createTextNode('Search ');
        preview.appendChild(text);

        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.className = 'ticker-link';
        link.textContent = tickerUpper;
        link.addEventListener('click', (e) => {
            e.preventDefault();
            window.open(url, '_blank', 'noopener,noreferrer');
        });
        preview.appendChild(link);

        const text2 = document.createTextNode(' on Investing.com');
        preview.appendChild(text2);
    } else {
        preview.innerHTML = '';
    }
}
