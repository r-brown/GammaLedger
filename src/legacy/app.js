// Phase 1 refactor: constants and sample data have moved to dedicated modules.
// During the migration this legacy file re-exposes them as locals so that
// existing references inside class GammaLedger / LocalInsightsAgent /
// GeminiInsightsAgent continue to work unchanged.
import {
    APP_CONFIG,
    DEFAULT_GEMINI_MODEL,
    GEMINI_ALLOWED_MODELS,
    DEFAULT_GEMINI_TEMPERATURE,
    DEFAULT_GEMINI_ENDPOINT,
    GEMINI_STORAGE_KEY,
    GEMINI_SECRET_STORAGE_KEY,
    DISCLAIMER_STORAGE_KEY,
    AI_COACH_CONSENT_STORAGE_KEY,
    SIDEBAR_COLLAPSED_STORAGE_KEY,
    LOCAL_STORAGE_KEY,
    LEGACY_STORAGE_KEY,
    LEGACY_STORAGE_KEYS,
    SHARE_CARD_EXPORT_SIZE,
    SHARE_CARD_CHART_WIDTH_RATIO,
    SHARE_CARD_CHART_HEIGHT_RATIO,
    SHARE_CARD_CHART_MIN_HEIGHT,
    CUMULATIVE_PL_RANGES,
    DEFAULT_FEE_STORAGE_KEY,
    FINNHUB_RATE_LIMIT_STORAGE_KEY,
    GEMINI_MAX_TOKENS_STORAGE_KEY,
    DEFAULT_FINNHUB_RATE_LIMIT,
    DEFAULT_GEMINI_MAX_TOKENS,
    RUNTIME_TRADE_FIELDS,
    RUNTIME_LEG_FIELDS
} from '../core/config.js';
import { BUILTIN_SAMPLE_DATA } from '../core/sample-data.js';
import * as dates from '../utils/dates.js';
import * as dom from '../utils/dom.js';
import * as fmt from '../utils/formatting.js';
import * as cryptoUtil from '../utils/crypto.js';
import { safeLocalStorage } from '../core/storage.js';
import { parseCsvRow } from '../utils/import-csv.js';
import { LocalInsightsAgent } from '../ai/local-agent.js';
import { GeminiInsightsAgent } from '../ai/gemini-agent.js';
import * as legsModule from '../trades/legs.js';
import * as pnlModule from '../calculations/pnl.js';
import * as daysHeldModule from '../calculations/daysheld.js';
import * as positionsModule from '../trades/positions.js';
import * as wheelModule from '../trades/wheel.js';
import * as pmccModule from '../trades/pmcc.js';
import * as statsModule from '../calculations/stats.js';
import * as monteCarloModule from '../calculations/monte-carlo.js';
import * as riskModule from '../trades/risk.js';
import * as spreadsModule from '../trades/spreads.js';
import * as finnhubModule from '../integrations/finnhub.js';
import * as geminiIntegrationModule from '../integrations/gemini.js';
import * as mcpModule from '../integrations/mcp.js';
import * as defaultFeeModule from '../settings/default-fee.js';
import * as payoffSeriesModule from '../payoff/series.js';
import * as payoffPricingModule from '../payoff/pricing.js';
import * as payoffSummaryModule from '../payoff/summary.js';
import * as payoffRenderModule from '../payoff/render.js';
import * as importControlsModule from '../imports/controls.js';
import * as importLogModule from '../imports/log.js';
import * as importMergeModule from '../imports/merge.js';
import * as importPositionKeysModule from '../imports/position-keys.js';
import * as importRobinhoodModule from '../imports/robinhood.js';
import * as importOfxModule from '../imports/ofx.js';
import * as notificationsModule from '../ui/notifications.js';
import * as sidebarModule from '../ui/sidebar.js';
import * as disclaimerModule from '../ui/modals/disclaimer.js';
import * as aiCoachConsentModule from '../ui/modals/ai-coach-consent.js';
import * as filtersModule from '../ui/filters.js';
import * as dashboardChartsModule from '../ui/charts/dashboard-charts.js';
import * as cumulativePLModule from '../ui/charts/cumulative-pl.js';
import * as highlightsModule from '../ui/tables/highlights.js';
import * as tradesTableModule from '../ui/tables/trades-table.js';
import * as creditPlaybookDataModule from '../ui/credit-playbook/data.js';
import * as creditPlaybookRenderModule from '../ui/credit-playbook/render.js';
import * as shareCardModule from '../ui/share-card.js';
import * as aiChatModule from '../ai/chat.js';
import * as dashboardModule from '../ui/dashboard.js';
import * as persistModule from '../database/persist.js';
import * as legFormModule from '../trades/leg-form.js';
import * as activePositionsModule from '../ui/tables/active-positions.js';
import * as recentTradesModule from '../ui/tables/recent-trades.js';
import * as assignedPositionsModule from '../ui/tables/assigned-positions.js';
import * as creditPlaybookModule from '../ui/credit-playbook/index.js';
import * as viewsModule from '../ui/views.js';


class GammaLedger {
    constructor() {
        this.trades = [];
        this.currentView = 'dashboard';
        this.sortDirection = {};
        this.charts = {};
        this.tradeDetailCharts = new Map();
        this.latestStats = null;
        this.currentFileHandle = null;
        this.currentFileName = 'Unsaved Database';
        this.hasUnsavedChanges = false;
        this.supportsFileSystemAccess = 'showOpenFilePicker' in window;
        this.currentEditingId = null;
        this.importControlsInitialized = false;
        this.importLog = [];
        this.importSummary = null;
        this.importMergeSelection = new Set();
        this.tradeMergeSelection = new Set();
        this.tradesMergeInitialized = false;
        this.tradesMergePanelOpen = false;
        this.currentFilteredTrades = [];
        this.currentSort = {
            key: null,
            direction: 'asc'
        };
        this.cumulativePLRange = 'ALL';

        this.disclaimerBanner = {
            element: null,
            body: null,
            agreeButton: null,
            agreeHandler: null,
            hideTimeoutId: null
        };
        this.disclaimerFadeMs = 280;

        this.aiCoachConsent = {
            element: null,
            panel: null,
            agreeButton: null,
            agreeHandler: null,
            dismissButtons: [],
            dismissHandlers: [],
            escapeHandler: null,
            restoreFocus: null,
            pendingAction: null,
            isVisible: false
        };

        this.finnhub = {
            apiKey: '',
            encryptionKey: null,
            cache: new Map(),
            cacheTTL: 1000 * 60, // 1 minute
            outstandingRequests: new Map(),
            rateLimitQueue: Promise.resolve(),
            maxRequestsPerMinute: this.loadFinnhubRateLimitFromStorage(),
            timestamps: [],
            statusTimeoutId: null,
            lastStatus: null,
            elements: {}
        };

        this.gemini = {
            apiKey: '',
            encryptionKey: null,
            model: DEFAULT_GEMINI_MODEL,
            maxOutputTokens: this.loadGeminiMaxTokensFromStorage(),
            statusTimeoutId: null,
            lastStatus: null,
            pendingStatus: null,
            elements: {}
        };

        this.aiAgent = new GeminiInsightsAgent(this);
        this.aiChatMessages = [];
        this.aiChatSessionId = Date.now();
        this.aiChatPendingRequest = false;
        this.aiChatOpen = false;

        this.activeQuoteEntries = new Map();
        this.quoteRefreshIntervalId = null;
        this.autoRefreshIntervalMs = this.computeAutoRefreshInterval();
        this.quoteRefreshKeys = [];
        this.quoteRefreshCursor = 0;

        this.positionHighlightConfig = {
            expirationWarningDays: 20,
            expirationCriticalDays: 10
        };

        this.creditPlaybookStatus = 'active';
        this.creditPlaybookStrategy = 'all';
        this.creditPlaybookHorizon = 'all';
        this.creditPlaybookSymbol = '';
        this.creditPlaybookSort = {
            key: 'entryDate',
            direction: 'desc'
        };
        this.creditPlaybookEntries = [];
        this.creditPlaybookNeedsRefresh = true;
        this.creditPlaybookInitialized = false;
        this.creditPlaybookStrategyOptions = [
            'Bear Call Ladder',
            'Bear Call Spread',
            'Bear Put Ladder',
            'Bear Put Spread',
            'Box Spread',
            'Bull Call Ladder',
            'Bull Call Spread',
            'Bull Put Ladder',
            'Bull Put Spread',
            'Calendar Call Spread',
            'Calendar Put Spread',
            'Calendar Straddle',
            'Calendar Strangle',
            'Call Broken Wing',
            'Call Ratio Backspread',
            'Call Ratio Spread',
            'Cash-Secured Put',
            'Collar',
            'Covered Call',
            'Covered Put',
            'Covered Short Straddle',
            'Covered Short Strangle',
            'Diagonal Call Spread',
            'Diagonal Put Spread',
            'Double Diagonal',
            'Guts',
            'Inverse Call Broken Wing',
            'Inverse Iron Butterfly',
            'Inverse Iron Condor',
            'Inverse Put Broken Wing',
            'Iron Albatross',
            'Iron Butterfly',
            'Iron Condor',
            'Jade Lizard',
            'Long Call',
            'Long Call Butterfly',
            'Long Call Condor',
            'Long Put',
            'Long Put Butterfly',
            'Long Put Condor',
            'Long Straddle',
            'Long Strangle',
            "Poor Man's Covered Call",
            'Protective Put',
            'Put Broken Wing',
            'Put Ratio Backspread',
            'Put Ratio Spread',
            'Reverse Jade Lizard',
            'Short Call',
            'Short Call Butterfly',
            'Short Call Condor',
            'Short Guts',
            'Short Put',
            'Short Put Butterfly',
            'Short Put Condor',
            'Short Straddle',
            'Short Strangle',
            'Strap',
            'Strip',
            'Synthetic Long Stock',
            'Synthetic Short Stock',
            'Synthetic Put',
            'Wheel'
        ];

        this.assignedPositionsStatusFilter = 'open';

        this.defaultFeePerContract = null; // User's default fee setting

        this.sidebarState = {
            container: null,
            sidebar: null,
            toggleButton: null,
            mediaQuery: null,
            mainContent: null,
            collapsed: false,
            preferredCollapsed: false
        };

        this.shareCard = {
            root: null,
            card: null,
            button: null,
            chartCanvas: null,
            chartTitle: null,
            rangeLabel: null,
            chart: null,
            metrics: {},
            timestamp: null,
            exportSize: SHARE_CARD_EXPORT_SIZE
        };

        // currentDate is now a live getter — see get currentDate() below

        this.init();
    }

    // Always returns the actual current date so DTE and "today" references stay fresh
    get currentDate() {
        return new Date();
    }

    // Safe localStorage operations with error handling
    safeLocalStorage = safeLocalStorage;

    // Input validation utilities
    validateNumber(value, options = {}) {
        const { min = -Infinity, max = Infinity, allowZero = true, defaultValue = 0 } = options;
        const num = Number(value);
        
        if (!Number.isFinite(num)) {
            return defaultValue;
        }
        
        if (!allowZero && num === 0) {
            return defaultValue;
        }
        
        if (num < min || num > max) {
            return defaultValue;
        }
        
        return num;
    }

    validateDate(dateString) {
        if (!dateString || typeof dateString !== 'string') {
            return null;
        }
        
        const date = new Date(dateString);
        return isNaN(date.getTime()) ? null : dateString;
    }

    sanitizeString(value, maxLength = 1000) { return fmt.sanitizeString(value, maxLength); }

    // Safe chart cleanup helper
    destroyChart(chart) {
        if (chart && typeof chart.destroy === 'function') {
            try {
                chart.destroy();
            } catch (error) {
                console.warn('Failed to destroy chart:', error);
            }
        }
    }

    // Cleanup all resources
    cleanup() {
        // Clear all timeouts
        if (this.disclaimerBanner?.hideTimeoutId) {
            clearTimeout(this.disclaimerBanner.hideTimeoutId);
        }
        if (this.gemini?.statusTimeoutId) {
            clearTimeout(this.gemini.statusTimeoutId);
        }
        if (this.finnhub?.statusTimeoutId) {
            clearTimeout(this.finnhub.statusTimeoutId);
        }
        
        // Clear intervals
        if (this.quoteRefreshIntervalId) {
            clearInterval(this.quoteRefreshIntervalId);
            this.quoteRefreshIntervalId = null;
        }
        
        // Destroy all charts
        Object.keys(this.charts).forEach(key => {
            this.destroyChart(this.charts[key]);
        });
        this.charts = {};
        
        // Clear trade detail charts
        if (this.tradeDetailCharts) {
            this.tradeDetailCharts.forEach(chart => this.destroyChart(chart));
            this.tradeDetailCharts.clear();
        }
        
        // Destroy share card chart
        if (this.shareCard?.chart) {
            this.destroyChart(this.shareCard.chart);
            this.shareCard.chart = null;
        }
    }

    async init() {
        try {
            await this.loadFromStorage();
            await this.loadFinnhubConfigFromStorage();
            await this.loadGeminiConfigFromStorage();
            if (!this.trades || this.trades.length === 0) {
                await this.loadDefaultDatabase();
            } else {
                this.updateFileNameDisplay();
                this.updateDashboard();
            }
            this.bindEvents();
            this.initializeGeminiControls();
            this.initializeAIChat();
            this.initializeFinnhubControls();
            this.initializeDefaultFeeControls();
            this.initializeDisclaimerBanner();
            this.initializeAICoachConsent();
            this.initializeSidebarToggle();
            this.initializeShareCard();
            this.updateFileNameDisplay();
            this.checkBrowserCompatibility();

            // Wait for DOM to be ready before updating dashboard
            setTimeout(() => {
                this.updateDashboard();
                this.showView('dashboard');
            }, 100);
        } catch (error) {
            console.error('Failed to initialize application:', error);
            // Show user-friendly error message
            const notice = document.getElementById('compatibility-notice');
            if (notice) {
                const content = notice.querySelector('.notice-content');
                if (content) {
                    // Use DOM methods instead of innerHTML
                    content.textContent = '';
                    const heading = document.createElement('h4');
                    heading.textContent = '⚠️ Initialization Error';
                    const paragraph = document.createElement('p');
                    paragraph.textContent = 'Failed to load the application. Please refresh the page or contact support if the issue persists.';
                    content.appendChild(heading);
                    content.appendChild(paragraph);
                }
                notice.classList.remove('hidden');
            }
        }
    }

    computeAutoRefreshInterval() {
        // Refresh interval derived directly from user's rate limit setting
        // Interval = 60 seconds / requests per minute (respects user's configured rate)
        const limit = Number(this.finnhub?.maxRequestsPerMinute) || DEFAULT_FINNHUB_RATE_LIMIT;
        return Math.ceil(60_000 / Math.max(limit, 1));
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
            if (!BUILTIN_SAMPLE_DATA || !Array.isArray(BUILTIN_SAMPLE_DATA.trades)) {
                throw new Error('Built-in sample data unavailable.');
            }

            const data = JSON.parse(JSON.stringify(BUILTIN_SAMPLE_DATA));
            this.processLoadedData(data, {
                fileName: 'Sample Database (Built-in)',
                source: 'default-sample'
            });
            this.currentFileHandle = null;
        } catch (error) {
            console.warn('Default database not loaded:', error);
            this.trades = [];
            this.currentFileName = 'Unsaved Database';
            this.currentFileHandle = null;
            this.hasUnsavedChanges = false;
            this.updateUnsavedIndicator();
            this.saveToStorage({ fileName: this.currentFileName });
            this.updateFileNameDisplay();
            this.updateDashboard();
        }
    }

    // --- Leg helpers (delegates to src/trades/legs.js) --------------------

    normalizeLegOrderType(orderType) { return legsModule.normalizeLegOrderType(orderType); }
    mapOrderTypeToActionSide(orderType) { return legsModule.mapOrderTypeToActionSide.call(this, orderType); }
    getLegOrderDescriptor(leg = {}) { return legsModule.getLegOrderDescriptor.call(this, leg); }
    getLegAction(leg = {}) { return legsModule.getLegAction.call(this, leg); }
    getLegSide(leg = {}) { return legsModule.getLegSide.call(this, leg); }
    deriveOrderTypeFromActionSide(action, side) { return legsModule.deriveOrderTypeFromActionSide.call(this, action, side); }
    normalizeLegAction(action) { return legsModule.normalizeLegAction(action); }
    normalizeLegSide(side) { return legsModule.normalizeLegSide(side); }
    normalizeLegType(type) { return legsModule.normalizeLegType(type); }
    getLegMultiplier(leg) { return legsModule.getLegMultiplier.call(this, leg); }
    normalizeLeg(leg, index = 0) { return legsModule.normalizeLeg.call(this, leg, index); }
    calculateLegCashFlow(leg) { return legsModule.calculateLegCashFlow.call(this, leg); }

    summarizeLegs(legs = []) { return legsModule.summarizeLegs.call(this, legs); }
    hasNetOpenOptionLegs(trade = {}) { return legsModule.hasNetOpenOptionLegs.call(this, trade); }


    hasNetOpenOptionLegs(trade = {}) {
        const legs = Array.isArray(trade?.legs) ? trade.legs : [];
        if (!legs.length) {
            return false;
        }

        const summary = this.summarizeLegs(legs);
        const normalizedLegs = Array.isArray(summary?.legs) ? summary.legs : [];
        if (!normalizedLegs.length) {
            return false;
        }

        const optionNet = new Map();

        normalizedLegs.forEach((leg) => {
            if (!leg || !['CALL', 'PUT'].includes((leg.type || '').toUpperCase())) {
                return;
            }

            const quantity = Math.abs(Number(leg.quantity) || 0);
            if (!quantity) {
                return;
            }

            const key = `${leg.type}|${leg.strike ?? ''}|${leg.expirationDate ?? ''}`;
            const side = this.getLegSide(leg);

            if (side === 'OPEN') {
                optionNet.set(key, (optionNet.get(key) || 0) + quantity);
            } else if (side === 'CLOSE') {
                optionNet.set(key, (optionNet.get(key) || 0) - quantity);
            }
        });

        if (!optionNet.size) {
            return false;
        }

        return Array.from(optionNet.values()).some(count => count > 0);
    }

    /**
     * Check whether a trade has any SHORT option legs that are both net-open AND not yet expired.
     * Only counts STO positions (short options) minus their matching BTC closes.
     * Long positions (BTO/LEAP) are excluded since they don't represent active coverage.
     * Used to hide "uncovered" Wheel/PMCC trades from Active Positions when all
     * short options have been closed, expired, or assigned.
     */
    hasNonExpiredOpenShortOptions(trade = {}) { return legsModule.hasNonExpiredOpenShortOptions.call(this, trade); }

    getNetOpenOptionContracts(legs = []) { return legsModule.getNetOpenOptionContracts.call(this, legs); }

    /**
     * Calculate net open short call contracts for a trade.
     * Returns the number of short call contracts currently open (sold but not yet closed/expired).
     * Used for Wheel/PMCC coverage tracking.
     */
    getNetOpenShortCalls(legs = []) { return legsModule.getNetOpenShortCalls.call(this, legs); }

    buildRiskFormulaContext(trade = {}, details = null) { return riskModule.buildRiskFormulaContext.call(this, trade, details); }

    computeDefaultMaxRisk(context) { return riskModule.computeDefaultMaxRisk.call(this, context); }

    getStrategyRiskHandlers() { return riskModule.getStrategyRiskHandlers.call(this); }

    evaluateStrategyMaxRisk(strategyName, context) { return riskModule.evaluateStrategyMaxRisk.call(this, strategyName, context); }

    computeMaxRiskUsingFormula(trade = {}, summary = null) { return riskModule.computeMaxRiskUsingFormula.call(this, trade, summary); }

    formatStrikeValue(value) { return riskModule.formatStrikeValue.call(this, value); }

    derivePrimaryStrike(summary) { return riskModule.derivePrimaryStrike.call(this, summary); }

    getActiveStrikeForDisplay(summary) { return riskModule.getActiveStrikeForDisplay.call(this, summary); }

    buildStrikeDisplay(trade, summary = null) { return riskModule.buildStrikeDisplay.call(this, trade, summary); }

    assessRisk(trade, summary) { return riskModule.assessRisk.call(this, trade, summary); }

    // --- Formula Tooltip Data and Helpers -----------------------------------

    getFormulaData() { return riskModule.getFormulaData.call(this); }

    buildFormulaTooltipContent(trade, metricType) { return riskModule.buildFormulaTooltipContent.call(this, trade, metricType); }

    buildMaxRiskTooltip(strategyName, strategyInfo, context, trade) { return riskModule.buildMaxRiskTooltip.call(this, strategyName, strategyInfo, context, trade); }

    buildPLTooltip(trade, details, context) { return riskModule.buildPLTooltip.call(this, trade, details, context); }

    buildVariablesWithExplanations(context, formulaData, trade) { return riskModule.buildVariablesWithExplanations.call(this, context, formulaData, trade); }

    buildPLVariables(trade, details) { return riskModule.buildPLVariables.call(this, trade, details); }

    escapeHtml(text) { return dom.escapeHtml(text); }

    createFormulaIcon(trade, metricType) { return riskModule.createFormulaIcon.call(this, trade, metricType); }

    positionFormulaTooltip(wrapper, tooltip) { return riskModule.positionFormulaTooltip.call(this, wrapper, tooltip); }

    // --- Leg form UI helpers ---------------------------------------------

    getLegsContainer() { return legFormModule.getLegsContainer.call(this); }

    generateLegId(index = 0) { return legFormModule.generateLegId.call(this, index); }

    clearLegFormRows() { return legFormModule.clearLegFormRows.call(this); }

    getSelectedUnderlyingType(options = {}) { return legFormModule.getSelectedUnderlyingType.call(this, options); }

    getDefaultMultiplierForLegType(legType, underlyingType = 'Stock') { return legFormModule.getDefaultMultiplierForLegType.call(this, legType, underlyingType); }

    syncLegMultiplierVisibility(row, options = {}) { return legFormModule.syncLegMultiplierVisibility.call(this, row, options); }

    /**
     * Shows/hides leg form fields based on leg type.
     * For CASH (cash settlement) legs: hides strike and expiration (not applicable),
     * and updates the premium label to clarify it is the settlement amount.
     */
    syncLegTypeFieldVisibility(row) { return legFormModule.syncLegTypeFieldVisibility.call(this, row); }

    applyUnderlyingTypeToLegMultipliers(options = {}) { return legFormModule.applyUnderlyingTypeToLegMultipliers.call(this, options); }

    renderLegForms(legs = []) { return legFormModule.renderLegForms.call(this, legs); }

    addLegFormRow(leg = null) { return legFormModule.addLegFormRow.call(this, leg); }

    /**
     * Auto-fills the underlying price input with the current ticker price.
     * Fetches the price asynchronously from Finnhub if API key is configured.
     * Only fetches when in add-trade view (add/edit mode) to avoid unnecessary API calls.
     * @param {HTMLInputElement} inputElement - The underlying price input element
     */
    async autoFillUnderlyingPrice(inputElement) {
        if (!inputElement) {
            return;
        }

        // Only fetch prices when in add-trade view (add/edit mode)
        if (this.currentView !== 'add-trade') {
            return;
        }

        // Get the current ticker from the trade form
        const tickerInput = document.getElementById('ticker');
        const ticker = (tickerInput?.value || '').trim().toUpperCase();

        if (!ticker) {
            return;
        }

        // Check if Finnhub API key is configured
        if (!this.finnhub?.apiKey) {
            return;
        }

        try {
            const quote = await this.getCurrentPrice(ticker);
            const price = Number(quote?.price);
            if (Number.isFinite(price) && price > 0) {
                // Only update if the input is still empty (user hasn't manually entered a value)
                if (!inputElement.value) {
                    inputElement.value = price;
                }
            }
        } catch (error) {
            // Silently fail - don't disrupt the user if price fetch fails
        }
    }

    /**
     * Auto-fills underlying price for all empty leg inputs using the current ticker price.
     * Fetches the price once and applies to empty fields only.
     * Only fetches when in add-trade view (add/edit mode) to avoid unnecessary API calls.
     */
    async autoFillUnderlyingPricesForLegs() {
        // Only fetch prices when in add-trade view (add/edit mode)
        if (this.currentView !== 'add-trade') {
            return;
        }

        const tickerInput = document.getElementById('ticker');
        const ticker = (tickerInput?.value || '').trim().toUpperCase();

        if (!ticker || !this.finnhub?.apiKey) {
            return;
        }

        const container = this.getLegsContainer();
        if (!container) {
            return;
        }

        const emptyInputs = Array.from(container.querySelectorAll('[data-leg-field="underlyingPrice"]'))
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
                        input.value = price;
                    }
                });
            }
        } catch (error) {
            // Silently fail - don't disrupt the user if price fetch fails
        }
    }

    removeLegFormRow(row) { return legFormModule.removeLegFormRow.call(this, row); }

    /**
     * Creates a closing leg from an existing leg row.
     * Pre-fills the closing action, quantity, dates, strike, and expiration.
     * User only needs to enter the premium and optionally adjust fees.
     */
    createClosingLegFromRow(sourceRow) { return legFormModule.createClosingLegFromRow.call(this, sourceRow); }

    updateLegRowNumbers() { return legFormModule.updateLegRowNumbers.call(this); }

    collectLegsFromForm() { return legFormModule.collectLegsFromForm.call(this); }

    // Trade normalization -------------------------------------------------

    getPrimaryLeg(trade = {}) { return legsModule.getPrimaryLeg.call(this, trade); }

    deriveTradeTypeFromLeg(leg) { return legsModule.deriveTradeTypeFromLeg.call(this, leg); }

    deriveTradeDirectionFromLeg(leg) { return legsModule.deriveTradeDirectionFromLeg.call(this, leg); }

    getTradeType(trade) { return legsModule.getTradeType.call(this, trade); }

    inferTradeDirection(trade) { return legsModule.inferTradeDirection.call(this, trade); }

    normalizeStatus(status) { return positionsModule.normalizeStatus.call(this, status); }

    normalizeTradeStatusInput(status) { return positionsModule.normalizeTradeStatusInput.call(this, status); }

    isClosedStatus(status) { return positionsModule.isClosedStatus.call(this, status); }

    isAssignedStatus(status) { return positionsModule.isAssignedStatus.call(this, status); }

    isActiveStatus(status) { return positionsModule.isActiveStatus.call(this, status); }

    isAssignmentReason(reason) { return positionsModule.isAssignmentReason.call(this, reason); }

    /**
     * Returns true when the exit reason specifically describes a cash settlement
     * (as opposed to a physical-delivery assignment).
     */
    isCashSettlementReason(reason) { return positionsModule.isCashSettlementReason.call(this, reason); }

    /**
     * Returns true when the trade contains one or more CASH settlement legs.
     * Cash-settled options (VIX, SPX, NDX, etc.) record settlement proceeds
     * as a CASH-type leg rather than delivering/receiving shares.
     * Only closing-side legs (BTC / STC) are treated as settlement events.
     */
    isCashSettledTrade(trade = {}) { return positionsModule.isCashSettledTrade.call(this, trade); }

    getDisplayStatus(trade) { return positionsModule.getDisplayStatus.call(this, trade); }

    // DTE calculation using current date
    calculateDTE(expirationDate, trade) { return pnlModule.calculateDTE.call(this, expirationDate, trade); }

    // Realized P&L derived from leg cash flows
    calculatePL(trade) { return pnlModule.calculatePL.call(this, trade); }

    // Fixed ROI calculation
    calculateROI(trade) { return pnlModule.calculateROI.call(this, trade); }

    // Fixed days held calculation
    calculateDaysHeld(trade) { return pnlModule.calculateDaysHeld.call(this, trade); }

    // Enhanced Max Risk calculation
    calculateMaxRisk(trade) { return pnlModule.calculateMaxRisk.call(this, trade); }

    getCapitalAtRisk(trade) { return pnlModule.getCapitalAtRisk.call(this, trade); }

    // VERIFIED: Annualized ROI calculation
    calculateAnnualizedROI(trade) { return pnlModule.calculateAnnualizedROI.call(this, trade); }

    // Weekly ROI calculation: (premium_received / collateral_used) × (7 / days_held)
    calculateWeeklyROI(trade) { return pnlModule.calculateWeeklyROI.call(this, trade); }

    // Monthly ROI calculation: (premium_received / collateral_used) × (30 / days_held)
    calculateMonthlyROI(trade) { return pnlModule.calculateMonthlyROI.call(this, trade); }

    buildLegLifecycleKey(leg = {}) { return legsModule.buildLegLifecycleKey.call(this, leg); }

    getNormalizedLegOrderType(leg = {}) { return legsModule.getNormalizedLegOrderType.call(this, leg); }

    determineTradeLifecycleStatus(trade = {}, summary = {}) { return legsModule.determineTradeLifecycleStatus.call(this, trade, summary); }

    enrichTradeData(trade) { return legsModule.enrichTradeData.call(this, trade); }

    // Fixed date format conversion for form fields
    formatDateForInput(dateString) { return dates.formatDateForInput(dateString); }

    calculateDaysBetween(date1, date2) { return dates.calculateDaysBetween(date1, date2); }

    // Fixed ticker link generation using investing.com search
    generateTickerLink(ticker) { return dom.generateTickerLink(ticker); }

    createTickerElement(ticker, className = 'ticker-link', options = {}) { return dom.createTickerElement(ticker, className, options); }

    applyResponsiveLabels(row, labels = []) { return dom.applyResponsiveLabels(row, labels); }

    normalizeUnderlyingType(type, options = {}) { return positionsModule.normalizeUnderlyingType.call(this, type, options); }
    isWheelPut(trade = {}) { return positionsModule.isWheelPut.call(this, trade); }

    isWheelTrade(trade = {}) { return positionsModule.isWheelTrade.call(this, trade); }

    isWheelOrPmccTrade(trade = {}) { return positionsModule.isWheelOrPmccTrade.call(this, trade); }

    isCoveredCall(trade = {}) { return positionsModule.isCoveredCall.call(this, trade); }

    isPmccBaseLeg(trade = {}) { return positionsModule.isPmccBaseLeg.call(this, trade); }

    isPmccShortCall(trade = {}) { return positionsModule.isPmccShortCall.call(this, trade); }

    isPmccTrade(trade = {}) { return positionsModule.isPmccTrade.call(this, trade); }

    isAssignmentTrade(trade = {}) { return positionsModule.isAssignmentTrade.call(this, trade); }

    /**
     * Total open stock shares currently held in a trade (BUY-OPEN minus SELL legs).
     * Used to size wheel/PMCC coverage and cost-basis math.
     */
    getTradeOpenStockShares(trade = {}) { return positionsModule.getTradeOpenStockShares.call(this, trade); }

    /**
     * Net-open long call contracts (BTO open minus STC close). Used as the PMCC
     * equivalent of "held shares" for coverage math: each long call covers up to
     * one short call.
     */
    getNetOpenLongCallContracts(trade = {}) { return positionsModule.getNetOpenLongCallContracts.call(this, trade); }

    /**
     * Coverage status for a wheel/PMCC position.
     * Returns 'covered' | 'partial' | 'uncovered' | 'n/a'.
     * - Wheel: base = open stock shares; covered when active short calls × 100 ≥ shares.
     * - PMCC: base = net-open long call contracts × 100; covered when active short
     *         calls match the long-call count.
     */
    getTradeWheelCoverage(trade = {}) { return positionsModule.getTradeWheelCoverage.call(this, trade); }

    /**
     * True when a wheel/PMCC trade is assigned (shares held) but coverage is not full.
     * These positions appear only in the Wheel/PMCC tracker, not in Active Trades.
     */
    isAwaitingCoverage(trade = {}) { return positionsModule.isAwaitingCoverage.call(this, trade); }

    /**
     * Lightweight per-trade cost-basis math for wheel/PMCC awaiting-coverage positions.
     * Returns shares, assignmentCostBasis, and effectiveCostBasis (cost basis after
     * subtracting net option premium collected). Used to compute unrealized P&L.
     */
    computeWheelEffectiveCostBasis(trade = {}) { return positionsModule.computeWheelEffectiveCostBasis.call(this, trade); }

    calculateOptionPremium(trade = {}) { return positionsModule.calculateOptionPremium.call(this, trade); }

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

        this.setupImportControls();
        this.setupTradesMergeControls();

        // Add trade form
        const addTradeForm = document.getElementById('add-trade-form');
        if (addTradeForm) {
            addTradeForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleTradeSubmit();
            });
        }

        const addLegButton = document.getElementById('add-leg-button');
        if (addLegButton) {
            addLegButton.addEventListener('click', () => this.addLegFormRow());
        }

        const cancelTradeButton = document.getElementById('cancel-trade');
        if (cancelTradeButton) {
            cancelTradeButton.addEventListener('click', (event) => {
                event.preventDefault();
                this.resetAddTradeForm();
                this.showView('trades-list');
            });
        }

        // Ticker preview
        const tickerInput = document.getElementById('ticker');
        if (tickerInput) {
            tickerInput.addEventListener('input', (e) => {
                this.updateTickerPreview(e.target.value);
            });

            tickerInput.addEventListener('change', () => {
                this.autoFillUnderlyingPricesForLegs();
            });

            tickerInput.addEventListener('blur', () => {
                this.autoFillUnderlyingPricesForLegs();
            });
        }

        const underlyingTypeSelect = document.getElementById('underlyingType');
        if (underlyingTypeSelect) {
            underlyingTypeSelect.addEventListener('change', () => {
                this.applyUnderlyingTypeToLegMultipliers({ force: false });
            });
        }

        // Trades list filters
        ['filter-strategy', 'filter-status'].forEach(filterId => {
            const filterElement = document.getElementById(filterId);
            if (filterElement) {
                filterElement.addEventListener('change', () => {
                    this.normalizeFilterSelect(filterElement);
                    this.filterTrades();
                });
                this.normalizeFilterSelect(filterElement);
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
                if (!sortBy) {
                    return;
                }

                const context = header.getAttribute('data-sort-context') || 'trades';
                if (context === 'credit-playbook') {
                    this.sortCreditPlaybook(sortBy);
                } else {
                    this.sortTrades(sortBy);
                }
            });
        });

        const aiChatToggle = document.getElementById('ai-chat-toggle');
        if (aiChatToggle) {
            aiChatToggle.addEventListener('click', () => this.toggleAIChat());
        }

        const aiChatClose = document.getElementById('ai-chat-close');
        if (aiChatClose) {
            aiChatClose.addEventListener('click', () => this.toggleAIChat(false));
        }

        const aiChatForm = document.getElementById('ai-chat-form');
        if (aiChatForm) {
            aiChatForm.addEventListener('submit', (event) => {
                event.preventDefault();
                this.handleAIChatSubmit();
            });
        }

        document.querySelectorAll('.ai-chat__quick-btn').forEach(button => {
            button.addEventListener('click', () => {
                const prompt = button.getAttribute('data-ai-prompt');
                const promptType = button.getAttribute('data-ai-prompt-type') || null;
                if (prompt) {
                    this.handleAIQuickPrompt(prompt, { promptType });
                }
            });
        });

        const aiChatRoot = document.getElementById('ai-chat');
        if (aiChatRoot) {
            aiChatRoot.addEventListener('click', (event) => {
                const target = event.target instanceof Element ? event.target : null;
                const anchor = target?.closest('a[href="#settings"]');
                if (!anchor) {
                    return;
                }

                event.preventDefault();
                this.showView('settings');
                this.toggleAIChat(false);

                const keyField = document.getElementById('gemini-api-key');
                if (keyField) {
                    setTimeout(() => keyField.focus(), 120);
                }
            });
        }

        // Ensure the trade form starts with at least one leg row
        this.renderLegForms([]);

        this.setupAIChatResizeHandle();

        // Set default entry date to today
        this.setTodayDate();

        // Responsive enhancements for trades filters
        this.setupResponsiveFilters();
        this.initializeCumulativePLControls();
        this.initializeAssignedPositionsStatusFilter();
        this.initializeCreditPlaybookControls();
    }

    setupResponsiveFilters() { return filtersModule.setupResponsiveFilters.call(this); }

    initializeCumulativePLControls() { return cumulativePLModule.initializeCumulativePLControls.call(this); }

    setCumulativePLRange(range) { return cumulativePLModule.setCumulativePLRange.call(this, range); }

    syncCumulativePLControls() { return cumulativePLModule.syncCumulativePLControls.call(this); }

    initializeAssignedPositionsStatusFilter() { return dashboardModule.initializeAssignedPositionsStatusFilter.call(this); }

    setAssignedPositionsStatusFilter(status) { return dashboardModule.setAssignedPositionsStatusFilter.call(this, status); }

    syncAssignedPositionsStatusFilter() { return dashboardModule.syncAssignedPositionsStatusFilter.call(this); }

    setupAIChatResizeHandle() { return aiChatModule.setupAIChatResizeHandle.call(this); }

    initializeAIChat() { return aiChatModule.initializeAIChat.call(this); }

    toggleAIChat(forceOpen = null) { return aiChatModule.toggleAIChat.call(this, forceOpen); }

    async handleAIChatSubmit() {
        if (this.aiChatPendingRequest) {
            return;
        }

        const input = document.getElementById('ai-chat-input');
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

    async handleAIQuickPrompt(prompt, options = {}) {
        if (this.aiChatPendingRequest || !prompt) {
            return;
        }

        if (!this.hasAICoachConsent()) {
            this.promptAICoachConsent(() => this.handleAIQuickPrompt(prompt, options));
            return;
        }

        this.toggleAIChat(true);

        const input = document.getElementById('ai-chat-input');
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

    appendAIChatMessage(sender, text, options = {}) { return aiChatModule.appendAIChatMessage.call(this, sender, text, options); }

    renderAIChatMessages() { return aiChatModule.renderAIChatMessages.call(this); }

    renderMarkdownToHTML(markdown = '') { return dom.renderMarkdownToHTML.call(this, markdown); }

    renderMarkdownTextSegment(text = '') { return dom.renderMarkdownTextSegment.call(this, text); }

    formatMarkdownInline(text = '') { return dom.formatMarkdownInline.call(this, text); }

    applyBasicInlineFormatting(text = '') { return dom.applyBasicInlineFormatting.call(this, text); }

    sanitizeMarkdownUrl(url = '') { return dom.sanitizeMarkdownUrl.call(this, url); }

    updateTickerPreview(ticker) { return viewsModule.updateTickerPreview.call(this, ticker); }

    setTodayDate() { return viewsModule.setTodayDate.call(this); }

    showView(viewName) { return viewsModule.showView.call(this, viewName); }

    resetAddTradeForm() { return viewsModule.resetAddTradeForm.call(this); }

    parseDecimal(value, defaultValue = null, options = {}) { return fmt.parseDecimal(value, defaultValue, options); }

    parseDateValue(value) { return dates.parseDateValue(value); }

    parseInteger(value, defaultValue = null, options = {}) { return fmt.parseInteger(value, defaultValue, options); }

    parseExitPrice(exitPriceValue) { return fmt.parseExitPrice(exitPriceValue); }

    // FIXED: Handle trade submission for both new and edited trades
    handleTradeSubmit() { return viewsModule.handleTradeSubmit.call(this); }

    updateTrade(tradeData) { return viewsModule.updateTrade.call(this, tradeData); }

    updateDashboard() { return dashboardModule.updateDashboard.call(this); }

    calculateAdvancedStats() { return statsModule.calculateAdvancedStats.call(this); }

    calculateAssignmentStats(assignedTrades) { return statsModule.calculateAssignmentStats.call(this, assignedTrades); }

    calculateTickerPerformance(trades = []) { return statsModule.calculateTickerPerformance.call(this, trades); }


    updateActivePositionsTable(openTrades) { return activePositionsModule.updateActivePositionsTable.call(this, openTrades); }

    updateRecentTradesTable(closedTrades, activeCount) { return recentTradesModule.updateRecentTradesTable.call(this, closedTrades, activeCount); }

    updateAssignedPositionsTable() { return assignedPositionsModule.updateAssignedPositionsTable.call(this); }

    refreshAssignedPositionsQuotes(options = {}) { return finnhubModule.refreshAssignedPositionsQuotes.call(this, options); }

    updateAssignedPositionMetrics(entry, quote) { return assignedPositionsModule.updateAssignedPositionMetrics.call(this, entry, quote); }

    initializeCreditPlaybookControls() { return creditPlaybookModule.initializeCreditPlaybookControls.call(this); }

    syncCreditPlaybookStatusControls() { return creditPlaybookModule.syncCreditPlaybookStatusControls.call(this); }

    setCreditPlaybookStatus(status) { return creditPlaybookModule.setCreditPlaybookStatus.call(this, status); }

    normalizeCreditPlaybookStrategyValue(strategy) { return creditPlaybookModule.normalizeCreditPlaybookStrategyValue.call(this, strategy); }

    setCreditPlaybookStrategy(strategy) { return creditPlaybookModule.setCreditPlaybookStrategy.call(this, strategy); }

    setCreditPlaybookHorizon(horizon) { return creditPlaybookModule.setCreditPlaybookHorizon.call(this, horizon); }

    setCreditPlaybookSymbol(symbol) { return creditPlaybookModule.setCreditPlaybookSymbol.call(this, symbol); }

    updateCreditPlaybookView() { return creditPlaybookModule.updateCreditPlaybookView.call(this); }

    getCreditPlaybookEntries() { return creditPlaybookModule.getCreditPlaybookEntries.call(this); }

    isCreditStrategyTrade(trade = {}) { return creditPlaybookRenderModule.isCreditStrategyTrade.call(this, trade); }

    mapCreditTradeToEntry(trade = {}) { return creditPlaybookRenderModule.mapCreditTradeToEntry.call(this, trade); }

    resolveCreditPlaybookOpenedAt(trade = {}, summary = {}) { return creditPlaybookRenderModule.resolveCreditPlaybookOpenedAt.call(this, trade, summary); }

    deriveCreditPlaybookPrice(trade = {}) { return creditPlaybookRenderModule.deriveCreditPlaybookPrice.call(this, trade); }

    filterCreditPlaybookEntries(entries = []) { return creditPlaybookRenderModule.filterCreditPlaybookEntries.call(this, entries); }

    filterCreditPlaybookLegPairs(legPairs = []) { return creditPlaybookRenderModule.filterCreditPlaybookLegPairs.call(this, legPairs); }

    applyCreditPlaybookSort(entries = []) { return creditPlaybookRenderModule.applyCreditPlaybookSort.call(this, entries); }

    applyCreditPlaybookSortToLegPairs(legPairs = []) { return creditPlaybookRenderModule.applyCreditPlaybookSortToLegPairs.call(this, legPairs); }

    applyCreditPlaybookSortIndicators() { return creditPlaybookRenderModule.applyCreditPlaybookSortIndicators.call(this); }

    renderCreditPlaybookMetrics(legPairs = []) { return creditPlaybookRenderModule.renderCreditPlaybookMetrics.call(this, legPairs); }

    renderCreditPlaybookTableFromLegPairs(legPairs = []) { return creditPlaybookRenderModule.renderCreditPlaybookTableFromLegPairs.call(this, legPairs); }

    extractCreditPlaybookLegPairs(entries = []) { return creditPlaybookDataModule.extractCreditPlaybookLegPairs.call(this, entries); }

    extractSpreadPair(trade, legs, now, pairs) { return spreadsModule.extractSpreadPair.call(this, trade, legs, now, pairs); }

    extractRolledSpread(trade, allLegs, now, pairs) { return spreadsModule.extractRolledSpread.call(this, trade, allLegs, now, pairs); }

    extractSingleSpread(trade, groupLegs, expiration, now, pairs) { return spreadsModule.extractSingleSpread.call(this, trade, groupLegs, expiration, now, pairs); }

    extractIndividualLegPairs(trade, legs, now, pairs) { return spreadsModule.extractIndividualLegPairs.call(this, trade, legs, now, pairs); }

    detectRollChain(sortedLegs) { return spreadsModule.detectRollChain.call(this, sortedLegs); }

    extractRolledPositionAcrossStrikes(trade, allLegs, type, now, pairs) { return spreadsModule.extractRolledPositionAcrossStrikes.call(this, trade, allLegs, type, now, pairs); }

    extractRolledPosition(trade, allLegs, strike, type, now, pairs) { return spreadsModule.extractRolledPosition.call(this, trade, allLegs, strike, type, now, pairs); }

    extractSingleLegPair(trade, groupLegs, strike, type, expiration, now, pairs) { return spreadsModule.extractSingleLegPair.call(this, trade, groupLegs, strike, type, expiration, now, pairs); }

    renderCreditPlaybookDetailCell(cell, entry) { return creditPlaybookRenderModule.renderCreditPlaybookDetailCell.call(this, cell, entry); }

    createCreditStage(label, variant = 'default') { return creditPlaybookRenderModule.createCreditStage.call(this, label, variant); }

    sortCreditPlaybook(sortKey) { return creditPlaybookDataModule.sortCreditPlaybook.call(this, sortKey); }

    updateAllCharts() { return dashboardChartsModule.updateAllCharts.call(this); }

    updatePerformanceGauges() { return dashboardChartsModule.updatePerformanceGauges.call(this); }

    renderRatioGauge(options) { return dashboardChartsModule.renderRatioGauge.call(this, options); }

    updateCommissionImpactChart() { return dashboardChartsModule.updateCommissionImpactChart.call(this); }

    renderTickerHeatmap() { return dashboardChartsModule.renderTickerHeatmap.call(this); }

    updateTimeInTradeChart() { return dashboardChartsModule.updateTimeInTradeChart.call(this); }

    updateMonteCarloChart() { return dashboardChartsModule.updateMonteCarloChart.call(this); }

    ensureMonteCarloBaseline(chart) { return dashboardChartsModule.ensureMonteCarloBaseline.call(this, chart); }

    generateMonteCarloProjection(dailyReturns = [], options = {}) { return dashboardChartsModule.generateMonteCarloProjection.call(this, dailyReturns, options); }

    initializeGeminiControls() { return geminiIntegrationModule.initializeGeminiControls.call(this); }

    initializeGeminiMaxTokensControls() { return geminiIntegrationModule.initializeGeminiMaxTokensControls.call(this); }

    updateGeminiTokensStatus(element, message = null, variant = 'neutral') { return geminiIntegrationModule.updateGeminiTokensStatus.call(this, element, message, variant); }

    syncGeminiControlsFromState(options = {}) { return geminiIntegrationModule.syncGeminiControlsFromState.call(this, options); }

    flushPendingGeminiStatus() { return geminiIntegrationModule.flushPendingGeminiStatus.call(this); }

    getGeminiModelLabel(model = '') { return geminiIntegrationModule.getGeminiModelLabel.call(this, model); }

    getGeminiChatDisplayName() { return geminiIntegrationModule.getGeminiChatDisplayName.call(this); }

    updateAIChatHeader() { return aiChatModule.updateAIChatHeader.call(this); }

    updateGeminiStatus(message, variant = 'neutral', autoClearMs = 0) { return geminiIntegrationModule.updateGeminiStatus.call(this, message, variant, autoClearMs); }

    setGeminiApiKey(value, options = {}) { return geminiIntegrationModule.setGeminiApiKey.call(this, value, options); }

    setGeminiModel(value) { return geminiIntegrationModule.setGeminiModel.call(this, value); }

    async loadGeminiConfigFromStorage() {
        let loadedApiKey = '';
        let pendingStatus = null;

        try {
            const raw = this.safeLocalStorage.getItem(GEMINI_STORAGE_KEY);
            if (!raw) {
                this.setGeminiApiKey('', { persist: false, updateUI: false });
                this.gemini.pendingStatus = null;
                this.syncGeminiControlsFromState({ preserveStatus: true });
                return false;
            }

            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') {
                this.setGeminiApiKey('', { persist: false, updateUI: false });
                this.gemini.pendingStatus = null;
                this.syncGeminiControlsFromState({ preserveStatus: true });
                return false;
            }

            if (typeof parsed.model === 'string' && parsed.model.trim()) {
                this.setGeminiModel(parsed.model.trim());
            }

            if (parsed.enc && parsed.payload) {
                const cryptoApi = this.getCrypto();
                if (!cryptoApi?.subtle) {
                    console.warn('Encrypted Gemini API key stored but Web Crypto unavailable.');
                    pendingStatus = {
                        message: 'Stored Gemini API key is encrypted, but this browser cannot decrypt it. Please re-enter it in Settings.',
                        variant: 'error',
                        autoClearMs: 9000
                    };
                } else {
                    try {
                        const key = await this.ensureGeminiEncryptionKey(cryptoApi);
                        if (!key) {
                            throw new Error('Encryption key unavailable');
                        }
                        const decrypted = await this.decryptString(parsed.payload, cryptoApi, key);
                        if (typeof decrypted === 'string') {
                            loadedApiKey = decrypted.trim();
                        }
                    } catch (error) {
                        console.warn('Failed to decrypt stored Gemini API key:', error);
                        pendingStatus = {
                            message: 'Failed to decrypt stored Gemini API key. Please re-enter it in Settings.',
                            variant: 'error',
                            autoClearMs: 9000
                        };
                    }
                }
            }

            if (!loadedApiKey && typeof parsed.apiKey === 'string') {
                loadedApiKey = parsed.apiKey.trim();
            }

            if (!loadedApiKey && typeof parsed.fallback === 'string' && parsed.fallback.trim()) {
                try {
                    loadedApiKey = atob(parsed.fallback.trim()).trim();
                } catch (decodeError) {
                    console.warn('Failed to decode Gemini API key fallback:', decodeError);
                }
            }

            if (loadedApiKey && pendingStatus) {
                pendingStatus = {
                    message: 'Gemini API key loaded from local backup. Save it again to refresh secure storage when possible.',
                    variant: 'neutral',
                    autoClearMs: 9000
                };
            }
        } catch (error) {
            console.warn('Failed to load Gemini configuration:', error);
            if (!pendingStatus) {
                pendingStatus = {
                    message: 'Failed to load Gemini configuration. Please verify your stored Gemini API key.',
                    variant: 'error',
                    autoClearMs: 9000
                };
            }
        }

        this.setGeminiApiKey(loadedApiKey, { persist: false, updateUI: false });
        this.gemini.pendingStatus = pendingStatus;
        this.syncGeminiControlsFromState({ preserveStatus: Boolean(pendingStatus) });
        return Boolean(loadedApiKey);
    }

    saveGeminiConfigToStorage(options = {}) { return geminiIntegrationModule.saveGeminiConfigToStorage.call(this, options); }

    removeGeminiEncryptionKey() { return geminiIntegrationModule.removeGeminiEncryptionKey.call(this); }

    async ensureGeminiEncryptionKey(cryptoApi = this.getCrypto()) {
        if (!cryptoApi?.subtle) {
            return null;
        }

        if (this.gemini.encryptionKey) {
            return this.gemini.encryptionKey;
        }

        let rawKeyB64 = this.safeLocalStorage.getItem(GEMINI_SECRET_STORAGE_KEY);
        if (!rawKeyB64) {
            const raw = cryptoApi.getRandomValues(new Uint8Array(32));
            rawKeyB64 = this.arrayBufferToBase64(raw.buffer);
            this.safeLocalStorage.setItem(GEMINI_SECRET_STORAGE_KEY, rawKeyB64);
        }

        const rawKey = new Uint8Array(this.base64ToArrayBuffer(rawKeyB64));
        const cryptoKey = await cryptoApi.subtle.importKey('raw', rawKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
        this.gemini.encryptionKey = cryptoKey;
        return cryptoKey;
    }

    async encryptAndStoreGeminiApiKey(cryptoApi = this.getCrypto()) {
        try {
            if (!cryptoApi?.subtle) {
                throw new Error('Web Crypto API unavailable');
            }

            const apiKey = this.gemini.apiKey || '';
            if (!apiKey) {
                this.saveGeminiConfigToStorage();
                return true;
            }

            const key = await this.ensureGeminiEncryptionKey(cryptoApi);
            if (!key) {
                throw new Error('Failed to prepare encryption key');
            }

            const payload = await this.encryptString(apiKey, cryptoApi, key);
            this.saveGeminiConfigToStorage({ encryptedPayload: payload });
            return true;
        } catch (error) {
            console.warn('Failed to encrypt Gemini API key:', error);
            return false;
        }
    }

    initializeFinnhubControls() { return finnhubModule.initializeFinnhubControls.call(this); }

    initializeFinnhubRateLimitControls() { return finnhubModule.initializeFinnhubRateLimitControls.call(this); }

    updateFinnhubRateStatus(element, message = null, variant = 'neutral') { return finnhubModule.updateFinnhubRateStatus.call(this, element, message, variant); }

    initializeDefaultFeeControls() { return defaultFeeModule.initializeDefaultFeeControls.call(this); }

    loadDefaultFeeFromStorage() { return defaultFeeModule.loadDefaultFeeFromStorage.call(this); }

    saveDefaultFeeToStorage() { return defaultFeeModule.saveDefaultFeeToStorage.call(this); }

    removeDefaultFeeFromStorage() { return defaultFeeModule.removeDefaultFeeFromStorage.call(this); }

    // Finnhub rate limit storage methods
    loadFinnhubRateLimitFromStorage() { return finnhubModule.loadFinnhubRateLimitFromStorage.call(this); }

    saveFinnhubRateLimitToStorage() { return finnhubModule.saveFinnhubRateLimitToStorage.call(this); }

    removeFinnhubRateLimitFromStorage() { return finnhubModule.removeFinnhubRateLimitFromStorage.call(this); }

    // Gemini max tokens storage methods
    loadGeminiMaxTokensFromStorage() { return geminiIntegrationModule.loadGeminiMaxTokensFromStorage.call(this); }

    saveGeminiMaxTokensToStorage() { return geminiIntegrationModule.saveGeminiMaxTokensToStorage.call(this); }

    removeGeminiMaxTokensFromStorage() { return geminiIntegrationModule.removeGeminiMaxTokensFromStorage.call(this); }

    updateDefaultFeeStatus(element, message = null, variant = 'neutral', duration = 4000) { return defaultFeeModule.updateDefaultFeeStatus.call(this, element, message, variant, duration); }

    /**
     * Get the default fee for a leg based on quantity.
     * Returns the total fee (defaultFeePerContract * quantity) or null if not set.
     */
    getDefaultFeeForQuantity(quantity = 1) { return defaultFeeModule.getDefaultFeeForQuantity.call(this, quantity); }

    initializeDisclaimerBanner() { return disclaimerModule.initializeDisclaimerBanner.call(this); }

    showDisclaimerBanner() { return disclaimerModule.showDisclaimerBanner.call(this); }

    hideDisclaimerBanner(options = {}) { return disclaimerModule.hideDisclaimerBanner.call(this, options); }

    acceptDisclaimer() { return disclaimerModule.acceptDisclaimer.call(this); }

    getDisclaimerAcceptance() { return disclaimerModule.getDisclaimerAcceptance.call(this); }

    setDisclaimerAcceptance(value) { return disclaimerModule.setDisclaimerAcceptance.call(this, value); }

    initializeAICoachConsent() { return aiCoachConsentModule.initializeAICoachConsent.call(this); }

    showAICoachConsent() { return aiCoachConsentModule.showAICoachConsent.call(this); }

    hideAICoachConsent(options = {}) { return aiCoachConsentModule.hideAICoachConsent.call(this, options); }

    promptAICoachConsent(nextAction = null) { return aiCoachConsentModule.promptAICoachConsent.call(this, nextAction); }

    acceptAICoachConsent() { return aiCoachConsentModule.acceptAICoachConsent.call(this); }

    cancelAICoachConsent() { return aiCoachConsentModule.cancelAICoachConsent.call(this); }

    hasAICoachConsent() { return aiCoachConsentModule.hasAICoachConsent.call(this); }

    getAICoachConsent() { return aiCoachConsentModule.getAICoachConsent.call(this); }

    setAICoachConsent(value) { return aiCoachConsentModule.setAICoachConsent.call(this, value); }

    initializeSidebarToggle() { return sidebarModule.initializeSidebarToggle.call(this); }

    getSidebarCollapsedPreference() { return sidebarModule.getSidebarCollapsedPreference.call(this); }

    setSidebarCollapsedPreference(collapsed) { return sidebarModule.setSidebarCollapsedPreference.call(this, collapsed); }

    setSidebarCollapsed(collapsed, options = {}) { return sidebarModule.setSidebarCollapsed.call(this, collapsed, options); }

    initializeShareCard() { return shareCardModule.initializeShareCard.call(this); }

    normalizeCumulativePLRange(range) { return shareCardModule.normalizeCumulativePLRange.call(this, range); }

    getCumulativePLRangeLabel(range = this.cumulativePLRange) { return shareCardModule.getCumulativePLRangeLabel.call(this, range); }

    getClosedTradesInRange(range = this.cumulativePLRange) { return shareCardModule.getClosedTradesInRange.call(this, range); }

    getCumulativePLRangeWindow(range) { return shareCardModule.getCumulativePLRangeWindow.call(this, range); }

    updateShareCardRangeLabel(range = this.cumulativePLRange) { return shareCardModule.updateShareCardRangeLabel.call(this, range); }

    computeCumulativePLSeries(range = this.cumulativePLRange) { return shareCardModule.computeCumulativePLSeries.call(this, range); }

    updateShareCard(stats) { return shareCardModule.updateShareCard.call(this, stats); }

    refreshShareCardChart() { return shareCardModule.refreshShareCardChart.call(this); }

    async waitForShareCardChartRender() {
        const raf = typeof requestAnimationFrame === 'function'
            ? requestAnimationFrame
            : null;

        if (!raf) {
            await new Promise(resolve => setTimeout(resolve, 200));
            return;
        }

        await new Promise(resolve => {
            raf(() => {
                raf(() => resolve());
            });
        });
    }

    async downloadShareCard() {
        const button = this.shareCard?.button;
        const root = this.shareCard?.root;
        const card = this.shareCard?.card;

        if (!button || !root || !card) {
            this.showNotification('Sharing is unavailable right now.', 'error');
            return;
        }

        if (typeof window.html2canvas !== 'function') {
            this.showNotification('Image export library failed to load. Please refresh and try again.', 'error');
            return;
        }

        const exportSize = Number(this.shareCard?.exportSize) || SHARE_CARD_EXPORT_SIZE;

        const previousDisabled = button.disabled;
        button.disabled = true;
        button.setAttribute('aria-busy', 'true');
        button.blur();

    const previousExportFlag = card.dataset.exportMode;
        const previousWidth = card.style.width;
        const previousHeight = card.style.height;
        const previousMaxWidth = card.style.maxWidth;
        const previousMaxHeight = card.style.maxHeight;

    // Force the card into a deterministic square frame for export.
        card.dataset.exportMode = 'true';
        card.style.width = `${exportSize}px`;
        card.style.height = `${exportSize}px`;
        card.style.maxWidth = `${exportSize}px`;
        card.style.maxHeight = `${exportSize}px`;

        this.updateShareCard(this.latestStats);
        root.classList.add('is-active');
        root.setAttribute('aria-hidden', 'false');

        await new Promise((resolve) => {
            requestAnimationFrame(() => {
                this.refreshShareCardChart();
                setTimeout(resolve, 220);
            });
        });

        await this.waitForShareCardChartRender();

        let canvas = null;
        try {
            const scale = Math.max(2, Math.min(3, window.devicePixelRatio || 2));
            canvas = await window.html2canvas(card, {
                width: exportSize,
                height: exportSize,
                scale,
                useCORS: true,
                logging: false,
                backgroundColor: '#050b1a'
            });
        } catch (error) {
            console.error('Failed to capture share card:', error);
            this.showNotification('Unable to prepare the share card image. Please try again.', 'error');
        }

        root.classList.remove('is-active');
        root.setAttribute('aria-hidden', 'true');
        button.removeAttribute('aria-busy');
        button.disabled = previousDisabled;

        if (previousExportFlag) {
            card.dataset.exportMode = previousExportFlag;
        } else {
            delete card.dataset.exportMode;
        }

        // Restore the card's natural sizing after capture.
        card.style.width = previousWidth;
        card.style.height = previousHeight;
        card.style.maxWidth = previousMaxWidth;
        card.style.maxHeight = previousMaxHeight;

        if (this.shareCard.chart) {
            this.shareCard.chart.destroy();
            this.shareCard.chart = null;
        }

        if (this.shareCard.chartCanvas) {
            this.shareCard.chartCanvas.style.removeProperty('min-height');
        }

        if (!canvas) {
            return;
        }

        try {
            const dataUrl = canvas.toDataURL('image/png');
            const today = new Date();
            const stamp = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('');
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = `gammaledger-portfolio-${stamp}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            this.showNotification('Portfolio snapshot saved as an image.', 'success');
        } catch (error) {
            console.error('Failed to download image:', error);
            this.showNotification('Image download failed. Please try again.', 'error');
        }
    }

    updateFinnhubStatus(message, variant = 'neutral', autoClearMs = 0) { return finnhubModule.updateFinnhubStatus.call(this, message, variant, autoClearMs); }

    setFinnhubApiKey(value, options = {}) { return finnhubModule.setFinnhubApiKey.call(this, value, options); }

    getFinnhubStorageKey() { return finnhubModule.getFinnhubStorageKey.call(this); }

    async loadFinnhubConfigFromStorage() {
        try {
            const raw = localStorage.getItem(this.getFinnhubStorageKey());
            if (!raw) {
                return;
            }
            const parsed = JSON.parse(raw);
            if (!parsed) {
                return;
            }

            if (parsed.enc && parsed.payload) {
                const cryptoApi = this.getCrypto();
                if (!cryptoApi?.subtle) {
                    console.warn('Encrypted Finnhub API key stored but Web Crypto unavailable.');
                    this.updateFinnhubStatus('Stored Finnhub key is encrypted, but this browser cannot decrypt it.', 'error', 7000);
                    return;
                }

                try {
                    const key = await this.ensureFinnhubEncryptionKey(cryptoApi);
                    if (!key) {
                        throw new Error('Encryption key unavailable');
                    }
                    const decrypted = await this.decryptString(parsed.payload, cryptoApi, key);
                    if (decrypted) {
                        this.finnhub.apiKey = decrypted;
                    }
                } catch (error) {
                    console.warn('Failed to decrypt stored Finnhub API key:', error);
                    this.updateFinnhubStatus('Failed to decrypt stored Finnhub API key.', 'error', 6000);
                }
                return;
            }

            if (typeof parsed.apiKey === 'string') {
                this.finnhub.apiKey = parsed.apiKey;
            }
        } catch (error) {
            console.warn('Failed to load Finnhub configuration:', error);
        }
    }

    saveFinnhubConfigToStorage() { return finnhubModule.saveFinnhubConfigToStorage.call(this); }

    removeFinnhubConfigFromStorage() { return finnhubModule.removeFinnhubConfigFromStorage.call(this); }

    arrayBufferToBase64(buffer) { return cryptoUtil.arrayBufferToBase64(buffer); }

    base64ToArrayBuffer(base64) { return cryptoUtil.base64ToArrayBuffer(base64); }

    getFinnhubSecretStorageKey() { return finnhubModule.getFinnhubSecretStorageKey.call(this); }

    async ensureFinnhubEncryptionKey(cryptoApi = this.getCrypto()) {
        if (!cryptoApi?.subtle) {
            return null;
        }

        if (this.finnhub.encryptionKey) {
            return this.finnhub.encryptionKey;
        }

        let rawKeyB64 = localStorage.getItem(this.getFinnhubSecretStorageKey());
        if (!rawKeyB64) {
            const raw = cryptoApi.getRandomValues(new Uint8Array(32));
            rawKeyB64 = this.arrayBufferToBase64(raw.buffer);
            localStorage.setItem(this.getFinnhubSecretStorageKey(), rawKeyB64);
        }

        const rawKey = new Uint8Array(this.base64ToArrayBuffer(rawKeyB64));
        const cryptoKey = await cryptoApi.subtle.importKey('raw', rawKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
        this.finnhub.encryptionKey = cryptoKey;
        return cryptoKey;
    }

    async encryptString(plainText, cryptoApi, cryptoKey) { return cryptoUtil.encryptString(plainText, cryptoApi, cryptoKey); }

    getCrypto() { return cryptoUtil.getCrypto(); }

    async decryptString(payload, cryptoApi, cryptoKey) { return cryptoUtil.decryptString(payload, cryptoApi, cryptoKey); }

    async encryptAndStoreFinnhubApiKey(cryptoApi = this.getCrypto()) {
        try {
            if (!cryptoApi?.subtle) {
                throw new Error('Web Crypto API unavailable');
            }
            const apiKey = this.finnhub.apiKey || '';
            if (!apiKey) {
                this.removeFinnhubConfigFromStorage();
                return true;
            }

            const key = await this.ensureFinnhubEncryptionKey(cryptoApi);
            if (!key) {
                throw new Error('Failed to prepare encryption key');
            }

            const payload = await this.encryptString(apiKey, cryptoApi, key);
            localStorage.setItem(this.getFinnhubStorageKey(), JSON.stringify({ enc: true, payload }));
            return true;
        } catch (error) {
            console.warn('Failed to encrypt Finnhub API key:', error);
            return false;
        }
    }

    getQuoteEntryKey(trade) { return finnhubModule.getQuoteEntryKey.call(this, trade); }

    rebuildQuoteRefreshSchedule() { return finnhubModule.rebuildQuoteRefreshSchedule.call(this); }

    startQuoteAutoRefreshIfNeeded() { return finnhubModule.startQuoteAutoRefreshIfNeeded.call(this); }

    stopQuoteAutoRefresh() { return finnhubModule.stopQuoteAutoRefresh.call(this); }

    /**
     * Recalculates and restarts the quote auto-refresh with the current rate limit.
     * Called when the Finnhub rate limit setting is changed.
     */
    restartQuoteRefreshWithNewRate() { return finnhubModule.restartQuoteRefreshWithNewRate.call(this); }

    refreshActivePositionsQuotes(options = {}) { return finnhubModule.refreshActivePositionsQuotes.call(this, options); }

    refreshCreditPlaybookQuotes(options = {}) { return finnhubModule.refreshCreditPlaybookQuotes.call(this, options); }

    populateQuoteCell(cell, trade, row, options = {}) { return finnhubModule.populateQuoteCell.call(this, cell, trade, row, options); }

    renderQuoteValue(cell, row, trade, quote) { return finnhubModule.renderQuoteValue.call(this, cell, row, trade, quote); }

    getQuoteChangePercent(quote) { return finnhubModule.getQuoteChangePercent.call(this, quote); }

    getQuoteChangeValue(quote) { return finnhubModule.getQuoteChangeValue.call(this, quote); }

    setQuoteCellError(cell, row, trade, message) { return finnhubModule.setQuoteCellError.call(this, cell, row, trade, message); }

    getQuoteErrorMessage(error) { return finnhubModule.getQuoteErrorMessage.call(this, error); }

    getCachedQuote(ticker) { return finnhubModule.getCachedQuote.call(this, ticker); }

    setCachedQuote(ticker, value) { return finnhubModule.setCachedQuote.call(this, ticker, value); }

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

    enqueueFinnhubRequest(symbol) { return finnhubModule.enqueueFinnhubRequest.call(this, symbol); }

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
            symbol,
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
        const maxRequests = this.finnhub.maxRequestsPerMinute;
        const now = Date.now();

        // Clean up old timestamps outside the rate limit window
        while (timestamps.length > 0 && now - timestamps[0] >= windowMs) {
            timestamps.shift();
        }

        // Enforce rate limit (requests per minute) using sliding window
        if (timestamps.length >= maxRequests) {
            const waitTime = windowMs - (now - timestamps[0]) + 50;
            await new Promise(resolve => setTimeout(resolve, waitTime));
            // Re-clean after waiting
            const afterWait = Date.now();
            while (timestamps.length > 0 && afterWait - timestamps[0] >= windowMs) {
                timestamps.shift();
            }
        }

        // Record this request timestamp
        timestamps.push(Date.now());
    }

    applyPositionHighlight(row, trade, currentPrice = null) { return highlightsModule.applyPositionHighlight.call(this, row, trade, currentPrice); }

    updateExpirationHighlight(cell, trade) { return highlightsModule.updateExpirationHighlight.call(this, cell, trade); }

    updateItmHighlight(row, trade, currentPrice) { return highlightsModule.updateItmHighlight.call(this, row, trade, currentPrice); }

    resolveStrikeForHighlight(trade, row) { return highlightsModule.resolveStrikeForHighlight.call(this, trade, row); }

    isInTheMoney(trade, currentPrice, row) { return highlightsModule.isInTheMoney.call(this, trade, currentPrice, row); }

    inferOptionFlavor(trade = {}) { return dashboardChartsModule.inferOptionFlavor.call(this, trade); }

    updateMonthlyPLChart() { return dashboardChartsModule.updateMonthlyPLChart.call(this); }

    updateCumulativePLChart() { return cumulativePLModule.updateCumulativePLChart.call(this); }

    getWeekEndingFriday(dateInput) { return dates.getWeekEndingFriday(dateInput); }

    getWeekKey(dateInput) { return dates.getWeekKey(dateInput); }

    formatDayLabel(dateInput) { return dates.formatDayLabel(dateInput); }

    formatWeekLabel(dateInput) { return dates.formatWeekLabel(dateInput); }

    updateStrategyPerformanceChart() { return dashboardChartsModule.updateStrategyPerformanceChart.call(this); }

    updateWinRateByStrategyChart() { return dashboardChartsModule.updateWinRateByStrategyChart.call(this); }

    updateTradesList() { return tradesTableModule.updateTradesList.call(this); }

    getSelectedFilterValues(selectElement) { return filtersModule.getSelectedFilterValues.call(this, selectElement); }

    normalizeFilterSelect(selectElement) { return filtersModule.normalizeFilterSelect.call(this, selectElement); }

    resetFilterSelect(selectElement) { return filtersModule.resetFilterSelect.call(this, selectElement); }

    restoreMultiSelectSelection(selectElement, previousValues = []) { return filtersModule.restoreMultiSelectSelection.call(this, selectElement, previousValues); }

    getSortableValue(trade, sortKey) { return filtersModule.getSortableValue.call(this, trade, sortKey); }

    compareSortableValues(a, b) { return filtersModule.compareSortableValues.call(this, a, b); }

    applySortToTrades(trades, sortKey, direction = 'asc') { return filtersModule.applySortToTrades.call(this, trades, sortKey, direction); }

    populateFilters() { return filtersModule.populateFilters.call(this); }

    filterTrades() { return filtersModule.filterTrades.call(this); }

    openTradesFilteredByTicker(ticker) { return filtersModule.openTradesFilteredByTicker.call(this, ticker); }

    // UPDATED: table now includes selection column for merge workflow
    renderTradesTable(trades = this.trades) { return tradesTableModule.renderTradesTable.call(this, trades); }

    toggleTradePayoffDetail(row, detailRow, trade, chartId, footnoteId) { return payoffRenderModule.toggleTradePayoffDetail.call(this, row, detailRow, trade, chartId, footnoteId); }

    async renderTradePayoffChart(trade, chartId, footnoteId) {
        const canvas = document.getElementById(chartId);
        const footnote = document.getElementById(footnoteId);
        const wrapper = canvas?.parentElement;

        if (!canvas) {
            if (footnote) {
                footnote.textContent = 'Canvas element missing; cannot generate payoff diagram.';
            }
            return;
        }

        if (this.tradeDetailCharts?.has(chartId)) {
            return; // Already rendered
        }

        if (footnote) {
            footnote.textContent = 'Loading live price and payoff data…';
        }

        const payoff = this.calculatePayoffSeries(trade);

        if (!payoff || !Array.isArray(payoff.points) || payoff.points.length === 0) {
            if (wrapper) {
                wrapper.classList.add('trade-diagram__canvas--empty');
            }
            canvas.classList.add('hidden');
            if (footnote) {
                footnote.textContent = payoff?.message || 'Payoff diagram not available for this strategy yet.';
            }
            return;
        }

        canvas.classList.remove('hidden');
        wrapper?.classList.remove('trade-diagram__canvas--empty');

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            if (footnote) {
                footnote.textContent = 'Unable to access canvas rendering context.';
            }
            return;
        }

        const currencyFormatter = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 2
        });

        const profitColor = 'rgba(34, 197, 94, 1)'; // green
        const lossColor = 'rgba(248, 113, 113, 1)'; // red
        const profitFill = 'rgba(34, 197, 94, 0.15)';
        const lossFill = 'rgba(248, 113, 113, 0.15)';

        const yValues = payoff.points.map(point => point.y);
        let minY = Math.min(...yValues, 0);
        let maxY = Math.max(...yValues, 0);

        if (!Number.isFinite(minY) || !Number.isFinite(maxY)) {
            if (footnote) {
                footnote.textContent = 'Unable to calculate payoff range.';
            }
            return;
        }

        // Use trade's Max Risk if available to set accurate max loss
        const tradeMaxRisk = Number(trade.maxRiskOverride || trade.maxRisk);
        if (Number.isFinite(tradeMaxRisk) && tradeMaxRisk > 0) {
            minY = Math.min(minY, -tradeMaxRisk);
        }

        // Prepare positive and negative fill areas extending to entire diagram
        const xMin = Math.min(...payoff.points.map(p => p.x));
        const xMax = Math.max(...payoff.points.map(p => p.x));
        
        const positiveArea = [
            { x: xMin, y: 0 },
            ...payoff.points.map(point => ({
                x: point.x,
                y: point.y > 0 ? point.y : 0
            })),
            { x: xMax, y: 0 }
        ];
        const negativeArea = [
            { x: xMin, y: 0 },
            ...payoff.points.map(point => ({
                x: point.x,
                y: point.y < 0 ? point.y : 0
            })),
            { x: xMax, y: 0 }
        ];

        const currentPrice = await this.getUnderlyingPriceForPayoff(trade);

        const detailRowElement = document.querySelector(`.trade-detail-row[data-chart-id="${chartId}"]`);
        if (detailRowElement && !detailRowElement.classList.contains('is-open')) {
            if (footnote) {
                footnote.textContent = 'Tap or click the trade row to generate the payoff diagram.';
            }
            return;
        }

        const priceLabelPlugin = {
            id: `payoffPriceLineLabel-${chartId}`,
            afterDatasetsDraw: (chartInstance) => {
                if (!Number.isFinite(currentPrice)) {
                    return;
                }
                const xScale = chartInstance.scales?.x;
                const chartArea = chartInstance.chartArea;
                if (!xScale || !chartArea) {
                    return;
                }
                const x = xScale.getPixelForValue(currentPrice);
                if (!Number.isFinite(x) || x < chartArea.left || x > chartArea.right) {
                    return;
                }
                const yScale = chartInstance.scales?.y;
                const ctxLabel = chartInstance.ctx;
                ctxLabel.save();
                ctxLabel.font = '12px "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
                ctxLabel.fillStyle = 'rgba(30, 41, 59, 0.9)';
                ctxLabel.textBaseline = 'middle';
                ctxLabel.textAlign = 'center';
                const chartBottomLimit = chartArea.bottom - 10;
                let targetY = chartBottomLimit - 50;
                if (!Number.isFinite(targetY) || targetY < chartArea.top + 12) {
                    targetY = chartArea.top + 12;
                }
                const horizontalPadding = 18;
                const placeOnRight = x < (chartArea.left + chartArea.right) / 2;
                const translatedX = placeOnRight
                    ? Math.min(chartArea.right - horizontalPadding, x + horizontalPadding)
                    : Math.max(chartArea.left + horizontalPadding, x - horizontalPadding);
                const label = `Current ${currencyFormatter.format(currentPrice)}`;
                ctxLabel.translate(translatedX, targetY);
                ctxLabel.rotate(-Math.PI / 2);
                ctxLabel.fillText(label, 0, 0);
                ctxLabel.restore();
            }
        };

        const datasets = [
            {
                id: 'currentPriceLine',
                label: 'Current Price',
                data: [],
                borderColor: 'rgba(100, 116, 139, 0.95)',
                borderDash: [6, 4],
                borderWidth: 2,
                hoverBorderColor: 'rgba(100, 116, 139, 0.95)',
                hoverBorderWidth: 2,
                pointRadius: 0,
                pointHitRadius: 0,
                fill: false,
                order: 0,
                hidden: true
            },
            {
                id: 'breakevenLine',
                label: 'Breakeven',
                data: [],
                borderColor: 'rgba(59, 130, 246, 0.8)',
                borderDash: [2, 4],
                borderWidth: 1,
                pointRadius: 0,
                pointHitRadius: 0,
                fill: false,
                order: 0,
                hidden: true
            },
            {
                id: 'positiveFill',
                label: 'Profit Region',
                data: positiveArea,
                borderColor: 'rgba(0,0,0,0)',
                backgroundColor: profitFill,
                hoverBackgroundColor: profitFill,
                hoverBorderColor: 'rgba(0, 0, 0, 0)',
                hoverBorderWidth: 0,
                fill: 'origin',
                pointRadius: 0,
                pointHitRadius: 0,
                tension: 0,
                order: 1,
                spanGaps: true,
                showLine: true
            },
            {
                id: 'negativeFill',
                label: 'Loss Region',
                data: negativeArea,
                borderColor: 'rgba(0,0,0,0)',
                backgroundColor: lossFill,
                hoverBackgroundColor: lossFill,
                hoverBorderColor: 'rgba(0, 0, 0, 0)',
                hoverBorderWidth: 0,
                fill: 'origin',
                pointRadius: 0,
                pointHitRadius: 0,
                tension: 0,
                order: 1,
                spanGaps: true,
                showLine: true
            },
            {
                id: 'payoffLine',
                label: 'P&L at Expiration',
                data: payoff.points,
                borderColor: profitColor,
                hoverBorderColor: profitColor,
                hoverBorderWidth: 2,
                tension: 0,
                pointRadius: 0,
                pointHoverRadius: 0,
                borderWidth: 2,
                fill: false,
                order: 2,
                segment: {
                    borderColor: ctx => {
                        const y0 = ctx.p0.parsed?.y;
                        const y1 = ctx.p1.parsed?.y;
                        if (y0 >= 0 && y1 >= 0) {
                            return profitColor;
                        }
                        if (y0 <= 0 && y1 <= 0) {
                            return lossColor;
                        }
                        return 'rgba(148, 163, 184, 1)';
                    }
                }
            },
            {
                id: 'zeroLine',
                label: 'Break-even Baseline',
                data: payoff.zeroLinePoints ?? payoff.points.map(point => ({ x: point.x, y: 0 })),
                borderColor: 'rgba(71, 85, 105, 0.9)',
                borderDash: [4, 4],
                borderWidth: 2,
                hoverBorderColor: 'rgba(71, 85, 105, 0.95)',
                hoverBorderWidth: 2,
                pointRadius: 0,
                pointHitRadius: 0,
                fill: false,
                order: 3
            }
        ];

        if (Number.isFinite(currentPrice)) {
            const currentIndex = datasets.findIndex(dataset => dataset.id === 'currentPriceLine');
            if (currentIndex !== -1) {
                datasets[currentIndex].data = [
                    { x: currentPrice, y: minY },
                    { x: currentPrice, y: maxY }
                ];
                datasets[currentIndex].hidden = false;
            }
        }

        // Handle breakeven - can be single value or array
        const breakevenValue = Array.isArray(payoff.breakeven) 
            ? payoff.breakeven[0] 
            : payoff.breakeven;
        
        if (Number.isFinite(breakevenValue)) {
            const breakevenIndex = datasets.findIndex(dataset => dataset.id === 'breakevenLine');
            if (breakevenIndex !== -1) {
                datasets[breakevenIndex].data = [
                    { x: breakevenValue, y: minY },
                    { x: breakevenValue, y: maxY }
                ];
                datasets[breakevenIndex].hidden = false;
            }
        }

        const chart = new Chart(ctx, {
            type: 'line',
            data: { datasets },
            plugins: [priceLabelPlugin],
            options: {
                parsing: false,
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                hover: {
                    mode: 'index',
                    intersect: false
                },
                layout: {
                    padding: {
                        top: 10,
                        right: 10,
                        bottom: 5,
                        left: 5
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(30, 41, 59, 0.95)',
                        titleColor: 'rgba(255, 255, 255, 0.95)',
                        bodyColor: 'rgba(255, 255, 255, 0.9)',
                        borderColor: 'rgba(148, 163, 184, 0.3)',
                        borderWidth: 1,
                        padding: 10,
                        displayColors: false,
                        titleFont: {
                            size: 13,
                            weight: 'bold'
                        },
                        bodyFont: {
                            size: 12
                        },
                        callbacks: {
                            title: (context) => {
                                const price = Number(context[0]?.parsed?.x);
                                if (!Number.isFinite(price)) return '';
                                return `At ${currencyFormatter.format(price)}`;
                            },
                            label: (context) => {
                                if (!context.dataset || context.dataset.id !== 'payoffLine') {
                                    return null;
                                }
                                const value = Number(context.parsed?.y);
                                if (!Number.isFinite(value)) {
                                    return null;
                                }
                                const formattedValue = currencyFormatter.format(value);
                                const label = value >= 0 ? 'Profit' : 'Loss';
                                return `${label}: ${formattedValue}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'linear',
                        title: {
                            display: true,
                            text: 'Underlying Price',
                            font: {
                                size: 11,
                                weight: '600'
                            },
                            color: 'rgba(100, 116, 139, 0.9)'
                        },
                        ticks: {
                            font: {
                                size: 10
                            },
                            maxRotation: 0,
                            autoSkipPadding: 20,
                            callback: (value) => {
                                const formatted = currencyFormatter.format(Number(value));
                                return formatted.replace('.00', '');
                            }
                        },
                        grid: {
                            color: 'rgba(148, 163, 184, 0.1)',
                            drawBorder: false
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'P&L',
                            font: {
                                size: 11,
                                weight: '600'
                            },
                            color: 'rgba(100, 116, 139, 0.9)'
                        },
                        ticks: {
                            font: {
                                size: 10
                            },
                            callback: (value) => {
                                const formatted = currencyFormatter.format(Number(value));
                                return formatted.replace('.00', '');
                            }
                        },
                        grid: {
                            color: 'rgba(148, 163, 184, 0.1)',
                            drawBorder: false
                        },
                        suggestedMin: minY,
                        suggestedMax: maxY
                    }
                }
            }
        });

        this.tradeDetailCharts.set(chartId, chart);

        if (footnote) {
            footnote.textContent = this.formatPayoffFooter(payoff, currencyFormatter);
        }
    }

    destroyTradePayoffChart(chartId, footnoteId) { return payoffRenderModule.destroyTradePayoffChart.call(this, chartId, footnoteId); }

    async getUnderlyingPriceForPayoff(trade = {}) {
        const ticker = (trade?.ticker || '').toString().trim().toUpperCase();

        if (ticker) {
            const cached = this.getCachedQuote(ticker);
            if (cached?.value && Number.isFinite(Number(cached.value.price))) {
                return Number(cached.value.price);
            }

            if (this.finnhub.apiKey) {
                try {
                    const quote = await this.getCurrentPrice(ticker);
                    const livePrice = Number(quote?.price);
                    if (Number.isFinite(livePrice) && livePrice > 0) {
                        return livePrice;
                    }
                } catch (error) {
                    console.warn('Live price lookup failed for payoff chart:', error);
                }
            }
        }

        return this.getFallbackUnderlyingPrice(trade);
    }

    getFallbackUnderlyingPrice(trade = {}) { return payoffSeriesModule.getFallbackUnderlyingPrice.call(this, trade); }

    calculatePayoffSeries(trade) { return payoffSeriesModule.calculatePayoffSeries.call(this, trade); }

    determinePayoffModel(trade) { return payoffSeriesModule.determinePayoffModel.call(this, trade); }

    analyzeMultiLegStrategy(trade, activeLegs, strategy) { return payoffPricingModule.analyzeMultiLegStrategy.call(this, trade, activeLegs, strategy); }

    calculateSingleLegSeries(trade, model) { return payoffSeriesModule.calculateSingleLegSeries.call(this, trade, model); }

    calculateMultiLegSeries(trade, model) { return payoffSeriesModule.calculateMultiLegSeries.call(this, trade, model); }

    calculateVerticalSpreadSeries(trade, model) { return payoffSeriesModule.calculateVerticalSpreadSeries.call(this, trade, model); }

    calculateCoveredCallSeries(trade) { return payoffSeriesModule.calculateCoveredCallSeries.call(this, trade); }

    calculatePmccSeries(trade, model) { return payoffSeriesModule.calculatePmccSeries.call(this, trade, model); }

    calculateSpreadBreakeven({ model, shortStrike, longStrike, entryPrice }) { return payoffPricingModule.calculateSpreadBreakeven.call(this); }

    optionIntrinsic(optionType, price, strike) { return payoffPricingModule.optionIntrinsic.call(this, optionType, price, strike); }

    extractPmccLegs(trade = {}) { return payoffPricingModule.extractPmccLegs.call(this, trade); }

    buildPriceRange(options = {}) { return payoffPricingModule.buildPriceRange.call(this, options); }

    buildPayoffSummary(options) { return payoffSummaryModule.buildPayoffSummary.call(this, options); }

    formatPayoffFooter(payoff, formatter) { return payoffSummaryModule.formatPayoffFooter.call(this, payoff, formatter); }

    getTradePayoffMeta(trade) { return payoffSummaryModule.getTradePayoffMeta.call(this, trade); }

    sortTrades(sortBy) { return tradesTableModule.sortTrades.call(this, sortBy); }

    deleteTrade(id) { return tradesTableModule.deleteTrade.call(this, id); }

    editTrade(id) { return tradesTableModule.editTrade.call(this, id); }

    exportToCSV() { return persistModule.exportToCSV.call(this); }

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
            this.saveToStorage({ fileName: this.currentFileName });
        } catch (error) {
            console.error('Save error:', error);
            if (error.name !== 'AbortError') {
                try {
                    const data = this.buildDatabasePayload();
                    this.saveWithDownload(data);
                    this.hasUnsavedChanges = false;
                    this.updateUnsavedIndicator();
                    this.showNotification('Database saved as download!', 'success');
                    this.saveToStorage({ fileName: this.currentFileName });
                } catch (fallbackError) {
                    this.showNotification('Failed to save database', 'error');
                }
            }
        }

        this.hideLoadingIndicator();
    }

    getStorageTrades() { return persistModule.getStorageTrades.call(this); }

    buildTradeStorageSnapshot(trade) { return persistModule.buildTradeStorageSnapshot.call(this, trade); }

    buildLegStorageSnapshot(leg) { return persistModule.buildLegStorageSnapshot.call(this, leg); }

    buildDatabasePayload() { return persistModule.buildDatabasePayload.call(this); }

    buildMCPContext() { return mcpModule.buildMCPContext.call(this); }

    buildMCPTrade(trade, options = {}) { return mcpModule.buildMCPTrade.call(this, trade, options); }

    buildMCPAssignment(a) { return mcpModule.buildMCPAssignment.call(this, a); }

    async saveWithFileSystemAPI(data) {
        try {
            if (!this.currentFileHandle) {
                this.currentFileHandle = await window.showSaveFilePicker({
                    suggestedName: 'gammaledger.json',
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

    saveWithDownload(data) { return persistModule.saveWithDownload.call(this, data); }

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

        this.processLoadedData(data, { fileName: fileHandle.name, source: 'file-open' });
        this.currentFileHandle = fileHandle;
        this.showNotification(`Loaded ${this.trades.length} trades successfully!`, 'success');
    }

    loadWithFileInput() { return persistModule.loadWithFileInput.call(this); }

    setupImportControls() { return importControlsModule.setupImportControls.call(this); }

    setupTradesMergeControls() { return importControlsModule.setupTradesMergeControls.call(this); }

    toggleTradesMergePanel(forceOpen = null) { return importControlsModule.toggleTradesMergePanel.call(this, forceOpen); }

    updateTradesMergeToggleLabel() { return importControlsModule.updateTradesMergeToggleLabel.call(this); }

    updateMergeColumnVisibility() { return importControlsModule.updateMergeColumnVisibility.call(this); }

    refreshTradesMergePanelContents() { return importControlsModule.refreshTradesMergePanelContents.call(this); }

    appendImportLog(entry = {}) { return importLogModule.appendImportLog.call(this, entry); }

    renderImportLog() { return importLogModule.renderImportLog.call(this); }

    updateImportSummary(details = {}) { return importControlsModule.updateImportSummary.call(this, details); }

    renderImportSummary() { return importLogModule.renderImportSummary.call(this); }

    countImportReviewTrades(batchId = null) { return importControlsModule.countImportReviewTrades.call(this, batchId); }

    getImportReviewTrades() { return importControlsModule.getImportReviewTrades.call(this); }

    /**
     * Count ticker groups where multiple trades share the same ticker and
     * could potentially be merged (e.g. separate legs for a wheel strategy).
     */
    countMergeableTickerGroups() { return importMergeModule.countMergeableTickerGroups.call(this); }

    refreshImportMergeList() { return importMergeModule.refreshImportMergeList.call(this); }

    updateImportMergeButtonState() { return importMergeModule.updateImportMergeButtonState.call(this); }

    resolveMergedExitReason(trades = []) { return importMergeModule.resolveMergedExitReason.call(this, trades); }

    buildMergedTradeNote(trades = [], prefix = '') { return importMergeModule.buildMergedTradeNote.call(this, trades, prefix); }

    createMergedTradeFromTrades(trades = [], options = {}) { return importMergeModule.createMergedTradeFromTrades.call(this, trades, options); }

    mergeSelectedImportTrades() { return importMergeModule.mergeSelectedImportTrades.call(this); }

    mergeSelectedTradesFromList() { return importMergeModule.mergeSelectedTradesFromList.call(this); }

    renderTradeMergeSelectionSummary() { return importMergeModule.renderTradeMergeSelectionSummary.call(this); }

    renderTradeMergeGroups(trades = this.currentFilteredTrades) { return importMergeModule.renderTradeMergeGroups.call(this, trades); }

    updateTradesMergeButtonState() { return importMergeModule.updateTradesMergeButtonState.call(this); }

    syncTradeSelectionCheckboxes() { return importControlsModule.syncTradeSelectionCheckboxes.call(this); }

    syncSelectAllCheckbox() { return importControlsModule.syncSelectAllCheckbox.call(this); }

    handleSelectAllTrades(checked) { return importControlsModule.handleSelectAllTrades.call(this, checked); }

    pruneTradeMergeSelection() { return importMergeModule.pruneTradeMergeSelection.call(this); }

    async handleOfxFileSelection(event) {
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

    async importOfxFile(file, context = {}) {
        if (!file) {
            throw new Error('No file selected.');
        }

        const text = await file.text();
        await this.importOfxContent(text, { ...context, fileSize: file.size || 0 });
    }

    async importOfxContent(raw, context = {}) {
        const batchId = context.batchId || `OFX-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
        const importContext = { ...context, batchId };
        const parsed = this.parseOfx(raw);
        const importResult = this.buildOfxImportPayload(parsed, importContext);
        this.applyOfxImportResult(importResult, importContext);
    }

    handleRobinhoodCsvFileSelection(event) { return importRobinhoodModule.handleRobinhoodCsvFileSelection.call(this, event); }

    async importRobinhoodCsvFile(file, context = {}) {
        if (!file) {
            throw new Error('No file selected.');
        }

        this.showLoadingIndicator('Importing Robinhood CSV...');
        const text = await file.text();
        await this.importRobinhoodCsvContent(text, { ...context, fileSize: file.size || 0 });
    }

    async importRobinhoodCsvContent(raw, context = {}) {
        const batchId = context.batchId || `RH-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
        const importContext = { ...context, batchId };
        const parsed = this.parseRobinhoodCsv(raw);
        const importResult = this.buildRobinhoodImportPayload(parsed, importContext);
        this.applyRobinhoodImportResult(importResult, importContext);
    }

    parseRobinhoodCsv(raw) { return importRobinhoodModule.parseRobinhoodCsv.call(this, raw); }

    parseCsvRow(line) { return parseCsvRow(line); }

    parseRobinhoodTransaction(row) { return importRobinhoodModule.parseRobinhoodTransaction.call(this, row); }

    parseRobinhoodOptionTransaction(data) { return importRobinhoodModule.parseRobinhoodOptionTransaction.call(this, data); }

    parseRobinhoodStockTransaction(data) { return importRobinhoodModule.parseRobinhoodStockTransaction.call(this, data); }

    parseRobinhoodAssignedStockTransaction(row) { return importRobinhoodModule.parseRobinhoodAssignedStockTransaction.call(this, row); }

    /**
     * Parse an OASGN row from a Robinhood CSV into an implicit closing leg.
     * A put assignment creates a BTC (Buy to Close) leg; a call assignment
     * creates an STC (Sell to Close) leg.  Premium is 0 because the exchange
     * closes the option via assignment, not a market transaction.
     */
    parseRobinhoodAssignmentClosingLeg(row) { return importRobinhoodModule.parseRobinhoodAssignmentClosingLeg.call(this, row); }

    mapRobinhoodTransCode(transCode) { return importRobinhoodModule.mapRobinhoodTransCode.call(this, transCode); }

    parseRobinhoodDate(value) { return importRobinhoodModule.parseRobinhoodDate.call(this, value); }

    normalizeRobinhoodDate(value) { return importRobinhoodModule.normalizeRobinhoodDate.call(this, value); }

    parseRobinhoodNumber(value) { return importRobinhoodModule.parseRobinhoodNumber.call(this, value); }

    calculateRobinhoodFees(quantity, premium, total) { return importRobinhoodModule.calculateRobinhoodFees.call(this, quantity, premium, total); }

    buildRobinhoodImportPayload(parsed, context = {}) { return importRobinhoodModule.buildRobinhoodImportPayload.call(this, parsed, context); }

    /**
     * Consolidate multiple legs from split orders into aggregated legs.
     * When Robinhood splits an order into multiple fills, this combines them.
     */
    consolidateImportLegs(legs = []) { return importPositionKeysModule.consolidateImportLegs.call(this, legs); }

    buildLegFromRobinhoodTransaction(transaction) { return importRobinhoodModule.buildLegFromRobinhoodTransaction.call(this, transaction); }

    applyRobinhoodImportResult(importResult, context = {}) { return importRobinhoodModule.applyRobinhoodImportResult.call(this, importResult, context); }

    parseOfx(raw) { return importOfxModule.parseOfx.call(this, raw); }

    extractOfxSecurities(doc) { return importOfxModule.extractOfxSecurities.call(this, doc); }

    parseOptionContractSymbol(symbol = '') { return importPositionKeysModule.parseOptionContractSymbol.call(this, symbol); }

    parseOfxDate(value) { return importOfxModule.parseOfxDate.call(this, value); }

    mapOfxOrderType(tag, rawType, units = 0) { return importOfxModule.mapOfxOrderType.call(this, tag, rawType, units); }

    extractOfxTransactions(doc, securities) { return importOfxModule.extractOfxTransactions.call(this, doc, securities); }

    sanitizeExternalLegId(value) { return importPositionKeysModule.sanitizeExternalLegId.call(this, value); }

    groupTransactionsForImport(transactions = []) { return importPositionKeysModule.groupTransactionsForImport.call(this, transactions); }

    buildLegFromTransaction(transaction) { return importPositionKeysModule.buildLegFromTransaction.call(this, transaction); }

    sanitizeImportedLeg(leg) { return importPositionKeysModule.sanitizeImportedLeg.call(this, leg); }

    buildPositionKey(ticker, leg, options = {}) { return importPositionKeysModule.buildPositionKey.call(this, ticker, leg, options); }

    buildPositionIndex(trades = []) { return importPositionKeysModule.buildPositionIndex.call(this, trades); }

    consumePositionMatches(index, key, leg) { return importPositionKeysModule.consumePositionMatches.call(this, index, key, leg); }

    buildExistingExternalIdSet() { return importPositionKeysModule.buildExistingExternalIdSet.call(this); }

    tradeContainsExternalId(trade, externalId) { return importPositionKeysModule.tradeContainsExternalId.call(this, trade, externalId); }

    inferStrategyFromLegs(legs = []) { return importPositionKeysModule.inferStrategyFromLegs.call(this, legs); }

    composeImportNotes(context = {}, options = {}) { return importPositionKeysModule.composeImportNotes.call(this, context, options); }

    buildOfxImportPayload(parsed, context = {}) { return importOfxModule.buildOfxImportPayload.call(this, parsed, context); }

    applyOfxImportResult(importResult, context = {}) { return importOfxModule.applyOfxImportResult.call(this, importResult, context); }

    processLoadedData(data, metadata = {}) { return persistModule.processLoadedData.call(this, data, metadata); }

    newDatabase() { return persistModule.newDatabase.call(this); }

    updateFileNameDisplay() { return notificationsModule.updateFileNameDisplay.call(this); }

    updateUnsavedIndicator() { return notificationsModule.updateUnsavedIndicator.call(this); }

    showLoadingIndicator(text = 'Loading...') { return notificationsModule.showLoadingIndicator.call(this, text); }

    hideLoadingIndicator() { return notificationsModule.hideLoadingIndicator.call(this); }

    showNotification(message, type = 'info') { return notificationsModule.showNotification.call(this, message, type); }

    markUnsavedChanges() { return notificationsModule.markUnsavedChanges.call(this); }

    saveToStorage(metadata = {}) { return persistModule.saveToStorage.call(this, metadata); }

    async loadFromStorage() {
        try {
            const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed && Array.isArray(parsed.trades)) {
                    this.trades = parsed.trades.map(trade => {
                        const normalized = { ...trade };
                        if (normalized.tradeReasoning && !normalized.notes) {
                            normalized.notes = normalized.tradeReasoning;
                        }
                        delete normalized.tradeReasoning;
                        return this.enrichTradeData(normalized);
                    });
                    if (parsed.fileName) {
                        this.currentFileName = parsed.fileName;
                    }
                    this.currentFileHandle = null;
                    this.hasUnsavedChanges = false;
                    this.updateUnsavedIndicator();
                    this.updateFileNameDisplay();
                    this.updateDashboard();
                    return true;
                }
            }

            for (const key of LEGACY_STORAGE_KEYS) {
                if (!key || key === LOCAL_STORAGE_KEY) {
                    continue;
                }

                const legacy = localStorage.getItem(key);
                if (!legacy) {
                    continue;
                }

                const parsedTrades = JSON.parse(legacy);
                if (Array.isArray(parsedTrades)) {
                    this.trades = parsedTrades.map(trade => {
                        const normalized = { ...trade };
                        if (normalized.tradeReasoning && !normalized.notes) {
                            normalized.notes = normalized.tradeReasoning;
                        }
                        delete normalized.tradeReasoning;
                        return this.enrichTradeData(normalized);
                    });
                    this.currentFileName = 'Unsaved Database';
                    this.hasUnsavedChanges = false;
                    this.updateUnsavedIndicator();
                    this.saveToStorage({ fileName: this.currentFileName });
                    this.updateFileNameDisplay();
                    this.updateDashboard();
                    return true;
                }
            }
        } catch (e) {
            console.warn('Failed to load from localStorage:', e);
        }

        return false;
    }

    formatNumber(value, options = {}) { return fmt.formatNumber(value, options); }

    formatPercent(value, fallback = '—', options = {}) { return fmt.formatPercent(value, fallback, options); }

    getStrategyDisplayName(strategy = '') { return fmt.getStrategyDisplayName(strategy); }

    escapeHTML(value) { return dom.escapeHTML(value); }

    formatCurrency(amount, options = {}) { return fmt.formatCurrency(amount, options); }

    formatDate(dateString) { return dates.formatDate(dateString); }
}

// AI agent classes have moved to src/ai/{local,gemini}-agent.js.

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', function () {
    window.tracker = new GammaLedger();
});

// Global error handlers for improved stability
window.addEventListener('error', (event) => {
    console.error('Global error caught:', event.error);
    // Prevent the error from breaking the app completely
    event.preventDefault();
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    // Prevent unhandled promise rejections from crashing the app
    event.preventDefault();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.tracker && typeof window.tracker.cleanup === 'function') {
        window.tracker.cleanup();
    }
});