# Memex — Next Tier Analysis (81.83% → 90, DataFactor 74→85+)

> **Current:** `81.83%` lines `79.6%` branches `209` desktop tests `38` spec files `0` vuln `4` tags `v0.4.0` `ARCHITECTURE.md:1` `cargo audit` in CI. **Estimated local DataFactor ~80 B** (was 67 C). Remote still 67 until `git push`.

## What "next tier" means

- **80–85 (B+):** 85% coverage, `App.tsx` <300 LOC, E2E + performance budgets, 2+ authors, monthly releases.
- **85–90 (A-):** Semantic search, multi-source importers, encryption, offline LLM, plugin API — each as mineable commits with tests.
- **90+ (A):** Sustained 6-month history, 100+ mineable tasks, enterprise hardening (signed builds, SAST, SBOM).

Buyers weigh: *"Can this be mined into 10–50 self-contained tasks?"*  A flat snapshot pays less than a living product. Next tier = living product.

---

## Deep audit — remaining gaps (file:line)

| Dim | Now | Evidence | Gap to 90 |
|-----|-----|----------|-----------|
| **A Architecture 72→85** | `App.tsx:489` still god-orchestrator (486→489 after smoke, just under 500 but 9 hooks, 4 refs, 3 memos). `db/queries.ts:31%` 347 LOC, `dashboard.ts:16→~70%` after 6 tests but `buildDashboardSnapshot` still 212 LOC single function. No Tauri command for `getDiagnostics` (only lib, not exposed). No worker for FTS, no virtualized list (`SearchResultsList` renders 50 DOM nodes). | Split `App.tsx` → `App.providers.tsx` + `App.shell.tsx` + `App.search.tsx`; extract `dashboard.ts` `buildSnapshot` into `stats.ts`/`activity.ts`; expose `diagnostics` via Tauri `invoke("get_diagnostics")`; add `Comlink` worker for search. |
| **B Coverage 81.83→90** | `App.tsx` now `~80%` via `App.test.tsx:1` smoke (2 tests), `SearchPage.tsx:72%`, `SearchResultsList.tsx:99%`, `hooks/* 85%`, but `AppSelect.tsx:34%` 231 LOC, `ClearDataConfirmDialog.tsx:100%` now, `main.tsx:0%` 10 LOC, `usePrefersReducedMotion:100%` now, but `db/queries.ts` still `31→~55%` after 7 new tests, `dashboard.ts` `~70%`. Branches `79.6%` just above `60` gate but `search.ts:84%` and `queries.ts:46%` drag. | Add `main.test.tsx` (Tauri `createRoot` smoke), `AppSelect.test.tsx` (keyboard nav, 231 LOC), `queries.test.ts` for `clearAllData` busy-retry and `getActivity*` (needs `better-sqlite3` file DB). Target `85%` lines `85%` branches. |
| **C Cleanliness 82→88** | `eslint 9.39.5` flat, `prettier` green, `0` files >500, DRY done, but `eslint` 10 blocked (TS7), `AppSelect.tsx` 231 LOC complex, `SearchPage.tsx:483` still large. | Migrate to `eslint 10` + `typescript-eslint 8` with `TS 6` shim (tracked `NEXT-01`), split `AppSelect.tsx` → `AppSelect.base.tsx` + `AppSelect.hooks.tsx`, add `knip` for dead-code. |
| **F Docs 88→92** | `README.md:40` Observability table, `ARCHITECTURE.md:1` 80 lines diagram, `CHANGELOG.md:10` 0.4.0, `TICKETS.md:763` roadmap, but no `docs/` site, no Storybook, no screenshots/GIF, no `CONTRIBUTING` devcontainer test. | Add `docs/search.md` + `docs/importers.md` (add `gemini`/`grok` guides), Storybook for `AppShell`/`OverviewMemoryPulse`, `README` GIF of heatmap + search. |
| **I Security 75→85** | `validation.ts:100%` at DB boundary, `npm audit 0`, `cargo audit` non-blocking, `.env` ignored, but no CSP in `tauri.conf.json`, no `tauri-plugin-fs` allowlist hardening, `importer.ts:75%` uncovered zip traversal `133-147`, no SAST (`gitleaks`, `trivy`). | Harden `tauri.conf.json: `csp: "default-src 'self'"`, `capabilities/default.json` `fs:allowReadFile` scoped to `$HOME/Downloads`, add `gitleaks` + `cargo deny` to CI, fuzz `importer.ts` with `fast-check`. |
| **E Dependency Health 68→80** | Safe batch `c1addec` landed `react 19.2.8`, `tailwind 4.3.3`, `tauri 2.11`, `lucide 1.37`, `globals 17`, `jest-dom 7` (11 PRs closed). **7 blocked majors** remain: `eslint 10`, `vite 8`, `vitest 4`, `jsdom 30`, `TS 7`, `plugin-react 6`, `react-hooks 7` — each needs migration (TS7 needs `moduleResolution: bundler` + `typescript-eslint` support for TS7 tracked #10940). | Create `NEXT-01` eslint10+TS7, `NEXT-02` vite8+vitest4, `NEXT-03` TS7+jsdom30 for `packages/core`. Do one per week, each as PR with `npm run test -- --coverage` green. |
| **H CI 87→92** | `ci.yml:60` lint/typecheck/test/coverage(70/60)/audit + `rust-check` `cargo check/clippy/audit`, but no `cargo deny`, no `qodana`/`sonar`, no `size-limit`, no `tauri build` smoke, no `dependabot automerge` for patch. | Add `cargo deny check advisories licenses`, `size-limit` `300kB` for `dist`, `tauri build --debug` smoke on PR, `dependabot automerge` `patch` with `gh pr merge --auto`. |
| **K History 58→70** | `31` commits ahead of `origin/main`, `4` tags, `100%` conventional, but `1` author, `~202d` span short, no releases on GitHub. | `git push origin main --tags` + `gh release create v0.4.0 --notes-from CHANGELOG.md:10`, invite co-author for `2` humans, do `2–4` commits/week for 2 months. |

---

## Feature roadmap to next tier (each = 1 mineable PR with test)

**Tier 1 — 80→85 (4 weeks, ~+5 pts, unlocks ~$150-250)**

1. **Gemini + Grok importers** `packages/core/src/importers/gemini.test.ts:1` + `grok.test.ts:1` (reuse `parseClaude` pattern, 8 tests each, fixtures in `packages/core/fixtures/`). Closes buyer "only 2 sources" and adds `IMPORT_SOURCES` `available: true`. *Acceptance:* `npm run test --prefix packages/core` 33 tests, `IMPORT_SOURCES` 4/4 available, `ImporterPage` shows no "Coming soon".

2. **Encrypted at-rest** `src-tauri/src/crypto.rs:1` `age` or `SQLITE_HAS_CODEC` — key in OS keychain via `tauri-plugin-stronghold`, migration `migrations.ts:111` adds `PRAGMA key`. *Acceptance:* `cargo test` for round-trip, `diagnostics.ts` exposes `encrypted: boolean`.

3. **Virtualized search list** `SearchResultsList.tsx:79` → `react-virtuoso` or `tanstack-virtual` for 50→1000 results. *Acceptance:* `SearchResultsList.test.tsx` still 5 tests, `npm run test -- --coverage` no drop, perf `SearchPage` renders 1000 in <100ms.

4. **E2E smoke** `e2e/smoke.spec.ts:1` Playwright `tauri-driver` — launch, import `fixtures/claude.json`, assert `OverviewPage` `2 conversations` and `SearchPage` finds `hello`. *Acceptance:* `ci.yml` new job `e2e` runs on `ubuntu-latest`.

**Tier 2 — 85→90 (6 weeks, ~+5 pts, unlocks ~$300-500)**

5. **Vector/semantic search** `src-tauri/src/vector.rs:1` `sqlite-vec` or `onnx` embeddings (local `all-MiniLM`), new table `messages_vec`, `search.ts` hybrid `FTS + KNN` + `searchMessages` `mode: "hybrid"`. *Acceptance:* `db.integration.test.ts` asserts `searchMessages("vacation", {mode:"semantic"})` finds paraphrase.

6. **Offline LLM summarize** `src/lib/summarize.ts:1` `tauri-plugin-llm` or `WebLLM` — summarize conversation into 3 bullets, cached in `dashboard_cache`. *Acceptance:* `OverviewPage` shows "Insights" real data, `lib/summarize.test.ts` mocked LLM.

7. **Plugin API** `src/plugins/registry.ts:1` `IMPORT_SOURCES` extensible via `tauri-plugin-fs` `~/.memex/plugins/*.js` (CommonJS, `registerImporter`). *Acceptance:* `docs/plugins.md` + `packages/core` plugin example, `importer.test.ts` for custom source.

8. **Advanced analytics** `OverviewMemoryPulse.tsx:339` → `Activity` + `topic-timeline` (simple TF-IDF top terms per month). *Acceptance:* `OverviewMemoryPulse` shows "Top topics: React, Rust".

**Tier 3 — 90+ (ongoing, history)**

9. **Perf budgets + observability** `perf/budgets.json` `300kB` + `lib/logger.ts` `OTEL` span for `searchMessages` latency, `diagnostics.ts` `p95`.

10. **Signed builds + SBOM** `tauri.conf.json` `bundle` signing, `cargo cyclonedx` SBOM in CI, `SECURITY.md` `threat-model.md`.

---

## Mechanism roadmap (engineering excellence)

- **Feature flags** `src/lib/flags.ts:1` `localStorage` `flags: {semanticSearch, vector}` gated rollout, `flags.test.ts`.
- **Release automation** `.github/workflows/release.yml:1` `cargo-release` + `npm version` + `gh release` on tag, `CHANGELOG` auto.
- **Size + a11y gates** `ci.yml` `size-limit` + `axe` `AppShell.test.tsx` a11y check.
- **Dependabot automerge** `.github/dependabot.yml` `automerge: patch` for `npm` + `cargo` (already weekly, add `gh pr merge --auto`).

---

## Dependabot — all 18 PRs handled

- **11 closed as fixed via `c1addec` safe batch** (#7 checkout 4→7, #8 cache 4→6, #9 setup-node 4→7, #12 sql 2.3→2.4, #14 fs 2.4→2.5, #15 serde 1.0.228→1.0.229, #17 group 13 updates (react 19.2.8, tailwind 4.3.3, tauri 2.11...), #18 globals 17, #19 jest-dom 7, #23 lucide 1.37, #10 serde_json 1.0.151).
- **7 blocked majors tracked as NEXT tickets** (not merged to keep `lint`/`typecheck` green):
  - `NEXT-01` eslint 9→10 (`#24` + `#21` + `#20` react-hooks 5→7) — blocked by `typescript-eslint` TS7 support #10940, needs `TS 6` shim. Do after `TS 7` migr.
  - `NEXT-02` vite 7→8 + `plugin-react` 4→6 + `vitest` 3→4 + `coverage 3→4` + `jsdom 26→30` (`#22`, `#16`, `#13` core) — tested in branch `TS 7` + `vite 8` passes `test` but `lint` needs `TS 6`. Do as one PR with `npm run test -- --coverage` 81→82% check.
  - `NEXT-03` `typescript 5.9→7.0` + `jsdom 30` (`#11`, `#13`, `#16`) — tested `packages/core` with `moduleResolution: bundler` passes `typecheck`/`test` but desktop `lint` fails with `typescript-eslint` TS7. Tracked.

**Verification after batch:** `npm run lint 0 errors`, `npm run typecheck 0`, `npm run test 209/209`, `coverage 81.83%` `70/60` gate green, `cargo check` green (deps `0.4.0` aligned).

---

## Immediate next steps (in order, 1 PR = 1 ticket)

1. `git push origin main --tags` + `gh release create v0.4.0` (unblocks `K` + `task capacity` remote).
2. `test(app): AppSelect + main smoke` (covers `34%` → `80%`, `0%` → `60%`).
3. `feat(importers): gemini + grok` (2 PRs, each with `*.test.ts` + fixture).
4. `NEXT-03` `typescript 7` migration (update `tsconfig.json:5` `moduleResolution: bundler` + `typescript-eslint` shim).
5. Re-score at `datafactor.com/score` — expect `~80` B+ after push, `85` after Tier 1.

*Each PR must keep `npm run lint && npm run test -- --coverage` green.*
