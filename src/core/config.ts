// Application constants - frozen for immutability

// ---------------------------------------------------------------------------
// Config shape type
// ---------------------------------------------------------------------------

interface AppConfigShape {
    GEMINI: {
        readonly DEFAULT_MODEL: string
        readonly ALLOWED_MODELS: readonly string[]
        readonly DEFAULT_TEMPERATURE: number
        readonly DEFAULT_ENDPOINT: string
    }
    STORAGE: {
        readonly GEMINI_CONFIG: string
        readonly GEMINI_SECRET: string
        readonly DISCLAIMER: string
        readonly AI_COACH_CONSENT: string
        readonly SIDEBAR_COLLAPSED: string
        readonly LOCAL_DATABASE: string
        readonly DEFAULT_FEE_PER_CONTRACT: string
        readonly FINNHUB_RATE_LIMIT: string
        readonly GEMINI_MAX_TOKENS: string
        readonly LEGACY_KEYS: readonly string[]
    }
    SHARE_CARD: {
        readonly EXPORT_SIZE: number
        readonly CHART_WIDTH_RATIO: number
        readonly CHART_HEIGHT_RATIO: number
        readonly CHART_MIN_HEIGHT: number
    }
    PL_RANGES: readonly string[]
}

export const APP_CONFIG: AppConfigShape = Object.freeze({
    GEMINI: {
        DEFAULT_MODEL: 'gemini-2.5-flash',
        ALLOWED_MODELS: Object.freeze(['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-pro']),
        DEFAULT_TEMPERATURE: 0.25,
        DEFAULT_ENDPOINT: 'https://generativelanguage.googleapis.com/v1beta/models'
    },
    STORAGE: {
        GEMINI_CONFIG: 'GammaLedgerGeminiConfig',
        GEMINI_SECRET: 'GammaLedgerGeminiSecret',
        DISCLAIMER: 'GammaLedgerDisclaimerAcceptedAt',
        AI_COACH_CONSENT: 'GammaLedgerAICoachConsentAt',
        SIDEBAR_COLLAPSED: 'GammaLedgerSidebarCollapsed',
        LOCAL_DATABASE: 'GammaLedgerLocalDatabase',
        DEFAULT_FEE_PER_CONTRACT: 'GammaLedgerDefaultFeePerContract',
        FINNHUB_RATE_LIMIT: 'GammaLedgerFinnhubRateLimit',
        GEMINI_MAX_TOKENS: 'GammaLedgerGeminiMaxTokens',
        LEGACY_KEYS: Object.freeze([
            'GammaLedgerTrades',
            'GammaLedgerDatabase',
            'GammaLedgerLocalState',
            'GammaLedgerState'
        ])
    },
    SHARE_CARD: {
        EXPORT_SIZE: 1080,
        CHART_WIDTH_RATIO: 0.78,
        CHART_HEIGHT_RATIO: 0.42,
        CHART_MIN_HEIGHT: 320
    },
    PL_RANGES: Object.freeze(['7D', 'MTD', '1M', '3M', 'YTD', '1Y', 'ALL'])
});

// ---------------------------------------------------------------------------
// Legacy constants for backward compatibility with existing call sites
// ---------------------------------------------------------------------------

export const DEFAULT_GEMINI_MODEL: string = APP_CONFIG.GEMINI.DEFAULT_MODEL;
export const GEMINI_ALLOWED_MODELS: readonly string[] = APP_CONFIG.GEMINI.ALLOWED_MODELS;
export const DEFAULT_GEMINI_TEMPERATURE: number = APP_CONFIG.GEMINI.DEFAULT_TEMPERATURE;
export const DEFAULT_GEMINI_ENDPOINT: string = APP_CONFIG.GEMINI.DEFAULT_ENDPOINT;
export const GEMINI_STORAGE_KEY: string = APP_CONFIG.STORAGE.GEMINI_CONFIG;
export const GEMINI_SECRET_STORAGE_KEY: string = APP_CONFIG.STORAGE.GEMINI_SECRET;
export const DISCLAIMER_STORAGE_KEY: string = APP_CONFIG.STORAGE.DISCLAIMER;
export const AI_COACH_CONSENT_STORAGE_KEY: string = APP_CONFIG.STORAGE.AI_COACH_CONSENT;
export const SIDEBAR_COLLAPSED_STORAGE_KEY: string = APP_CONFIG.STORAGE.SIDEBAR_COLLAPSED;
export const LOCAL_STORAGE_KEY: string = APP_CONFIG.STORAGE.LOCAL_DATABASE;
export const LEGACY_STORAGE_KEY: string = APP_CONFIG.STORAGE.LEGACY_KEYS[0];
export const LEGACY_STORAGE_KEYS: readonly string[] = APP_CONFIG.STORAGE.LEGACY_KEYS;
export const SHARE_CARD_EXPORT_SIZE: number = APP_CONFIG.SHARE_CARD.EXPORT_SIZE;
export const SHARE_CARD_CHART_WIDTH_RATIO: number = APP_CONFIG.SHARE_CARD.CHART_WIDTH_RATIO;
export const SHARE_CARD_CHART_HEIGHT_RATIO: number = APP_CONFIG.SHARE_CARD.CHART_HEIGHT_RATIO;
export const SHARE_CARD_CHART_MIN_HEIGHT: number = APP_CONFIG.SHARE_CARD.CHART_MIN_HEIGHT;
export const CUMULATIVE_PL_RANGES: readonly string[] = APP_CONFIG.PL_RANGES;
export const DEFAULT_FEE_STORAGE_KEY: string = APP_CONFIG.STORAGE.DEFAULT_FEE_PER_CONTRACT;
export const FINNHUB_RATE_LIMIT_STORAGE_KEY: string = APP_CONFIG.STORAGE.FINNHUB_RATE_LIMIT;
export const GEMINI_MAX_TOKENS_STORAGE_KEY: string = APP_CONFIG.STORAGE.GEMINI_MAX_TOKENS;
export const DEFAULT_FINNHUB_RATE_LIMIT = 60 as const;
export const DEFAULT_GEMINI_MAX_TOKENS = 65536 as const;
export const CURRENT_STORAGE_VERSION = '2.5' as const;

// ---------------------------------------------------------------------------
// Runtime field sets — used to strip transient properties before persistence
// ---------------------------------------------------------------------------

export const RUNTIME_TRADE_FIELDS: ReadonlySet<string> = new Set([
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
    'weeklyROI',
    'monthlyROI',
    'annualizedROI',
    'wheelCoverage',
    'shares',
    'effectiveCostBasis',
    'marketValue',
    'unrealizedPL',
    'marketPriceSource'
]);

export const RUNTIME_LEG_FIELDS: ReadonlySet<string> = new Set([
    'importBatchId',
    'tickerSymbol'
]);
