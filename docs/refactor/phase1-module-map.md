# Phase 1 — Proposed Module Map

> Companion to `phase1-analysis.md`. Proposes the final module structure and
> the migration order. **Awaits human review before any code is moved.**

---

## Guiding principles

1. **Keep `class GammaLedger`** as the central app object during Phase 1. Move its methods *off* the class only when the function is genuinely pure. Where state is required, the class becomes a thin orchestrator that delegates to module functions, passing `this` (or just the slice it needs) in.
2. **Lowest-level modules first.** `utils/` and `core/` modules have no project-internal deps. Trade calcs depend on those. UI depends on calcs. `index.js` wires everything.
3. **Preserve exact behavior.** No renames, no signature cleanup, no DRY-ing during Phase 1. Move-and-export only.
4. **One default export per module is rare.** Use named exports throughout — they trace better in 21K-line refactors.
5. **Chart.js and html2canvas remain on the `window`** for Phase 1 (per CLAUDE.md "Questions / Blockers"). Imported from npm in a later phase.
6. **Class methods that touch `this` deeply** stay as methods on the class for now. The module they "belong to" exports stateless helpers; the class method becomes a thin wrapper. Only move a method off the class entirely when it has zero `this` references after a quick rewrite to take dependencies as parameters.

---

## Adjusted target structure

The structure in CLAUDE.md is the right baseline. Adjustments based on the analysis:

- Add `src/core/sample-data.js` for `BUILTIN_SAMPLE_DATA` (1,200 lines).
- Split `src/trades/` into more files — one big `positions.js` is wrong; the lifecycle/risk/strategy code wants its own homes.
- Add `src/ai/` for the two existing agent classes plus the chat UI — this is genuinely a separate domain from "ui/modals".
- Add `src/integrations/finnhub.js` and `src/integrations/mcp.js` — Finnhub is a network adapter and doesn't fit `core/` or `trades/`.
- Add `src/imports/` (parallel to `src/trades/`) for the OFX + Robinhood parsers — they're nontrivial.
- Add `src/payoff/` — the per-trade payoff chart logic is ~1,300 LOC of math + Chart.js, it earns its own dir.
- Add `src/settings/` for Finnhub/Gemini/fees control wiring (currently scattered across many `initialize*` methods).

Final proposed layout:

```
src/
  index.js                       ← entry point — boots GammaLedger

  core/
    config.js                    ← APP_CONFIG + derived constants + storage-key constants
    sample-data.js               ← BUILTIN_SAMPLE_DATA IIFE
    storage.js                   ← safeLocalStorage + saveToStorage / loadFromStorage + legacy migration
    state.js                     ← (optional Phase 1) shape-only — the GammaLedger class stays as the state holder for now;
                                    keep this file as a placeholder + JSDoc typedef for the state shape

  utils/
    dates.js                     ← formatDate, calculateDTE, calculateDaysBetween, getWeekEndingFriday, getWeekKey,
                                    formatDayLabel, formatWeekLabel, parseDateValue, formatDateForInput
    dom.js                       ← escapeHTML, escapeHtml, generateTickerLink, createTickerElement, applyResponsiveLabels
    formatting.js                ← formatNumber, formatCurrency, formatPercent, getStrategyDisplayName,
                                    sanitizeString, parseDecimal, parseInteger, parseExitPrice
    crypto.js                    ← arrayBufferToBase64, base64ToArrayBuffer, encryptString, decryptString, getCrypto
    export.js                    ← exportToCSV, saveWithFileSystemAPI, saveWithDownload
    import-csv.js                ← parseCsvRow (general CSV row helper)

  trades/
    legs.js                      ← normalizeLegOrderType, mapOrderTypeToActionSide, getLegOrderDescriptor,
                                    getLegAction, getLegSide, deriveOrderTypeFromActionSide, normalizeLegAction,
                                    normalizeLegSide, normalizeLegType, getLegMultiplier, normalizeLeg,
                                    calculateLegCashFlow, summarizeLegs, hasNetOpenOptionLegs,
                                    hasNonExpiredOpenShortOptions, getNetOpenOptionContracts, getNetOpenShortCalls,
                                    buildLegLifecycleKey, getNormalizedLegOrderType, getPrimaryLeg
    positions.js                 ← deleteTrade, editTrade, sortTrades, enrichTradeData,
                                    deriveTradeTypeFromLeg, deriveTradeDirectionFromLeg, getTradeType,
                                    inferTradeDirection, normalizeStatus, normalizeTradeStatusInput,
                                    isClosedStatus, isAssignedStatus, isActiveStatus, isAssignmentReason,
                                    isCashSettlementReason, isCashSettledTrade, getDisplayStatus,
                                    determineTradeLifecycleStatus, getTradeOpenStockShares,
                                    getNetOpenLongCallContracts, isAssignmentTrade,
                                    handleTradeSubmit, updateTrade, resetAddTradeForm
    wheel.js                     ← isWheelPut, isWheelTrade, isWheelOrPmccTrade, isCoveredCall,
                                    getTradeWheelCoverage, isAwaitingCoverage, computeWheelEffectiveCostBasis,
                                    calculateOptionPremium
    pmcc.js                      ← isPmccBaseLeg, isPmccShortCall, isPmccTrade, extractPmccLegs
    spreads.js                   ← extractSpreadPair, extractRolledSpread, extractSingleSpread,
                                    extractIndividualLegPairs, detectRollChain,
                                    extractRolledPositionAcrossStrikes, extractRolledPosition,
                                    extractSingleLegPair
    risk.js                      ← buildRiskFormulaContext, computeDefaultMaxRisk, getStrategyRiskHandlers,
                                    evaluateStrategyMaxRisk, computeMaxRiskUsingFormula, assessRisk,
                                    getFormulaData, buildFormulaTooltipContent, buildMaxRiskTooltip,
                                    buildPLTooltip, buildVariablesWithExplanations, buildPLVariables,
                                    createFormulaIcon, positionFormulaTooltip,
                                    formatStrikeValue, derivePrimaryStrike, getActiveStrikeForDisplay,
                                    buildStrikeDisplay
    leg-form.js                  ← getLegsContainer, generateLegId, clearLegFormRows,
                                    getSelectedUnderlyingType, getDefaultMultiplierForLegType,
                                    syncLegMultiplierVisibility, syncLegTypeFieldVisibility,
                                    applyUnderlyingTypeToLegMultipliers, renderLegForms, addLegFormRow,
                                    autoFillUnderlyingPrice, autoFillUnderlyingPricesForLegs,
                                    removeLegFormRow, createClosingLegFromRow, updateLegRowNumbers,
                                    collectLegsFromForm

  calculations/
    pnl.js                       ← calculatePL, calculateROI, calculateAnnualizedROI, calculateWeeklyROI,
                                    calculateMonthlyROI, calculateMaxRisk, getCapitalAtRisk
    daysheld.js                  ← calculateDaysHeld, calculateDTE
    stats.js                     ← calculateAdvancedStats, calculateAssignmentStats, calculateTickerPerformance
    monte-carlo.js               ← generateMonteCarloProjection, ensureMonteCarloBaseline

  ui/
    views.js                     ← showView, setTodayDate, updateTickerPreview
    tables/
      active-positions.js        ← updateActivePositionsTable, refreshActivePositionsQuotes,
                                    populateQuoteCell, renderQuoteValue, getQuoteChangePercent,
                                    getQuoteChangeValue, setQuoteCellError, getQuoteErrorMessage,
                                    getCachedQuote, setCachedQuote
      assigned-positions.js      ← updateAssignedPositionsTable, refreshAssignedPositionsQuotes,
                                    updateAssignedPositionMetrics, initializeAssignedPositionsStatusFilter,
                                    setAssignedPositionsStatusFilter, syncAssignedPositionsStatusFilter
      recent-trades.js           ← updateRecentTradesTable
      trades-table.js            ← renderTradesTable, updateTradesList, sortTrades helpers (sortable values),
                                    populateFilters, filterTrades, openTradesFilteredByTicker,
                                    getSelectedFilterValues, normalizeFilterSelect, resetFilterSelect,
                                    restoreMultiSelectSelection, getSortableValue, compareSortableValues,
                                    applySortToTrades
      highlights.js              ← applyPositionHighlight, updateExpirationHighlight, updateItmHighlight,
                                    resolveStrikeForHighlight, isInTheMoney, inferOptionFlavor
    charts/
      dashboard-charts.js        ← updateAllCharts, updateMonthlyPLChart, updateCumulativePLChart,
                                    updateStrategyPerformanceChart, updateWinRateByStrategyChart,
                                    updateCommissionImpactChart, updateTimeInTradeChart,
                                    updateMonteCarloChart, renderTickerHeatmap,
                                    updatePerformanceGauges, renderRatioGauge
      cumulative-pl.js           ← initializeCumulativePLControls, setCumulativePLRange,
                                    syncCumulativePLControls, normalizeCumulativePLRange,
                                    getCumulativePLRangeLabel, getClosedTradesInRange,
                                    getCumulativePLRangeWindow, computeCumulativePLSeries
      destroy.js                 ← destroyChart (already on class — pure helper)
    credit-playbook/
      index.js                   ← initializeCreditPlaybookControls, syncCreditPlaybookStatusControls,
                                    setCreditPlaybookStatus, normalizeCreditPlaybookStrategyValue,
                                    setCreditPlaybookStrategy, setCreditPlaybookHorizon,
                                    setCreditPlaybookSymbol, updateCreditPlaybookView,
                                    sortCreditPlaybook, applyCreditPlaybookSortIndicators
      data.js                    ← getCreditPlaybookEntries, isCreditStrategyTrade,
                                    mapCreditTradeToEntry, resolveCreditPlaybookOpenedAt,
                                    deriveCreditPlaybookPrice, filterCreditPlaybookEntries,
                                    filterCreditPlaybookLegPairs, applyCreditPlaybookSort,
                                    applyCreditPlaybookSortToLegPairs, extractCreditPlaybookLegPairs
      render.js                  ← renderCreditPlaybookMetrics, renderCreditPlaybookTableFromLegPairs,
                                    renderCreditPlaybookDetailCell, createCreditStage,
                                    refreshCreditPlaybookQuotes
    dashboard.js                 ← updateDashboard
    sidebar.js                   ← initializeSidebarToggle, getSidebarCollapsedPreference,
                                    setSidebarCollapsedPreference, setSidebarCollapsed
    filters.js                   ← setupResponsiveFilters
    modals/
      disclaimer.js              ← initializeDisclaimerBanner, showDisclaimerBanner, hideDisclaimerBanner,
                                    acceptDisclaimer, getDisclaimerAcceptance, setDisclaimerAcceptance
      ai-coach-consent.js        ← initializeAICoachConsent, showAICoachConsent, hideAICoachConsent,
                                    promptAICoachConsent, acceptAICoachConsent, cancelAICoachConsent,
                                    hasAICoachConsent, getAICoachConsent, setAICoachConsent
    share-card.js                ← initializeShareCard, updateShareCard, refreshShareCardChart,
                                    waitForShareCardChartRender, downloadShareCard, updateShareCardRangeLabel
    notifications.js             ← showNotification, showLoadingIndicator, hideLoadingIndicator,
                                    updateFileNameDisplay, updateUnsavedIndicator, markUnsavedChanges
    file-status.js               ← (could merge with notifications.js — TBD during migration)

  payoff/
    render.js                    ← toggleTradePayoffDetail, renderTradePayoffChart,
                                    destroyTradePayoffChart
    pricing.js                   ← getUnderlyingPriceForPayoff, getFallbackUnderlyingPrice,
                                    optionIntrinsic, buildPriceRange
    series.js                    ← calculatePayoffSeries, determinePayoffModel,
                                    analyzeMultiLegStrategy, calculateSingleLegSeries,
                                    calculateMultiLegSeries, calculateVerticalSpreadSeries,
                                    calculateCoveredCallSeries, calculatePmccSeries,
                                    calculateSpreadBreakeven
    summary.js                   ← buildPayoffSummary, formatPayoffFooter, getTradePayoffMeta

  ai/
    chat.js                      ← initializeAIChat, toggleAIChat, handleAIChatSubmit,
                                    handleAIQuickPrompt, appendAIChatMessage, renderAIChatMessages,
                                    renderMarkdownToHTML, renderMarkdownTextSegment, formatMarkdownInline,
                                    applyBasicInlineFormatting, sanitizeMarkdownUrl,
                                    setupAIChatResizeHandle, updateAIChatHeader
    local-agent.js               ← class LocalInsightsAgent (move whole class)
    gemini-agent.js              ← class GeminiInsightsAgent (move whole class)

  imports/
    controls.js                  ← setupImportControls, handleOfxFileSelection,
                                    handleRobinhoodCsvFileSelection, importOfxFile, importOfxContent,
                                    importRobinhoodCsvFile, importRobinhoodCsvContent
    log.js                       ← appendImportLog, renderImportLog, updateImportSummary,
                                    renderImportSummary, countImportReviewTrades,
                                    getImportReviewTrades, countMergeableTickerGroups
    merge.js                     ← setupTradesMergeControls, toggleTradesMergePanel,
                                    updateTradesMergeToggleLabel, updateMergeColumnVisibility,
                                    refreshTradesMergePanelContents, refreshImportMergeList,
                                    updateImportMergeButtonState, resolveMergedExitReason,
                                    buildMergedTradeNote, createMergedTradeFromTrades,
                                    mergeSelectedImportTrades, mergeSelectedTradesFromList,
                                    renderTradeMergeSelectionSummary, renderTradeMergeGroups,
                                    updateTradesMergeButtonState, syncTradeSelectionCheckboxes,
                                    syncSelectAllCheckbox, handleSelectAllTrades, pruneTradeMergeSelection
    robinhood.js                 ← parseRobinhoodCsv, parseRobinhoodTransaction,
                                    parseRobinhoodOptionTransaction, parseRobinhoodStockTransaction,
                                    parseRobinhoodAssignedStockTransaction,
                                    parseRobinhoodAssignmentClosingLeg, mapRobinhoodTransCode,
                                    parseRobinhoodDate, normalizeRobinhoodDate, parseRobinhoodNumber,
                                    calculateRobinhoodFees, buildRobinhoodImportPayload,
                                    consolidateImportLegs, buildLegFromRobinhoodTransaction,
                                    applyRobinhoodImportResult
    ofx.js                       ← parseOfx, extractOfxSecurities, parseOptionContractSymbol,
                                    parseOfxDate, mapOfxOrderType, extractOfxTransactions,
                                    sanitizeExternalLegId, groupTransactionsForImport,
                                    buildLegFromTransaction, sanitizeImportedLeg,
                                    buildOfxImportPayload, applyOfxImportResult
    position-keys.js             ← buildPositionKey, buildPositionIndex, consumePositionMatches,
                                    buildExistingExternalIdSet, tradeContainsExternalId,
                                    inferStrategyFromLegs, composeImportNotes,
                                    buildTradeStorageSnapshot, buildLegStorageSnapshot

  database/
    persist.js                   ← saveDatabase, loadDatabase, saveWithFileSystemAPI,
                                    saveWithDownload, loadWithFileSystemAPI, loadWithFileInput,
                                    processLoadedData, newDatabase, getStorageTrades,
                                    buildDatabasePayload

  integrations/
    finnhub.js                   ← initializeFinnhubControls, initializeFinnhubRateLimitControls,
                                    updateFinnhubStatus, updateFinnhubRateStatus, setFinnhubApiKey,
                                    getFinnhubStorageKey, getFinnhubSecretStorageKey,
                                    loadFinnhubConfigFromStorage, saveFinnhubConfigToStorage,
                                    removeFinnhubConfigFromStorage, ensureFinnhubEncryptionKey,
                                    encryptAndStoreFinnhubApiKey,
                                    loadFinnhubRateLimitFromStorage, saveFinnhubRateLimitToStorage,
                                    removeFinnhubRateLimitFromStorage,
                                    getQuoteEntryKey, rebuildQuoteRefreshSchedule,
                                    startQuoteAutoRefreshIfNeeded, stopQuoteAutoRefresh,
                                    restartQuoteRefreshWithNewRate,
                                    refreshCreditPlaybookQuotes, getCurrentPrice,
                                    enqueueFinnhubRequest, performFinnhubFetch,
                                    enforceFinnhubRateLimit
    gemini.js                    ← initializeGeminiControls, initializeGeminiMaxTokensControls,
                                    updateGeminiTokensStatus, syncGeminiControlsFromState,
                                    flushPendingGeminiStatus, getGeminiModelLabel,
                                    getGeminiChatDisplayName, updateAIChatHeader,
                                    updateGeminiStatus, setGeminiApiKey, setGeminiModel,
                                    loadGeminiConfigFromStorage, saveGeminiConfigToStorage,
                                    removeGeminiEncryptionKey, ensureGeminiEncryptionKey,
                                    encryptAndStoreGeminiApiKey,
                                    loadGeminiMaxTokensFromStorage, saveGeminiMaxTokensToStorage,
                                    removeGeminiMaxTokensFromStorage
    mcp.js                       ← buildMCPContext, buildMCPTrade, buildMCPAssignment

  settings/
    default-fee.js               ← initializeDefaultFeeControls, loadDefaultFeeFromStorage,
                                    saveDefaultFeeToStorage, removeDefaultFeeFromStorage,
                                    updateDefaultFeeStatus, getDefaultFeeForQuantity

  styles/                        ← Step 6 — out of scope for module-map review
```

---

## Module ownership matrix

| Module | Owns (state slot on `this`) | Depends on |
| --- | --- | --- |
| `core/config.js` | `APP_CONFIG` and derived constants | — |
| `core/sample-data.js` | `BUILTIN_SAMPLE_DATA` | `core/config.js` (date helpers inline) |
| `core/storage.js` | `safeLocalStorage` table; legacy migration helpers | `core/config.js` |
| `core/state.js` | (placeholder — class instance is the state holder for now) | — |
| `utils/dates.js` | — | — |
| `utils/dom.js` | — | — |
| `utils/formatting.js` | — | — |
| `utils/crypto.js` | — | — |
| `utils/export.js` | — | `utils/dom.js` |
| `trades/legs.js` | — | `utils/formatting.js` |
| `trades/positions.js` | `currentEditingId`, `currentSort` | `trades/legs.js`, `calculations/pnl.js`, `utils/dates.js`, `utils/formatting.js` |
| `trades/wheel.js` | — | `trades/legs.js`, `trades/positions.js` |
| `trades/pmcc.js` | — | `trades/legs.js` |
| `trades/spreads.js` | — | `trades/legs.js`, `utils/dates.js` |
| `trades/risk.js` | — | `trades/legs.js`, `utils/formatting.js` |
| `trades/leg-form.js` | (DOM only) | `trades/legs.js`, `integrations/finnhub.js` (autofill) |
| `calculations/pnl.js` | — | `trades/legs.js` |
| `calculations/daysheld.js` | — | `utils/dates.js` |
| `calculations/stats.js` | `latestStats` | `calculations/pnl.js`, `trades/positions.js` |
| `calculations/monte-carlo.js` | — | — |
| `ui/views.js` | `currentView` | — |
| `ui/dashboard.js` | (orchestrator) | `calculations/stats.js`, all `ui/charts/`, all `ui/tables/`, `ui/share-card.js` |
| `ui/tables/*` | (DOM only) | `trades/*`, `calculations/pnl.js`, `integrations/finnhub.js` (quotes) |
| `ui/charts/*` | `charts` map | `calculations/stats.js`, `calculations/monte-carlo.js`, Chart.js global |
| `ui/credit-playbook/*` | `creditPlaybook*` slots | `trades/spreads.js`, `integrations/finnhub.js` |
| `ui/sidebar.js` | `sidebarState` | `core/storage.js` |
| `ui/filters.js` | — | — |
| `ui/modals/disclaimer.js` | `disclaimerBanner` | `core/storage.js` |
| `ui/modals/ai-coach-consent.js` | `aiCoachConsent` | `core/storage.js` |
| `ui/share-card.js` | `shareCard` | Chart.js + html2canvas globals, `calculations/stats.js` |
| `ui/notifications.js` | `hasUnsavedChanges`, `currentFileName` | — |
| `payoff/*` | `tradeDetailCharts` Map | `trades/legs.js`, `trades/pmcc.js`, `trades/spreads.js`, `integrations/finnhub.js` |
| `ai/chat.js` | `aiChatMessages`, `aiChatSessionId`, `aiChatPendingRequest`, `aiChatOpen` | `ai/local-agent.js`, `ai/gemini-agent.js`, `ui/modals/ai-coach-consent.js` |
| `ai/local-agent.js` | (its own class state) | (none — receives `app` ref) |
| `ai/gemini-agent.js` | (its own class state) | `integrations/gemini.js` (key/model) |
| `imports/controls.js` | `importControlsInitialized` | `imports/robinhood.js`, `imports/ofx.js`, `imports/log.js`, `imports/merge.js` |
| `imports/log.js` | `importLog`, `importSummary` | — |
| `imports/merge.js` | `importMergeSelection`, `tradeMergeSelection`, `tradesMergeInitialized`, `tradesMergePanelOpen` | `imports/log.js` |
| `imports/robinhood.js` | — | `trades/legs.js`, `imports/position-keys.js`, `utils/dates.js`, `utils/formatting.js` |
| `imports/ofx.js` | — | `trades/legs.js`, `imports/position-keys.js`, `utils/dates.js` |
| `imports/position-keys.js` | — | `trades/legs.js` |
| `database/persist.js` | `currentFileHandle`, `currentFileName`, `supportsFileSystemAccess`, `hasUnsavedChanges` | `core/storage.js`, `core/sample-data.js` |
| `integrations/finnhub.js` | `finnhub` struct, `activeQuoteEntries`, `quoteRefreshIntervalId`, `autoRefreshIntervalMs`, `quoteRefreshKeys`, `quoteRefreshCursor` | `core/storage.js`, `utils/crypto.js` |
| `integrations/gemini.js` | `gemini` struct | `core/storage.js`, `utils/crypto.js` |
| `integrations/mcp.js` | — | `trades/positions.js` |
| `settings/default-fee.js` | `defaultFeePerContract` | `core/storage.js` |
| `index.js` | (entry point) | All of the above |

---

## Migration sequence (revised from CLAUDE.md baseline)

Order matters — earlier modules must be free of imports from later ones.

```
Wave 1 — pure utilities and constants (no this dependency)
 1. src/core/config.js
 2. src/core/sample-data.js
 3. src/utils/dates.js
 4. src/utils/dom.js
 5. src/utils/formatting.js
 6. src/utils/crypto.js

Wave 2 — storage layer
 7. src/core/storage.js          (saveToStorage, loadFromStorage, safeLocalStorage)
 8. src/utils/export.js
 9. src/utils/import-csv.js      (parseCsvRow only)

Wave 3 — trade model (data, no DOM)
10. src/trades/legs.js
11. src/calculations/pnl.js
12. src/calculations/daysheld.js
13. src/trades/positions.js      (sans handleTradeSubmit / updateTrade — those touch DOM)
14. src/trades/wheel.js
15. src/trades/pmcc.js
16. src/trades/spreads.js
17. src/trades/risk.js
18. src/calculations/stats.js
19. src/calculations/monte-carlo.js

Wave 4 — agents (already self-contained classes)
20. src/ai/local-agent.js
21. src/ai/gemini-agent.js

Wave 5 — integrations
22. src/integrations/gemini.js
23. src/integrations/finnhub.js
24. src/integrations/mcp.js
25. src/settings/default-fee.js

Wave 6 — payoff (depends on trades + integrations)
26. src/payoff/pricing.js
27. src/payoff/series.js
28. src/payoff/summary.js
29. src/payoff/render.js

Wave 7 — imports
30. src/imports/position-keys.js
31. src/imports/log.js
32. src/imports/robinhood.js
33. src/imports/ofx.js
34. src/imports/merge.js
35. src/imports/controls.js

Wave 8 — UI helpers
36. src/ui/notifications.js
37. src/ui/views.js
38. src/ui/filters.js
39. src/ui/sidebar.js
40. src/ui/modals/disclaimer.js
41. src/ui/modals/ai-coach-consent.js

Wave 9 — UI tables and charts
42. src/ui/tables/highlights.js
43. src/ui/tables/active-positions.js
44. src/ui/tables/assigned-positions.js
45. src/ui/tables/recent-trades.js
46. src/ui/tables/trades-table.js
47. src/ui/charts/cumulative-pl.js
48. src/ui/charts/dashboard-charts.js
49. src/ui/credit-playbook/data.js
50. src/ui/credit-playbook/render.js
51. src/ui/credit-playbook/index.js

Wave 10 — share card, dashboard, AI chat
52. src/ui/share-card.js
53. src/ui/dashboard.js
54. src/ai/chat.js

Wave 11 — trade form + database
55. src/trades/leg-form.js
56. src/database/persist.js

Wave 12 — entry point
57. src/index.js                ← imports all wired up; delete src/legacy/app.js
```

This is **57 steps**, vs. the 21 steps in CLAUDE.md. The original list is too coarse for a 21K-line file — splitting earns more frequent green smoke tests and keeps each commit reviewable.

---

## Open questions for human reviewer

1. **Class vs. functions.** This proposal keeps `class GammaLedger` intact during Phase 1 — modules export functions that the class delegates to. Alternative: dissolve the class entirely into a plain object + module functions. Class-keeps-it-bisectable; function-only is cleaner long-term. **Recommend keeping the class.**
2. **`payoff/` directory** — would you prefer this folded into `ui/charts/` since it's chart code? It's separated here because the math is non-trivial (1,300 LOC of strategy-specific payoff logic) and it'll likely need TypeScript types in Phase 2.
3. **Credit Playbook** lives under `ui/` here, but its data extractors (`extractSpreadPair`, etc.) genuinely belong in `trades/spreads.js`. The split shown above does this. Confirm OK.
4. **`integrations/finnhub.js`** is large (~30 methods). Acceptable to keep as one file, or split into `finnhub/api.js` + `finnhub/quotes.js` + `finnhub/settings.js`? Recommend single file for now; split if it crosses 800 LOC.
5. **Sample data file size** — `BUILTIN_SAMPLE_DATA` is ~1,200 lines of static fixture. Should it live as a `.js` IIFE or as a `.json` import? `.js` is the zero-risk choice for Phase 1.
6. **Settings UI scattering** — Currently all the `initialize*Controls()` methods are wired from `bindEvents`/`init`. After modularization, each module exports its own `init*` function and `index.js` calls them all. OK?
7. **Test plan during migration** — The CLAUDE.md smoke checklist runs after every step. Feasible at 57 steps but tedious. Propose: full smoke after every wave (12 waves), spot-check after each step. Confirm.

---

## Globals to eliminate during Phase 1

These are direct consequences of the move to ES modules:

- `Chart` (currently global from CDN) → `window.Chart` — explicit access from `ui/charts/*` and `payoff/render.js` only.
- `html2canvas` (currently global) → `window.html2canvas` — explicit access from `ui/share-card.js` only.
- `localStorage` direct access (28 sites) → all routed through `core/storage.js` exports.

Preserved:

- `window.tracker` — kept (single instance) so devtools workflows continue to work.
- File System Access API browser globals (`showOpenFilePicker`, `showSaveFilePicker`) — kept; accessed only from `database/persist.js`.

---

## What this map deliberately **does not** do

- No method renames.
- No signature normalization.
- No splitting of long methods (like `enrichTradeData`).
- No deduplication of the two `formatCurrencyValue` helpers (lines 10714 and 12890 — same name, different scopes).
- No conversion of arrow class fields (`safeLocalStorage`) to methods.
- No CSS reorganization (Step 6 — separate review).

All of these are Phase-2 concerns. Phase 1 is pure relocation.
