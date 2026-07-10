// src/index.ts — GammaLedger application entry point.
// Phase 2 (Phase F): converted from src/index.js to TypeScript.
// All module imports now use relative paths from src/. Constants and sample data
// live in dedicated modules; they are re-imported here so existing references
// inside class GammaLedger / LocalInsightsAgent / GeminiInsightsAgent work unchanged.

// --- Global type declarations for host-provided libraries -------------------

declare global {
    interface Window {
        tracker: GammaLedger
        // File System Access API (not yet in all TS lib versions)
        showSaveFilePicker?: (options?: Record<string, unknown>) => Promise<FileSystemFileHandle>
        showOpenFilePicker?: (options?: Record<string, unknown>) => Promise<FileSystemFileHandle[]>
    }
}
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
} from './core/config.js';
import { BUILTIN_SAMPLE_DATA } from './core/sample-data.js';
import * as dates from './utils/dates.js';
import * as dom from './utils/dom.js';
import * as fmt from './utils/formatting.js';
import * as cryptoUtil from './utils/crypto.js';
import { safeLocalStorage } from './core/storage.js';
import { parseCsvRow } from './utils/import-csv.js';
import { LocalInsightsAgent } from './ai/local-agent.js';
import { GeminiInsightsAgent } from './ai/gemini-agent.js';
import * as legsModule from './trades/legs.js';
import * as pnlModule from './calculations/pnl.js';
import * as daysHeldModule from './calculations/daysheld.js';
import * as legRealizationModule from './calculations/leg-realization.js';
import * as positionsModule from './trades/positions.js';
import * as wheelModule from './trades/wheel.js';
import * as pmccModule from './trades/pmcc.js';
import * as statsModule from './calculations/stats.js';
import * as monteCarloModule from './calculations/monte-carlo.js';
import * as riskModule from './trades/risk.js';
import * as spreadsModule from './trades/spreads.js';
import * as finnhubModule from './integrations/finnhub.js';
import * as geminiIntegrationModule from './integrations/gemini.js';
import * as mcpModule from './integrations/mcp.js';
import * as defaultFeeModule from './settings/default-fee.js';
import * as importControlsModule from './imports/controls.js';
import * as importLogModule from './imports/log.js';
import * as importMergeModule from './imports/merge.js';
import * as importPositionKeysModule from './imports/position-keys.js';
import * as importRobinhoodModule from './imports/robinhood.js';
import * as importOfxModule from './imports/ofx.js';
import * as notificationsModule from './ui/notifications.js';
import * as sidebarModule from './ui/sidebar.js';
import * as disclaimerModule from './ui/modals/disclaimer.js';
import * as aiCoachConsentModule from './ui/modals/ai-coach-consent.js';
import type { AICoachConsentState } from './ui/modals/ai-coach-consent.js';
import type { StockMetrics } from '@types-gl/integrations';
import * as filtersModule from './ui/filters.js';
import * as dashboardChartsModule from './ui/charts/dashboard-charts.js';
import * as cumulativePLModule from './ui/charts/cumulative-pl.js';
import * as bridgeModule from './ui/dashboard/bridge.js';
import * as groupedMetricsModule from './ui/dashboard/grouped-metrics.js';
import * as concentrationModule from './ui/dashboard/concentration.js';
import * as performanceTrendModule from './ui/charts/performance-trend.js';
import * as chartDestroyModule from './ui/charts/destroy.js';
import * as highlightsModule from './ui/tables/highlights.js';
import * as tradesTableModule from './ui/tables/trades-table.js';
import * as creditPlaybookDataModule from './ui/credit-playbook/data.js';
import * as creditPlaybookRenderModule from './ui/credit-playbook/render.js';
import * as shareCardModule from './ui/share-card.js';
import * as aiChatModule from './ai/chat.js';
import * as dashboardModule from './ui/dashboard.js';
import * as persistModule from './database/persist.js';
import * as legFormModule from './trades/leg-form.js';
import * as activePositionsModule from './ui/tables/active-positions.js';
import * as recentTradesModule from './ui/tables/recent-trades.js';
import * as assignedPositionsModule from './ui/tables/assigned-positions.js';
import * as creditPlaybookModule from './ui/credit-playbook/index.js';
import * as viewsModule from './ui/views.js';
import * as announcementModule from './ui/announcement.js';
import * as strategyTemplatesModule from './trades/strategy-templates.js';
import * as filterChipsModule from './ui/filter-chips.js';
import * as shortcutsModule from './ui/shortcuts.js';
import { initDashboardTabs } from './ui/dashboard/tabs.js';


class GammaLedger {
    // --- Instance property declarations (assigned in constructor) ----------
    declare trades: Record<string, unknown>[]
    declare currentView: string
    declare sortDirection: Record<string, unknown>
    declare charts: Record<string, unknown>
    declare latestStats: unknown
    declare currentFileHandle: FileSystemFileHandle | null
    declare currentFileName: string
    declare hasUnsavedChanges: boolean
    declare supportsFileSystemAccess: boolean
    declare currentEditingId: string | null
    declare currentEditingTrade: Record<string, unknown> | null
    declare importControlsInitialized: boolean
    declare importLog: Record<string, unknown>[]
    declare importSummary: unknown
    declare importMergeSelection: Set<unknown>
    declare tradeMergeSelection: Set<unknown>
    declare tradesGridApi: unknown
    declare activePositionsGridApi: unknown
    declare recentTradesGridApi: unknown
    declare assignedPositionsGridApi: unknown
    declare creditPlaybookGridApi: unknown
    declare tradesMergeInitialized: boolean
    declare tradesMergePanelOpen: boolean
    declare currentFilteredTrades: Record<string, unknown>[]
    declare currentSort: { key: string | null; direction: string }
    declare cumulativePLRange: string
    declare disclaimerBanner: { element: HTMLDialogElement | null; agreeButton: Element | null; agreeHandler: (() => void) | null }
    declare disclaimerFadeMs: number
    declare aiCoachConsent: AICoachConsentState
    declare finnhub: { apiKey: string; encryptionKey: CryptoKey | null; cache: Map<string, unknown>; cacheTTL: number; outstandingRequests: Map<string, unknown>; rateLimitQueue: Promise<unknown>; maxRequestsPerMinute: number; timestamps: number[]; statusTimeoutId: ReturnType<typeof setTimeout> | null; lastStatus: unknown; elements: Record<string, unknown>; marketStatusTimer: ReturnType<typeof setTimeout> | null; marketStatusCountdownTimer: ReturnType<typeof setInterval> | null }
    declare gemini: { apiKey: string; encryptionKey: CryptoKey | null; model: string; maxOutputTokens: number; statusTimeoutId: ReturnType<typeof setTimeout> | null; lastStatus: unknown; pendingStatus: unknown; elements: Record<string, unknown> }
    declare aiAgent: GeminiInsightsAgent | null
    declare aiChatMessages: Record<string, unknown>[]
    declare aiChatSessionId: number
    declare aiChatPendingRequest: boolean
    declare aiChatOpen: boolean
    declare aiDraftImport: Record<string, unknown> | null
    declare activeQuoteEntries: Map<string, unknown>
    declare quoteRefreshIntervalId: ReturnType<typeof setInterval> | null
    declare autoRefreshIntervalMs: number
    declare quoteRefreshKeys: string[]
    declare quoteRefreshCursor: number
    declare earningsMap: Map<string, import('./types/integrations.js').EarningsCalendarEntry>
    declare metricsCache: Map<string, StockMetrics | 'loading' | 'error'>
    declare expandedTradeId: string | null
    declare activePositionsTrades: Record<string, unknown>[]
    declare expandedRecentTradeId: string | null
    declare recentClosedTrades: Record<string, unknown>[]
    declare expandedAssignedTradeId: string | null
    declare filteredAssignmentEntries: Record<string, unknown>[]
    declare signalsCache: Map<string, import('./types/integrations.js').SignalsData | 'loading' | 'error'>
    declare metricsPromiseMap: Map<string, Promise<import('./types/integrations.js').StockMetrics | null>>
    declare signalsPromiseMap: Map<string, Promise<import('./types/integrations.js').SignalsData | null>>
    declare profileCache: Map<string, import('./types/integrations.js').CompanyProfile | 'loading' | 'error'>
    declare profilePromiseMap: Map<string, Promise<import('./types/integrations.js').CompanyProfile | null>>
    declare earningsCache: Map<string, import('./types/integrations.js').EarningsSurprise[] | 'loading' | 'error'>
    declare earningsPromiseMap: Map<string, Promise<import('./types/integrations.js').EarningsSurprise[] | null>>
    declare positionHighlightConfig: { expirationWarningDays: number; expirationCriticalDays: number }
    declare creditPlaybookStatus: string
    declare creditPlaybookStrategy: string
    declare creditPlaybookHorizon: string
    declare creditPlaybookSymbol: string
    declare creditPlaybookSort: { key: string; direction: string }
    declare creditPlaybookEntries: Record<string, unknown>[]
    declare creditPlaybookNeedsRefresh: boolean
    declare creditPlaybookInitialized: boolean
    declare creditPlaybookStrategyOptions: string[]
    declare assignedPositionsStatusFilter: string
    declare defaultFeePerContract: number | null
    declare sidebarState: Record<string, unknown>
    declare shareCard: { root: HTMLElement | null; card: HTMLElement | null; button: HTMLElement | null; chartCanvas: HTMLCanvasElement | null; chartTitle: HTMLElement | null; rangeLabel: HTMLElement | null; chart: { destroy(): void } | null; metrics: Record<string, unknown>; timestamp: unknown; exportSize: number }

    constructor() {
        this.trades = [];
        this.currentView = 'dashboard';
        this.sortDirection = {};
        this.charts = {};
            this.latestStats = null;
        this.currentFileHandle = null;
        this.currentFileName = 'Unsaved Database';
        this.hasUnsavedChanges = false;
        this.supportsFileSystemAccess = 'showOpenFilePicker' in window;
        this.currentEditingId = null;
        this.currentEditingTrade = null;
        this.importControlsInitialized = false;
        this.importLog = [];
        this.importSummary = null;
        this.importMergeSelection = new Set();
        this.tradeMergeSelection = new Set();
        this.tradesGridApi = null;
        this.activePositionsGridApi = null;
        this.recentTradesGridApi = null;
        this.assignedPositionsGridApi = null;
        this.creditPlaybookGridApi = null;
        this.tradesMergeInitialized = false;
        this.tradesMergePanelOpen = false;
        this.currentFilteredTrades = [];
        this.currentSort = {
            key: null,
            direction: 'asc'
        };
        this.earningsMap = new Map();
        this.metricsCache = new Map();
        this.expandedTradeId = null;
        this.activePositionsTrades = [];
        this.expandedRecentTradeId = null;
        this.recentClosedTrades = [];
        this.expandedAssignedTradeId = null;
        this.filteredAssignmentEntries = [];
        this.signalsCache = new Map();
        this.metricsPromiseMap = new Map();
        this.signalsPromiseMap = new Map();
        this.profileCache = new Map();
        this.profilePromiseMap = new Map();
        this.earningsCache = new Map();
        this.earningsPromiseMap = new Map();
        this.cumulativePLRange = 'ALL';

        this.disclaimerBanner = {
            element: null,
            agreeButton: null,
            agreeHandler: null
        };
        this.disclaimerFadeMs = 280;

        this.aiCoachConsent = {
            element: null,
            panel: null,
            agreeButton: null,
            agreeHandler: null,
            dismissButtons: [],
            dismissHandlers: [],
            cancelHandler: null,
            backdropHandler: null,
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
            elements: {},
            marketStatusTimer: null,
            marketStatusCountdownTimer: null
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

        this.aiAgent = new GeminiInsightsAgent(this as unknown as ConstructorParameters<typeof GeminiInsightsAgent>[0]);
        this.aiChatMessages = [];
        this.aiChatSessionId = Date.now();
        this.aiChatPendingRequest = false;
        this.aiChatOpen = false;
        this.aiDraftImport = null;

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
    safeLocalStorage: typeof safeLocalStorage = safeLocalStorage;

    // Input validation utilities
    validateNumber(value: unknown, options: Record<string, unknown> = {}): number {
        const { min = -Infinity, max = Infinity, allowZero = true, defaultValue = 0 } = options;
        const num = Number(value);
        
        if (!Number.isFinite(num)) {
            return Number(defaultValue);
        }
        
        if (!allowZero && num === 0) {
            return Number(defaultValue);
        }
        
        if (num < Number(min) || num > Number(max)) {
            return Number(defaultValue);
        }
        
        return num;
    }

    validateDate(dateString: unknown): string | null {
        if (!dateString || typeof dateString !== 'string') {
            return null;
        }
        
        const date = new Date(dateString);
        return isNaN(date.getTime()) ? null : dateString;
    }

    sanitizeString(value, maxLength = 1000) { return fmt.sanitizeString(value, maxLength); }

    // Safe chart cleanup helper
    destroyChart(chart) { return chartDestroyModule.destroyChart(chart); }

    // Cleanup all resources
    cleanup() {
        // Clear all timeouts
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
            this.initMarketStatus();
            // Fetch earnings calendar once — covers all open position expiration windows
            if (this.finnhub?.apiKey && Array.isArray(this.trades) && this.trades.length > 0) {
                const openTrades = this.trades.filter((t: any) =>
                    t.status === 'Open' || t.status === 'Rolling'
                );
                const tickers = [
                    ...new Set(
                        openTrades
                            .map((t: any) => String(t.ticker || ''))
                            .filter(Boolean)
                    )
                ] as string[];
                const maxExpiration = openTrades
                    .map((t: any) => String(t.expirationDate || ''))
                    .filter(Boolean)
                    .sort()
                    .slice(-1)[0];
                if (tickers.length && maxExpiration) {
                    this.fetchEarningsCalendar(tickers, maxExpiration).then(() => {
                        // Refresh the active positions table after earnings data is available
                        // so that earnings badges appear on the DTE cells.
                        this.updateActivePositionsTable();
                    }).catch(() => { /* ignore fetch errors — table already rendered without badges */ });
                }
            }
            this.initializeDefaultFeeControls();
            this.initializeAnnouncementBanner();
            this.setupSampleDataBannerActions();
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


    hasNetOpenOptionLegs(trade: Record<string, unknown> = {}) {
        const legs = Array.isArray((trade as Record<string, unknown>)?.legs) ? (trade as Record<string, unknown>).legs as Record<string, unknown>[] : [];
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

    async autoFillUnderlyingPrice(inputElement: HTMLInputElement | null) { return legFormModule.autoFillUnderlyingPrice.call(this, inputElement); }

    async autoFillUnderlyingPricesForLegs() { return legFormModule.autoFillUnderlyingPricesForLegs.call(this); }

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

    isFullyRealizedTrade(trade) { return positionsModule.isFullyRealizedTrade.call(this, trade); }

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

    calculateRealizedPL(trade) { return pnlModule.calculateRealizedPL.call(this, trade); }

    summarizeLegRealization(trade) { return legRealizationModule.summarizeLegRealization.call(this, trade); }

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
     * True when a trade has an assignment event in its lifecycle AND still holds
     * the assigned shares. Independent of CC coverage — covered wheels still
     * count as "assigned inventory" for tables and risk views.
     */
    hasAssignedInventory(trade = {}) { return wheelModule.hasAssignedInventory.call(this, trade); }

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
                this.updateTickerPreview((e.target as HTMLInputElement).value);
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

        // Strategy picker: ⭐ templates + type-ahead filter
        this.setupStrategyPicker();

        // Global keyboard shortcuts + `?` help dialog
        this.setupKeyboardShortcuts();

        // Dashboard tab groups (analytics charts, positions tables)
        initDashboardTabs();

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
        this.setupAIChatDraftImport();

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

    setupAIChatDraftImport() { return aiChatModule.setupAIChatDraftImport.call(this); }

    initializeAIChat() { return aiChatModule.initializeAIChat.call(this); }

    toggleAIChat(forceOpen = null) { return aiChatModule.toggleAIChat.call(this, forceOpen); }

    async handleAIChatSubmit() { return aiChatModule.handleAIChatSubmit.call(this); }

    async handleAIQuickPrompt(prompt: string, options: { promptType?: string | null; [key: string]: unknown } = {}) { return aiChatModule.handleAIQuickPrompt.call(this, prompt, options); }

    async handleAIChatImageFile(file: File) { return aiChatModule.handleAIChatImageFile.call(this, file); }

    async extractAIDraftLegsFromScreenshot() { return aiChatModule.extractAIDraftLegsFromScreenshot.call(this); }

    clearAIDraftImport() { return aiChatModule.clearAIDraftImport.call(this); }

    renderAIDraftImport() { return aiChatModule.renderAIDraftImport.call(this); }

    importAIDraftTrades() { return aiChatModule.importAIDraftTrades.call(this); }
    applyAIDraftLegsToTradeForm() { return aiChatModule.applyAIDraftLegsToTradeForm.call(this); }

    appendAIChatMessage(sender, text, options = {}) { return aiChatModule.appendAIChatMessage.call(this, sender, text, options); }

    renderAIChatMessages() { return aiChatModule.renderAIChatMessages.call(this); }

    renderMarkdownToHTML(markdown = '') { return dom.renderMarkdownToHTML(markdown); }

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


    updateActivePositionsTable(openTrades?: any[]) { return activePositionsModule.updateActivePositionsTable.call(this, openTrades as any); }

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

    async loadGeminiConfigFromStorage() { return geminiIntegrationModule.loadGeminiConfigFromStorage.call(this); }

    saveGeminiConfigToStorage(options = {}) { return geminiIntegrationModule.saveGeminiConfigToStorage.call(this, options); }

    removeGeminiEncryptionKey() { return geminiIntegrationModule.removeGeminiEncryptionKey.call(this); }

    async ensureGeminiEncryptionKey(cryptoApi = this.getCrypto()) { return geminiIntegrationModule.ensureGeminiEncryptionKey.call(this, cryptoApi); }

    async encryptAndStoreGeminiApiKey(cryptoApi = this.getCrypto()) { return geminiIntegrationModule.encryptAndStoreGeminiApiKey.call(this, cryptoApi); }

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

    buildStrategyTemplateLegs(strategy) { return strategyTemplatesModule.buildStrategyTemplateLegs.call(this, strategy); }

    setupStrategyPicker() { return strategyTemplatesModule.setupStrategyPicker.call(this); }

    initializeAnnouncementBanner() { return announcementModule.initializeAnnouncementBanner.call(this); }

    updateSampleDataBanner() { return announcementModule.updateSampleDataBanner.call(this); }

    setupSampleDataBannerActions() { return announcementModule.setupSampleDataBannerActions.call(this); }

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

    async waitForShareCardChartRender() { return shareCardModule.waitForShareCardChartRender.call(this); }

    async downloadShareCard() { return shareCardModule.downloadShareCard.call(this); }

    updateFinnhubStatus(message, variant = 'neutral', autoClearMs = 0) { return finnhubModule.updateFinnhubStatus.call(this, message, variant, autoClearMs); }

    setFinnhubApiKey(value, options = {}) { return finnhubModule.setFinnhubApiKey.call(this, value, options); }

    getFinnhubStorageKey() { return finnhubModule.getFinnhubStorageKey.call(this); }

    async loadFinnhubConfigFromStorage() { return finnhubModule.loadFinnhubConfigFromStorage.call(this); }

    saveFinnhubConfigToStorage() { return finnhubModule.saveFinnhubConfigToStorage.call(this); }

    removeFinnhubConfigFromStorage() { return finnhubModule.removeFinnhubConfigFromStorage.call(this); }

    arrayBufferToBase64(buffer) { return cryptoUtil.arrayBufferToBase64(buffer); }

    base64ToArrayBuffer(base64) { return cryptoUtil.base64ToArrayBuffer(base64); }

    getFinnhubSecretStorageKey() { return finnhubModule.getFinnhubSecretStorageKey.call(this); }

    async ensureFinnhubEncryptionKey(cryptoApi = this.getCrypto()) { return finnhubModule.ensureFinnhubEncryptionKey.call(this, cryptoApi); }

    async encryptString(plainText, cryptoApi, cryptoKey) { return cryptoUtil.encryptString(plainText, cryptoApi, cryptoKey); }

    getCrypto() { return cryptoUtil.getCrypto(); }

    async decryptString(payload, cryptoApi, cryptoKey) { return cryptoUtil.decryptString(payload, cryptoApi, cryptoKey); }

    async encryptAndStoreFinnhubApiKey(cryptoApi = this.getCrypto()) { return finnhubModule.encryptAndStoreFinnhubApiKey.call(this, cryptoApi); }

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

    async getCurrentPrice(ticker, options = {}) { return finnhubModule.getCurrentPrice.call(this, ticker, options); }

    enqueueFinnhubRequest(symbol) { return finnhubModule.enqueueFinnhubRequest.call(this, symbol); }

    async performFinnhubFetch(symbol) { return finnhubModule.performFinnhubFetch.call(this, symbol); }

    async enforceFinnhubRateLimit() { return finnhubModule.enforceFinnhubRateLimit.call(this); }

    initMarketStatus() { return finnhubModule.initMarketStatus.call(this); }

    async fetchMarketStatus() { return finnhubModule.fetchMarketStatus.call(this); }

    updateMarketStatusBadge(p: any) { return finnhubModule.updateMarketStatusBadge.call(this, p); }

    async fetchEarningsCalendar(tickers: string[], toDate: string) { return finnhubModule.fetchEarningsCalendar.call(this, tickers, toDate); }
    async fetchStockMetrics(ticker: string) { return finnhubModule.fetchStockMetrics.call(this, ticker); }
    async fetchSignalsData(ticker: string) { return finnhubModule.fetchSignalsData.call(this, ticker); }
    async fetchCompanyProfile(ticker: string) { return finnhubModule.fetchCompanyProfile.call(this, ticker); }
    async fetchEarningsSurprise(ticker: string) { return finnhubModule.fetchEarningsSurprise.call(this, ticker); }
    getEarningsDateForTrade(trade: Record<string, unknown>) { return finnhubModule.getEarningsDateForTrade.call(this, trade); }

    applyPositionHighlight(row, trade, currentPrice = null) { return highlightsModule.applyPositionHighlight.call(this, row, trade, currentPrice); }

    updateExpirationHighlight(cell, trade) { return highlightsModule.updateExpirationHighlight.call(this, cell, trade); }

    updateItmHighlight(row, trade, currentPrice) { return highlightsModule.updateItmHighlight.call(this, row, trade, currentPrice); }

    resolveStrikeForHighlight(trade, row) { return highlightsModule.resolveStrikeForHighlight.call(this, trade, row); }

    isInTheMoney(trade, currentPrice, row) { return highlightsModule.isInTheMoney.call(this, trade, currentPrice, row); }

    inferOptionFlavor(trade = {}) { return dashboardChartsModule.inferOptionFlavor.call(this, trade); }

    renderBridge(stats) { return bridgeModule.renderBridge.call(this, stats); }

    renderGroupedMetrics(stats) { return groupedMetricsModule.renderGroupedMetrics.call(this, stats); }

    renderConcentration(stats) { return concentrationModule.renderConcentration.call(this, stats); }

    updatePerformanceTrendChart() { return performanceTrendModule.updatePerformanceTrendChart.call(this); }

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

    renderFilterChips() { return filterChipsModule.renderFilterChips.call(this); }

    setupKeyboardShortcuts() { return shortcutsModule.setupKeyboardShortcuts.call(this); }

    filterTrades() { return filtersModule.filterTrades.call(this); }

    openTradesFilteredByTicker(ticker) { return filtersModule.openTradesFilteredByTicker.call(this, ticker); }
    openTradesFilteredByStrategy(strategy) { return filtersModule.openTradesFilteredByStrategy.call(this, strategy); }

    // UPDATED: table now includes selection column for merge workflow
    renderTradesTable(trades = this.trades) { return tradesTableModule.renderTradesTable.call(this, trades); }

    updateTradesGridMergeColumnVisibility() { return tradesTableModule.updateTradesGridMergeColumnVisibility.call(this); }

    refreshTradesGridSelectionState() { return tradesTableModule.refreshTradesGridSelectionState.call(this); }

    sortTrades(sortBy) { return tradesTableModule.sortTrades.call(this, sortBy); }

    deleteTrade(id, trade) { return tradesTableModule.deleteTrade.call(this, id, trade); }

    editTrade(id, trade) { return tradesTableModule.editTrade.call(this, id, trade); }

    exportToCSV() { return persistModule.exportToCSV.call(this); }

    // File System Access API Methods
    async saveDatabase() { return persistModule.saveDatabase.call(this); }

    getStorageTrades() { return persistModule.getStorageTrades.call(this); }

    buildTradeStorageSnapshot(trade) { return persistModule.buildTradeStorageSnapshot.call(this, trade); }

    buildLegStorageSnapshot(leg) { return persistModule.buildLegStorageSnapshot.call(this, leg); }

    buildDatabasePayload() { return persistModule.buildDatabasePayload.call(this); }

    buildMCPContext() { return mcpModule.buildMCPContext.call(this); }

    buildMCPTrade(trade, options = {}) { return mcpModule.buildMCPTrade.call(this, trade, options); }

    buildMCPAssignment(a) { return mcpModule.buildMCPAssignment.call(this, a); }

    async saveWithFileSystemAPI(data) { return persistModule.saveWithFileSystemAPI.call(this, data); }

    saveWithDownload(data) { return persistModule.saveWithDownload.call(this, data); }

    async loadDatabase() { return persistModule.loadDatabase.call(this); }

    async loadWithFileSystemAPI() { return persistModule.loadWithFileSystemAPI.call(this); }

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
    approveImportReviewTrade(id: string) { return importControlsModule.approveImportReviewTrade.call(this, id); }
    discardImportReviewTrade(id: string) { return importControlsModule.discardImportReviewTrade.call(this, id); }
    approveSelectedImportTrades() { return importControlsModule.approveSelectedImportTrades.call(this); }
    discardSelectedImportTrades() { return importControlsModule.discardSelectedImportTrades.call(this); }

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

    async handleOfxFileSelection(event) { return importControlsModule.handleOfxFileSelection.call(this, event); }

    async importOfxFile(file, context = {}) { return importControlsModule.importOfxFile.call(this, file, context); }

    async importOfxContent(raw: string, context: Record<string, unknown> = {}) { return importControlsModule.importOfxContent.call(this, raw, context); }

    handleRobinhoodCsvFileSelection(event) { return importRobinhoodModule.handleRobinhoodCsvFileSelection.call(this, event); }

    async importRobinhoodCsvFile(file, context = {}) { return importControlsModule.importRobinhoodCsvFile.call(this, file, context); }

    async importRobinhoodCsvContent(raw: string, context: Record<string, unknown> = {}) { return importControlsModule.importRobinhoodCsvContent.call(this, raw, context); }

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

    async loadFromStorage() { return persistModule.loadFromStorage.call(this); }

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
    // event.error is null for resource-load failures (img/script 404s, CORS blocks)
    // — those are non-fatal; suppress them to avoid console noise.
    if (event.error !== null && event.error !== undefined) {
        console.error('Global error caught:', event.error);
    }
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
