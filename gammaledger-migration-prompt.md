# GammaLedger — Codebase Analysis & Full-Stack Migration Prompt
# Model: claude-opus-4-6 | Mode: Claude Code (agentic)

---

## STATUS

This prompt is retained as the original migration brief, but it is no longer
the sole source of truth. Use the reviewed migration plan in `docs/migration/`
first:

- `DECISIONS.md` — resolved product and architecture decisions
- `MIGRATION_READINESS.md` — phase status, gates, and next work
- `DOMAIN_MODEL_MAP.md` — canonical legacy data and calculation behavior
- `FEATURE_INVENTORY.md` — parity checklist source
- `INTEGRATIONS.md` — trust boundaries, Gemini/Finnhub, OFX, MCP contract

If this prompt conflicts with those documents, the `docs/migration/` documents win.

---

## ROLE & MISSION

You are a senior full-stack architect and principal engineer with deep expertise in:
- Python backend systems (FastAPI, SQLModel, Alembic)
- Modern React/TypeScript frontend engineering
- Financial domain applications (options trading, portfolio management)
- Multi-tenant SaaS architecture
- Progressive migration of large legacy codebases

Your mission is to **analyse the current GammaLedger JavaScript codebase** in full detail,
then **design and implement a complete migration** to the new technology stack defined below.
You must not skip steps, not hallucinate APIs, and must read every relevant source file before
making any architectural decision.

---

## CURRENT STATE

GammaLedger is an options portfolio tracking application written in **plain JavaScript**.
The codebase is a monolith of 20,000+ lines of code in a single project.

Before doing anything else:

1. Recursively list all source files and their sizes
2. Read and fully understand:
   - All domain models (trades, positions, legs, strategies, P&L)
   - All calculation logic (greeks, premium, P&L, ROI, annualised return)
   - All data persistence logic (how data is stored/loaded today)
   - All UI components and screens
   - All external integrations (OFX parsing, Gemini API, any broker APIs)
   - All configuration and settings handling
3. Produce a **Domain Model Map** — a structured summary of every entity, its fields,
   its relationships, and the business rules that govern it
4. Produce a **Feature Inventory** — an exhaustive list of every feature currently
   implemented, grouped by functional area
5. Identify all **technical debt**, anti-patterns, and areas where the current
   implementation is fragile or unclear

Do not write a single line of new code until steps 1–5 are complete and documented.

---

## TARGET TECHNOLOGY STACK

### Backend
- **Runtime:** Python 3.12+
- **Framework:** FastAPI (async, with lifespan context)
- **ORM:** SQLModel (built on SQLAlchemy 2.0 + Pydantic v2)
- **Migrations:** Alembic
- **Task Queue:** ARQ (async Redis Queue) — for background jobs like P&L recalculation
- **Auth:** FastAPI-Users (JWT + refresh tokens, OAuth2-ready)
- **AI Integration:** Google Generative AI SDK (preserve existing)
- **OFX Parsing:** `ofxtools` library
- **Financial Math:** `pandas`, `numpy`, `scipy`
- **Testing:** `pytest` + `httpx` (async test client)

### Frontend
- **Framework:** React 18 + TypeScript (strict mode)
- **Build Tool:** Vite 5
- **UI Component Library:** shadcn/ui (Radix UI primitives + Tailwind CSS)
- **State Management:** Zustand (lightweight, modular stores)
- **Server State / Data Fetching:** TanStack Query v5
- **Routing:** React Router v6 (with lazy-loaded routes)
- **Charts / Visualisation:** Recharts + D3 (for options payoff diagrams)
- **Forms:** React Hook Form + Zod
- **Mobile:** Responsive-first layout; PWA manifest for home-screen install
- **Testing:** Vitest + React Testing Library

### Data Storage
- **Local mode:** SQLite (via SQLModel — zero config, file-based)
- **Hosted mode:** PostgreSQL 15+ (same models, swap via `DATABASE_URL` env var)
- **Cache / Sessions:** Redis (optional for local, required for hosted)
- **File Storage:** Local filesystem (local) / S3-compatible (hosted)

### Infrastructure & Packaging
- **Local dev:** `uvicorn --reload` + `vite dev` (two terminals)
- **Local user:** Docker Compose (single `docker compose up` command)
- **Hosted:** Docker images deployable to any VPS, ECS, or Kubernetes
- **Reverse Proxy:** nginx (serves frontend static files + proxies `/api` to backend)
- **Environment Config:** `python-decouple` (backend) + Vite env files (frontend)

---

## ARCHITECTURE REQUIREMENTS

### 1. Modularity

Structure the backend as a set of **self-contained domain packages**.
Each domain package must be independently testable and have no circular imports.

```
backend/
├── main.py                  # FastAPI app factory, lifespan, router registration
├── config.py                # All settings via python-decouple
├── database.py              # Engine, session factory, base model
├── dependencies.py          # Shared FastAPI dependencies (auth, db session)
│
├── domains/
│   ├── trades/              # Trade CRUD, OFX import, bulk operations
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── service.py
│   │   ├── router.py
│   │   └── tests/
│   ├── positions/           # Open position aggregation, assignment tracking
│   ├── strategies/          # Wheel, PMCC, CSP, spread logic
│   ├── pnl/                 # P&L engine, realised/unrealised, ROI
│   ├── analytics/           # Greeks, risk metrics, portfolio summary
│   ├── ai/                  # Gemini integration, prompt templates
│   ├── users/               # Auth, profiles, preferences (hosted mode)
│   ├── tenants/             # White-label tenant config (hosted mode)
│   └── notifications/       # Alerts, expiry warnings
│
├── integrations/
│   ├── ofx/                 # OFX file parsing and normalisation
│   ├── brokers/             # Future: IBKR, Tastytrade API adapters
│   └── market_data/         # Future: options chain, IV, pricing feeds
│
└── shared/
    ├── exceptions.py
    ├── pagination.py
    └── utils.py
```

Structure the frontend as **feature slices**:

```
frontend/src/
├── app/                     # App shell, routing, providers, global layout
├── features/
│   ├── dashboard/           # Portfolio summary, heat map, key metrics
│   ├── trades/              # Trade list, add/edit trade, OFX import
│   ├── positions/           # Open positions view, position detail
│   ├── wheel/               # Wheel tracker, sequence view
│   ├── analytics/           # P&L chart, strategy breakdown, expiry calendar
│   ├── ai-assistant/        # Chat panel, AI analysis, trade suggestions
│   ├── settings/            # App config, broker connections, preferences
│   └── auth/                # Login, register, token refresh (hosted only)
├── shared/
│   ├── components/          # Reusable UI primitives (Table, Card, Badge, etc.)
│   ├── hooks/               # usePortfolio, useTrades, useAI, etc.
│   ├── stores/              # Zustand stores
│   ├── api/                 # TanStack Query hooks + axios client
│   └── utils/               # Formatters, calculators, constants
└── types/                   # Global TypeScript types and API response shapes
```

### 2. Browser Independence

- The frontend must render correctly in Chrome, Firefox, Safari, and Edge
- Do not use any browser-specific APIs without feature detection and fallbacks
- Use `vite-plugin-legacy` to generate ES5 bundles for compatibility
- Avoid vendor-prefixed CSS; use PostCSS autoprefixer
- All date/time handling must use `date-fns` (not `moment.js`)
- Test rendering in at least three browsers as part of the build pipeline

### 3. Mobile Support

- All layouts must be **responsive-first** using Tailwind breakpoints (sm/md/lg/xl)
- Navigation must collapse to a bottom tab bar on mobile (`< 768px`)
- All tables must be horizontally scrollable or collapse to card views on mobile
- Touch targets must be minimum 44×44px (WCAG 2.1 AA)
- Implement a **PWA manifest** (`manifest.json`) so users can install to home screen
- Add a service worker (via `vite-plugin-pwa`) for offline-capable static assets
- The options payoff diagram must be touch-zoomable
- Never use `hover`-only interactions — always provide tap alternatives
- Test on both iOS Safari and Android Chrome

### 4. Stability

- Every domain service must have **unit tests** covering happy path and edge cases
- Every API endpoint must have **integration tests** using `httpx.AsyncClient`
- Frontend components must have React Testing Library tests for all user interactions
- Set up **pre-commit hooks** (via `pre-commit`):
  - `ruff` (Python linting + formatting)
  - `mypy` (strict type checking)
  - `eslint` + `prettier` (TypeScript)
  - `pytest` (fast unit tests only)
- CI pipeline (GitHub Actions) must run the full test suite on every PR
- All financial calculations must have property-based tests using `hypothesis`
- Define explicit error boundaries in React; never let a domain crash the whole app
- All API responses must follow a consistent envelope:
  ```json
  { "data": ..., "meta": { "page": 1, "total": 100 } }
  ```
  and error shape:
  ```json
  { "error": { "code": "TRADE_NOT_FOUND", "message": "...", "detail": {} } }
  ```

### 5. Performance

**Backend:**
- All database queries must use **async SQLAlchemy sessions** (no blocking I/O)
- Implement **query result caching** with TTL using `aiocache` (Redis in hosted, in-memory in local)
- P&L recalculation on large datasets must run as a **background task** (ARQ), not inline
- Paginate all list endpoints — never return unbounded result sets
- Add `ETag` / `Last-Modified` headers for cacheable resources
- Profile with `py-spy` and fix any endpoints exceeding 200ms p95

**Frontend:**
- All route components must be **lazy-loaded** (`React.lazy` + `Suspense`)
- Use `TanStack Query` stale-while-revalidate for all data fetching
- Virtualise long lists with `@tanstack/react-virtual` (trade history, position list)
- Bundle analyse with `rollup-plugin-visualizer`; no single chunk > 200KB gzipped
- Implement `useMemo` / `useCallback` discipline for expensive chart re-renders
- Use `IntersectionObserver` for lazy loading chart data below the fold
- Target Lighthouse score: Performance ≥ 90, Accessibility ≥ 95

### 6. Authentication & User Data (Hosted Version)

Design the auth system from day one, even if it is feature-flagged off in local mode.

**Auth flow:**
- Email + password registration with email verification
- JWT access tokens (15-minute expiry) + refresh tokens (30-day expiry, rotated)
- OAuth2 social login stubs: Google, GitHub (implement hooks, not necessarily providers)
- API key generation for programmatic access (future MCP integration)

**User data model:**
```
User
  id, email, hashed_password, is_verified, is_active
  created_at, last_login_at

UserProfile
  user_id (FK), display_name, timezone, currency, default_portfolio_id

Portfolio
  id, user_id (FK), tenant_id (FK nullable), name, description
  is_default, created_at

UserPreferences
  user_id (FK), theme, date_format, number_format, notification_settings (JSON)
```

**Data isolation:**
- Every query must be scoped to `user_id` — never return another user's data
- Use a `CurrentUser` FastAPI dependency injected into every protected router
- Implement **row-level security** patterns even at the ORM layer
- Audit log table: record every write operation with `user_id`, `action`, `entity`, `timestamp`

**Local mode:**
- Auth is bypassed; a `LOCAL_USER_ID = "local"` constant is injected
- No user table required; SQLite is single-user by definition
- Provide a clear `AUTH_ENABLED=false` config flag

### 7. Monetization (Hosted Version)

Design the data model and feature-flag system to support monetization from the start.
Do not implement payment processing — only the scaffolding.

**Subscription tiers (scaffold only):**
```
FREE:    1 portfolio, 50 trades/month, no AI features, no white-label
BASIC:   3 portfolios, unlimited trades, AI assistant (limited calls/month)
PRO:     unlimited portfolios, full AI, CSV/OFX export, API access
TEAM:    multi-user, shared portfolios, admin panel
```

**Feature flag system:**
- Implement a `FeatureFlags` model in the DB: `user_id`, `feature_name`, `enabled`, `limit_value`
- Create a `require_feature("ai_assistant")` FastAPI dependency that checks the flag
- Expose a `/api/v1/features` endpoint returning the current user's enabled features
- Frontend: `useFeatureFlag("ai_assistant")` hook that gates UI components
- Design so that NetLicensing can plug in as the entitlement backend (replace the DB-based flag check with a NetLicensing API call)

**Usage metering scaffold:**
- `UsageEvent` table: `user_id`, `feature`, `count`, `period` (YYYY-MM)
- Increment usage on every AI call, export, API request
- `/api/v1/usage` endpoint returns current period consumption vs limits

### 8. White-Labeling (Hosted Version)

**Tenant model:**
```
Tenant
  id, slug (unique, e.g. "acme-trading"), name, domain (custom domain CNAME)
  logo_url, primary_color, secondary_color, font_family
  is_active, plan, created_at

TenantSettings
  tenant_id (FK), setting_key, setting_value
  (e.g., default_currency, supported_strategies, hide_ai_features)
```

**Frontend white-label system:**
- On app load, call `/api/v1/tenant/config` to fetch the active tenant's branding
- Inject CSS custom properties (`--color-primary`, `--color-secondary`, `--font-body`)
  into `:root` dynamically — all Tailwind colour tokens reference these variables
- Replace logo, favicon, and page title from tenant config
- Support `subdomain.gammaledger.com` routing by reading `window.location.hostname`
  and resolving tenant from a `/api/v1/tenant/resolve?domain=...` endpoint
- Support custom domain CNAME: `app.acme-trading.com` → same resolution logic

**Backend white-label:**
- Every multi-tenant query must filter by `tenant_id`
- Add `X-Tenant-ID` header middleware that resolves tenant from subdomain or header
- Tenant config must be cacheable (TTL 5 min) — do not hit DB on every request

---

## MIGRATION STRATEGY

Do not attempt a big-bang rewrite. Follow this phased plan:

### Phase 0 — Foundation (do this first, before any feature work)
- [ ] Set up monorepo structure: `backend/`, `frontend/`, `docker/`, `docs/`
- [ ] Implement `backend/config.py` with all env vars defined and documented
- [ ] Implement `backend/database.py` with SQLite default, PostgreSQL-ready
- [ ] Implement `backend/main.py` app factory with health check endpoint
- [ ] Set up Alembic with initial empty migration
- [ ] Set up Vite + React + TypeScript + Tailwind + shadcn/ui scaffolding
- [ ] Set up Docker Compose for local single-command start
- [ ] Set up GitHub Actions CI with lint + type check + test jobs
- [ ] Set up pre-commit hooks

### Phase 1 — Domain Models & Storage
- [ ] Translate every JavaScript domain model into SQLModel models (preserve all fields)
- [ ] Write Alembic migration for the full schema
- [ ] Write Pydantic v2 request/response schemas for every entity
- [ ] Write a **data migration script** to export existing data from JavaScript storage
  format and import it into SQLite/PostgreSQL
- [ ] Validate migrated data: row counts, checksums on key financial fields

### Phase 2 — Core Backend APIs
- [ ] Implement `trades` domain: CRUD, OFX import, bulk delete
- [ ] Implement `positions` domain: open position aggregation, assignment detection
- [ ] Implement `strategies` domain: Wheel sequence tracking, PMCC legs, CSP grouping
- [ ] Implement `pnl` domain: realised P&L, unrealised P&L, ROI, annualised return
- [ ] Implement `analytics` domain: portfolio summary, strategy breakdown, ticker exposure
- [ ] 100% of Phase 1 JavaScript features must be covered by API endpoints before Phase 3 starts

### Phase 3 — Frontend
- [ ] Implement dashboard feature with all key metrics and charts
- [ ] Implement trades feature (list, add, edit, delete, OFX import)
- [ ] Implement positions feature (open positions, position detail)
- [ ] Implement wheel/PMCC tracker feature
- [ ] Implement analytics feature (P&L chart, calendar, breakdown)
- [ ] Implement settings feature
- [ ] Make all layouts fully responsive (mobile-first)
- [ ] Add PWA manifest and service worker

### Phase 4 — AI Integration
- [ ] Port existing Gemini integration to the `ai` domain
- [ ] Implement AI assistant chat panel in frontend
- [ ] Add AI-powered trade analysis endpoint
- [ ] Add feature-flagging around AI calls

### Phase 5 — Auth & Multi-User Scaffold
- [ ] Implement `users` domain with FastAPI-Users
- [ ] Add `AUTH_ENABLED` feature flag — local mode bypasses auth entirely
- [ ] Implement login/register/verify flows in frontend (`auth` feature)
- [ ] Add user data isolation to all queries

### Phase 6 — White-Label & Monetization Scaffold
- [ ] Implement `tenants` domain and middleware
- [ ] Implement feature flags system
- [ ] Implement usage metering scaffold
- [ ] Implement frontend white-label theming system

---

## CODING STANDARDS

### Python
- Use `async def` for all route handlers and service methods
- All models must have `model_config = ConfigDict(from_attributes=True)`
- Never use `SELECT *` — always specify columns
- Never commit a transaction in a service — let the caller control the session
- All exceptions must be caught at the router level and mapped to HTTP errors
- Use `structlog` for structured JSON logging
- Every public function and class must have a docstring

### TypeScript
- Enable `strict: true` in `tsconfig.json` — no `any` types
- All API response types must be generated from backend OpenAPI schema
  (use `openapi-typescript` to generate types automatically)
- Use named exports only — no default exports except for route components
- All async operations must handle loading, error, and empty states explicitly
- Zustand stores must be typed with explicit state and action interfaces

### Git
- Branch naming: `feat/`, `fix/`, `refactor/`, `chore/`
- Commit messages: Conventional Commits format (`feat(trades): add OFX bulk import`)
- Every PR must have a description, linked issue, and passing CI before merge
- Never commit secrets, `.env` files, or SQLite DB files

---

## DELIVERABLES

At the end of this task, the following must exist and be working:

1. **Full project structure** as defined above, committed to the repository
2. **All Phase 0–3 items** implemented and tested
3. **Docker Compose** that starts the full stack with `docker compose up`
4. **README.md** with:
   - Architecture overview diagram (ASCII or Mermaid)
   - Prerequisites
   - Local setup instructions (dev mode and Docker mode)
   - Environment variable reference
   - API documentation link (auto-generated by FastAPI)
   - Contributing guide
5. **Data migration script** that converts existing JavaScript storage to new format
6. **CI pipeline** (`.github/workflows/`) with lint, test, and build jobs
7. **Feature parity report** — a checklist mapping every original JavaScript feature
   to the new implementation, with status (✅ done / ⚠️ partial / ❌ missing)

---

## CONSTRAINTS & GUARDRAILS

- Do not remove any existing financial calculation logic without first writing
  a test that proves the new implementation produces identical results
- Do not change the domain terminology — keep existing names for strategies,
  legs, sequences, and metrics exactly as they are in the JavaScript codebase
- Do not introduce a new dependency without documenting why it was chosen
  over alternatives in a `docs/adr/` (Architecture Decision Record) file
- If you encounter ambiguous business logic in the JavaScript code, do not guess —
  create a `docs/questions.md` file listing the ambiguity and a proposed
  interpretation, then implement the interpretation with a TODO comment
- All secrets (API keys, DB passwords) must be read from environment variables —
  never hardcoded

---

## STARTING INSTRUCTION

Begin by executing the following analysis steps in order.
Do not proceed to the next step until the current one is complete and its output documented.

**Step 1:** List all files in the project recursively with sizes.
**Step 2:** Read every JavaScript source file. Identify and document all domain entities.
**Step 3:** Identify all features. Group them into functional areas.
**Step 4:** Identify all external dependencies and integrations.
**Step 5:** Produce the Domain Model Map and Feature Inventory as markdown documents.
**Step 6:** Present a migration readiness summary and confirm Phase 0 start.

Only after Step 6 is confirmed should you begin writing any new code.
