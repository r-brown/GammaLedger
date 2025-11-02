const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_ALLOWED_MODELS = [
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash',
    'gemini-2.5-pro'
];
const DEFAULT_GEMINI_TEMPERATURE = 0.25;
const DEFAULT_GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_STORAGE_KEY = 'GammaLedgerGeminiConfig';
const GEMINI_SECRET_STORAGE_KEY = 'GammaLedgerGeminiSecret';
const DISCLAIMER_STORAGE_KEY = 'GammaLedgerDisclaimerAcceptedAt';
const AI_COACH_CONSENT_STORAGE_KEY = 'GammaLedgerAICoachConsentAt';
const SIDEBAR_COLLAPSED_STORAGE_KEY = 'GammaLedgerSidebarCollapsed';
const LOCAL_STORAGE_KEY = 'GammaLedgerLocalDatabase';
const LEGACY_STORAGE_KEY = 'GammaLedgerTrades';
const LEGACY_STORAGE_KEYS = [
    LEGACY_STORAGE_KEY,
    'GammaLedgerDatabase',
    'GammaLedgerLocalState',
    'GammaLedgerState'
];

const RUNTIME_TRADE_FIELDS = new Set([
    'legsCount',
    'openContracts',
    'closeContracts',
    'openLegs',
    'rollLegs',
    'totalFees',
    'totalDebit',
    'totalCredit',
    'cashFlow',
    'capitalAtRisk',
    'fees',
    'primaryLeg',
    'tradeType',
    'tradeDirection',
    'quantity',
    'strikePrice',
    'multiplier',
    'displayStrike',
    'activeStrikePrice',
    'entryPrice',
    'exitPrice',
    'pmccShortExpiration',
    'longExpirationDate',
    'entryDate',
    'exitDate',
    'pl',
    'roi',
    'maxRisk',
    'maxRiskLabel',
    'riskIsUnlimited',
    'lifecycleMeta',
    'lifecycleStatus',
    'partialClose',
    'rolledForward',
    'autoExpired',
    'daysHeld',
    'dte',
    'annualizedROI',
    'tradeReasoning'
]);

const RUNTIME_LEG_FIELDS = new Set([
    'externalId',
    'importGroupId',
    'importSource',
    'importBatchId',
    'tickerSymbol'
]);

const SHARE_CARD_EXPORT_SIZE = 1080;
const SHARE_CARD_CHART_WIDTH_RATIO = 0.78;
const SHARE_CARD_CHART_HEIGHT_RATIO = 0.42;
const SHARE_CARD_CHART_MIN_HEIGHT = 320;
const CUMULATIVE_PL_RANGES = ['7D', 'MTD', '1M', 'YTD', '1Y', 'ALL'];

const BUILTIN_SAMPLE_DATA = (() => {
    const reference = new Date();
    reference.setUTCHours(0, 0, 0, 0);

    const toIso = (date) => date.toISOString().slice(0, 10);
    const offset = (days) => {
        const date = new Date(reference);
        date.setUTCDate(date.getUTCDate() + days);
        return toIso(date);
    };

    const trades = [
        {
            id: 'TRD-2001',
            ticker: 'SPY',
            strategy: 'Iron Condor',
            status: 'Closed',
            openedDate: offset(-60),
            closedDate: offset(-32),
            expirationDate: offset(-28),
            exitReason: 'Closed early for 70% max profit.',
            notes: 'Monthly condor sized at 3% of capital with 12-delta wings.',
            legs: [
                {
                    id: 'TRD-2001-L1',
                    orderType: 'STO',
                    type: 'CALL',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-60),
                    expirationDate: offset(-28),
                    strike: 455,
                    premium: 1.2,
                    fees: 0.35,
                    underlyingPrice: 450.6
                },
                {
                    id: 'TRD-2001-L2',
                    orderType: 'BTO',
                    type: 'CALL',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-60),
                    expirationDate: offset(-28),
                    strike: 460,
                    premium: 0.45,
                    fees: 0.2
                },
                {
                    id: 'TRD-2001-L3',
                    orderType: 'STO',
                    type: 'PUT',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-60),
                    expirationDate: offset(-28),
                    strike: 430,
                    premium: 1.35,
                    fees: 0.35
                },
                {
                    id: 'TRD-2001-L4',
                    orderType: 'BTO',
                    type: 'PUT',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-60),
                    expirationDate: offset(-28),
                    strike: 425,
                    premium: 0.5,
                    fees: 0.2
                },
                {
                    id: 'TRD-2001-L5',
                    orderType: 'BTC',
                    type: 'CALL',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-32),
                    expirationDate: offset(-28),
                    strike: 455,
                    premium: 0.35,
                    fees: 0.35
                },
                {
                    id: 'TRD-2001-L6',
                    orderType: 'STC',
                    type: 'CALL',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-32),
                    expirationDate: offset(-28),
                    strike: 460,
                    premium: 0.15,
                    fees: 0.2
                },
                {
                    id: 'TRD-2001-L7',
                    orderType: 'BTC',
                    type: 'PUT',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-32),
                    expirationDate: offset(-28),
                    strike: 430,
                    premium: 0.45,
                    fees: 0.35
                },
                {
                    id: 'TRD-2001-L8',
                    orderType: 'STC',
                    type: 'PUT',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-32),
                    expirationDate: offset(-28),
                    strike: 425,
                    premium: 0.18,
                    fees: 0.2
                }
            ]
        },
        {
            id: 'TRD-2002',
            ticker: 'F',
            strategy: 'Wheel',
            status: 'Open',
            openedDate: offset(-45),
            closedDate: '',
            expirationDate: offset(21),
            exitReason: '',
            notes: 'Experimenting with the wheel using 100 shares of Ford.',
            legs: [
                {
                    id: 'TRD-2002-L1',
                    orderType: 'STO',
                    type: 'PUT',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-45),
                    expirationDate: offset(-21),
                    strike: 12,
                    premium: 0.55,
                    fees: 0.15
                },
                {
                    id: 'TRD-2002-L2',
                    orderType: 'BTC',
                    type: 'PUT',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-21),
                    expirationDate: offset(-21),
                    strike: 12,
                    premium: 0.05,
                    fees: 0.15
                },
                {
                    id: 'TRD-2002-L3',
                    orderType: 'STO',
                    type: 'CALL',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-14),
                    expirationDate: offset(21),
                    strike: 13.5,
                    premium: 0.42,
                    fees: 0.15
                }
            ]
        }
    ];

    return {
        trades,
        exportDate: reference.toISOString(),
        version: '3.1'
    };
})();

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
            maxRequestsPerMinute: 60,
            timestamps: [],
            statusTimeoutId: null,
            lastStatus: null,
            elements: {}
        };

        this.gemini = {
            apiKey: '',
            encryptionKey: null,
            model: DEFAULT_GEMINI_MODEL,
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

        // Current date for calculations (always use actual current date)
        this.currentDate = new Date(); // Current date

        this.init();
    }

    async init() {
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
    }

        computeAutoRefreshInterval() {
            const limit = Number(this.finnhub?.maxRequestsPerMinute) || 60;
            const safeLimit = Math.min(Math.max(limit - 2, 1), 60);
            return Math.max(800, Math.ceil(120_000 / safeLimit));
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

    // --- Leg helpers ----------------------------------------------------

    normalizeLegOrderType(orderType) {
        const value = (orderType || '').toString().trim().toUpperCase();
        if (['BTO', 'STO', 'BTC', 'STC'].includes(value)) {
            return value;
        }
        const normalized = value
            .replace('BUY TO OPEN', 'BTO')
            .replace('SELL TO OPEN', 'STO')
            .replace('BUY TO CLOSE', 'BTC')
            .replace('SELL TO CLOSE', 'STC');
        if (['BTO', 'STO', 'BTC', 'STC'].includes(normalized)) {
            return normalized;
        }
        if (value.startsWith('B')) {
            return value.includes('C') ? 'BTC' : 'BTO';
        }
        if (value.startsWith('S')) {
            return value.includes('C') ? 'STC' : 'STO';
        }
        return 'BTO';
    }

    mapOrderTypeToActionSide(orderType) {
        switch (this.normalizeLegOrderType(orderType)) {
            case 'BTO':
                return { action: 'BUY', side: 'OPEN' };
            case 'STO':
                return { action: 'SELL', side: 'OPEN' };
            case 'BTC':
                return { action: 'BUY', side: 'CLOSE' };
            case 'STC':
                return { action: 'SELL', side: 'CLOSE' };
            default:
                return { action: 'BUY', side: 'OPEN' };
        }
    }

    getLegOrderDescriptor(leg = {}) {
        const normalizedOrderType = this.normalizeLegOrderType(leg?.orderType || leg?.order || leg?.tradeType);
        if (normalizedOrderType) {
            return this.mapOrderTypeToActionSide(normalizedOrderType);
        }

        const normalizedAction = this.normalizeLegAction(leg?.action);
        const normalizedSide = this.normalizeLegSide(leg?.side);
        if (normalizedAction || normalizedSide) {
            return this.mapOrderTypeToActionSide(
                this.deriveOrderTypeFromActionSide(normalizedAction || 'BUY', normalizedSide || 'OPEN')
            );
        }

        return { action: 'BUY', side: 'OPEN' };
    }

    getLegAction(leg = {}) {
        return this.getLegOrderDescriptor(leg).action;
    }

    getLegSide(leg = {}) {
        return this.getLegOrderDescriptor(leg).side;
    }

    deriveOrderTypeFromActionSide(action, side) {
        const normalizedAction = this.normalizeLegAction(action);
        const normalizedSide = this.normalizeLegSide(side);
        if (normalizedSide === 'ROLL') {
            return normalizedAction === 'SELL' ? 'STO' : 'BTO';
        }
        if (normalizedAction === 'BUY' && normalizedSide === 'OPEN') {
            return 'BTO';
        }
        if (normalizedAction === 'SELL' && normalizedSide === 'OPEN') {
            return 'STO';
        }
        if (normalizedAction === 'BUY' && normalizedSide === 'CLOSE') {
            return 'BTC';
        }
        if (normalizedAction === 'SELL' && normalizedSide === 'CLOSE') {
            return 'STC';
        }
        return 'BTO';
    }

    normalizeLegAction(action) {
        const value = (action || '').toString().trim().toUpperCase();
        if (['SELL', 'SHORT', 'STO', 'STC'].includes(value)) {
            return 'SELL';
        }
        return 'BUY';
    }

    normalizeLegSide(side) {
        const value = (side || '').toString().trim().toUpperCase();
        if (value.startsWith('ROL')) {
            return 'ROLL';
        }
        if (["CALL", "PUT", "STOCK"].includes(value)) {
            return 'CLOSE';
        }
        if (['CASH', 'FUTURE', 'ETF', 'SHARES', 'STK'].includes(value)) {
            return 'STOCK';
        }
        if (['BTO', 'STO'].includes(value)) {
            return 'OPEN';
        }
        if (['BTC', 'STC'].includes(value)) {
            return 'CLOSE';
        }
        return 'OPEN';
    }

    normalizeLegType(type) {
        const value = (type || '').toString().trim().toUpperCase();
        if (['CALL', 'PUT', 'STOCK', 'CASH', 'FUTURE', 'ETF'].includes(value)) {
            return value;
        }
        if (value === 'SHARES') {
            return 'STOCK';
        }
        return value || 'UNKNOWN';
    }

    getLegMultiplier(leg) {
        const provided = Number(leg?.multiplier);
        if (Number.isFinite(provided) && provided > 0) {
            return provided;
        }
        const type = this.normalizeLegType(leg?.type);
        if (type === 'STOCK' || type === 'CASH') {
            return 1;
        }
        const underlyingType = this.normalizeUnderlyingType(leg?.underlyingType, { fallback: 'Stock' });
        return this.getDefaultMultiplierForLegType(type, underlyingType);
    }

    normalizeLeg(leg, index = 0) {
        const quantityRaw = Number(leg?.quantity);
        const normalizedQuantity = Number.isFinite(quantityRaw) ? quantityRaw : 0;

        const executionDate = leg?.executionDate ? new Date(leg.executionDate) : null;
        const executionDateIso = executionDate && !Number.isNaN(executionDate.getTime())
            ? executionDate.toISOString().slice(0, 10)
            : '';

        const expirationDate = leg?.expirationDate ? new Date(leg.expirationDate) : null;
        const expirationDateIso = expirationDate && !Number.isNaN(expirationDate.getTime())
            ? expirationDate.toISOString().slice(0, 10)
            : '';

        const inferredOrderType = this.normalizeLegOrderType(
            leg?.orderType ||
            leg?.tradeType ||
            leg?.order ||
            this.deriveOrderTypeFromActionSide(leg?.action, leg?.side)
        );
        const externalIdValue = leg?.externalId;
        const importGroupIdValue = leg?.importGroupId;
        const importSourceValue = leg?.importSource;

        return {
            id: leg?.id || `LEG-${Date.now()}-${index}`,
            orderType: inferredOrderType,
            type: this.normalizeLegType(leg?.type),
            quantity: normalizedQuantity,
            multiplier: this.getLegMultiplier(leg),
            executionDate: executionDateIso,
            expirationDate: expirationDateIso,
            strike: Number.isFinite(Number(leg?.strike)) ? Number(leg.strike) : null,
            premium: Number.isFinite(Number(leg?.premium)) ? Number(leg.premium) : 0,
            fees: Number.isFinite(Number(leg?.fees)) ? Number(leg.fees) : 0,
            underlyingPrice: Number.isFinite(Number(leg?.underlyingPrice)) ? Number(leg.underlyingPrice) : null,
            underlyingType: this.normalizeUnderlyingType(leg?.underlyingType, { fallback: 'Stock' }),
            externalId: externalIdValue === undefined || externalIdValue === null ? null : externalIdValue.toString().trim() || null,
            importGroupId: importGroupIdValue === undefined || importGroupIdValue === null ? null : importGroupIdValue.toString().trim() || null,
            importSource: importSourceValue === undefined || importSourceValue === null ? null : importSourceValue.toString().trim() || null
        };
    }

    calculateLegCashFlow(leg) {
        if (!leg) {
            return 0;
        }
        const quantity = Math.abs(Number(leg.quantity) || 0);
        if (!quantity) {
            return -(Number(leg.fees) || 0);
        }
        const multiplier = this.getLegMultiplier(leg);
        const premium = Number(leg.premium) || 0;
        const fees = Number(leg.fees) || 0;
        const direction = this.getLegAction(leg) === 'SELL' ? 1 : -1;
        return direction * premium * multiplier * quantity - fees;
    }

    summarizeLegs(legs = []) {
        const summary = {
            legs: [],
            legsCount: 0,
            openLegs: 0,
            closeLegs: 0,
            rollLegs: 0,
            totalFees: 0,
            totalDebit: 0,
            totalCredit: 0,
            cashFlow: 0,
            openCashFlow: 0,
            closeCashFlow: 0,
            openedDate: null,
            closedDate: null,
            earliestExpiration: null,
            latestExpiration: null,
            primaryLeg: null,
            openContracts: 0,
            closeContracts: 0,
            capitalAtRisk: 0,
            entryPrice: null,
            exitPrice: null,
            openCreditGross: 0,
            openDebitGross: 0,
            openFees: 0,
            openBaseContracts: 0,
            verticalSpread: null,
            nearestShortCallExpiration: null,
            nextShortCallExpiration: null
        };

        if (!Array.isArray(legs) || legs.length === 0) {
            return summary;
        }

        const normalizedLegs = legs.map((leg, index) => this.normalizeLeg(leg, index));
        summary.legs = normalizedLegs;
        summary.legsCount = normalizedLegs.length;
        const openOptionGroups = new Map();
        const now = this.currentDate instanceof Date ? this.currentDate : new Date();

        normalizedLegs.forEach((leg, index) => {
            const originalLeg = Array.isArray(legs) ? legs[index] : null;
            const derivedAction = this.getLegAction(leg);
            const derivedSide = this.getLegSide(leg);
            const originalAction = this.normalizeLegAction(originalLeg?.action);
            const originalSide = this.normalizeLegSide(originalLeg?.side);
            const action = derivedAction || originalAction;
            const side = originalSide === 'ROLL' ? 'ROLL' : derivedSide;
            const cashFlow = this.calculateLegCashFlow(leg);
            summary.cashFlow += cashFlow;
            summary.totalFees += Number(leg.fees) || 0;

            const quantity = Math.abs(Number(leg.quantity) || 0);
            if (quantity) {
                if (side === 'OPEN') {
                    summary.openLegs += 1;
                    summary.openContracts += quantity;
                    summary.openCashFlow += cashFlow;

                    const multiplier = this.getLegMultiplier(leg) || 1;
                    const grossPremium = Math.abs(Number(leg.premium) || 0) * multiplier * quantity;
                    if (action === 'SELL') {
                        summary.openCreditGross += grossPremium;
                    } else {
                        summary.openDebitGross += grossPremium;
                    }
                    summary.openFees += Number(leg.fees) || 0;
                    if (quantity > summary.openBaseContracts) {
                        summary.openBaseContracts = quantity;
                    }

                    if (['CALL', 'PUT'].includes(leg.type) && Number.isFinite(Number(leg.strike))) {
                        const key = `${leg.type}|${leg.expirationDate || ''}`;
                        if (!openOptionGroups.has(key)) {
                            openOptionGroups.set(key, []);
                        }
                        openOptionGroups.get(key).push({ leg, action, side });
                    }
                } else if (side === 'CLOSE') {
                    summary.closeLegs += 1;
                    summary.closeContracts += quantity;
                    summary.closeCashFlow += cashFlow;
                } else if (side === 'ROLL') {
                    summary.rollLegs += 1;
                }
            }

            if (action === 'BUY') {
                summary.totalDebit += Math.abs(cashFlow + (Number(leg.fees) || 0));
            } else {
                summary.totalCredit += Math.abs(cashFlow + (Number(leg.fees) || 0));
            }

            if (leg.executionDate) {
                const exec = new Date(leg.executionDate);
                if (!Number.isNaN(exec.getTime())) {
                    if (!summary.openedDate || exec < summary.openedDate) {
                        summary.openedDate = exec;
                    }
                    if (!summary.closedDate || exec > summary.closedDate) {
                        summary.closedDate = exec;
                    }
                }
            }

            if (leg.expirationDate) {
                const exp = new Date(leg.expirationDate);
                if (!Number.isNaN(exp.getTime())) {
                    if (!summary.earliestExpiration || exp < summary.earliestExpiration) {
                        summary.earliestExpiration = exp;
                    }
                    if (!summary.latestExpiration || exp > summary.latestExpiration) {
                        summary.latestExpiration = exp;
                    }
                    if (side === 'OPEN' && action === 'SELL' && leg.type === 'CALL') {
                        if (!summary.nearestShortCallExpiration || exp < summary.nearestShortCallExpiration) {
                            summary.nearestShortCallExpiration = exp;
                        }
                        if (exp >= now) {
                            if (!summary.nextShortCallExpiration || exp < summary.nextShortCallExpiration) {
                                summary.nextShortCallExpiration = exp;
                            }
                        }
                    }
                }
            }

            if (!summary.primaryLeg && side !== 'CLOSE') {
                summary.primaryLeg = leg;
            }
        });

        if (!summary.primaryLeg) {
            summary.primaryLeg = normalizedLegs[0];
        }

        // Aggregate opening-leg cash flows and gross premium components
        // Attempt to detect a vertical spread for precise risk math
        let verticalSpreadInfo = null;
        for (const legsGroup of openOptionGroups.values()) {
            if (!Array.isArray(legsGroup) || legsGroup.length < 2) {
                continue;
            }
            const hasBuy = legsGroup.some(({ action }) => action === 'BUY');
            const hasSell = legsGroup.some(({ action }) => action === 'SELL');
            if (!hasBuy || !hasSell) {
                continue;
            }
            const strikes = legsGroup
                .map(({ leg }) => Number(leg.strike))
                .filter(Number.isFinite);
            if (strikes.length < 2) {
                continue;
            }
            const spreadWidth = Math.abs(Math.max(...strikes) - Math.min(...strikes));
            if (!(spreadWidth > 0)) {
                continue;
            }
            const multiplier = this.getLegMultiplier(legsGroup[0]?.leg) || 1;
            const contractCounts = legsGroup
                .map(({ leg }) => Math.abs(Number(leg.quantity) || 0))
                .filter(value => value > 0);
            const contracts = contractCounts.length
                ? Math.min(...contractCounts)
                : (summary.openBaseContracts || 1);
            verticalSpreadInfo = {
                width: spreadWidth,
                multiplier,
                contracts: contracts || 1
            };
            break;
        }
        summary.verticalSpread = verticalSpreadInfo;

        // Derive entry and exit price approximations (per contract, option-style)
        const primaryMultiplier = this.getLegMultiplier(summary.primaryLeg) || 1;
        const contractsForEntryRaw = summary.openContracts || Math.abs(Number(summary.primaryLeg?.quantity) || 0);
        const fallbackContracts = contractsForEntryRaw || 1;
        const effectiveContractsForEntry = verticalSpreadInfo?.contracts || summary.openBaseContracts || fallbackContracts;
        const contractsForExit = summary.closeContracts || 0;

        const openEntryCash = Number(summary.openCashFlow);
        if (Number.isFinite(openEntryCash) && effectiveContractsForEntry > 0 && primaryMultiplier > 0) {
            summary.entryPrice = Math.abs(openEntryCash) / (effectiveContractsForEntry * primaryMultiplier);
        } else if (fallbackContracts > 0 && primaryMultiplier > 0) {
            summary.entryPrice = Math.abs(summary.openCashFlow) / (fallbackContracts * primaryMultiplier);
        }

        if (contractsForExit > 0) {
            summary.exitPrice = Math.abs(summary.closeCashFlow) / (contractsForExit * primaryMultiplier);
        }

        summary.capitalAtRisk = this.computeMaxRiskUsingFormula({ legs: normalizedLegs }, summary);

        return summary;
    }

    buildRiskFormulaContext(trade = {}, details = null) {
        const summary = details || this.summarizeLegs(trade?.legs || []);
        if (!summary) {
            return null;
        }

        let referenceStrike = Number(trade?.strikePrice);
        if (!(Number.isFinite(referenceStrike) && referenceStrike > 0)) {
            const activeStrike = Number(trade?.activeStrikePrice);
            if (Number.isFinite(activeStrike) && activeStrike > 0) {
                referenceStrike = activeStrike;
            }
        }
        if (!(Number.isFinite(referenceStrike) && referenceStrike > 0)) {
            const primaryStrike = Number(summary?.primaryLeg?.strike);
            if (Number.isFinite(primaryStrike) && primaryStrike > 0) {
                referenceStrike = primaryStrike;
            } else {
                const derivedStrike = this.derivePrimaryStrike(summary);
                if (Number.isFinite(derivedStrike) && derivedStrike > 0) {
                    referenceStrike = derivedStrike;
                }
            }
        }

        let contracts = Math.abs(Number(trade?.quantity)) || 0;
        if (!(contracts > 0)) {
            const summaryContracts = Number(summary?.openBaseContracts);
            if (Number.isFinite(summaryContracts) && summaryContracts > 0) {
                contracts = summaryContracts;
            }
        }
        if (!(contracts > 0)) {
            const primaryQuantity = Number(summary?.primaryLeg?.quantity);
            if (Number.isFinite(primaryQuantity) && primaryQuantity !== 0) {
                contracts = Math.abs(primaryQuantity);
            }
        }
        if (!(contracts > 0)) {
            return null;
        }

        let multiplier = Math.abs(Number(trade?.multiplier)) || 0;
        if (!(multiplier > 0) && summary?.primaryLeg) {
            const primaryMultiplier = this.getLegMultiplier(summary.primaryLeg);
            if (Number.isFinite(primaryMultiplier) && primaryMultiplier > 0) {
                multiplier = primaryMultiplier;
            }
        }
        if (!(multiplier > 0) && Array.isArray(summary?.legs)) {
            const legWithMultiplier = summary.legs.find((leg) => Number.isFinite(Number(leg?.multiplier)) && Number(leg.multiplier) > 0);
            if (legWithMultiplier) {
                multiplier = Math.abs(Number(this.getLegMultiplier(legWithMultiplier)));
            }
        }
        if (!(multiplier > 0)) {
            multiplier = 100;
        }

        const contractValue = contracts * multiplier;
        if (!(contractValue > 0)) {
            return null;
        }

        const creditDollars = Number(summary?.openCreditGross) || 0;
        const debitDollars = Number(summary?.openDebitGross) || 0;
        const feesDollars = Number(summary?.openFees) || 0;

        const premiumReceivedPerShare = contractValue > 0 ? creditDollars / contractValue : 0;
        const premiumPaidPerShare = contractValue > 0 ? debitDollars / contractValue : 0;
        const netPremiumPerShare = premiumReceivedPerShare - premiumPaidPerShare;
        const netCreditPerShare = Math.max(netPremiumPerShare, 0);
        const netDebitPerShare = Math.max(-netPremiumPerShare, 0);
        const totalFeesPerShare = contractValue > 0 ? feesDollars / contractValue : 0;

        const openLegs = Array.isArray(summary?.legs)
            ? summary.legs.filter((leg) => leg && this.getLegSide(leg) === 'OPEN')
            : [];
        const optionLegs = openLegs.filter((leg) => ['CALL', 'PUT'].includes(leg.type) && Number.isFinite(Number(leg.strike)));

        const strikeValues = optionLegs
            .map((leg) => Number(leg.strike))
            .filter((value) => Number.isFinite(value));
        const uniqueStrikes = Array.from(new Set(strikeValues)).sort((a, b) => a - b);
        const K1 = uniqueStrikes[0] ?? null;
        const K2 = uniqueStrikes[1] ?? null;
        const K3 = uniqueStrikes[2] ?? null;
        const K4 = uniqueStrikes[3] ?? null;

        const strikeDiffs = [];
        for (let i = 1; i < uniqueStrikes.length; i += 1) {
            const diff = uniqueStrikes[i] - uniqueStrikes[i - 1];
            if (Number.isFinite(diff) && diff > 0) {
                strikeDiffs.push(diff);
            }
        }
        const minStrikeDiff = strikeDiffs.length ? Math.min(...strikeDiffs) : null;
        const maxStrikeDiff = strikeDiffs.length ? Math.max(...strikeDiffs) : null;

        const selectStrikes = (predicate) => optionLegs
            .filter(predicate)
            .map((leg) => Number(leg.strike))
            .filter((value) => Number.isFinite(value))
            .sort((a, b) => a - b);

        const shortCalls = selectStrikes((leg) => leg.type === 'CALL' && this.getLegAction(leg) === 'SELL');
        const longCalls = selectStrikes((leg) => leg.type === 'CALL' && this.getLegAction(leg) === 'BUY');
        const shortPuts = selectStrikes((leg) => leg.type === 'PUT' && this.getLegAction(leg) === 'SELL');
        const longPuts = selectStrikes((leg) => leg.type === 'PUT' && this.getLegAction(leg) === 'BUY');

        const shortCallStrike = shortCalls.length ? shortCalls[0] : null;
        const shortCallStrikeHigh = shortCalls.length ? shortCalls[shortCalls.length - 1] : null;
        const longCallStrikeLow = longCalls.length ? longCalls[0] : null;
        const longCallStrike = longCalls.length ? longCalls[longCalls.length - 1] : null;
        const shortPutStrikeLow = shortPuts.length ? shortPuts[0] : null;
        const shortPutStrike = shortPuts.length ? shortPuts[shortPuts.length - 1] : null;
        const longPutStrikeLow = longPuts.length ? longPuts[0] : null;
        const longPutStrike = longPuts.length ? longPuts[longPuts.length - 1] : null;

        const lowerWidth = Number.isFinite(K1) && Number.isFinite(K2) ? Math.max(K2 - K1, 0) : null;
        const middleWidth = Number.isFinite(K2) && Number.isFinite(K3) ? Math.max(K3 - K2, 0) : null;
        const upperWidth = Number.isFinite(K3) && Number.isFinite(K4) ? Math.max(K4 - K3, 0) : null;
        const maxWingWidth = Math.max(
            Number.isFinite(lowerWidth) ? lowerWidth : 0,
            Number.isFinite(upperWidth) ? upperWidth : 0
        ) || null;
        const defaultWidth = Number.isFinite(maxWingWidth) && maxWingWidth > 0
            ? maxWingWidth
            : Number.isFinite(middleWidth) && middleWidth > 0
                ? middleWidth
                : Number.isFinite(minStrikeDiff) && minStrikeDiff > 0
                    ? minStrikeDiff
                    : null;

        const stockLegs = openLegs.filter((leg) => leg.type === 'STOCK');

        const underlyingCandidates = [];
        const addCandidate = (value) => {
            const numeric = Number(value);
            if (Number.isFinite(numeric) && numeric > 0) {
                underlyingCandidates.push(numeric);
            }
        };

        addCandidate(trade?.entryUnderlyingPrice);
        addCandidate(trade?.underlyingEntryPrice);
        addCandidate(trade?.underlyingPrice);
        addCandidate(trade?.underlyingPriceAtEntry);
        openLegs.forEach((leg) => addCandidate(leg?.underlyingPrice));

        if (!underlyingCandidates.length && stockLegs.length) {
            stockLegs
                .map((leg) => Number(leg?.premium))
                .filter((value) => Number.isFinite(value) && value > 0)
                .forEach((value) => underlyingCandidates.push(value));
        }

        let S = null;
        if (underlyingCandidates.length) {
            const total = underlyingCandidates.reduce((sum, value) => sum + value, 0);
            const average = total / underlyingCandidates.length;
            if (Number.isFinite(average) && average > 0) {
                S = average;
            }
        }

        const effectiveStrike = Number.isFinite(referenceStrike) && referenceStrike > 0
            ? referenceStrike
            : (shortCallStrike ?? shortPutStrike ?? K1 ?? null);

        const toNotional = (perShare) => {
            if (perShare === null || perShare === undefined) {
                return undefined;
            }
            if (perShare === Number.POSITIVE_INFINITY) {
                return Number.POSITIVE_INFINITY;
            }
            const numeric = Number(perShare);
            if (!Number.isFinite(numeric)) {
                return undefined;
            }
            const normalized = Math.max(numeric, 0);
            return normalized * contractValue;
        };

        const verticalSpreadWidth = Number.isFinite(summary?.verticalSpread?.width) && summary.verticalSpread.width > 0
            ? summary.verticalSpread.width
            : null;

        return {
            trade,
            details: summary,
            referenceStrike: effectiveStrike,
            contracts,
            multiplier,
            contractValue,
            netPremium: netPremiumPerShare,
            netCredit: netCreditPerShare,
            netDebit: netDebitPerShare,
            premiumPaid: premiumPaidPerShare,
            premiumReceived: premiumReceivedPerShare,
            totalFeesPerShare,
            strikes: uniqueStrikes,
            K: effectiveStrike,
            K1,
            K2,
            K3,
            K4,
            lowerWidth,
            middleWidth,
            upperWidth,
            minStrikeDiff,
            maxStrikeDiff,
            maxWingWidth,
            defaultWidth,
            shortCallStrike,
            shortCallStrikeHigh,
            longCallStrike,
            longCallStrikeLow,
            shortPutStrike,
            shortPutStrikeLow,
            longPutStrike,
            longPutStrikeLow,
            verticalSpreadWidth,
            S,
            hasStockExposure: stockLegs.length > 0,
            toNotional,
            contractCount: contracts,
            multiplierValue: multiplier
        };
    }

    computeDefaultMaxRisk(context) {
        if (!context || !(context.contractValue > 0)) {
            return 0;
        }

        const netDebitPerShare = Number(context.netDebit);
        if (Number.isFinite(netDebitPerShare) && netDebitPerShare > 0) {
            const value = context.toNotional(netDebitPerShare);
            return Number.isFinite(value) ? value : 0;
        }

        return 0;
    }

    getStrategyRiskHandlers() {
        if (!this.strategyRiskHandlersCache) {
            const width = (lower, upper) => {
                if (!Number.isFinite(lower) || !Number.isFinite(upper)) {
                    return null;
                }
                return Math.max(upper - lower, 0);
            };
            const pickStrike = (...values) => {
                for (const value of values) {
                    const numeric = Number(value);
                    if (Number.isFinite(numeric) && numeric > 0) {
                        return numeric;
                    }
                }
                return null;
            };
            const handlers = {};

            const register = (name, fn) => {
                if (name) {
                    handlers[name] = fn;
                }
                return fn;
            };

            const debitRisk = (ctx) => {
                const debit = Number(ctx.netDebit);
                if (Number.isFinite(debit) && debit > 0) {
                    return ctx.toNotional(debit);
                }
                const paid = Number(ctx.premiumPaid);
                if (Number.isFinite(paid) && paid > 0) {
                    return ctx.toNotional(paid);
                }
                return undefined;
            };
            const spreadWidthRisk = (ctx, diff) => {
                const widthValue = Number.isFinite(ctx.verticalSpreadWidth) && ctx.verticalSpreadWidth > 0
                    ? ctx.verticalSpreadWidth
                    : diff;
                if (!Number.isFinite(widthValue) || widthValue <= 0) {
                    return undefined;
                }
                if (ctx.netCredit > 0) {
                    return ctx.toNotional(widthValue - ctx.netCredit);
                }
                if (ctx.netDebit > 0) {
                    return ctx.toNotional(widthValue + ctx.netDebit);
                }
                return ctx.toNotional(widthValue);
            };
            const creditWidthRisk = (ctx, lower, upper) => {
                const diff = width(lower, upper);
                if (diff === null) {
                    return undefined;
                }
                return spreadWidthRisk(ctx, diff);
            };
            const widthMinusDebit = (ctx, lower, upper) => {
                const diff = width(lower, upper);
                if (diff === null) {
                    return undefined;
                }
                return ctx.toNotional(diff - ctx.netDebit);
            };
            const condorWidthRisk = (ctx) => {
                const diff = Number.isFinite(ctx.defaultWidth) && ctx.defaultWidth > 0
                    ? ctx.defaultWidth
                    : width(ctx.K1, ctx.K2);
                if (!Number.isFinite(diff) || diff <= 0) {
                    return undefined;
                }
                return spreadWidthRisk(ctx, diff);
            };

            register('Bear Call Ladder', (ctx) => creditWidthRisk(ctx, ctx.K1, ctx.K2));
            register('Bear Call Spread', (ctx) => creditWidthRisk(ctx, ctx.K1, ctx.K2));
            register('Bear Put Ladder', (ctx) => {
                const ladderWidth = width(ctx.K2, ctx.K3);
                if (ladderWidth === null) {
                    return undefined;
                }
                return ctx.toNotional(ctx.netDebit - ladderWidth);
            });
            register('Bear Put Spread', (ctx) => debitRisk(ctx));
            register('Box Spread', (ctx) => creditWidthRisk(ctx, ctx.K1, ctx.K2));
            register('Bull Call Ladder', (ctx) => {
                const ladderWidth = width(ctx.K1, ctx.K2);
                if (ladderWidth === null) {
                    return undefined;
                }
                return ctx.toNotional(ctx.netDebit + ladderWidth);
            });
            register('Bull Call Spread', (ctx) => debitRisk(ctx));
            register('Bull Put Ladder', (ctx) => creditWidthRisk(ctx, ctx.K1, ctx.K2));
            register('Bull Put Spread', (ctx) => creditWidthRisk(ctx, ctx.K1, ctx.K2));
            register('Calendar Call Spread', debitRisk);
            register('Calendar Put Spread', debitRisk);
            register('Calendar Straddle', debitRisk);
            register('Calendar Strangle', debitRisk);
            register('Call Broken Wing', (ctx) => creditWidthRisk(ctx, ctx.K1, ctx.K2));
            register('Call Ratio Backspread', (ctx) => creditWidthRisk(ctx, ctx.K1, ctx.K2));
            register('Call Ratio Spread', (ctx) => creditWidthRisk(ctx, ctx.K1, ctx.K2));
            register('Cash-Secured Put', (ctx) => {
                const strike = pickStrike(ctx.shortPutStrike, ctx.shortPutStrikeLow, ctx.K, ctx.K1);
                if (!Number.isFinite(strike)) {
                    return undefined;
                }
                return ctx.toNotional(strike - ctx.netCredit);
            });
            register('Collar', (ctx) => {
                const underlying = pickStrike(ctx.S, ctx.referenceStrike);
                const putStrike = pickStrike(ctx.longPutStrike, ctx.shortPutStrike, ctx.K1);
                if (underlying === null || putStrike === null) {
                    return undefined;
                }
                return ctx.toNotional(underlying - putStrike - ctx.netCredit);
            });
            register('Covered Call', (ctx) => {
                const underlying = pickStrike(ctx.S, ctx.referenceStrike);
                if (underlying === null) {
                    return undefined;
                }
                return ctx.toNotional(underlying - ctx.netCredit);
            });
            register('Covered Put', () => Number.POSITIVE_INFINITY);
            register('Covered Short Straddle', () => Number.POSITIVE_INFINITY);
            register('Covered Short Strangle', () => Number.POSITIVE_INFINITY);
            register('Diagonal Call Spread', debitRisk);
            register('Diagonal Put Spread', debitRisk);
            register('Double Diagonal', debitRisk);
            register('Guts', debitRisk);
            register('Inverse Call Broken Wing', (ctx) => widthMinusDebit(ctx, ctx.K2, ctx.K3));
            register('Inverse Iron Butterfly', (ctx) => {
                const spreadWidth = width(ctx.K1, ctx.K2);
                if (spreadWidth === null) {
                    return undefined;
                }
                return ctx.toNotional(ctx.netDebit - spreadWidth);
            });
            register('Inverse Iron Condor', debitRisk);
            register('Inverse Put Broken Wing', (ctx) => widthMinusDebit(ctx, ctx.K1, ctx.K2));
            register('Iron Albatross', condorWidthRisk);
            register('Iron Butterfly', (ctx) => creditWidthRisk(ctx, ctx.K1, ctx.K2));
            register('Iron Condor', condorWidthRisk);
            register('Jade Lizard', (ctx) => {
                const callStrike = pickStrike(ctx.shortCallStrike, ctx.shortCallStrikeHigh, ctx.K2, ctx.K3);
                if (!Number.isFinite(callStrike)) {
                    return undefined;
                }
                return ctx.toNotional(callStrike - ctx.netCredit);
            });
            register('Long Call', debitRisk);
            register('Long Call Butterfly', debitRisk);
            register('Long Call Condor', debitRisk);
            register('Long Put', debitRisk);
            register('Long Put Butterfly', debitRisk);
            register('Long Put Condor', debitRisk);
            register('Long Straddle', debitRisk);
            register('Long Strangle', debitRisk);
            register('Poor Man\'s Covered Call', debitRisk);
            register('Protective Put', (ctx) => {
                const underlying = pickStrike(ctx.S, ctx.referenceStrike);
                const putStrike = pickStrike(ctx.longPutStrike, ctx.longPutStrikeLow, ctx.K1);
                if (underlying === null || putStrike === null) {
                    return undefined;
                }
                return ctx.toNotional(underlying - putStrike + ctx.netDebit);
            });
            register('Put Broken Wing', (ctx) => creditWidthRisk(ctx, ctx.K1, ctx.K2));
            register('Put Ratio Backspread', (ctx) => creditWidthRisk(ctx, ctx.K1, ctx.K2));
            register('Put Ratio Spread', (ctx) => creditWidthRisk(ctx, ctx.K1, ctx.K2));
            register('Reverse Jade Lizard', (ctx) => {
                const putStrike = pickStrike(ctx.shortPutStrike, ctx.shortPutStrikeLow, ctx.K1);
                if (!Number.isFinite(putStrike)) {
                    return undefined;
                }
                return ctx.toNotional(putStrike - ctx.netCredit);
            });
            register('Short Call', () => Number.POSITIVE_INFINITY);
            register('Short Call Butterfly', (ctx) => creditWidthRisk(ctx, ctx.K1, ctx.K2));
            register('Short Call Condor', condorWidthRisk);
            register('Short Guts', () => Number.POSITIVE_INFINITY);
            register('Short Put', (ctx) => {
                const strike = pickStrike(ctx.shortPutStrike, ctx.shortPutStrikeLow, ctx.K, ctx.K1);
                if (!Number.isFinite(strike)) {
                    return undefined;
                }
                return ctx.toNotional(strike - ctx.netCredit);
            });
            register('Short Put Butterfly', (ctx) => creditWidthRisk(ctx, ctx.K1, ctx.K2));
            register('Short Put Condor', condorWidthRisk);
            register('Short Straddle', () => Number.POSITIVE_INFINITY);
            register('Short Strangle', () => Number.POSITIVE_INFINITY);
            register('Strap', debitRisk);
            register('Strip', debitRisk);
            register('Synthetic Long Stock', () => Number.POSITIVE_INFINITY);
            register('Synthetic Short Stock', () => Number.POSITIVE_INFINITY);
            register('Synthetic Put', () => Number.POSITIVE_INFINITY);
            register('Wheel', (ctx) => {
                const strike = pickStrike(ctx.shortPutStrike, ctx.shortPutStrikeLow, ctx.K1);
                if (!Number.isFinite(strike)) {
                    return undefined;
                }
                return ctx.toNotional(strike - ctx.netCredit);
            });

            if (handlers['Calendar Call Spread']) {
                register('Calendar Spread', handlers['Calendar Call Spread']);
            }
            if (handlers['Call Broken Wing']) {
                register('Call Broken Wing Butterfly', handlers['Call Broken Wing']);
                register('Broken Wing Butterfly', handlers['Call Broken Wing']);
            }
            if (handlers['Put Broken Wing']) {
                register('Put Broken Wing Butterfly', handlers['Put Broken Wing']);
            }
            if (handlers['Wheel']) {
                register('Wheel Strategy', handlers['Wheel']);
            }
            if (handlers['Cash-Secured Put']) {
                register('Cash Secured Put', handlers['Cash-Secured Put']);
            }
            if (handlers['Poor Man\'s Covered Call']) {
                register('Poor Mans Covered Call', handlers['Poor Man\'s Covered Call']);
            }

            this.strategyRiskHandlersCache = handlers;
        }

        return this.strategyRiskHandlersCache;
    }

    evaluateStrategyMaxRisk(strategyName, context) {
        if (!context) {
            return undefined;
        }

        const handlers = this.getStrategyRiskHandlers();
        const key = (strategyName || '').toString().trim();
        if (!key) {
            return undefined;
        }

        const handler = handlers[key];
        if (typeof handler !== 'function') {
            return undefined;
        }

        return handler(context);
    }

    computeMaxRiskUsingFormula(trade = {}, summary = null) {
        const details = summary || this.summarizeLegs(trade?.legs || []);
        if (!details) {
            return 0;
        }

        const context = this.buildRiskFormulaContext(trade, details);
        if (!context) {
            return 0;
        }

        const strategyName = this.getStrategyDisplayName(trade?.strategy || '');
        let maxRisk = strategyName
            ? this.evaluateStrategyMaxRisk(strategyName, context)
            : undefined;

        if (maxRisk === undefined) {
            maxRisk = this.computeDefaultMaxRisk(context);
        }

        if (maxRisk === Number.POSITIVE_INFINITY) {
            return Number.POSITIVE_INFINITY;
        }

        if (!Number.isFinite(maxRisk) || maxRisk <= 0) {
            return 0;
        }

        return parseFloat(maxRisk.toFixed(2));
    }

    formatStrikeValue(value) {
        const strike = Number(value);
        if (!Number.isFinite(strike)) {
            return '—';
        }
        if (Math.abs(strike) >= 1000) {
            return strike.toFixed(0);
        }
        return Number.isInteger(strike) ? strike.toString() : strike.toFixed(2).replace(/\.00$/, '');
    }

    derivePrimaryStrike(summary) {
        if (!summary || !Array.isArray(summary.legs)) {
            return null;
        }
    const openLegs = summary.legs.filter(leg => this.getLegSide(leg) === 'OPEN');
        const relevantLegs = openLegs.length ? openLegs : summary.legs;

    const shortOption = relevantLegs.find(leg => this.getLegAction(leg) === 'SELL' && Number.isFinite(Number(leg.strike)));
        if (shortOption) {
            return Number(shortOption.strike);
        }

        const anyOption = relevantLegs.find(leg => Number.isFinite(Number(leg.strike)));
        return anyOption ? Number(anyOption.strike) : null;
    }

    getActiveStrikeForDisplay(summary) {
        if (!summary || !Array.isArray(summary.legs) || summary.legs.length === 0) {
            return null;
        }

        const legsWithStrike = summary.legs.filter((leg) => Number.isFinite(Number(leg?.strike)));
        if (legsWithStrike.length === 0) {
            return null;
        }

    const openLegs = legsWithStrike.filter((leg) => this.getLegSide(leg) === 'OPEN');
        const candidates = openLegs.length ? openLegs : legsWithStrike;

        let chosenLeg = null;
        let chosenTimestamp = Number.NEGATIVE_INFINITY;
        let chosenPriority = Number.NEGATIVE_INFINITY;
        let chosenIndex = -1;

        candidates.forEach((leg, index) => {
            const executionDate = leg.executionDate ? new Date(leg.executionDate) : null;
            const timestamp = executionDate && !Number.isNaN(executionDate.getTime())
                ? executionDate.getTime()
                : Number.NEGATIVE_INFINITY;
            const actionPriority = this.getLegAction(leg) === 'SELL' ? 1 : 0;

            if (
                timestamp > chosenTimestamp ||
                (timestamp === chosenTimestamp && actionPriority > chosenPriority) ||
                (timestamp === chosenTimestamp && actionPriority === chosenPriority && index > chosenIndex)
            ) {
                chosenLeg = leg;
                chosenTimestamp = timestamp;
                chosenPriority = actionPriority;
                chosenIndex = index;
            }
        });

        return chosenLeg ? Number(chosenLeg.strike) : null;
    }

    buildStrikeDisplay(trade, summary = null) {
        const legSummary = summary || this.summarizeLegs(trade?.legs || []);
        const legs = legSummary?.legs || [];
        if (legs.length === 0) {
            return '—';
        }

    const openLegs = legs.filter(leg => this.getLegSide(leg) === 'OPEN');
        const relevantLegs = openLegs.length ? openLegs : legs;
        const optionLegs = relevantLegs.filter(leg => ['CALL', 'PUT'].includes(leg.type) && Number.isFinite(Number(leg.strike)));

        if (optionLegs.length > 0) {
            const grouped = optionLegs.reduce((acc, leg) => {
                const key = leg.type === 'CALL' ? 'C' : 'P';
                if (!acc[key]) {
                    acc[key] = new Set();
                }
                acc[key].add(Number(leg.strike));
                return acc;
            }, {});

            const segments = Object.entries(grouped)
                .map(([label, strikes]) => {
                    const sorted = Array.from(strikes).sort((a, b) => a - b);
                    return `${label}${sorted.map(strike => this.formatStrikeValue(strike)).join('/')}`;
                })
                .sort();

            return segments.join(' · ') || '—';
        }

        const stockLegs = relevantLegs.filter(leg => leg.type === 'STOCK');
        if (stockLegs.length > 0) {
            const shares = stockLegs.reduce((sum, leg) => {
                const quantity = leg.quantity * this.getLegMultiplier(leg);
                return sum + (this.getLegAction(leg) === 'BUY' ? quantity : -quantity);
            }, 0);
            const totalShares = Math.abs(Math.round(shares));
            if (totalShares > 0) {
                return `${totalShares} sh`;
            }
        }

        return '—';
    }

    assessRisk(trade, summary) {
        const details = summary || this.summarizeLegs(trade?.legs || []);
        const maxRisk = this.computeMaxRiskUsingFormula(trade, details);

        const result = {
            maxRiskValue: 0,
            maxRiskLabel: '$0.00',
            unlimited: false
        };

        if (maxRisk === Number.POSITIVE_INFINITY) {
            result.maxRiskValue = Number.POSITIVE_INFINITY;
            result.maxRiskLabel = 'Unlimited';
            result.unlimited = true;
            details.capitalAtRisk = Number.POSITIVE_INFINITY;
            return result;
        }

        if (Number.isFinite(maxRisk) && maxRisk > 0) {
            result.maxRiskValue = maxRisk;
            result.maxRiskLabel = this.formatCurrency(maxRisk);
        } else {
            result.maxRiskValue = 0;
            result.maxRiskLabel = '$0.00';
        }

        details.capitalAtRisk = result.maxRiskValue;

        return result;
    }

    // --- Formula Tooltip Data and Helpers -----------------------------------

    getFormulaData() {
        if (!this.formulaDataCache) {
            this.formulaDataCache = {
                "variableExplanations": {
                    "S_0": "Underlying price at entry",
                    "S_T": "Underlying price at expiry",
                    "K": "Strike price",
                    "K1": "Lower strike price",
                    "K2": "Mid strike price",
                    "K3": "Upper strike price",
                    "K4": "Highest strike price",
                    "K_put": "Put strike",
                    "K_call": "Call strike",
                    "D_spread": "Strike width (K2 - K1)",
                    "netDebit": "Net debit paid",
                    "netCredit": "Net credit received",
                    "M": "Contract multiplier (×100)",
                    "∞": "Unlimited (profit/loss)",
                    "maxRisk": "Max loss",
                    "maxGain": "Max gain"
                },
                "strategies": {
                    "Bear Call Ladder": {
                        "maxRiskFormula": "∞",
                        "maxGainFormula": "(K2 - K1 + netCredit) * M",
                        "explanation": "Unlimited upside risk; max gain at K2. (Assumes Call Ratio Spread: Buy K2, Sell 2 K1)."
                    },
                    "Bear Call Spread": {
                        "maxRiskFormula": "(K2 - K1 - netCredit) * M",
                        "maxGainFormula": "netCredit * M",
                        "explanation": "Limited risk and limited profit; bearish strategy. (Sell K1, Buy K2)"
                    },
                    "Bear Put Ladder": {
                        "maxRiskFormula": "∞",
                        "maxGainFormula": "(K2 - K1 + netCredit) * M",
                        "explanation": "Unlimited downside risk; max gain at K1. (Assumes Put Ratio Spread: Buy K2, Sell 2 K1)."
                    },
                    "Bear Put Spread": {
                        "maxRiskFormula": "netDebit * M",
                        "maxGainFormula": "(K2 - K1 - netDebit) * M",
                        "explanation": "Defined-risk bearish spread. (Buy K2, Sell K1)"
                    },
                    "Box Spread": {
                        "maxRiskFormula": "(netDebit - (K2 - K1)) * M",
                        "maxGainFormula": "(K2 - K1 - netDebit) * M",
                        "explanation": "Arbitrage strategy. Profit/loss is locked in at purchase."
                    },
                    "Bull Call Ladder": {
                        "maxRiskFormula": "(K2 - K1 - netCredit) * M",
                        "maxGainFormula": "∞",
                        "explanation": "Unlimited upside gain; risk limited at K2. (Assumes Call Ratio Backspread: Sell K1, Buy 2 K2)."
                    },
                    "Bull Call Spread": {
                        "maxRiskFormula": "netDebit * M",
                        "maxGainFormula": "(K2 - K1 - netDebit) * M",
                        "explanation": "Limited risk, limited reward bullish spread. (Buy K1, Sell K2)"
                    },
                    "Bull Put Ladder": {
                        "maxRiskFormula": "∞",
                        "maxGainFormula": "(K2 - K1 + netCredit) * M",
                        "explanation": "Unlimited downside risk; max gain at K1. (Assumes Put Ratio Spread: Buy K1, Sell 2 K2)."
                    },
                    "Bull Put Spread": {
                        "maxRiskFormula": "(K2 - K1 - netCredit) * M",
                        "maxGainFormula": "netCredit * M",
                        "explanation": "Defined-risk bullish spread. (Sell K2, Buy K1)"
                    },
                    "Calendar Call Spread": {
                        "maxRiskFormula": "netDebit * M",
                        "maxGainFormula": "Variable, typically near short strike at expiry",
                        "explanation": "Limited loss; profit depends on volatility and timing."
                    },
                    "Calendar Put Spread": {
                        "maxRiskFormula": "netDebit * M",
                        "maxGainFormula": "Variable, near short strike at expiry",
                        "explanation": "Neutral to bearish position with limited loss."
                    },
                    "Calendar Straddle": {
                        "maxRiskFormula": "netDebit * M",
                        "maxGainFormula": "Variable, peaks when stock stays near middle strike",
                        "explanation": "Limited loss; profit from time decay and volatility."
                    },
                    "Calendar Strangle": {
                        "maxRiskFormula": "netDebit * M",
                        "maxGainFormula": "Variable; profit from time decay",
                        "explanation": "Limited loss; profit depends on implied volatility."
                    },
                    "Call Broken Wing": {
                        "maxRiskFormula": "netDebit * M",
                        "maxGainFormula": "(K2 - K1 - netDebit) * M",
                        "explanation": "Variant of butterfly; formulas shown for standard Long Call Butterfly."
                    },
                    "Call Ratio Backspread": {
                        "maxRiskFormula": "(K2 - K1 - netCredit) * M",
                        "maxGainFormula": "∞",
                        "explanation": "Unlimited upside profit; limited downside loss. (Assumes net credit)."
                    },
                    "Call Ratio Spread": {
                        "maxRiskFormula": "∞",
                        "maxGainFormula": "(K2 - K1 + netCredit) * M",
                        "explanation": "Neutral to slightly bearish; unlimited risk, limited gain. (Assumes net credit)."
                    },
                    "Cash-Secured Put": {
                        "maxRiskFormula": "(K - netCredit) * M",
                        "maxGainFormula": "netCredit * M",
                        "explanation": "Limited profit (premium); risk if assigned and stock drops."
                    },
                    "Collar": {
                        "maxRiskFormula": "(S_0 - K_put + netDebit) * M",
                        "maxGainFormula": "(K_call - S_0 - netDebit) * M",
                        "explanation": "Stock-protection strategy with capped loss and gain. (Assumes net debit)."
                    },
                    "Covered Call": {
                        "maxRiskFormula": "(S_0 - netCredit) * M",
                        "maxGainFormula": "(K_call - S_0 + netCredit) * M",
                        "explanation": "Income from premium; capped upside. (Own stock at S_0)."
                    },
                    "Covered Put": {
                        "maxRiskFormula": "∞",
                        "maxGainFormula": "(S_0 - K_put + netCredit) * M",
                        "explanation": "Unlimited risk if stock rises. (Short stock at S_0)."
                    },
                    "Covered Short Straddle": {
                        "maxRiskFormula": "∞",
                        "maxGainFormula": "(S_0 - K + netCredit) * M",
                        "explanation": "Unlimited risk if stock rises. (Assumes Short Stock @ S_0 + Short Straddle @ K)."
                    },
                    "Covered Short Strangle": {
                        "maxRiskFormula": "∞",
                        "maxGainFormula": "(S_0 - K1 + netCredit) * M",
                        "explanation": "Unlimited risk if stock rises. (Assumes Short Stock @ S_0 + Short Strangle @ K1/K2)."
                    },
                    "Diagonal Call Spread": {
                        "maxRiskFormula": "netDebit * M",
                        "maxGainFormula": "Variable near short strike",
                        "explanation": "Limited loss; profit from time and direction."
                    },
                    "Diagonal Put Spread": {
                        "maxRiskFormula": "netDebit * M",
                        "maxGainFormula": "Variable near short strike",
                        "explanation": "Limited risk and profit potential."
                    },
                    "Double Diagonal": {
                        "maxRiskFormula": "netDebit * M",
                        "maxGainFormula": "Variable near short strikes",
                        "explanation": "Limited loss, volatility-driven profit."
                    },
                    "Guts": {
                        "maxRiskFormula": "(netDebit - (K2 - K1)) * M",
                        "maxGainFormula": "∞",
                        "explanation": "Buy ITM call (K1) and ITM put (K2). Max loss between strikes."
                    },
                    "Inverse Call Broken Wing": {
                        "maxRiskFormula": "(K2 - K1 - netCredit) * M",
                        "maxGainFormula": "netCredit * M",
                        "explanation": "Same as Short Call Butterfly. Limited loss and gain."
                    },
                    "Inverse Iron Butterfly": {
                        "maxRiskFormula": "netDebit * M",
                        "maxGainFormula": "(K2 - K1 - netDebit) * M",
                        "explanation": "Same as Long Iron Butterfly. Profit peaks at middle strike."
                    },
                    "Inverse Iron Condor": {
                        "maxRiskFormula": "netDebit * M",
                        "maxGainFormula": "(K2 - K1 - netDebit) * M",
                        "explanation": "Same as Long Iron Condor. Profit between middle strikes."
                    },
                    "Inverse Put Broken Wing": {
                        "maxRiskFormula": "(K2 - K1 - netCredit) * M",
                        "maxGainFormula": "netCredit * M",
                        "explanation": "Same as Short Put Butterfly. Limited loss and gain."
                    },
                    "Iron Albatross": {
                        "maxRiskFormula": "(D_spread - netCredit) * M",
                        "maxGainFormula": "netCredit * M",
                        "explanation": "Wide iron condor variant; low reward and risk."
                    },
                    "Iron Butterfly": {
                        "maxRiskFormula": "(K2 - K1 - netCredit) * M",
                        "maxGainFormula": "netCredit * M",
                        "explanation": "Limited loss and gain; centered around middle strike."
                    },
                    "Iron Condor": {
                        "maxRiskFormula": "(D_spread - netCredit) * M",
                        "maxGainFormula": "netCredit * M",
                        "explanation": "Limited risk, limited profit neutral strategy."
                    },
                    "Jade Lizard": {
                        "maxRiskFormula": "∞",
                        "maxGainFormula": "netCredit * M",
                        "explanation": "Credit strategy with unlimited downside risk from the naked put."
                    },
                    "Long Call": {
                        "maxRiskFormula": "netDebit * M",
                        "maxGainFormula": "∞",
                        "explanation": "Simple bullish bet; risk limited to premium."
                    },
                    "Long Call Butterfly": {
                        "maxRiskFormula": "netDebit * M",
                        "maxGainFormula": "(K2 - K1 - netDebit) * M",
                        "explanation": "Profit near middle strike; limited loss."
                    },
                    "Long Call Condor": {
                        "maxRiskFormula": "netDebit * M",
                        "maxGainFormula": "(K2 - K1 - netDebit) * M",
                        "explanation": "Profit between middle strikes (K2, K3); limited risk."
                    },
                    "Long Put": {
                        "maxRiskFormula": "netDebit * M",
                        "maxGainFormula": "(K - netDebit) * M",
                        "explanation": "Bearish position with limited loss, large potential gain."
                    },
                    "Long Put Butterfly": {
                        "maxRiskFormula": "netDebit * M",
                        "maxGainFormula": "(K2 - K1 - netDebit) * M",
                        "explanation": "Limited loss, profit near center strike."
                    },
                    "Long Put Condor": {
                        "maxRiskFormula": "netDebit * M",
                        "maxGainFormula": "(K2 - K1 - netDebit) * M",
                        "explanation": "Limited loss; profit between middle strikes."
                    },
                    "Long Straddle": {
                        "maxRiskFormula": "netDebit * M",
                        "maxGainFormula": "∞",
                        "explanation": "Volatility play; loss limited to premium."
                    },
                    "Long Strangle": {
                        "maxRiskFormula": "netDebit * M",
                        "maxGainFormula": "∞",
                        "explanation": "Profit if price moves far in either direction."
                    },
                    "Poor Man's Covered Call": {
                        "maxRiskFormula": "netDebit * M",
                        "maxGainFormula": "(K2 - K1 - netDebit) * M",
                        "explanation": "Synthetic covered call with defined risk. (Buy long-term K1, Sell short-term K2)."
                    },
                    "Protective Put": {
                        "maxRiskFormula": "(S_0 - K_put + netDebit) * M",
                        "maxGainFormula": "∞",
                        "explanation": "Downside protection for owned stock (at S_0) with unlimited upside."
                    },
                    "Put Broken Wing": {
                        "maxRiskFormula": "netDebit * M",
                        "maxGainFormula": "(K2 - K1 - netDebit) * M",
                        "explanation": "Variant of butterfly; formulas shown for standard Long Put Butterfly."
                    },
                    "Put Ratio Backspread": {
                        "maxRiskFormula": "(K2 - K1 - netCredit) * M",
                        "maxGainFormula": "∞",
                        "explanation": "Unlimited profit if price falls sharply. (Assumes net credit)."
                    },
                    "Put Ratio Spread": {
                        "maxRiskFormula": "∞",
                        "maxGainFormula": "(K2 - K1 + netCredit) * M",
                        "explanation": "Unlimited downside risk; limited profit. (Assumes net credit)."
                    },
                    "Reverse Jade Lizard": {
                        "maxRiskFormula": "netDebit * M",
                        "maxGainFormula": "∞",
                        "explanation": "Debit strategy with unlimited profit potential (long put + bull call spread)."
                    },
                    "Short Call": {
                        "maxRiskFormula": "∞",
                        "maxGainFormula": "netCredit * M",
                        "explanation": "Unlimited risk on upside; income from premium."
                    },
                    "Short Call Butterfly": {
                        "maxRiskFormula": "(K2 - K1 - netCredit) * M",
                        "maxGainFormula": "netCredit * M",
                        "explanation": "Reverse butterfly with limited loss and gain."
                    },
                    "Short Call Condor": {
                        "maxRiskFormula": "(D_spread - netCredit) * M",
                        "maxGainFormula": "netCredit * M",
                        "explanation": "Limited loss and gain. (e.g., Sell K1, Buy K2, Buy K3, Sell K4)."
                    },
                    "Short Guts": {
                        "maxRiskFormula": "∞",
                        "maxGainFormula": "(netCredit - (K2 - K1)) * M",
                        "explanation": "Unlimited risk, limited reward between strikes. (Sell ITM K1 Call, Sell ITM K2 Put)."
                    },
                    "Short Put": {
                        "maxRiskFormula": "(K - netCredit) * M",
                        "maxGainFormula": "netCredit * M",
                        "explanation": "Income from selling put; risk if stock drops."
                    },
                    "Short Put Butterfly": {
                        "maxRiskFormula": "(K2 - K1 - netCredit) * M",
                        "maxGainFormula": "netCredit * M",
                        "explanation": "Limited loss and gain."
                    },
                    "Short Put Condor": {
                        "maxRiskFormula": "(D_spread - netCredit) * M",
                        "maxGainFormula": "netCredit * M",
                        "explanation": "Limited loss and profit; neutral strategy."
                    },
                    "Short Straddle": {
                        "maxRiskFormula": "∞",
                        "maxGainFormula": "netCredit * M",
                        "explanation": "Unlimited risk on both sides."
                    },
                    "Short Strangle": {
                        "maxRiskFormula": "∞",
                        "maxGainFormula": "netCredit * M",
                        "explanation": "Unlimited loss; limited gain from credit."
                    },
                    "Strap": {
                        "maxRiskFormula": "netDebit * M",
                        "maxGainFormula": "∞",
                        "explanation": "Bullish volatility play (Buy 2 Calls, Buy 1 Put); loss limited to premium."
                    },
                    "Strip": {
                        "maxRiskFormula": "netDebit * M",
                        "maxGainFormula": "∞",
                        "explanation": "Bearish volatility play (Buy 1 Call, Buy 2 Puts); limited loss."
                    },
                    "Synthetic Long Stock": {
                        "maxRiskFormula": "∞",
                        "maxGainFormula": "∞",
                        "explanation": "Replicates long stock (Buy Call, Sell Put); unlimited gain and loss."
                    },
                    "Synthetic Short Stock": {
                        "maxRiskFormula": "∞",
                        "maxGainFormula": "∞",
                        "explanation": "Replicates short stock (Sell Call, Buy Put); unlimited risk both ways."
                    },
                    "Synthetic Put": {
                        "maxRiskFormula": "(K_call - S_0 + netDebit) * M",
                        "maxGainFormula": "(S_0 - netDebit) * M",
                        "explanation": "Replicates a long put (Short Stock at S_0, Buy Call at K_call)."
                    },
                    "Wheel": {
                        "maxRiskFormula": "(K_put - netCredit) * M",
                        "maxGainFormula": "netCredit * M",
                        "explanation": "Multi-step strategy. Formulas shown are for Step 1 (selling the put)."
                    }
                }
            };
        }
        return this.formulaDataCache;
    }

    buildFormulaTooltipContent(trade, metricType) {
        if (!trade || !metricType) {
            return null;
        }

        const strategyName = this.getStrategyDisplayName(trade.strategy || '');
        const formulaData = this.getFormulaData();
        const strategyInfo = formulaData.strategies[strategyName];

        if (!strategyInfo) {
            return null;
        }

        const details = this.summarizeLegs(trade.legs || []);
        const context = this.buildRiskFormulaContext(trade, details);

        if (metricType === 'maxRisk') {
            return this.buildMaxRiskTooltip(strategyName, strategyInfo, context, trade);
        } else if (metricType === 'pl') {
            return this.buildPLTooltip(trade, details, context);
        }

        return null;
    }

    buildMaxRiskTooltip(strategyName, strategyInfo, context, trade) {
        const html = [];
        const formulaData = this.getFormulaData();
        
        html.push(`<div class="formula-tooltip__title">`);
        html.push(`<span class="formula-tooltip__strategy">${this.escapeHtml(strategyName)}</span>`);
        html.push(`Max Risk`);
        html.push(`</div>`);

        if (strategyInfo.explanation) {
            html.push(`<div class="formula-tooltip__section">`);
            html.push(`<div class="formula-tooltip__explanation">${this.escapeHtml(strategyInfo.explanation)}</div>`);
            html.push(`</div>`);
        }

        html.push(`<div class="formula-tooltip__section">`);
        html.push(`<div class="formula-tooltip__label">Formula</div>`);
        html.push(`<div class="formula-tooltip__formula">${this.escapeHtml(strategyInfo.maxRiskFormula)}</div>`);
        html.push(`</div>`);

        // Merged Calculation section with human-readable names and variable letters
        const variables = this.buildVariablesWithExplanations(context, formulaData, trade);
        if (variables.length > 0) {
            html.push(`<div class="formula-tooltip__section">`);
            html.push(`<div class="formula-tooltip__label">Calculation</div>`);
            html.push(`<div class="formula-tooltip__variables">`);
            variables.forEach(v => {
                html.push(`<div class="formula-tooltip__variable">`);
                html.push(`<span class="formula-tooltip__variable-name">${this.escapeHtml(v.displayName)}</span>`);
                html.push(`<span class="formula-tooltip__variable-value">${this.escapeHtml(v.value)}</span>`);
                html.push(`</div>`);
            });
            html.push(`</div>`);
            html.push(`</div>`);
        }

        return html.join('');
    }

    buildPLTooltip(trade, details, context) {
        const html = [];
        const formulaData = this.getFormulaData();
        
        html.push(`<div class="formula-tooltip__title">`);
        html.push(`P&L Calculation`);
        html.push(`</div>`);

        const plValue = Number(trade.pl);
        const isOpen = !this.isClosedStatus(trade.status);

        if (isOpen) {
            html.push(`<div class="formula-tooltip__section">`);
            html.push(`<div class="formula-tooltip__explanation">This position is currently open. P&L shown is unrealized.</div>`);
            html.push(`</div>`);
        }

        html.push(`<div class="formula-tooltip__section">`);
        html.push(`<div class="formula-tooltip__label">Formula</div>`);
        html.push(`<div class="formula-tooltip__formula">P&L = Total Credits - Total Debits - Fees</div>`);
        html.push(`</div>`);

        // Merged Calculation section with actual values
        const plVariables = this.buildPLVariables(trade, details);
        if (plVariables.length > 0) {
            html.push(`<div class="formula-tooltip__section">`);
            html.push(`<div class="formula-tooltip__label">Calculation</div>`);
            html.push(`<div class="formula-tooltip__variables">`);
            plVariables.forEach(v => {
                html.push(`<div class="formula-tooltip__variable">`);
                html.push(`<span class="formula-tooltip__variable-name">${this.escapeHtml(v.displayName)}</span>`);
                html.push(`<span class="formula-tooltip__variable-value">${this.escapeHtml(v.value)}</span>`);
                html.push(`</div>`);
            });
            html.push(`</div>`);
            html.push(`</div>`);
        }

        return html.join('');
    }

    buildVariablesWithExplanations(context, formulaData, trade) {
        const variables = [];
        const explanations = formulaData.variableExplanations;
        const maxRiskValue = Number(trade.maxRisk);
        
        // Stock price at entry (S_0 or S)
        if (context.S) {
            const explanation = explanations.S_0 || 'Underlying stock price at entry';
            variables.push({ 
                displayName: `${explanation} (S_0)`, 
                value: `$${context.S.toFixed(2)}` 
            });
        }
        
        // Strike prices - map context properties to formula variables
        const strikeMapping = [
            { contextKey: 'K', formulaKey: 'K', shouldShow: () => context.K && !context.K1 },
            { contextKey: 'K1', formulaKey: 'K1' },
            { contextKey: 'K2', formulaKey: 'K2' },
            { contextKey: 'K3', formulaKey: 'K3' },
            { contextKey: 'K4', formulaKey: 'K4' },
            { contextKey: 'shortPutStrike', formulaKey: 'K_put', shouldShow: () => context.shortPutStrike && !context.K1 },
            { contextKey: 'longPutStrike', formulaKey: 'K_put', shouldShow: () => context.longPutStrike && !context.K1 && !context.shortPutStrike },
            { contextKey: 'shortCallStrike', formulaKey: 'K_call', shouldShow: () => context.shortCallStrike && !context.K1 },
            { contextKey: 'longCallStrike', formulaKey: 'K_call', shouldShow: () => context.longCallStrike && !context.K1 && !context.shortCallStrike }
        ];
        
        strikeMapping.forEach(mapping => {
            const value = context[mapping.contextKey];
            if (value && Number.isFinite(value)) {
                const shouldShow = mapping.shouldShow ? mapping.shouldShow() : true;
                if (shouldShow) {
                    const explanation = explanations[mapping.formulaKey] || 'Strike price';
                    // Avoid duplicates
                    if (!variables.some(v => v.displayName.includes(mapping.formulaKey))) {
                        variables.push({ 
                            displayName: `${explanation} (${mapping.formulaKey})`, 
                            value: `$${value.toFixed(2)}` 
                        });
                    }
                }
            }
        });
        
        // Strike spread (D_spread)
        if (context.K1 && context.K2) {
            const width = Math.abs(context.K2 - context.K1);
            const explanation = explanations.D_spread || 'Distance between strikes';
            variables.push({ 
                displayName: `${explanation} (D_spread)`, 
                value: `$${width.toFixed(2)}` 
            });
        } else if (context.defaultWidth && Number.isFinite(context.defaultWidth)) {
            const explanation = explanations.D_spread || 'Distance between strikes';
            variables.push({ 
                displayName: `${explanation} (D_spread)`, 
                value: `$${context.defaultWidth.toFixed(2)}` 
            });
        }
        
        // Net credit/debit
        if (context.netCredit && context.netCredit > 0) {
            const explanation = explanations.netCredit || 'Net credit received';
            variables.push({ 
                displayName: `${explanation} (netCredit)`, 
                value: `$${context.netCredit.toFixed(2)}` 
            });
        }
        if (context.netDebit && context.netDebit > 0) {
            const explanation = explanations.netDebit || 'Net debit paid';
            variables.push({ 
                displayName: `${explanation} (netDebit)`, 
                value: `$${context.netDebit.toFixed(2)}` 
            });
        }
        
        // Multiplier (M) - show actual value used
        if (context.contractValue) {
            const explanation = explanations.M || 'Contract multiplier';
            const multiplierValue = context.multiplier || 100; // Default multiplier per contract
            const totalContracts = context.contracts || 1;
            variables.push({ 
                displayName: `${explanation} (M)`, 
                value: `${multiplierValue} × ${totalContracts} = ${context.contractValue}` 
            });
        }
        
        // Result - Max Risk
        if (!trade.riskIsUnlimited && Number.isFinite(maxRiskValue) && maxRiskValue > 0) {
            variables.push({ 
                displayName: 'Max Risk (Result)', 
                value: `$${maxRiskValue.toFixed(2)}` 
            });
        } else if (trade.riskIsUnlimited || maxRiskValue === Number.POSITIVE_INFINITY) {
            variables.push({ 
                displayName: 'Max Risk (Result)', 
                value: '∞ (Unlimited)' 
            });
        }
        
        return variables;
    }

    buildPLVariables(trade, details) {
        const variables = [];
        
        if (details && Number.isFinite(details.totalCredit)) {
            variables.push({ 
                displayName: 'Total Credits', 
                value: `$${details.totalCredit.toFixed(2)}` 
            });
        }
        
        if (details && Number.isFinite(details.totalDebit)) {
            variables.push({ 
                displayName: 'Total Debits', 
                value: `$${details.totalDebit.toFixed(2)}` 
            });
        }
        
        if (details && Number.isFinite(details.totalFees)) {
            variables.push({ 
                displayName: 'Fees', 
                value: `$${details.totalFees.toFixed(2)}` 
            });
        }
        
        const plValue = Number(trade.pl);
        if (Number.isFinite(plValue)) {
            variables.push({ 
                displayName: 'P&L (Result)', 
                value: `$${plValue.toFixed(2)}` 
            });
        }
        
        return variables;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    createFormulaIcon(trade, metricType) {
        const wrapper = document.createElement('span');
        wrapper.className = 'formula-value-wrapper';

        const icon = document.createElement('span');
        icon.className = 'formula-info-icon';
        icon.textContent = 'i';
        icon.setAttribute('aria-label', `View ${metricType === 'maxRisk' ? 'max risk' : 'P&L'} calculation`);

        const tooltip = document.createElement('div');
        tooltip.className = 'formula-tooltip';
        tooltip.setAttribute('role', 'tooltip');

        const content = this.buildFormulaTooltipContent(trade, metricType);
        if (content) {
            tooltip.innerHTML = content;
            wrapper.appendChild(icon);
            wrapper.appendChild(tooltip);

            // Position tooltip above table when hovering
            wrapper.addEventListener('mouseenter', (e) => {
                this.positionFormulaTooltip(wrapper, tooltip);
            });

            // Update position on scroll
            const handleScroll = () => {
                if (wrapper.matches(':hover')) {
                    this.positionFormulaTooltip(wrapper, tooltip);
                }
            };
            
            window.addEventListener('scroll', handleScroll, { passive: true });
            wrapper.addEventListener('mouseleave', () => {
                window.removeEventListener('scroll', handleScroll);
            }, { once: true });

            return wrapper;
        }

        return null;
    }

    positionFormulaTooltip(wrapper, tooltip) {
        if (!wrapper || !tooltip) {
            return;
        }

        const iconRect = wrapper.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;

        // Calculate position above the icon
        let top = iconRect.top - tooltipRect.height - 12;
        let left = iconRect.left + (iconRect.width / 2) - (tooltipRect.width / 2);

        // Ensure tooltip doesn't go above viewport
        if (top < 10) {
            // If not enough space above, position below instead
            top = iconRect.bottom + 12;
        }

        // Ensure tooltip doesn't overflow left/right
        if (left < 10) {
            left = 10;
        } else if (left + tooltipRect.width > viewportWidth - 10) {
            left = viewportWidth - tooltipRect.width - 10;
        }

        tooltip.style.top = `${top}px`;
        tooltip.style.left = `${left}px`;
    }

    // --- Leg form UI helpers ---------------------------------------------

    getLegsContainer() {
        return document.getElementById('trade-legs-container');
    }

    generateLegId(index = 0) {
        const base = this.currentEditingId || 'NEW';
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).slice(2, 6);
        return `${base}-LEG-${timestamp}-${index}-${random}`;
    }

    clearLegFormRows() {
        const container = this.getLegsContainer();
        if (container) {
            container.innerHTML = '';
        }
    }

    getSelectedUnderlyingType({ fallback = 'Stock' } = {}) {
        const select = document.getElementById('underlyingType');
        return this.normalizeUnderlyingType(select?.value, { fallback });
    }

    getDefaultMultiplierForLegType(legType, underlyingType = 'Stock') {
        const normalizedLegType = this.normalizeLegType(legType || 'CALL');
        if (normalizedLegType === 'STOCK' || normalizedLegType === 'CASH') {
            return 1;
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

    syncLegMultiplierVisibility(row, { defaultMultiplier = null } = {}) {
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

    applyUnderlyingTypeToLegMultipliers({ row = null, force = false } = {}) {
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

    renderLegForms(legs = []) {
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

    addLegFormRow(leg = null) {
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
                <button type="button" class="btn btn--sm btn--secondary trade-leg__remove">Remove Leg</button>
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
                <div class="form-group">
                    <label class="form-label">Expiration Date</label>
                    <input type="date" class="form-control" data-leg-field="expirationDate">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Strike</label>
                    <input type="number" class="form-control" data-leg-field="strike" step="0.01">
                </div>
                <div class="form-group">
                    <label class="form-label">Premium (per share)</label>
                    <input type="number" class="form-control" data-leg-field="premium" step="0.000001" min="0">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Fees</label>
                    <input type="number" class="form-control" data-leg-field="fees" step="0.0000001" min="0">
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
                    <input type="number" class="form-control" data-leg-field="underlyingPrice" step="0.01" min="0">
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
            feesInput.value = Number.isFinite(Number(leg?.fees)) ? Number(leg.fees) : '';
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
        if (underlyingInput) {
            underlyingInput.value = Number.isFinite(Number(leg?.underlyingPrice)) ? Number(leg.underlyingPrice) : '';
        }

        const removeButton = row.querySelector('.trade-leg__remove');
        if (removeButton) {
            removeButton.addEventListener('click', () => {
                this.removeLegFormRow(row);
            });
        }

        container.appendChild(row);
        this.applyUnderlyingTypeToLegMultipliers({ row, force: !leg });
        this.syncLegMultiplierVisibility(row);
        this.updateLegRowNumbers();
        return row;
    }

    removeLegFormRow(row) {
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

    updateLegRowNumbers() {
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

    collectLegsFromForm() {
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
            const fees = this.parseDecimal(feesRaw, 0, { allowNegative: false });

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

    // Trade normalization -------------------------------------------------

    getPrimaryLeg(trade = {}) {
        if (trade.primaryLeg && trade.primaryLeg.id) {
            return this.normalizeLeg(trade.primaryLeg);
        }
        if (Array.isArray(trade.legs) && trade.legs.length > 0) {
            const candidates = trade.legs.map((leg, index) => this.normalizeLeg(leg, index));
            const firstOpen = candidates.find(leg => this.getLegSide(leg) === 'OPEN') || candidates[0];
            return firstOpen;
        }
        return null;
    }

    deriveTradeTypeFromLeg(leg) {
        if (!leg) {
            return 'BTO';
        }
        const action = this.getLegAction(leg);
        const side = this.getLegSide(leg);
        if (action === 'BUY' && side === 'OPEN') {
            return 'BTO';
        }
        if (action === 'SELL' && side === 'OPEN') {
            return 'STO';
        }
        if (action === 'SELL' && side === 'CLOSE') {
            return 'STC';
        }
        if (action === 'BUY' && side === 'CLOSE') {
            return 'BTC';
        }
        // ROLL legs inherit previous action semantics
        return action === 'SELL' ? 'STO' : 'BTO';
    }

    deriveTradeDirectionFromLeg(leg) {
        if (!leg) {
            return 'long';
        }
        const action = this.getLegAction(leg);
        if (action === 'SELL') {
            return 'short';
        }
        return 'long';
    }

    getTradeType(trade) {
        const primaryLeg = this.getPrimaryLeg(trade);
        return this.deriveTradeTypeFromLeg(primaryLeg);
    }

    inferTradeDirection(trade) {
        const primaryLeg = this.getPrimaryLeg(trade);
        return this.deriveTradeDirectionFromLeg(primaryLeg);
    }

    normalizeStatus(status) {
        return (status || '').toString().trim().toLowerCase();
    }

    normalizeTradeStatusInput(status) {
        const normalized = (status || '').toString().trim().toLowerCase();
        if (!normalized) {
            return '';
        }
        if (normalized === 'open') {
            return 'Open';
        }
        if (normalized === 'closed') {
            return 'Closed';
        }
        if (normalized === 'expired') {
            return 'Expired';
        }
        if (normalized === 'assigned') {
            return 'Assigned';
        }
        if (normalized === 'rolling' || normalized === 'rolled') {
            return 'Rolling';
        }
        return '';
    }

    isClosedStatus(status) {
        const normalized = this.normalizeStatus(status);
        return normalized === 'closed' || normalized === 'assigned' || normalized === 'expired';
    }

    isActiveStatus(status) {
        const normalized = this.normalizeStatus(status);
        return normalized === 'open' || normalized === 'rolling';
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

        if (normalized === 'rolling') {
            return 'Rolling';
        }

        return rawStatus;
    }

    // DTE calculation using current date
    calculateDTE(expirationDate, trade) {
        let expDate = this.parseDateValue(expirationDate);

        if (!expDate && this.isPmccTrade(trade)) {
            const pmccExpiration = this.parseDateValue(trade?.pmccShortExpiration);
            if (pmccExpiration) {
                expDate = pmccExpiration;
            }
        }

        if (!expDate) {
            return 0;
        }

        if (this.isClosedStatus(trade.status)) {
            return 0;
        }

        const diffTime = expDate.getTime() - this.currentDate.getTime();
        if (!Number.isFinite(diffTime)) {
            return 0;
        }

        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return Math.max(0, diffDays);
    }

    // Realized P&L derived from leg cash flows
    calculatePL(trade) {
        if (!trade) {
            return 0;
        }

        const summary = this.summarizeLegs(trade.legs || []);
        const cashFlowValue = Number.isFinite(Number(trade.cashFlow)) ? Number(trade.cashFlow) : Number(summary.cashFlow);
        if (!Number.isFinite(cashFlowValue)) {
            return 0;
        }

        return parseFloat(cashFlowValue.toFixed(2));
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
        if (!trade) {
            return 0;
        }

        const entryDate = this.parseDateValue(trade.entryDate || trade.openedDate);
        if (!entryDate) {
            return 0;
        }

        const exitCandidate = this.parseDateValue(trade.exitDate || trade.closedDate);
        const endDate = (this.isClosedStatus(trade.status) && exitCandidate) ? exitCandidate : this.currentDate;

        const diffTime = endDate.getTime() - entryDate.getTime();
        if (!Number.isFinite(diffTime) || diffTime < 0) {
            return 0;
        }

        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return Math.max(1, diffDays);
    }

    // Enhanced Max Risk calculation
    calculateMaxRisk(trade) {
        if (!trade) {
            return 0;
        }

        const overrideValue = Number(trade.maxRiskOverride);
        if (Number.isFinite(overrideValue) && overrideValue > 0) {
            return overrideValue;
        }

        const summary = this.summarizeLegs(trade.legs || []);
        const computed = this.computeMaxRiskUsingFormula(trade, summary);
        if (computed === Number.POSITIVE_INFINITY) {
            return Number.POSITIVE_INFINITY;
        }
        if (Number.isFinite(computed) && computed > 0) {
            return computed;
        }

        const stored = Number(trade.capitalAtRisk);
        if (stored === Number.POSITIVE_INFINITY) {
            return Number.POSITIVE_INFINITY;
        }
        if (Number.isFinite(stored) && stored > 0) {
            return stored;
        }

        const legacy = Number(trade.maxRisk);
        if (legacy === Number.POSITIVE_INFINITY) {
            return Number.POSITIVE_INFINITY;
        }
        if (Number.isFinite(legacy) && legacy > 0) {
            return legacy;
        }

        return 0;
    }

    getCapitalAtRisk(trade) {
        if (!trade) {
            return 0;
        }

        const overrideValue = Number(trade.maxRiskOverride);
        if (Number.isFinite(overrideValue) && overrideValue > 0) {
            return overrideValue;
        }

        const summary = this.summarizeLegs(trade.legs || []);
        const computed = this.computeMaxRiskUsingFormula(trade, summary);
        if (computed === Number.POSITIVE_INFINITY) {
            return Number.POSITIVE_INFINITY;
        }
        if (Number.isFinite(computed) && computed > 0) {
            return computed;
        }

        const stored = Number(trade.capitalAtRisk);
        if (stored === Number.POSITIVE_INFINITY) {
            return Number.POSITIVE_INFINITY;
        }
        if (Number.isFinite(stored) && stored > 0) {
            return stored;
        }

        const legacy = Number(trade.maxRisk);
        if (legacy === Number.POSITIVE_INFINITY) {
            return Number.POSITIVE_INFINITY;
        }
        if (Number.isFinite(legacy) && legacy > 0) {
            return legacy;
        }

        return 0;
    }

    // VERIFIED: Annualized ROI calculation
    calculateAnnualizedROI(trade) {
        if (!trade || !this.isClosedStatus(trade.status)) {
            return 0;
        }

        const roiPercent = Number.isFinite(Number(trade.roi)) ? Number(trade.roi) : this.calculateROI(trade);
        if (!Number.isFinite(roiPercent)) {
            return 0;
        }

        const daysHeldValue = Number(trade.daysHeld) || this.calculateDaysHeld(trade) || 0;
        const daysHeld = Math.max(1, daysHeldValue);
        const annualizedROI = (365 * roiPercent) / daysHeld;

        if (!Number.isFinite(annualizedROI)) {
            return 0;
        }

        return parseFloat(annualizedROI.toFixed(2));
    }

    buildLegLifecycleKey(leg = {}) {
        const type = this.normalizeLegType(leg.type);
        const strikeValue = Number(leg.strike);
        const strike = Number.isFinite(strikeValue) ? strikeValue.toFixed(4) : 'NA';
        const expiration = (leg.expirationDate || '').toString();
        const multiplier = this.getLegMultiplier(leg) || 1;
        return `${type}|${strike}|${expiration}|${multiplier}`;
    }

    getNormalizedLegOrderType(leg = {}) {
        const rawOrder = leg.orderType || leg.tradeType || leg.order;
        const normalizedOrder = this.normalizeLegOrderType(rawOrder);
        if (normalizedOrder) {
            return normalizedOrder;
        }
        const { action, side } = this.getLegOrderDescriptor(leg);
        return this.normalizeLegOrderType(this.deriveOrderTypeFromActionSide(action, side));
    }

    determineTradeLifecycleStatus(trade = {}, summary = {}) {
        const legs = Array.isArray(summary?.legs) ? summary.legs : [];
        const result = {
            status: 'Open',
            exitReason: null,
            effectiveClosedDate: null,
            openContractsOverride: undefined,
            meta: {
                matchedPairs: false,
                unmatchedExposure: 0,
                expirationPassed: false,
                hasRollLegs: false,
                hasCloseActivity: false,
                hasAssignmentEvent: false,
                hasExpirationEvent: false
            }
        };

        if (legs.length === 0) {
            result.meta.matchedPairs = true;
            return result;
        }

        const pairMap = new Map();
        let hasRollLegs = false;
        let hasCloseActivity = false;
        let hasAssignmentEvent = false;
        let hasExpirationEvent = false;

        legs.forEach((leg) => {
            const quantity = Math.abs(Number(leg.quantity) || 0);
            if (!quantity) {
                return;
            }

            const key = this.buildLegLifecycleKey(leg);
            if (!pairMap.has(key)) {
                pairMap.set(key, {
                    longOpen: 0,
                    longClose: 0,
                    shortOpen: 0,
                    shortClose: 0
                });
            }

            const bucket = pairMap.get(key);
            const orderType = this.getNormalizedLegOrderType(leg);
            switch (orderType) {
                case 'BTO':
                    bucket.longOpen += quantity;
                    break;
                case 'STC':
                    bucket.longClose += quantity;
                    hasCloseActivity = true;
                    break;
                case 'STO':
                    bucket.shortOpen += quantity;
                    break;
                case 'BTC':
                    bucket.shortClose += quantity;
                    hasCloseActivity = true;
                    break;
                default:
                    break;
            }

            const rawOrder = (leg.orderType || leg.tradeType || leg.order || '').toString().toUpperCase();
            if (rawOrder.includes('ROLL')) {
                hasRollLegs = true;
            }
            if (rawOrder.includes('ASSIGN')) {
                hasAssignmentEvent = true;
            }
            if (rawOrder.includes('EXPIRE') || rawOrder.includes('EXPIRY')) {
                hasExpirationEvent = true;
            }
        });

        let matchedPairs = true;
        let unmatchedExposure = 0;

        pairMap.forEach((bucket) => {
            const longDiff = Math.abs(bucket.longOpen - bucket.longClose);
            const shortDiff = Math.abs(bucket.shortOpen - bucket.shortClose);
            if (longDiff > 0 || shortDiff > 0) {
                matchedPairs = false;
            }
            unmatchedExposure += longDiff + shortDiff;
        });

        const expirationDate = this.parseDateValue(trade.expirationDate || summary.latestExpiration);
        const now = this.currentDate instanceof Date ? this.currentDate : new Date();
        const expirationPassed = expirationDate ? now.getTime() > expirationDate.getTime() : false;

        const lastActivityDate = summary.closedDate instanceof Date
            ? summary.closedDate
            : this.parseDateValue(trade.closedDate || trade.exitDate);
        const activityAfterExpiration = expirationPassed && lastActivityDate && expirationDate
            ? lastActivityDate.getTime() >= expirationDate.getTime()
            : false;

        result.meta = {
            matchedPairs,
            unmatchedExposure,
            expirationPassed,
            hasRollLegs,
            hasCloseActivity,
            hasAssignmentEvent,
            hasExpirationEvent,
            activityAfterExpiration
        };

        const normalizedStatus = this.normalizeStatus(trade.status);
        if (!hasAssignmentEvent && this.isAssignmentTrade(trade)) {
            hasAssignmentEvent = true;
        }

        if (hasAssignmentEvent) {
            result.status = 'Assigned';
            result.exitReason = trade.exitReason || 'Assigned';
            result.openContractsOverride = 0;
            if (!result.effectiveClosedDate && lastActivityDate) {
                result.effectiveClosedDate = lastActivityDate.toISOString().slice(0, 10);
            }
            return result;
        }

        if (matchedPairs || unmatchedExposure === 0) {
            result.status = 'Closed';
            if (hasExpirationEvent && !trade.exitReason) {
                result.exitReason = 'Expired OTM';
            }
            result.openContractsOverride = 0;
            if (!result.effectiveClosedDate && lastActivityDate) {
                result.effectiveClosedDate = lastActivityDate.toISOString().slice(0, 10);
            }
            return result;
        }

        if (expirationPassed && !hasAssignmentEvent) {
            result.status = 'Expired';
            if (!trade.exitReason) {
                result.exitReason = 'Expired OTM';
            }
            result.openContractsOverride = 0;
            if (expirationDate) {
                result.effectiveClosedDate = expirationDate.toISOString().slice(0, 10);
            }
            return result;
        }

        if (hasRollLegs || (hasCloseActivity && unmatchedExposure > 0)) {
            result.status = 'Rolling';
            return result;
        }

        if (activityAfterExpiration && !hasAssignmentEvent) {
            result.status = 'Closed';
            if (!trade.exitReason) {
                result.exitReason = 'Closed post-expiration';
            }
            result.openContractsOverride = 0;
            if (lastActivityDate) {
                result.effectiveClosedDate = lastActivityDate.toISOString().slice(0, 10);
            }
            return result;
        }

        if (normalizedStatus === 'expired' && expirationDate) {
            result.status = 'Expired';
            result.openContractsOverride = 0;
            if (!trade.exitReason) {
                result.exitReason = 'Expired OTM';
            }
            if (!result.effectiveClosedDate) {
                result.effectiveClosedDate = expirationDate.toISOString().slice(0, 10);
            }
            return result;
        }

        result.status = 'Open';
        return result;
    }

    enrichTradeData(trade) {
        const enriched = { ...trade };
        delete enriched.optionType;

        const rawStrategy = (enriched.strategy || '').toString().trim();
        enriched.strategy = this.getStrategyDisplayName(rawStrategy);

        enriched.underlyingType = this.normalizeUnderlyingType(trade.underlyingType, { fallback: 'Stock' });

        const legSummary = this.summarizeLegs(enriched.legs);
        enriched.legs = legSummary.legs;
        enriched.legsCount = legSummary.legsCount;
        enriched.openContracts = Math.max(0, legSummary.openContracts - legSummary.closeContracts);
        enriched.closeContracts = legSummary.closeContracts;
        enriched.openLegs = Math.max(0, legSummary.openLegs - legSummary.closeLegs);
        enriched.rollLegs = legSummary.rollLegs;
        enriched.totalFees = Number(legSummary.totalFees.toFixed(4));
        enriched.totalDebit = Number(legSummary.totalDebit.toFixed(2));
        enriched.totalCredit = Number(legSummary.totalCredit.toFixed(2));
        enriched.cashFlow = Number(legSummary.cashFlow.toFixed(2));
        const initialCapitalAtRisk = Number(legSummary.capitalAtRisk);
        enriched.capitalAtRisk = Number.isFinite(initialCapitalAtRisk)
            ? Number(initialCapitalAtRisk.toFixed(2))
            : initialCapitalAtRisk;
        enriched.fees = enriched.totalFees;
        enriched.primaryLeg = legSummary.primaryLeg;

        const userRiskOverride = Number(trade.maxRiskOverride);
        if (Number.isFinite(userRiskOverride) && userRiskOverride > 0) {
            enriched.maxRiskOverride = userRiskOverride;
        } else {
            enriched.maxRiskOverride = null;
        }

        const primaryLeg = legSummary.primaryLeg;
        enriched.tradeType = this.deriveTradeTypeFromLeg(primaryLeg);
        enriched.tradeDirection = this.deriveTradeDirectionFromLeg(primaryLeg);

        const normalizedQuantity = primaryLeg ? Math.abs(Number(primaryLeg.quantity) || 0) : 0;
        enriched.quantity = enriched.tradeDirection === 'short' ? -normalizedQuantity : normalizedQuantity;
        enriched.strikePrice = this.derivePrimaryStrike(legSummary);
        enriched.multiplier = this.getLegMultiplier(primaryLeg);
        enriched.displayStrike = this.buildStrikeDisplay(enriched, legSummary);

        const activeStrike = this.getActiveStrikeForDisplay(legSummary);
        enriched.activeStrikePrice = Number.isFinite(activeStrike) ? Number(activeStrike) : null;

        const entryPrice = legSummary.entryPrice;
        const exitPrice = legSummary.exitPrice;
        enriched.entryPrice = Number.isFinite(entryPrice) ? Number(entryPrice.toFixed(4)) : null;
        enriched.exitPrice = Number.isFinite(exitPrice) ? Number(exitPrice.toFixed(4)) : null;

        const riskInfo = this.assessRisk(enriched, legSummary);
        if (enriched.maxRiskOverride) {
            riskInfo.maxRiskValue = enriched.maxRiskOverride;
            riskInfo.maxRiskLabel = this.formatCurrency(enriched.maxRiskOverride);
            riskInfo.unlimited = false;
            legSummary.capitalAtRisk = enriched.maxRiskOverride;
        }

        enriched.capitalAtRisk = riskInfo.maxRiskValue;
        if (Number.isFinite(enriched.capitalAtRisk)) {
            enriched.capitalAtRisk = Number(enriched.capitalAtRisk.toFixed(2));
        }
        enriched.maxRiskLabel = riskInfo.maxRiskLabel;
        enriched.riskIsUnlimited = riskInfo.unlimited;

        const openedDate = this.parseDateValue(enriched.openedDate || enriched.entryDate || legSummary.openedDate);
        const closedDate = this.parseDateValue(enriched.closedDate || enriched.exitDate || (legSummary.closeLegs > 0 ? legSummary.closedDate : null));

        let expirationDate = this.parseDateValue(enriched.expirationDate);
        if (!expirationDate && legSummary.latestExpiration) {
            expirationDate = legSummary.latestExpiration;
        }

        const pmccShortExpiration = legSummary.nextShortCallExpiration || legSummary.nearestShortCallExpiration || null;
        if (this.isPmccTrade(enriched) && pmccShortExpiration) {
            expirationDate = pmccShortExpiration;
        }

        enriched.pmccShortExpiration = pmccShortExpiration ? pmccShortExpiration.toISOString().slice(0, 10) : '';
        enriched.longExpirationDate = legSummary.latestExpiration ? legSummary.latestExpiration.toISOString().slice(0, 10) : '';

        enriched.openedDate = openedDate ? openedDate.toISOString().slice(0, 10) : '';
        enriched.closedDate = closedDate ? closedDate.toISOString().slice(0, 10) : '';
        enriched.entryDate = enriched.openedDate;
        enriched.exitDate = enriched.closedDate;
        enriched.expirationDate = expirationDate ? expirationDate.toISOString().slice(0, 10) : '';

        enriched.pl = this.calculatePL(enriched);
        enriched.roi = this.calculateROI(enriched);
        enriched.maxRisk = this.calculateMaxRisk(enriched);
        if (!enriched.maxRiskLabel) {
            enriched.maxRiskLabel = Number.isFinite(enriched.maxRisk)
                ? this.formatCurrency(enriched.maxRisk)
                : enriched.maxRisk === Number.POSITIVE_INFINITY
                    ? 'Unlimited'
                    : '—';
        }

        const lifecycle = this.determineTradeLifecycleStatus(enriched, legSummary);
        enriched.lifecycleMeta = lifecycle.meta;
        enriched.lifecycleStatus = lifecycle.status;

        if (typeof lifecycle.openContractsOverride === 'number') {
            enriched.openContracts = Math.max(0, lifecycle.openContractsOverride);
        }

        if (lifecycle.effectiveClosedDate) {
            enriched.closedDate = lifecycle.effectiveClosedDate;
            enriched.exitDate = lifecycle.effectiveClosedDate;
        }

        if (lifecycle.exitReason && !enriched.exitReason) {
            enriched.exitReason = lifecycle.exitReason;
        }

        enriched.partialClose = Boolean(lifecycle.meta?.hasCloseActivity && lifecycle.meta?.unmatchedExposure > 0);
        enriched.rolledForward = Boolean(lifecycle.meta?.hasRollLegs);
        enriched.autoExpired = lifecycle.status === 'Expired' && Boolean(lifecycle.meta?.expirationPassed);

        const manualStatus = this.normalizeTradeStatusInput(trade.statusOverride);
        if (manualStatus) {
            enriched.statusOverride = manualStatus;
            enriched.status = manualStatus;
        } else {
            if ('statusOverride' in enriched) {
                delete enriched.statusOverride;
            }
            enriched.status = lifecycle.status;
        }

        enriched.daysHeld = this.calculateDaysHeld(enriched);
        enriched.dte = this.calculateDTE(enriched.expirationDate, enriched);
        enriched.annualizedROI = this.calculateAnnualizedROI(enriched);

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

    normalizeUnderlyingType(type, { fallback = 'Stock' } = {}) {
        const normalized = (type || '').toString().trim().toLowerCase();
        if (['stock', 'etf', 'index', 'future'].includes(normalized)) {
            return normalized.charAt(0).toUpperCase() + normalized.slice(1);
        }
        return fallback;
    }
    isWheelPut(trade = {}) {
        const strategy = (trade.strategy || '').toLowerCase();
        return strategy.includes('cash-secured put');
    }

    isCoveredCall(trade = {}) {
        const strategy = (trade.strategy || '').toLowerCase();
        return strategy.includes('covered call');
    }

    isPmccBaseLeg(trade = {}) {
        const strategy = (trade.strategy || '').toLowerCase();
        const direction = trade.tradeDirection || this.inferTradeDirection(trade);
        const tradeType = this.getTradeType(trade);
        return strategy.includes('poor man') && (direction === 'long' || tradeType === 'BTO');
    }

    isPmccShortCall(trade = {}) {
        const strategy = (trade.strategy || '').toLowerCase();
        const direction = trade.tradeDirection || this.inferTradeDirection(trade);
        const tradeType = this.getTradeType(trade);
        return strategy.includes('poor man') && (direction === 'short' || tradeType === 'STO');
    }

    isPmccTrade(trade = {}) {
        if (!trade) {
            return false;
        }

        const strategy = (trade.strategy || '').toLowerCase();
        if (strategy.includes('poor man') || strategy.includes('pmcc')) {
            return true;
        }

        return this.isPmccBaseLeg(trade) || this.isPmccShortCall(trade);
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
                if (sortBy) {
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
                if (prompt) {
                    this.handleAIQuickPrompt(prompt);
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

    initializeCumulativePLControls() {
        const controls = document.getElementById('cumulative-pl-controls');
        if (!controls) {
            return;
        }

        if (controls.dataset.initialized === 'true') {
            this.syncCumulativePLControls();
            return;
        }

        controls.addEventListener('click', (event) => {
            const target = event.target instanceof HTMLElement
                ? event.target.closest('button[data-range]')
                : null;
            if (!target) {
                return;
            }

            const { range } = target.dataset;
            if (!range) {
                return;
            }

            this.setCumulativePLRange(range);
        });

        controls.dataset.initialized = 'true';
        this.syncCumulativePLControls();
    }

    setCumulativePLRange(range) {
        const normalized = this.normalizeCumulativePLRange(range);
        if (normalized === this.cumulativePLRange) {
            return;
        }

        this.cumulativePLRange = normalized;
        this.syncCumulativePLControls();
        this.updateCumulativePLChart();
        this.refreshShareCardChart();
    }

    syncCumulativePLControls() {
        const controls = document.getElementById('cumulative-pl-controls');
        if (!controls) {
            return;
        }

        const currentRange = this.normalizeCumulativePLRange(this.cumulativePLRange);
        controls.querySelectorAll('button[data-range]').forEach((button) => {
            const buttonRange = this.normalizeCumulativePLRange(button.dataset.range);
            const isActive = buttonRange === currentRange;
            button.classList.toggle('is-active', isActive);
            button.setAttribute('aria-pressed', String(isActive));
        });
    }

    setupAIChatResizeHandle() {
        const panel = document.getElementById('ai-chat-panel');
        const handle = document.getElementById('ai-chat-resize-handle') || panel?.querySelector('.ai-chat__resize-handle');

        if (!panel || !handle || handle.dataset.initialized === 'true') {
            if (handle) {
                handle.dataset.initialized = 'true';
            }
            return;
        }

        const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

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

        const stopResizing = (event) => {
            if (!state.resizing) {
                return;
            }

            state.resizing = false;
            panel.classList.remove('ai-chat__panel--resizing');

            if (event) {
                try {
                    handle.releasePointerCapture(event.pointerId);
                } catch (error) {
                    // Pointer may already be released; ignore.
                }
            }

            document.removeEventListener('pointermove', onPointerMove);
            document.removeEventListener('pointerup', stopResizing);
            document.removeEventListener('pointercancel', stopResizing);
        };

        const onPointerMove = (moveEvent) => {
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

        handle.addEventListener('pointerdown', (event) => {
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
            } catch (error) {
                // Not all pointers support capture; ignore.
            }

            document.addEventListener('pointermove', onPointerMove, { passive: false });
            document.addEventListener('pointerup', stopResizing);
            document.addEventListener('pointercancel', stopResizing);
        });

        handle.dataset.initialized = 'true';
    }

    initializeAIChat() {
        this.updateAIChatHeader();
        if (!this.aiAgent) {
            this.aiChatMessages = [];
            return;
        }

        const snapshot = this.calculateAdvancedStats();
        this.aiAgent.updateContext({
            stats: snapshot,
            openTrades: snapshot.openTradesList,
            closedTrades: snapshot.closedTradesList
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

    toggleAIChat(forceOpen = null) {
        const panel = document.getElementById('ai-chat-panel');
        const toggle = document.getElementById('ai-chat-toggle');
        const input = document.getElementById('ai-chat-input');
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

    async handleAIQuickPrompt(prompt) {
        if (this.aiChatPendingRequest || !prompt) {
            return;
        }

        if (!this.hasAICoachConsent()) {
            this.promptAICoachConsent(() => this.handleAIQuickPrompt(prompt));
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
                ? await this.aiAgent.generateResponse(prompt, { history: historySnapshot })
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

    appendAIChatMessage(sender, text, options = {}) {
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
                    sender: normalizedSender,
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

        const entry = {
            id: id || `${this.aiChatSessionId}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            sender: normalizedSender,
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

    renderAIChatMessages() {
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

    renderMarkdownToHTML(markdown = '') {
        if (!markdown) {
            return '';
        }

        const segments = [];
        const codeBlockRegex = /```([\s\S]*?)```/g;
        let lastIndex = 0;
        let match;

        while ((match = codeBlockRegex.exec(markdown)) !== null) {
            if (match.index > lastIndex) {
                segments.push({ type: 'text', value: markdown.slice(lastIndex, match.index) });
            }
            segments.push({ type: 'code', value: match[1] });
            lastIndex = match.index + match[0].length;
        }

        if (lastIndex < markdown.length) {
            segments.push({ type: 'text', value: markdown.slice(lastIndex) });
        }

        return segments.map(segment => {
            if (segment.type === 'code') {
                const code = segment.value.replace(/^\n+|\n+$/g, '');
                return `<pre class="ai-chat__code"><code>${this.escapeHTML(code)}</code></pre>`;
            }
            return this.renderMarkdownTextSegment(segment.value);
        }).join('');
    }

    renderMarkdownTextSegment(text = '') {
        if (!text) {
            return '';
        }

        const lines = text.replace(/\r/g, '').split('\n');
        const htmlParts = [];
        let paragraphBuffer = [];
        let inUnordered = false;
        let inOrdered = false;

        const closeLists = () => {
            if (inUnordered) {
                htmlParts.push('</ul>');
                inUnordered = false;
            }
            if (inOrdered) {
                htmlParts.push('</ol>');
                inOrdered = false;
            }
        };

        const flushParagraph = () => {
            if (!paragraphBuffer.length) {
                return;
            }
            const content = paragraphBuffer.join(' ').trim();
            if (content) {
                htmlParts.push(`<p>${this.formatMarkdownInline(content)}</p>`);
            }
            paragraphBuffer = [];
        };

        lines.forEach((lineRaw) => {
            const trimmed = lineRaw.trim();

            if (!trimmed) {
                flushParagraph();
                closeLists();
                return;
            }

            const headingMatch = trimmed.match(/^(#{1,3})\s+(.*)$/);
            if (headingMatch) {
                flushParagraph();
                closeLists();
                const level = Math.min(headingMatch[1].length + 2, 6);
                htmlParts.push(`<h${level}>${this.formatMarkdownInline(headingMatch[2])}</h${level}>`);
                return;
            }

            if (/^([-*_])\1{2,}$/.test(trimmed)) {
                flushParagraph();
                closeLists();
                htmlParts.push('<hr class="ai-chat__rule">');
                return;
            }

            if (trimmed.startsWith('>')) {
                flushParagraph();
                closeLists();
                const quoteText = trimmed.replace(/^>\s?/, '');
                htmlParts.push(`<blockquote class="ai-chat__quote">${this.formatMarkdownInline(quoteText)}</blockquote>`);
                return;
            }

            const unorderedMatch = trimmed.match(/^[-*]\s+(.*)$/);
            if (unorderedMatch) {
                flushParagraph();
                if (!inUnordered) {
                    closeLists();
                    htmlParts.push('<ul>');
                    inUnordered = true;
                }
                htmlParts.push(`<li>${this.formatMarkdownInline(unorderedMatch[1])}</li>`);
                return;
            }

            const orderedMatch = trimmed.match(/^\d+\.\s+(.*)$/);
            if (orderedMatch) {
                flushParagraph();
                if (!inOrdered) {
                    closeLists();
                    htmlParts.push('<ol>');
                    inOrdered = true;
                }
                htmlParts.push(`<li>${this.formatMarkdownInline(orderedMatch[1])}</li>`);
                return;
            }

            paragraphBuffer.push(lineRaw);
        });

        flushParagraph();
        closeLists();

        return htmlParts.join('');
    }

    formatMarkdownInline(text = '') {
        if (!text) {
            return '';
        }

        const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
        let lastIndex = 0;
        let result = '';
        let match;

        while ((match = linkRegex.exec(text)) !== null) {
            if (match.index > lastIndex) {
                const preceding = text.slice(lastIndex, match.index);
                result += this.applyBasicInlineFormatting(preceding);
            }

            const label = this.applyBasicInlineFormatting(match[1]);
            const safeUrl = this.escapeHTML(this.sanitizeMarkdownUrl(match[2]));
            result += `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${label}</a>`;
            lastIndex = match.index + match[0].length;
        }

        if (lastIndex < text.length) {
            result += this.applyBasicInlineFormatting(text.slice(lastIndex));
        }

        return result;
    }

    applyBasicInlineFormatting(text = '') {
        if (!text) {
            return '';
        }

        let safe = this.escapeHTML(text);
        safe = safe.replace(/`([^`]+)`/g, '<code>$1</code>');
        safe = safe.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        safe = safe.replace(/__([^_]+)__/g, '<strong>$1</strong>');
        safe = safe.replace(/\*(?!\s)([^*]+?)\*(?!\*)/g, '<em>$1</em>');
        safe = safe.replace(/_([^_]+)_/g, '<em>$1</em>');
        return safe;
    }

    sanitizeMarkdownUrl(url = '') {
        try {
            const trimmed = url.trim();
            if (!trimmed) {
                return '#';
            }
            if (trimmed.startsWith('#')) {
                const anchor = trimmed.slice(1);
                if (anchor && /^[a-z0-9_-]{1,64}$/i.test(anchor)) {
                    return `#${anchor}`;
                }
                return '#';
            }
            const lower = trimmed.toLowerCase();
            if (!lower.startsWith('http://') && !lower.startsWith('https://')) {
                return '#';
            }
            return trimmed;
        } catch (_error) {
            return '#';
        }
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
            'trades-list': 'All Trades',
            import: 'Import Trades',
            settings: 'Settings'
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
            case 'settings': {
                const lastStatus = this.finnhub?.lastStatus;
                if (lastStatus && this.finnhub?.elements?.status) {
                    this.updateFinnhubStatus(lastStatus.message, lastStatus.variant, 0);
                }
                break;
            }
        }
    }

    resetAddTradeForm() {
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

    parseDecimal(value, defaultValue = null, { allowNegative = true } = {}) {
        if (value === null || value === undefined) {
            return defaultValue;
        }

        let normalized = typeof value === 'string' ? value.trim() : value;
        if (typeof normalized === 'string') {
            if (normalized === '') {
                return defaultValue;
            }

            let text = normalized.replace(/\s+/g, '');
            if (!text) {
                return defaultValue;
            }

            const hasComma = text.includes(',');
            const hasDot = text.includes('.');

            if (hasComma && !hasDot) {
                text = text.replace(/,/g, '.');
            } else if (hasComma && hasDot) {
                const lastComma = text.lastIndexOf(',');
                const lastDot = text.lastIndexOf('.');
                if (lastComma > lastDot) {
                    text = text.replace(/\./g, '').replace(/,/g, '.');
                } else {
                    text = text.replace(/,/g, '');
                }
            }

            text = text.replace(/_/g, '');
            normalized = text;
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

    parseDateValue(value) {
        if (!value) {
            return null;
        }

        if (value instanceof Date) {
            return Number.isNaN(value.getTime()) ? null : value;
        }

        const normalized = value.toString().trim();
        if (!normalized) {
            return null;
        }

        const parsed = new Date(normalized);
        if (Number.isNaN(parsed.getTime())) {
            return null;
        }

        return parsed;
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

        this.latestStats = stats;

        if (this.aiAgent) {
            this.aiAgent.updateContext({
                stats,
                openTrades: openTradesList,
                closedTrades: closedTradesList
            });
        }

        // Update overview cards
        const winRateFormatted = this.formatNumber(stats.winRate, { style: 'percent', decimals: 1 });
        document.getElementById('win-rate').textContent = winRateFormatted ?? '—';
        document.getElementById('win-loss-count').textContent = `${stats.wins}W / ${stats.losses}L`;
        const profitFactorValue = Number(stats.profitFactor);
        document.getElementById('profit-factor').textContent = Number.isFinite(profitFactorValue)
            ? this.formatNumber(profitFactorValue, { decimals: 2, useGrouping: false }).toString()
            : 'Infinite';
        document.getElementById('active-positions').textContent = stats.activePositions;
        
        // Update new metrics
        document.getElementById('collateral-at-risk').textContent = this.formatCurrency(stats.collateralAtRisk);
        document.getElementById('realized-pl').textContent = this.formatCurrency(stats.realizedPL);
        
        const unrealizedPLElement = document.getElementById('unrealized-pl');
        unrealizedPLElement.textContent = this.formatCurrency(stats.unrealizedPL);
        unrealizedPLElement.className = 'card-value';
        if (stats.unrealizedPL > 0) {
            unrealizedPLElement.classList.add('pl-positive');
        } else if (stats.unrealizedPL < 0) {
            unrealizedPLElement.classList.add('pl-negative');
        }
        
        document.getElementById('total-roi').textContent = this.formatNumber(stats.totalROI, { style: 'percent' }) ?? '—';

        // Update tables
        this.updateActivePositionsTable(openTradesList);
        this.updateRecentTradesTable(closedTradesList, stats.activePositions);
        this.updateShareCard(stats);
        this.refreshShareCardChart();
        this.syncCumulativePLControls();

        // Update charts with delay
        setTimeout(() => {
            this.updateAllCharts();
        }, 200);
    }

    calculateAdvancedStats() {
        const closedTrades = this.trades.filter(trade => this.isClosedStatus(trade.status));
        const openTrades = this.trades.filter(trade => this.isActiveStatus(trade.status));
        const winningTrades = closedTrades.filter(trade => trade.pl > 0);
        const losingTrades = closedTrades.filter(trade => trade.pl < 0);

        const totalPL = closedTrades.reduce((sum, trade) => sum + trade.pl, 0);
        const totalMaxRisk = closedTrades.reduce((sum, trade) => {
            const capital = this.getCapitalAtRisk(trade);
            return Number.isFinite(capital) && capital > 0 ? sum + capital : sum;
        }, 0);
        const winRate = closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0;

        const totalWins = winningTrades.reduce((sum, trade) => sum + Math.max(trade.pl, 0), 0);
        const totalLosses = losingTrades.reduce((sum, trade) => sum + Math.abs(trade.pl), 0);
        let profitFactor = 0;
        if (totalLosses > 0) {
            profitFactor = totalWins / totalLosses;
        } else if (totalWins > 0) {
            profitFactor = Number.POSITIVE_INFINITY;
        }

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

    const totalROI = totalMaxRisk > 0 ? (totalPL / totalMaxRisk) * 100 : 0;
        const avgDaysHeld = closedTrades.length > 0 ? closedTrades.reduce((sum, trade) => sum + trade.daysHeld, 0) / closedTrades.length : 0;
        const annualizedROI = avgDaysHeld > 0 ? (Math.pow(1 + totalROI / 100, 365 / avgDaysHeld) - 1) * 100 : 0;

        const totalFees = closedTrades.reduce((sum, trade) => {
            const fees = Number(trade.totalFees);
            if (Number.isFinite(fees)) {
                return sum + fees;
            }
            const fallback = Number(trade.fees);
            return Number.isFinite(fallback) ? sum + fallback : sum;
        }, 0);

        const grossExposure = totalFees + totalWins + totalLosses;
        const feeShareOfGross = grossExposure > 0 ? (totalFees / grossExposure) * 100 : 0;

        const dailyReturns = closedTrades
            .map(trade => {
                const roiPercent = Number(trade.roi);
                const daysHeldValue = Math.max(1, Number(trade.daysHeld) || 0);

                if (Number.isFinite(roiPercent)) {
                    const growth = 1 + roiPercent / 100;
                    if (growth > 0) {
                        return Math.pow(growth, 1 / daysHeldValue) - 1;
                    }
                    return (roiPercent / 100) / daysHeldValue;
                }

                const capital = this.getCapitalAtRisk(trade);
                const plValue = Number(trade.pl) || 0;
                if (!(capital > 0)) {
                    return null;
                }
                const derivedRoi = (plValue / capital) * 100;
                if (!Number.isFinite(derivedRoi)) {
                    return null;
                }
                const growth = 1 + derivedRoi / 100;
                if (growth > 0) {
                    return Math.pow(growth, 1 / daysHeldValue) - 1;
                }
                return (derivedRoi / 100) / daysHeldValue;
            })
            .filter(value => Number.isFinite(value));

        const meanDailyReturn = dailyReturns.length
            ? dailyReturns.reduce((sum, value) => sum + value, 0) / dailyReturns.length
            : 0;

        let dailyStdDev = 0;
        if (dailyReturns.length > 1) {
            const variance = dailyReturns.reduce((sum, value) => sum + Math.pow(value - meanDailyReturn, 2), 0) / (dailyReturns.length - 1);
            dailyStdDev = variance > 0 ? Math.sqrt(variance) : 0;
        }

        const downsideReturns = dailyReturns.filter(value => value < 0);
        const downsideDeviation = downsideReturns.length
            ? Math.sqrt(downsideReturns.reduce((sum, value) => sum + value * value, 0) / downsideReturns.length)
            : 0;

        const sharpeRatio = dailyStdDev > 0 ? (meanDailyReturn / dailyStdDev) * Math.sqrt(252) : null;
        const sortinoRatio = downsideDeviation > 0
            ? (meanDailyReturn / downsideDeviation) * Math.sqrt(252)
            : (downsideReturns.length === 0 && meanDailyReturn > 0 ? Number.POSITIVE_INFINITY : null);

        const avgWinnerDays = winningTrades.length > 0
            ? winningTrades.reduce((sum, trade) => sum + (Number(trade.daysHeld) || 0), 0) / winningTrades.length
            : 0;

        const avgLoserDays = losingTrades.length > 0
            ? losingTrades.reduce((sum, trade) => sum + (Number(trade.daysHeld) || 0), 0) / losingTrades.length
            : 0;

        const tickerPerformance = this.calculateTickerPerformance(closedTrades);

        // Calculate new metrics for dashboard widgets
        // Collateral at Risk: Total capital tied up in open positions
        const collateralAtRisk = openTrades.reduce((sum, trade) => {
            const capital = this.getCapitalAtRisk(trade);
            return Number.isFinite(capital) && capital > 0 ? sum + capital : sum;
        }, 0);

        // Realized P&L: Actual profits/losses from closed trades (same as totalPL)
        const realizedPL = totalPL;

        // Unrealized P&L: Estimated current P&L on open positions
        const unrealizedPL = openTrades.reduce((sum, trade) => {
            const pl = Number(trade.pl);
            return Number.isFinite(pl) ? sum + pl : sum;
        }, 0);

        return {
            totalTrades: this.trades.length,
            totalPL,
            winRate,
            wins: winningTrades.length,
            losses: losingTrades.length,
            profitFactor,
            activePositions: openTrades.length,
            totalROI,
            annualizedROI,
            maxDrawdown,
            closedTrades: closedTrades.length,
            totalInvestment: totalMaxRisk,
            totalMaxRisk,
            closedTradesList: closedTrades,
            openTradesList: openTrades,
            totalFees,
            feeShareOfGross,
            dailyReturns,
            meanDailyReturn,
            dailyStdDev,
            downsideDeviation,
            sharpeRatio,
            sortinoRatio,
            avgWinnerDays,
            avgLoserDays,
            tickerPerformance,
            collateralAtRisk,
            realizedPL,
            unrealizedPL
        };
    }

    calculateTickerPerformance(trades = []) {
        const map = new Map();

        trades.forEach(trade => {
            const ticker = (trade.ticker || 'Unknown').toString().trim().toUpperCase() || 'UNKNOWN';
            if (!map.has(ticker)) {
                map.set(ticker, {
                    ticker,
                    totalPL: 0,
                    tradeCount: 0,
                    wins: 0,
                    losses: 0
                });
            }

            const entry = map.get(ticker);
            const plValue = Number(trade.pl) || 0;
            entry.totalPL += plValue;
            entry.tradeCount += 1;
            if (plValue > 0) {
                entry.wins += 1;
            } else if (plValue < 0) {
                entry.losses += 1;
            }
        });

        const items = Array.from(map.values())
            .map(entry => {
                const winRate = entry.tradeCount > 0 ? (entry.wins / entry.tradeCount) * 100 : 0;
                const avgPL = entry.tradeCount > 0 ? entry.totalPL / entry.tradeCount : 0;
                return {
                    ...entry,
                    avgPL,
                    winRate
                };
            })
            .sort((a, b) => Math.abs(b.totalPL) - Math.abs(a.totalPL));

        const maxMagnitude = items.length ? Math.max(...items.map(item => Math.abs(item.totalPL))) : 0;

        return {
            items,
            maxMagnitude
        };
    }


    updateActivePositionsTable(openTrades = this.trades.filter(trade => this.isActiveStatus(trade.status))) {
        const tbody = document.querySelector('#active-positions-table tbody');

        if (tbody) {
            tbody.innerHTML = '';

            const sortedTrades = [...(Array.isArray(openTrades) ? openTrades : [])].sort((a, b) => {
                const dteA = this.parseInteger(a.dte, Number.POSITIVE_INFINITY, { allowNegative: false });
                const dteB = this.parseInteger(b.dte, Number.POSITIVE_INFINITY, { allowNegative: false });
                return dteA - dteB;
            });

            const columnLabels = ['Ticker', 'Strategy', 'Strike', 'Current Price', 'DTE', 'Max Risk', 'Notes'];
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

                const strikeCell = row.insertCell(2);
                let resolvedStrike = this.parseDecimal(trade.activeStrikePrice, null, { allowNegative: false });

                if (resolvedStrike === null && Array.isArray(trade.legs) && trade.legs.length > 0) {
                    const strikeSummary = this.summarizeLegs(trade.legs);
                    const summaryStrike = this.getActiveStrikeForDisplay(strikeSummary);
                    if (Number.isFinite(summaryStrike)) {
                        resolvedStrike = summaryStrike;
                    }
                }

                if (resolvedStrike === null) {
                    resolvedStrike = this.parseDecimal(trade.strikePrice, null, { allowNegative: false });
                }

                if (Number.isFinite(resolvedStrike)) {
                    const strikeLabel = this.formatNumber(resolvedStrike, { style: 'currency', decimals: 2 });
                    strikeCell.textContent = strikeLabel ?? '—';
                    row.dataset.strikePrice = String(resolvedStrike);
                } else {
                    strikeCell.textContent = '—';
                    delete row.dataset.strikePrice;
                }

                const priceCell = row.insertCell(3);
                priceCell.className = 'quote-cell';
                const baseQuoteKey = this.getQuoteEntryKey(trade);
                const quoteKey = `${baseQuoteKey}|row:${quoteEntries.size}`;
                row.dataset.quoteKey = quoteKey;
                this.populateQuoteCell(priceCell, trade, row, { deferNetworkFetch: true });
                quoteEntries.set(quoteKey, { trade, row, cell: priceCell, key: quoteKey });

                const dteValue = this.parseInteger(trade.dte, null, { allowNegative: false });
                const dteCell = row.insertCell(4);
                dteCell.textContent = dteValue !== null ? dteValue : '—';
                if (Number.isFinite(dteValue)) {
                    row.dataset.dte = String(dteValue);
                } else {
                    delete row.dataset.dte;
                }

                const maxRiskCell = row.insertCell(5);
                const maxRiskValue = this.parseDecimal(trade.maxRisk, null, { allowNegative: false });
                if (maxRiskValue !== null) {
                    maxRiskCell.textContent = this.formatCurrency(maxRiskValue);
                    maxRiskCell.className = 'pl-negative';
                } else {
                    maxRiskCell.textContent = '—';
                    maxRiskCell.className = 'pl-neutral';
                }

                const notesCell = row.insertCell(6);
                const noteText = (trade.notes || '').trim();
                notesCell.textContent = noteText || '—';
                notesCell.classList.add('notes-cell');
                if (noteText) {
                    notesCell.title = noteText;
                }

                this.updateExpirationHighlight(dteCell, trade);

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
        activeCount = this.trades.filter(trade => this.isActiveStatus(trade.status)).length
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
                const roiDisplay = this.formatPercent(roiValue, '—');
                roiCell.textContent = roiDisplay;
                if (roiDisplay === '—') {
                    roiCell.className = 'pl-neutral';
                } else {
                    roiCell.className = roiValue >= 0 ? 'pl-positive' : 'pl-negative';
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
        this.updatePerformanceGauges();
        this.updateCommissionImpactChart();
        this.updateTimeInTradeChart();
        this.updateMonteCarloChart();
        this.renderTickerHeatmap();
    }

    updatePerformanceGauges() {
        const stats = this.latestStats;
        this.renderRatioGauge({
            chartKey: 'sharpeGauge',
            canvasId: 'sharpeGaugeChart',
            valueElementId: 'sharpeGaugeValue',
            value: stats?.sharpeRatio,
            min: -1,
            max: 3
        });

        this.renderRatioGauge({
            chartKey: 'sortinoGauge',
            canvasId: 'sortinoGaugeChart',
            valueElementId: 'sortinoGaugeValue',
            value: stats?.sortinoRatio,
            min: -1,
            max: 4
        });
    }

    renderRatioGauge({ chartKey, canvasId, valueElementId, value, min = 0, max = 1 }) {
        const valueElement = document.getElementById(valueElementId);
        if (valueElement) {
            valueElement.textContent = this.formatNumber(value, { decimals: 2, useGrouping: false }) ?? '—';
        }

        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            return;
        }

        if (!Number.isFinite(value)) {
            if (this.charts[chartKey]) {
                this.charts[chartKey].destroy();
                delete this.charts[chartKey];
            }
            return;
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return;
        }

        const clamped = Math.min(Math.max(value, min), max);
        const range = Math.max(max - min, 1);
        const progress = (clamped - min) / range;
        const normalized = Number.isFinite(progress) ? Math.max(Math.min(progress, 1), 0) : 0;
        const remainder = Math.max(1 - normalized, 0);

        const primaryColor = value >= 1.5
            ? '#1FB8CD'
            : value >= 0.75
                ? '#FFC185'
                : '#B4413C';

        const formattedValue = this.formatNumber(value, { decimals: 2, useGrouping: false })
            ?? (Number.isFinite(value) ? value.toFixed(2) : '—');

        if (this.charts[chartKey]) {
            this.charts[chartKey].destroy();
        }

        this.charts[chartKey] = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Ratio', 'Remaining'],
                datasets: [{
                    data: [normalized, remainder],
                    backgroundColor: [primaryColor, 'rgba(148, 163, 184, 0.25)'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                rotation: -90,
                circumference: 180,
                cutout: '70%',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: () => `Ratio: ${formattedValue}`
                        }
                    }
                }
            }
        });
    }

    updateCommissionImpactChart() {
        const canvas = document.getElementById('commissionImpactChart');
        const summaryElement = document.getElementById('commissionImpactSummary');
        const stats = this.latestStats;

        if (!canvas) {
            return;
        }

        if (!stats) {
            if (summaryElement) {
                summaryElement.textContent = 'No closed trades yet.';
            }
            if (this.charts.commissionImpact) {
                this.charts.commissionImpact.destroy();
                delete this.charts.commissionImpact;
            }
            return;
        }

        const totalFees = Number(stats.totalFees) || 0;
        const netPL = Number(stats.totalPL) || 0;
        const feeShare = Number(stats.feeShareOfGross) || 0;

        if (summaryElement) {
            if (totalFees === 0 && netPL === 0) {
                summaryElement.textContent = 'No closed trades yet.';
            } else {
            const shareText = this.formatNumber(feeShare, { decimals: 1, useGrouping: true }) ?? '0.0';
                summaryElement.textContent = `${this.formatCurrency(totalFees)} in fees (${shareText}% of realized turnover).`;
            }
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return;
        }

        if (this.charts.commissionImpact) {
            this.charts.commissionImpact.destroy();
        }

    const formatCurrencyValue = (value, decimals = 2) => this.formatCurrency(value, { decimals });

        this.charts.commissionImpact = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Net P&L', 'Fees'],
                datasets: [{
                    label: 'Amount',
                    data: [netPL, totalFees],
                    backgroundColor: [
                        netPL >= 0 ? '#1FB8CD' : '#B4413C',
                        '#B4413C'
                    ],
                    borderRadius: 8,
                    borderSkipped: false
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        ticks: {
                            callback: (value) => formatCurrencyValue(value, 0)
                        },
                        grid: {
                            drawBorder: false
                        }
                    },
                    y: {
                        grid: {
                            display: false
                        }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => `${context.label}: ${formatCurrencyValue(context.raw)}`
                        }
                    }
                }
            }
        });
    }

    renderTickerHeatmap() {
        const container = document.getElementById('tickerHeatmap');
        if (!container) {
            return;
        }

        container.innerHTML = '';

        const stats = this.latestStats;
        const items = stats?.tickerPerformance?.items || [];
        if (!items.length) {
            const empty = document.createElement('div');
            empty.className = 'heatmap-empty';
            empty.textContent = 'Add more closed trades to see per-ticker performance.';
            container.appendChild(empty);
            return;
        }

        const maxMagnitude = stats?.tickerPerformance?.maxMagnitude || 1;
        const subset = items.slice(0, 12);

        subset.forEach((item) => {
            const card = document.createElement('div');
            card.className = 'heatmap-card';

            const baseColor = item.totalPL >= 0 ? [31, 184, 205] : [180, 65, 60];
            const normalized = maxMagnitude > 0 ? Math.min(Math.abs(item.totalPL) / maxMagnitude, 1) : 0;
            const alpha = 0.15 + normalized * 0.55;
            const borderAlpha = Math.min(alpha + 0.1, 0.9);

            card.style.backgroundColor = `rgba(${baseColor[0]}, ${baseColor[1]}, ${baseColor[2]}, ${alpha.toFixed(2)})`;
            card.style.borderColor = `rgba(${baseColor[0]}, ${baseColor[1]}, ${baseColor[2]}, ${borderAlpha.toFixed(2)})`;

            const tickerEl = document.createElement('div');
            tickerEl.className = 'heatmap-card__ticker';
            tickerEl.textContent = item.ticker;

            const plEl = document.createElement('div');
            plEl.className = `heatmap-card__pl ${item.totalPL >= 0 ? 'pl-positive' : 'pl-negative'}`;
            plEl.textContent = this.formatCurrency(item.totalPL);

            const metaEl = document.createElement('div');
            metaEl.className = 'heatmap-card__meta';
            const tradeCountLabel = this.formatNumber(item.tradeCount, { decimals: 0, useGrouping: true }) ?? String(item.tradeCount ?? 0);
            const winRateLabel = this.formatPercent(item.winRate, '0%', { decimals: 0 });
            metaEl.textContent = `${tradeCountLabel} trades • Win ${winRateLabel}`;

            card.appendChild(tickerEl);
            card.appendChild(plEl);
            card.appendChild(metaEl);

            container.appendChild(card);
        });
    }

    updateTimeInTradeChart() {
        const canvas = document.getElementById('timeInTradeChart');
        const stats = this.latestStats;

        if (!canvas) {
            return;
        }

        if (!stats || stats.closedTrades === 0 || (!Number.isFinite(stats.avgWinnerDays) && !Number.isFinite(stats.avgLoserDays))) {
            if (this.charts.timeInTrade) {
                this.charts.timeInTrade.destroy();
                delete this.charts.timeInTrade;
            }
            return;
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return;
        }

        if (this.charts.timeInTrade) {
            this.charts.timeInTrade.destroy();
        }

        const winners = Number.isFinite(stats.avgWinnerDays) ? stats.avgWinnerDays : 0;
        const losers = Number.isFinite(stats.avgLoserDays) ? stats.avgLoserDays : 0;
        const formatDayCount = (value, decimals = 1) => {
            const numeric = Number(value);
            if (!Number.isFinite(numeric)) {
                return '';
            }
            return this.formatNumber(numeric, { decimals, useGrouping: true }) ?? numeric.toFixed(decimals);
        };

        this.charts.timeInTrade = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Winners', 'Losers'],
                datasets: [{
                    label: 'Average Days Held',
                    data: [winners, losers],
                    backgroundColor: ['#1FB8CD', '#B4413C'],
                    borderRadius: 8,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => {
                                const label = formatDayCount(value, 0);
                                return label ? `${label}d` : `${value}d`;
                            }
                        },
                        grid: {
                            drawBorder: false
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const label = formatDayCount(context.raw, 1);
                                return `${context.label}: ${label || context.raw} days`;
                            }
                        }
                    }
                }
            }
        });
    }

    updateMonteCarloChart() {
        const canvas = document.getElementById('monteCarloChart');
        const summaryElement = document.getElementById('monteCarloSummary');
        const stats = this.latestStats;

        if (!canvas) {
            return;
        }

        if (!stats || !Array.isArray(stats.dailyReturns) || stats.dailyReturns.length < 2) {
            if (summaryElement) {
                summaryElement.textContent = 'Need more closed trades to run projections.';
            }
            if (this.charts.monteCarlo) {
                this.charts.monteCarlo.destroy();
                delete this.charts.monteCarlo;
            }
            return;
        }

        const projection = this.generateMonteCarloProjection(stats.dailyReturns, { periods: 60, simulations: 400 });
        if (!projection) {
            if (summaryElement) {
                summaryElement.textContent = 'Need more closed trades to run projections.';
            }
            if (this.charts.monteCarlo) {
                this.charts.monteCarlo.destroy();
                delete this.charts.monteCarlo;
            }
            return;
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return;
        }

        if (this.charts.monteCarlo) {
            this.charts.monteCarlo.destroy();
        }

        const medianTerminal = projection.percentiles.p50[projection.percentiles.p50.length - 1] || 1;
        if (summaryElement) {
            const pctChange = (medianTerminal - 1) * 100;
            const formattedNumber = this.formatNumber(Math.abs(pctChange), { decimals: 1, useGrouping: true })
                ?? Math.abs(pctChange).toFixed(1);
            const prefix = pctChange >= 0 ? '+' : '-';
            summaryElement.textContent = `Median path suggests ${prefix}${formattedNumber}% over 60 trading days.`;
        }

        const formatPercent = (value) => {
            const percent = (Number(value) - 1) * 100;
            const formattedNumber = this.formatNumber(Math.abs(percent), { decimals: 1, useGrouping: true })
                ?? Math.abs(percent).toFixed(1);
            const prefix = percent >= 0 ? '+' : '-';
            return `${prefix}${formattedNumber}%`;
        };

        const zeroLinePlugin = {
            id: 'monteCarloBaseline',
            afterDatasetsDraw: (chartInstance) => {
                this.ensureMonteCarloBaseline(chartInstance);
            }
        };

        this.charts.monteCarlo = new Chart(ctx, {
            type: 'line',
            data: {
                labels: projection.labels,
                datasets: [
                    {
                        label: '10th percentile',
                        data: projection.percentiles.p10,
                        borderColor: 'rgba(180, 65, 60, 0.6)',
                        backgroundColor: 'rgba(180, 65, 60, 0.12)',
                        borderWidth: 1.5,
                        fill: false,
                        tension: 0.25
                    },
                    {
                        label: '90th percentile',
                        data: projection.percentiles.p90,
                        borderColor: 'rgba(31, 184, 205, 0.6)',
                        backgroundColor: 'rgba(31, 184, 205, 0.12)',
                        borderWidth: 1.5,
                        fill: '-1',
                        tension: 0.25
                    },
                    {
                        label: 'Median',
                        data: projection.percentiles.p50,
                        borderColor: '#1FB8CD',
                        borderWidth: 2,
                        tension: 0.25,
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                scales: {
                    y: {
                        ticks: {
                            callback: (value) => formatPercent(value)
                        },
                        grid: {
                            drawBorder: false
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            maxTicksLimit: 12
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'bottom'
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => `${context.dataset.label}: ${formatPercent(context.parsed.y)}`
                        }
                    }
                }
            },
            plugins: [zeroLinePlugin]
        });
    }

    ensureMonteCarloBaseline(chart) {
        if (!chart) {
            return;
        }

        const ctx = chart.ctx;
        const yScale = chart.scales?.y;
        const area = chart.chartArea;
        if (!ctx || !yScale || !area) {
            return;
        }

        const zeroPixel = yScale.getPixelForValue(1);
        if (!Number.isFinite(zeroPixel)) {
            return;
        }

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(area.left, zeroPixel);
        ctx.lineTo(area.right, zeroPixel);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(146, 149, 152, 0.85)';
        ctx.setLineDash([]);
        ctx.stroke();
        ctx.restore();
    }

    generateMonteCarloProjection(dailyReturns = [], { periods = 60, simulations = 400 } = {}) {
        if (!Array.isArray(dailyReturns) || dailyReturns.length === 0) {
            return null;
        }

        const sanitized = dailyReturns.filter(value => Number.isFinite(value));
        if (!sanitized.length) {
            return null;
        }

        const trajectory = Array.from({ length: periods }, () => []);

        for (let sim = 0; sim < simulations; sim += 1) {
            let equity = 1;
            for (let step = 0; step < periods; step += 1) {
                const randomIndex = Math.floor(Math.random() * sanitized.length);
                let sample = sanitized[randomIndex];
                if (!Number.isFinite(sample)) {
                    sample = 0;
                }
                sample = Math.max(-0.95, Math.min(sample, 5));
                equity *= 1 + sample;
                equity = Math.max(equity, 0);
                trajectory[step].push(Number(equity.toFixed(6)));
            }
        }

        const percentilesList = [0.1, 0.25, 0.5, 0.75, 0.9];
        const percentileSeries = percentilesList.map(() => []);

        trajectory.forEach(stepValues => {
            if (!stepValues.length) {
                percentilesList.forEach((_, idx) => percentileSeries[idx].push(1));
                return;
            }

            const sorted = stepValues.slice().sort((a, b) => a - b);
            percentilesList.forEach((percentile, index) => {
                const target = (sorted.length - 1) * percentile;
                const lowerIndex = Math.floor(target);
                const upperIndex = Math.ceil(target);
                if (lowerIndex === upperIndex) {
                    percentileSeries[index].push(sorted[lowerIndex]);
                    return;
                }
                const lower = sorted[lowerIndex];
                const upper = sorted[upperIndex];
                const weight = target - lowerIndex;
                const interpolated = lower + (upper - lower) * weight;
                percentileSeries[index].push(Number(interpolated.toFixed(6)));
            });
        });

        return {
            labels: Array.from({ length: periods }, (_, idx) => `Day ${idx + 1}`),
            percentiles: {
                p10: percentileSeries[0],
                p25: percentileSeries[1],
                p50: percentileSeries[2],
                p75: percentileSeries[3],
                p90: percentileSeries[4]
            }
        };
    }

    initializeGeminiControls() {
        const container = document.getElementById('gemini-controls');
        if (!container) {
            return;
        }

        const keyInput = document.getElementById('gemini-api-key');
        const modelSelect = document.getElementById('gemini-model');
        const saveButton = document.getElementById('gemini-save');
        const clearButton = document.getElementById('gemini-clear');
        const status = document.getElementById('gemini-status');

        this.gemini.elements = {
            container,
            keyInput,
            modelSelect,
            saveButton,
            clearButton,
            status
        };

        this.syncGeminiControlsFromState({ preserveStatus: Boolean(this.gemini.pendingStatus) });

        if (!GEMINI_ALLOWED_MODELS.includes(this.gemini.model)) {
            this.gemini.model = DEFAULT_GEMINI_MODEL;
        }

        if (modelSelect) {
            const options = Array.from(modelSelect.options).map(option => option.value);
            if (options.length === 0) {
                GEMINI_ALLOWED_MODELS.forEach(model => {
                    const option = document.createElement('option');
                    option.value = model;
                    option.textContent = model.replace(/gemini-2\.5-/, 'Gemini 2.5 ').replace(/-/g, ' ').replace(/\b([a-z])/g, (_, letter) => letter.toUpperCase());
                    modelSelect.appendChild(option);
                });
            }

            modelSelect.value = GEMINI_ALLOWED_MODELS.includes(this.gemini.model)
                ? this.gemini.model
                : DEFAULT_GEMINI_MODEL;

            this.setGeminiModel(modelSelect.value);

            modelSelect.addEventListener('change', () => {
                this.setGeminiModel(modelSelect.value);
                this.saveGeminiConfigToStorage();
            });
        }

        const commit = async () => {
            const value = (keyInput?.value || '').trim();
            this.setGeminiApiKey(value, { persist: false, updateUI: false });
            const sanitizedValue = this.gemini.apiKey;

            const cryptoApi = this.getCrypto();

            if (!value) {
                this.removeGeminiEncryptionKey();
                this.saveGeminiConfigToStorage();
                if (keyInput) {
                    keyInput.value = '';
                }
                this.updateGeminiStatus('API key cleared. Connect your Gemini key via Settings to get tailored analysis.', 'neutral', 6000);
                this.initializeAIChat();
                this.updateAIChatHeader();
                return;
            }

            if (!cryptoApi?.subtle) {
                this.saveGeminiConfigToStorage({ includeApiKey: true });
                this.updateGeminiStatus('Gemini API key saved (unencrypted — Web Crypto unavailable).', 'success', 6000);
                if (keyInput) {
                    keyInput.value = sanitizedValue;
                }
                this.initializeAIChat();
                this.updateAIChatHeader();
                return;
            }

            const encrypted = await this.encryptAndStoreGeminiApiKey(cryptoApi);
            if (encrypted) {
                this.updateGeminiStatus('Gemini API key saved securely.', 'success', 5000);
            } else {
                this.saveGeminiConfigToStorage({ includeApiKey: true });
                this.updateGeminiStatus('Gemini API key saved (unencrypted fallback).', 'neutral', 6000);
            }

            if (keyInput) {
                keyInput.value = sanitizedValue;
            }

            this.initializeAIChat();
            this.updateAIChatHeader();
        };

        saveButton?.addEventListener('click', async (event) => {
            event.preventDefault();
            await commit();
        });

        keyInput?.addEventListener('keydown', async (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                await commit();
            }
        });

        clearButton?.addEventListener('click', (event) => {
            event.preventDefault();
            if (keyInput) {
                keyInput.value = '';
            }
            this.setGeminiApiKey('', { persist: false, updateUI: false });
            this.removeGeminiEncryptionKey();
            this.saveGeminiConfigToStorage();
            this.updateGeminiStatus('API key cleared. Connect your Gemini key via Settings to get tailored analysis.', 'neutral', 6000);
            this.initializeAIChat();
            this.updateAIChatHeader();
        });

        this.updateAIChatHeader();
        this.flushPendingGeminiStatus();
    }

    syncGeminiControlsFromState({ preserveStatus = true } = {}) {
        const keyInput = this.gemini?.elements?.keyInput;
        const nextValue = this.gemini?.apiKey ? this.gemini.apiKey : '';

        if (keyInput && keyInput.value !== nextValue) {
            keyInput.value = nextValue;
        }

        const hasKey = Boolean(nextValue);
        const shouldUpdateStatus = !preserveStatus && !this.gemini?.pendingStatus;
        const shouldBootstrapStatus = preserveStatus && !this.gemini?.lastStatus && !this.gemini?.pendingStatus;

        if ((shouldUpdateStatus || shouldBootstrapStatus) && this.updateGeminiStatus) {
            const message = hasKey ? 'API key loaded' : 'Not set';
            const variant = hasKey ? 'success' : 'neutral';
            this.updateGeminiStatus(message, variant);
        }

        this.updateAIChatHeader();
    }

    flushPendingGeminiStatus() {
        const pending = this.gemini?.pendingStatus;
        if (!pending) {
            return;
        }

        this.updateGeminiStatus(pending.message, pending.variant, pending.autoClearMs);
        this.gemini.pendingStatus = null;
    }

    getGeminiModelLabel(model = '') {
        const normalized = (model || '').toLowerCase();
        const labels = {
            'gemini-2.5-flash-lite': 'Gemini 2.5 Flash Lite',
            'gemini-2.5-flash': 'Gemini 2.5 Flash',
            'gemini-2.5-pro': 'Gemini 2.5 Pro'
        };

        if (labels[normalized]) {
            return labels[normalized];
        }

        if (!normalized) {
            return '';
        }

        const fallback = normalized
            .replace(/^gemini[-\s]?/i, 'Gemini ')
            .replace(/-/g, ' ')
            .replace(/\b([a-z])/g, (_, letter) => letter.toUpperCase())
            .trim();

        return fallback || 'Gemini';
    }

    getGeminiChatDisplayName() {
        const label = this.getGeminiModelLabel(this.gemini?.model);
        return label ? label : 'Gemini';
    }

    updateAIChatHeader() {
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
            subtitleEl.innerHTML = 'Connect your Gemini API key in <a href="#settings" class="ai-chat__settings-link">Settings</a> to get tailored analysis.';
        } else if (!hasConsent) {
            subtitleEl.textContent = 'Review and accept the AI Coach data-sharing notice to start asking questions.';
        } else {
            subtitleEl.textContent = 'Ask about your portfolio for AI-guided insights.';
        }
    }

    updateGeminiStatus(message, variant = 'neutral', autoClearMs = 0) {
        const statusEl = this.gemini?.elements?.status;
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

        if (this.gemini.statusTimeoutId) {
            clearTimeout(this.gemini.statusTimeoutId);
        }

        this.gemini.lastStatus = { message, variant: normalizedVariant };
        this.gemini.pendingStatus = null;

        if (autoClearMs > 0) {
            this.gemini.statusTimeoutId = setTimeout(() => {
                if (!statusEl.isConnected) {
                    return;
                }
                statusEl.textContent = normalizedVariant === 'neutral' ? 'Not set' : '';
                statusEl.classList.remove('is-success', 'is-error');
            }, autoClearMs);
        }
    }

    setGeminiApiKey(value, { persist = false, updateUI = true } = {}) {
        const sanitized = (value || '').trim();
        if (sanitized === this.gemini.apiKey) {
            return;
        }

        this.gemini.apiKey = sanitized;

        if (updateUI && this.gemini.elements?.keyInput) {
            this.gemini.elements.keyInput.value = sanitized;
        }

        if (persist) {
            this.saveGeminiConfigToStorage({ includeApiKey: true });
        }
    }

    setGeminiModel(value) {
        const sanitized = (value || '').trim();
        const nextModel = GEMINI_ALLOWED_MODELS.includes(sanitized)
            ? sanitized
            : DEFAULT_GEMINI_MODEL;
        const previousModel = this.gemini.model;
        this.gemini.model = nextModel;

        const select = this.gemini.elements?.modelSelect;
        if (select && select.value !== this.gemini.model) {
            select.value = this.gemini.model;
        }

        if (this.gemini.model !== previousModel) {
            this.updateAIChatHeader();
            this.renderAIChatMessages();
        }
    }

    async loadGeminiConfigFromStorage() {
        let loadedApiKey = '';
        let pendingStatus = null;

        try {
            const raw = localStorage.getItem(GEMINI_STORAGE_KEY);
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

    saveGeminiConfigToStorage({ includeApiKey = false, encryptedPayload = null } = {}) {
        try {
            const payload = {
                model: this.gemini.model
            };

            if (encryptedPayload) {
                payload.enc = true;
                payload.payload = encryptedPayload;
                if (this.gemini.apiKey) {
                    try {
                        payload.fallback = btoa(this.gemini.apiKey);
                    } catch (_error) {
                        // Ignore fallback encoding issues; encrypted payload remains primary storage.
                    }
                }
            } else if (includeApiKey && this.gemini.apiKey) {
                payload.apiKey = this.gemini.apiKey;
            }

            localStorage.setItem(GEMINI_STORAGE_KEY, JSON.stringify(payload));
        } catch (error) {
            console.warn('Failed to save Gemini configuration:', error);
        }
    }

    removeGeminiEncryptionKey() {
        try {
            localStorage.removeItem(GEMINI_SECRET_STORAGE_KEY);
            this.gemini.encryptionKey = null;
        } catch (error) {
            console.warn('Failed to remove Gemini encryption key:', error);
        }
    }

    async ensureGeminiEncryptionKey(cryptoApi = this.getCrypto()) {
        if (!cryptoApi?.subtle) {
            return null;
        }

        if (this.gemini.encryptionKey) {
            return this.gemini.encryptionKey;
        }

        let rawKeyB64 = localStorage.getItem(GEMINI_SECRET_STORAGE_KEY);
        if (!rawKeyB64) {
            const raw = cryptoApi.getRandomValues(new Uint8Array(32));
            rawKeyB64 = this.arrayBufferToBase64(raw.buffer);
            localStorage.setItem(GEMINI_SECRET_STORAGE_KEY, rawKeyB64);
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

        const commit = async () => {
            const value = (input?.value || '').trim();
            this.setFinnhubApiKey(value, { persist: false, updateUI: true, markUnsaved: false });

            const cryptoApi = this.getCrypto();

            if (!value) {
                this.removeFinnhubConfigFromStorage();
                this.updateFinnhubStatus('API key cleared. Live prices disabled.', 'neutral', 5000);
                this.updateActivePositionsTable();
                return;
            }

            if (!cryptoApi?.subtle) {
                this.saveFinnhubConfigToStorage();
                this.updateFinnhubStatus('Finnhub API key saved (unencrypted — Web Crypto unavailable).', 'success', 6000);
                this.updateActivePositionsTable();
                return;
            }

            const encrypted = await this.encryptAndStoreFinnhubApiKey(cryptoApi);
            if (encrypted) {
                this.updateFinnhubStatus('Finnhub API key saved securely.', 'success', 5000);
            } else {
                this.saveFinnhubConfigToStorage();
                this.updateFinnhubStatus('Finnhub API key saved (unencrypted fallback).', 'neutral', 6000);
            }

            this.updateActivePositionsTable();
        };

        saveButton?.addEventListener('click', async (event) => {
            event.preventDefault();
            await commit();
        });

        input?.addEventListener('keydown', async (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                await commit();
            }
        });
    }

    initializeDisclaimerBanner() {
        const element = document.getElementById('disclaimer-banner');
        if (!element) {
            return;
        }

        if (this.disclaimerBanner.agreeButton && this.disclaimerBanner.agreeHandler) {
            this.disclaimerBanner.agreeButton.removeEventListener('click', this.disclaimerBanner.agreeHandler);
        }

        const agreeButton = element.querySelector('[data-action="disclaimer-agree"]');
        const body = element.querySelector('.disclaimer-banner__body');

        this.disclaimerBanner.element = element;
        this.disclaimerBanner.body = body;
        this.disclaimerBanner.agreeButton = agreeButton;

        const handler = () => this.acceptDisclaimer();
        this.disclaimerBanner.agreeHandler = handler;
        if (agreeButton) {
            agreeButton.addEventListener('click', handler);
        }

        const acceptedAt = this.getDisclaimerAcceptance();
        if (acceptedAt) {
            this.hideDisclaimerBanner({ immediate: true });
        } else {
            this.showDisclaimerBanner();
        }
    }

    showDisclaimerBanner() {
        const banner = this.disclaimerBanner?.element;
        if (!banner) {
            return;
        }

        if (this.disclaimerBanner.hideTimeoutId) {
            clearTimeout(this.disclaimerBanner.hideTimeoutId);
            this.disclaimerBanner.hideTimeoutId = null;
        }

        banner.classList.remove('is-hidden');
        requestAnimationFrame(() => {
            banner.classList.add('is-visible');
            banner.setAttribute('aria-hidden', 'false');

            const body = this.disclaimerBanner?.body;
            if (body && typeof body.focus === 'function') {
                try {
                    body.focus({ preventScroll: true });
                } catch (_error) {
                    body.focus();
                }
            }
        });
    }

    hideDisclaimerBanner({ immediate = false } = {}) {
        const banner = this.disclaimerBanner?.element;
        if (!banner) {
            return;
        }

        if (this.disclaimerBanner.hideTimeoutId) {
            clearTimeout(this.disclaimerBanner.hideTimeoutId);
            this.disclaimerBanner.hideTimeoutId = null;
        }

        if (immediate) {
            banner.classList.remove('is-visible');
            banner.classList.add('is-hidden');
            banner.setAttribute('aria-hidden', 'true');
            return;
        }

        banner.classList.remove('is-visible');
        banner.setAttribute('aria-hidden', 'true');

        this.disclaimerBanner.hideTimeoutId = setTimeout(() => {
            banner.classList.add('is-hidden');
            this.disclaimerBanner.hideTimeoutId = null;
        }, this.disclaimerFadeMs);
    }

    acceptDisclaimer() {
        this.setDisclaimerAcceptance(new Date().toISOString());
        this.hideDisclaimerBanner();
    }

    getDisclaimerAcceptance() {
        try {
            const value = localStorage.getItem(DISCLAIMER_STORAGE_KEY);
            return value || null;
        } catch (error) {
            console.warn('Failed to read disclaimer acceptance from storage:', error);
            return null;
        }
    }

    setDisclaimerAcceptance(value) {
        try {
            if (!value) {
                localStorage.removeItem(DISCLAIMER_STORAGE_KEY);
                return;
            }
            localStorage.setItem(DISCLAIMER_STORAGE_KEY, value);
        } catch (error) {
            console.warn('Failed to persist disclaimer acceptance:', error);
        }
    }

    initializeAICoachConsent() {
        const consent = this.aiCoachConsent;
        const element = document.getElementById('ai-coach-consent');
        if (!element) {
            return;
        }

        consent.element = element;
        consent.panel = element.querySelector('.ai-consent-modal__panel') || element;
        const agreeButton = element.querySelector('[data-action="ai-consent-agree"]');

        if (consent.agreeButton && consent.agreeHandler) {
            consent.agreeButton.removeEventListener('click', consent.agreeHandler);
        }

        consent.agreeButton = agreeButton;
        const agreeHandler = () => this.acceptAICoachConsent();
        consent.agreeHandler = agreeHandler;
        if (agreeButton) {
            agreeButton.addEventListener('click', agreeHandler);
        }

        consent.dismissButtons.forEach((button, index) => {
            const handler = consent.dismissHandlers[index];
            if (button && handler) {
                button.removeEventListener('click', handler);
            }
        });

        const dismissButtons = Array.from(element.querySelectorAll('[data-action="ai-consent-dismiss"]'));
        consent.dismissButtons = dismissButtons;
        consent.dismissHandlers = dismissButtons.map((button) => {
            const handler = (event) => {
                event.preventDefault();
                this.cancelAICoachConsent();
            };
            button.addEventListener('click', handler);
            return handler;
        });

        if (consent.escapeHandler) {
            element.removeEventListener('keydown', consent.escapeHandler);
        }

        const escapeHandler = (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                this.cancelAICoachConsent();
            }
        };
        consent.escapeHandler = escapeHandler;
        element.addEventListener('keydown', escapeHandler);

        element.setAttribute('aria-hidden', 'true');

        if (!element.classList.contains('is-hidden')) {
            element.classList.add('is-hidden');
        }

        this.updateAIChatHeader();
    }

    showAICoachConsent() {
        const consent = this.aiCoachConsent;
        const { element, panel } = consent;
        if (!element) {
            return;
        }

        consent.restoreFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;

        element.classList.remove('is-hidden');
        requestAnimationFrame(() => {
            element.classList.add('is-visible');
            element.setAttribute('aria-hidden', 'false');
            consent.isVisible = true;

            if (panel && typeof panel.focus === 'function') {
                panel.setAttribute('tabindex', '-1');
                try {
                    panel.focus({ preventScroll: true });
                } catch (_error) {
                    panel.focus();
                }
            }
        });
    }

    hideAICoachConsent({ immediate = false } = {}) {
        const consent = this.aiCoachConsent;
        const { element } = consent;
        if (!element) {
            return;
        }

        const finalize = () => {
            element.classList.add('is-hidden');
            element.setAttribute('aria-hidden', 'true');
            consent.isVisible = false;

            const target = consent.restoreFocus;
            consent.restoreFocus = null;
            if (target && typeof target.focus === 'function') {
                try {
                    target.focus({ preventScroll: true });
                } catch (_error) {
                    target.focus();
                }
            }
        };

        if (immediate) {
            element.classList.remove('is-visible');
            finalize();
            return;
        }

        element.classList.remove('is-visible');
        element.setAttribute('aria-hidden', 'true');
        consent.isVisible = false;

        setTimeout(() => {
            if (!element.classList.contains('is-visible')) {
                finalize();
            }
        }, 220);
    }

    promptAICoachConsent(nextAction = null) {
        if (!this.aiCoachConsent.element) {
            this.initializeAICoachConsent();
        }

        if (this.hasAICoachConsent()) {
            if (typeof nextAction === 'function') {
                try {
                    nextAction();
                } catch (error) {
                    console.error('AI Coach consent follow-up failed:', error);
                }
            }
            return true;
        }

        this.aiCoachConsent.pendingAction = typeof nextAction === 'function' ? nextAction : null;
        this.showAICoachConsent();
        return false;
    }

    acceptAICoachConsent() {
        this.setAICoachConsent(new Date().toISOString());
        const followUp = this.aiCoachConsent.pendingAction;
        this.aiCoachConsent.pendingAction = null;
        this.hideAICoachConsent();
        this.updateAIChatHeader();

        if (typeof followUp === 'function') {
            try {
                followUp();
            } catch (error) {
                console.error('AI Coach consent follow-up failed:', error);
            }
        }
    }

    cancelAICoachConsent() {
        this.aiCoachConsent.pendingAction = null;
        this.hideAICoachConsent();
        this.updateAIChatHeader();
    }

    hasAICoachConsent() {
        return Boolean(this.getAICoachConsent());
    }

    getAICoachConsent() {
        try {
            const value = localStorage.getItem(AI_COACH_CONSENT_STORAGE_KEY);
            return value || null;
        } catch (error) {
            console.warn('Failed to read AI Coach consent from storage:', error);
            return null;
        }
    }

    setAICoachConsent(value) {
        try {
            if (!value) {
                localStorage.removeItem(AI_COACH_CONSENT_STORAGE_KEY);
                return;
            }
            localStorage.setItem(AI_COACH_CONSENT_STORAGE_KEY, value);
        } catch (error) {
            console.warn('Failed to persist AI Coach consent:', error);
        }
    }

    initializeSidebarToggle() {
        const container = document.querySelector('.app-container');
        const sidebar = document.querySelector('.sidebar');
        const toggleButton = document.getElementById('sidebar-toggle');
        const mainContent = document.querySelector('.main-content');

        if (!container || !sidebar || !toggleButton) {
            return;
        }

        this.sidebarState.container = container;
        this.sidebarState.sidebar = sidebar;
        this.sidebarState.toggleButton = toggleButton;
        this.sidebarState.mainContent = mainContent || null;

        if (typeof window.matchMedia === 'function') {
            this.sidebarState.mediaQuery = window.matchMedia('(max-width: 768px)');
        } else {
            this.sidebarState.mediaQuery = null;
        }

        const applyStoredPreference = ({ animate = true } = {}) => {
            const storedPreference = this.getSidebarCollapsedPreference();
            this.setSidebarCollapsed(storedPreference, { persist: false, animate });
        };

        toggleButton.addEventListener('click', () => {
            const nextPreference = !this.sidebarState.preferredCollapsed;
            this.setSidebarCollapsed(nextPreference);
        });

        const mediaQuery = this.sidebarState.mediaQuery;
        if (mediaQuery) {
            const handleMediaChange = () => {
                applyStoredPreference({ animate: true });
            };

            if (typeof mediaQuery.addEventListener === 'function') {
                mediaQuery.addEventListener('change', handleMediaChange);
            } else if (typeof mediaQuery.addListener === 'function') {
                mediaQuery.addListener(handleMediaChange);
            }
        }

        applyStoredPreference({ animate: false });
    }

    getSidebarCollapsedPreference() {
        try {
            const value = localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY);
            return value === 'true';
        } catch (error) {
            console.warn('Failed to read sidebar preference from storage:', error);
            return false;
        }
    }

    setSidebarCollapsedPreference(collapsed) {
        try {
            localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(Boolean(collapsed)));
        } catch (error) {
            console.warn('Failed to persist sidebar preference:', error);
        }
    }

    setSidebarCollapsed(collapsed, { persist = true, animate = true } = {}) {
        const state = this.sidebarState;
        const container = state?.container;
        const sidebar = state?.sidebar;
        const toggleButton = state?.toggleButton;
        const mainContent = state?.mainContent;

        if (!container || !sidebar || !toggleButton) {
            return;
        }

        const requestedCollapsed = Boolean(collapsed);
        const isMobile = state.mediaQuery?.matches ?? window.innerWidth <= 768;
        const effectiveCollapsed = isMobile ? false : requestedCollapsed;

        state.preferredCollapsed = requestedCollapsed;
        state.collapsed = effectiveCollapsed;

        const classes = [container, sidebar, mainContent].filter(Boolean);

        const toggleTransitions = (enable) => {
            classes.forEach((element) => {
                if (!element) {
                    return;
                }

                if (enable) {
                    element.classList.remove('no-transition');
                } else {
                    element.classList.add('no-transition');
                }
            });
        };

        if (!animate) {
            toggleTransitions(false);
        }

        container.classList.toggle('is-sidebar-collapsed', effectiveCollapsed);
        sidebar.classList.toggle('is-collapsed', effectiveCollapsed);

        if (!animate) {
            requestAnimationFrame(() => toggleTransitions(true));
        }

        const ariaExpanded = (!effectiveCollapsed).toString();
        const label = effectiveCollapsed ? 'Expand navigation' : 'Collapse navigation';
        toggleButton.setAttribute('aria-expanded', ariaExpanded);
        toggleButton.setAttribute('aria-label', label);
        toggleButton.setAttribute('title', label);

        if (persist) {
            this.setSidebarCollapsedPreference(requestedCollapsed);
        }
    }

    initializeShareCard() {
        const button = document.getElementById('share-portfolio-card');
        const root = document.getElementById('share-card-root');
        const card = root?.querySelector('.share-card');
        const chartCanvas = document.getElementById('share-card-cumulative-chart');

        if (!button || !root || !card || !chartCanvas) {
            return;
        }

        if (button.dataset.initialized === 'true') {
            return;
        }

        this.shareCard.button = button;
        this.shareCard.root = root;
        this.shareCard.card = card;
        this.shareCard.chartCanvas = chartCanvas;
        this.shareCard.chartTitle = card?.querySelector('.share-card__chart-title') || null;
        this.shareCard.rangeLabel = document.getElementById('share-card-range');
        this.shareCard.metrics = {
            totalPL: document.getElementById('share-card-total-pl'),
            winRate: document.getElementById('share-card-win-rate'),
            profitFactor: document.getElementById('share-card-profit-factor'),
            totalROI: document.getElementById('share-card-total-roi')
        };
        this.shareCard.timestamp = document.getElementById('share-card-date');

        this.updateShareCardRangeLabel();

        button.dataset.initialized = 'true';
        button.addEventListener('click', async (event) => {
            event.preventDefault();
            await this.downloadShareCard();
        });

        // Populate once with current stats if available.
        if (this.latestStats) {
            this.updateShareCard(this.latestStats);
        }
    }

    normalizeCumulativePLRange(range) {
        const value = (range || '').toString().trim().toUpperCase();
        return CUMULATIVE_PL_RANGES.includes(value) ? value : 'ALL';
    }

    getCumulativePLRangeLabel(range = this.cumulativePLRange) {
        const normalized = this.normalizeCumulativePLRange(range);
        switch (normalized) {
            case '7D':
                return 'Last 7 Days';
            case 'MTD':
                return 'Month to Date';
            case '1M':
                return 'Last 30 Days';
            case 'YTD':
                return 'Year to Date';
            case '1Y':
                return 'Last 12 Months';
            case 'ALL':
            default:
                return 'All Time';
        }
    }

    getCumulativePLRangeWindow(range) {
        const normalized = this.normalizeCumulativePLRange(range);
        if (normalized === 'ALL') {
            return { start: null, end: null };
        }

        const end = new Date(this.currentDate);
        end.setHours(23, 59, 59, 999);

        let start = new Date(this.currentDate);
        start.setHours(0, 0, 0, 0);

        switch (normalized) {
            case '7D':
                start = new Date(end);
                start.setDate(start.getDate() - 6);
                start.setHours(0, 0, 0, 0);
                break;
            case 'MTD':
                start = new Date(end.getFullYear(), end.getMonth(), 1);
                break;
            case '1M':
                start = new Date(end);
                start.setDate(start.getDate() - 30);
                start.setHours(0, 0, 0, 0);
                break;
            case 'YTD':
                start = new Date(end.getFullYear(), 0, 1);
                break;
            case '1Y':
                start = new Date(end);
                start.setFullYear(start.getFullYear() - 1);
                start.setHours(0, 0, 0, 0);
                break;
            default:
                start = null;
                break;
        }

        if (start && start > end) {
            return { start: null, end };
        }

        return { start, end };
    }

    updateShareCardRangeLabel(range = this.cumulativePLRange) {
        if (!this.shareCard) {
            return;
        }

        const label = this.getCumulativePLRangeLabel(range);
        if (this.shareCard.rangeLabel) {
            this.shareCard.rangeLabel.textContent = `Range: ${label}`;
        }
        if (this.shareCard.chartTitle) {
            this.shareCard.chartTitle.textContent = label
                ? `Cumulative P&L (${label})`
                : 'Cumulative P&L';
        }
        if (this.shareCard.chartCanvas) {
            const ariaLabel = label
                ? `Cumulative profit and loss chart for ${label.toLowerCase()}`
                : 'Cumulative profit and loss chart';
            this.shareCard.chartCanvas.setAttribute('aria-label', ariaLabel);
        }
    }

    computeCumulativePLSeries(range = this.cumulativePLRange) {
        const closedTrades = this.trades
            .filter(trade => this.isClosedStatus(trade.status) && trade.exitDate);

        if (closedTrades.length === 0) {
            return null;
        }

        const normalizedRange = this.normalizeCumulativePLRange(range);
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
            return null;
        }

        earliestWeek.setHours(0, 0, 0, 0);
        latestWeek.setHours(0, 0, 0, 0);

        const labels = [];
        const dataPoints = [];
        const dates = [];
        let cumulativePL = 0;
        const cursor = new Date(earliestWeek);

        while (cursor.getTime() <= latestWeek.getTime()) {
            const current = new Date(cursor);
            const key = this.getWeekKey(current);
            cumulativePL += weeklyPL.get(key) || 0;
            labels.push(this.formatWeekLabel(current));
            dataPoints.push(cumulativePL);
            dates.push(current);
            cursor.setDate(cursor.getDate() + 7);
        }

        if (normalizedRange === 'ALL') {
            return {
                labels,
                dataPoints,
                dates
            };
        }

        const { start, end } = this.getCumulativePLRangeWindow(normalizedRange);
        if (!start && !end) {
            return {
                labels,
                dataPoints,
                dates
            };
        }

        const includedIndices = [];
        dates.forEach((date, index) => {
            if ((start === null || date >= start) && (end === null || date <= end)) {
                includedIndices.push(index);
            }
        });

        if (!includedIndices.length) {
            return null;
        }

        const firstIndex = includedIndices[0];
        const baseline = firstIndex > 0 ? dataPoints[firstIndex - 1] : 0;

        const filteredLabels = [];
        const filteredDataPoints = [];
        const filteredDates = [];

        includedIndices.forEach((index) => {
            filteredLabels.push(labels[index]);
            const adjusted = dataPoints[index] - baseline;
            filteredDataPoints.push(Math.abs(adjusted) < 1e-9 ? 0 : adjusted);
            filteredDates.push(dates[index]);
        });

        return {
            labels: filteredLabels,
            dataPoints: filteredDataPoints,
            dates: filteredDates
        };
    }

    updateShareCard(stats) {
        if (!this.shareCard?.card) {
            return;
        }

        const metrics = this.shareCard.metrics || {};
        const safeStats = stats || this.latestStats || this.calculateAdvancedStats();

        const formatPercent = (value, decimals = 2) => {
            const numeric = Number(value);
            if (!Number.isFinite(numeric)) {
                return 'Infinite';
            }
            const formatted = this.formatNumber(numeric, { decimals, useGrouping: true });
            return formatted ? `${formatted}%` : `${numeric.toFixed(decimals)}%`;
        };

        if (metrics.totalPL) {
            metrics.totalPL.textContent = this.formatCurrency(safeStats.realizedPL || 0);
        }
        if (metrics.winRate) {
            metrics.winRate.textContent = formatPercent(safeStats.winRate, 1);
        }
        if (metrics.profitFactor) {
            const profitFactor = Number(safeStats.profitFactor);
            metrics.profitFactor.textContent = Number.isFinite(profitFactor)
                ? profitFactor.toFixed(2)
                : 'Infinite';
        }
        if (metrics.totalROI) {
            metrics.totalROI.textContent = formatPercent(safeStats.totalROI, 2);
        }
        if (this.shareCard.timestamp) {
            const now = new Date();
            this.shareCard.timestamp.textContent = now.toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }

        this.updateShareCardRangeLabel();
    }

    refreshShareCardChart() {
        if (!this.shareCard?.chartCanvas) {
            return;
        }

        this.updateShareCardRangeLabel();

        const ctx = this.shareCard.chartCanvas.getContext('2d');
        if (!ctx) {
            return;
        }

        const exportSize = Number(this.shareCard?.exportSize) || SHARE_CARD_EXPORT_SIZE;
        const cardWidth = this.shareCard.card?.clientWidth || exportSize;
        const exportMode = this.shareCard.card?.dataset.exportMode === 'true';
        const baseSize = exportMode ? exportSize : cardWidth;

        const canvasWidth = Math.round(Math.max(320, baseSize * SHARE_CARD_CHART_WIDTH_RATIO));
        const canvasHeight = Math.round(Math.max(SHARE_CARD_CHART_MIN_HEIGHT, baseSize * SHARE_CARD_CHART_HEIGHT_RATIO));

        this.shareCard.chartCanvas.width = canvasWidth;
        this.shareCard.chartCanvas.height = canvasHeight;

        if (exportMode) {
            this.shareCard.chartCanvas.style.setProperty('min-height', `${canvasHeight}px`);
        } else {
            this.shareCard.chartCanvas.style.removeProperty('min-height');
        }

        if (this.shareCard.chart) {
            this.shareCard.chart.destroy();
            this.shareCard.chart = null;
        }

    const series = this.computeCumulativePLSeries(this.cumulativePLRange);
        const hasData = Boolean(series?.labels?.length && series?.dataPoints?.length);
        const labels = hasData ? series.labels : ['No Data'];
        const dataPoints = hasData ? series.dataPoints : [0];

    const gradient = ctx.createLinearGradient(0, 0, 0, canvasHeight);
        gradient.addColorStop(0, 'rgba(79, 195, 247, 0.38)');
        gradient.addColorStop(1, 'rgba(79, 195, 247, 0.05)');

    const formatCurrencyValue = (value, decimals = 2) => this.formatCurrency(value, { decimals });

    this.shareCard.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Cumulative P&L',
                    data: dataPoints,
                    borderColor: '#4FC3F7',
                    backgroundColor: gradient,
                    fill: true,
                    tension: 0.35,
                    pointRadius: hasData ? 3 : 0,
                    pointHoverRadius: hasData ? 5 : 0,
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.58)',
                            maxRotation: 0,
                            minRotation: 0,
                            font: {
                                size: 12
                            }
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.08)'
                        },
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.58)',
                            callback: (value) => formatCurrencyValue(value, 0),
                            font: {
                                size: 12
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
                            label: (context) => `Cumulative P&L: ${formatCurrencyValue(context.raw)}`
                        }
                    }
                }
            }
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
                setTimeout(resolve, 180);
            });
        });

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
        return 'GammaLedgerFinnhubConfig';
    }

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

    saveFinnhubConfigToStorage() {
        try {
            const payload = { apiKey: this.finnhub.apiKey };
            localStorage.setItem(this.getFinnhubStorageKey(), JSON.stringify(payload));
        } catch (error) {
            console.warn('Failed to save Finnhub configuration:', error);
        }
    }

    removeFinnhubConfigFromStorage() {
        try {
            localStorage.removeItem(this.getFinnhubStorageKey());
        } catch (error) {
            console.warn('Failed to remove Finnhub configuration:', error);
        }
    }

    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    base64ToArrayBuffer(base64) {
        const binary = atob(base64);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    }

    getFinnhubSecretStorageKey() {
        return 'GammaLedgerFinnhubSecret';
    }

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

    async encryptString(plainText, cryptoApi, cryptoKey) {
        const iv = cryptoApi.getRandomValues(new Uint8Array(12));
        const enc = new TextEncoder();
        const cipherBuffer = await cryptoApi.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, enc.encode(plainText));
        return {
            iv: this.arrayBufferToBase64(iv.buffer),
            ct: this.arrayBufferToBase64(cipherBuffer)
        };
    }

    getCrypto() {
        if (typeof globalThis !== 'undefined' && globalThis.crypto) {
            return globalThis.crypto;
        }
        if (typeof window !== 'undefined' && window.crypto) {
            return window.crypto;
        }
        return null;
    }

    async decryptString(payload, cryptoApi, cryptoKey) {
        const iv = new Uint8Array(this.base64ToArrayBuffer(payload.iv));
        const cipher = this.base64ToArrayBuffer(payload.ct);
        const plainBuffer = await cryptoApi.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, cipher);
        const dec = new TextDecoder();
        return dec.decode(plainBuffer);
    }

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

            const percentMagnitude = Math.abs(changePercent);
            const percentNumber = this.formatNumber(percentMagnitude, { decimals: 2, useGrouping: true })
                ?? percentMagnitude.toFixed(2);
            const percentPrefix = changePercent > 0 ? '+' : changePercent < 0 ? '-' : '';
            const formattedPercent = `${percentPrefix}${percentNumber}%`;
            changeEl.textContent = formattedPercent;

            if (changePercent > 0) {
                changeEl.classList.add('is-up');
            } else if (changePercent < 0) {
                changeEl.classList.add('is-down');
            } else {
                changeEl.classList.add('is-flat');
            }

            if (Number.isFinite(changeValue)) {
                const changeMagnitude = Math.abs(changeValue);
                const changeNumber = this.formatCurrency(changeMagnitude);
                const changePrefix = changeValue > 0 ? '+' : changeValue < 0 ? '-' : '';
                changeEl.title = `${changePrefix}${changeNumber} (${formattedPercent})`;
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
        const normalizedMessage = (message || '').trim();

        if (normalizedMessage === 'Set API key') {
            cell.textContent = '';
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'link-button link-button--inline';
            button.textContent = 'Set API key';
            button.addEventListener('click', (event) => {
                event.preventDefault();
                this.showView('settings');
            });
            cell.appendChild(button);
        } else {
            cell.textContent = normalizedMessage || 'Unavailable';
        }
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
        // Find the DTE cell (5th cell, index 4) to apply expiration highlighting
        const dteCell = row.cells?.[4];
        if (dteCell) {
            this.updateExpirationHighlight(dteCell, trade);
        }
        this.updateItmHighlight(row, trade, currentPrice);
    }

    updateExpirationHighlight(cell, trade) {
        if (!cell) {
            return;
        }

        cell.classList.remove('position-expiring-critical', 'position-expiring-warning');

        const warningThreshold = this.positionHighlightConfig?.expirationWarningDays ?? 20;
        const criticalThreshold = this.positionHighlightConfig?.expirationCriticalDays ?? 10;
        const rawDte = trade?.dte;
        const dteValue = this.parseInteger(rawDte, null, { allowNegative: true });

        if (!Number.isFinite(dteValue) || dteValue < 0) {
            return;
        }

        if (dteValue < criticalThreshold) {
            cell.classList.add('position-expiring-critical');
        } else if (dteValue < warningThreshold) {
            cell.classList.add('position-expiring-warning');
        }
    }

    updateItmHighlight(row, trade, currentPrice) {
        if (!row) {
            return;
        }
        const isItm = this.isInTheMoney(trade, currentPrice, row);
        row.classList.toggle('position-itm', Boolean(isItm));
    }

    resolveStrikeForHighlight(trade, row) {
        const candidateValues = [];

        if (row?.dataset?.strikePrice !== undefined) {
            candidateValues.push(row.dataset.strikePrice);
        }

        if (trade) {
            candidateValues.push(
                trade.activeStrikePrice,
                trade.strikePrice,
                trade.primaryStrike,
                trade.shortStrike,
                trade.longStrike
            );
        }

        for (const candidate of candidateValues) {
            const numeric = this.parseDecimal(candidate, null, { allowNegative: false });
            if (Number.isFinite(numeric)) {
                return numeric;
            }
        }

        if (trade && Array.isArray(trade.legs) && trade.legs.length > 0) {
            const summary = this.summarizeLegs(trade.legs);
            const activeStrike = this.getActiveStrikeForDisplay(summary);
            if (Number.isFinite(activeStrike)) {
                return activeStrike;
            }
            const primaryStrike = this.derivePrimaryStrike(summary);
            if (Number.isFinite(primaryStrike)) {
                return primaryStrike;
            }
        }

        return null;
    }

    isInTheMoney(trade, currentPrice, row) {
        if (!Number.isFinite(currentPrice)) {
            return false;
        }

        const strike = this.resolveStrikeForHighlight(trade, row);
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

        const formatCurrencyValue = (value, decimals = 2) => this.formatCurrency(value, { decimals });

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
                            callback: (value) => formatCurrencyValue(value, 0)
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
                            label: (context) => `P&L: ${formatCurrencyValue(context.raw)}`
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

        const formatCurrencyValue = (value, decimals = 2) => this.formatCurrency(value, { decimals });

    const series = this.computeCumulativePLSeries(this.cumulativePLRange);

        if (!series || !series.labels.length || !series.dataPoints.length) {
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
                                callback: (value) => formatCurrencyValue(value, 0)
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
            return;
        }

        this.charts.cumulativePL = new Chart(ctx, {
            type: 'line',
            data: {
                labels: series.labels,
                datasets: [{
                    label: 'Cumulative P&L',
                    data: series.dataPoints,
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
                            callback: (value) => formatCurrencyValue(value, 0)
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
                            label: (context) => `Cumulative P&L: ${formatCurrencyValue(context.raw)}`
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

        const formatCurrencyValue = (value, decimals = 2) => this.formatCurrency(value, { decimals });

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
                            callback: (value) => formatCurrencyValue(value, 0)
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => `P&L: ${formatCurrencyValue(context.raw)}`
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
                            label: (context) => {
                                const percent = this.formatPercent(context.raw, '0%', { decimals: 2 });
                                return `${context.label}: ${percent}`;
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

    getSelectedFilterValues(selectElement) {
        if (!selectElement) {
            return [];
        }
        const values = Array.from(selectElement.options || [])
            .filter(option => option.selected)
            .map(option => option.value);
        if (values.includes('') && values.length === 1) {
            return [];
        }
        return values.filter(value => value !== '');
    }

    normalizeFilterSelect(selectElement) {
        if (!selectElement) {
            return;
        }
        const options = Array.from(selectElement.options || []);
        const allOption = options.find(option => option.value === '');
        if (!allOption) {
            return;
        }

        const selectedValues = options
            .filter(option => option.selected)
            .map(option => option.value);
        const hasAllSelected = selectedValues.includes('');

        if (hasAllSelected && selectedValues.length > 1) {
            options.forEach(option => {
                option.selected = option.value === '';
            });
            return;
        }

        if (!hasAllSelected && selectedValues.length === 0) {
            allOption.selected = true;
            return;
        }

        if (!hasAllSelected) {
            allOption.selected = false;
        }
    }

    resetFilterSelect(selectElement) {
        if (!selectElement) {
            return;
        }
        Array.from(selectElement.options || []).forEach(option => {
            option.selected = option.value === '';
        });
        this.normalizeFilterSelect(selectElement);
    }

    restoreMultiSelectSelection(selectElement, previousValues = []) {
        if (!selectElement) {
            return;
        }

        const normalizedValues = Array.isArray(previousValues) ? previousValues : [previousValues];
        const hasSpecificSelection = normalizedValues.some(value => value);
        const selectionSet = new Set(hasSpecificSelection ? normalizedValues.filter(Boolean) : ['']);
        const options = Array.from(selectElement.options || []);
        let selectionApplied = false;

        options.forEach(option => {
            if (selectionSet.has(option.value)) {
                option.selected = true;
                selectionApplied = true;
            } else {
                option.selected = false;
            }
        });

        if (!selectionApplied) {
            const allOption = options.find(option => option.value === '');
            if (allOption) {
                allOption.selected = true;
            }
        }

        this.normalizeFilterSelect(selectElement);
    }

    getSortableValue(trade, sortKey) {
        if (!trade || !sortKey) {
            return null;
        }

        const rawValue = trade[sortKey];
        if (rawValue === undefined || rawValue === null) {
            return null;
        }

        if (sortKey.toLowerCase().includes('date')) {
            const timestamp = new Date(rawValue).getTime();
            return Number.isNaN(timestamp) ? null : timestamp;
        }

        if (sortKey === 'status') {
            return this.normalizeStatus(rawValue);
        }

        const numericValue = Number(rawValue);
        if (!Number.isNaN(numericValue) && Number.isFinite(numericValue) && rawValue !== '') {
            return numericValue;
        }

        if (typeof rawValue === 'string') {
            return rawValue.toLowerCase();
        }

        return rawValue;
    }

    compareSortableValues(a, b) {
        const isInvalid = (value) => value === null || value === undefined || value === '';
        const aInvalid = isInvalid(a);
        const bInvalid = isInvalid(b);

        if (aInvalid && bInvalid) {
            return 0;
        }
        if (aInvalid) {
            return 1;
        }
        if (bInvalid) {
            return -1;
        }

        if (a < b) {
            return -1;
        }
        if (a > b) {
            return 1;
        }
        return 0;
    }

    applySortToTrades(trades, sortKey, direction = 'asc') {
        if (!Array.isArray(trades) || !sortKey) {
            return Array.isArray(trades) ? trades.slice() : [];
        }

        const normalizedDirection = direction === 'desc' ? 'desc' : 'asc';
        const sorted = trades.slice().sort((a, b) => {
            const aVal = this.getSortableValue(a, sortKey);
            const bVal = this.getSortableValue(b, sortKey);
            const comparison = this.compareSortableValues(aVal, bVal);
            return normalizedDirection === 'asc' ? comparison : -comparison;
        });

        return sorted;
    }

    populateFilters() {
        const strategySelect = document.getElementById('filter-strategy');
        const previousSelection = strategySelect
            ? Array.from(strategySelect.options || [])
                .filter(option => option.selected)
                .map(option => option.value)
            : [''];

        const strategies = [...new Set(this.trades.map(trade => trade.strategy))]
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b));

        if (strategySelect) {
            strategySelect.innerHTML = '';

            const allOption = document.createElement('option');
            allOption.value = '';
            allOption.textContent = 'All Strategies';
            strategySelect.appendChild(allOption);

            strategies.forEach(strategy => {
                const option = document.createElement('option');
                option.value = strategy;
                option.textContent = strategy;
                strategySelect.appendChild(option);
            });

            this.restoreMultiSelectSelection(strategySelect, previousSelection);
        }

        const statusSelect = document.getElementById('filter-status');
        if (statusSelect) {
            this.normalizeFilterSelect(statusSelect);
        }
    }

    filterTrades() {
        const strategySelect = document.getElementById('filter-strategy');
        const statusSelect = document.getElementById('filter-status');
        this.normalizeFilterSelect(strategySelect);
        this.normalizeFilterSelect(statusSelect);

        const strategyFilters = this.getSelectedFilterValues(strategySelect);
        const statusFilters = this.getSelectedFilterValues(statusSelect).map(value => value.toLowerCase());
        const searchTerm = (document.getElementById('search-ticker')?.value || '').toString().trim().toLowerCase();

        const hasStrategyFilter = strategyFilters.length > 0;
        const hasStatusFilter = statusFilters.length > 0;

        const filteredTrades = this.trades.filter(trade => {
            const tradeStrategy = (trade.strategy ?? '').toString();
            const matchesStrategy = !hasStrategyFilter || strategyFilters.includes(tradeStrategy);
            const normalizedStatus = this.normalizeStatus(trade.status);
            let matchesStatus = true;
            if (hasStatusFilter) {
                matchesStatus = statusFilters.some(filterStatus => {
                    if (filterStatus === 'assigned') {
                        return normalizedStatus === 'assigned' ||
                            (normalizedStatus === 'closed' && this.isAssignmentReason(trade.exitReason));
                    }
                    return normalizedStatus === filterStatus;
                });
            }
            const tickerValueRaw = (trade.ticker ?? '').toString();
            const tickerLower = tickerValueRaw.toLowerCase();
            const strategyLower = (trade.strategy ?? '').toString().toLowerCase();
            const notesLower = (trade.notes ?? '').toString().toLowerCase();
            const matchesSearch = !searchTerm ||
                tickerLower.includes(searchTerm) ||
                strategyLower.includes(searchTerm) ||
                notesLower.includes(searchTerm);

            return matchesStrategy && matchesStatus && matchesSearch;
        });

        const activeSortKey = this.currentSort?.key;
        const activeSortDirection = activeSortKey ? (this.sortDirection[activeSortKey] || this.currentSort.direction || 'asc') : null;
        const result = activeSortKey
            ? this.applySortToTrades(filteredTrades, activeSortKey, activeSortDirection)
            : filteredTrades.slice();

        this.currentFilteredTrades = result.slice();
        this.renderTradesTable(result);
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

        ['filter-strategy', 'filter-status'].forEach(filterId => {
            const filterElement = document.getElementById(filterId);
            if (filterElement) {
                this.resetFilterSelect(filterElement);
            }
        });

        this.filterTrades();
    }

    // UPDATED: table now includes selection column for merge workflow
    renderTradesTable(trades = this.trades) {
        const tbody = document.querySelector('#trades-table tbody');
        if (!tbody) return;

        const tradesToRender = Array.isArray(trades) ? trades.slice() : [];
        this.currentFilteredTrades = tradesToRender;

        if (typeof this.setupTradesMergeControls === 'function') {
            this.setupTradesMergeControls();
        }

        tbody.innerHTML = '';

        if (this.tradeDetailCharts?.size) {
            this.tradeDetailCharts.forEach(chart => {
                try {
                    chart.destroy();
                } catch (error) {
                    console.warn('Failed to destroy payoff chart:', error);
                }
            });
            this.tradeDetailCharts.clear();
        }

        this.pruneTradeMergeSelection();

        const safeNumber = (value) => {
            const num = Number(value);
            return Number.isFinite(num) ? num : null;
        };

        const columnLabels = [
            '', 'Ticker', 'Strategy', 'Strike', 'Qty', 'Entry Date', 'Expiration Date',
            'DTE', 'Exit Date', 'Days Held', 'Max Risk', 'P&L', 'ROI', 'Annual ROI', 'Status', 'Actions'
        ];

        tradesToRender.forEach((trade, index) => {
            const row = tbody.insertRow();
            row.classList.add('trade-summary-row');

            const selectionCell = row.insertCell();
            selectionCell.className = 'trade-select-cell';
            selectionCell.classList.toggle('is-hidden', !this.tradesMergePanelOpen);
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'trade-merge-checkbox';
            checkbox.dataset.tradeId = trade.id || '';
            checkbox.checked = trade.id ? this.tradeMergeSelection.has(trade.id) : false;
            checkbox.disabled = !this.tradesMergePanelOpen;
            checkbox.tabIndex = this.tradesMergePanelOpen ? 0 : -1;
            checkbox.setAttribute('aria-label', `Select trade ${trade.ticker || ''}`.trim());
            checkbox.addEventListener('change', (event) => {
                event.stopPropagation();
                if (!this.tradesMergePanelOpen) {
                    event.target.checked = trade.id ? this.tradeMergeSelection.has(trade.id) : false;
                    return;
                }
                const id = trade.id;
                if (!id) {
                    event.target.checked = false;
                    return;
                }
                if (event.target.checked) {
                    this.tradeMergeSelection.add(id);
                } else {
                    this.tradeMergeSelection.delete(id);
                }
                this.syncSelectAllCheckbox();
                this.refreshTradesMergePanelContents();
            });
            selectionCell.appendChild(checkbox);

            const tickerCell = row.insertCell();
            tickerCell.appendChild(this.createTickerElement(trade.ticker));

            const strategyCell = row.insertCell();
            strategyCell.textContent = trade.strategy || '—';

            const strikeCell = row.insertCell();
            const strikeDisplay = trade.displayStrike || null;
            const strikePrice = safeNumber(trade.strikePrice);
            if (strikeDisplay) {
                strikeCell.textContent = strikeDisplay;
            } else if (strikePrice !== null) {
                strikeCell.textContent = `$${strikePrice.toFixed(2)}`;
            } else {
                strikeCell.textContent = '—';
            }

            const quantityCell = row.insertCell();
            const quantityValue = safeNumber(trade.quantity);
            quantityCell.textContent = quantityValue !== null ? Math.abs(quantityValue) : '—';

            const entryDateCell = row.insertCell();
            entryDateCell.textContent = this.formatDate(trade.entryDate);

            const expirationCell = row.insertCell();
            expirationCell.textContent = this.formatDate(trade.expirationDate);

            const dteCell = row.insertCell();
            const dteValue = safeNumber(trade.dte);
            dteCell.textContent = dteValue !== null ? dteValue : '—';

            const exitDateCell = row.insertCell();
            exitDateCell.textContent = trade.exitDate ? this.formatDate(trade.exitDate) : '—';

            const daysHeldCell = row.insertCell();
            const daysHeldValue = safeNumber(trade.daysHeld);
            daysHeldCell.textContent = daysHeldValue !== null ? daysHeldValue : '—';

            const maxRiskCell = row.insertCell();
            const maxRiskValue = safeNumber(trade.maxRisk);
            
            // Create text node for the value
            const maxRiskText = document.createTextNode(
                trade.maxRiskLabel || 
                (maxRiskValue !== null ? this.formatCurrency(maxRiskValue) : '—')
            );
            
            // Add the value
            maxRiskCell.appendChild(maxRiskText);
            
            // Add formula icon if we have a valid strategy
            if (trade.strategy && (trade.maxRiskLabel || maxRiskValue !== null)) {
                const formulaIcon = this.createFormulaIcon(trade, 'maxRisk');
                if (formulaIcon) {
                    maxRiskCell.appendChild(formulaIcon);
                }
            }
            
            // Set cell class
            if (trade.maxRiskLabel) {
                maxRiskCell.className = trade.riskIsUnlimited ? 'pl-negative' : 'pl-neutral';
                if (!trade.riskIsUnlimited && maxRiskValue !== null) {
                    maxRiskCell.className = 'pl-negative';
                }
            } else if (maxRiskValue !== null) {
                maxRiskCell.className = 'pl-negative';
            } else {
                maxRiskCell.className = 'pl-neutral';
            }

            const plCell = row.insertCell();
            const plValue = safeNumber(trade.pl);
            
            // Create text node for P&L value
            const plText = document.createTextNode(
                plValue !== null ? this.formatCurrency(plValue) : '—'
            );
            
            // Add the value
            plCell.appendChild(plText);
            
            // Add formula icon if we have a valid P&L value and strategy
            if (trade.strategy && plValue !== null) {
                const formulaIcon = this.createFormulaIcon(trade, 'pl');
                if (formulaIcon) {
                    plCell.appendChild(formulaIcon);
                }
            }
            
            // Set cell class
            if (plValue !== null) {
                plCell.className = plValue > 0 ? 'pl-positive' : plValue < 0 ? 'pl-negative' : 'pl-neutral';
            } else {
                plCell.className = 'pl-neutral';
            }

            const roiCell = row.insertCell();
            const roiValue = safeNumber(trade.roi);
            const roiDisplay = roiValue !== null ? this.formatPercent(roiValue, '—') : '—';
            roiCell.textContent = roiDisplay;
            if (roiDisplay === '—') {
                roiCell.className = 'pl-neutral';
            } else {
                roiCell.className = roiValue > 0 ? 'pl-positive' : roiValue < 0 ? 'pl-negative' : 'pl-neutral';
            }

            const annRoiCell = row.insertCell();
            const annualROIValue = safeNumber(trade.annualizedROI);
            const hasAnnualROI = this.isClosedStatus(trade.status) && annualROIValue !== null;
            if (hasAnnualROI) {
                const annualDisplay = this.formatPercent(annualROIValue, '—');
                annRoiCell.textContent = annualDisplay;
                annRoiCell.className = annualROIValue > 0 ? 'pl-positive' : annualROIValue < 0 ? 'pl-negative' : 'pl-neutral';
            } else {
                annRoiCell.textContent = '—';
                annRoiCell.className = 'pl-neutral';
            }

            const statusCell = row.insertCell();
            const statusBadge = document.createElement('span');
            const displayStatus = this.getDisplayStatus(trade);
            const statusClass = displayStatus.toLowerCase().replace(/\s+/g, '-');
            statusBadge.className = `status-badge ${statusClass}`.trim();
            statusBadge.textContent = displayStatus;
            statusCell.appendChild(statusBadge);

            const actionsCell = row.insertCell();
            actionsCell.className = 'actions-cell';

            const chartKeyBase = trade.id ?? trade.tradeId ?? trade.uniqueId ?? `${trade.ticker || 'trade'}-${index}`;
            const safeChartId = `trade-pl-${chartKeyBase}`.toString().replace(/[^a-zA-Z0-9_-]/g, '-');
            const footnoteId = `${safeChartId}-footnote`;
            const editButton = document.createElement('button');
            editButton.type = 'button';
            editButton.className = 'action-btn action-btn--edit';
            editButton.textContent = 'Edit';
            editButton.addEventListener('click', (event) => {
                event.stopPropagation();
                this.editTrade(trade.id);
            });

            const deleteButton = document.createElement('button');
            deleteButton.type = 'button';
            deleteButton.className = 'action-btn action-btn--delete';
            deleteButton.textContent = 'Delete';
            deleteButton.addEventListener('click', (event) => {
                event.stopPropagation();
                this.deleteTrade(trade.id);
            });

            actionsCell.append(editButton, deleteButton);

            row.setAttribute('tabindex', '0');
            row.setAttribute('aria-expanded', 'false');
            row.setAttribute('aria-controls', safeChartId);
            row.dataset.chartId = safeChartId;

            const detailRow = tbody.insertRow();
            detailRow.className = 'trade-detail-row';
            detailRow.setAttribute('aria-hidden', 'true');
            detailRow.style.display = 'none';
            detailRow.dataset.chartId = safeChartId;

            const detailCell = detailRow.insertCell(0);
            detailCell.colSpan = columnLabels.length;
            detailCell.innerHTML = `
                <div class="trade-diagram" data-chart-container="${safeChartId}">
                    <div class="trade-diagram__canvas">
                        <canvas id="${safeChartId}" aria-hidden="true"></canvas>
                    </div>
                    <p class="trade-diagram__footnote" id="${footnoteId}">Tap or click the trade row to generate the payoff diagram.</p>
                </div>
            `;

            const toggleDetail = () => {
                this.toggleTradePayoffDetail(row, detailRow, trade, safeChartId, footnoteId);
            };

            row.addEventListener('click', (event) => {
                if (event.target.closest('button') || event.target.closest('a') || event.target.closest('input') || event.target.closest('.trade-diagram')) {
                    return;
                }
                toggleDetail();
            });

            row.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    toggleDetail();
                }
            });

            this.applyResponsiveLabels(row, columnLabels);
        });

        this.syncTradeSelectionCheckboxes();
        this.updateMergeColumnVisibility();
        this.refreshTradesMergePanelContents();
    }

    toggleTradePayoffDetail(row, detailRow, trade, chartId, footnoteId) {
        if (!detailRow) {
            return;
        }

        const isOpen = !detailRow.classList.contains('is-open');

        detailRow.classList.toggle('is-open', isOpen);
        detailRow.style.display = isOpen ? 'table-row' : 'none';
        detailRow.setAttribute('aria-hidden', String(!isOpen));
        row?.setAttribute('aria-expanded', String(isOpen));

        const detailCanvas = detailRow.querySelector('canvas');
        if (detailCanvas) {
            detailCanvas.setAttribute('aria-hidden', String(!isOpen));
        }

        if (isOpen) {
            const renderPromise = this.renderTradePayoffChart(trade, chartId, footnoteId);
            if (renderPromise?.catch) {
                renderPromise.catch(error => {
                    console.error('Failed to render payoff chart:', error);
                });
            }
        } else {
            this.destroyTradePayoffChart(chartId, footnoteId);
        }
    }

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

        const yValues = payoff.points.map(point => point.y);
        let minY = Math.min(...yValues, 0);
        let maxY = Math.max(...yValues, 0);

        if (!Number.isFinite(minY) || !Number.isFinite(maxY)) {
            }
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

        if (Number.isFinite(payoff.breakeven)) {
            const breakevenIndex = datasets.findIndex(dataset => dataset.id === 'breakevenLine');
            if (breakevenIndex !== -1) {
                datasets[breakevenIndex].data = [
                    { x: payoff.breakeven, y: minY },
                    { x: payoff.breakeven, y: maxY }
                ];
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
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                if (!context.dataset || context.dataset.id !== 'payoffLine') {
                                    return null;
                                }
                                const price = Number(context.parsed?.x);
                                const value = Number(context.parsed?.y);
                                if (!Number.isFinite(price) || !Number.isFinite(value)) {
                                    return null;
                                }
                                const formattedValue = currencyFormatter.format(value);
                                const formattedPrice = currencyFormatter.format(price);
                                return `${context.dataset.label || 'P&L'}: ${formattedValue} @ ${formattedPrice}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'linear',
                        title: {
                            display: true,
                            text: 'Underlying Price ($)'
                        },
                        ticks: {
                            callback: (value) => currencyFormatter.format(Number(value))
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'P&L ($)'
                        },
                        ticks: {
                            callback: (value) => currencyFormatter.format(Number(value))
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

    destroyTradePayoffChart(chartId, footnoteId) {
        const existingChart = this.tradeDetailCharts?.get(chartId);
        if (existingChart) {
            try {
                existingChart.destroy();
            } catch (error) {
                console.warn('Failed to destroy payoff chart:', error);
            }
            this.tradeDetailCharts.delete(chartId);
        }

        const canvas = document.getElementById(chartId);
        const wrapper = canvas?.parentElement;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
            canvas.classList.remove('hidden');
        }
        wrapper?.classList.remove('trade-diagram__canvas--empty');

        if (footnoteId) {
            const footnote = document.getElementById(footnoteId);
            if (footnote) {
                footnote.textContent = 'Tap or click the trade row to generate the payoff diagram.';
            }
        }
    }

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

    getFallbackUnderlyingPrice(trade = {}) {
        const candidates = [
            trade.currentUnderlyingPrice,
            trade.currentPrice,
            trade.marketPrice,
            trade.lastUnderlyingPrice,
            trade.lastPrice,
            trade.markPrice,
            trade.referencePrice,
            trade.stockPriceAtEntry
        ];

        for (const value of candidates) {
            const numeric = Number(value);
            if (Number.isFinite(numeric) && numeric > 0) {
                return numeric;
            }
        }

        return null;
    }

    calculatePayoffSeries(trade) {
        const model = this.determinePayoffModel(trade);
        if (!model || model.type === 'unsupported') {
            return {
                message: model?.reason || 'Payoff diagram not available for this strategy yet.'
            };
        }

        switch (model.type) {
            case 'single':
                return this.calculateSingleLegSeries(trade, model);
            case 'vertical':
                return this.calculateVerticalSpreadSeries(trade, model);
            case 'covered-call':
                return this.calculateCoveredCallSeries(trade, model);
            case 'pmcc':
                return this.calculatePmccSeries(trade, model);
            default:
                return {
                    message: 'Payoff diagram not available for this strategy yet.'
                };
        }
    }

    determinePayoffModel(trade) {
        const strategyRaw = (trade.strategy || '').toString().trim();
        const strategy = strategyRaw.toLowerCase();
        const definedWidth = Number(trade.definedRiskWidth);

        if (!strategy) {
            return { type: 'unsupported', reason: 'Add a strategy name to unlock payoff diagrams.' };
        }

        const isPmccStrategy = strategy.includes("poor man's covered call")
            || strategy.includes('poor man')
            || strategy.includes('pmcc')
            || this.isPmccBaseLeg(trade)
            || this.isPmccShortCall(trade);

        if (isPmccStrategy) {
            const pmccLegs = this.extractPmccLegs(trade);
            if (!pmccLegs.baseLeg) {
                return {
                    type: 'unsupported',
                    reason: 'Add the PMCC base leg to this trade to unlock the payoff diagram.'
                };
            }
            return {
                type: 'pmcc',
                strategy,
                ...pmccLegs
            };
        }

        if (strategy.includes('covered call')) {
            return {
                type: 'covered-call',
                strategy
            };
        }

        const complexRegex = /(iron|straddle|strangle|butterfly|ratio|lizard|combo|synthetic|double|calendar|diagonal)/;
        const isComplex = complexRegex.test(strategy);

        const optionType = strategy.includes('put') ? 'put' : strategy.includes('call') ? 'call' : null;

        const isCalendarLike = /calendar|diagonal/.test(strategy);

        if (strategy.includes('spread') && !isCalendarLike && !(definedWidth > 0)) {
            return {
                type: 'unsupported',
                reason: 'Add the defined risk width to visualize this spread.'
            };
        }

        if (definedWidth > 0 && optionType && strategy.includes('spread') && !isCalendarLike) {
            const orientation = strategy.includes('short') || strategy.includes('credit') || this.inferTradeDirection(trade) === 'short'
                ? 'short'
                : 'long';
            return {
                type: 'vertical',
                optionType,
                orientation,
                width: Number(definedWidth),
                strategy
            };
        }

        if (isComplex) {
            return {
                type: 'unsupported',
                reason: 'Visualization for multi-leg strategies such as condors, straddles, or ratios is coming soon.'
            };
        }

        if (!optionType) {
            return {
                type: 'unsupported',
                reason: 'Unable to infer option type from the strategy name.'
            };
        }

        const direction = this.inferTradeDirection(trade) === 'short' ? 'short' : 'long';

        return {
            type: 'single',
            optionType,
            direction,
            strategy
        };
    }

    calculateSingleLegSeries(trade, model) {
        const strike = Number(trade.strikePrice);
        const premium = Number(trade.entryPrice);
        const fees = Number(trade.fees) || 0;
        const quantity = Math.abs(Number(trade.quantity) || 1);
        const spot = Number(trade.stockPriceAtEntry);

        if (!Number.isFinite(strike) || !Number.isFinite(premium)) {
            return {
                message: 'Provide both a strike price and entry price to view this payoff.'
            };
        }

        const priceRange = this.buildPriceRange({ strikeValues: [strike], spot });
        const multiplier = quantity * 100;
        const steps = 40;
        const points = [];

        for (let i = 0; i <= steps; i++) {
            const price = priceRange.minPrice + ((priceRange.maxPrice - priceRange.minPrice) * i) / steps;
            const intrinsic = this.optionIntrinsic(model.optionType, price, strike);
            const payoffPerShare = model.direction === 'long'
                ? intrinsic - premium
                : premium - intrinsic;
            const payoff = payoffPerShare * multiplier - fees;
            points.push({
                x: parseFloat(price.toFixed(2)),
                y: parseFloat(payoff.toFixed(2))
            });
        }

        const zeroLinePoints = points.map(point => ({ x: point.x, y: 0 }));

        const breakeven = model.optionType === 'call'
            ? strike + premium
            : strike - premium;

        const premiumValue = premium * multiplier;
        let maxProfit;
        let maxLoss;
        if (model.direction === 'long') {
            if (model.optionType === 'call') {
                maxProfit = Infinity;
            } else {
                maxProfit = Math.max((strike - premium) * multiplier - fees, 0);
            }
            maxLoss = premiumValue + fees;
        } else {
            maxProfit = Math.max(premiumValue - fees, 0);
            if (model.optionType === 'call') {
                maxLoss = Infinity;
            } else {
                maxLoss = Math.max((strike - premium) * multiplier + fees, 0);
            }
        }

        const summary = this.buildPayoffSummary({
            profileLabel: `${model.direction === 'short' ? 'Short' : 'Long'} ${model.optionType.toUpperCase()}`,
            breakeven,
            maxProfit,
            maxLoss,
            contracts: quantity,
            isCredit: model.direction === 'short'
        });

        return {
            points,
            zeroLinePoints,
            summary,
            breakeven,
            maxProfit,
            maxLoss
        };
    }

    calculateVerticalSpreadSeries(trade, model) {
        const primaryStrike = Number(trade.strikePrice);
        const entryPrice = Number(trade.entryPrice);
        const fees = Number(trade.fees) || 0;
        const quantity = Math.abs(Number(trade.quantity) || 1);
        const spot = Number(trade.stockPriceAtEntry);

        if (!Number.isFinite(primaryStrike) || !Number.isFinite(entryPrice)) {
            return {
                message: 'Provide strike and entry price to view this spread payoff.'
            };
        }

        if (!(model.width > 0)) {
            return {
                message: 'Add the defined risk width to visualize this spread.'
            };
        }

        let shortStrike;
        let longStrike;
        if (model.optionType === 'call') {
            if (model.orientation === 'short') {
                shortStrike = primaryStrike;
                longStrike = primaryStrike + model.width;
            } else {
                longStrike = primaryStrike;
                shortStrike = primaryStrike + model.width;
            }
        } else {
            if (model.orientation === 'short') {
                shortStrike = primaryStrike;
                longStrike = primaryStrike - model.width;
            } else {
                longStrike = primaryStrike;
                shortStrike = primaryStrike - model.width;
            }
        }

        if (!Number.isFinite(shortStrike) || !Number.isFinite(longStrike)) {
            return {
                message: 'Unable to determine both strikes for this spread.'
            };
        }

        const priceRange = this.buildPriceRange({ strikeValues: [shortStrike, longStrike], spot });
        const multiplier = quantity * 100;
        const steps = 40;
        const points = [];

        for (let i = 0; i <= steps; i++) {
            const price = priceRange.minPrice + ((priceRange.maxPrice - priceRange.minPrice) * i) / steps;
            const intrinsicShort = this.optionIntrinsic(model.optionType, price, shortStrike);
            const intrinsicLong = this.optionIntrinsic(model.optionType, price, longStrike);
            const payoffPerShare = model.orientation === 'short'
                ? entryPrice - (intrinsicShort - intrinsicLong)
                : (intrinsicLong - intrinsicShort) - entryPrice;
            const payoff = payoffPerShare * multiplier - fees;
            points.push({
                x: parseFloat(price.toFixed(2)),
                y: parseFloat(payoff.toFixed(2))
            });
        }

        const zeroLinePoints = points.map(point => ({ x: point.x, y: 0 }));

        const breakeven = this.calculateSpreadBreakeven({
            model,
            shortStrike,
            longStrike,
            entryPrice
        });

        const widthPerShare = Math.abs(shortStrike - longStrike);
        const widthValue = widthPerShare * multiplier;
        const entryValue = entryPrice * multiplier;

        let maxProfit;
        let maxLoss;
        if (model.orientation === 'short') {
            maxProfit = Math.max(entryValue - fees, 0);
            maxLoss = Math.max(widthValue - entryValue, 0) + fees;
        } else {
            maxProfit = Math.max(Math.max(widthValue - entryValue, 0) - fees, 0);
            maxLoss = entryValue + fees;
        }

        const summary = this.buildPayoffSummary({
            profileLabel: `${model.orientation === 'short' ? 'Short' : 'Long'} ${model.optionType === 'call' ? 'Call' : 'Put'} Spread`,
            breakeven,
            maxProfit,
            maxLoss,
            contracts: quantity,
            isCredit: model.orientation === 'short'
        });

        return {
            points,
            zeroLinePoints,
            summary,
            breakeven,
            maxProfit,
            maxLoss
        };
    }

    calculateCoveredCallSeries(trade) {
        const strike = Number(trade.strikePrice);
        const premium = Number(trade.entryPrice);
        const stockEntry = Number(trade.stockPriceAtEntry);
        const fees = Number(trade.fees) || 0;
        const quantity = Math.abs(Number(trade.quantity) || 1);

        if (!Number.isFinite(strike) || !Number.isFinite(premium) || !Number.isFinite(stockEntry)) {
            return {
                message: 'Covered call payoff requires strike, option premium, and stock cost basis.'
            };
        }

        const priceRange = this.buildPriceRange({ strikeValues: [strike, stockEntry], spot: stockEntry });
        const multiplier = quantity * 100;
        const steps = 40;
        const points = [];

        for (let i = 0; i <= steps; i++) {
            const price = priceRange.minPrice + ((priceRange.maxPrice - priceRange.minPrice) * i) / steps;
            const stockPnLPerShare = price - stockEntry;
            const optionPnLPerShare = premium - this.optionIntrinsic('call', price, strike);
            const payoff = (stockPnLPerShare + optionPnLPerShare) * multiplier - fees;
            points.push({
                x: parseFloat(price.toFixed(2)),
                y: parseFloat(payoff.toFixed(2))
            });
        }

        const zeroLinePoints = points.map(point => ({ x: point.x, y: 0 }));

        const breakeven = stockEntry - premium;
        const maxProfit = Math.max(((strike - stockEntry) + premium) * multiplier - fees, 0);
        const maxLoss = Math.max((stockEntry - premium) * multiplier + fees, 0);

        const summary = this.buildPayoffSummary({
            profileLabel: 'Covered Call (Stock + Short Call)',
            breakeven,
            maxProfit,
            maxLoss,
            contracts: quantity,
            isCredit: true
        });

        return {
            points,
            zeroLinePoints,
            summary,
            breakeven,
            maxProfit,
            maxLoss
        };
    }

    calculatePmccSeries(trade, model) {
        const baseLeg = model.baseLeg;
        if (!baseLeg) {
            return {
                message: 'Add the PMCC base leg to visualize this payoff.'
            };
        }

        const baseStrike = Number(baseLeg.strikePrice);
        const basePremium = Number(baseLeg.entryPrice);
        const baseFees = Number(baseLeg.fees) || 0;
        const baseQuantity = Math.abs(Number(baseLeg.quantity) || 1);

        if (!Number.isFinite(baseStrike) || !Number.isFinite(basePremium)) {
            return {
                message: 'Provide strike and entry price for the PMCC base leg to view this payoff.'
            };
        }

        const shortLeg = model.shortLeg;
        const shortStrike = Number(shortLeg?.strikePrice);
        const shortPremium = Number(shortLeg?.entryPrice);
        const shortFees = Number(shortLeg?.fees) || 0;
        const shortQuantity = Math.abs(Number(shortLeg?.quantity) || 0);
        const shortDirection = shortLeg ? this.inferTradeDirection(shortLeg) : null;

        const strikeValues = [baseStrike];
        if (Number.isFinite(shortStrike)) {
            strikeValues.push(shortStrike);
        }

        const spotFallback = this.getFallbackUnderlyingPrice(baseLeg)
            ?? (shortLeg ? this.getFallbackUnderlyingPrice(shortLeg) : null)
            ?? Number(baseLeg.stockPriceAtEntry);
        const priceRange = this.buildPriceRange({
            strikeValues,
            spot: Number.isFinite(spotFallback) ? spotFallback : Number.NaN
        });

        const steps = 80;
        const longMultiplier = baseQuantity * 100;
        const shortMultiplier = shortQuantity > 0 ? shortQuantity * 100 : longMultiplier;

        const points = [];
        for (let i = 0; i <= steps; i++) {
            const price = priceRange.minPrice + ((priceRange.maxPrice - priceRange.minPrice) * i) / steps;
            const longIntrinsic = Math.max(price - baseStrike, 0);
            const longPayoff = (longIntrinsic - basePremium) * longMultiplier - baseFees;

            let shortPayoff = 0;
            if (shortLeg && Number.isFinite(shortStrike) && Number.isFinite(shortPremium)) {
                const shortIntrinsic = Math.max(price - shortStrike, 0);
                const shortPerShare = shortDirection === 'short'
                    ? shortPremium - shortIntrinsic
                    : shortIntrinsic - shortPremium;
                shortPayoff = shortPerShare * shortMultiplier - shortFees;
            }

            const totalPayoff = longPayoff + shortPayoff;
            points.push({
                x: parseFloat(price.toFixed(2)),
                y: parseFloat(totalPayoff.toFixed(2))
            });
        }

        const zeroLinePoints = points.map(point => ({ x: point.x, y: 0 }));

        const baseCost = (basePremium * longMultiplier) + baseFees;
        let shortCredit = 0;
        if (shortLeg && Number.isFinite(shortPremium)) {
            if (shortDirection === 'short') {
                shortCredit = (shortPremium * shortMultiplier) - shortFees;
            } else {
                shortCredit = -((shortPremium * shortMultiplier) + shortFees);
            }
        }

        const netOutlay = baseCost - shortCredit;
        const perShareOutlay = longMultiplier > 0 ? netOutlay / longMultiplier : 0;
        const breakeven = Number.isFinite(perShareOutlay)
            ? baseStrike + perShareOutlay
            : null;

        let maxProfit = Infinity;
        if (shortLeg && Number.isFinite(shortStrike) && shortDirection === 'short') {
            const sharedContracts = Math.max(Math.min(baseQuantity, shortQuantity), 0);
            if (sharedContracts > 0) {
                const spreadWidth = shortStrike - baseStrike;
                if (Number.isFinite(spreadWidth)) {
                    maxProfit = (spreadWidth * 100 * sharedContracts) - netOutlay;
                }
            }
        }

        const maxLoss = netOutlay > 0 ? netOutlay : 0;

        const summary = this.buildPayoffSummary({
            profileLabel: "Poor Man's Covered Call",
            breakeven,
            maxProfit,
            maxLoss,
            contracts: baseQuantity,
            isCredit: netOutlay < 0
        });

        return {
            points,
            zeroLinePoints,
            summary,
            breakeven,
            maxProfit,
            maxLoss
        };
    }

    calculateSpreadBreakeven({ model, shortStrike, longStrike, entryPrice }) {
        if (model.orientation === 'short') {
            return model.optionType === 'call'
                ? shortStrike + entryPrice
                : shortStrike - entryPrice;
        }

        return model.optionType === 'call'
            ? longStrike + entryPrice
            : longStrike - entryPrice;
    }

    optionIntrinsic(optionType, price, strike) {
        if (!Number.isFinite(price) || !Number.isFinite(strike)) {
            return 0;
        }
        if (optionType === 'call') {
            return Math.max(price - strike, 0);
        }
        return Math.max(strike - price, 0);
    }

    extractPmccLegs(trade = {}) {
        const normalizeTicker = (value) => (value || '').toString().trim().toUpperCase();
        const ticker = normalizeTicker(trade.ticker);
        const candidates = ticker
            ? this.trades.filter(item => normalizeTicker(item.ticker) === ticker)
            : [];

        if (!candidates.includes(trade)) {
            candidates.push(trade);
        }

        const sortCandidates = (items = []) => {
            return [...items].sort((a, b) => {
                const statusA = this.normalizeStatus(a.status);
                const statusB = this.normalizeStatus(b.status);
                if (statusA === 'open' && statusB !== 'open') return -1;
                if (statusA !== 'open' && statusB === 'open') return 1;
                const dateA = new Date(a.entryDate || a.openDate || 0).getTime();
                const dateB = new Date(b.entryDate || b.openDate || 0).getTime();
                return dateB - dateA;
            });
        };

        const baseCandidates = sortCandidates(candidates.filter(item => this.isPmccBaseLeg(item)));
        let baseLeg = baseCandidates[0];
        if (!baseLeg) {
            const fallbackBase = sortCandidates(candidates.filter(item => this.inferTradeDirection(item) === 'long' && (item.strategy || '').toLowerCase().includes('call')));
            baseLeg = fallbackBase[0] || (this.inferTradeDirection(trade) === 'long' ? trade : null);
        }

        const shortCandidates = sortCandidates(candidates.filter(item => this.isPmccShortCall(item)));
        let shortLeg = shortCandidates[0];
        if (!shortLeg) {
            const fallbackShort = sortCandidates(candidates.filter(item => this.inferTradeDirection(item) === 'short' && (item.strategy || '').toLowerCase().includes('call')));
            shortLeg = fallbackShort[0] || (this.inferTradeDirection(trade) === 'short' ? trade : null);
        }

        if (baseLeg && shortLeg && baseLeg === shortLeg) {
            shortLeg = null;
        }

        return { baseLeg, shortLeg };
    }

    buildPriceRange({ strikeValues = [], spot = Number.NaN } = {}) {
        const values = strikeValues
            .map(value => Number(value))
            .filter(Number.isFinite);

        if (Number.isFinite(spot)) {
            values.push(spot);
        }

        if (values.length === 0) {
            return { minPrice: 0, maxPrice: 100 };
        }

        let minPrice = Math.max(Math.min(...values), 0);
        let maxPrice = Math.max(...values);

        if (minPrice === maxPrice) {
            minPrice = Math.max(0, minPrice * 0.7);
            maxPrice = maxPrice * 1.3 + 1;
        } else {
            const span = maxPrice - minPrice;
            minPrice = Math.max(0, minPrice - span * 0.3);
            maxPrice = maxPrice + span * 0.3;
        }

        if (maxPrice - minPrice < 5) {
            minPrice = Math.max(0, minPrice - 2.5);
            maxPrice = maxPrice + 2.5;
        }

        return { minPrice, maxPrice };
    }

    buildPayoffSummary({ profileLabel, breakeven, maxProfit, maxLoss, contracts, isCredit = false }) {
        const parts = [];
        if (profileLabel) {
            parts.push(profileLabel);
        }
        if (Number.isFinite(breakeven)) {
            parts.push(`Breakeven ${this.formatCurrency(breakeven)}`);
        }
        if (maxProfit === Infinity) {
            parts.push('Max profit unlimited');
        } else if (Number.isFinite(maxProfit)) {
            parts.push(`Max profit ${this.formatCurrency(maxProfit)}`);
        }
        if (maxLoss === Infinity) {
            parts.push('Max loss unlimited (theoretical)');
        } else if (Number.isFinite(maxLoss)) {
            parts.push(`Max loss ${this.formatCurrency(maxLoss)}`);
        }
        if (Number.isFinite(contracts)) {
            parts.push(`${contracts} contract${contracts === 1 ? '' : 's'}${isCredit ? ' (credit)' : ''}`);
        }
        return parts.join(' • ') || 'Payoff preview unavailable.';
    }

    formatPayoffFooter(payoff, formatter) {
        const formatValue = (value) => {
            if (value === Infinity || value === -Infinity) {
                return 'Unlimited';
            }
            if (Number.isFinite(value)) {
                return formatter.format(value);
            }
            return '—';
        };

        const maxProfitText = `Max profit ${formatValue(payoff?.maxProfit)}`;
        const maxLossText = `Max loss ${formatValue(payoff?.maxLoss)}`;
        const breakevenText = `Breakeven ${formatValue(payoff?.breakeven)}`;

        return [maxProfitText, maxLossText, breakevenText].join(' • ');
    }

    getTradePayoffMeta(trade) {
        const strategy = (trade.strategy || 'Unspecified strategy').toString();
        const tradeType = this.getTradeType(trade) || '—';
        const status = this.getDisplayStatus(trade);
        const qtyRaw = Math.abs(Number(trade.quantity));
        const quantity = Number.isFinite(qtyRaw) && qtyRaw > 0 ? `${qtyRaw} contract${qtyRaw === 1 ? '' : 's'}` : null;

        return [strategy, tradeType, quantity, status]
            .filter(Boolean)
            .join(' • ');
    }

    sortTrades(sortBy) {
        if (!sortBy) {
            return;
        }

        const direction = this.sortDirection[sortBy] === 'asc' ? 'desc' : 'asc';
        this.sortDirection[sortBy] = direction;
        this.currentSort = {
            key: sortBy,
            direction
        };

        // Update sort indicators
        document.querySelectorAll('.sortable').forEach(header => {
            header.classList.remove('asc', 'desc');
            header.removeAttribute('aria-sort');
        });
        const sortHeader = document.querySelector(`[data-sort="${sortBy}"]`);
        if (sortHeader) {
            sortHeader.classList.add(direction);
            sortHeader.setAttribute('aria-sort', direction === 'asc' ? 'ascending' : 'descending');
        }

        const sourceTrades = Array.isArray(this.currentFilteredTrades)
            ? this.currentFilteredTrades
            : this.trades;
        const sortedTrades = this.applySortToTrades(sourceTrades, sortBy, direction);

        this.currentFilteredTrades = sortedTrades.slice();
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
        if (!trade) {
            return;
        }

        this.resetAddTradeForm();
        this.currentEditingId = id;

        const form = document.getElementById('add-trade-form');
        if (!form) {
            return;
        }

        const elements = form.elements;

        if (elements.ticker) {
            elements.ticker.value = trade.ticker || '';
        }
        if (elements.strategy) {
            elements.strategy.value = trade.strategy || '';
        }
        if (elements.exitReason) {
            elements.exitReason.value = trade.exitReason || '';
        }
        if (elements.notes) {
            elements.notes.value = trade.notes || '';
        }
        if (elements.underlyingType) {
            const normalizedUnderlying = this.normalizeUnderlyingType(trade.underlyingType, { fallback: 'Stock' }) || 'Stock';
            elements.underlyingType.value = normalizedUnderlying;
        }
        if (elements.tradeStatus) {
            const manualStatus = this.normalizeTradeStatusInput(trade.statusOverride);
            elements.tradeStatus.value = manualStatus || '';
        }

        this.renderLegForms(trade.legs || []);
        this.updateTickerPreview(trade.ticker || '');

        this.showView('add-trade');
    }

    exportToCSV() {
        const headers = [
            'Ticker', 'Strategy', 'Trade Type', 'Strike', 'Defined Risk Width', 'Qty', 'Exit Price', 'DTE', 'Days Held',
            'Entry Date', 'Expiration Date', 'Exit Date', 'Max Risk', 'P&L', 'ROI %', 'Annual ROI %', 'Status',
            'Stock Price at Entry', 'Fees', 'Max Risk Override', 'IV Rank', 'Notes', 'Exit Reason'
        ];

        const escapeCsv = (value) => {
            if (value === null || value === undefined) {
                return '';
            }

            const text = String(value);
            if (text === '') {
                return '';
            }

            if (/[",\n]/.test(text)) {
                return `"${text.replace(/"/g, '""')}"`;
            }

            return text;
        };

        const sanitize = (value) => {
            if (value === null || value === undefined) {
                return '';
            }
            return value === '—' ? '' : value;
        };

        const formatCurrencyValue = (value) => {
            const numeric = Number(value);
            if (!Number.isFinite(numeric)) {
                return '';
            }
            return sanitize(this.formatCurrency(numeric));
        };

        const formatNumberValue = (value, decimals = 0) => {
            const numeric = Number(value);
            if (!Number.isFinite(numeric)) {
                return '';
            }
            return sanitize(this.formatNumber(numeric, { decimals, useGrouping: true }));
        };

        const formatPercentValue = (value) => {
            const numeric = Number(value);
            if (numeric === Number.POSITIVE_INFINITY) {
                return 'Infinite';
            }
            if (!Number.isFinite(numeric)) {
                return '';
            }
            const formatted = sanitize(this.formatNumber(numeric, { decimals: 2, useGrouping: true }));
            return formatted ? `${formatted}%` : `${numeric.toFixed(2)}%`;
        };

        const formatOptionalCurrency = (value) => (value === null || value === undefined ? '' : formatCurrencyValue(value));
        const formatOptionalNumber = (value, decimals = 0) => (value === null || value === undefined ? '' : formatNumberValue(value, decimals));

        const rows = this.trades.map(trade => {
            const fields = [
                trade.ticker ?? '',
                trade.strategy ?? '',
                this.getTradeType(trade) ?? '',
                formatOptionalCurrency(trade.strikePrice),
                formatOptionalCurrency(trade.definedRiskWidth),
                formatOptionalNumber(Math.abs(trade.quantity), 0),
                formatOptionalCurrency(trade.exitPrice),
                formatOptionalNumber(trade.dte, 0),
                formatOptionalNumber(trade.daysHeld, 0),
                trade.entryDate ?? '',
                trade.expirationDate ?? '',
                trade.exitDate ?? '',
                formatOptionalCurrency(trade.maxRisk),
                formatOptionalCurrency(trade.pl),
                formatPercentValue(trade.roi),
                formatPercentValue(trade.annualizedROI),
                trade.status ?? '',
                formatOptionalCurrency(trade.stockPriceAtEntry),
                formatOptionalCurrency(trade.fees),
                formatOptionalCurrency(trade.maxRiskOverride),
                formatOptionalNumber(trade.ivRank, 2),
                trade.notes ?? '',
                trade.exitReason ?? ''
            ];

            return fields.map(escapeCsv).join(',');
        });

        const csvContent = [
            headers.map(escapeCsv).join(','),
            ...rows
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

    getStorageTrades() {
        if (!Array.isArray(this.trades)) {
            return [];
        }

        return this.trades
            .map((trade) => this.buildTradeStorageSnapshot(trade))
            .filter(Boolean);
    }

    buildTradeStorageSnapshot(trade) {
        if (!trade || typeof trade !== 'object') {
            return null;
        }

        const snapshot = {};

        for (const [key, value] of Object.entries(trade)) {
            if (RUNTIME_TRADE_FIELDS.has(key)) {
                continue;
            }

            if (key === 'legs') {
                if (!Array.isArray(value)) {
                    snapshot.legs = [];
                } else {
                    const legs = value
                        .map((leg) => this.buildLegStorageSnapshot(leg))
                        .filter(Boolean);
                    snapshot.legs = legs;
                }
                continue;
            }

            if (value === undefined) {
                continue;
            }

            if (value === null) {
                snapshot[key] = null;
                continue;
            }

            if (Array.isArray(value)) {
                snapshot[key] = value.map((item) => (typeof item === 'object' && item !== null ? { ...item } : item));
                continue;
            }

            if (typeof value === 'object') {
                snapshot[key] = { ...value };
                continue;
            }

            snapshot[key] = value;
        }

        if (!Array.isArray(snapshot.legs)) {
            snapshot.legs = [];
        }

        return snapshot;
    }

    buildLegStorageSnapshot(leg) {
        if (!leg || typeof leg !== 'object') {
            return null;
        }

        const snapshot = {};

        for (const [key, value] of Object.entries(leg)) {
            if (RUNTIME_LEG_FIELDS.has(key)) {
                continue;
            }

            if (value === undefined) {
                continue;
            }

            if (value === null) {
                snapshot[key] = null;
                continue;
            }

            if (Array.isArray(value)) {
                snapshot[key] = value.slice();
                continue;
            }

            if (typeof value === 'object') {
                snapshot[key] = { ...value };
                continue;
            }

            snapshot[key] = value;
        }

        return snapshot;
    }

    buildDatabasePayload() {
        return {
            trades: this.getStorageTrades(),
            exportDate: new Date().toISOString(),
            version: '2.5'
        };
    }

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

    saveWithDownload(data) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'gammaledger.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.currentFileName = 'gammaledger.json';
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

        this.processLoadedData(data, { fileName: fileHandle.name, source: 'file-open' });
        this.currentFileHandle = fileHandle;
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
                        this.processLoadedData(data, { fileName: file.name, source: 'file-open' });
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

    setupImportControls() {
        if (this.importControlsInitialized) {
            return;
        }

        const ofxButton = document.getElementById('import-ofx-btn');
        const jsonButton = document.getElementById('import-json-btn');
        const ofxInput = document.getElementById('import-ofx-input');
        const jsonInput = document.getElementById('import-json-input');

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

        if (jsonButton && jsonInput) {
            jsonButton.addEventListener('click', (event) => {
                event.preventDefault();
                jsonInput.value = '';
                jsonInput.click();
            });

            jsonInput.addEventListener('change', async (event) => {
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
                    this.showLoadingIndicator('Importing JSON...');
                    const text = await file.text();
                    const data = JSON.parse(text);
                    const tradeCount = Array.isArray(data?.trades) ? data.trades.length : 0;
                    this.processLoadedData(data, { fileName: file.name || 'Imported JSON', source: 'json-import' });
                    this.appendImportLog({
                        type: 'success',
                        message: `Imported ${tradeCount} trades from ${file.name || 'JSON file'}.`,
                        timestamp: new Date()
                    });
                } catch (error) {
                    console.error('JSON import error:', error);
                    this.showNotification('Invalid JSON file', 'error');
                    this.appendImportLog({
                        type: 'error',
                        message: `Failed to import JSON: ${error?.message || 'Unknown error'}.`,
                        timestamp: new Date()
                    });
                } finally {
                    this.hideLoadingIndicator();
                }
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

        this.renderImportSummary();
        this.refreshImportMergeList();
        this.importControlsInitialized = true;
    }

    setupTradesMergeControls() {
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

            const selectAll = document.getElementById('trades-select-all');
            if (selectAll) {
                selectAll.addEventListener('change', (event) => {
                    this.handleSelectAllTrades(Boolean(event.target.checked));
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

    toggleTradesMergePanel(forceOpen = null) {
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

    updateTradesMergeToggleLabel() {
        const toggleButton = document.getElementById('trades-merge-toggle');
        if (!toggleButton) {
            return;
        }

        const expanded = Boolean(this.tradesMergePanelOpen);
        toggleButton.textContent = expanded ? 'Hide Merge Trades' : 'Merge Trades';
        toggleButton.setAttribute('aria-expanded', String(expanded));
        toggleButton.classList.toggle('is-active', expanded);
    }

    updateMergeColumnVisibility() {
        const hidden = !this.tradesMergePanelOpen;
        const headerCell = document.querySelector('.trade-select-header');
        if (headerCell) {
            headerCell.classList.toggle('is-hidden', hidden);
            headerCell.setAttribute('aria-hidden', String(hidden));
        }

        const selectAll = document.getElementById('trades-select-all');
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
            checkbox.disabled = hidden;
            checkbox.tabIndex = hidden ? -1 : 0;
        });
    }

    refreshTradesMergePanelContents() {
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
                mergeButton.disabled = true;
                mergeButton.textContent = 'Merge Selected Trades';
                mergeButton.title = 'Enable the merge panel to review trade combinations.';
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

    appendImportLog(entry = {}) {
        const timestamp = entry.timestamp instanceof Date ? entry.timestamp : new Date();
        const type = entry.type || 'info';
        const message = entry.message || '';
        if (!message) {
            return;
        }

        this.importLog = [{ timestamp, type, message }, ...this.importLog].slice(0, 12);
        this.renderImportLog();
    }

    renderImportLog() {
        const container = document.getElementById('import-log');
        if (!container) {
            return;
        }

        if (!Array.isArray(this.importLog) || this.importLog.length === 0) {
            container.innerHTML = '<p>No imports recorded yet.</p>';
            return;
        }

        const formatter = new Intl.DateTimeFormat('en-US', {
            dateStyle: 'medium',
            timeStyle: 'short'
        });

        container.innerHTML = this.importLog.map((entry) => {
            const timeLabel = formatter.format(entry.timestamp);
            const statusLabel = entry.type === 'error' ? 'Error' : entry.type === 'success' ? 'Success' : 'Info';
            return `<div class="import-log__entry"><strong>${statusLabel} · ${timeLabel}</strong><span>${this.escapeHTML(entry.message)}</span></div>`;
        }).join('');
    }

    updateImportSummary(details = {}) {
        const timestamp = details.timestamp instanceof Date
            ? details.timestamp
            : new Date(details.timestamp || Date.now());

        const summary = {
            timestamp,
            fileName: details.fileName || 'OFX import',
            batchId: details.batchId || null,
            stats: { ...(details.stats || {}) },
            reviewTradeIds: Array.isArray(details.reviewTradeIds)
                ? details.reviewTradeIds.slice()
                : [],
            mergedTrades: Number.isFinite(details.mergedTrades) ? Number(details.mergedTrades) : 0
        };

        this.importSummary = summary;
        this.importMergeSelection.clear();
    }

    renderImportSummary() {
        const container = document.getElementById('import-summary');
        if (!container) {
            return;
        }

        if (!this.importSummary) {
            container.innerHTML = '<p class="import-summary__empty">Run an OFX import to see how many trades and legs were created.</p>';
            return;
        }

        const summary = this.importSummary;
        const stats = summary.stats || {};
        const fileName = summary.fileName || 'OFX import';
        const timestamp = summary.timestamp instanceof Date
            ? summary.timestamp
            : new Date(summary.timestamp || Date.now());
        const dateFormatter = new Intl.DateTimeFormat('en-US', {
            dateStyle: 'medium',
            timeStyle: 'short'
        });
        const timestampLabel = Number.isNaN(timestamp.getTime()) ? '—' : dateFormatter.format(timestamp);
        const formatValue = (value) => {
            const numeric = Number(value);
            if (Number.isFinite(numeric)) {
                return this.formatNumber(numeric, { decimals: 0, useGrouping: true }) ?? '0';
            }
            if (value === null || value === undefined) {
                return '0';
            }
            return value.toString();
        };

        const legsImported = (stats.legsAddedToNewTrades || 0) + (stats.legsAddedToUpdates || 0);
        const reviewThisBatch = this.countImportReviewTrades(summary.batchId);
        const reviewAll = this.countImportReviewTrades();

        const metrics = [
            { label: 'Transactions processed', value: stats.totalTransactions ?? 0 },
            { label: 'Trades created', value: stats.totalTradesCreated ?? ((stats.tradesCreated || 0) + (stats.reviewTradesCreated || 0)) },
            { label: 'Trades updated', value: stats.tradesUpdated ?? 0 },
            { label: summary.batchId ? 'Review trades (this import)' : 'Review trades pending', value: reviewThisBatch },
            { label: 'Legs imported', value: legsImported },
            { label: 'Duplicate legs skipped', value: stats.duplicateLegs ?? 0 }
        ];

        if ((summary.mergedTrades || 0) > 0) {
            metrics.push({ label: 'Manual merges', value: summary.mergedTrades });
        }

        if (summary.batchId && reviewAll > reviewThisBatch) {
            metrics.push({ label: 'Review trades (all)', value: reviewAll });
        }

        container.innerHTML = `
            <div class="import-summary__meta">
                <span title="Imported file">${this.escapeHTML(fileName)}</span>
                <span title="Imported at">${this.escapeHTML(timestampLabel)}</span>
            </div>
            <div class="import-summary__grid">
                ${metrics.map((metric) => `
                    <div class="import-summary__item">
                        <span class="import-summary__value">${this.escapeHTML(formatValue(metric.value))}</span>
                        <span class="import-summary__label">${this.escapeHTML(metric.label)}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    countImportReviewTrades(batchId = null) {
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

    getImportReviewTrades() {
        return this.trades
            .filter((trade) => trade?.importReview)
            .slice()
            .sort((a, b) => {
                const aDate = new Date(a.openedDate || a.entryDate || 0).getTime();
                const bDate = new Date(b.openedDate || b.entryDate || 0).getTime();
                return bDate - aDate;
            });
    }

    refreshImportMergeList() {
        const container = document.getElementById('import-merge-list');
        const hintElement = document.getElementById('import-merge-hint');
        const hintButton = document.getElementById('import-merge-hint-btn');
        const mergeButton = document.getElementById('import-merge-btn');
        const reviewTrades = this.getImportReviewTrades();

        if (!reviewTrades.length) {
            this.importMergeSelection.clear();
        } else {
            const presentIds = new Set(reviewTrades.map((trade) => trade.id));
            Array.from(this.importMergeSelection).forEach((id) => {
                if (!presentIds.has(id)) {
                    this.importMergeSelection.delete(id);
                }
            });
        }

        if (hintElement) {
            if (!reviewTrades.length) {
                hintElement.textContent = 'No review trades require manual merging right now.';
            } else {
                const tradeLabel = reviewTrades.length === 1 ? 'review trade' : 'review trades';
                hintElement.textContent = `Detected ${reviewTrades.length} ${tradeLabel} that might be combined. Open the All Trades page and enable "Merge Trades" to review them.`;
            }
        }

        if (hintButton) {
            if (!reviewTrades.length) {
                hintButton.disabled = true;
                hintButton.title = 'No merge opportunities detected from the latest import.';
            } else {
                hintButton.disabled = false;
                hintButton.title = 'Review potential merges on the All Trades page.';
            }
        }

        if (!container) {
            if (mergeButton) {
                mergeButton.disabled = true;
                mergeButton.textContent = 'Merge Selected Trades';
            }
            return;
        }

        if (!reviewTrades.length) {
            container.innerHTML = '<p class="import-merge__empty">No review trades are waiting to be merged.</p>';
            if (mergeButton) {
                mergeButton.disabled = true;
                mergeButton.textContent = 'Merge Selected Trades';
            }
            return;
        }

        const dateFormatter = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' });

        container.innerHTML = reviewTrades.map((trade) => {
            const isChecked = this.importMergeSelection.has(trade.id);
            const legsCount = Array.isArray(trade.legs) ? trade.legs.length : 0;
            const rawDate = trade.openedDate || trade.entryDate || '';
            const parsedDate = rawDate ? new Date(rawDate) : null;
            const dateLabel = parsedDate && !Number.isNaN(parsedDate.getTime()) ? dateFormatter.format(parsedDate) : '—';
            let notePreview = (trade.notes || '').trim();
            if (notePreview.length > 140) {
                notePreview = `${notePreview.slice(0, 137)}…`;
            }
            const batchLabel = trade.importBatchId ? `Batch ${trade.importBatchId}` : 'Manual Review';
            const cardClasses = ['import-merge-card'];
            if (isChecked) {
                cardClasses.push('is-selected');
            }

            return `
                <div class="${cardClasses.join(' ')}" data-trade-id="${this.escapeHTML(trade.id)}">
                    <label class="import-merge-card__label">
                        <input type="checkbox" value="${this.escapeHTML(trade.id)}" ${isChecked ? 'checked' : ''} />
                        <div class="import-merge-card__content">
                            <div class="import-merge-card__header">
                                <span class="import-merge-card__ticker">${this.escapeHTML(trade.ticker || '—')}</span>
                                <span class="import-merge-card__legs">${legsCount} leg${legsCount === 1 ? '' : 's'}</span>
                            </div>
                            <div class="import-merge-card__meta">
                                <span>${this.escapeHTML(batchLabel)}</span>
                                <span>${this.escapeHTML(dateLabel)}</span>
                            </div>
                            ${notePreview ? `<p class="import-merge-card__notes">${this.escapeHTML(notePreview)}</p>` : ''}
                        </div>
                    </label>
                </div>
            `;
        }).join('');

        container.querySelectorAll('input[type="checkbox"]').forEach((input) => {
            input.addEventListener('change', (event) => {
                const checkbox = event.target;
                const value = checkbox.value;
                if (!value) {
                    return;
                }
                if (checkbox.checked) {
                    this.importMergeSelection.add(value);
                } else {
                    this.importMergeSelection.delete(value);
                }
                const card = checkbox.closest('.import-merge-card');
                if (card) {
                    card.classList.toggle('is-selected', checkbox.checked);
                }
                this.updateImportMergeButtonState();
            });
        });

        this.updateImportMergeButtonState();
    }

    updateImportMergeButtonState() {
        const mergeButton = document.getElementById('import-merge-btn');
        if (!mergeButton) {
            return;
        }

        const count = this.importMergeSelection.size;
        mergeButton.disabled = count < 2;
        mergeButton.textContent = count >= 2
            ? `Merge ${count} Trades`
            : 'Merge Selected Trades';
    }

    resolveMergedExitReason(trades = []) {
        const reasons = Array.isArray(trades)
            ? trades
                .map((trade) => (trade?.exitReason || '').toString().trim())
                .filter(Boolean)
            : [];

        if (reasons.length === 0) {
            return '';
        }

        const uniqueReasons = Array.from(new Set(reasons));
        if (uniqueReasons.length === 1) {
            return uniqueReasons[0];
        }

        return `${uniqueReasons[0]} (+${uniqueReasons.length - 1} more)`;
    }

    buildMergedTradeNote(trades = [], prefix = '') {
        const timestamp = new Date();
        const safePrefix = (prefix || '').toString().trim().replace(/\.*$/, '');
        const prefixText = safePrefix ? `${safePrefix}. ` : '';
        const count = Array.isArray(trades) ? trades.length : 0;
        const dateLabel = timestamp.toLocaleDateString('en-US', { dateStyle: 'medium' });
        const timeLabel = timestamp.toLocaleTimeString('en-US', { timeStyle: 'short' });
        const header = `${prefixText}Merged ${count} trade${count === 1 ? '' : 's'} on ${dateLabel} at ${timeLabel}.`;
        const idLine = `Source trades: ${trades.map((trade) => trade.id).join(', ')}.`;
        const priorNotes = trades
            .map((trade) => (trade.notes || '').trim())
            .filter(Boolean);

        if (!priorNotes.length) {
            return `${header} ${idLine}`;
        }

        return `${header} ${idLine}\n\n${priorNotes.join('\n\n')}`;
    }

    createMergedTradeFromTrades(trades = [], options = {}) {
        const candidates = Array.isArray(trades)
            ? trades.filter((trade) => trade && Array.isArray(trade.legs) && trade.legs.length > 0)
            : [];

        if (candidates.length < 2) {
            throw new Error('At least two trades with legs are required to merge.');
        }

        const tickerSet = new Set(
            candidates
                .map((trade) => (trade.ticker || '').toUpperCase())
                .filter(Boolean)
        );

        if (tickerSet.size > 1) {
            throw new Error('Trades must share the same ticker before merging.');
        }

        const mergedLegs = [];
        let batchId = typeof options.batchId === 'string' ? options.batchId : null;

        candidates.forEach((trade) => {
            if (!batchId && trade.importBatchId) {
                batchId = trade.importBatchId;
            }
            (trade.legs || []).forEach((leg, index) => {
                if (!leg) {
                    return;
                }
                const clone = { ...leg };
                if (!clone.id) {
                    clone.id = `LEG-${trade.id}-${index}`;
                }
                if (batchId && !clone.importBatchId) {
                    clone.importBatchId = batchId;
                }
                mergedLegs.push(clone);
            });
        });

        if (!mergedLegs.length) {
            throw new Error('No legs were found to merge.');
        }

        const idPrefix = options.idPrefix || 'MERGED';
        const mergedId = `${idPrefix}-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
        const baseTrade = options.baseTrade || candidates[0];
        const ticker = tickerSet.size ? Array.from(tickerSet)[0] : 'UNKNOWN';

        const strategyOverride = options.strategyOverride && options.strategyOverride.toString().trim();
        const strategyCandidates = candidates
            .map((trade) => (trade.strategy || '').toString().trim())
            .filter(Boolean);
        const preferredStrategy = strategyCandidates.find((value) => value && value !== 'Import Review' && value !== 'Imported Multi-Leg');
        const fallbackStrategy = strategyCandidates[0] || 'Imported Multi-Leg';
        const strategy = strategyOverride || preferredStrategy || fallbackStrategy;

        const normalizedUnderlying = this.normalizeUnderlyingType(baseTrade?.underlyingType, { fallback: 'Stock' });
        const manualStatus = this.normalizeTradeStatusInput(baseTrade?.statusOverride);

        const mergedTrade = this.enrichTradeData({
            id: mergedId,
            ticker,
            strategy,
            status: baseTrade?.status || 'Open',
            statusOverride: manualStatus || null,
            notes: this.buildMergedTradeNote(candidates, options.notePrefix || ''),
            legs: mergedLegs,
            importBatchId: batchId || null,
            importReview: false,
            exitReason: options.exitReasonOverride || this.resolveMergedExitReason(candidates),
            underlyingType: normalizedUnderlying
        });

        return mergedTrade;
    }

    mergeSelectedImportTrades() {
        const selectedIds = Array.from(this.importMergeSelection);
        if (selectedIds.length < 2) {
            this.showNotification('Select at least two review trades to merge.', 'info');
            return;
        }

        const tradesToMerge = selectedIds
            .map((id) => this.trades.find((trade) => trade.id === id))
            .filter(Boolean);

        if (tradesToMerge.length < 2) {
            this.showNotification('Unable to locate all selected trades. Refresh the list and try again.', 'error');
            this.refreshImportMergeList();
            return;
        }

        let mergedTrade;
        try {
            mergedTrade = this.createMergedTradeFromTrades(tradesToMerge, {
                idPrefix: 'IMP-MERGED',
                notePrefix: 'Import review merge'
            });
        } catch (error) {
            this.showNotification(error.message, 'error');
            return;
        }

        const removalSet = new Set(tradesToMerge.map((trade) => trade.id));
        this.trades = this.trades.filter((trade) => !removalSet.has(trade.id));
        this.trades.push(mergedTrade);

        if (this.importSummary) {
            this.importSummary.mergedTrades = (this.importSummary.mergedTrades || 0) + 1;
            if (Array.isArray(this.importSummary.reviewTradeIds)) {
                this.importSummary.reviewTradeIds = this.importSummary.reviewTradeIds.filter((id) => !removalSet.has(id));
            }
        }

        this.importMergeSelection.clear();
        tradesToMerge.forEach((trade) => this.tradeMergeSelection.delete(trade.id));
        this.saveToStorage({ fileName: this.currentFileName });
        this.markUnsavedChanges();
        this.updateDashboard();
        if (typeof this.updateTradesList === 'function') {
            this.updateTradesList();
        }

        const ticker = mergedTrade.ticker || 'Trade';
        this.appendImportLog({
            type: 'success',
            message: `Merged ${tradesToMerge.length} review trades into a ${mergedTrade.legsCount}-leg trade for ${ticker}.`,
            timestamp: new Date()
        });
        this.showNotification('Review trades merged into a single multi-leg trade.', 'success');

        this.renderImportSummary();
        this.refreshImportMergeList();
    this.refreshTradesMergePanelContents();
    }

    mergeSelectedTradesFromList() {
        const selectedIds = Array.from(this.tradeMergeSelection);
        if (selectedIds.length < 2) {
            this.showNotification('Select at least two trades to merge.', 'info');
            return;
        }

        const tradesToMerge = selectedIds
            .map((id) => this.trades.find((trade) => trade.id === id))
            .filter(Boolean);

        if (tradesToMerge.length < 2) {
            this.showNotification('Unable to locate all selected trades. Refresh the table and try again.', 'error');
            this.pruneTradeMergeSelection();
            return;
        }

        const tickerSet = new Set(
            tradesToMerge
                .map((trade) => (trade.ticker || '').toUpperCase())
                .filter(Boolean)
        );

        if (tickerSet.size !== 1) {
            this.showNotification('Trades must share the same ticker before merging.', 'error');
            return;
        }

        const ticker = Array.from(tickerSet)[0];
        const totalLegs = tradesToMerge.reduce((acc, trade) => acc + ((trade.legs || []).length || 0), 0);
        const statuses = Array.from(new Set(tradesToMerge.map((trade) => this.getDisplayStatus(trade)))).filter(Boolean);
        const entryDates = tradesToMerge
            .map((trade) => this.parseDateValue(trade.entryDate || trade.openedDate))
            .filter((date) => date instanceof Date && !Number.isNaN(date.getTime()))
            .sort((a, b) => a.getTime() - b.getTime());
    const dateFormatter = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' });
        const entryRange = entryDates.length
            ? `${dateFormatter.format(entryDates[0])} - ${dateFormatter.format(entryDates[entryDates.length - 1])}`
            : 'N/A';
        const netOpenContracts = tradesToMerge.reduce((acc, trade) => acc + Math.max(0, Number(trade.openContracts) || 0), 0);

        const confirmMessage = [
            `Merge ${tradesToMerge.length} trades for ${ticker}?`,
            `Total legs: ${totalLegs}`,
            `Status mix: ${statuses.join(', ') || 'N/A'}`,
            `Entry range: ${entryRange}`,
            `Open contracts (net): ${netOpenContracts}`,
            'The original trades will be replaced by a single multi-leg trade.',
            'Continue?'
        ].join('\n');

        if (!window.confirm(confirmMessage)) {
            return;
        }

        let mergedTrade;
        try {
            mergedTrade = this.createMergedTradeFromTrades(tradesToMerge, {
                idPrefix: 'MANUAL-MERGED',
                notePrefix: 'Manual merge'
            });
        } catch (error) {
            this.showNotification(error.message, 'error');
            return;
        }

        const removalSet = new Set(tradesToMerge.map((trade) => trade.id));
        this.trades = this.trades.filter((trade) => !removalSet.has(trade.id));
        this.trades.push(mergedTrade);

        if (this.importSummary) {
            this.importSummary.mergedTrades = (this.importSummary.mergedTrades || 0) + 1;
        }

        this.tradeMergeSelection.clear();
        this.saveToStorage({ fileName: this.currentFileName });
        this.markUnsavedChanges();
        this.filterTrades();
        this.updateDashboard();
        this.renderImportSummary();
        this.refreshImportMergeList();

        this.appendImportLog({
            type: 'success',
            message: `Merged ${tradesToMerge.length} trades into a ${mergedTrade.legsCount}-leg trade for ${mergedTrade.ticker}.`,
            timestamp: new Date()
        });
        this.showNotification(`Merged ${tradesToMerge.length} trades for ${mergedTrade.ticker}.`, 'success');
    }

    renderTradeMergeSelectionSummary() {
        const summary = document.getElementById('trades-merge-summary');
        if (!summary) {
            return;
        }

        const selectedIds = Array.from(this.tradeMergeSelection);
        if (!selectedIds.length) {
            summary.textContent = 'Select two or more trades with the same ticker to enable merging.';
            return;
        }

        const selectedTrades = selectedIds
            .map((id) => this.trades.find((trade) => trade.id === id))
            .filter(Boolean);

        if (!selectedTrades.length) {
            this.tradeMergeSelection.clear();
            summary.textContent = 'Select two or more trades with the same ticker to enable merging.';
            return;
        }

        const tickers = Array.from(new Set(selectedTrades.map((trade) => (trade.ticker || '').toUpperCase()).filter(Boolean)));
        const totalLegs = selectedTrades.reduce((acc, trade) => acc + ((trade.legs || []).length || 0), 0);
        const statuses = Array.from(new Set(selectedTrades.map((trade) => this.getDisplayStatus(trade)))).filter(Boolean);
        const parts = [
            `<strong>${this.escapeHTML(`${selectedTrades.length} trade${selectedTrades.length === 1 ? '' : 's'} selected`)}</strong>`,
            tickers.length ? `<span>${this.escapeHTML(tickers.length === 1 ? `Ticker: ${tickers[0]}` : `Tickers: ${tickers.join(', ')}`)}</span>` : '',
            `<span>${this.escapeHTML(`Total legs: ${totalLegs}`)}</span>`,
            statuses.length ? `<span>${this.escapeHTML(`Status mix: ${statuses.join(', ')}`)}</span>` : ''
        ];

        if (tickers.length > 1) {
            parts.push(`<span>${this.escapeHTML('Different tickers selected - merge disabled')}</span>`);
        }

        summary.innerHTML = parts.filter(Boolean).join(' ');
    }

    renderTradeMergeGroups(trades = this.currentFilteredTrades) {
        const container = document.getElementById('trades-merge-groups');
        if (!container) {
            return;
        }

        const list = Array.isArray(trades) ? trades : [];
        const grouped = list.reduce((acc, trade) => {
            const ticker = (trade.ticker || '').toUpperCase();
            if (!ticker) {
                return acc;
            }
            if (!acc.has(ticker)) {
                acc.set(ticker, []);
            }
            acc.get(ticker).push(trade);
            return acc;
        }, new Map());

        const eligible = Array.from(grouped.entries())
            .filter(([, tradesForTicker]) => tradesForTicker.length >= 2)
            .sort(([a], [b]) => a.localeCompare(b));

        if (!eligible.length) {
            container.innerHTML = '<p class="trades-merge-groups__empty">Need at least two trades sharing a ticker to merge.</p>';
            return;
        }

        container.innerHTML = eligible.map(([ticker, tradesForTicker]) => {
            const selectedCount = tradesForTicker.filter((trade) => this.tradeMergeSelection.has(trade.id)).length;
            const statuses = Array.from(new Set(tradesForTicker.map((trade) => this.getDisplayStatus(trade)))).filter(Boolean);
            const legCount = tradesForTicker.reduce((acc, trade) => acc + ((trade.legs || []).length || 0), 0);
            const allSelected = selectedCount === tradesForTicker.length;
            const remaining = tradesForTicker.length - selectedCount;
            const buttonLabel = allSelected
                ? `Clear ${ticker} selection`
                : remaining === tradesForTicker.length
                    ? `Select ${tradesForTicker.length} trades`
                    : `Select remaining (${remaining})`;

            return `
                <div class="trades-merge-group" data-ticker="${this.escapeHTML(ticker)}">
                    <div class="trades-merge-group__header">
                        <span class="trades-merge-group__ticker">${this.escapeHTML(ticker)}</span>
                        <span class="trades-merge-group__count">${this.escapeHTML(`${tradesForTicker.length} trades • ${legCount} legs`)}</span>
                    </div>
                    <div class="trades-merge-group__body">
                        ${statuses.length ? `<span>Statuses: ${this.escapeHTML(statuses.join(', '))}</span>` : ''}
                        <span>Selected: ${this.escapeHTML(`${selectedCount}/${tradesForTicker.length}`)}</span>
                    </div>
                    <div class="trades-merge-group__actions">
                        <button type="button" class="btn btn--sm btn--secondary trades-merge-group__toggle" data-ticker="${this.escapeHTML(ticker)}">${this.escapeHTML(buttonLabel)}</button>
                    </div>
                </div>
            `;
        }).join('');

        container.querySelectorAll('.trades-merge-group__toggle').forEach((button) => {
            button.addEventListener('click', (event) => {
                event.preventDefault();
                const ticker = (button.getAttribute('data-ticker') || '').toUpperCase();
                if (!ticker) {
                    return;
                }
                const tradesForTicker = (Array.isArray(this.currentFilteredTrades) ? this.currentFilteredTrades : [])
                    .filter((trade) => (trade.ticker || '').toUpperCase() === ticker);
                if (!tradesForTicker.length) {
                    return;
                }
                const allSelected = tradesForTicker.every((trade) => this.tradeMergeSelection.has(trade.id));
                tradesForTicker.forEach((trade) => {
                    if (allSelected) {
                        this.tradeMergeSelection.delete(trade.id);
                    } else {
                        this.tradeMergeSelection.add(trade.id);
                    }
                });
                this.syncTradeSelectionCheckboxes();
                this.refreshTradesMergePanelContents();
            });
        });
    }

    updateTradesMergeButtonState() {
        const mergeButton = document.getElementById('trades-merge-btn');
        if (!mergeButton) {
            return;
        }

        if (!this.tradesMergePanelOpen) {
            mergeButton.disabled = true;
            mergeButton.textContent = 'Merge Selected Trades';
            mergeButton.title = 'Enable the merge panel to review trade combinations.';
            return;
        }

        const selectedTrades = Array.from(this.tradeMergeSelection)
            .map((id) => this.trades.find((trade) => trade.id === id))
            .filter(Boolean);

        if (selectedTrades.length < 2) {
            mergeButton.disabled = true;
            mergeButton.textContent = 'Merge Selected Trades';
            mergeButton.title = 'Select at least two trades to merge.';
            return;
        }

        const tickers = new Set(selectedTrades.map((trade) => (trade.ticker || '').toUpperCase()).filter(Boolean));
        if (tickers.size !== 1) {
            mergeButton.disabled = true;
            mergeButton.textContent = 'Merge Selected Trades';
            mergeButton.title = 'Select trades that share the same ticker.';
            return;
        }

        mergeButton.disabled = false;
        mergeButton.textContent = `Merge ${selectedTrades.length} Trades`;
        mergeButton.title = `Merge ${selectedTrades.length} trades for ${Array.from(tickers)[0]}.`;
    }

    syncTradeSelectionCheckboxes() {
        document.querySelectorAll('.trade-merge-checkbox').forEach((checkbox) => {
            const id = checkbox.dataset.tradeId;
            checkbox.checked = !!id && this.tradeMergeSelection.has(id);
        });
        this.syncSelectAllCheckbox();
    }

    syncSelectAllCheckbox() {
        const selectAll = document.getElementById('trades-select-all');
        if (!selectAll) {
            return;
        }

        const checkboxes = Array.from(document.querySelectorAll('.trade-merge-checkbox'));
        const mergeEnabled = this.tradesMergePanelOpen && checkboxes.length;

        if (!mergeEnabled) {
            selectAll.checked = false;
            selectAll.indeterminate = false;
            selectAll.disabled = true;
            return;
        }

        selectAll.disabled = false;

        const selectedVisible = checkboxes.filter((checkbox) => {
            const id = checkbox.dataset.tradeId;
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

    handleSelectAllTrades(checked) {
        if (!this.tradesMergePanelOpen) {
            return;
        }

        const checkboxes = Array.from(document.querySelectorAll('.trade-merge-checkbox'));
        if (!checkboxes.length) {
            return;
        }

        checkboxes.forEach((checkbox) => {
            const id = checkbox.dataset.tradeId;
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

    pruneTradeMergeSelection() {
        if (!(this.tradeMergeSelection instanceof Set) || this.tradeMergeSelection.size === 0) {
            return;
        }

        const existingIds = new Set(this.trades.map((trade) => trade.id));
        let changed = false;
        this.tradeMergeSelection.forEach((id) => {
            if (!existingIds.has(id)) {
                this.tradeMergeSelection.delete(id);
                changed = true;
            }
        });

        if (changed) {
            this.syncTradeSelectionCheckboxes();
            this.refreshTradesMergePanelContents();
        }
    }

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

    parseOfx(raw) {
        if (typeof raw !== 'string') {
            throw new Error('OFX payload is invalid.');
        }

        const startIndex = raw.indexOf('<OFX');
        if (startIndex === -1) {
            throw new Error('Invalid OFX file: missing OFX root.');
        }

        const xmlContent = raw.slice(startIndex).trim();
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlContent, 'application/xml');
        const parserError = doc.querySelector('parsererror');
        if (parserError) {
            throw new Error('Unable to parse OFX document.');
        }

        const securities = this.extractOfxSecurities(doc);
        const transactions = this.extractOfxTransactions(doc, securities);

        return {
            securities,
            transactions
        };
    }

    extractOfxSecurities(doc) {
        const map = new Map();
        const secList = doc.getElementsByTagName('SECLIST')[0];
        if (!secList) {
            return map;
        }

        const getText = (root, tag) => {
            if (!root) {
                return '';
            }
            const node = root.getElementsByTagName(tag)[0];
            return node ? node.textContent.trim() : '';
        };

        Array.from(secList.children).forEach((node) => {
            if (!(node instanceof Element)) {
                return;
            }
            const tagName = node.tagName;
            const secInfo = node.getElementsByTagName('SECINFO')[0];
            if (!secInfo) {
                return;
            }

            const uniqueId = getText(secInfo, 'UNIQUEID');
            if (!uniqueId) {
                return;
            }

            const ticker = getText(secInfo, 'TICKER');
            const name = getText(secInfo, 'SECNAME');
            const info = {
                id: uniqueId,
                tag: tagName,
                ticker,
                name,
                option: null
            };

            if (tagName === 'OPTINFO') {
                const strikeRaw = getText(node, 'STRIKEPRICE');
                const multiplierRaw = getText(node, 'SHPERCTRCT');
                const expireRaw = getText(node, 'DTEXPIRE');
                const optTypeRaw = getText(node, 'OPTTYPE');

                const parsedSymbol = this.parseOptionContractSymbol(ticker || name);
                const expirationDate = this.parseOfxDate(expireRaw);

                info.option = {
                    underlying: parsedSymbol?.underlying || (ticker ? ticker.split(' ')[0].trim() : ''),
                    type: (optTypeRaw || parsedSymbol?.type || '').toUpperCase(),
                    strike: strikeRaw ? Number(strikeRaw) : parsedSymbol?.strike ?? null,
                    expiration: expirationDate ? expirationDate.toISOString().slice(0, 10) : parsedSymbol?.expiration || '',
                    multiplier: multiplierRaw ? Number(multiplierRaw) : parsedSymbol?.multiplier ?? 100
                };
            }

            map.set(uniqueId, info);
        });

        return map;
    }

    parseOptionContractSymbol(symbol = '') {
        const compact = (symbol || '').toString().replace(/\s+/g, '').toUpperCase();
        const match = compact.match(/^([A-Z]{1,6})(\d{6})([CP])(\d{8})/);
        if (!match) {
            return null;
        }

        const underlying = match[1];
        const dateDigits = match[2];
        const typeChar = match[3];
        const strikeDigits = match[4];

        const expirationDate = this.parseOfxDate(dateDigits);
        const strike = Number(parseInt(strikeDigits, 10) / 1000);

        return {
            underlying,
            expiration: expirationDate ? expirationDate.toISOString().slice(0, 10) : '',
            type: typeChar === 'P' ? 'PUT' : 'CALL',
            strike,
            multiplier: 100
        };
    }

    parseOfxDate(value) {
        if (!value) {
            return null;
        }

        const digits = value.toString().replace(/[^0-9]/g, '');
        if (!digits) {
            return null;
        }

        if (digits.length === 6) {
            const yearTwo = Number(digits.slice(0, 2));
            if (!Number.isFinite(yearTwo)) {
                return null;
            }
            const year = yearTwo >= 70 ? 1900 + yearTwo : 2000 + yearTwo;
            const month = Number(digits.slice(2, 4)) - 1;
            const day = Number(digits.slice(4, 6));
            const date = new Date(Date.UTC(year, month, day));
            return Number.isNaN(date.getTime()) ? null : date;
        }

        if (digits.length >= 8) {
            const year = Number(digits.slice(0, 4));
            const month = Number(digits.slice(4, 6)) - 1;
            const day = Number(digits.slice(6, 8));
            const hours = digits.length >= 10 ? Number(digits.slice(8, 10)) : 0;
            const minutes = digits.length >= 12 ? Number(digits.slice(10, 12)) : 0;
            const seconds = digits.length >= 14 ? Number(digits.slice(12, 14)) : 0;
            const date = new Date(Date.UTC(year, month, day, hours, minutes, seconds));
            return Number.isNaN(date.getTime()) ? null : date;
        }

        return null;
    }

    mapOfxOrderType(tag, rawType, units = 0) {
        const normalized = (rawType || '').toString().trim().toUpperCase();
        switch (tag) {
            case 'BUYOPT':
                return normalized === 'BUYTOCLOSE' ? 'BTC' : 'BTO';
            case 'SELLOPT':
                return normalized === 'SELLTOCLOSE' ? 'STC' : 'STO';
            case 'BUYSTOCK':
                return normalized === 'BUYTOCOVER' ? 'BTC' : 'BTO';
            case 'SELLSTOCK':
                if (normalized === 'SELLSHORT') {
                    return 'STO';
                }
                if (normalized === 'SELLTOCLOSE') {
                    return 'STC';
                }
                return units < 0 ? 'STO' : 'STC';
            default:
                return 'BTO';
        }
    }

    extractOfxTransactions(doc, securities) {
        const transactions = [];
        const invTranList = doc.getElementsByTagName('INVTRANLIST')[0];
        if (!invTranList) {
            return transactions;
        }

        const getText = (root, tag) => {
            if (!root) {
                return '';
            }
            const node = root.getElementsByTagName(tag)[0];
            return node ? node.textContent.trim() : '';
        };

        Array.from(invTranList.children).forEach((node) => {
            if (!(node instanceof Element)) {
                return;
            }

            const tag = node.tagName;
            if (!['BUYOPT', 'SELLOPT', 'BUYSTOCK', 'SELLSTOCK'].includes(tag)) {
                return;
            }

            const detailNode = tag === 'BUYOPT' || tag === 'BUYSTOCK'
                ? node.getElementsByTagName('INVBUY')[0]
                : node.getElementsByTagName('INVSELL')[0];
            if (!detailNode) {
                return;
            }

            const invTran = detailNode.getElementsByTagName('INVTRAN')[0];
            const externalIdRaw = getText(invTran, 'FITID') || getText(node, 'FITID');
            const sanitizedExternalId = this.sanitizeExternalLegId(externalIdRaw);
            if (!sanitizedExternalId) {
                return;
            }

            const dtTradeRaw = getText(invTran, 'DTTRADE') || getText(node, 'DTTRADE');
            const tradeDate = this.parseOfxDate(dtTradeRaw);
            const tradeDateIso = tradeDate ? tradeDate.toISOString().slice(0, 10) : '';
            const digitKey = (dtTradeRaw || '').replace(/[^0-9]/g, '');
            const timeKey = digitKey.length >= 14 ? digitKey.slice(0, 14) : digitKey.slice(0, 8) || tradeDateIso.replace(/-/g, '');

            const securityId = getText(detailNode, 'UNIQUEID');
            const security = securityId ? securities.get(securityId) : null;

            const units = Number(getText(detailNode, 'UNITS') || '0');
            const unitPrice = Number(getText(detailNode, 'UNITPRICE') || '0');
            const total = Number(getText(detailNode, 'TOTAL') || '0');
            const commissionRaw = Number(getText(detailNode, 'COMMISSION') || '0');

            const rawOrderType = tag === 'BUYOPT'
                ? getText(node, 'OPTBUYTYPE')
                : tag === 'SELLOPT'
                    ? getText(node, 'OPTSELLTYPE')
                    : tag === 'BUYSTOCK'
                        ? getText(node, 'BUYTYPE')
                        : getText(node, 'SELLTYPE');

            const orderType = this.mapOfxOrderType(tag, rawOrderType, units);
            const actionSide = this.mapOrderTypeToActionSide(orderType);

            const isOption = tag.includes('OPT');
            let underlying = '';
            let optionType = '';
            let strike = null;
            let expiration = '';
            let multiplier = isOption ? 100 : 1;
            let ticker = '';

            if (security && security.option) {
                underlying = (security.option.underlying || '').toUpperCase();
                optionType = security.option.type || '';
                strike = Number.isFinite(Number(security.option.strike)) ? Number(security.option.strike) : null;
                expiration = security.option.expiration || '';
                multiplier = security.option.multiplier || multiplier;
                ticker = underlying;
            } else if (security) {
                const inferredTicker = (security.ticker || security.name || '').split(' ')[0].trim();
                ticker = inferredTicker.toUpperCase();
                if (isOption) {
                    const parsed = this.parseOptionContractSymbol(security.ticker || security.name || '');
                    if (parsed) {
                        underlying = parsed.underlying.toUpperCase();
                        optionType = parsed.type;
                        strike = parsed.strike;
                        expiration = parsed.expiration;
                        multiplier = parsed.multiplier || multiplier;
                        ticker = underlying;
                    }
                } else {
                    underlying = ticker;
                }
            }

            if (!ticker) {
                ticker = (underlying || '').toUpperCase();
            }

            const underlyingSymbol = (underlying || ticker || '').toUpperCase();
            const categoryLabel = isOption ? 'OPTION' : 'STOCK';
            const baseKeyParts = [
                timeKey || tradeDateIso.replace(/-/g, ''),
                underlyingSymbol,
                actionSide.side,
                categoryLabel
            ];
            if (isOption) {
                baseKeyParts.push(expiration || '');
            }
            const groupKey = baseKeyParts.filter(Boolean).join('|') || sanitizedExternalId;

            transactions.push({
                externalId: sanitizedExternalId,
                groupKey,
                tag,
                orderType,
                tradeDate: tradeDateIso,
                tradeTimeKey: timeKey,
                ticker,
                underlying: (underlying || ticker || '').toUpperCase(),
                optionType: optionType || (isOption ? (rawOrderType && rawOrderType.includes('CALL') ? 'CALL' : 'PUT') : ''),
                strike,
                expiration,
                multiplier: multiplier || (isOption ? 100 : 1),
                quantity: Math.abs(units),
                price: Math.abs(unitPrice),
                total,
                fees: Math.abs(commissionRaw),
                category: isOption ? 'OPTION' : 'STOCK',
                securityId,
                memo: getText(invTran, 'MEMO') || '',
                currency: getText(detailNode, 'CURSYM') || getText(node, 'CURSYM') || 'USD'
            });
        });

        return transactions;
    }

    sanitizeExternalLegId(value) {
        if (!value) {
            return '';
        }
        return value.toString().replace(/[^A-Za-z0-9]/g, '');
    }

    groupTransactionsForImport(transactions = []) {
        const groups = new Map();
        transactions.forEach((tx) => {
            if (!tx || !tx.groupKey) {
                return;
            }
            let group = groups.get(tx.groupKey);
            if (!group) {
                group = {
                    key: tx.groupKey,
                    ticker: (tx.underlying || tx.ticker || '').toUpperCase(),
                    transactions: []
                };
                groups.set(tx.groupKey, group);
            }
            if (!group.ticker && (tx.underlying || tx.ticker)) {
                group.ticker = (tx.underlying || tx.ticker || '').toUpperCase();
            }
            group.transactions.push(tx);
        });
        return groups;
    }

    buildLegFromTransaction(transaction) {
        if (!transaction) {
            return null;
        }

        const quantity = Math.abs(Number(transaction.quantity) || 0);
        if (!quantity) {
            return null;
        }

        const type = transaction.optionType || (transaction.category === 'STOCK' ? 'STOCK' : 'UNKNOWN');

        return {
            id: transaction.externalId ? `EXT-${transaction.externalId}` : `LEG-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
            orderType: this.normalizeLegOrderType(transaction.orderType),
            type,
            quantity,
            multiplier: transaction.multiplier || (type === 'STOCK' ? 1 : 100),
            executionDate: transaction.tradeDate || '',
            expirationDate: transaction.expiration || '',
            strike: Number.isFinite(Number(transaction.strike)) ? Number(transaction.strike) : null,
            premium: Number.isFinite(Number(transaction.price)) ? Number(transaction.price) : 0,
            fees: Number.isFinite(Number(transaction.fees)) ? Number(transaction.fees) : 0,
            underlyingPrice: null,
            externalId: transaction.externalId || null,
            importGroupId: transaction.groupKey || null,
            importSource: 'OFX',
            tickerSymbol: (transaction.underlying || transaction.ticker || '').toUpperCase()
        };
    }

    sanitizeImportedLeg(leg) {
        if (!leg) {
            return null;
        }
        const clone = { ...leg };
        delete clone.tickerSymbol;
        return clone;
    }

    buildPositionKey(ticker, leg) {
        if (!leg) {
            return '';
        }
        const symbol = (ticker || '').toString().trim().toUpperCase();
        if (!symbol) {
            return '';
        }

        const type = (leg.type || '').toString().trim().toUpperCase();
        if (!type) {
            return '';
        }

    const direction = this.getLegAction(leg) === 'SELL' ? 'short' : 'long';

        if (type === 'STOCK') {
            return [symbol, type, direction].join('|');
        }

        const strike = Number.isFinite(Number(leg.strike)) ? Number(leg.strike) : 0;
        const expiration = (leg.expirationDate || '').toString().trim();

        return [symbol, type, strike || 0, expiration || '', direction].join('|');
    }

    buildPositionIndex(trades = []) {
        const index = new Map();

        trades.forEach((trade) => {
            if (!trade || !Array.isArray(trade.legs) || trade.legs.length === 0) {
                return;
            }

            const ticker = (trade.ticker || '').toUpperCase();
            if (!ticker) {
                return;
            }

            const aggregates = new Map();
            trade.legs.forEach((leg) => {
                if (!leg) {
                    return;
                }
                const key = this.buildPositionKey(ticker, leg);
                if (!key) {
                    return;
                }

                const quantity = Math.abs(Number(leg.quantity) || 0);
                if (!quantity) {
                    return;
                }

                const side = this.getLegSide(leg);
                let direction = 0;
                if (side === 'OPEN') {
                    direction = 1;
                } else if (side === 'CLOSE') {
                    direction = -1;
                }

                if (!direction) {
                    return;
                }

                const current = aggregates.get(key) || 0;
                aggregates.set(key, current + direction * quantity);
            });

            aggregates.forEach((net, key) => {
                if (net > 0) {
                    const bucket = index.get(key) || [];
                    bucket.push({ trade, remaining: net });
                    index.set(key, bucket);
                }
            });
        });

        return index;
    }

    consumePositionMatches(index, key, leg) {
        const result = { matched: [], unmatched: Math.abs(Number(leg?.quantity) || 0) };
        if (!key || !index.has(key) || !leg) {
            return result;
        }

        let remaining = result.unmatched;
        const entries = index.get(key) || [];

        entries.forEach((entry) => {
            if (remaining <= 0 || entry.remaining <= 0) {
                return;
            }
            const quantity = Math.min(entry.remaining, remaining);
            result.matched.push({ trade: entry.trade, quantity });
            entry.remaining -= quantity;
            remaining -= quantity;
        });

        result.unmatched = remaining;

        const filtered = entries.filter((entry) => entry.remaining > 0);
        if (filtered.length > 0) {
            index.set(key, filtered);
        } else {
            index.delete(key);
        }

        return result;
    }

    buildExistingExternalIdSet() {
        const ids = new Set();
        this.trades.forEach((trade) => {
            if (!trade || !Array.isArray(trade.legs)) {
                return;
            }
            trade.legs.forEach((leg) => {
                if (leg?.externalId) {
                    ids.add(leg.externalId);
                }
            });
        });
        return ids;
    }

    tradeContainsExternalId(trade, externalId) {
        if (!externalId || !trade || !Array.isArray(trade.legs)) {
            return false;
        }
        return trade.legs.some((leg) => leg?.externalId && leg.externalId === externalId);
    }

    inferStrategyFromLegs(legs = []) {
        if (!Array.isArray(legs) || legs.length === 0) {
            return 'Imported Trade';
        }

    const openLegs = legs.filter((leg) => this.getLegSide(leg) === 'OPEN');
        const relevant = openLegs.length ? openLegs : legs;

        if (relevant.length === 1) {
            const leg = relevant[0];
            if (!leg) {
                return 'Imported Trade';
            }
            if (leg.type === 'PUT') {
                return this.getLegAction(leg) === 'SELL' ? 'Cash-Secured Put' : 'Long Put';
            }
            if (leg.type === 'CALL') {
                return this.getLegAction(leg) === 'SELL' ? 'Short Call' : 'Long Call';
            }
            if (leg.type === 'STOCK') {
                return this.getLegAction(leg) === 'SELL' ? 'Stock Sale' : 'Stock Purchase';
            }
        }

        const optionLegs = relevant.filter((leg) => leg.type === 'PUT' || leg.type === 'CALL');
        if (optionLegs.length === 2) {
            const [first, second] = optionLegs;
            if (first && second && first.type === second.type) {
                const shortLeg = optionLegs.find((leg) => this.getLegAction(leg) === 'SELL');
                if (shortLeg) {
                    const longLeg = optionLegs.find((leg) => leg !== shortLeg);
                    if (longLeg) {
                        const shortStrike = Number(shortLeg.strike) || 0;
                        const longStrike = Number(longLeg.strike) || 0;
                        if (shortLeg.type === 'PUT') {
                            return shortStrike > longStrike ? 'Bull Put Spread' : 'Bear Put Spread';
                        }
                        return shortStrike < longStrike ? 'Bear Call Spread' : 'Bull Call Spread';
                    }
                }
            }
        }

        return 'Imported Multi-Leg';
    }

    composeImportNotes(context = {}, options = {}) {
    const fileName = context.fileName || 'OFX file';
    const timestamp = new Date();
    const dateLabel = timestamp.toLocaleDateString('en-US', { dateStyle: 'medium' });
    const timeLabel = timestamp.toLocaleTimeString('en-US', { timeStyle: 'short' });
    const parts = [`Imported from ${fileName} on ${dateLabel} at ${timeLabel}.`];

        if (options.legCount) {
            parts.push(`${options.legCount} leg${options.legCount === 1 ? '' : 's'} detected.`);
        }

        if (options.hasClosings) {
            parts.push('Includes adjustments to existing positions.');
        }

        if (options.note) {
            parts.push(options.note);
        }

        return parts.join(' ');
    }

    buildOfxImportPayload(parsed, context = {}) {
        const transactions = Array.isArray(parsed?.transactions) ? parsed.transactions : [];
        const batchId = context.batchId || null;
        const updates = new Map();
        const newTrades = [];
        const reviewTradeIds = [];

        const stats = {
            totalTransactions: transactions.length,
            totalGroups: 0,
            openingLegs: 0,
            closingLegs: 0,
            matchedClosingLegs: 0,
            unmatchedClosingLegs: 0,
            duplicateLegs: 0,
            legsAddedToUpdates: 0,
            legsAddedToNewTrades: 0,
            tradesCreated: 0,
            reviewTradesCreated: 0,
            totalTradesCreated: 0,
            tradesUpdated: 0,
            reviewLegs: 0
        };

        if (!transactions.length) {
            return { newTrades, updates, stats, batchId, reviewTradeIds };
        }

        const groups = this.groupTransactionsForImport(transactions);
        const positionIndex = this.buildPositionIndex(this.trades);
    const existingExternalIds = this.buildExistingExternalIdSet();
    const seenExternalIds = new Set();

        stats.totalGroups = groups.size;

        groups.forEach((group) => {
            if (!group || !Array.isArray(group.transactions) || group.transactions.length === 0) {
                return;
            }

            const legs = [];
            group.transactions.forEach((tx) => {
                const leg = this.buildLegFromTransaction(tx);
                if (!leg) {
                    return;
                }
                if (leg.externalId && (existingExternalIds.has(leg.externalId) || seenExternalIds.has(leg.externalId))) {
                    stats.duplicateLegs += 1;
                    return;
                }
                if (batchId) {
                    leg.importBatchId = batchId;
                }
                legs.push(leg);
            });

            if (!legs.length) {
                return;
            }

            const ticker = (group.ticker || legs[0]?.tickerSymbol || '').toUpperCase();
            const openingLegs = legs.filter((leg) => this.getLegSide(leg) === 'OPEN');
            const closingLegs = legs.filter((leg) => this.getLegSide(leg) === 'CLOSE');
            const unmatchedClosingLegs = [];

            stats.openingLegs += openingLegs.length;
            stats.closingLegs += closingLegs.length;

            closingLegs.forEach((leg) => {
                const key = this.buildPositionKey(ticker, leg);
                const match = this.consumePositionMatches(positionIndex, key, leg);

                if (match.matched.length) {
                    match.matched.forEach((entry) => {
                        const targetTrade = entry.trade;
                        if (this.tradeContainsExternalId(targetTrade, leg.externalId)) {
                            return;
                        }
                        if (leg.externalId && (existingExternalIds.has(leg.externalId) || seenExternalIds.has(leg.externalId))) {
                            return;
                        }

                        const bucket = updates.get(targetTrade.id) || [];
                        const legClone = { ...leg, quantity: entry.quantity };
                        if (batchId) {
                            legClone.importBatchId = batchId;
                        }
                        bucket.push(this.sanitizeImportedLeg(legClone));
                        updates.set(targetTrade.id, bucket);
                        stats.legsAddedToUpdates += 1;
                        stats.matchedClosingLegs += entry.quantity;
                    });
                }

                const unmatchedQty = Math.max(0, match.unmatched);
                if (!match.matched.length || unmatchedQty > 0) {
                    const remainder = { ...leg };
                    if (unmatchedQty > 0 && remainder.quantity !== unmatchedQty) {
                        remainder.quantity = unmatchedQty;
                    }
                    if (match.matched.length && remainder.externalId) {
                        remainder.externalId = `${remainder.externalId}-UNMATCHED`;
                    }
                    if (batchId) {
                        remainder.importBatchId = batchId;
                    }
                    unmatchedClosingLegs.push(remainder);
                    stats.unmatchedClosingLegs += remainder.quantity || 0;
                }

                if (leg.externalId) {
                    seenExternalIds.add(leg.externalId);
                }
            });

            if (openingLegs.length > 0) {
                const note = this.composeImportNotes(context, {
                    legCount: openingLegs.length,
                    hasClosings: closingLegs.length > 0
                });

                const sanitizedLegs = openingLegs.map((leg) => {
                    if (leg.externalId) {
                        seenExternalIds.add(leg.externalId);
                    }
                    return this.sanitizeImportedLeg(leg);
                });

                const resolvedTicker = (ticker || (openingLegs[0]?.tickerSymbol || '')).toUpperCase() || 'UNKNOWN';
                const tradeId = `IMP-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

                newTrades.push({
                    id: tradeId,
                    ticker: resolvedTicker,
                    strategy: this.inferStrategyFromLegs(openingLegs),
                    exitReason: '',
                    notes: note,
                    legs: sanitizedLegs,
                    importBatchId: batchId,
                    importReview: false
                });

                stats.tradesCreated += 1;
                stats.legsAddedToNewTrades += sanitizedLegs.length;
            }

            if (unmatchedClosingLegs.length > 0) {
                const note = this.composeImportNotes(context, {
                    legCount: unmatchedClosingLegs.length,
                    note: 'Review required: closing legs have no matching open position.'
                });

                const sanitizedLegs = unmatchedClosingLegs.map((leg) => {
                    if (leg.externalId) {
                        seenExternalIds.add(leg.externalId);
                    }
                    return this.sanitizeImportedLeg(leg);
                });

                const resolvedTicker = (ticker || (unmatchedClosingLegs[0]?.tickerSymbol || '')).toUpperCase() || 'UNKNOWN';
                const reviewId = `IMP-REVIEW-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

                newTrades.push({
                    id: reviewId,
                    ticker: resolvedTicker,
                    strategy: 'Import Review',
                    exitReason: '',
                    notes: note,
                    legs: sanitizedLegs,
                    importBatchId: batchId,
                    importReview: true
                });

                reviewTradeIds.push(reviewId);
                stats.reviewTradesCreated += 1;
                stats.legsAddedToNewTrades += sanitizedLegs.length;
            }
        });

        stats.totalTradesCreated = newTrades.length;
        stats.tradesUpdated = updates.size;
        stats.reviewLegs = newTrades
            .filter((trade) => trade.importReview)
            .reduce((acc, trade) => acc + ((trade.legs || []).length), 0);

        return { newTrades, updates, stats, batchId, reviewTradeIds };
    }

    applyOfxImportResult(importResult, context = {}) {
        if (!importResult) {
            return;
        }

        const stats = importResult.stats || {};
        const batchId = importResult.batchId || context.batchId || null;
        const reviewTradeIds = Array.isArray(importResult.reviewTradeIds)
            ? importResult.reviewTradeIds.slice()
            : [];

        let created = 0;
        let updated = 0;

        if (importResult.updates instanceof Map) {
            importResult.updates.forEach((legs, tradeId) => {
                if (!Array.isArray(legs) || legs.length === 0) {
                    return;
                }

                const index = this.trades.findIndex((trade) => trade.id === tradeId);
                if (index === -1) {
                    return;
                }

                const existing = this.trades[index];
                const mergedLegs = [...existing.legs, ...legs.map((leg) => ({ ...leg }))];
                const note = this.composeImportNotes(context, {
                    legCount: legs.length,
                    note: 'Existing trade updated from OFX import.'
                });

                const updatedTrade = this.enrichTradeData({
                    ...existing,
                    legs: mergedLegs,
                    notes: existing.notes ? `${existing.notes}\n${note}` : note
                });

                this.trades[index] = updatedTrade;
                updated += 1;
            });
        }

        if (Array.isArray(importResult.newTrades)) {
            importResult.newTrades.forEach((tradeData) => {
                if (!tradeData || !Array.isArray(tradeData.legs) || tradeData.legs.length === 0) {
                    return;
                }
                if (tradeData.importReview && !reviewTradeIds.includes(tradeData.id)) {
                    reviewTradeIds.push(tradeData.id);
                }
                const enriched = this.enrichTradeData(tradeData);
                this.trades.push(enriched);
                created += 1;
            });
        }

        const fileName = context?.fileName || 'OFX file';

        stats.totalTradesCreated = stats.totalTradesCreated ?? created;
        stats.tradesUpdated = updated;
        stats.reviewTradesCreated = stats.reviewTradesCreated ?? reviewTradeIds.length;

        if (created || updated) {
            this.saveToStorage();
            this.markUnsavedChanges();
            this.updateDashboard();

            const segments = [];
            if (created) {
                segments.push(`${created} new trade${created === 1 ? '' : 's'}`);
            }
            if (updated) {
                segments.push(`${updated} trade${updated === 1 ? '' : 's'} updated`);
            }

            const message = segments.length
                ? `OFX import completed: ${segments.join(', ')}.`
                : 'OFX import completed.';
            this.showNotification(message, 'success');
            this.appendImportLog({
                type: 'success',
                message: `${message} Source: ${fileName}.`,
                timestamp: new Date()
            });
        } else {
            this.showNotification('OFX import completed. No changes detected.', 'info');
            this.appendImportLog({
                type: 'info',
                message: `OFX import from ${fileName} completed with no changes.`,
                timestamp: new Date()
            });
        }

        this.updateImportSummary({
            fileName,
            batchId,
            stats,
            reviewTradeIds,
            timestamp: new Date()
        });
        this.renderImportSummary();
        this.refreshImportMergeList();
        this.initializeAIChat();
    }

    processLoadedData(data, metadata = {}) {
        if (!data || !Array.isArray(data.trades)) {
            throw new Error('Invalid data format');
        }

        this.trades = data.trades.map(trade => {
            const updatedTrade = { ...trade };
            if (updatedTrade.tradeReasoning && !updatedTrade.notes) {
                updatedTrade.notes = updatedTrade.tradeReasoning;
                delete updatedTrade.tradeReasoning;
            }
            return this.enrichTradeData(updatedTrade);
        });

        if (metadata.fileName) {
            this.currentFileName = metadata.fileName;
        } else if (!this.currentFileName) {
            this.currentFileName = 'Unsaved Database';
        }

        this.hasUnsavedChanges = false;
        this.updateUnsavedIndicator();
        this.saveToStorage({ fileName: this.currentFileName, source: metadata.source || 'import' });
        this.updateDashboard();
        if (this.currentView === 'trades-list') {
            this.updateTradesList();
        }
        this.updateFileNameDisplay();
        this.initializeAIChat();

        this.importSummary = null;
        this.importMergeSelection.clear();
        this.renderImportSummary();
        this.refreshImportMergeList();
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
        this.saveToStorage({ fileName: this.currentFileName });
        this.updateDashboard();
        this.showNotification('New database created', 'success');
        this.initializeAIChat();
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

    saveToStorage(metadata = {}) {
        try {
            const payload = {
                version: '2.5',
                timestamp: new Date().toISOString(),
                fileName: metadata.fileName || this.currentFileName || 'Unsaved Database',
                trades: this.getStorageTrades()
            };
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload));
            LEGACY_STORAGE_KEYS.forEach(key => {
                if (key && key !== LOCAL_STORAGE_KEY) {
                    localStorage.removeItem(key);
                }
            });
        } catch (e) {
            console.warn('Failed to save to localStorage:', e);
        }
    }

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

    formatNumber(value, options = {}) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
            return null;
        }

        const style = options.style || 'number';
        const fallbackDecimals = style === 'currency' ? 2 : 2;
        const decimals = Number.isInteger(options.decimals) ? Math.max(0, options.decimals) : fallbackDecimals;
        const currencyCode = options.currency || 'USD';
        const groupingDefault = style === 'currency';
        const useGrouping = typeof options.useGrouping === 'boolean' ? options.useGrouping : groupingDefault;

        const formatWithIntl = (num, fractionDigits = decimals) => new Intl.NumberFormat('en-US', {
            useGrouping,
            minimumFractionDigits: fractionDigits,
            maximumFractionDigits: fractionDigits
        }).format(num);

        if (style === 'currency') {
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: currencyCode,
                useGrouping,
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals
            }).format(numeric);
        }

        if (style === 'percent') {
            const percentDigits = Number.isInteger(options.decimals) ? Math.max(0, options.decimals) : decimals;
            return `${formatWithIntl(numeric, percentDigits)}%`;
        }

        return formatWithIntl(numeric, decimals);
    }

    formatPercent(value, fallback = '—', options = {}) {
        const numeric = Number(value);
        if (numeric === Number.POSITIVE_INFINITY) {
            return 'Infinite';
        }
        if (!Number.isFinite(numeric)) {
            return fallback;
        }

        const decimals = Number.isInteger(options.decimals)
            ? Math.max(0, options.decimals)
            : 2;
        const formatted = this.formatNumber(numeric, { decimals, useGrouping: true });
        return formatted ? `${formatted}%` : `${numeric.toFixed(decimals)}%`;
    }

    getStrategyDisplayName(strategy = '') {
        const raw = (strategy || '').toString().trim();
        if (!raw) {
            return '';
        }

        if (raw.toUpperCase() === 'PMCC') {
            return 'Poor Man\'s Covered Call';
        }

        return raw;
    }

    escapeHTML(value) {
        if (value === null || value === undefined) {
            return '';
        }

        return value.toString()
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    formatCurrency(amount, options = {}) {
        const value = Number(amount);
        if (!Number.isFinite(value)) {
            return '—';
        }

        const currency = options.currency || 'USD';
        const decimals = Number.isInteger(options.decimals)
            ? Math.max(0, options.decimals)
            : 2;
        const useGrouping = options.useGrouping !== undefined
            ? Boolean(options.useGrouping)
            : true;

        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency,
            useGrouping,
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
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

class LocalInsightsAgent {
    constructor(app) {
        this.app = app;
        this.context = {
            stats: null,
            openTrades: [],
            closedTrades: []
        };
    }

    updateContext({ stats, openTrades, closedTrades } = {}) {
        if (stats) {
            this.context.stats = stats;
        }
        if (Array.isArray(openTrades)) {
            this.context.openTrades = openTrades;
        }
        if (Array.isArray(closedTrades)) {
            this.context.closedTrades = closedTrades;
        }
    }

    hasTradeHistory() {
        return (this.context.openTrades?.length || 0) > 0 || (this.context.closedTrades?.length || 0) > 0;
    }

    getGreeting() {
        if (!this.hasTradeHistory()) {
            return 'Hi! I\'m your local AI coach. Add or import a few trades and I\'ll help you analyze risk and performance.';
        }

        const stats = this.context.stats;
        if (!stats) {
            return 'Hi! I\'m your local AI coach. Ask about performance, risk, or next steps.';
        }

        const openCount = this.context.openTrades?.length || 0;
        const closedCount = this.context.closedTrades?.length || 0;
        return `Hi! I\'m your local AI coach. You have ${openCount} active ${openCount === 1 ? 'position' : 'positions'} and ${closedCount} closed trades with realised P&L of ${this.formatCurrency(stats.totalPL)}.`;
    }

    generateResponse(query = '') {
        const prompt = query.trim();
        if (!prompt) {
            return 'I can run a portfolio health check, review risk exposure, or suggest strategy adjustments. Try asking for a quick portfolio health check.';
        }

        if (!this.hasTradeHistory()) {
            return 'Log a few trades first and I\'ll start surfacing insights about risk, performance, and strategy.';
        }

        const parts = [];
        const performance = this.buildPerformanceSummary();
        if (performance) {
            parts.push(performance);
        }

        const risk = this.buildRiskHeadline();
        if (risk) {
            parts.push(risk);
        }

        const strategy = this.buildStrategyHeadline();
        if (strategy) {
            parts.push(strategy);
        }

        const coaching = this.buildCoachingHighlight();
        if (coaching) {
            parts.push(coaching);
        }

        if (!parts.length) {
            parts.push('Portfolio data is limited, but keep logging trades and I\'ll highlight trends as they emerge.');
        }

        return parts.join('\n\n');
    }

    buildPerformanceSummary() {
        const stats = this.context.stats;
        if (!stats) {
            return '';
        }

        const closed = this.context.closedTrades?.length || 0;
        if (!closed) {
            return 'No closed trades yet. Once you realize some P&L I\'ll summarize your performance here.';
        }

        const winRate = this.formatPercent(stats.winRate, '—', { decimals: 1 });
        const profitFactor = stats.profitFactor === Number.POSITIVE_INFINITY
            ? 'Infinite'
            : Number.isFinite(stats.profitFactor)
                ? stats.profitFactor.toFixed(2)
                : '—';
        const totalROI = this.formatPercent(stats.totalROI, '—');
        return `Closed trades: ${closed}, realised P&L ${this.formatCurrency(stats.totalPL)}, win rate ${winRate}, profit factor ${profitFactor}, total ROI ${totalROI}.`;
    }

    buildRiskHeadline() {
        const openTrades = this.context.openTrades || [];
        if (!openTrades.length) {
            return 'No open positions right now, so live risk exposure is minimal.';
        }

        let totalRisk = 0;
        let largestRisk = 0;
        let largestTrade = null;

        openTrades.forEach(trade => {
            const risk = Math.max(0, Number(this.app.getCapitalAtRisk(trade)) || 0);
            totalRisk += risk;
            if (risk > largestRisk) {
                largestRisk = risk;
                largestTrade = trade;
            }
        });

        if (!totalRisk) {
            return 'Open positions detected, but max risk looks minimal based on current data.';
        }

        if (largestTrade && totalRisk) {
            const share = ((largestRisk / totalRisk) * 100).toFixed(0);
            const ticker = (largestTrade.ticker || 'Unknown').toUpperCase();
            return `Open risk across ${openTrades.length} ${openTrades.length === 1 ? 'position' : 'positions'} is ${this.formatCurrency(totalRisk)}. ${ticker} carries the largest share at ${share}% of exposure.`;
        }

        return `Open risk across ${openTrades.length} ${openTrades.length === 1 ? 'position' : 'positions'} is ${this.formatCurrency(totalRisk)}.`;
    }

    buildStrategyHeadline() {
        const breakdown = this.getStrategyBreakdown();
        if (!breakdown.length) {
            return '';
        }

        const best = breakdown[0];
        if (!best) {
            return '';
        }

        const winRate = best.trades > 0 ? ((best.wins / best.trades) * 100).toFixed(0) : '0';
        return `${best.name} leads with ${this.formatCurrency(best.pl)} across ${best.trades} trades (win rate ${winRate}%).`;
    }

    buildCoachingHighlight() {
        const stats = this.context.stats;
        if (!stats) {
            return '';
        }

        const lossTrades = (this.context.closedTrades || []).filter(trade => trade.pl < 0);
        const winTrades = (this.context.closedTrades || []).filter(trade => trade.pl > 0);

        const avgSeen = (list, selector) => {
            if (!list.length) {
                return NaN;
            }
            const sum = list.reduce((acc, item) => acc + selector(item), 0);
            return sum / list.length;
        };

        const avgLossDays = avgSeen(lossTrades, trade => Number(trade.daysHeld) || 0);
        const avgWinDays = avgSeen(winTrades, trade => Number(trade.daysHeld) || 0);

        if (Number.isFinite(avgLossDays) && Number.isFinite(avgWinDays)) {
            const diff = avgLossDays - avgWinDays;
            if (diff >= 2) {
                return `Losing trades stay open about ${Math.round(diff)} days longer than winners—tighten exits to cut risk sooner.`;
            }
            if (diff <= -2) {
                return `You let winners run roughly ${Math.round(Math.abs(diff))} days longer than losers—keep scaling out to lock in gains.`;
            }
        }

        if (Number.isFinite(stats.winRate) && stats.winRate < 45 && (this.context.closedTrades?.length || 0) >= 5) {
            return 'Win rate is under 45%. Focus on highest-conviction setups or scale size down until consistency improves.';
        }

        return '';
    }

    getStrategyBreakdown() {
        const map = new Map();
        (this.context.closedTrades || []).forEach(trade => {
            const key = (trade.strategy || 'Unclassified').toString().trim() || 'Unclassified';
            if (!map.has(key)) {
                map.set(key, { name: key, pl: 0, trades: 0, wins: 0, losses: 0 });
            }
            const entry = map.get(key);
            const plValue = Number(trade.pl) || 0;
            entry.pl += plValue;
            entry.trades += 1;
            if (plValue > 0) {
                entry.wins += 1;
            } else if (plValue < 0) {
                entry.losses += 1;
            }
        });

        return Array.from(map.values()).sort((a, b) => b.pl - a.pl);
    }

    formatCurrency(value, options) {
        return this.app.formatCurrency(value, options);
    }

    formatPercent(value, fallback = '—', options = {}) {
        if (this.app && typeof this.app.formatPercent === 'function') {
            return this.app.formatPercent(value, fallback, options);
        }

        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
            return fallback;
        }

        const specifiedDecimals = options && Number.isInteger(options.decimals)
            ? Math.max(0, options.decimals)
            : 2;
        return `${numeric.toFixed(specifiedDecimals)}%`;
    }
}

class GeminiInsightsAgent {
    constructor(app) {
        this.app = app;
        this.context = {
            stats: null,
            openTrades: [],
            closedTrades: []
        };
        this.fallback = new LocalInsightsAgent(app);
    }

    updateContext({ stats, openTrades, closedTrades } = {}) {
        if (stats) {
            this.context.stats = stats;
        }
        if (Array.isArray(openTrades)) {
            this.context.openTrades = openTrades;
        }
        if (Array.isArray(closedTrades)) {
            this.context.closedTrades = closedTrades;
        }
        this.fallback.updateContext({ stats: this.context.stats, openTrades: this.context.openTrades, closedTrades: this.context.closedTrades });
    }

    getGreeting() {
        if (!this.isConfigured()) {
            return 'Connect your Gemini API key in [Settings](#settings) to get tailored analysis.';
        }
        return this.fallback.getGreeting();
    }

    isConfigured() {
        const config = this.app?.gemini;
        return Boolean(config && config.apiKey);
    }

    async generateResponse(query = '', options = {}) {
        const prompt = query.trim();
        if (!prompt) {
            return 'Ask a question and I\'ll send it to Gemini along with a snapshot of your portfolio.';
        }

        if (!this.isConfigured()) {
            return 'Add a Gemini-compatible API key under [Settings](#settings) to enable AI-powered insights.';
        }

        try {
            const request = this.buildRequestPayload(prompt, options);
            const content = await this.callGemini(request);
            if (content) {
                return content;
            }
            throw new Error('Gemini returned an empty response');
        } catch (error) {
            const fallback = this.fallback.generateResponse(query);
            const message = error?.message || 'Unknown error';
            if (fallback) {
                return `Gemini request failed (${message}). Here\'s a local snapshot instead:\n\n${fallback}`;
            }
            return `Gemini request failed (${message}). Try again in a moment.`;
        }
    }

    buildRequestPayload(question, options = {}) {
        const config = this.app?.gemini || {};
        const model = GEMINI_ALLOWED_MODELS.includes(config.model)
            ? config.model
            : DEFAULT_GEMINI_MODEL;
        const temperature = DEFAULT_GEMINI_TEMPERATURE;
        const contextBlock = this.buildContextBlock();
        const historyContents = this.buildHistoryContents(options.history || []);

        const userContent = [
            '# ROLE & PHILOSOPHY',
            'You are an expert options trading coach. Your philosophy is rooted in rigorous risk management, capital preservation, and generating consistent returns. You are assisting an intermediate trader who wants to refine their strategy and tighten their risk controls. Your goal is to provide a concise, data-driven portfolio health check that identifies key risks and offers actionable, educational insights.',
            '# CONTEXT: PORTFOLIO DATA',
            contextBlock,
            '# TRADER\'S OBJECTIVE',
            question,
            '# ANALYSIS FRAMEWORK & INSTRUCTIONS',
            '1.  **Acknowledge Strengths:** Briefly highlight the **strong overall performance** (e.g., win rate, profit factor, successful strategies).\n2.  **Prioritize Top Risks:** Scrutinize the data to identify and explain the **top 2-3 risks**. In addition to the systemic risks below, **identify open positions near expiration (low DTE) or those with previous rolls/adjustments (in the \"notes\") as potential immediate risks.** Focus specifically on:\n    * **Concentration Risk:** Explicitly cite and explain the **`riskHeadline`**.\n    * **Behavioral Risk:** Connect the **`coachingHighlight`** to the risk.\n3.  **Provide Actionable Recommendations:** Based on the identified risks, provide **clear, bulleted recommendations**. Link them directly to the data.\n    * Suggest a specific rule for **position sizing**.\n    * Propose a concrete action to address the **behavioral risk**.\n4.  **Suggest Next Steps:** Conclude with **2-3 forward-looking actions** for process improvement.',
            '# OUTPUT FORMATTING',
            '- **Tone:** Professional, direct, and risk-aware coach.\n- **Length:** Keep the response under 400 words.\n- **Structure:** Use bullet points for recommendations and next steps.\n- **Disclaimer:** End with a clear statement that this is educational analysis, not financial advice.'
        ].join('\n\n');

        const contents = [
            ...historyContents,
            {
                role: 'user',
                parts: [{ text: userContent }]
            }
        ];

        const generationConfig = {
            maxOutputTokens: 65536
        };

        generationConfig.temperature = Number(temperature.toFixed(2));

        return {
            model,
            body: {
                contents,
                generationConfig
            }
        };
    }

    buildHistoryContents(history) {
        if (!Array.isArray(history) || history.length === 0) {
            return [];
        }

        return history
            .filter(entry => entry && !entry.pending && typeof entry.text === 'string' && entry.text.trim().length)
            .slice(-8)
            .map(entry => ({
                role: entry.sender === 'ai' ? 'model' : 'user',
                parts: [{ text: entry.text.trim() }]
            }));
    }

    buildContextBlock() {
        const stats = this.context.stats || {};
        const totals = {
            totalPL: this.formatNumber(stats.totalPL, { style: 'currency' }),
            winRate: this.formatNumber(stats.winRate, { style: 'percent' }),
            profitFactor: Number.isFinite(stats.profitFactor)
                ? this.formatNumber(stats.profitFactor)
                : (stats.profitFactor === Number.POSITIVE_INFINITY ? 'Infinite' : null),
            totalROI: this.formatNumber(stats.totalROI, { style: 'percent' }),
            annualizedROI: this.formatNumber(stats.annualizedROI, { style: 'percent' }),
            maxDrawdown: this.formatNumber(stats.maxDrawdown, { style: 'percent' }),
            closedTrades: stats.closedTrades ?? (this.context.closedTrades?.length || 0),
            openPositions: stats.activePositions ?? (this.context.openTrades?.length || 0)
        };

        const contextData = {
            totals,
            riskHeadline: this.fallback.buildRiskHeadline(),
            strategyHighlight: this.fallback.buildStrategyHeadline(),
            coachingHighlight: this.fallback.buildCoachingHighlight(),
            performanceHighlight: this.fallback.buildPerformanceSummary?.() || '',
            openPositions: this.buildOpenPositionsSummary(),
            recentClosedTrades: this.buildRecentClosedTradesSummary(),
            topStrategies: this.buildStrategySummary()
        };

        return JSON.stringify(contextData, null, 2);
    }

    buildOpenPositionsSummary(limit = 8) {
        const trades = Array.isArray(this.context.openTrades) ? this.context.openTrades : [];
        return trades.slice(0, limit).map(trade => {
            const snapshot = this.snapshotObjectForPrompt(trade);
            const derived = {};

            const dteValue = Number.isFinite(trade?.dte) ? Number(trade.dte) : this.deriveDTE(trade);
            if (Number.isFinite(dteValue)) {
                derived.calculatedDTE = Math.max(Math.round(dteValue), 0);
            }

            const riskValue = Number(this.app.getCapitalAtRisk(trade));
            if (Number.isFinite(riskValue)) {
                derived.calculatedMaxRisk = Number(riskValue.toFixed(2));
            }

            const notePreview = this.cleanNote(trade?.notes);
            if (notePreview) {
                derived.notePreview = notePreview;
            }

            if (Object.keys(derived).length) {
                snapshot.__promptDerived = derived;
            }

            return snapshot;
        });
    }

    deriveDTE(trade) {
        if (!trade?.expirationDate) {
            return null;
        }
        try {
            return this.app.calculateDTE(trade.expirationDate, trade);
        } catch (_error) {
            return null;
        }
    }

    buildRecentClosedTradesSummary(limit = 8) {
        const trades = Array.isArray(this.context.closedTrades) ? [...this.context.closedTrades] : [];
        return trades
            .sort((a, b) => new Date(b.exitDate || 0) - new Date(a.exitDate || 0))
            .slice(0, limit)
            .map(trade => {
                const snapshot = this.snapshotObjectForPrompt(trade);
                const derived = {
                    plRounded: this.formatNumber(trade?.pl, { style: 'currency' }),
                    roiRounded: this.formatNumber(trade?.roi, { style: 'percent' })
                };

                const exitReasonPreview = this.cleanNote(trade?.exitReason);
                if (exitReasonPreview) {
                    derived.exitReasonPreview = exitReasonPreview;
                }

                if (Number.isFinite(trade?.daysHeld)) {
                    derived.daysHeld = Number(trade.daysHeld);
                }

                snapshot.__promptDerived = Object.fromEntries(
                    Object.entries(derived).filter(([, value]) => value !== null && value !== undefined)
                );

                if (!Object.keys(snapshot.__promptDerived).length) {
                    delete snapshot.__promptDerived;
                }

                return snapshot;
            });
    }

    buildStrategySummary(limit = 5) {
        const breakdown = this.fallback.getStrategyBreakdown();
        return breakdown.slice(0, limit).map(entry => ({
            name: entry.name,
            trades: entry.trades,
            wins: entry.wins,
            losses: entry.losses,
            realisedPL: this.formatNumber(entry.pl, { style: 'currency' }),
            winRate: entry.trades > 0 ? this.formatNumber((entry.wins / entry.trades) * 100, { style: 'percent' }) : null
        }));
    }

    snapshotObjectForPrompt(source) {
        const snapshot = this.snapshotForPrompt(source);
        if (snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)) {
            return snapshot;
        }
        return {};
    }

    snapshotForPrompt(value) {
        if (value === null || value === undefined) {
            return null;
        }

        if (typeof value === 'number') {
            return Number.isFinite(value) ? Number(value) : null;
        }

        if (typeof value === 'string' || typeof value === 'boolean') {
            return value;
        }

        if (value instanceof Date) {
            return value.toISOString();
        }

        if (Array.isArray(value)) {
            return value.map(item => this.snapshotForPrompt(item));
        }

        if (typeof value === 'object') {
            const result = {};
            for (const [key, val] of Object.entries(value)) {
                if (typeof val === 'function') {
                    continue;
                }
                result[key] = this.snapshotForPrompt(val);
            }
            return result;
        }

        return null;
    }

    cleanNote(value) {
        if (!value) {
            return '';
        }
        const text = value.toString().trim();
        if (text.length <= 180) {
            return text;
        }
        return `${text.slice(0, 177)}…`;
    }

    formatNumber(value, options = {}) {
        const fallback = Object.prototype.hasOwnProperty.call(options || {}, 'fallback')
            ? options.fallback
            : null;

        if (!this.app || typeof this.app.formatNumber !== 'function') {
            return fallback;
        }

        const normalizedOptions = { ...(options || {}) };
        delete normalizedOptions.fallback;

        if (normalizedOptions.style === 'string') {
            normalizedOptions.style = 'number';
        }

        if (normalizedOptions.style === 'percent') {
            const percentOptions = {};
            if (Number.isInteger(normalizedOptions.decimals)) {
                percentOptions.decimals = normalizedOptions.decimals;
            }
            return this.app.formatPercent(value, fallback, percentOptions);
        }

        const formatted = this.app.formatNumber(value, normalizedOptions);
        return formatted ?? fallback;
    }

    formatPercent(value, fallback, options) {
        if (!this.app || typeof this.app.formatPercent !== 'function') {
            return fallback ?? null;
        }
        return this.app.formatPercent(value, fallback, options);
    }

    async callGemini({ model, body }) {
        const apiKey = this.app?.gemini?.apiKey;

        if (!apiKey) {
            throw new Error('Missing Gemini API key');
        }

        const base = DEFAULT_GEMINI_ENDPOINT.replace(/\/+$/, '');
        const normalizedModel = (model || DEFAULT_GEMINI_MODEL).replace(/^models\//i, '');
        const modelSegment = encodeURIComponent(normalizedModel);
        const urlBase = `${base}/${modelSegment}:generateContent`;
        const url = `${urlBase}?key=${encodeURIComponent(apiKey)}`;

        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timeoutId = controller ? setTimeout(() => controller.abort(), 20000) : null;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': apiKey
                },
                body: JSON.stringify(body),
                signal: controller?.signal
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                const errorMessage = data?.error?.message || data?.message || `HTTP ${response.status}`;
                throw new Error(errorMessage);
            }

            if (data?.promptFeedback?.blockReason) {
                throw new Error(`Request blocked (${data.promptFeedback.blockReason})`);
            }

            const parts = data?.candidates?.[0]?.content?.parts;
            if (!Array.isArray(parts) || !parts.length) {
                return '';
            }

            const text = parts
                .map(part => (part && typeof part.text === 'string') ? part.text : '')
                .join('')
                .trim();

            return text;
        } finally {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        }
    }
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', function () {
    window.tracker = new GammaLedger();
});