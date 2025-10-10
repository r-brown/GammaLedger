// Enhanced Options Trading Tracker Application
const VALID_TRADE_TYPES = new Set(['BTO', 'STO', 'STC', 'BTC']);
const SHORT_STRATEGY_PATTERNS = [
    'cash-secured put',
    'covered call',
    'the wheel',
    'bear call spread',
    'bull put spread',
    'iron condor',
    'iron butterfly',
    'short straddle',
    'short strangle',
    'credit spread'
];
const LONG_STRATEGY_PATTERNS = [
    'long ',
    'protective put',
    'bull call spread',
    'bear put spread',
    'calendar spread',
    'diagonal spread',
    'pmcc',
    'straddle',
    'strangle',
    'debit spread'
];

class OptionsTrackerPro {
    constructor() {
        this.trades = [];
        this.currentView = 'dashboard';
        this.sortDirection = {};
        this.charts = {};
    this.cycleAnalytics = [];
        this.currentFileHandle = null;
        this.currentFileName = 'Unsaved Database';
        this.hasUnsavedChanges = false;
        this.supportsFileSystemAccess = 'showOpenFilePicker' in window;
        this.currentEditingId = null;

        this.finnhub = {
            apiKey: '',
            cache: new Map(),
            cacheTTL: 1000 * 60, // 1 minute
            outstandingRequests: new Map(),
            rateLimitQueue: Promise.resolve(),
            maxRequestsPerMinute: 55,
            timestamps: [],
            statusTimeoutId: null,
            lastStatus: null,
            elements: {}
        };

        this.activeQuoteEntries = new Map();
        this.quoteRefreshIntervalId = null;
        this.autoRefreshIntervalMs = this.computeAutoRefreshInterval();
        this.quoteRefreshKeys = [];
        this.quoteRefreshCursor = 0;

        this.features = {
            greeksEnabled: false
        };

        this.positionHighlightConfig = {
            expirationWarningDays: 20,
            expirationCriticalDays: 7
        };

        // Current date for calculations (always use actual current date)
        this.currentDate = new Date(); // Current date

        this.init();
    }

    async init() {
        this.loadFromStorage();
        this.loadFinnhubConfigFromStorage();
        if (this.trades.length === 0) {
            await this.loadDefaultDatabase();
        }
        this.bindEvents();
        this.initializeFinnhubControls();
        this.updateFileNameDisplay();
        this.checkBrowserCompatibility();

        // Wait for DOM to be ready before updating dashboard
        setTimeout(() => {
            this.updateDashboard();
            this.showView('dashboard');
        }, 100);
    }

        computeAutoRefreshInterval() {
            const limit = Number(this.finnhub?.maxRequestsPerMinute) || 60;
            const safeLimit = Math.min(Math.max(limit - 2, 1), 60);
            return Math.max(800, Math.ceil(60_000 / safeLimit));
        }

        areGreeksEnabled() {
            return Boolean(this.features?.greeksEnabled);
        }

    checkBrowserCompatibility() {
        if (!this.supportsFileSystemAccess) {
            const notice = document.getElementById('compatibility-notice');
            if (notice) {
                notice.classList.remove('hidden');
            }
            console.log('File System Access API not supported, using fallback methods');
        }
    }

    async loadDefaultDatabase() {
        try {
            const response = await fetch('options_tracker.json', { cache: 'no-cache' });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            if (!data || !Array.isArray(data.trades)) {
                throw new Error('Default database missing trades array');
            }

            this.trades = data.trades.map(trade => {
                const normalized = { ...trade };
                if (normalized.tradeReasoning && !normalized.notes) {
                    normalized.notes = normalized.tradeReasoning;
                }
                delete normalized.tradeReasoning;
                return this.enrichTradeData(normalized);
            });

            this.currentFileName = 'options_tracker.json';
            this.currentFileHandle = null;
            this.hasUnsavedChanges = false;
            this.updateUnsavedIndicator();
            this.saveToStorage();

            this.applyFinnhubConfig(data);
        } catch (error) {
            console.warn('Default database not loaded:', error);
            this.trades = [];
            this.currentFileName = 'Unsaved Database';
            this.currentFileHandle = null;
            this.hasUnsavedChanges = false;
            this.updateUnsavedIndicator();
            this.saveToStorage();
        }
    }

    // Trade type & direction helpers
    getTradeType(trade) {
        if (trade.tradeType && VALID_TRADE_TYPES.has(trade.tradeType.toUpperCase())) {
            return trade.tradeType.toUpperCase();
        }
        return this.normalizeTradeType(trade);
    }

    normalizeTradeType(trade) {
        const provided = (trade.tradeType || '').toUpperCase();
        if (VALID_TRADE_TYPES.has(provided)) {
            return provided;
        }

        const direction = this.inferTradeDirection(trade);
    const isClosed = this.isClosedStatus(trade.status);

        if (isClosed) {
            return direction === 'short' ? 'BTC' : 'STC';
        }

        return direction === 'short' ? 'STO' : 'BTO';
    }

    inferTradeDirection(trade) {
        const provided = (trade.tradeType || '').toUpperCase();
        if (provided === 'BTO' || provided === 'STC') {
            return 'long';
        }
        if (provided === 'STO' || provided === 'BTC') {
            return 'short';
        }

        const quantity = Number(trade.quantity);
        if (!Number.isNaN(quantity) && quantity !== 0) {
            if (quantity < 0) {
                return 'short';
            }
            // If quantity is positive we defer to strategy heuristics below
        }

        const strategy = (trade.strategy || '').toLowerCase();
        if (strategy.includes('short ')) {
            return 'short';
        }
        if (SHORT_STRATEGY_PATTERNS.some(pattern => strategy.includes(pattern))) {
            return 'short';
        }
        if (LONG_STRATEGY_PATTERNS.some(pattern => strategy.includes(pattern))) {
            return 'long';
        }

        return 'long';
    }

    normalizeStatus(status) {
        return (status || '').toString().trim().toLowerCase();
    }

    isClosedStatus(status) {
        const normalized = this.normalizeStatus(status);
        return normalized === 'closed' || normalized === 'assigned' || normalized === 'expired';
    }

    isAssignmentReason(reason) {
        const normalized = (reason || '').toString().trim().toLowerCase();
        return normalized.includes('assign');
    }

    getDisplayStatus(trade) {
        if (!trade) {
            return 'Unknown';
        }

        const rawStatus = (trade.status || 'Unknown').toString().trim();
        if (!rawStatus) {
            return 'Unknown';
        }

        const normalized = rawStatus.toLowerCase();
        if (normalized === 'closed' && this.isAssignmentReason(trade.exitReason)) {
            return 'Assigned';
        }

        if (normalized === 'assigned') {
            return 'Assigned';
        }

        if (normalized === 'expired') {
            return 'Expired';
        }

        return rawStatus;
    }

    // DTE calculation using current date
    calculateDTE(expirationDate, trade) {
        const expDate = new Date(expirationDate);

        // For closed trades, use current date to determine if expired at time of analysis
        // For open trades, calculate from current date
        let compareDate = this.currentDate;

        // If trade is closed and was closed before expiration, show 0 since it's no longer relevant
        if (this.isClosedStatus(trade.status)) {
            return 0; // Closed trades don't have DTE since position is closed
        }

        // For open trades, calculate DTE from current date to expiration
        const diffTime = expDate.getTime() - compareDate.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // Return 0 if expiration has passed
        return Math.max(0, diffDays);
    }

    // Fixed P&L calculation considering trade direction
    calculatePL(trade) {
        if (!this.isClosedStatus(trade.status) || trade.exitPrice === null || trade.exitPrice === undefined) {
            return 0;
        }

        const quantity = Math.abs(Number(trade.quantity) || 0);
        if (quantity === 0) {
            return 0;
        }

        const entryPrice = Number(trade.entryPrice) || 0;
        const exitPrice = Number(trade.exitPrice) || 0;
        const fees = Number(trade.fees) || 0;
        const tradeType = this.getTradeType(trade);
        const isShort = tradeType === 'STO' || tradeType === 'BTC';

        const gross = isShort
            ? (entryPrice - exitPrice)
            : (exitPrice - entryPrice);

        return gross * quantity * 100 - fees;
    }

    // Fixed ROI calculation
    calculateROI(trade) {
        const pl = this.calculatePL(trade);
        const capital = this.getCapitalAtRisk(trade);

        if (!(capital > 0)) {
            return 0;
        }

        const roiPercent = (pl / capital) * 100;
        if (!Number.isFinite(roiPercent)) {
            return 0;
        }

        return parseFloat(roiPercent.toFixed(2));
    }

    // Fixed days held calculation
    calculateDaysHeld(trade) {
        const entryDate = new Date(trade.entryDate);
        let endDate;

        if (this.isClosedStatus(trade.status) && trade.exitDate) {
            endDate = new Date(trade.exitDate);
        } else {
            endDate = this.currentDate; // Current date
        }

        const diffTime = endDate - entryDate;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        return Math.max(1, diffDays); // Minimum 1 day
    }

    // Enhanced Max Risk calculation
    calculateMaxRisk(trade) {
        const quantity = Math.abs(Number(trade.quantity) || 0);
        if (quantity === 0) {
            return 0;
        }

        const overrideValue = Number(trade.maxRiskOverride);
        if (Number.isFinite(overrideValue) && overrideValue > 0) {
            return overrideValue;
        }

        const entry = Math.abs(Number(trade.entryPrice) || 0);
        const fees = Number(trade.fees) || 0;
        const strategy = (trade.strategy || '').toLowerCase();
        const tradeType = this.getTradeType(trade);
        const isShort = tradeType === 'STO' || tradeType === 'BTC';

        const definedRiskWidth = Number(trade.definedRiskWidth);
        const hasDefinedWidth = Number.isFinite(definedRiskWidth) && definedRiskWidth > 0;

        if (!isShort) {
            return entry * quantity * 100 + fees;
        }

        if (hasDefinedWidth) {
            const riskPerContract = Math.max((definedRiskWidth - entry) * 100, 0);
            return riskPerContract * quantity + fees;
        }

        const isDefinedRisk = strategy.includes('spread') || strategy.includes('condor') || strategy.includes('collar') || strategy.includes('butterfly');

        if (strategy.includes('put')) {
            const strike = Number(trade.strikePrice) || 0;
            if (strike > 0) {
                const riskPerContract = Math.max((strike - entry) * 100, 0);
                return riskPerContract * quantity + fees;
            }
        }

        if (isDefinedRisk) {
            return entry * quantity * 100 + fees;
        }

        return entry * quantity * 100 + fees;
    }

    getCapitalAtRisk(trade) {
        const stored = Number(trade.maxRisk);
        if (Number.isFinite(stored) && stored > 0) {
            return stored;
        }

        return this.calculateMaxRisk(trade);
    }

    // VERIFIED: Annualized ROI calculation
    calculateAnnualizedROI(trade) {
    if (!this.isClosedStatus(trade.status)) return 0;

        const roiPercent = this.calculateROI(trade);
        if (!Number.isFinite(roiPercent)) {
            return 0;
        }

        const daysHeldRaw = this.calculateDaysHeld(trade);
        const daysHeld = Math.max(1, Number(daysHeldRaw) || 0);

        const annualizedROI = (365 * roiPercent) / daysHeld;
        if (!Number.isFinite(annualizedROI)) {
            return 0;
        }

        return parseFloat(annualizedROI.toFixed(2));
    }

    enrichTradeData(trade) {
        const enriched = { ...trade };
        delete enriched.optionType;

        const normalizedType = this.normalizeTradeType(enriched);
        enriched.tradeType = normalizedType;

        const direction = this.inferTradeDirection({ ...enriched, tradeType: normalizedType });
        enriched.tradeDirection = direction;

        const definedRiskWidth = Number(enriched.definedRiskWidth);
        enriched.definedRiskWidth = Number.isFinite(definedRiskWidth) && definedRiskWidth > 0 ? definedRiskWidth : null;

        const maxRiskOverride = Number(enriched.maxRiskOverride);
        enriched.maxRiskOverride = Number.isFinite(maxRiskOverride) && maxRiskOverride > 0 ? maxRiskOverride : null;

        const rawQuantity = Number(enriched.quantity);
        const absQuantity = Math.abs(Number.isNaN(rawQuantity) ? 0 : rawQuantity);
        if (absQuantity > 0) {
            enriched.quantity = direction === 'short' ? -absQuantity : absQuantity;
        } else {
            enriched.quantity = absQuantity;
        }

        enriched.daysHeld = this.calculateDaysHeld(enriched);
        enriched.dte = this.calculateDTE(enriched.expirationDate, enriched);
        enriched.pl = this.calculatePL(enriched);
        enriched.roi = this.calculateROI(enriched);
        enriched.annualizedROI = this.calculateAnnualizedROI(enriched);
        enriched.maxRisk = this.calculateMaxRisk(enriched);

        enriched.cycleId = this.normalizeCycleId(enriched.cycleId);
        enriched.cycleType = this.normalizeCycleType(enriched.cycleType, enriched.strategy);
        enriched.cycleRole = this.normalizeCycleRole(enriched.cycleRole, enriched);

        return enriched;
    }

    // Fixed date format conversion for form fields
    formatDateForInput(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '';

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    calculateDaysBetween(date1, date2) {
        const d1 = new Date(date1);
        const d2 = new Date(date2);
        const timeDiff = Math.abs(d2.getTime() - d1.getTime());
        return Math.ceil(timeDiff / (1000 * 3600 * 24));
    }

    // Fixed ticker link generation using investing.com search
    generateTickerLink(ticker) {
        const safeTicker = (ticker ?? '').toString().trim().toUpperCase();
        if (!safeTicker) {
            return 'https://www.investing.com/search/';
        }
        return `https://www.investing.com/search/?q=${encodeURIComponent(safeTicker)}`;
    }

    createTickerElement(ticker, className = 'ticker-link', options = {}) {
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
            link.href = this.generateTickerLink(safeTicker);
            link.target = '_blank';
            link.rel = 'noopener noreferrer';

            link.addEventListener('click', (event) => {
                event.preventDefault();
                window.open(this.generateTickerLink(safeTicker), '_blank', 'noopener,noreferrer');
            });
        }

        return link;
    }

    applyResponsiveLabels(row, labels = []) {
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

    normalizeCycleId(cycleId) {
        return (cycleId || '').toString().trim();
    }

    normalizeCycleType(cycleType, strategy = '') {
        const explicit = (cycleType || '').toString().trim().toLowerCase();
        if (explicit === 'wheel') return 'wheel';
        if (explicit === 'pmcc' || explicit === 'pmc') return 'pmcc';

        const inferred = this.inferCycleTypeFromStrategy(strategy);
        return inferred || (explicit ? explicit : '');
    }

    inferCycleTypeFromStrategy(strategy = '') {
        const strategyLower = strategy.toString().trim().toLowerCase();
        if (!strategyLower) {
            return '';
        }
        if (strategyLower.includes('poor man') || strategyLower.includes('pmcc')) {
            return 'pmcc';
        }
        if (strategyLower.includes('cash-secured put') || strategyLower.includes('covered call') || strategyLower.includes('wheel')) {
            return 'wheel';
        }
        return '';
    }

    normalizeCycleRole(cycleRole, trade = {}) {
        const provided = (cycleRole || '').toString().trim().toLowerCase();
        if (provided) {
            return provided;
        }
        return this.inferCycleRole(trade);
    }

    inferCycleRole(trade = {}) {
        const strategy = (trade.strategy || '').toString().toLowerCase();
        const direction = trade.tradeDirection || this.inferTradeDirection(trade);
        const tradeType = this.getTradeType(trade);

        if (strategy.includes('cash-secured put')) {
            return 'wheel-put';
        }
        if (strategy.includes('covered call')) {
            return 'wheel-call';
        }
        if (strategy.includes('poor man')) {
            if (direction === 'long' || tradeType === 'BTO') {
                return 'pmcc-base';
            }
            if (direction === 'short' || tradeType === 'STO') {
                return 'pmcc-short';
            }
        }
        if (this.isAssignmentTrade(trade)) {
            return 'assignment';
        }
        return '';
    }

    isWheelPut(trade = {}) {
        const role = (trade.cycleRole || '').toLowerCase();
        if (role === 'wheel-put') return true;
        const strategy = (trade.strategy || '').toLowerCase();
        return strategy.includes('cash-secured put');
    }

    isCoveredCall(trade = {}) {
        const role = (trade.cycleRole || '').toLowerCase();
        if (role === 'wheel-call' || role === 'covered-call') return true;
        const strategy = (trade.strategy || '').toLowerCase();
        return strategy.includes('covered call');
    }

    isPmccBaseLeg(trade = {}) {
        const role = (trade.cycleRole || '').toLowerCase();
        if (role === 'pmcc-base') return true;
        const strategy = (trade.strategy || '').toLowerCase();
        return strategy.includes('poor man') && (trade.tradeDirection === 'long' || this.getTradeType(trade) === 'BTO');
    }

    isPmccShortCall(trade = {}) {
        const role = (trade.cycleRole || '').toLowerCase();
        if (role === 'pmcc-short') return true;
        const strategy = (trade.strategy || '').toLowerCase();
        return strategy.includes('poor man') && (trade.tradeDirection === 'short' || this.getTradeType(trade) === 'STO');
    }

    isAssignmentTrade(trade = {}) {
        const status = this.normalizeStatus(trade.status);
        if (status === 'assigned') {
            return true;
        }
        return this.isAssignmentReason(trade.exitReason);
    }

    calculateOptionPremium(trade = {}) {
        const quantity = Math.abs(Number(trade.quantity) || 0);
        if (!quantity) {
            return 0;
        }
        const entryPrice = Number(trade.entryPrice) || 0;
        const exitPrice = Number(trade.exitPrice) || 0;
        const fees = Number(trade.fees) || 0;
        const gross = (entryPrice - exitPrice) * quantity * 100;
        const direction = trade.tradeDirection || this.inferTradeDirection(trade);
        if (direction === 'short') {
            return gross - fees;
        }
        return (exitPrice - entryPrice) * quantity * 100 - fees;
    }

    bindEvents() {
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const view = item.getAttribute('data-view');
                if (view) {
                    this.showView(view);
                }
            });
        });

        // File management
        const saveButton = document.getElementById('save-database-btn');
        if (saveButton) {
            saveButton.addEventListener('click', async (e) => {
                e.preventDefault();
                await this.saveDatabase();
            });
        }

        const loadButton = document.getElementById('load-database-btn');
        if (loadButton) {
            loadButton.addEventListener('click', async (e) => {
                e.preventDefault();
                await this.loadDatabase();
            });
        }

        const newButton = document.getElementById('new-database-btn');
        if (newButton) {
            newButton.addEventListener('click', (e) => {
                e.preventDefault();
                this.newDatabase();
            });
        }

        // Add trade form
        const addTradeForm = document.getElementById('add-trade-form');
        if (addTradeForm) {
            addTradeForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleTradeSubmit();
            });
        }

        const cancelTradeButton = document.getElementById('cancel-trade');
        if (cancelTradeButton) {
            cancelTradeButton.addEventListener('click', () => {
                this.showView('trades-list'); // FIXED: Return to trades list when editing
            });
        }

        // Ticker preview
        const tickerInput = document.getElementById('ticker');
        if (tickerInput) {
            tickerInput.addEventListener('input', (e) => {
                this.updateTickerPreview(e.target.value);
            });
        }

        // Conviction level slider
        const convictionInput = document.getElementById('convictionLevel');
        if (convictionInput) {
            convictionInput.addEventListener('input', (e) => {
                const display = document.getElementById('conviction-display');
                if (display) {
                    display.textContent = e.target.value;
                }
            });
        }

        // Trades list filters
    ['filter-strategy', 'filter-status', 'filter-market-condition', 'filter-trade-type'].forEach(filterId => {
            const filterElement = document.getElementById(filterId);
            if (filterElement) {
                filterElement.addEventListener('change', () => this.filterTrades());
            }
        });

        const tickerSearch = document.getElementById('search-ticker');
        if (tickerSearch) {
            tickerSearch.addEventListener('input', () => this.filterTrades());
        }

        // Export CSV
        const exportButton = document.getElementById('export-csv');
        if (exportButton) {
            exportButton.addEventListener('click', () => this.exportToCSV());
        }

        // Sortable columns
        document.querySelectorAll('.sortable').forEach(header => {
            header.addEventListener('click', () => {
                const sortBy = header.getAttribute('data-sort');
                if (sortBy) {
                    this.sortTrades(sortBy);
                }
            });
        });

        // Set default entry date to today
        this.setTodayDate();

        // Responsive enhancements for trades filters
        this.setupResponsiveFilters();
    }

    setupResponsiveFilters() {
        const panel = document.getElementById('trades-filters-panel');
        const toggle = document.getElementById('toggle-filters');

        if (!panel || !toggle) {
            return;
        }

        const updateToggleState = (isOpen) => {
            toggle.textContent = isOpen ? 'Hide Filters' : 'Show Filters';
            toggle.setAttribute('aria-expanded', String(isOpen));
        };

        let wasMobile = window.innerWidth <= 768;

        const evaluateBreakpoint = (forceCollapse = false) => {
            const isMobile = window.innerWidth <= 768;

            if (isMobile) {
                if (forceCollapse || !wasMobile) {
                    panel.classList.remove('is-open');
                }
                updateToggleState(panel.classList.contains('is-open'));
            } else {
                panel.classList.add('is-open');
                updateToggleState(true);
            }

            wasMobile = isMobile;
        };

        toggle.addEventListener('click', () => {
            const isOpen = panel.classList.toggle('is-open');
            updateToggleState(isOpen);
        });

        let resizeTimeout = null;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => evaluateBreakpoint(false), 160);
        });

        evaluateBreakpoint(true);
    }

    updateTickerPreview(ticker) {
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

    setTodayDate() {
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

    showView(viewName) {
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
            'trades-list': 'All Trades'
        };
        document.getElementById('page-title').textContent = titles[viewName];

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
        }
    }

    resetAddTradeForm() {
        document.getElementById('add-trade-form').reset();
        this.setTodayDate();
        this.updateTickerPreview('');
        document.getElementById('conviction-display').textContent = '5';
        const cycleIdField = document.getElementById('cycleId');
        const cycleTypeField = document.getElementById('cycleType');
        const cycleRoleField = document.getElementById('cycleRole');
        if (cycleIdField) cycleIdField.value = '';
        if (cycleTypeField) cycleTypeField.value = '';
        if (cycleRoleField) cycleRoleField.value = '';
        this.currentEditingId = null;
    }

    parseDecimal(value, defaultValue = null, { allowNegative = true } = {}) {
        if (value === null || value === undefined) {
            return defaultValue;
        }

        const normalized = typeof value === 'string' ? value.trim() : value;
        if (normalized === '') {
            return defaultValue;
        }

        const parsedValue = Number(normalized);
        if (!Number.isFinite(parsedValue)) {
            return defaultValue;
        }

        if (!allowNegative && parsedValue < 0) {
            return defaultValue;
        }

        return parsedValue;
    }

    parseInteger(value, defaultValue = null, { allowNegative = true } = {}) {
        if (value === null || value === undefined) {
            return defaultValue;
        }

        const normalized = typeof value === 'string' ? value.trim() : value;
        if (normalized === '') {
            return defaultValue;
        }

        const parsedValue = parseInt(normalized, 10);
        if (!Number.isFinite(parsedValue)) {
            return defaultValue;
        }

        if (!allowNegative && parsedValue < 0) {
            return defaultValue;
        }

        return parsedValue;
    }

    // Helper method to properly parse exit price, allowing 0 as valid
    parseExitPrice(exitPriceValue) {
        const parsedValue = this.parseDecimal(exitPriceValue, null, { allowNegative: false });
        return parsedValue === null ? null : parsedValue;
    }

    // FIXED: Handle trade submission for both new and edited trades
    handleTradeSubmit() {
        const form = document.getElementById('add-trade-form');
        const formData = new FormData(form);

        // Set quantity based on trade type
        const tradeType = formData.get('tradeType');
        const baseQuantity = Math.abs(this.parseInteger(formData.get('quantity'), 0, { allowNegative: false }) || 0);
        let quantity = baseQuantity;
        if (['STO', 'BTC'].includes(tradeType)) {
            quantity = -baseQuantity;
        }

        const definedRiskWidthRaw = this.parseDecimal(formData.get('definedRiskWidth'), null, { allowNegative: false });
        const maxRiskOverrideRaw = this.parseDecimal(formData.get('maxRiskOverride'), null, { allowNegative: false });

        const tradeData = {
            ticker: formData.get('ticker').toUpperCase(),
            strategy: formData.get('strategy'),
            tradeType: tradeType,
            quantity: quantity,
            entryDate: formData.get('entryDate'),
            expirationDate: formData.get('expirationDate'),
            exitDate: formData.get('exitDate') || null,
            status: formData.get('status'),
            stockPriceAtEntry: this.parseDecimal(formData.get('stockPriceAtEntry')),
            strikePrice: this.parseDecimal(formData.get('strikePrice')),
            entryPrice: this.parseDecimal(formData.get('entryPrice')),
            exitPrice: this.parseExitPrice(formData.get('exitPrice')),
            fees: this.parseDecimal(formData.get('fees'), 0),
            ivRank: this.parseInteger(formData.get('ivRank')),
            delta: this.parseDecimal(formData.get('delta')),
            gamma: this.parseDecimal(formData.get('gamma')),
            theta: this.parseDecimal(formData.get('theta')),
            vega: this.parseDecimal(formData.get('vega')),
            marketCondition: formData.get('marketCondition'),
            convictionLevel: this.parseInteger(formData.get('convictionLevel'), 5, { allowNegative: false }),
            notes: formData.get('notes'),
            exitReason: formData.get('exitReason') || null,
            cycleId: formData.get('cycleId'),
            cycleType: formData.get('cycleType'),
            cycleRole: formData.get('cycleRole'),
            definedRiskWidth: definedRiskWidthRaw !== null && definedRiskWidthRaw > 0 ? definedRiskWidthRaw : null,
            maxRiskOverride: maxRiskOverrideRaw !== null && maxRiskOverrideRaw > 0 ? maxRiskOverrideRaw : null
        };

        if (this.currentEditingId) {
            // Update existing trade
            if (this.updateTrade(tradeData)) {
                this.showNotification('Trade updated successfully', 'success');
                this.currentEditingId = null;
                document.getElementById('page-title').textContent = 'All Trades'; // Update title
                this.resetAddTradeForm();
                this.showView('trades-list'); // FIXED: Stay on trades list instead of dashboard
            }
        } else {
            // Add new trade
            tradeData.id = Date.now();
            const enrichedTrade = this.enrichTradeData(tradeData);
            this.trades.push(enrichedTrade);
            this.saveToStorage();
            this.markUnsavedChanges();

            this.resetAddTradeForm();
            this.showView('dashboard');
        }
    }

    updateTrade(tradeData) {
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

    updateDashboard() {
        const stats = this.calculateAdvancedStats();
        const {
            openTradesList,
            closedTradesList
        } = stats;

        this.cycleAnalytics = this.calculateCycleAnalytics();

        // Update overview cards
        document.getElementById('total-pl').textContent = this.formatCurrency(stats.totalPL);
        document.getElementById('pl-percentage').textContent = `${stats.totalROI.toFixed(2)}% Return`;
        document.getElementById('win-rate').textContent = `${stats.winRate.toFixed(1)}%`;
        document.getElementById('win-loss-count').textContent = `${stats.wins}W / ${stats.losses}L`;
        document.getElementById('profit-factor').textContent = stats.profitFactor.toFixed(2);
        document.getElementById('active-positions').textContent = stats.activePositions;
        const deltaSubtitle = document.getElementById('portfolio-delta');
        if (deltaSubtitle) {
            if (this.areGreeksEnabled()) {
                deltaSubtitle.textContent = `Δ: ${stats.portfolioDelta.toFixed(2)}`;
                deltaSubtitle.classList.remove('feature-disabled-label');
            } else {
                deltaSubtitle.textContent = 'Δ tracking paused';
                deltaSubtitle.classList.add('feature-disabled-label');
            }
        }
        document.getElementById('total-roi').textContent = `${stats.annualizedROI.toFixed(2)}%`;
        document.getElementById('max-drawdown').textContent = `${stats.maxDrawdown.toFixed(1)}%`;

        // Update Greeks and Risk Metrics
    this.updatePortfolioGreeks(openTradesList);
        this.updateRiskMetrics(closedTradesList, stats);

        // Update tables
    this.updateActivePositionsTable(openTradesList);
    this.updateRecentTradesTable(closedTradesList, stats.activePositions);
        this.updateCycleSummaryTable(this.cycleAnalytics);

        // Update charts with delay
        setTimeout(() => {
            this.updateAllCharts();
        }, 200);
    }

    calculateAdvancedStats() {
    const closedTrades = this.trades.filter(trade => this.isClosedStatus(trade.status));
    const openTrades = this.trades.filter(trade => this.normalizeStatus(trade.status) === 'open');
        const winningTrades = closedTrades.filter(trade => trade.pl > 0);
        const losingTrades = closedTrades.filter(trade => trade.pl < 0);

        const totalPL = closedTrades.reduce((sum, trade) => sum + trade.pl, 0);
        const totalInvestment = closedTrades.reduce((sum, trade) => {
            const capital = this.getCapitalAtRisk(trade);
            return capital > 0 ? sum + capital : sum;
        }, 0);
        const winRate = closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0;

        const totalWins = winningTrades.reduce((sum, trade) => sum + trade.pl, 0);
        const totalLosses = Math.abs(losingTrades.reduce((sum, trade) => sum + trade.pl, 0));
        const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? 999 : 0;

        const portfolioDelta = openTrades.reduce((sum, trade) => sum + (trade.delta || 0) * trade.quantity, 0);

        // Calculate max drawdown
        let maxDrawdown = 0;
        let peak = 0;
        let cumulativePL = 0;

        const sortedTrades = [...closedTrades].sort((a, b) => new Date(a.exitDate) - new Date(b.exitDate));
        sortedTrades.forEach(trade => {
            cumulativePL += trade.pl;
            if (cumulativePL > peak) {
                peak = cumulativePL;
            }
            const drawdown = peak > 0 ? ((peak - cumulativePL) / peak) * 100 : 0;
            if (drawdown > maxDrawdown) {
                maxDrawdown = drawdown;
            }
        });

        const totalROI = totalInvestment > 0 ? (totalPL / totalInvestment) * 100 : 0;
        const avgDaysHeld = closedTrades.length > 0 ? closedTrades.reduce((sum, trade) => sum + trade.daysHeld, 0) / closedTrades.length : 0;
        const annualizedROI = avgDaysHeld > 0 ? (Math.pow(1 + totalROI / 100, 365 / avgDaysHeld) - 1) * 100 : 0;

        return {
            totalTrades: this.trades.length,
            totalPL,
            winRate,
            wins: winningTrades.length,
            losses: losingTrades.length,
            profitFactor,
            activePositions: openTrades.length,
            portfolioDelta,
            totalROI,
            annualizedROI,
            maxDrawdown,
            closedTrades: closedTrades.length,
            totalInvestment,
            closedTradesList: closedTrades,
            openTradesList: openTrades
        };
    }

    calculateCycleAnalytics() {
        const cycleMap = new Map();

        this.trades.forEach(trade => {
            const cycleId = this.normalizeCycleId(trade.cycleId);
            if (!cycleId) {
                return;
            }

            const existing = cycleMap.get(cycleId) || {
                cycleId,
                cycleType: this.normalizeCycleType(trade.cycleType, trade.strategy),
                trades: [],
                ticker: trade.ticker || ''
            };

            if (!existing.ticker && trade.ticker) {
                existing.ticker = trade.ticker;
            }

            if (!existing.cycleType) {
                existing.cycleType = this.normalizeCycleType(trade.cycleType, trade.strategy);
            }

            existing.trades.push(trade);
            cycleMap.set(cycleId, existing);
        });

        const summaries = Array.from(cycleMap.values()).map(cycle => this.computeCycleMetrics(cycle));
        summaries.sort((a, b) => {
            const aTime = a.startDate ? new Date(a.startDate).getTime() : 0;
            const bTime = b.startDate ? new Date(b.startDate).getTime() : 0;
            return bTime - aTime;
        });
        return summaries;
    }

    computeCycleMetrics(cycle) {
        const trades = [...cycle.trades].sort((a, b) => new Date(a.entryDate) - new Date(b.entryDate));
        const cycleType = this.normalizeCycleType(cycle.cycleType, trades[0]?.strategy || '');

        let startDate = null;
        let endDate = null;
        let hasOpenTrade = false;
        let totalPremiums = 0;
        let totalPL = 0;
    let putPremiums = 0;
    let callPremiums = 0;
    let baseCost = 0;
    let baseInitialCost = 0;
    let capitalAtRisk = 0;
    let initialStrike = null;
    let baseStrike = null;
    let openBaseStrike = null;
        let assignmentCount = 0;
        let maxContracts = 0;

        trades.forEach(trade => {
            const entry = trade.entryDate ? new Date(trade.entryDate) : null;
            if (entry && !isNaN(entry.getTime())) {
                if (!startDate || entry < startDate) {
                    startDate = entry;
                }
            }

            const exit = trade.exitDate ? new Date(trade.exitDate) : null;
            if (exit && !isNaN(exit.getTime())) {
                if (!endDate || exit > endDate) {
                    endDate = exit;
                }
            } else {
                hasOpenTrade = true;
            }

            const pl = Number(trade.pl) || 0;
            totalPL += pl;

            const quantity = Math.abs(Number(trade.quantity) || 0);
            if (quantity > maxContracts) {
                maxContracts = quantity;
            }

            const direction = trade.tradeDirection || this.inferTradeDirection(trade);
            if (direction === 'short') {
                const premium = this.calculateOptionPremium(trade);
                totalPremiums += premium;

                if (this.isWheelPut(trade)) {
                    putPremiums += premium;
                    const strike = Number(trade.strikePrice) || 0;
                    if (!initialStrike && strike > 0) {
                        initialStrike = strike;
                    }
                    const capital = strike * quantity * 100;
                    if (capital > capitalAtRisk) {
                        capitalAtRisk = capital;
                    }
                }

                if (this.isCoveredCall(trade) || this.isPmccShortCall(trade)) {
                    callPremiums += premium;
                }
            } else if (this.isPmccBaseLeg(trade)) {
                const entryPrice = Number(trade.entryPrice);
                const exitPrice = Number(trade.exitPrice);
                const fees = Number(trade.fees);
                const entryCost = Number.isFinite(entryPrice) ? entryPrice * quantity * 100 : 0;
                const exitProceeds = Number.isFinite(exitPrice) ? exitPrice * quantity * 100 : 0;
                const feeCost = Number.isFinite(fees) ? Math.max(fees, 0) : 0;

                baseCost += entryCost - exitProceeds + feeCost;
                if (entryCost > 0) {
                    baseInitialCost += entryCost + feeCost;
                }

                const strike = Number(trade.strikePrice);
                if (Number.isFinite(strike) && strike > 0) {
                    if (!this.isClosedStatus(trade.status)) {
                        openBaseStrike = strike;
                    }
                    baseStrike = strike;
                }
            }

            if (this.isAssignmentTrade(trade)) {
                assignmentCount += quantity;

                const assignmentStrike = Number(trade.strikePrice) || Number(trade.stockPriceAtEntry) || null;
                if (!initialStrike && Number.isFinite(assignmentStrike) && assignmentStrike > 0) {
                    initialStrike = assignmentStrike;
                }

                if (Number.isFinite(assignmentStrike) && assignmentStrike > 0) {
                    const assignmentCapital = assignmentStrike * quantity * 100;
                    if (assignmentCapital > capitalAtRisk) {
                        capitalAtRisk = assignmentCapital;
                    }
                }
            }
        });

        if (Number.isFinite(openBaseStrike) && openBaseStrike > 0) {
            baseStrike = openBaseStrike;
        }

        const status = hasOpenTrade ? 'In Progress' : 'Closed';
        const startIso = startDate ? startDate.toISOString() : null;
        const endIso = (!hasOpenTrade && endDate) ? endDate.toISOString() : null;

        let effectiveCostBasis = null;
        let breakevenPrice = null;
        let roiDenominator = null;
        let netBasis = null;

        if (cycleType === 'wheel' && initialStrike && maxContracts > 0) {
            effectiveCostBasis = initialStrike - (totalPremiums / (maxContracts * 100));
            breakevenPrice = effectiveCostBasis;
            roiDenominator = capitalAtRisk || (initialStrike * maxContracts * 100);
        } else if (cycleType === 'pmcc') {
            netBasis = baseCost - callPremiums;
            const positiveNetBasis = Number.isFinite(netBasis) && netBasis > 0 ? netBasis : null;
            const positiveBaseCost = baseCost > 0 ? baseCost : null;
            const positiveInitialCost = baseInitialCost > 0 ? baseInitialCost : null;

            if (positiveNetBasis) {
                roiDenominator = positiveNetBasis;
            } else if (positiveBaseCost) {
                roiDenominator = positiveBaseCost;
            } else if (positiveInitialCost) {
                roiDenominator = positiveInitialCost;
            }

            const capitalCandidate = positiveNetBasis || positiveBaseCost || positiveInitialCost;
            if (capitalCandidate && capitalCandidate > capitalAtRisk) {
                capitalAtRisk = capitalCandidate;
            }

            if (Number.isFinite(baseStrike) && baseStrike > 0 && maxContracts > 0 && Number.isFinite(netBasis)) {
                breakevenPrice = baseStrike + (netBasis / (maxContracts * 100));
            }
        }

        if (Number.isFinite(baseCost) && Math.abs(baseCost) < 1e-6) {
            baseCost = 0;
        }
        if (Number.isFinite(netBasis) && Math.abs(netBasis) < 1e-6) {
            netBasis = 0;
        }

        let costBasis = roiDenominator;

        if (!costBasis || costBasis <= 0) {
            if (cycleType === 'wheel') {
                costBasis = capitalAtRisk || (initialStrike && maxContracts > 0 ? initialStrike * maxContracts * 100 : null);
            } else if (cycleType === 'pmcc') {
                if (Number.isFinite(netBasis) && netBasis > 0) {
                    costBasis = netBasis;
                } else if (baseCost > 0) {
                    costBasis = baseCost;
                } else if (baseInitialCost > 0) {
                    costBasis = baseInitialCost;
                }
            }
        }

        if (!costBasis || costBasis <= 0) {
            const fallbackDebit = trades.reduce((sum, trade) => {
                const quantity = Math.abs(Number(trade.quantity) || 0);
                if (!quantity) {
                    return sum;
                }
                const entryPrice = Number(trade.entryPrice);
                const fees = Number(trade.fees) || 0;
                const tradeType = this.getTradeType(trade);
                if (tradeType === 'BTO' || tradeType === 'BTC') {
                    const debit = (Number.isFinite(entryPrice) ? entryPrice : 0) * quantity * 100;
                    const totalDebit = debit + (Number.isFinite(fees) ? Math.max(fees, 0) : 0);
                    return sum + Math.max(totalDebit, 0);
                }
                return sum;
            }, 0);

            costBasis = fallbackDebit > 0 ? fallbackDebit : null;
        }

        if (!roiDenominator || roiDenominator <= 0) {
            roiDenominator = costBasis && costBasis > 0 ? costBasis : null;
        }

        const roiPercent = roiDenominator ? (totalPL / roiDenominator) * 100 : null;

        let keyMetricLabel = '';
        let keyMetricValue = null;

        if (cycleType === 'wheel' && effectiveCostBasis !== null) {
            keyMetricLabel = 'Eff. Basis';
            keyMetricValue = effectiveCostBasis;
        } else if (cycleType === 'pmcc' && netBasis !== null) {
            keyMetricLabel = 'Net Basis';
            keyMetricValue = netBasis;
        }

        return {
            cycleId: cycle.cycleId,
            cycleType,
            typeLabel: cycleType === 'pmcc' ? 'PMCC' : cycleType === 'wheel' ? 'Wheel' : (cycleType ? cycleType.toUpperCase() : 'Custom'),
            ticker: cycle.ticker || trades[0]?.ticker || '—',
            trades,
            startDate: startIso,
            endDate: endIso,
            status,
            totalPremiums,
            totalPL,
            putPremiums,
            callPremiums,
            baseCost,
            baseInitialCost,
            capitalAtRisk,
            effectiveCostBasis,
            netBasis,
            costBasis,
            assignments: assignmentCount,
            maxContracts,
            roiPercent,
            keyMetricLabel,
            keyMetricValue,
            breakevenPrice,
            hasOpenTrade,
            durationDays: startDate ? this.calculateDaysBetween(startDate, endDate || this.currentDate) : 0
        };
    }

    updateCycleSummaryTable(cycles = this.cycleAnalytics || []) {
        const tableBody = document.querySelector('#cycle-summary-table tbody');
        const emptyState = document.getElementById('cycle-summary-empty');

        if (!tableBody) {
            return;
        }

        tableBody.innerHTML = '';

        if (!Array.isArray(cycles) || cycles.length === 0) {
            if (emptyState) {
                emptyState.classList.remove('hidden');
            }
            return;
        }

        if (emptyState) {
            emptyState.classList.add('hidden');
        }

        const columnLabels = [
            'Cycle', 'Type', 'Ticker', 'Status', 'Trades', 'Premiums', 'Total P&L',
            'ROI', 'Cost Basis', 'Key Metrics', 'Timeline'
        ];

        cycles.forEach(cycle => {
            const row = tableBody.insertRow();

            const cycleCell = row.insertCell(0);
            const cycleId = this.normalizeCycleId(cycle.cycleId);
            if (cycleId) {
                const cycleButton = document.createElement('button');
                cycleButton.type = 'button';
                cycleButton.className = 'cycle-chip cycle-chip--link';
                cycleButton.textContent = cycleId;
                cycleButton.title = 'Open All Trades filtered by this cycle';
                cycleButton.addEventListener('click', () => {
                    this.openTradesFilteredByCycle(cycleId, cycle.ticker);
                });
                cycleCell.appendChild(cycleButton);
            } else {
                cycleCell.textContent = '—';
            }
            row.insertCell(1).textContent = cycle.typeLabel;
            row.insertCell(2).textContent = cycle.ticker || '—';

            const statusCell = row.insertCell(3);
            const statusBadge = document.createElement('span');
            const statusNormalized = cycle.status === 'Closed' ? 'closed' : 'open';
            statusBadge.className = `status-badge ${statusNormalized}`;
            statusBadge.textContent = cycle.status;
            statusCell.appendChild(statusBadge);

            row.insertCell(4).textContent = cycle.trades.length;

            const premiumCell = row.insertCell(5);
            premiumCell.textContent = this.formatCurrency(cycle.totalPremiums);

            const plCell = row.insertCell(6);
            plCell.textContent = this.formatCurrency(cycle.totalPL);
            if (cycle.totalPL > 0) {
                plCell.className = 'pl-positive';
            } else if (cycle.totalPL < 0) {
                plCell.className = 'pl-negative';
            } else {
                plCell.className = 'pl-neutral';
            }

            const roiCell = row.insertCell(7);
            roiCell.textContent = this.formatPercent(cycle.roiPercent);
            if (cycle.roiPercent > 0) {
                roiCell.className = 'pl-positive';
            } else if (cycle.roiPercent < 0) {
                roiCell.className = 'pl-negative';
            } else {
                roiCell.className = 'pl-neutral';
            }

            const costCell = row.insertCell(8);
            if (Number.isFinite(cycle.costBasis)) {
                costCell.textContent = this.formatCurrency(cycle.costBasis);
            } else {
                costCell.textContent = '—';
                costCell.className = 'pl-neutral';
            }

            const metricCell = row.insertCell(9);
            const hasKeyMetric = cycle.keyMetricLabel && Number.isFinite(cycle.keyMetricValue);

            if (hasKeyMetric) {
                const label = document.createElement('div');
                label.className = 'cell-metric__label';
                label.textContent = `${cycle.keyMetricLabel}: ${this.formatCurrency(cycle.keyMetricValue)}`;
                metricCell.appendChild(label);

                if (cycle.breakevenPrice && Number.isFinite(cycle.breakevenPrice)) {
                    const breakevenEl = document.createElement('div');
                    breakevenEl.className = 'cell-metric__subtext';
                    breakevenEl.textContent = `Breakeven: ${this.formatCurrency(cycle.breakevenPrice)}`;
                    metricCell.appendChild(breakevenEl);
                }

                if (cycle.cycleType === 'wheel' && cycle.assignments) {
                    const assignmentEl = document.createElement('div');
                    assignmentEl.className = 'cell-metric__subtext';
                    assignmentEl.textContent = `Assignments: ${cycle.assignments}`;
                    metricCell.appendChild(assignmentEl);
                }
            } else if (Number.isFinite(cycle.costBasis)) {
                const basisEl = document.createElement('div');
                basisEl.className = 'cell-metric__label';
                basisEl.textContent = `Cost Basis: ${this.formatCurrency(cycle.costBasis)}`;
                metricCell.appendChild(basisEl);

                if (cycle.breakevenPrice && Number.isFinite(cycle.breakevenPrice)) {
                    const breakevenEl = document.createElement('div');
                    breakevenEl.className = 'cell-metric__subtext';
                    breakevenEl.textContent = `Breakeven: ${this.formatCurrency(cycle.breakevenPrice)}`;
                    metricCell.appendChild(breakevenEl);
                }

                if (cycle.cycleType === 'wheel' && cycle.assignments) {
                    const assignmentEl = document.createElement('div');
                    assignmentEl.className = 'cell-metric__subtext';
                    assignmentEl.textContent = `Assignments: ${cycle.assignments}`;
                    metricCell.appendChild(assignmentEl);
                }
            } else if (cycle.cycleType === 'wheel' && cycle.assignments) {
                metricCell.textContent = `Assignments: ${cycle.assignments}`;
            } else {
                metricCell.textContent = '—';
            }

            const timelineCell = row.insertCell(10);
            timelineCell.textContent = this.formatCycleDateRange(cycle.startDate, cycle.endDate, cycle.hasOpenTrade);

            this.applyResponsiveLabels(row, columnLabels);
        });
    }

    updatePortfolioGreeks(openTrades = this.trades.filter(trade => this.normalizeStatus(trade.status) === 'open')) {
        const deltaEl = document.getElementById('portfolio-delta-value');
        const gammaEl = document.getElementById('portfolio-gamma');
        const thetaEl = document.getElementById('portfolio-theta');
        const vegaEl = document.getElementById('portfolio-vega');

        if (!this.areGreeksEnabled()) {
            if (deltaEl) deltaEl.textContent = '—';
            if (gammaEl) gammaEl.textContent = '—';
            if (thetaEl) thetaEl.textContent = '—';
            if (vegaEl) vegaEl.textContent = '—';
            return;
        }

        const trades = Array.isArray(openTrades) ? openTrades : [];

        const totalDelta = trades.reduce((sum, trade) => sum + (trade.delta || 0) * trade.quantity, 0);
        const totalGamma = trades.reduce((sum, trade) => sum + (trade.gamma || 0) * trade.quantity, 0);
        const totalTheta = trades.reduce((sum, trade) => sum + (trade.theta || 0) * trade.quantity, 0);
        const totalVega = trades.reduce((sum, trade) => sum + (trade.vega || 0) * trade.quantity, 0);

        if (deltaEl) deltaEl.textContent = totalDelta.toFixed(2);
        if (gammaEl) gammaEl.textContent = totalGamma.toFixed(2);
        if (thetaEl) thetaEl.textContent = totalTheta.toFixed(2);
        if (vegaEl) vegaEl.textContent = totalVega.toFixed(2);
    }

    updateRiskMetrics(closedTrades = this.trades.filter(trade => this.isClosedStatus(trade.status)), stats = null) {
        const trades = Array.isArray(closedTrades) ? closedTrades : [];
        if (trades.length === 0) {
            document.getElementById('sharpe-ratio').textContent = '0.00';
            document.getElementById('calmar-ratio').textContent = '0.00';
            document.getElementById('volatility').textContent = '0.00%';
            document.getElementById('expectancy').textContent = '$0.00';
            return;
        }

        const returns = trades
            .map(trade => Number(trade.roi) / 100)
            .filter(ret => Number.isFinite(ret));

        if (returns.length === 0) {
            document.getElementById('sharpe-ratio').textContent = '0.00';
            document.getElementById('calmar-ratio').textContent = '0.00';
            document.getElementById('volatility').textContent = '0.00%';
            document.getElementById('expectancy').textContent = '$0.00';
            return;
        }

        const avgReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
        const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length;
        const stdDev = Math.sqrt(variance);
        const volatility = stdDev * 100;

        const sharpeRatio = stdDev > 0 ? (avgReturn * Math.sqrt(252)) / stdDev : 0;

        const wins = trades.filter(trade => trade.pl > 0);
        const losses = trades.filter(trade => trade.pl < 0);
        const avgWin = wins.length > 0 ? wins.reduce((sum, trade) => sum + trade.pl, 0) / wins.length : 0;
        const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((sum, trade) => sum + trade.pl, 0) / losses.length) : 0;

        const expectancy = (avgWin * (wins.length / trades.length)) - (avgLoss * (losses.length / trades.length));

        // Calculate Calmar ratio
        const aggregates = stats ?? this.calculateAdvancedStats();
        const totalReturn = aggregates.totalPL;
        const totalInvestment = aggregates.totalInvestment;
        const annualReturn = totalInvestment > 0 ? (totalReturn / totalInvestment) * 100 : 0;

        const calmarRatio = aggregates.maxDrawdown > 0 ? annualReturn / aggregates.maxDrawdown : 0;

        document.getElementById('sharpe-ratio').textContent = sharpeRatio.toFixed(2);
        document.getElementById('calmar-ratio').textContent = calmarRatio.toFixed(2);
        document.getElementById('volatility').textContent = `${volatility.toFixed(2)}%`;
        document.getElementById('expectancy').textContent = this.formatCurrency(expectancy);
    }

    updateActivePositionsTable(openTrades = this.trades.filter(trade => trade.status === 'Open')) {
        const tbody = document.querySelector('#active-positions-table tbody');

        if (tbody) {
            tbody.innerHTML = '';

            const sortedTrades = [...(Array.isArray(openTrades) ? openTrades : [])].sort((a, b) => {
                const dteA = this.parseInteger(a.dte, Number.POSITIVE_INFINITY, { allowNegative: false });
                const dteB = this.parseInteger(b.dte, Number.POSITIVE_INFINITY, { allowNegative: false });
                return dteA - dteB;
            });

            const columnLabels = ['Ticker', 'Strategy', 'Trade Type', 'Strike', 'Current Price', 'DTE', 'Max Risk', 'Notes'];
            const quoteEntries = new Map();

            sortedTrades.forEach(trade => {
                const row = tbody.insertRow();
                row.dataset.tradeId = String(trade.id ?? '');

                const tickerCell = row.insertCell(0);
                const tickerValue = (trade.ticker ?? '').toString().trim().toUpperCase();
                const tickerLink = this.createTickerElement(trade.ticker, 'ticker-pill', {
                    behavior: 'filter',
                    onClick: (value) => this.openTradesFilteredByTicker(value),
                    title: tickerValue ? `View all trades for ${tickerValue}` : ''
                });
                tickerCell.appendChild(tickerLink);

                row.dataset.ticker = tickerValue;

                row.insertCell(1).textContent = trade.strategy || '—';

                const tradeTypeCell = row.insertCell(2);
                const tradeType = this.getTradeType(trade);
                tradeTypeCell.textContent = tradeType;
                const tradeTypeClassMap = {
                    'BTO': 'trade-type-bto',
                    'STO': 'trade-type-sto',
                    'STC': 'trade-type-stc',
                    'BTC': 'trade-type-btc'
                };
                tradeTypeCell.className = tradeTypeClassMap[tradeType] || '';

                const strikePrice = this.parseDecimal(trade.strikePrice);
                const strikeCell = row.insertCell(3);
                strikeCell.textContent = strikePrice !== null ? `$${strikePrice.toFixed(2)}` : '—';
                if (Number.isFinite(strikePrice)) {
                    row.dataset.strikePrice = String(strikePrice);
                } else {
                    delete row.dataset.strikePrice;
                }

                const priceCell = row.insertCell(4);
                priceCell.className = 'quote-cell';
                const baseQuoteKey = this.getQuoteEntryKey(trade);
                const quoteKey = `${baseQuoteKey}|row:${quoteEntries.size}`;
                row.dataset.quoteKey = quoteKey;
                this.populateQuoteCell(priceCell, trade, row, { deferNetworkFetch: true });
                quoteEntries.set(quoteKey, { trade, row, cell: priceCell, key: quoteKey });

                const dteValue = this.parseInteger(trade.dte, null, { allowNegative: false });
                row.insertCell(5).textContent = dteValue !== null ? dteValue : '—';
                if (Number.isFinite(dteValue)) {
                    row.dataset.dte = String(dteValue);
                } else {
                    delete row.dataset.dte;
                }

                const maxRiskCell = row.insertCell(6);
                const maxRiskValue = this.parseDecimal(trade.maxRisk, null, { allowNegative: false });
                if (maxRiskValue !== null) {
                    maxRiskCell.textContent = this.formatCurrency(maxRiskValue);
                    maxRiskCell.className = 'pl-negative';
                } else {
                    maxRiskCell.textContent = '—';
                    maxRiskCell.className = 'pl-neutral';
                }

                const notesCell = row.insertCell(7);
                const noteText = (trade.notes || '').trim();
                notesCell.textContent = noteText || '—';

                this.updateExpirationHighlight(row, trade);

                this.applyResponsiveLabels(row, columnLabels);
            });

            this.activeQuoteEntries = quoteEntries;
            this.rebuildQuoteRefreshSchedule();
            this.startQuoteAutoRefreshIfNeeded();
            this.refreshActivePositionsQuotes({ force: true, immediate: true });
        }
    }

    updateRecentTradesTable(
        closedTrades = this.trades.filter(trade => this.isClosedStatus(trade.status)),
        activeCount = this.trades.filter(trade => this.normalizeStatus(trade.status) === 'open').length
    ) {
        const normalizedActiveCount = Number(activeCount);
        const desiredRowCount = Math.max(Number.isFinite(normalizedActiveCount) ? normalizedActiveCount : 0, 10);

        const recentTrades = [...(Array.isArray(closedTrades) ? closedTrades : [])]
            .sort((a, b) => new Date(b.exitDate) - new Date(a.exitDate))
            .slice(0, desiredRowCount);

        const tbody = document.querySelector('#recent-trades-table tbody');
        if (tbody) {
            tbody.innerHTML = '';

            const columnLabels = ['Ticker', 'Strategy', 'Exit Date', 'Days Held', 'P&L', 'ROI'];

            recentTrades.forEach(trade => {
                const row = tbody.insertRow();
                const tickerCell = row.insertCell(0);
                const tickerValue = (trade.ticker ?? '').toString().trim().toUpperCase();
                const tickerLink = this.createTickerElement(trade.ticker, 'ticker-pill', {
                    behavior: 'filter',
                    onClick: (value) => this.openTradesFilteredByTicker(value),
                    title: tickerValue ? `View all trades for ${tickerValue}` : ''
                });
                tickerCell.appendChild(tickerLink);

                row.insertCell(1).textContent = trade.strategy;
                row.insertCell(2).textContent = this.formatDate(trade.exitDate);

                const daysHeldCell = row.insertCell(3);
                const daysHeldValue = Number(trade.daysHeld);
                daysHeldCell.textContent = Number.isFinite(daysHeldValue) ? daysHeldValue : '—';

                const plCell = row.insertCell(4);
                plCell.textContent = this.formatCurrency(trade.pl);
                plCell.className = trade.pl >= 0 ? 'pl-positive' : 'pl-negative';

                const roiCell = row.insertCell(5);
                const roiValue = Number(trade.roi);
                if (Number.isFinite(roiValue)) {
                    roiCell.textContent = `${roiValue.toFixed(2)}%`;
                    roiCell.className = roiValue >= 0 ? 'pl-positive' : 'pl-negative';
                } else {
                    roiCell.textContent = '—';
                    roiCell.className = 'pl-neutral';
                }

                this.applyResponsiveLabels(row, columnLabels);
            });
        }
    }

    updateAllCharts() {
        this.updateMonthlyPLChart();
        this.updateCumulativePLChart();
        this.updateStrategyPerformanceChart();
        this.updateWinRateByStrategyChart();
        this.updateMarketConditionChart();
    }

    applyFinnhubConfig(data) {
        if (!data || typeof data !== 'object') {
            return;
        }

        const extracted = (data.finnhubApiKey ?? data.settings?.finnhubApiKey ?? '').toString().trim();
        this.setFinnhubApiKey(extracted, { markUnsaved: false, updateUI: false, persist: true });
    }

    initializeFinnhubControls() {
        const container = document.getElementById('finnhub-controls');
        if (!container) {
            return;
        }

        const input = document.getElementById('finnhub-api-key');
        const saveButton = document.getElementById('finnhub-save');
        const status = document.getElementById('finnhub-status');

        this.finnhub.elements = { container, input, saveButton, status };

        if (input) {
            input.value = this.finnhub.apiKey;
        }

        if (status) {
            const variant = this.finnhub.apiKey ? 'success' : 'neutral';
            const message = this.finnhub.apiKey ? 'API key loaded' : 'Not set';
            this.updateFinnhubStatus(message, variant, 4000);
        }

        const commit = () => {
            const value = (input?.value || '').trim();
            this.setFinnhubApiKey(value, { persist: true, updateUI: true, markUnsaved: true });
            const variant = value ? 'success' : 'neutral';
            const message = value ? 'Finnhub API key saved.' : 'API key cleared. Live prices disabled.';
            this.updateFinnhubStatus(message, variant, 5000);
            this.updateActivePositionsTable();
        };

        saveButton?.addEventListener('click', (event) => {
            event.preventDefault();
            commit();
        });

        input?.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                commit();
            }
        });
    }

    updateFinnhubStatus(message, variant = 'neutral', autoClearMs = 0) {
        const statusEl = this.finnhub?.elements?.status;
        if (!statusEl || !message) {
            return;
        }

        const normalizedVariant = ['success', 'error', 'neutral'].includes(variant) ? variant : 'neutral';
        statusEl.textContent = message;
        statusEl.classList.remove('is-success', 'is-error');
        if (normalizedVariant === 'success') {
            statusEl.classList.add('is-success');
        } else if (normalizedVariant === 'error') {
            statusEl.classList.add('is-error');
        }

        if (this.finnhub.statusTimeoutId) {
            clearTimeout(this.finnhub.statusTimeoutId);
        }

        this.finnhub.lastStatus = { message, variant: normalizedVariant };

        if (autoClearMs > 0) {
            this.finnhub.statusTimeoutId = setTimeout(() => {
                if (!statusEl.isConnected) {
                    return;
                }
                statusEl.textContent = normalizedVariant === 'neutral' ? 'Not set' : '';
                statusEl.classList.remove('is-success', 'is-error');
            }, autoClearMs);
        }
    }

    setFinnhubApiKey(value, { persist = false, updateUI = true, markUnsaved = false } = {}) {
        const sanitized = (value || '').trim();
        if (sanitized === this.finnhub.apiKey) {
            return;
        }

        this.finnhub.apiKey = sanitized;
        this.finnhub.cache.clear();
        this.finnhub.outstandingRequests.clear();

        if (updateUI && this.finnhub.elements?.input) {
            this.finnhub.elements.input.value = sanitized;
        }

        if (persist) {
            this.saveFinnhubConfigToStorage();
        }

        if (markUnsaved) {
            this.markUnsavedChanges();
        }
    }

    getFinnhubStorageKey() {
        return 'optionsTrackerProFinnhubConfig';
    }

    loadFinnhubConfigFromStorage() {
        try {
            const raw = localStorage.getItem(this.getFinnhubStorageKey());
            if (!raw) {
                return;
            }
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed.apiKey === 'string') {
                this.finnhub.apiKey = parsed.apiKey;
            }
        } catch (error) {
            console.warn('Failed to load Finnhub configuration:', error);
        }
    }

    saveFinnhubConfigToStorage() {
        try {
            const payload = { apiKey: this.finnhub.apiKey };
            localStorage.setItem(this.getFinnhubStorageKey(), JSON.stringify(payload));
        } catch (error) {
            console.warn('Failed to save Finnhub configuration:', error);
        }
    }

    getQuoteEntryKey(trade) {
        if (!trade || typeof trade !== 'object') {
            return 'unknown';
        }

        const candidateId = trade.id ?? trade.tradeId ?? trade.uid ?? trade.uniqueId;
        if (candidateId !== undefined && candidateId !== null && candidateId !== '') {
            return `id:${candidateId}`;
        }

        const ticker = (trade.ticker || '').toString().trim().toUpperCase();
        const entryDate = trade.entryDate || '';
        const strike = trade.strikePrice || '';
        return `fallback:${ticker}|${entryDate}|${strike}`;
    }

    rebuildQuoteRefreshSchedule() {
        if (!(this.activeQuoteEntries instanceof Map)) {
            this.activeQuoteEntries = new Map();
        }

        this.quoteRefreshKeys = Array.from(this.activeQuoteEntries.keys());
        this.quoteRefreshCursor = 0;
    }

    startQuoteAutoRefreshIfNeeded() {
        if (!(this.activeQuoteEntries instanceof Map)) {
            this.activeQuoteEntries = new Map();
        }

        if (this.activeQuoteEntries.size === 0) {
            this.stopQuoteAutoRefresh();
            return;
        }

        const desiredInterval = this.computeAutoRefreshInterval();
        if (desiredInterval !== this.autoRefreshIntervalMs) {
            this.autoRefreshIntervalMs = desiredInterval;
            this.stopQuoteAutoRefresh();
        }

        if (this.quoteRefreshIntervalId) {
            return;
        }

        this.quoteRefreshIntervalId = setInterval(() => {
            this.refreshActivePositionsQuotes({ force: true });
        }, this.autoRefreshIntervalMs);
    }

    stopQuoteAutoRefresh() {
        if (this.quoteRefreshIntervalId) {
            clearInterval(this.quoteRefreshIntervalId);
            this.quoteRefreshIntervalId = null;
        }

        if (this.activeQuoteEntries?.size === 0) {
            this.quoteRefreshKeys = [];
            this.quoteRefreshCursor = 0;
        }
    }

    refreshActivePositionsQuotes({ force = false, immediate = false } = {}) {
        if (!(this.activeQuoteEntries instanceof Map) || this.activeQuoteEntries.size === 0) {
            this.stopQuoteAutoRefresh();
            return;
        }

        if (!Array.isArray(this.quoteRefreshKeys) || this.quoteRefreshKeys.length === 0) {
            this.rebuildQuoteRefreshSchedule();
        }

        if (this.quoteRefreshKeys.length === 0) {
            this.stopQuoteAutoRefresh();
            return;
        }

        let attempts = 0;
        const maxAttempts = this.quoteRefreshKeys.length;

        while (attempts < maxAttempts && this.quoteRefreshKeys.length > 0) {
            const normalizedCursor = this.quoteRefreshCursor % this.quoteRefreshKeys.length;
            const key = this.quoteRefreshKeys[normalizedCursor];
            const entry = this.activeQuoteEntries.get(key);

            this.quoteRefreshCursor = (normalizedCursor + 1) % this.quoteRefreshKeys.length;
            attempts += 1;

            if (!entry || !entry.cell?.isConnected || !entry.row?.isConnected) {
                this.activeQuoteEntries.delete(key);
                this.quoteRefreshKeys.splice(normalizedCursor, 1);
                if (this.quoteRefreshKeys.length === 0) {
                    this.stopQuoteAutoRefresh();
                    return;
                }
                continue;
            }

            this.populateQuoteCell(entry.cell, entry.trade, entry.row, {
                forceRefresh: force,
                silentIfCached: !force,
                suppressLoadingText: !immediate
            });
            return;
        }

        if (this.activeQuoteEntries.size === 0) {
            this.stopQuoteAutoRefresh();
        }
    }

    populateQuoteCell(cell, trade, row, options = {}) {
        const {
            forceRefresh = false,
            deferNetworkFetch = false,
            silentIfCached = false,
            suppressLoadingText = false
        } = options;
        if (!cell) {
            return;
        }

        const ticker = (trade?.ticker || '').toString().trim().toUpperCase();
        if (!ticker) {
            cell.dataset.priceState = 'idle';
            cell.textContent = '—';
            cell.classList.remove('quote-error');
            return;
        }

        const cached = forceRefresh ? null : this.getCachedQuote(ticker);
        if (cached) {
            this.renderQuoteValue(cell, row, trade, cached.value);
            return;
        } else if (!this.finnhub.apiKey) {
            cell.dataset.priceState = 'error';
            this.setQuoteCellError(cell, row, trade, 'Set API key');
            const lastStatus = this.finnhub.lastStatus?.message;
            if (lastStatus !== 'Add your Finnhub API key to load live prices.') {
                this.updateFinnhubStatus('Add your Finnhub API key to load live prices.', 'neutral', 6000);
            }
            this.updateItmHighlight(row, trade, null);
            return;
        } else {
            cell.dataset.priceState = forceRefresh ? 'refreshing' : 'loading';
            if (!forceRefresh && !suppressLoadingText && !silentIfCached) {
                cell.textContent = 'Loading…';
            }
            cell.classList.remove('quote-error');
        }

        if (!this.finnhub.apiKey || deferNetworkFetch) {
            return;
        }

        this.getCurrentPrice(ticker, { forceRefresh })
            .then(quote => {
                if (!cell.isConnected) {
                    return;
                }
                this.renderQuoteValue(cell, row, trade, quote);
            })
            .catch(error => {
                if (!cell.isConnected) {
                    return;
                }
                const message = this.getQuoteErrorMessage(error);
                this.setQuoteCellError(cell, row, trade, message);
            });
    }

    renderQuoteValue(cell, row, trade, quote) {
        if (!cell) {
            return;
        }
        cell.dataset.priceState = 'ready';
        cell.classList.remove('quote-error');
        const numeric = Number(quote?.price);
        if (!Number.isFinite(numeric)) {
            cell.textContent = '—';
            this.applyPositionHighlight(row, trade, null);
            return;
        }

        const changePercent = this.getQuoteChangePercent(quote);
        const changeValue = this.getQuoteChangeValue(quote);

        cell.innerHTML = '';

        const priceEl = document.createElement('span');
        priceEl.className = 'quote-price';
        priceEl.textContent = this.formatCurrency(numeric);
        cell.appendChild(priceEl);

        if (Number.isFinite(changePercent)) {
            const changeEl = document.createElement('span');
            changeEl.className = 'quote-change';

            const formattedPercent = `${changePercent > 0 ? '+' : changePercent < 0 ? '' : ''}${changePercent.toFixed(2)}%`;
            changeEl.textContent = formattedPercent;

            if (changePercent > 0) {
                changeEl.classList.add('is-up');
            } else if (changePercent < 0) {
                changeEl.classList.add('is-down');
            } else {
                changeEl.classList.add('is-flat');
            }

            if (Number.isFinite(changeValue)) {
                const formattedChange = `${changeValue > 0 ? '+' : changeValue < 0 ? '' : ''}${changeValue.toFixed(2)}`;
                changeEl.title = `${formattedChange} (${formattedPercent})`;
            }

            cell.appendChild(changeEl);
        }

        this.applyPositionHighlight(row, trade, numeric);
    }

    getQuoteChangePercent(quote) {
        const percent = Number(quote?.changePercent);
        if (Number.isFinite(percent)) {
            return percent;
        }

        const change = Number(quote?.change);
        const previousClose = Number(quote?.previousClose);
        if (Number.isFinite(change) && Number.isFinite(previousClose) && previousClose !== 0) {
            return (change / previousClose) * 100;
        }

        const price = Number(quote?.price);
        if (Number.isFinite(price) && Number.isFinite(previousClose) && previousClose !== 0) {
            return ((price - previousClose) / previousClose) * 100;
        }

        return null;
    }

    getQuoteChangeValue(quote) {
        const change = Number(quote?.change);
        if (Number.isFinite(change)) {
            return change;
        }

        const price = Number(quote?.price);
        const previousClose = Number(quote?.previousClose);
        if (Number.isFinite(price) && Number.isFinite(previousClose)) {
            return price - previousClose;
        }

        return null;
    }

    setQuoteCellError(cell, row, trade, message) {
        if (!cell) {
            return;
        }
        cell.dataset.priceState = 'error';
        cell.classList.add('quote-error');
        cell.textContent = message || 'Unavailable';
        this.applyPositionHighlight(row, trade, null);
    }

    getQuoteErrorMessage(error) {
        const message = (error?.message || '').toLowerCase();
        if (!message) {
            return 'Unavailable';
        }
        if (message.includes('api key')) {
            return 'Set API key';
        }
        if (message.includes('rate limit')) {
            return 'Rate limited';
        }
        if (message.includes('symbol')) {
            return 'Bad ticker';
        }
        if (message.includes('network')) {
            return 'Network error';
        }
        return 'Unavailable';
    }

    getCachedQuote(ticker) {
        if (!ticker) {
            return null;
        }
        const cached = this.finnhub.cache.get(ticker);
        if (!cached) {
            return null;
        }
        if (Date.now() - cached.timestamp > this.finnhub.cacheTTL) {
            this.finnhub.cache.delete(ticker);
            return null;
        }
        return cached;
    }

    setCachedQuote(ticker, value) {
        if (!ticker) {
            return;
        }
        this.finnhub.cache.set(ticker, {
            value,
            timestamp: Date.now()
        });
    }

    async getCurrentPrice(ticker, { forceRefresh = false } = {}) {
        const symbol = (ticker || '').toString().trim().toUpperCase();
        if (!symbol) {
            throw new Error('Invalid symbol');
        }

        if (forceRefresh) {
            this.finnhub.cache.delete(symbol);
        } else {
            const cached = this.getCachedQuote(symbol);
            if (cached) {
                return cached.value;
            }
        }

        if (!this.finnhub.apiKey) {
            throw new Error('Finnhub API key missing');
        }

        const existing = this.finnhub.outstandingRequests.get(symbol);
        if (existing) {
            return existing;
        }

        const request = this.enqueueFinnhubRequest(symbol)
            .then(result => {
                this.setCachedQuote(symbol, result);
                return result;
            })
            .catch(error => {
                this.updateFinnhubStatus(error.message || 'Failed to load quote.', 'error', 7000);
                throw error;
            })
            .finally(() => {
                this.finnhub.outstandingRequests.delete(symbol);
            });

        this.finnhub.outstandingRequests.set(symbol, request);

        return request;
    }

    enqueueFinnhubRequest(symbol) {
        const execute = () => this.performFinnhubFetch(symbol);
        const chain = this.finnhub.rateLimitQueue
            .catch(() => undefined)
            .then(execute);

        this.finnhub.rateLimitQueue = chain
            .then(() => undefined)
            .catch(() => undefined);

        return chain;
    }

    async performFinnhubFetch(symbol) {
        await this.enforceFinnhubRateLimit();

        const url = new URL('https://finnhub.io/api/v1/quote');
        url.searchParams.set('symbol', symbol);
        url.searchParams.set('token', this.finnhub.apiKey);

        let response;
        try {
            response = await fetch(url.toString(), { cache: 'no-store' });
        } catch (error) {
            throw new Error('Network error fetching price');
        }

        if (!response.ok) {
            throw new Error(response.status === 429 ? 'Finnhub rate limit exceeded. Please wait.' : 'Finnhub API error');
        }

        let payload;
        try {
            payload = await response.json();
        } catch (error) {
            throw new Error('Invalid response from Finnhub');
        }

        if (payload && typeof payload.error === 'string') {
            throw new Error(payload.error);
        }

        const price = Number(payload?.c);
        if (!Number.isFinite(price)) {
            throw new Error('Price unavailable for symbol');
        }

        const change = Number(payload?.d);
        const changePercent = Number(payload?.dp);
        const previousClose = Number(payload?.pc);
        const openPrice = Number(payload?.o);
        const high = Number(payload?.h);
        const low = Number(payload?.l);

        return {
            price,
            change: Number.isFinite(change) ? change : null,
            changePercent: Number.isFinite(changePercent) ? changePercent : null,
            previousClose: Number.isFinite(previousClose) ? previousClose : null,
            open: Number.isFinite(openPrice) ? openPrice : null,
            high: Number.isFinite(high) ? high : null,
            low: Number.isFinite(low) ? low : null,
            fetchedAt: new Date().toISOString(),
            currency: 'USD'
        };
    }

    async enforceFinnhubRateLimit() {
        const windowMs = 60_000;
        const timestamps = this.finnhub.timestamps;
        const now = Date.now();

        while (timestamps.length > 0 && now - timestamps[0] >= windowMs) {
            timestamps.shift();
        }

        if (timestamps.length >= this.finnhub.maxRequestsPerMinute) {
            const waitTime = windowMs - (now - timestamps[0]) + 50;
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }

        timestamps.push(Date.now());
    }

    applyPositionHighlight(row, trade, currentPrice = null) {
        if (!row) {
            return;
        }
        this.updateExpirationHighlight(row, trade);
        this.updateItmHighlight(row, trade, currentPrice);
    }

    updateExpirationHighlight(row, trade) {
        if (!row) {
            return;
        }

        row.classList.remove('position-expiring-critical', 'position-expiring-warning');

        const warningThreshold = this.positionHighlightConfig?.expirationWarningDays ?? 20;
        const criticalThreshold = this.positionHighlightConfig?.expirationCriticalDays ?? 7;
        const rawDte = trade?.dte;
        const dteValue = this.parseInteger(rawDte, null, { allowNegative: true });

        if (!Number.isFinite(dteValue) || dteValue < 0) {
            return;
        }

        if (dteValue < criticalThreshold) {
            row.classList.add('position-expiring-critical');
        } else if (dteValue < warningThreshold) {
            row.classList.add('position-expiring-warning');
        }
    }

    updateItmHighlight(row, trade, currentPrice) {
        if (!row) {
            return;
        }
        const isItm = this.isInTheMoney(trade, currentPrice);
        row.classList.toggle('position-itm', Boolean(isItm));
    }

    isInTheMoney(trade, currentPrice) {
        if (!Number.isFinite(currentPrice)) {
            return false;
        }
        const strike = Number(trade?.strikePrice);
        if (!Number.isFinite(strike)) {
            return false;
        }

        const flavor = this.inferOptionFlavor(trade);
        if (flavor === 'call') {
            return currentPrice >= strike;
        }
        if (flavor === 'put') {
            return currentPrice <= strike;
        }
        return false;
    }

    inferOptionFlavor(trade = {}) {
        const explicit = (trade.optionType || trade.optionFlavor || '').toString().trim().toLowerCase();
        if (explicit === 'call' || explicit === 'put') {
            return explicit;
        }

        const strategy = (trade.strategy || '').toLowerCase();
        const containsCall = strategy.includes('call');
        const containsPut = strategy.includes('put');

        if (containsCall && !containsPut) {
            return 'call';
        }
        if (containsPut && !containsCall) {
            return 'put';
        }

        const notes = (trade.notes || '').toLowerCase();
        const noteCall = notes.includes('call');
        const notePut = notes.includes('put');
        if (noteCall && !notePut) {
            return 'call';
        }
        if (notePut && !noteCall) {
            return 'put';
        }

        return null;
    }

    updateMonthlyPLChart() {
        const canvas = document.getElementById('monthlyPLChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        if (this.charts.monthlyPL) {
            this.charts.monthlyPL.destroy();
        }

        const monthlyData = {};
        this.trades
            .filter(trade => this.isClosedStatus(trade.status) && trade.exitDate)
            .forEach(trade => {
                const monthKey = trade.exitDate.substring(0, 7); // YYYY-MM
                if (!monthlyData[monthKey]) {
                    monthlyData[monthKey] = 0;
                }
                monthlyData[monthKey] += trade.pl;
            });

        const sortedMonths = Object.keys(monthlyData).sort();
        const labels = sortedMonths.map(month => {
            const date = new Date(month + '-01');
            return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        });

        this.charts.monthlyPL = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Monthly P&L',
                    data: sortedMonths.map(month => monthlyData[month]),
                    backgroundColor: sortedMonths.map(month => monthlyData[month] >= 0 ? '#1FB8CD' : '#B4413C'),
                    borderColor: sortedMonths.map(month => monthlyData[month] >= 0 ? '#1FB8CD' : '#B4413C'),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function (value) {
                                return '$' + value.toLocaleString();
                            }
                        }
                    },
                    x: {
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                return 'P&L: $' + context.raw.toLocaleString();
                            }
                        }
                    }
                }
            }
        });
    }

    updateCumulativePLChart() {
        const canvas = document.getElementById('cumulativePLChart');
        if (!canvas) {
            console.error('Cumulative P&L chart canvas not found');
            return;
        }

        const ctx = canvas.getContext('2d');

        if (this.charts.cumulativePL) {
            this.charts.cumulativePL.destroy();
        }

        const closedTrades = this.trades
            .filter(trade => this.isClosedStatus(trade.status) && trade.exitDate);

        const renderEmptyChart = () => {
            this.charts.cumulativePL = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: ['No Data'],
                    datasets: [{
                        label: 'Cumulative P&L',
                        data: [0],
                        borderColor: '#1FB8CD',
                        backgroundColor: 'rgba(31, 184, 205, 0.1)',
                        fill: false,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            ticks: {
                                callback: function (value) {
                                    return '$' + value.toLocaleString();
                                }
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: false
                        }
                    }
                }
            });
        };

        if (closedTrades.length === 0) {
            renderEmptyChart();
            return;
        }

        const weeklyPL = new Map();
        let earliestWeek = null;
        let latestWeek = null;

        closedTrades.forEach(trade => {
            const weekEnding = this.getWeekEndingFriday(trade.exitDate);
            if (!weekEnding) {
                return;
            }

            const key = this.getWeekKey(weekEnding);
            weeklyPL.set(key, (weeklyPL.get(key) || 0) + trade.pl);

            if (!earliestWeek || weekEnding < earliestWeek) {
                earliestWeek = new Date(weekEnding);
            }
            if (!latestWeek || weekEnding > latestWeek) {
                latestWeek = new Date(weekEnding);
            }
        });

        if (!earliestWeek || !latestWeek) {
            renderEmptyChart();
            return;
        }

        earliestWeek.setHours(0, 0, 0, 0);
        latestWeek.setHours(0, 0, 0, 0);

        const labels = [];
        const dataPoints = [];
        let cumulativePL = 0;
        const cursor = new Date(earliestWeek);

        while (cursor.getTime() <= latestWeek.getTime()) {
            const key = this.getWeekKey(cursor);
            cumulativePL += weeklyPL.get(key) || 0;
            labels.push(this.formatWeekLabel(cursor));
            dataPoints.push(cumulativePL);
            cursor.setDate(cursor.getDate() + 7);
        }

        this.charts.cumulativePL = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Cumulative P&L',
                    data: dataPoints,
                    borderColor: '#1FB8CD',
                    backgroundColor: 'rgba(31, 184, 205, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 3,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        ticks: {
                            callback: function (value) {
                                if (typeof value === 'string') {
                                    return value;
                                }

                                if (typeof value === 'number' && this && typeof this.getLabelForValue === 'function') {
                                    const label = this.getLabelForValue(value);
                                    if (label) {
                                        return label;
                                    }
                                }

                                return '';
                            },
                            maxRotation: 45,
                            minRotation: 45
                        }
                    },
                    y: {
                        ticks: {
                            callback: function (value) {
                                return '$' + value.toLocaleString();
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            title: function (context) {
                                return context[0]?.label || '';
                            },
                            label: function (context) {
                                return 'Cumulative P&L: $' + context.raw.toLocaleString();
                            }
                        }
                    }
                }
            }
        });
    }

    getWeekEndingFriday(dateInput) {
        const date = new Date(dateInput);
        if (isNaN(date.getTime())) {
            return null;
        }

        const weekEnd = new Date(date);
        weekEnd.setHours(0, 0, 0, 0);
        const day = weekEnd.getDay();

        if (day === 5) {
            return weekEnd;
        }

        if (day === 6) {
            weekEnd.setDate(weekEnd.getDate() - 1);
            return weekEnd;
        }

        if (day === 0) {
            weekEnd.setDate(weekEnd.getDate() - 2);
            return weekEnd;
        }

        weekEnd.setDate(weekEnd.getDate() + (5 - day));
        return weekEnd;
    }

    getWeekKey(dateInput) {
        const date = new Date(dateInput);
        if (isNaN(date.getTime())) {
            return '';
        }

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    formatWeekLabel(dateInput) {
        const date = new Date(dateInput);
        if (isNaN(date.getTime())) {
            return '';
        }

        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: '2-digit',
            year: 'numeric'
        });
    }

    updateStrategyPerformanceChart() {
        const canvas = document.getElementById('strategyChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        if (this.charts.strategy) {
            this.charts.strategy.destroy();
        }

        const strategyPL = {};
        this.trades.filter(trade => this.isClosedStatus(trade.status)).forEach(trade => {
            if (!strategyPL[trade.strategy]) {
                strategyPL[trade.strategy] = 0;
            }
            strategyPL[trade.strategy] += trade.pl;
        });

        const sortedStrategies = Object.entries(strategyPL)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 8);

        this.charts.strategy = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: sortedStrategies.map(([strategy]) => strategy),
                datasets: [{
                    label: 'Total P&L',
                    data: sortedStrategies.map(([, pl]) => pl),
                    backgroundColor: sortedStrategies.map(([, pl]) => pl >= 0 ? '#1FB8CD' : '#B4413C'),
                    borderColor: sortedStrategies.map(([, pl]) => pl >= 0 ? '#1FB8CD' : '#B4413C'),
                    borderWidth: 1
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: {
                            callback: function (value) {
                                return '$' + value.toLocaleString();
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                return 'P&L: $' + context.raw.toLocaleString();
                            }
                        }
                    }
                }
            }
        });
    }

    updateWinRateByStrategyChart() {
        const canvas = document.getElementById('winRateChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        if (this.charts.winRate) {
            this.charts.winRate.destroy();
        }

        const strategyStats = {};
        this.trades.forEach(trade => {
            if (!strategyStats[trade.strategy]) {
                strategyStats[trade.strategy] = { total: 0, wins: 0 };
            }
            if (this.isClosedStatus(trade.status)) {
                strategyStats[trade.strategy].total++;
                if (trade.pl > 0) {
                    strategyStats[trade.strategy].wins++;
                }
            }
        });

        const validStrategies = Object.entries(strategyStats)
            .filter(([, stats]) => stats.total >= 1)
            .map(([strategy, stats]) => ({
                strategy,
                winRate: (stats.wins / stats.total) * 100,
                total: stats.total
            }))
            .sort((a, b) => b.winRate - a.winRate);

        const colors = ['#1FB8CD', '#FFC185', '#B4413C', '#ECEBD5', '#5D878F', '#DB4545', '#D2BA4C', '#964325', '#944454', '#13343B'];

        this.charts.winRate = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: validStrategies.map(s => `${s.strategy} (${s.total})`),
                datasets: [{
                    data: validStrategies.map(s => s.winRate),
                    backgroundColor: colors.slice(0, validStrategies.length),
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            boxWidth: 15,
                            padding: 15
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                return context.label + ': ' + context.raw.toFixed(2) + '%';
                            }
                        }
                    }
                }
            }
        });
    }

    updateMarketConditionChart() {
        const canvas = document.getElementById('marketConditionChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        if (this.charts.marketCondition) {
            this.charts.marketCondition.destroy();
        }

        const conditionPL = {};
        this.trades.filter(trade => this.isClosedStatus(trade.status)).forEach(trade => {
            if (!conditionPL[trade.marketCondition]) {
                conditionPL[trade.marketCondition] = 0;
            }
            conditionPL[trade.marketCondition] += trade.pl;
        });

        this.charts.marketCondition = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: Object.keys(conditionPL),
                datasets: [{
                    label: 'P&L by Market Condition',
                    data: Object.values(conditionPL),
                    backgroundColor: Object.values(conditionPL).map(val => val >= 0 ? '#1FB8CD' : '#B4413C'),
                    borderColor: Object.values(conditionPL).map(val => val >= 0 ? '#1FB8CD' : '#B4413C'),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function (value) {
                                return '$' + value.toLocaleString();
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                return 'P&L: $' + context.raw.toLocaleString();
                            }
                        }
                    }
                }
            }
        });
    }

    updateTradesList() {
        this.populateFilters();
        this.filterTrades();
    }

    populateFilters() {
        const strategySelect = document.getElementById('filter-strategy');
        const tradeTypeSelect = document.getElementById('filter-trade-type');

        const previousSelections = {
            strategy: strategySelect?.value || '',
            tradeType: tradeTypeSelect?.value || ''
        };

        const strategies = [...new Set(this.trades.map(trade => trade.strategy))]
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b));

        const tradeTypes = [...new Set(this.trades.map(trade => this.getTradeType(trade)))]
            .filter(type => type && type !== '—')
            .sort((a, b) => a.localeCompare(b));

        if (strategySelect) {
            strategySelect.innerHTML = '<option value="">All Strategies</option>';
            strategies.forEach(strategy => {
                const option = document.createElement('option');
                option.value = strategy;
                option.textContent = strategy;
                strategySelect.appendChild(option);
            });
            if (previousSelections.strategy && strategies.includes(previousSelections.strategy)) {
                strategySelect.value = previousSelections.strategy;
            }
        }

        if (tradeTypeSelect) {
            tradeTypeSelect.innerHTML = '<option value="">All Trade Types</option>';
            tradeTypes.forEach(type => {
                const option = document.createElement('option');
                option.value = type;
                option.textContent = type;
                tradeTypeSelect.appendChild(option);
            });
            if (previousSelections.tradeType && tradeTypes.includes(previousSelections.tradeType)) {
                tradeTypeSelect.value = previousSelections.tradeType;
            }
        }
    }

    filterTrades() {
        const strategyFilter = document.getElementById('filter-strategy')?.value || '';
        const statusFilter = document.getElementById('filter-status')?.value || '';
        const marketFilter = document.getElementById('filter-market-condition')?.value || '';
        const tradeTypeFilter = document.getElementById('filter-trade-type')?.value || '';
        const searchTerm = (document.getElementById('search-ticker')?.value || '').toString().trim().toLowerCase();

        const filteredTrades = this.trades.filter(trade => {
            const matchesStrategy = !strategyFilter || trade.strategy === strategyFilter;
            const normalizedStatus = this.normalizeStatus(trade.status);
            let matchesStatus = true;
            if (statusFilter) {
                const filterStatus = statusFilter.toLowerCase();
                if (filterStatus === 'assigned') {
                    matchesStatus = normalizedStatus === 'assigned' ||
                        (normalizedStatus === 'closed' && this.isAssignmentReason(trade.exitReason));
                } else {
                    matchesStatus = normalizedStatus === filterStatus;
                }
            }
            const matchesMarket = !marketFilter || trade.marketCondition === marketFilter;
            const tradeTypeValue = this.getTradeType(trade);
            const matchesTradeType = !tradeTypeFilter || tradeTypeValue === tradeTypeFilter;
            const tickerValueRaw = (trade.ticker ?? '').toString();
            const tickerLower = tickerValueRaw.toLowerCase();
            const tradeCycleId = this.normalizeCycleId(trade.cycleId);
            const cycleLower = tradeCycleId.toLowerCase();
            const cycleType = this.normalizeCycleType(trade.cycleType, trade.strategy) || '';
            const cycleTypeLower = cycleType.toLowerCase();
            const matchesSearch = !searchTerm ||
                tickerLower.includes(searchTerm) ||
                cycleLower.includes(searchTerm) ||
                (cycleTypeLower && cycleTypeLower.includes(searchTerm));

            return matchesStrategy && matchesStatus && matchesMarket && matchesTradeType && matchesSearch;
        });

        this.renderTradesTable(filteredTrades);
    }

    openTradesFilteredByTicker(ticker) {
        const normalizedTicker = (ticker ?? '').toString().trim().toUpperCase();
        if (!normalizedTicker) {
            return;
        }

        this.showView('trades-list');

        const searchInput = document.getElementById('search-ticker');
        if (searchInput) {
            searchInput.value = normalizedTicker;
            searchInput.focus();
        }

        ['filter-strategy', 'filter-status', 'filter-market-condition', 'filter-trade-type'].forEach(filterId => {
            const filterElement = document.getElementById(filterId);
            if (filterElement && filterElement.value !== '') {
                filterElement.value = '';
            }
        });

        this.filterTrades();
    }

    openTradesFilteredByCycle(cycleId, ticker = '') {
        const normalizedCycle = this.normalizeCycleId(cycleId);

        if (!normalizedCycle) {
            return;
        }

        this.showView('trades-list');

        const tickerSearch = document.getElementById('search-ticker');

        if (tickerSearch) {
            tickerSearch.value = normalizedCycle;
            tickerSearch.focus();
        }

        this.filterTrades();
    }

    // UPDATED: New table structure with required columns
    renderTradesTable(trades = this.trades) {
        const tbody = document.querySelector('#trades-table tbody');
        if (!tbody) return;

        tbody.innerHTML = '';

        const safeNumber = (value) => {
            const num = Number(value);
            return Number.isFinite(num) ? num : null;
        };

        const columnLabels = [
            'Ticker', 'Strategy', 'Cycle', 'Trade Type', 'Strike', 'Qty', 'Entry Price',
            'Exit Price', 'Entry Date', 'Expiration', 'DTE', 'Exit Date', 'Days Held',
            'Max Risk', 'P&L', 'ROI', 'Annual ROI', 'Status', 'Actions'
        ];

        trades.forEach(trade => {
            const row = tbody.insertRow();

            // 1. Ticker
            const tickerCell = row.insertCell(0);
            tickerCell.appendChild(this.createTickerElement(trade.ticker));

            // 2. Strategy
            row.insertCell(1).textContent = trade.strategy || '—';

            // 3. Cycle Summary
            const cycleCell = row.insertCell(2);
            const cycleId = this.normalizeCycleId(trade.cycleId);
            if (cycleId) {
                const cycleType = this.normalizeCycleType(trade.cycleType, trade.strategy);
                const cycleButton = document.createElement('button');
                cycleButton.type = 'button';
                cycleButton.className = 'cycle-chip cycle-chip--link';
                cycleButton.textContent = cycleType ? `${cycleId} (${cycleType.toUpperCase()})` : cycleId;
                cycleButton.addEventListener('click', () => {
                    this.openTradesFilteredByCycle(cycleId, trade.ticker);
                });
                cycleButton.title = 'View trades in this cycle';
                cycleCell.appendChild(cycleButton);
            } else {
                cycleCell.textContent = '—';
            }

            // 4. Trade Type
            const tradeTypeCell = row.insertCell(3);
            const tradeTypeDisplay = this.getTradeType(trade);
            tradeTypeCell.textContent = tradeTypeDisplay;
            const tradeTypeClassMap = {
                'BTO': 'trade-type-bto',
                'STO': 'trade-type-sto',
                'STC': 'trade-type-stc',
                'BTC': 'trade-type-btc'
            };
            tradeTypeCell.className = tradeTypeClassMap[tradeTypeDisplay] || '';

            // 5. Strike
            const strikeCell = row.insertCell(4);
            const strikePrice = safeNumber(trade.strikePrice);
            strikeCell.textContent = strikePrice !== null ? `$${strikePrice.toFixed(2)}` : '—';

            // 6. Qty
            const quantityCell = row.insertCell(5);
            const quantityValue = safeNumber(trade.quantity);
            quantityCell.textContent = quantityValue !== null ? Math.abs(quantityValue) : '—';

            // 7. Entry Price
            const entryCell = row.insertCell(6);
            const entryPrice = safeNumber(trade.entryPrice);
            entryCell.textContent = entryPrice !== null ? `$${entryPrice.toFixed(2)}` : '—';

            // 8. Exit Price
            const exitPriceCell = row.insertCell(7);
            const exitPrice = safeNumber(trade.exitPrice);
            exitPriceCell.textContent = exitPrice !== null ? `$${exitPrice.toFixed(2)}` : '-';

            // 9. Entry Date
            row.insertCell(8).textContent = this.formatDate(trade.entryDate);

            // 10. Expiration Date
            row.insertCell(9).textContent = this.formatDate(trade.expirationDate);

            // 11. DTE
            const dteCell = row.insertCell(10);
            const dteValue = safeNumber(trade.dte);
            dteCell.textContent = dteValue !== null ? dteValue : '—';

            // 12. Exit Date
            const exitDateCell = row.insertCell(11);
            exitDateCell.textContent = trade.exitDate ? this.formatDate(trade.exitDate) : '-';

            // 13. Days Held
            const daysHeldCell = row.insertCell(12);
            const daysHeldValue = safeNumber(trade.daysHeld);
            daysHeldCell.textContent = daysHeldValue !== null ? daysHeldValue : '—';

            // 14. Max Risk
            const maxRiskCell = row.insertCell(13);
            const maxRiskValue = safeNumber(trade.maxRisk);
            if (maxRiskValue !== null) {
                maxRiskCell.textContent = this.formatCurrency(maxRiskValue);
                maxRiskCell.className = 'pl-negative';
            } else {
                maxRiskCell.textContent = '—';
                maxRiskCell.className = 'pl-neutral';
            }

            // 15. P&L
            const plCell = row.insertCell(14);
            const plValue = safeNumber(trade.pl);
            if (plValue !== null) {
                plCell.textContent = this.formatCurrency(plValue);
                plCell.className = plValue > 0 ? 'pl-positive' : plValue < 0 ? 'pl-negative' : 'pl-neutral';
            } else {
                plCell.textContent = '—';
                plCell.className = 'pl-neutral';
            }

            // 16. ROI
            const roiCell = row.insertCell(15);
            const roiValue = safeNumber(trade.roi);
            if (roiValue !== null) {
                roiCell.textContent = `${roiValue.toFixed(2)}%`;
                roiCell.className = roiValue > 0 ? 'pl-positive' : roiValue < 0 ? 'pl-negative' : 'pl-neutral';
            } else {
                roiCell.textContent = '—';
                roiCell.className = 'pl-neutral';
            }

            // 17. Annual ROI
            const annRoiCell = row.insertCell(16);
            const annualROIValue = safeNumber(trade.annualizedROI);
            const hasAnnualROI = this.isClosedStatus(trade.status) && annualROIValue !== null;
            if (hasAnnualROI) {
                annRoiCell.textContent = `${annualROIValue.toFixed(2)}%`;
                annRoiCell.className = annualROIValue > 0 ? 'pl-positive' : annualROIValue < 0 ? 'pl-negative' : 'pl-neutral';
            } else {
                annRoiCell.textContent = '-';
                annRoiCell.className = 'pl-neutral';
            }

            // 18. Status (badge styling)
            const statusCell = row.insertCell(17);
            const statusBadge = document.createElement('span');
            const displayStatus = this.getDisplayStatus(trade);
            const statusClass = displayStatus.toLowerCase().replace(/\s+/g, '-');
            statusBadge.className = `status-badge ${statusClass}`.trim();
            statusBadge.textContent = displayStatus;
            statusCell.appendChild(statusBadge);

            // 19. Actions
            const actionsCell = row.insertCell(18);
            actionsCell.className = 'actions-cell';

            const editButton = document.createElement('button');
            editButton.type = 'button';
            editButton.className = 'action-btn action-btn--edit';
            editButton.textContent = 'Edit';
            editButton.addEventListener('click', () => this.editTrade(trade.id));

            const deleteButton = document.createElement('button');
            deleteButton.type = 'button';
            deleteButton.className = 'action-btn action-btn--delete';
            deleteButton.textContent = 'Delete';
            deleteButton.addEventListener('click', () => this.deleteTrade(trade.id));

            actionsCell.append(editButton, deleteButton);

            this.applyResponsiveLabels(row, columnLabels);
        });
    }

    sortTrades(sortBy) {
        const direction = this.sortDirection[sortBy] === 'asc' ? 'desc' : 'asc';
        this.sortDirection[sortBy] = direction;

        // Update sort indicators
        document.querySelectorAll('.sortable').forEach(header => {
            header.classList.remove('asc', 'desc');
        });
        const sortHeader = document.querySelector(`[data-sort="${sortBy}"]`);
        if (sortHeader) {
            sortHeader.classList.add(direction);
        }

        const sortedTrades = [...this.trades].sort((a, b) => {
            let aVal = a[sortBy];
            let bVal = b[sortBy];

            if (sortBy.includes('Date')) {
                aVal = new Date(aVal);
                bVal = new Date(bVal);
            }

            if (direction === 'asc') {
                return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
            } else {
                return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
            }
        });

        this.renderTradesTable(sortedTrades);
    }

    deleteTrade(id) {
        if (confirm('Are you sure you want to delete this trade?')) {
            this.trades = this.trades.filter(trade => trade.id !== id);
            this.saveToStorage();
            this.markUnsavedChanges();
            this.filterTrades();
            this.updateDashboard();
        }
    }

    editTrade(id) {
        const trade = this.trades.find(t => t.id === id);
        if (trade) {
            // Set the current editing ID
            this.currentEditingId = id;

            // Populate form with trade data using proper date formatting
            const form = document.getElementById('add-trade-form');
            const elements = form.elements;

            elements.ticker.value = trade.ticker;
            elements.strategy.value = trade.strategy;
            const normalizedType = this.getTradeType(trade);
            elements.tradeType.value = VALID_TRADE_TYPES.has(normalizedType) ? normalizedType : 'BTO';
            elements.quantity.value = Math.abs(trade.quantity);
            elements.entryDate.value = this.formatDateForInput(trade.entryDate);
            elements.expirationDate.value = this.formatDateForInput(trade.expirationDate);
            elements.exitDate.value = this.formatDateForInput(trade.exitDate);
            elements.status.value = trade.status;
            elements.stockPriceAtEntry.value = trade.stockPriceAtEntry;
            elements.strikePrice.value = trade.strikePrice;
            elements.entryPrice.value = trade.entryPrice;
            elements.exitPrice.value = (trade.exitPrice !== null && trade.exitPrice !== undefined) ? trade.exitPrice : '';
            elements.fees.value = trade.fees;
            elements.ivRank.value = trade.ivRank || '';
            elements.delta.value = trade.delta || '';
            elements.gamma.value = trade.gamma || '';
            elements.theta.value = trade.theta || '';
            elements.vega.value = trade.vega || '';
            if (elements.definedRiskWidth) {
                elements.definedRiskWidth.value = Number.isFinite(Number(trade.definedRiskWidth)) ? trade.definedRiskWidth : '';
            }
            if (elements.maxRiskOverride) {
                elements.maxRiskOverride.value = Number.isFinite(Number(trade.maxRiskOverride)) ? trade.maxRiskOverride : '';
            }
            elements.marketCondition.value = trade.marketCondition;
            elements.convictionLevel.value = trade.convictionLevel;
            elements.notes.value = trade.notes || '';
            elements.exitReason.value = trade.exitReason || '';
            if (elements.cycleId) {
                elements.cycleId.value = trade.cycleId || '';
            }
            if (elements.cycleType) {
                elements.cycleType.value = trade.cycleType || '';
            }
            if (elements.cycleRole) {
                elements.cycleRole.value = trade.cycleRole || '';
            }

            document.getElementById('conviction-display').textContent = trade.convictionLevel;
            this.updateTickerPreview(trade.ticker);

            // Show add form for editing
            this.showView('add-trade');
        }
    }

    exportToCSV() {
        const headers = [
            'Ticker', 'Strategy', 'Trade Type', 'Strike', 'Defined Risk Width', 'Qty', 'Entry Price', 'Exit Price', 'DTE', 'Days Held',
            'Entry Date', 'Expiration Date', 'Exit Date', 'Max Risk', 'P&L', 'ROI %', 'Annual ROI %', 'Status',
            'Stock Price at Entry', 'Fees', 'Max Risk Override', 'Delta', 'Gamma', 'Theta', 'Vega', 'IV Rank', 'Market Condition',
            'Conviction Level', 'Notes', 'Exit Reason', 'Cycle ID', 'Cycle Type', 'Cycle Role'
        ];

        const csvContent = [
            headers.join(','),
            ...this.trades.map(trade => [
                trade.ticker,
                `"${trade.strategy}"`,
                this.getTradeType(trade),
                trade.strikePrice,
                Number.isFinite(Number(trade.definedRiskWidth)) ? Number(trade.definedRiskWidth).toFixed(2) : '',
                Math.abs(trade.quantity),
                trade.entryPrice,
                (trade.exitPrice !== null && trade.exitPrice !== undefined) ? trade.exitPrice : '',
                trade.dte,
                trade.daysHeld,
                trade.entryDate,
                trade.expirationDate,
                trade.exitDate || '',
                trade.maxRisk.toFixed(2),
                trade.pl.toFixed(2),
                trade.roi.toFixed(2),
                trade.annualizedROI.toFixed(2),
                trade.status,
                trade.stockPriceAtEntry,
                trade.fees,
                Number.isFinite(Number(trade.maxRiskOverride)) ? Number(trade.maxRiskOverride).toFixed(2) : '',
                trade.delta || '',
                trade.gamma || '',
                trade.theta || '',
                trade.vega || '',
                trade.ivRank || '',
                trade.marketCondition,
                trade.convictionLevel,
                `"${trade.notes || ''}"`,
                trade.exitReason || '',
                trade.cycleId || '',
                trade.cycleType || '',
                trade.cycleRole || ''
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = 'options_trades_enhanced.csv';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    }

    // File System Access API Methods
    async saveDatabase() {
        this.showLoadingIndicator('Saving...');

        try {
            const data = this.buildDatabasePayload();

            if (this.supportsFileSystemAccess) {
                await this.saveWithFileSystemAPI(data);
            } else {
                this.saveWithDownload(data);
            }

            this.hasUnsavedChanges = false;
            this.updateUnsavedIndicator();
            this.showNotification('Database saved successfully!', 'success');
        } catch (error) {
            console.error('Save error:', error);
            if (error.name !== 'AbortError') {
                try {
                    const data = this.buildDatabasePayload();
                    this.saveWithDownload(data);
                    this.hasUnsavedChanges = false;
                    this.updateUnsavedIndicator();
                    this.showNotification('Database saved as download!', 'success');
                } catch (fallbackError) {
                    this.showNotification('Failed to save database', 'error');
                }
            }
        }

        this.hideLoadingIndicator();
    }

    buildDatabasePayload() {
        return {
            trades: this.trades,
            exportDate: new Date().toISOString(),
            version: '2.2',
            finnhubApiKey: this.finnhub.apiKey || ''
        };
    }

    async saveWithFileSystemAPI(data) {
        try {
            if (!this.currentFileHandle) {
                this.currentFileHandle = await window.showSaveFilePicker({
                    suggestedName: 'options_tracker.json',
                    types: [{
                        description: 'JSON files',
                        accept: { 'application/json': ['.json'] }
                    }]
                });
            }

            const writable = await this.currentFileHandle.createWritable();
            await writable.write(JSON.stringify(data, null, 2));
            await writable.close();

            this.currentFileName = this.currentFileHandle.name;
            this.updateFileNameDisplay();
        } catch (error) {
            throw error;
        }
    }

    saveWithDownload(data) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'options_tracker.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.currentFileName = 'options_tracker.json';
        this.updateFileNameDisplay();
    }

    async loadDatabase() {
        this.showLoadingIndicator('Loading...');

        try {
            if (this.supportsFileSystemAccess) {
                await this.loadWithFileSystemAPI();
            } else {
                this.loadWithFileInput();
            }
        } catch (error) {
            console.error('Load error:', error);
            if (error.name !== 'AbortError') {
                this.loadWithFileInput();
            }
        }

        this.hideLoadingIndicator();
    }

    async loadWithFileSystemAPI() {
        const [fileHandle] = await window.showOpenFilePicker({
            types: [{
                description: 'JSON files',
                accept: { 'application/json': ['.json'] }
            }]
        });

        const file = await fileHandle.getFile();
        const text = await file.text();
        const data = JSON.parse(text);

        this.processLoadedData(data);
        this.currentFileHandle = fileHandle;
        this.currentFileName = fileHandle.name;
        this.updateFileNameDisplay();
        this.showNotification(`Loaded ${this.trades.length} trades successfully!`, 'success');
    }

    loadWithFileInput() {
        const fileInput = document.getElementById('file-input');
        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const data = JSON.parse(e.target.result);
                        this.processLoadedData(data);
                        this.currentFileName = file.name;
                        this.updateFileNameDisplay();
                        this.showNotification(`Loaded ${this.trades.length} trades successfully!`, 'success');
                    } catch (error) {
                        this.showNotification('Invalid JSON file', 'error');
                    }
                    fileInput.value = '';
                };
                reader.readAsText(file);
            } else {
                fileInput.value = '';
            }
        };
        fileInput.click();
    }

    processLoadedData(data) {
        if (data.trades && Array.isArray(data.trades)) {
            this.applyFinnhubConfig(data);
            this.trades = data.trades.map(trade => {
                const updatedTrade = { ...trade };
                if (updatedTrade.tradeReasoning && !updatedTrade.notes) {
                    updatedTrade.notes = updatedTrade.tradeReasoning;
                    delete updatedTrade.tradeReasoning;
                }
                return this.enrichTradeData(updatedTrade);
            });
            this.saveToStorage();
            this.hasUnsavedChanges = false;
            this.updateUnsavedIndicator();
            this.updateDashboard();
            if (this.currentView === 'trades-list') {
                this.updateTradesList();
            }
        } else {
            throw new Error('Invalid data format');
        }
    }

    newDatabase() {
        if (this.hasUnsavedChanges) {
            if (!confirm('You have unsaved changes. Are you sure you want to create a new database?')) {
                return;
            }
        }

        this.trades = [];
        this.currentFileHandle = null;
        this.currentFileName = 'Unsaved Database';
        this.hasUnsavedChanges = false;
        this.updateFileNameDisplay();
        this.updateUnsavedIndicator();
        this.saveToStorage();
        this.updateDashboard();
        this.showNotification('New database created', 'success');
    }

    updateFileNameDisplay() {
        const nameEl = document.getElementById('current-file-name');
        if (!nameEl) return;

        nameEl.textContent = this.currentFileName;
        if (this.currentFileName === 'Unsaved Database') {
            nameEl.classList.add('is-unsaved');
        } else {
            nameEl.classList.remove('is-unsaved');
        }
    }

    updateUnsavedIndicator() {
        const indicator = document.getElementById('unsaved-indicator');
        if (this.hasUnsavedChanges) {
            indicator.classList.remove('hidden');
        } else {
            indicator.classList.add('hidden');
        }
    }

    showLoadingIndicator(text = 'Loading...') {
        const indicator = document.getElementById('loading-indicator');
        if (indicator) {
            indicator.textContent = text;
            indicator.classList.remove('hidden');
        }
    }

    hideLoadingIndicator() {
        const indicator = document.getElementById('loading-indicator');
        if (indicator) {
            indicator.classList.add('hidden');
        }
    }

    showNotification(message, type = 'info') {
        if (type === 'error') {
            alert(`Error: ${message}`);
        } else {
            console.log(`${type.toUpperCase()}: ${message}`);
        }
    }

    markUnsavedChanges() {
        this.hasUnsavedChanges = true;
        this.updateUnsavedIndicator();
    }

    saveToStorage() {
        try {
            localStorage.setItem('optionsTrackerProTrades', JSON.stringify(this.trades));
        } catch (e) {
            console.warn('Failed to save to localStorage:', e);
        }

        this.saveFinnhubConfigToStorage();
    }

    loadFromStorage() {
        try {
            const stored = localStorage.getItem('optionsTrackerProTrades');
            if (stored) {
                const parsedTrades = JSON.parse(stored);
                if (Array.isArray(parsedTrades)) {
                    this.trades = parsedTrades.map(trade => {
                        const normalized = { ...trade };
                        if (normalized.tradeReasoning && !normalized.notes) {
                            normalized.notes = normalized.tradeReasoning;
                        }
                        delete normalized.tradeReasoning;
                        return this.enrichTradeData(normalized);
                    });
                }
            }
        } catch (e) {
            console.warn('Failed to load from localStorage:', e);
        }
    }

    formatPercent(value, fallback = '—') {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
            return fallback;
        }
        return `${numeric.toFixed(2)}%`;
    }

    formatCycleDateRange(startIso, endIso, isOpen) {
        if (!startIso) {
            return '—';
        }

        const start = new Date(startIso);
        const end = endIso ? new Date(endIso) : null;
        const formatter = new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });

        const startText = isNaN(start.getTime()) ? '—' : formatter.format(start);
        let endText;
        if (end && !isNaN(end.getTime())) {
            endText = formatter.format(end);
        } else {
            endText = isOpen ? 'Present' : '—';
        }

        if (!endText) {
            return startText;
        }

        return `${startText} — ${endText}`;
    }

    formatCurrency(amount) {
        const value = Number(amount);
        if (!Number.isFinite(value)) {
            return '—';
        }

        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(value);
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            return '—';
        }

        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    }
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', function () {
    window.tracker = new OptionsTrackerPro();
});