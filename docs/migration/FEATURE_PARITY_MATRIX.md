# Feature Parity Matrix

Source of truth: `FEATURE_INVENTORY.md`. Status values:

- Done — implemented and covered in v2
- Partial — scaffold or subset exists
- Pending — not started in v2
- Decision — needs product decision before porting

| Area | Legacy Feature | v2 Status | Notes |
|---|---|---:|---|
| Data migration | JSON file export envelope import | Done | `/api/v1/migrate` accepts `{version, exportDate, trades, mcpContext}` |
| Data migration | localStorage envelope import | Done | Importer accepts `{version, timestamp, fileName, trades, mcpContext}` |
| Data migration | legacy bare `trades[]` keys | Done | Importer accepts bare arrays from legacy storage keys |
| Data migration | runtime field stripping | Done | Trade and leg runtime fields are dropped before validation |
| Data migration | `tradeReasoning` to `notes` migration | Done | Covered by importer tests |
| Data migration | row-count and financial checksum validation | Done | `/api/v1/migrate` reports source/persisted trade counts, leg counts, and financial checksums |
| Storage | Full Phase 1 persisted schema | Done | Trade/Leg plus import batches, runtime compatibility snapshots, leg import metadata, local settings, API config envelopes, and consent records |
| Trades | Trade + Leg persisted schema | Done | Persisted fields stored canonically; runtime fields preserved as compatibility snapshots and recomputed |
| Trades | Trade CRUD API | Partial | Create/get/list/update/delete and bulk delete covered; leg-edit endpoints deferred |
| Trades | Trade list frontend read path | Partial | Minimal imported-trades table exists; full 17-column ledger pending |
| P&L | Leg cash-flow signs | Done | Fixture and unit tests cover BTO/STO/BTC/STC signs |
| P&L | Closed Wheel cash-flow parity | Done | AAPL/KO fixtures covered |
| P&L | `exitPrice` multiplier handling | Done | Fixture parity covers 100x drift risk |
| MCP | Closed-trade `mcpContext` parity | Partial | AAPL/KO stable closed-trade context matches legacy |
| MCP | Open positions / active risk context | Done | Active MCP rows, filters, DTE buckets, expiring positions, detail, and concentration implemented |
| Lifecycle | Basic expiration rollover and common state transitions | Done | Date-only expiration, cash-settlement closure, assignment, assigned Wheel awaiting coverage, covered Wheel reactivation, and simple roll detection covered |
| MCP | Wheel/PMCC tracker positions | Done | Assigned-share rows, effective cost basis, premium collected, covered/uncovered share counts, active short-call count, and fallback held-stock mark-to-market implemented |
| Strategy APIs | Strategy breakdown, Wheel/PMCC rows, CSP groups | Done | Endpoints exist; strategy-family risk dispatch implemented, with all-62 per-formula fixture expansion still recommended |
| P&L API | Summary windows | Done | Endpoint exists for realized windows and fallback assigned-stock unrealized P&L |
| Dashboard | KPI cards | Done | React dashboard consumes MCP context summary metrics |
| Dashboard | Charts and heatmap | Partial | Lightweight P&L and bar charts implemented; full legacy Chart.js heatmap parity pending broader UI polish |
| Import | OFX import | Done | Stable endpoint parses supplied Interactive Brokers OFX sample into trades, legs, and import metadata |
| Import | Robinhood CSV import | Pending | Needs CSV fixture coverage |
| Export | CSV export | Pending | Preserve legacy 25-column shape |
| Export | OFX export | Decision | Advertised in docs but absent in legacy code |
| Share card | PNG portfolio card | Pending | Requires dashboard summary and chart output |
| AI | Local coach fallback | Pending | Rule-based behavior can be server or client side |
| AI | Gemini assistant | Pending | Hosted proxy per `DECISIONS.md`; local keys can remain browser-side |
| Settings | API keys and rate limits | Partial | Local UI persists rate-limit/defaults and consent; hosted key proxy remains deferred |
| Settings | Default fee per contract | Done | Local setting implemented in React settings surface |
| UX gates | Disclaimer modal | Pending | Must preserve first-run acceptance |
| UX gates | AI consent modal | Pending | Must preserve explicit AI consent |
| Browser support | File System Access fallback | Decision | v2 migration shifts storage to backend; export/import still needs browser fallback |
| Mobile | Responsive tables | Done | Desktop sidebar, mobile bottom nav, scrollable dense tables, and responsive cards implemented |
| Hosted | Auth | Deferred | Blocked until migration and analytics parity are stable |
| Hosted | Multi-tenant / white-label | Deferred | Blocked until migration and analytics parity are stable |
| Hosted | Monetization / usage metering | Deferred | Blocked until migration and analytics parity are stable |
