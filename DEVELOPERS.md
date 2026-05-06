# GammaLedger — Developer Guide

> **Stack:** Vite 8 · TypeScript 6 (incremental migration) · Vanilla JS/TS · ES Modules
> No framework. No backend. All data lives in `localStorage`.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [TypeScript Setup](#typescript-setup)
- [Building for Production](#building-for-production)
- [Previewing the Production Build Locally](#previewing-the-production-build-locally)
- [Deploying to GitHub Pages](#deploying-to-github-pages)
- [Path Aliases](#path-aliases)
- [Key Conventions](#key-conventions)
- [Smoke Test Checklist](#smoke-test-checklist)

---

## Prerequisites

| Tool | Minimum version | Notes |
|------|----------------|-------|
| Node.js | 20 LTS | Required by Vite 8 |
| npm | 10 | Comes with Node 20 |
| Git | any | Version control |

No global installs are required beyond Node/npm.

---

## Getting Started

```bash
# 1. Clone the repo
git clone https://github.com/r-brown/GammaLedger.git
cd GammaLedger

# 2. Install dependencies (devDependencies only — no runtime deps)
npm install

# 3. Start the dev server
npm run dev
```

Open **http://localhost:5173** in your browser.

The dev server:
- Serves `index.html` at the project root
- Hot-reloads edited ES modules automatically
- Shows TypeScript type errors as a browser overlay (via `vite-plugin-checker`)
- Does **not** require a build step before you can start working

---

## Project Structure

```
gammaledger/
├── index.html              ← App shell; loads src/legacy/app.js as a module
├── vite.config.ts          ← Vite config + path aliases
├── tsconfig.json           ← TypeScript config (permissive; strict added per module)
├── package.json
│
├── src/
│   ├── index.js            ← Future entry point (placeholder); populated per phase-1-module-map.md
│   ├── legacy/
│   │   ├── app.js          ← Main monolith (class GammaLedger, ~19 000 LOC — being migrated out)
│   │   └── app.css         ← Global stylesheet
│   │
│   ├── core/               ← App-wide constants, storage, state
│   │   ├── config.js       ← APP_CONFIG, storage keys, RUNTIME_TRADE_FIELDS / RUNTIME_LEG_FIELDS
│   │   ├── sample-data.js  ← Built-in demo dataset
│   │   ├── state.js        ← (placeholder)
│   │   └── storage.js      ← safeLocalStorage wrapper
│   │
│   ├── utils/              ← Pure helpers with no class state
│   │   ├── dates.js        ← formatDate, parseDateValue, calculateDaysBetween, …
│   │   ├── dom.js          ← DOM query helpers
│   │   ├── formatting.js   ← formatCurrency, parseDecimal, formatPercent, …
│   │   ├── crypto.js       ← Encryption helpers for stored API keys
│   │   ├── export.js       ← CSV export helpers
│   │   └── import-csv.js   ← CSV row parser
│   │
│   ├── calculations/       ← Financial math (no DOM, no storage)
│   │   ├── pnl.js          ← P&L calculations
│   │   ├── stats.js        ← Portfolio statistics
│   │   ├── daysheld.js     ← Days-held helpers
│   │   └── monte-carlo.js  ← Monte Carlo projection
│   │
│   ├── trades/             ← Trade domain logic
│   │   ├── legs.js         ← Leg normalization and summarization
│   │   ├── leg-form.js     ← Add-trade form rendering
│   │   ├── positions.js    ← Position enrichment
│   │   ├── wheel.js        ← Wheel strategy tracker
│   │   ├── pmcc.js         ← Poor Man's Covered Call tracker
│   │   ├── spreads.js      ← Spread strategies
│   │   └── risk.js         ← Risk / max-loss calculations
│   │
│   ├── ui/                 ← DOM rendering modules
│   │   ├── dashboard.js    ← Dashboard view
│   │   ├── filters.js      ← Trades-table filter UI
│   │   ├── notifications.js← Toast notifications
│   │   ├── share-card.js   ← Portfolio snapshot card
│   │   ├── sidebar.js      ← Sidebar nav
│   │   ├── views.js        ← View switching
│   │   ├── charts/         ← Chart.js wrappers
│   │   ├── credit-playbook/← Credit Playbook view
│   │   ├── modals/         ← Modal components
│   │   └── tables/         ← Table renderers
│   │
│   ├── imports/            ← Broker import pipeline
│   │   ├── ofx.js          ← OFX/QFX parser
│   │   ├── robinhood.js    ← Robinhood CSV parser
│   │   ├── merge.js        ← Trade-merge logic
│   │   ├── controls.js     ← Import UI controls
│   │   ├── log.js          ← Import log renderer
│   │   └── position-keys.js← Dedup key generation
│   │
│   ├── integrations/       ← External API clients
│   │   ├── finnhub.js      ← Finnhub live-quote client
│   │   ├── gemini.js       ← Google Gemini API wrapper
│   │   └── mcp.js          ← MCP context bridge
│   │
│   ├── ai/                 ← AI coach agents
│   │   ├── local-agent.js  ← Local heuristic coach
│   │   └── gemini-agent.js ← Gemini-backed coach
│   │
│   ├── payoff/             ← Payoff diagram calculations
│   │   ├── pricing.js
│   │   ├── render.js
│   │   ├── series.js
│   │   └── summary.js
│   │
│   ├── database/
│   │   └── persist.js      ← Higher-level load/save (target for Wave 11)
│   │
│   ├── settings/
│   │   └── default-fee.js  ← Default per-contract fee settings
│   │
│   └── styles/             ← (CSS modules — populated as legacy CSS is split out)
│
├── public/                 ← Static assets served as-is
│   ├── gammaledger-logo-16x16.png
│   ├── gammaledger-logo-32x32.png
│   └── gammaledger-logo-64x64.png
│
├── assets/img/             ← Marketing assets (not served by Vite)
├── docs/refactor/          ← Refactor analysis docs (phase1, phase2)
├── tests/                  ← Reference JSON fixtures and OFX samples
└── mcp/                    ← MCP server (Python, separate from the browser app)
```

### CDN dependencies

Two libraries are loaded from CDN directly in `index.html` — they are **not** npm packages:

| Library | Usage |
|---------|-------|
| `chart.js` (jsdelivr) | All dashboard and payoff charts |
| `html2canvas` (jsdelivr) | Portfolio snapshot share card |

---

## Development Workflow

### npm scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | Start Vite dev server with HMR at http://localhost:5173 |
| `npm run build` | Type-check (`tsc --noEmit`) then produce a `dist/` bundle |
| `npm run preview` | Serve the last `dist/` build locally at http://localhost:4173 |
| `npm run typecheck` | Run `tsc --noEmit` without building — fast type check only |

### Editing JS modules

The live app currently runs from `src/legacy/app.js`. The modules under `src/core/`,
`src/utils/`, etc. are extracted pieces that `app.js` imports as the Phase 1 migration
advances. If you add or modify logic:

1. Check whether the code belongs in an existing extracted module or still lives in `app.js`.
2. Prefer adding to extracted modules; wire them into `app.js` via `import`.
3. Keep extracted modules free of DOM references unless the module lives under `src/ui/`.

### Adding new modules

```bash
# Example: add a new utility module
touch src/utils/my-helper.js

# Export from it
# src/utils/my-helper.js
export function myHelper(x) { … }

# Import it wherever needed using either the relative path or the path alias
import { myHelper } from '@utils/my-helper.js'
```

Vite resolves the `@utils` alias to `/src/utils` (see [`vite.config.ts`](./vite.config.ts)).

---

## TypeScript Setup

TypeScript is being introduced **incrementally** (Phase 2 — see [CLAUDE.md](./CLAUDE.md)).
JS and TS files coexist. The configuration is permissive by design; strict mode is
activated per directory as modules are converted.

### Key `tsconfig.json` settings

```jsonc
{
  "compilerOptions": {
    "allowJs": true,       // .js files are included in the TS project
    "checkJs": false,      // JS files are NOT type-checked (avoids noise)
    "strict": false,       // Strict mode off globally; enabled per directory
    "skipLibCheck": true,  // Skips node_modules .d.ts checks
    "isolatedModules": true// Required for Vite's transpile-only mode
  }
}
```

### Converting a JS module to TypeScript

1. Rename `src/foo/bar.js` → `src/foo/bar.ts`
2. Add parameter and return types; import types from `@types-gl`
3. Run `npm run typecheck` — fix all new errors before committing
4. Run `npm run dev` and smoke-test the affected feature
5. Commit: `git commit -m "types(foo): convert bar to TypeScript"`

### Path alias for types

```ts
// Import from the shared type library
import type { Trade, DollarAmount } from '@types-gl'
// Resolves to src/types/index.ts
```

Type files live in `src/types/` (created during Phase 2; not yet populated).

### Enabling strict mode for a directory

Add a local `tsconfig.json` that extends the root:

```jsonc
// src/calculations/tsconfig.json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  },
  "include": ["./**/*"]
}
```

---

## Building for Production

```bash
npm run build
```

This runs two steps in sequence:

1. **`tsc --noEmit`** — type-checks all TS (and opted-in JS) files; fails on errors
2. **`vite build`** — bundles everything into `dist/`

The output in `dist/` is:
- `index.html` with hashed asset references
- `assets/` — hashed JS and CSS bundles
- `public/` static files copied verbatim

> **Note:** TypeScript adds **zero runtime overhead** — it is stripped at build time by Vite's esbuild transformer.

### Bundle size

The build is a single-page app with no npm runtime dependencies.
Chart.js and html2canvas are loaded from CDN and are **not** bundled.
Typical bundle sizes after Phase 1: ~350 KB JS (uncompressed), ~60 KB CSS.

---

## Previewing the Production Build Locally

```bash
# Build first (if not already done)
npm run build

# Serve dist/ at http://localhost:4173
npm run preview
```

This uses Vite's built-in static server. It faithfully mirrors what a web server
would serve — use this before any deployment to verify the production artefact works.

> **localStorage note:** data saved during `npm run dev` (port 5173) and
> `npm run preview` (port 4173) are in separate browser origins, so trade data
> will not carry over between the two.

---

## Deploying to GitHub Pages

GammaLedger is a fully static site — the `dist/` folder can be hosted anywhere.
Below are two approaches for GitHub Pages.

### Option A — Manual deploy (one-off or controlled)

```bash
# Build
npm run build

# Push dist/ to the gh-pages branch using the gh-pages utility
npx gh-pages -d dist
```

The app will then be live at `https://<username>.github.io/<repo>/`.

#### ⚠️ Base path for subdirectory deployments

If the repo is deployed to a subdirectory (e.g. `https://example.github.io/gammaledger/`
rather than a custom domain at `/`), set the `base` option in `vite.config.ts`:

```ts
// vite.config.ts
export default defineConfig({
  base: '/gammaledger/',   // ← set to your repo name
  // ...rest of config
})
```

When using a custom domain (e.g. `gammaledger.com`) pointed at the Pages site,
`base` should remain `'/'` (the default).

### Option B — Automated deploy via GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Type-check
        run: npm run typecheck

      - name: Build
        run: npm run build

      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

Then in the GitHub repository settings → **Pages** → set Source to
**GitHub Actions**.

Every push to `main` will type-check, build, and deploy automatically.

---

## Path Aliases

Defined in both `vite.config.ts` (for Vite) and `tsconfig.json` (for the TS language server):

| Alias | Resolves to |
|-------|-------------|
| `@core/*` | `src/core/*` |
| `@trades/*` | `src/trades/*` |
| `@calculations/*` | `src/calculations/*` |
| `@ui/*` | `src/ui/*` |
| `@utils/*` | `src/utils/*` |
| `@types-gl/*` | `src/types/*` |

Use these in import statements to avoid fragile relative paths:

```ts
// ✅ preferred
import { safeLocalStorage } from '@core/storage.js'
import { formatCurrency } from '@utils/formatting.js'

// ❌ avoid
import { safeLocalStorage } from '../../core/storage.js'
```

---

## Key Conventions

### File naming
- Source files: `kebab-case.js` / `kebab-case.ts`
- Type files: `kebab-case.ts` under `src/types/`

### TypeScript types
- Interfaces: `PascalCase` (e.g. `Trade`, `WheelCycle`)
- Type aliases: `PascalCase` (e.g. `DollarAmount`, `OptionType`)
- Never use `any` — use `unknown` for unvalidated external data
- Never use `object` — use a specific interface or `Record<string, unknown>`

### Financial values
- Dollar amounts are always `number` (never `string`) once past the input boundary
- The `parseDecimal` helper in `src/utils/formatting.js` is the canonical way to
  coerce user input or stored strings to numbers
- Never use `Number(x) || 0` for financial values — `0` is a valid and distinct value

### Dates
- Persisted dates: ISO 8601 string `"YYYY-MM-DD"`
- Internal calculations: `Date` objects
- Convert at boundaries using `parseDateValue` (`src/utils/dates.js`)

### localStorage
- All keys are listed in `APP_CONFIG.STORAGE` (`src/core/config.js`)
- Use `safeLocalStorage` (`src/core/storage.js`) for all reads and writes —
  it handles quota errors and private-mode gracefully
- Never mutate stored data structures in place; always write back the full object

### Commits
- `feat(module): description` — new feature
- `fix(module): description` — bug fix
- `types(module): description` — TypeScript conversion / type annotation
- `build: description` — tooling / config change
- `docs: description` — documentation only

---

## Smoke Test Checklist

Run after any non-trivial change and before every PR:

- [ ] `npm run typecheck` exits with **0 errors** for all converted files
- [ ] `npm run dev` — app loads at http://localhost:5173 with no console errors
- [ ] Dashboard renders with existing `localStorage` data
- [ ] Add a new trade — it persists after a page reload
- [ ] Wheel/PMCC tracker shows open positions correctly
- [ ] P&L values are numerically correct (not NaN, not string-concatenated)
- [ ] Date fields display correctly (no epoch timestamps, no "Invalid Date")
- [ ] CSV export produces a valid file with correct column types
- [ ] CSV import reads back correctly and all fields are typed
- [ ] Charts render without errors
- [ ] All modals open and close correctly
- [ ] `npm run build` completes with no errors
- [ ] `npm run preview` — production build loads at http://localhost:4173

