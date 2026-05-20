// src/ui/views.ts — Wave 9: View switching, form resets, and trade submission.
// Uses the .call(this, …) delegation pattern.

import { TradeFormInputSchema, formatZodIssues } from '@core/schema'

type TradeRecord = Record<string, unknown>

interface ViewsContext {
  currentView: string
  currentEditingId: unknown
  trades: TradeRecord[]
  finnhub: Record<string, unknown>
  updateDashboard(): void
  resetAddTradeForm(): void
  updateTradesList(): void
  setupImportControls(): void
  renderImportLog(): void
  initializeCreditPlaybookControls(): void
  updateCreditPlaybookView(): void
  updateFinnhubStatus(message: string, variant: unknown, delay: number): void
  collectLegsFromForm(): TradeRecord[] | null
  showNotification(message: string, type: string): void
  normalizeUnderlyingType(value: unknown, opts: { fallback: string }): string
  normalizeTradeStatusInput(value: unknown): string | null
  enrichTradeData(data: TradeRecord): TradeRecord
  updateTrade(data: TradeRecord): boolean
  saveToStorage(): void
  markUnsavedChanges(): void
  filterTrades(): void
  renderLegForms(legs: unknown[]): void
  setTodayDate(): void
  updateTickerPreview(ticker: string): void
  generateTickerLink(ticker: string): string
  normalizeTradeStatusInput(value: unknown): string | null
  normalizeUnderlyingType(value: unknown, opts: { fallback: string }): string
  showView(viewName: string): void
}

export function showView(this: ViewsContext, viewName: string): void {
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
    const titles: Record<string, string> = {
        dashboard: 'Options Trading Dashboard',
        'add-trade': this.currentEditingId ? 'Edit Trade' : 'Add New Trade',
        'trades-list': 'All Trades',
        import: 'Import Trades',
        settings: 'Settings',
        'credit-playbook': 'Credit Playbook (beta)'
    };
    const titleText = titles[viewName] || 'GammaLedger';
    const titleEl = document.getElementById('page-title');
    if (titleEl) titleEl.textContent = titleText;

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
            const lastStatus = (this.finnhub?.lastStatus as Record<string, unknown> | undefined);
            const finnhubElements = ((this.finnhub as Record<string, unknown>)?.elements as Record<string, unknown> | undefined);
            if (lastStatus && finnhubElements?.status) {
                this.updateFinnhubStatus(lastStatus.message as string, lastStatus.variant, 0);
            }
            break;
        }
    }
}

export function resetAddTradeForm(this: ViewsContext): void {
    const form = document.getElementById('add-trade-form') as HTMLFormElement | null;
    if (form) {
        form.reset();
    }

    const underlyingTypeSelect = document.getElementById('underlyingType') as HTMLSelectElement | null;
    if (underlyingTypeSelect) {
        underlyingTypeSelect.value = 'Stock';
    }

    const tradeStatusSelect = document.getElementById('tradeStatus') as HTMLSelectElement | null;
    if (tradeStatusSelect) {
        tradeStatusSelect.value = '';
    }

    this.currentEditingId = null;
    this.renderLegForms([]);

    this.setTodayDate();
    this.updateTickerPreview('');
}

export function handleTradeSubmit(this: ViewsContext): void {
    const form = document.getElementById('add-trade-form') as HTMLFormElement | null;
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

    const parsedTrade = TradeFormInputSchema.safeParse({
        ticker: formData.get('ticker'),
        strategy: formData.get('strategy'),
        underlyingType: formData.get('underlyingType'),
        tradeStatus: formData.get('tradeStatus'),
        exitReason: formData.get('exitReason'),
        notes: formData.get('notes')
    });
    if (!parsedTrade.success) {
        this.showNotification(formatZodIssues(parsedTrade.error), 'error');
        return;
    }

    const formValues = parsedTrade.data;
    const underlyingType = this.normalizeUnderlyingType(formValues.underlyingType, { fallback: 'Stock' });
    const statusOverride = this.normalizeTradeStatusInput(formValues.tradeStatus || '');

    const tradeData: TradeRecord = {
        ticker: formValues.ticker,
        strategy: formValues.strategy,
        exitReason: formValues.exitReason,
        notes: formValues.notes,
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

export function updateTrade(this: ViewsContext, tradeData: TradeRecord): boolean {
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

export function setTodayDate(this: ViewsContext & { currentDate: Date }): void {
    const today = this.currentDate;
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayString = `${year}-${month}-${day}`;

    const entryDateField = document.getElementById('entryDate') as HTMLInputElement | null;
    if (entryDateField && !this.currentEditingId) {
        entryDateField.value = todayString;
    }
}

export function updateTickerPreview(this: ViewsContext, ticker: string): void {
    const preview = document.getElementById('ticker-preview');
    if (!preview) return;

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
