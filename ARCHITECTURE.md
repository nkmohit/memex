# Architecture

Memex is a local Tauri 2 and React 19 app. It imports AI chat JSON (Claude, ChatGPT, Gemini, Grok) and searches it with SQLite FTS5.

```
packages/core (parsers) ──► apps/desktop (Tauri + Vite 8)
        │                         │
        │ parse*                  │  SQLite memex.db
        └──────────► importer ──► db ──► messages_fts
                                    ├─ queries.ts (stats, sources, conversations)
                                    ├─ search.ts + searchQueryBuilder.ts
                                    ├─ dashboard*.ts (data_version + cache)
                                    └─ connection.ts (withDbLock)
                        hooks (useAppData, useImportState, useViewerSearch, …)
                        components (AppShell, OverviewMemoryPulse, SearchPage)
                        lib (logger, validation, schemas, diagnostics, errorTracking, sourceDisplay)
```

## Modules

- **DB** `apps/desktop/src/db/`
  - `connection.ts` — serialized access via `withDbLock`
  - `migrations.ts` — pragmas, tables, FTS5, backfill when messages exist and `messages_fts` is empty
  - `queries.ts` — stats, source stats, conversations, messages, clear
  - `search.ts` — `searchMessages` runs FTS5 only
  - `searchQueryBuilder.ts` — SQL fragments. Conversation `rank` is `(-1 * summed raw-query occurrences) + title LIKE boost (-5 or 0)`, not `bm25()`
  - `dashboard.ts`, `dashboardCache.ts`, `dashboardSnapshot.ts`
  - `types.ts`, `helpers.ts` — `normalizeQuery` appends `*` to each token

- **Parsers** `packages/core/src/importers/` — `parseClaudeConversations`, `parseChatGPTConversations`, `parseGeminiConversations`, `parseGrokConversations`. The desktop app depends on the built package `@memex/core`.

- **Hooks** `apps/desktop/src/hooks/` — data load, import, viewer find-in-conversation, theme, toasts, search session.

- **UI** — `AppShell` routes overview, import, search, conversations, and settings, wrapped in `ErrorBoundary`. Search results set `content-visibility: auto` on rows; they are not virtualized by a windowing library. Settings flags in `localStorage` (`lib/flags.ts`) are `summarize` and `topicTimeline`.

- **Plugins** — `plugins/registry.ts` keeps an in-memory importer map used by tests and by `importer.ts` for unknown source ids. `loadPlugins()` returns 0.

- **Rust** — `src-tauri/src/lib.rs` registers SQL, opener, dialog, and FS plugins, plus `get_diagnostics` (package version and `generated_at: 0`).

## Data flow

1. Import: dialog `open` → `readTextFile` → parser → `dbInsert.ts` → `markDataChanged()` increments `data_version`.
2. Search: `normalizeQuery` → FTS `MATCH` → grouped rows and up to three `snippet()` strings.
3. Overview: cached snapshot, then fresh stats. Topic lines use `lib/topics.ts` when `topicTimeline` is enabled. “Insights” uses `lib/summarize.ts` when `summarize` is enabled.

## Observability

All of this stays on device. `lib/otel.ts` records durations in an array. `lib/errorTracking.ts` logs through `logger`. There is no Sentry (or other) client in `package.json`.

## Security boundaries

See `SECURITY.md` and `THREAT_MODEL.md`. Short version: CSP is set; FS reads are limited to Downloads and Documents; SQL values go through bound parameters and `lib/validation.ts`; the database file is plaintext; the app does not evaluate plugin files.

## Tests and CI

- Vitest. Desktop environment is jsdom. Core environment is node.
- `db.integration.test.ts` stubs `@tauri-apps/plugin-sql` with `FakeDB`. It does not link SQLite.
- CI jobs: lint/typecheck/test/coverage/size-limit/audit, rust check + deny, gitleaks, SBOM attempt, the Playwright smoke file, and a debug Tauri build without a bundle. `cargo clippy` is allowed to fail the step without failing the job (`|| echo`). `cargo audit` is not a step.
- `.nvmrc` is Node 22, matching CI. The devcontainer and `Dockerfile.dev` install Node 20.

## Size

There is no automated line-count gate.
