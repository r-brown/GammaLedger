// Options Trading Tracker Application
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

const LOCAL_STORAGE_KEY = 'GammaLedgerCache';
const LEGACY_STORAGE_KEY = 'GammaLedgerTrades';
const GEMINI_STORAGE_KEY = 'GammaLedgerGeminiConfig';
const GEMINI_SECRET_STORAGE_KEY = 'GammaLedgerGeminiSecret';
const DEFAULT_GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash-lite';
const DEFAULT_GEMINI_TEMPERATURE = 0.70;
const GEMINI_ALLOWED_MODELS = ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-pro'];

const BUILTIN_SAMPLE_DATA = {
    trades: [
        {
            ticker: 'AAPL',
            strategy: 'Long Call',
            tradeType: 'BTO',
            quantity: 1,
            entryDate: '2025-02-20',
            expirationDate: '2025-04-19',
            exitDate: '2025-03-12',
            status: 'Closed',
            stockPriceAtEntry: 175.6,
            strikePrice: 175,
            entryPrice: 1.45,
            exitPrice: 2.89,
            fees: 1,
            ivRank: 32,
            delta: 28.5,
            gamma: null,
            theta: -0.04,
            vega: 0.15,
            marketCondition: 'Bullish',
            convictionLevel: 7,
            notes: 'Breakout continuation',
            exitReason: 'Profit target reached',
            id: 1001,
            tradeDirection: 'long',
            daysHeld: 21,
            dte: 38,
            pl: 144,
            roi: 98.63,
            annualizedROI: 512.4,
            maxRisk: 146,
            cycleId: '',
            cycleType: '',
            cycleRole: '',
            definedRiskWidth: null,
            maxRiskOverride: null
        },
        {
            ticker: 'MSFT',
            strategy: 'Covered Call',
            tradeType: 'STO',
            quantity: -1,
            entryDate: '2025-03-24',
            expirationDate: '2025-05-16',
            exitDate: '2025-04-18',
            status: 'Closed',
            stockPriceAtEntry: 318.2,
            strikePrice: 325,
            entryPrice: 1.95,
            exitPrice: 0.45,
            fees: 1.5,
            ivRank: 27,
            delta: -14,
            gamma: null,
            theta: 0.02,
            vega: null,
            marketCondition: 'Neutral',
            convictionLevel: 5,
            notes: 'Rolled after earnings',
            exitReason: 'Profit target reached',
            id: 1002,
            tradeDirection: 'short',
            daysHeld: 25,
            dte: 28,
            pl: 148.5,
            roi: 39.23,
            annualizedROI: 286.7,
            maxRisk: 81.6,
            cycleId: '',
            cycleType: '',
            cycleRole: '',
            definedRiskWidth: null,
            maxRiskOverride: null
        },
        {
            ticker: 'SPY',
            strategy: 'Bull Put Spread',
            tradeType: 'BTO',
            quantity: 1,
            entryDate: '2025-04-22',
            expirationDate: '2025-05-31',
            exitDate: '2025-05-18',
            status: 'Closed',
            stockPriceAtEntry: 507.4,
            strikePrice: 500,
            entryPrice: 1.95,
            exitPrice: 0.5,
            fees: 1.1,
            ivRank: 25,
            delta: 16.2,
            gamma: null,
            theta: 0.06,
            vega: 0.12,
            marketCondition: 'Bullish',
            convictionLevel: 6,
            notes: 'Bounce off 50-day moving average',
            exitReason: 'Hit 70% max profit',
            id: 1011,
            tradeDirection: 'long',
            daysHeld: 26,
            dte: 13,
            pl: 144,
            roi: 73.85,
            annualizedROI: 411.2,
            maxRisk: 195,
            cycleId: 'SPY-2025-05',
            cycleType: 'defined-risk',
            cycleRole: 'primary',
            definedRiskWidth: 5,
            maxRiskOverride: null
        },
        {
            ticker: 'META',
            strategy: 'Iron Condor',
            tradeType: 'BTO',
            quantity: 1,
            entryDate: '2025-05-28',
            expirationDate: '2025-06-28',
            exitDate: '2025-06-21',
            status: 'Closed',
            stockPriceAtEntry: 301.7,
            strikePrice: 300,
            entryPrice: 2.35,
            exitPrice: 0.85,
            fees: 1.3,
            ivRank: 41,
            delta: 2.8,
            gamma: null,
            theta: 0.11,
            vega: -0.05,
            marketCondition: 'Neutral',
            convictionLevel: 5,
            notes: 'Captured IV crush into FOMC week',
            exitReason: '50% max profit',
            id: 1006,
            tradeDirection: 'long',
            daysHeld: 24,
            dte: 7,
            pl: 148.7,
            roi: 42.48,
            annualizedROI: 532.1,
            maxRisk: 350,
            cycleId: 'META-2025-06',
            cycleType: 'iron-condor',
            cycleRole: 'primary',
            definedRiskWidth: 10,
            maxRiskOverride: null
        },
        {
            ticker: 'DIS',
            strategy: 'Cash-Secured Put',
            tradeType: 'STO',
            quantity: -1,
            entryDate: '2025-06-24',
            expirationDate: '2025-07-19',
            exitDate: '2025-07-18',
            status: 'Closed',
            stockPriceAtEntry: 101.6,
            strikePrice: 100,
            entryPrice: 2.3,
            exitPrice: 0.35,
            fees: 0.85,
            ivRank: 38,
            delta: -24.1,
            gamma: null,
            theta: 0.08,
            vega: null,
            marketCondition: 'Neutral',
            convictionLevel: 6,
            notes: 'Earnings gap fill support held',
            exitReason: 'Premium decay captured',
            id: 1012,
            tradeDirection: 'short',
            daysHeld: 24,
            dte: 1,
            pl: 194.15,
            roi: 1.99,
            annualizedROI: 30.3,
            maxRisk: 9770,
            cycleId: 'DIS-2025-07',
            cycleType: 'wheel',
            cycleRole: 'wheel-put',
            definedRiskWidth: null,
            maxRiskOverride: null
        },
        {
            ticker: 'SMH',
            strategy: 'Bear Call Spread',
            tradeType: 'STO',
            quantity: -1,
            entryDate: '2025-07-22',
            expirationDate: '2025-08-23',
            exitDate: '2025-08-16',
            status: 'Closed',
            stockPriceAtEntry: 250.1,
            strikePrice: 255,
            entryPrice: 2.1,
            exitPrice: 0.6,
            fees: 1.1,
            ivRank: 47,
            delta: -18.7,
            gamma: null,
            theta: 0.05,
            vega: -0.14,
            marketCondition: 'Bearish',
            convictionLevel: 5,
            notes: 'Rejected weekly resistance',
            exitReason: '90% max profit captured',
            id: 1013,
            tradeDirection: 'short',
            daysHeld: 25,
            dte: 7,
            pl: 148.9,
            roi: 70.9,
            annualizedROI: 413.4,
            maxRisk: 210,
            cycleId: 'SMH-2025-08',
            cycleType: 'defined-risk',
            cycleRole: 'hedge',
            definedRiskWidth: 5,
            maxRiskOverride: null
        },
        {
            ticker: 'AVGO',
            strategy: 'Covered Call',
            tradeType: 'STO',
            quantity: -1,
            entryDate: '2025-08-26',
            expirationDate: '2025-09-20',
            exitDate: '2025-09-19',
            status: 'Closed',
            stockPriceAtEntry: 950.7,
            strikePrice: 980,
            entryPrice: 6.8,
            exitPrice: 1.1,
            fees: 1.75,
            ivRank: 29,
            delta: -22.4,
            gamma: null,
            theta: 0.04,
            vega: -0.12,
            marketCondition: 'Neutral',
            convictionLevel: 6,
            notes: 'Monthly income against core holding',
            exitReason: 'Roll candidate after profit',
            id: 1014,
            tradeDirection: 'short',
            daysHeld: 24,
            dte: 1,
            pl: 489.25,
            roi: 35.75,
            annualizedROI: 544.1,
            maxRisk: 0,
            cycleId: 'AVGO-2025-09',
            cycleType: 'covered',
            cycleRole: 'income',
            definedRiskWidth: null,
            maxRiskOverride: 95000
        },
        {
            ticker: 'TSLA',
            strategy: 'Cash-Secured Put',
            tradeType: 'STO',
            quantity: -1,
            entryDate: '2025-09-15',
            expirationDate: '2025-10-17',
            exitDate: null,
            status: 'Open',
            stockPriceAtEntry: 260.5,
            strikePrice: 250,
            entryPrice: 3.4,
            exitPrice: null,
            fees: 0.75,
            ivRank: 60,
            delta: -28.1,
            gamma: null,
            theta: 0.05,
            vega: null,
            marketCondition: 'Neutral',
            convictionLevel: 6,
            notes: 'Prefer assignment for long-term hold',
            exitReason: null,
            id: 1003,
            tradeDirection: 'short',
            daysHeld: 10,
            dte: 32,
            pl: 0,
            roi: 0,
            annualizedROI: 0,
            maxRisk: 2466,
            cycleId: 'TSLA-2025-10',
            cycleType: 'wheel',
            cycleRole: 'wheel-put',
            definedRiskWidth: null,
            maxRiskOverride: null
        },
        {
            ticker: 'AMZN',
            strategy: 'Short Put Spread',
            tradeType: 'BTO',
            quantity: 1,
            entryDate: '2025-09-05',
            expirationDate: '2025-10-11',
            exitDate: null,
            status: 'Open',
            stockPriceAtEntry: 138.2,
            strikePrice: 134,
            entryPrice: 1.1,
            exitPrice: null,
            fees: 1.05,
            ivRank: 48,
            delta: 18.7,
            gamma: null,
            theta: 0.04,
            vega: 0.15,
            marketCondition: 'Bullish',
            convictionLevel: 6,
            notes: 'High IV setup',
            exitReason: null,
            id: 1004,
            tradeDirection: 'long',
            daysHeld: 5,
            dte: 15,
            pl: 0,
            roi: 0,
            annualizedROI: 0,
            maxRisk: 390,
            cycleId: 'AMZN-2025-10',
            cycleType: 'defined-risk',
            cycleRole: 'base',
            definedRiskWidth: 5,
            maxRiskOverride: null
        },
        {
            ticker: 'NVDA',
            strategy: "Poor Man's Covered Call",
            tradeType: 'BTO',
            quantity: 1,
            entryDate: '2025-06-20',
            expirationDate: '2026-01-17',
            exitDate: null,
            status: 'Open',
            stockPriceAtEntry: 440,
            strikePrice: 400,
            entryPrice: 38.6,
            exitPrice: null,
            fees: 1.25,
            ivRank: 52,
            delta: 62,
            gamma: null,
            theta: -0.08,
            vega: 0.4,
            marketCondition: 'Bullish',
            convictionLevel: 8,
            notes: 'Synthetic stock core position',
            exitReason: null,
            id: 1005,
            tradeDirection: 'long',
            daysHeld: 110,
            dte: 99,
            pl: 0,
            roi: 0,
            annualizedROI: 0,
            maxRisk: 3860,
            cycleId: 'NVDA-2026-01',
            cycleType: 'pmcc',
            cycleRole: 'base',
            definedRiskWidth: null,
            maxRiskOverride: null
        },
        {
            ticker: 'GOOG',
            strategy: 'Diagonal Call Spread',
            tradeType: 'BTO',
            quantity: 1,
            entryDate: '2025-07-30',
            expirationDate: '2025-11-15',
            exitDate: null,
            status: 'Open',
            stockPriceAtEntry: 132.5,
            strikePrice: 133,
            entryPrice: 4.6,
            exitPrice: null,
            fees: 1.1,
            ivRank: 30,
            delta: 35.4,
            gamma: null,
            theta: 0.07,
            vega: 0.21,
            marketCondition: 'Neutral',
            convictionLevel: 6,
            notes: 'Diagonal with short weekly calls',
            exitReason: null,
            id: 1007,
            tradeDirection: 'long',
            daysHeld: 70,
            dte: 45,
            pl: 0,
            roi: 0,
            annualizedROI: 0,
            maxRisk: 460,
            cycleId: 'GOOG-2025-11',
            cycleType: 'diagonal',
            cycleRole: 'long-leg',
            definedRiskWidth: null,
            maxRiskOverride: null
        },
        {
            ticker: 'AMD',
            strategy: 'Short Call',
            tradeType: 'STO',
            quantity: -1,
            entryDate: '2025-09-12',
            expirationDate: '2025-09-27',
            exitDate: null,
            status: 'Open',
            stockPriceAtEntry: 108.3,
            strikePrice: 115,
            entryPrice: 1.45,
            exitPrice: null,
            fees: 0.9,
            ivRank: 55,
            delta: -20.6,
            gamma: null,
            theta: 0.06,
            vega: -0.18,
            marketCondition: 'Bearish',
            convictionLevel: 5,
            notes: 'Overbought daily chart',
            exitReason: null,
            id: 1008,
            tradeDirection: 'short',
            daysHeld: 4,
            dte: 14,
            pl: 0,
            roi: 0,
            annualizedROI: 0,
            maxRisk: 0,
            cycleId: 'AMD-2025-09',
            cycleType: 'short-call',
            cycleRole: 'overlay',
            definedRiskWidth: null,
            maxRiskOverride: 1000
        },
        {
            ticker: 'NFLX',
            strategy: 'Strangle',
            tradeType: 'BTO',
            quantity: 1,
            entryDate: '2025-09-18',
            expirationDate: '2025-10-18',
            exitDate: null,
            status: 'Open',
            stockPriceAtEntry: 405.4,
            strikePrice: 400,
            entryPrice: 6.8,
            exitPrice: null,
            fees: 1.35,
            ivRank: 58,
            delta: 0,
            gamma: null,
            theta: -0.12,
            vega: 0.45,
            marketCondition: 'Volatile',
            convictionLevel: 6,
            notes: 'Pre-earnings volatility play',
            exitReason: null,
            id: 1009,
            tradeDirection: 'long',
            daysHeld: 1,
            dte: 30,
            pl: 0,
            roi: 0,
            annualizedROI: 0,
            maxRisk: 680,
            cycleId: 'NFLX-2025-10',
            cycleType: 'strangle',
            cycleRole: 'earnings',
            definedRiskWidth: null,
            maxRiskOverride: null
        },
        {
            ticker: 'JPM',
            strategy: 'Covered Call',
            tradeType: 'STO',
            quantity: -1,
            entryDate: '2025-09-02',
            expirationDate: '2025-10-04',
            exitDate: null,
            status: 'Open',
            stockPriceAtEntry: 147.2,
            strikePrice: 150,
            entryPrice: 1.05,
            exitPrice: null,
            fees: 0.8,
            ivRank: 22,
            delta: -18,
            gamma: null,
            theta: 0.03,
            vega: -0.09,
            marketCondition: 'Neutral',
            convictionLevel: 4,
            notes: 'Monthly income trade',
            exitReason: null,
            id: 1010,
            tradeDirection: 'short',
            daysHeld: 8,
            dte: 24,
            pl: 0,
            roi: 0,
            annualizedROI: 0,
            maxRisk: 0,
            cycleId: 'JPM-2025-10',
            cycleType: 'covered',
            cycleRole: 'income',
            definedRiskWidth: null,
            maxRiskOverride: null
        }
    ],
    exportDate: '2025-09-25T12:00:00.000Z',
    version: '2.2'
};

class GammaLedger {
    constructor() {
        this.trades = [];
        this.currentView = 'dashboard';
        this.sortDirection = {};
        this.charts = {};
        this.tradeDetailCharts = new Map();
        this.cycleAnalytics = [];
        this.currentFileHandle = null;
        this.currentFileName = 'Unsaved Database';
        this.hasUnsavedChanges = false;
        this.supportsFileSystemAccess = 'showOpenFilePicker' in window;
        this.currentEditingId = null;

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

        this.features = {
            greeksEnabled: false
        };

        this.positionHighlightConfig = {
            expirationWarningDays: 20,
            expirationCriticalDays: 10
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

        this.setupAIChatResizeHandle();

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

        if (this.aiAgent) {
            this.aiAgent.updateContext({
                stats,
                openTrades: openTradesList,
                closedTrades: closedTradesList
            });
        }

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

        if (keyInput) {
            keyInput.value = this.gemini.apiKey;
        }

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

        if (status) {
            const variant = this.gemini.apiKey ? 'success' : 'neutral';
            const message = this.gemini.apiKey ? 'API key loaded' : 'Not set';
            this.updateGeminiStatus(message, variant);
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
        if (hasKey) {
            subtitleEl.textContent = 'Ask about your portfolio for AI-guided insights.';
        } else {
            subtitleEl.innerHTML = 'Connect your Gemini API key in <a href="#settings" class="ai-chat__settings-link">Settings</a> to get tailored analysis.';
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
        try {
            const raw = localStorage.getItem(GEMINI_STORAGE_KEY);
            if (!raw) {
                return;
            }

            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') {
                return;
            }

            if (typeof parsed.model === 'string' && parsed.model.trim()) {
                this.setGeminiModel(parsed.model.trim());
            }

            if (parsed.enc && parsed.payload) {
                const cryptoApi = this.getCrypto();
                if (!cryptoApi?.subtle) {
                    console.warn('Encrypted Gemini API key stored but Web Crypto unavailable.');
                    return;
                }

                try {
                    const key = await this.ensureGeminiEncryptionKey(cryptoApi);
                    if (!key) {
                        throw new Error('Encryption key unavailable');
                    }
                    const decrypted = await this.decryptString(parsed.payload, cryptoApi, key);
                    if (decrypted) {
                        this.gemini.apiKey = decrypted;
                    }
                } catch (error) {
                    console.warn('Failed to decrypt stored Gemini API key:', error);
                }
            } else if (typeof parsed.apiKey === 'string') {
                this.gemini.apiKey = parsed.apiKey;
            }
        } catch (error) {
            console.warn('Failed to load Gemini configuration:', error);
        }
    }

    saveGeminiConfigToStorage({ includeApiKey = false, encryptedPayload = null } = {}) {
        try {
            const payload = {
                model: this.gemini.model
            };

            if (encryptedPayload) {
                payload.enc = true;
                payload.payload = encryptedPayload;
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

        const safeNumber = (value) => {
            const num = Number(value);
            return Number.isFinite(num) ? num : null;
        };

        const columnLabels = [
            'Ticker', 'Strategy', 'Cycle', 'Trade Type', 'Strike', 'Qty', 'Entry Price',
            'Exit Price', 'Entry Date', 'Expiration', 'DTE', 'Exit Date', 'Days Held',
            'Max Risk', 'P&L', 'ROI', 'Annual ROI', 'Status', 'Actions'
        ];

        trades.forEach((trade, index) => {
            const row = tbody.insertRow();
            row.classList.add('trade-summary-row');

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
                cycleButton.addEventListener('click', (event) => {
                    event.stopPropagation();
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
            minY = 0;
            maxY = 0;
        }

        if (minY === maxY) {
            minY -= 1;
            maxY += 1;
        }

        const positiveArea = payoff.points.map(point => ({
            x: point.x,
            y: point.y >= 0 ? point.y : null
        }));

        const negativeArea = payoff.points.map(point => ({
            x: point.x,
            y: point.y <= 0 ? point.y : null
        }));

        const profitFill = ctx.createLinearGradient(0, 0, 0, canvas.height);
        profitFill.addColorStop(0, 'rgba(34, 197, 94, 0.18)');
        profitFill.addColorStop(1, 'rgba(34, 197, 94, 0.02)');

        const lossFill = ctx.createLinearGradient(0, 0, 0, canvas.height);
        lossFill.addColorStop(0, 'rgba(248, 113, 113, 0.18)');
        lossFill.addColorStop(1, 'rgba(248, 113, 113, 0.02)');

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

        const normalizedCycleType = this.normalizeCycleType(trade.cycleType, strategyRaw);
        const isPmccStrategy = strategy.includes("poor man's covered call")
            || strategy.includes('poor man')
            || normalizedCycleType === 'pmcc'
            || this.isPmccBaseLeg(trade)
            || this.isPmccShortCall(trade);

        if (isPmccStrategy) {
            const pmccLegs = this.extractPmccLegs(trade);
            if (!pmccLegs.baseLeg) {
                return {
                    type: 'unsupported',
                    reason: 'Add the PMCC base leg to this cycle to unlock the payoff diagram.'
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
        const cycleId = this.normalizeCycleId(trade.cycleId);
        let candidates = [];

        if (cycleId) {
            candidates = this.trades.filter(item => this.normalizeCycleId(item.cycleId) === cycleId);
        }

        if (candidates.length === 0) {
            const ticker = normalizeTicker(trade.ticker);
            if (ticker) {
                candidates = this.trades.filter(item => normalizeTicker(item.ticker) === ticker && this.normalizeCycleType(item.cycleType, item.strategy) === 'pmcc');
            }
        }

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

    buildDatabasePayload() {
        return {
            trades: this.trades,
            exportDate: new Date().toISOString(),
            version: '2.2'
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
                version: '2.2',
                timestamp: new Date().toISOString(),
                fileName: metadata.fileName || this.currentFileName || 'Unsaved Database',
                trades: this.trades
            };
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload));
            localStorage.removeItem(LEGACY_STORAGE_KEY);
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
                    this.hasUnsavedChanges = false;
                    this.updateUnsavedIndicator();
                    this.updateFileNameDisplay();
                    this.updateDashboard();
                    return true;
                }
            }

            const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
            if (legacy) {
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

        const winRate = Number.isFinite(stats.winRate) ? `${stats.winRate.toFixed(1)}%` : '—';
        const profitFactor = Number.isFinite(stats.profitFactor) ? stats.profitFactor.toFixed(2) : '—';
        const totalROI = Number.isFinite(stats.totalROI) ? `${stats.totalROI.toFixed(2)}%` : '—';
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

    formatCurrency(value) {
        return this.app.formatCurrency(value);
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
            '1.  **Acknowledge Strengths:** Start by briefly highlighting the strong overall performance (e.g., win rate, profit factor, successful strategies).\n2.  **Prioritize Top Risks:** Scrutinize the data to identify and explain the top 2-3 risks. Focus specifically on:\n    * **Concentration Risk:** Explicitly cite the `riskHeadline` about TGT representing 15% of exposure and explain the danger of such a large allocation to a single position.\n    * **Behavioral Risk:** Connect the `coachingHighlight` ("Losing trades stay open about 6 days longer") to the risk of turning small, manageable losses into larger ones.\n3.  **Provide Actionable Recommendations:** Based on the identified risks, provide clear, bulleted recommendations. Link them directly to the data.\n    * Suggest a specific rule for position sizing (e.g., "Consider a rule to cap any single position\'s max risk to under 10% of total open risk.").\n    * Propose a concrete action to address the behavioral risk (e.g., "Establish a non-negotiable mental stop-loss for each trade, such as closing at a 2x premium loss or a specific DTE.").\n4.  **Suggest Next Steps:** Conclude with 2-3 forward-looking actions for process improvement.',
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
            totalPL: this.formatNumber(stats.totalPL),
            winRate: this.formatNumber(stats.winRate),
            profitFactor: this.formatNumber(stats.profitFactor),
            totalROI: this.formatNumber(stats.totalROI),
            annualizedROI: this.formatNumber(stats.annualizedROI),
            maxDrawdown: this.formatNumber(stats.maxDrawdown),
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
            topStrategies: this.buildStrategySummary(),
            cycles: this.buildCycleSummary()
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
                    plRounded: this.formatNumber(trade?.pl),
                    roiRounded: this.formatNumber(trade?.roi)
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
            realisedPL: this.formatNumber(entry.pl),
            winRate: entry.trades > 0 ? this.formatNumber((entry.wins / entry.trades) * 100) : null
        }));
    }

    buildCycleSummary(limit = 3) {
        const cycles = Array.isArray(this.app.cycleAnalytics) && this.app.cycleAnalytics.length
            ? this.app.cycleAnalytics
            : this.app.calculateCycleAnalytics();
        return cycles.slice(0, limit).map(cycle => {
            const snapshot = this.snapshotObjectForPrompt(cycle);
            const derived = {
                tradeCount: Array.isArray(cycle?.trades) ? cycle.trades.length : 0,
                totalPLRounded: this.formatNumber(cycle?.totalPL),
                roiPercentRounded: this.formatNumber(cycle?.roiPercent),
                keyMetricLabel: cycle?.keyMetricLabel || null,
                keyMetricValueRounded: this.formatNumber(cycle?.keyMetricValue),
                timelineLabel: this.app.formatCycleDateRange(cycle?.startDate, cycle?.endDate, cycle?.hasOpenTrade)
            };

            snapshot.__promptDerived = Object.fromEntries(
                Object.entries(derived).filter(([, value]) => value !== null && value !== undefined)
            );

            if (!Object.keys(snapshot.__promptDerived).length) {
                delete snapshot.__promptDerived;
            }

            return snapshot;
        });
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

    formatNumber(value) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
            return null;
        }
        return Number(numeric.toFixed(2));
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