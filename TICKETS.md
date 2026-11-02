# Memex — product notes

This file was a scored backlog (epics T-001 and up, with checkboxes and coverage targets). Many of those tasks are already in the tree, and many of the “current gap” lines were written against an older snapshot (for example “Gemini unavailable”, “no CSP”, “coverage 16%”, “62 tests”). The checkboxes are not kept in sync. Use this page, `README.md`, and the code.

Git history still has the old ticket text if you need the original wording.

## Behavior that matches the code

- Lint, format, typecheck, and Vitest for `apps/desktop` and `packages/core`. Desktop coverage thresholds are 70/60/70/70 in `vite.config.ts`. CI runs those checks (`.github/workflows/ci.yml`).
- Structured logger (`lib/logger.ts`) and DB helpers split under `apps/desktop/src/db/` (`connection`, `migrations`, `queries`, `search`, `searchQueryBuilder`, `dashboard`, `dashboardCache`, `dashboardSnapshot`).
- Importers for Claude, ChatGPT, Gemini, and Grok.
- Input checks in `lib/validation.ts` and `lib/schemas.ts`.
- FTS5 `bm25()` ranking in `buildRankedRowsSql` (weights `1.0, 5.0, 0.0, 0.0`). `searchQueryBuilder.bm25.test.ts` checks order on a small SQLite fixture.
- Local diagnostics and a React error boundary. Errors are logged locally.
- Source labels and icons go through `lib/sourceDisplay.tsx`.
- Overview heatmap from `getActivityHeatmapTimeline`.
- `db.integration.test.ts` uses an in-memory `FakeDB`. It does not open a SQLite file. CI still runs that file as its own step.
- Root install is `npm ci` (workspaces). Per-package `npm ci` is what the devcontainer and `Dockerfile.dev` still run.

## Removed (were stubs)

- XOR helpers `crypto.rs` / `lib/crypto.ts`, and the `encrypted` field on `get_diagnostics`.
- `plugins/sandbox.ts` and disk evaluation inside `loadPlugins()` (the function now returns 0).
- `semanticSearch` and `vector` flags, the Search Hybrid toggle, `lib/vector.ts`, `vector.rs`, `messages_vec`, and `workers/search.worker.ts`.

## Still easy to over-read

- **Summaries.** `summarize.ts` picks sentences by word frequency. The settings flag is `summarize`.
- **Metrics.** `lib/otel.ts` is an in-process histogram.

## Explicitly not in the product

- At-rest encryption, Stronghold, `age`, SQLCipher.
- A sandbox that can safely evaluate third-party JS.
- `sqlite-vec` / ONNX semantic search.
- Zip slip handling. `importer.ts` reads a user-selected text file via `readTextFile`. It does not open zip archives.
- `fast-check` anywhere in the repo.
- `cargo audit` and Trivy in CI. `cargo deny` and gitleaks do run. CycloneDX failure does not fail the job.
- Signed Tauri bundles. `release.yml` builds the Vite `dist` and runs `cargo check`.
- A second human author, a release cadence, or a published docs site. Those were process wishes in the old backlog, not code.

## Old ticket ids

T-001 through T-133 were a plan for lint, tests, CI, file splits, a devcontainer, Dependabot, changelog, coverage, and diagnostics. Treat a green checkbox in an old revision as a claim about that revision only. In particular:

- T-013’s text says Gemini import throws because it is unavailable. `IMPORT_SOURCES` marks Gemini and Grok available.
- T-080 through T-133 were left unchecked in the old file even after coverage gates, diagnostics, and source-display helpers landed.
- Line counts quoted there (`App.tsx` 486, `SearchPage` 483, “no file over 500”) do not match the tree. `db/search.ts` is over 500 lines. `App.tsx` is under 300.
