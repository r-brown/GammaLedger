# GammaLedger frontend (v2)

Vite + React 18 + TypeScript (strict) + Tailwind. shadcn/ui-compatible component layout.

## Setup

```bash
cd v2/frontend
npm install
npm run dev   # http://localhost:5173, /api proxied to localhost:8765
```

Run the backend separately (`cd v2/backend && uv run gammaledger serve`).

## Scripts

```bash
npm run dev         # vite dev server
npm run build       # tsc + vite build
npm run typecheck   # tsc -b --noEmit
npm run lint        # eslint
npm run test        # vitest
```

## Layout (Phase 0)

```
src/
  main.tsx
  App.tsx                          # router + QueryClient providers
  index.css                        # Tailwind + design tokens (mirrors v1 style.css)
  shared/
    lib/utils.ts                   # cn() helper
    components/ui/button.tsx       # shadcn-style Button
  features/
    dashboard/DashboardPage.tsx    # placeholder route, hits /api/health
```

Phase 1 adds `features/trades/`, `shared/api/`, etc. Add shadcn components to
`shared/components/ui/` (no `npx shadcn add` needed if hand-writing; the
existing `Button` is the template).
