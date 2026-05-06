# Phase 2 — Schema Migration Log

> Companion to `PROGRESS.md` and `phase2-domain-objects.md`.
> Records runtime data migrations applied to persisted GammaLedger data.

---

## Migration 1 — localStorage Load Guard

**Date:** 2026-05-06

**Files:**
- `src/core/migration.ts`
- `src/index.ts`

**Scope:**
- Primary localStorage key: `GammaLedgerLocalDatabase`
- Legacy localStorage keys listed in `LEGACY_STORAGE_KEYS`

**Persisted version note:**

The live persisted schema still uses the string version value `'2.5'`.
The original Step 6 spec described a numeric `0 -> 1` migration, but
`phase2-domain-objects.md §11` documents the active schema as string-versioned.
This migration therefore treats missing, numeric, or otherwise non-string
versions as legacy input while preserving the current string-version contract.

**Rules applied by `migrateSchema(raw)`**

1. Non-object input returns `emptySchema()`.
2. Legacy array input is wrapped as `{ version: 0, trades: raw }`.
3. Missing or non-array `trades` becomes `[]`.
4. Non-object trade entries are discarded.
5. Every retained trade gets a stable `id`; missing or blank IDs become
   `legacy-${index}`.
6. Every retained leg gets a stable `id`; missing or blank IDs become
   `legacy-${tradeIndex}-leg-${legIndex}`.
7. Missing `exportDate` is filled from legacy `timestamp` when present,
   otherwise from the current timestamp.
8. Missing, numeric, or otherwise non-string `version` is rewritten to `'2.5'`.

**Deliberately out of scope:**
- User JSON file imports still enter through `processLoadedData()` and are not
  fully schema-validated yet.
- Full per-field trade/leg validation is still a follow-up; this guard focuses
  on safe load-envelope normalization and the required legacy trade ID migration.
