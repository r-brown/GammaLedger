# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Self-directed options traders, treated as one product audience with three tiers:
- **Retail premium sellers** (core): run income strategies (Wheel, cash-secured puts, covered calls, PMCC, credit spreads, iron condors) on their own accounts. They journal and review trades, often after the close or on weekends.
- **Broader active options traders**: multi-leg and directional strategies, Greeks monitoring, roll tracking, win rate by strategy.
- **Portfolio managers and quants** (secondary): consolidate accounts, produce client-style reports and shareable visuals, export data for backtesting.

## Product Purpose
GammaLedger is a privacy-first, local-first options trading journal and analytics dashboard. It lets traders record, import, and review options trades, see true performance across rolls and assignments, monitor open positions, and get AI-assisted review. Success: a trader trusts its numbers more than their broker statement or spreadsheet, and improves decisions from reviewing them.

## Positioning
All three of these hold together, and future work should not collapse them into one:
- **Local-first privacy**: no backend, no account, no subscription. Trade data stays in the browser and in user-owned JSON files.
- **Lifecycle-correct accounting**: leg-level realized P&L, automatic roll detection and grouping, and a Wheel/PMCC state machine (open, rolled, assigned, closed) with true break-evens across a whole chain.
- **AI Coach grounded in the user's own trades** (Anthropic, Gemini, OpenRouter; plus an MCP server), gated behind explicit consent.
- Open source (AGPLv3), free for non-commercial use; a commercial license exists for proprietary use.

## Operating Context
- Desktop browser, Chrome/Edge preferred (File System Access API for saving/loading `.json` databases).
- Data enters via OFX/QFX broker exports (direct Interactive Brokers integration), manual and multi-leg entry, pasted broker text, and JSON restore.
- Views: Dashboard, Trades list, Add Trade, Import, Watchlist, Credit Playbook, Settings.
- Live site https://gammaledger.com (app at /app/), with a Jekyll marketing/blog site in `website/`.

## Capabilities and Constraints
- Single-page TypeScript + Vite app, no backend. ECharts for charts, AG Grid for tables. No React/Vue until the documented Vue 3 migration.
- Storage is `localStorage` plus exported JSON; nothing is sent to external servers except opt-in AI and quote calls.
- Vocabulary users expect: DTE, Greeks (delta, gamma, theta, vega), max risk, capital at risk, break-even, roll, assignment, wheel, PMCC.
- Options only. Stocks-only, futures, and crypto options are out of scope for now.
- Undecided: Vue 3 migration timing; commercial licensing terms beyond what the README states.

## Brand Commitments
- Name: GammaLedger. Existing logo and banner assets in `assets/images/` and `public/`.
- Tone: no hype, no financial advice, no promised returns. Disclaimers stay. AI output is framed as analysis and coaching, not recommendations to trade.

## Evidence on Hand
- Dashboard screenshot and banners: `assets/images/gammaledger-dashboard.png`, `gammaledger-banner-0{1,2,3}.png`.
- Public site and blog: `website/`; community on Reddit and X.
- No confirmed testimonials, user counts, or benchmarks in the repo; do not fabricate them.

## Product Principles
1. **The numbers are the product.** Accuracy and traceability of P&L, risk, and lifecycle state outrank polish; every figure should be explainable.
2. **Dense data is a feature.** Users want Greeks, DTE, and P&L on screen together; do not trade density for whitespace.
3. **Private by default.** Nothing leaves the device without explicit consent; make that visible, not just true.
4. **Analyze, don't advise.** Copy and AI output stay sober and evidence-based; no hype, no guarantees.
5. **Desktop-first, responsive second.** Design for a trader at a large screen; keep mobile usable without letting it drive the layout.

## Accessibility & Inclusion
No specific standard confirmed. Open decision: whether to commit to WCAG 2.2 AA. Financial data must not rely on color alone (gain/loss also needs a sign or label).
