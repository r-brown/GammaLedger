import type {
  SortDirection,
  CumulativePLRange,
  ISOTimestamp,
} from './common'
import type { EnrichedTrade } from './trade'
import type { Stats } from './stats'
import type { FilterState, QuoteEntry, PositionHighlightConfig, CreditPlaybookEntry } from './ui'
import type { FinnhubState, GeminiState } from './integrations'
import type { Message } from './ai'
import type { ImportLogEntry, ImportSummary } from './imports'

// ---------------------------------------------------------------------------
// §12 — AppState (GammaLedger instance shape)
// There is no separate AppState object — GammaLedger class fields ARE the state.
// This interface documents the logical state bag for new readers.
// ---------------------------------------------------------------------------

/**
 * Credit-playbook filter + sort state.
 * Lives as scattered this.creditPlaybook* fields on GammaLedger.
 */
export interface CreditPlaybookState {
  status: 'active' | 'closed' | 'all'
  strategy: string | 'all'
  horizon: 'all' | string
  symbol: string
  sort: { key: string; direction: SortDirection }
  entries: CreditPlaybookEntry[]
  needsRefresh: boolean
  initialized: boolean
  /** ~45 strategy name strings from creditPlaybookStrategyOptions. */
  strategyOptions: string[]
}

/**
 * Consent / disclaimer banner state.
 */
export interface AICoachConsentState {
  banner: HTMLElement | null
  consentedAt: ISOTimestamp | null
}

/**
 * Sidebar collapse state.
 */
export interface SidebarState {
  collapsed: boolean
  mediaQuery: MediaQueryList | null
}

/**
 * Current sort key and direction for the trades table.
 */
export interface TradeSort {
  key: string | null
  direction: SortDirection
}

/**
 * Logical state bag for the GammaLedger class instance.
 * All fields correspond to `this.*` on the class; grouped here for documentation.
 *
 * This interface is NOT instantiated at runtime — it is a reference
 * for Phase 2 type-checking and Phase 3 component extraction.
 */
export interface AppState {
  // ---- Core portfolio data ----
  trades: EnrichedTrade[]
  latestStats: Stats | null
  currentFilteredTrades: EnrichedTrade[]
  currentSort: TradeSort
  /** Legacy mirror of currentSort.direction. */
  sortDirection: SortDirection

  // ---- File / persistence ----
  currentFileHandle: FileSystemFileHandle | null
  currentFileName: string | null
  hasUnsavedChanges: boolean
  supportsFileSystemAccess: boolean

  // ---- Editing ----
  currentEditingId: string | null

  // ---- Charts ----
  /** Dashboard chart instances keyed by chart name. */
  charts: Record<string, unknown>
  /** Per-trade payoff charts. */
  tradeDetailCharts: Map<string, unknown>

  // ---- Imports / merge ----
  importControlsInitialized: boolean
  importLog: ImportLogEntry[]
  importSummary: ImportSummary | null
  importMergeSelection: Set<string>
  tradeMergeSelection: Set<string>
  tradesMergeInitialized: boolean
  tradesMergePanelOpen: boolean

  // ---- AI chat ----
  aiAgent: unknown // LocalInsightsAgent | GeminiInsightsAgent
  aiChatMessages: Message[]
  aiChatSessionId: string | null
  aiChatPendingRequest: Promise<unknown> | null
  aiChatOpen: boolean

  // ---- Quotes ----
  activeQuoteEntries: Map<string, QuoteEntry>
  quoteRefreshIntervalId: number | null
  autoRefreshIntervalMs: number
  quoteRefreshKeys: string[]
  quoteRefreshCursor: number

  // ---- Integrations ----
  finnhub: FinnhubState
  gemini: GeminiState

  // ---- Credit playbook ----
  creditPlaybook: CreditPlaybookState

  // ---- Disclaimer / consent ----
  disclaimerBanner: HTMLElement | null
  disclaimerFadeMs: number
  aiCoachConsent: AICoachConsentState

  // ---- Sidebar ----
  sidebarState: SidebarState

  // ---- Other prefs ----
  cumulativePLRange: CumulativePLRange
  assignedPositionsStatusFilter: 'open' | 'closed' | 'all'
  defaultFeePerContract: number
  positionHighlightConfig: PositionHighlightConfig
}

