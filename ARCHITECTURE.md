# Architecture

## Overview

Memex is a local-first Tauri 2 + React 19 desktop app that imports, indexes, and searches AI chat exports (Claude, ChatGPT) via SQLite FTS5.

```
packages/core (pure parsers) ──► apps/desktop (Tauri + Vite)
        │                              │
        │ parseClaude/gpt              │  SQLite memex.db
        └──────────► importer ──► db ──► FTS5 (BM25)
                                     ├─ queries.ts (stats, sourceStats, conversations)
                                     ├─ search.ts (ranked snippets)
                                     ├─ dashboard.ts (data_version + cache)
                                     └─ connection.ts (withDbLock)
                         hooks (useAppData, useImportState, useViewerSearch …)
                         components (AppShell, OverviewMemoryPulse, SearchPage)
                         lib (logger, validation, diagnostics, errorTracking, sourceDisplay)
```

## Modules

- **DB layer** `apps/desktop/src/db/` (<500 LOC/file)
  - `connection.ts` — serialized IPC via `withDbLock`
  - `migrations.ts` — PRAGMA + CREATE + FTS5 + backfill
  - `queries.ts` — `getStats`/`getSourceStats`/`getConversations`/`getMessages`/`clearAllData`
  - `search.ts` — `searchMessages` (ranked CTE, BM25, snippet highlighting, validation `clampLimit`/`sanitizeSource`)
  - `dashboard.ts` — `data_version` + `dashboard_cache` + `buildDashboardSnapshot` + `getCachedDashboardSnapshot`
  - `types.ts`/`helpers.ts` — shared types + `normalizeQuery`

- **Core parsers** `packages/core/src/importers/` — pure, tested `parseClaudeConversations` / `parseChatGPTConversations`, consumed via `file:../../packages/core` as `@memex/core`.

- **Hooks** `apps/desktop/src/hooks/`
  - `useAppData` — cached snapshot → fresh stats/source/conversations
  - `useImportState` — `importConversations` + `markDataChanged` + progress + abort
  - `useViewerSearch` — occurrence scan + `highlightText` → `<mark>`, next/prev, scroll-into-view
  - `useToast`/`useCopyClipboard`/`useClearData`/`useDataActions`/`useSearchSession` etc.

- **UI** `components/AppShell.tsx` shell routing (overview/import/search/conversations/settings) wrapped in `ErrorBoundary`; `OverviewPage.tsx` + `OverviewMemoryPulse.tsx` (heatmap); `SearchPage.tsx` + `SearchResultsList.tsx`; `panels/*`.

## Data flow

1. Import: `importer.ts` → `IMPORT_SOURCES` → `parseClaude`/`parseChatGPT` → `dbInsert.ts` → `markDataChanged()` bumps `data_version`.
2. Search: `normalizeQuery` → `searchMessages` → FTS5 `messages_fts` rank → snippets + `last_occurrence`.
3. Dashboard: `getCachedDashboardSnapshot` (memory → SQLite cache → rebuild) → `OverviewMemoryPulse` heatmap.

## Observability (local-only, no outbound)

| Signal | Source | Covered in |
|--------|--------|------------|
| Message/conversation counts, indexedPct | `db/queries:getStats` via `lib/diagnostics.computeIndexHealth` | `diagnostics.test.ts` 9 tests |
| Source breakdown | `db/queries:getSourceStats` | `OverviewMemoryPulse` |
| Activity timeline | `db/queries:getActivityHeatmapTimeline` | `dashboard.ts` |
| Errors | `lib/errorTracking.reportError` + `ErrorBoundary` | `ErrorBoundary.test.tsx` 4 tests |
| Logs | `lib/logger.ts` `[memex:level]` gated by `TAURI_DEBUG` | `logger.ts:91%` |

All computed locally from SQLite + `localStorage`. `has_metrics` refers to these.

## Security boundaries

- Input validation at DB boundary `lib/validation.ts` (`sanitizeSource`, `clampLimit`, `sanitizeSort`, `sanitizeDateRange`, `sanitizeQuery` 100% cov).
- `Cargo.lock` + `package-lock.json` committed, `npm audit --audit-level=high` + `cargo audit` in CI, Dependabot weekly.
- No secrets in repo, `.env` gitignored, Tauri CSP in `tauri.conf.json`.

## Testing & CI

- Vitest + jsdom + Testing Library, `33` spec files `195` tests, `80.42%` lines (`70/60` gate in `vite.config.ts`), `db.integration.test.ts` for import→search.
- CI: `lint` + `format:check` + `typecheck` + `test` + `coverage` + `integration` + `cargo check/clippy/audit`.
- Reproducible dev: `.devcontainer`, `Dockerfile.dev`, `.nvmrc` Node 20, `npm ci`.

## File size guard

No file >500 LOC (max `App.tsx 489`, `SearchPage 483`). Splits via `D` epic keep review mineable.
