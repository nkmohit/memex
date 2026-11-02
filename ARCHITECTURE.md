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
  - `migrations.ts` — pragmas, tables, FTS5, backfill when messages exist and `messages_fts` is empty. Also creates `messages_vec` and tries `vec0` (that statement fails closed when the extension is absent)
  - `queries.ts` — stats, source stats, conversations, messages, clear
  - `search.ts` — `searchMessages`. Default path is FTS. `mode: "semantic" | "hybrid"` scores rows with `lib/vector.ts` (hash + synonym list), optionally after a `vec_messages` query that only runs when `MEMEX_VEC=1`
  - `searchQueryBuilder.ts` — SQL fragments. Conversation `rank` is `(-1 * summed raw-query occurrences) + title LIKE boost (-5 or 0)`, not `bm25()`
  - `dashboard.ts`, `dashboardCache.ts`, `dashboardSnapshot.ts`
  - `types.ts`, `helpers.ts` — `normalizeQuery` appends `*` to each token

- **Parsers** `packages/core/src/importers/` — `parseClaudeConversations`, `parseChatGPTConversations`, `parseGeminiConversations`, `parseGrokConversations`. The desktop app depends on the built package `@memex/core`.

- **Hooks** `apps/desktop/src/hooks/` — data load, import, viewer find-in-conversation, theme, toasts, search session.

- **UI** — `AppShell` routes overview, import, search, conversations, and settings, wrapped in `ErrorBoundary`. Search results set `content-visibility: auto` on rows; they are not virtualized by a windowing library. Settings exposes feature flags stored in `localStorage` (`lib/flags.ts`).

- **Plugins** — `plugins/registry.ts` keeps an in-memory importer map. `loadPlugins()` can read `~/.memex/plugins/*.js` and evaluate them after `plugins/sandbox.ts` regex checks. No UI module calls `loadPlugins()`.

- **Rust** — `src-tauri/src/lib.rs` registers SQL, opener, dialog, and FS plugins, plus `get_diagnostics`. `crypto.rs` is the XOR helper used by that command. `vector.rs` duplicates the JS hash embedder and is not called from `search.ts` (the UI path uses the JS module).

## Data flow

1. Import: dialog `open` → `readTextFile` → parser → `dbInsert.ts` → `markDataChanged()` increments `data_version`. Insert also writes `messages_vec` JSON from `embed()`.
2. Search: `normalizeQuery` → FTS `MATCH` → grouped rows and up to three `snippet()` strings. Semantic mode loads message text and scores it in-process (or via `workers/search.worker.ts` when `Worker` exists).
3. Overview: cached snapshot, then fresh stats. Topic lines use `lib/topics.ts` when `topicTimeline` is enabled. “Insights” uses `lib/summarize.ts` when `summarize` is enabled.

## Observability

All of this stays on device. `lib/otel.ts` records durations in an array. `lib/errorTracking.ts` logs through `logger`. There is no Sentry (or other) client in `package.json`.

## Security boundaries

See `SECURITY.md` and `THREAT_MODEL.md`. Short version: CSP is set; FS reads are limited to Downloads and Documents; SQL values go through bound parameters and `lib/validation.ts`; the database file is not encrypted; plugin evaluation is not a sandbox and is not wired up.

## Tests and CI

- Vitest. Desktop environment is jsdom. Core environment is node.
- `db.integration.test.ts` stubs `@tauri-apps/plugin-sql` with `FakeDB`. It does not link SQLite.
- CI jobs: lint/typecheck/test/coverage/size-limit/audit, rust check + deny, gitleaks, SBOM attempt, the Playwright smoke file, and a debug Tauri build without a bundle. `cargo clippy` is allowed to fail the step without failing the job (`|| echo`). `cargo audit` is not a step.
- `.nvmrc` is Node 22, matching CI. The devcontainer and `Dockerfile.dev` install Node 20.

## Size

There is no automated line-count gate. `apps/desktop/src/db/search.ts` is over 500 lines because the FTS path and the semantic/hybrid path both live there.
