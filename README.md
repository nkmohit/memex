# Memex

Memex is a desktop archive for AI chat exports. It imports JSON exports, stores them in a local SQLite file, and searches them with FTS5.

Built with React 19, Vite 8, Tauri 2, and SQLite FTS5.

## What it does

- Import JSON exports for Claude, ChatGPT, Gemini, and Grok (`packages/core/src/importers/`, `apps/desktop/src/importer.ts`). All four sources are `available: true`.
- Full-text search over messages (`messages_fts`). `normalizeQuery` lowercases tokens and searches each one as an FTS5 prefix (`term*`), so a trailing `*` in the query box is optional.
- Group matches by conversation, with source and date filters and several sort orders (`apps/desktop/src/db/search.ts`).
- Snippets from SQLite `snippet()`, rendered as React text (not HTML) in `SearchResultsList`.
- In-conversation find via `useViewerSearch` (`highlightText` wraps matches in `<mark>`).
- Overview counts, per-source totals, and a daily activity heatmap (`db/queries.ts`, `OverviewMemoryPulse`).
- Light, dark, and system theme, stored in `localStorage` (`useThemeMode`).
- Local extractive summary: up to three sentences scored by word frequency (`lib/summarize.ts`). This is not an LLM.
- Local TF-IDF term lists, including a per-month timeline, behind the `topicTimeline` flag (`lib/topics.ts`).
- In-process search-latency histogram (`lib/otel.ts`, `lib/logger.ts`). Nothing is exported off the machine.
- Caught React errors logged locally (`lib/errorTracking.ts`, `ErrorBoundary`). No outbound reporter.

Search ranking is a per-conversation term-count: more case-insensitive occurrences of the raw query string produce a lower `rank`, and a title `LIKE` match subtracts 5. Sort `relevance` orders by that value ascending. This is not SQLite FTS5 `bm25()`.

Data stays in `memex.db` on the machine. The app does not ship an account system or a network telemetry client.

## Not implemented

These names show up in code or older docs. They are not the features they sound like:

- **Encryption.** `src-tauri/src/crypto.rs` and `src/lib/crypto.ts` XOR bytes with a repeating key. The database is opened as plaintext. There is no OS keychain, `age`, or SQLCipher `PRAGMA key`.
- **Plugin sandbox.** `plugins/sandbox.ts` rejects source text that matches a regex denylist. `loadPlugins()` would then run the file with `new Function`. The app never calls `loadPlugins()`, and `capabilities/default.json` does not allow reading `~/.memex/plugins`. See `docs/plugins.md`.
- **Semantic / vector search.** `lib/vector.ts` and `src-tauri/src/vector.rs` hash tokens into 64 buckets and boost a hard-coded synonym list (`vacation`/`holiday`, and similar). `messages_vec` stores that JSON. `CREATE VIRTUAL TABLE ... vec0` is attempted and ignored when the extension is missing. `sqlite-vec` is not a dependency. The Search page "Hybrid" toggle runs this scorer when the `semanticSearch` flag is on.
- **Signed updater bundles, SBOM as a release gate, Trivy, `cargo audit`, zip-import hardening, `fast-check` fuzzing.** See `SECURITY.md`.

`FUTURE.md` lists ideas that are not in the product.

## Architecture

- **Frontend:** React 19, Vite 8, Tailwind CSS 4, `lucide-react` plus custom LLM icons.
- **Desktop:** Tauri 2 (`apps/desktop/src-tauri`). `tauri.conf.json` `version` is `0.6.0`. `apps/desktop/package.json` and `src-tauri/Cargo.toml` are `0.8.0`.
- **Database:** SQLite via `@tauri-apps/plugin-sql`. Schema and FTS setup live in `apps/desktop/src/db/migrations.ts`.
- **Parsers:** `packages/core` (`@memex/core`), built with `tsc` before the desktop app imports it.
- **Validation:** `lib/validation.ts` (`sanitizeSource`, `clampLimit`, `clampOffset`, sort and date checks) and Zod schemas in `lib/schemas.ts`.
- **Logging:** `lib/logger.ts`. `debug` prints when `TAURI_DEBUG=true`.

### Local diagnostics

| Signal | Where |
| --- | --- |
| Conversation and message counts, indexed message count | `db/queries.ts` `getStats`, surfaced by `lib/diagnostics.ts` |
| Index health (`indexedPct`, `missing` when messages exist and the FTS count is 0) | `computeIndexHealth` |
| Per-source counts and last activity | `getSourceStats` |
| Daily activity | `getActivityHeatmapTimeline` |
| Search latency samples and an in-process p95 | `lib/logger.ts` spans and `lib/otel.ts` |
| Errors | `reportError` writes `logger.error` only |

`getDiagnosticsViaInvoke` calls the Tauri command `get_diagnostics`, which returns the Cargo package version, `encrypted` from the XOR helper's `MEMEX_ENCRYPTED` env check, and `generated_at: 0`. Outside Tauri it returns version `0.8.0` and `encrypted: false`.

## Database (simplified)

**conversations:** `id`, `source`, `title`, `created_at`, `updated_at`, `message_count`

**messages:** `id`, `conversation_id`, `sender`, `content`, `created_at`

**messages_fts** (FTS5): `content`, `title`, `conversation_id` UNINDEXED, `message_id` UNINDEXED

**messages_vec:** `message_id`, `conversation_id`, `embedding` (JSON from the hash embedder above)

**app_meta** and **dashboard_cache:** data version and cached overview payload

## Getting started

CI and `.nvmrc` use Node 22. `.devcontainer/devcontainer.json` and `apps/desktop/Dockerfile.dev` still install Node 20. Rust stable and the usual Tauri system libraries are required for `tauri dev` / `tauri build`.

Install from the repo root. `npm ci` inside a single workspace removes the other workspace's `node_modules`.

```bash
npm ci
npm run build --prefix packages/core

cp apps/desktop/.env.example apps/desktop/.env
# TAURI_DEV_HOST: set a LAN IP only if the dev server must be reachable off localhost

npm run lint --prefix apps/desktop
npm run format:check --prefix apps/desktop
npm run typecheck --prefix apps/desktop
npm run test --prefix apps/desktop
npm run test --prefix packages/core
npm run build --prefix apps/desktop

cd apps/desktop
npm run tauri dev   # Vite + Tauri
npm run dev         # frontend only
```

## Quality checks

- Desktop: ESLint, Prettier, `tsc --noEmit`, Vitest (jsdom, Testing Library). Coverage thresholds in `apps/desktop/vite.config.ts` are lines 70, branches 60, functions 70, statements 70.
- Core: ESLint, `tsc --noEmit`, Vitest (node).
- `npm audit --audit-level=high` from the workspace root.
- CI workflow: `.github/workflows/ci.yml` (see `SECURITY.md` for which security tools actually run).
- Bundle size: `size-limit` on gzipped `dist/assets` JS (500 kB) and CSS (100 kB), after `npm run build` in `apps/desktop`.

## Contributing

`CONTRIBUTING.md`. Commits use Conventional Commits. `CHANGELOG.md` records releases. The `[Unreleased]` note there corrects older entries that called the ranker BM25 or the hash embedder semantic search.
