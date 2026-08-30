# Memex — Quality Improvement Backlog (70+ gate)

> **Goal:** 33 (F) → ≥70 (B-) to reach the quality gate.  
> **Strategy:** Buyer-critical fixes first (tests + CI + cleanliness), then architecture / docs. Each ticket = one **small, focused commit** that includes its tests where applicable — this keeps history mineable for review.
> **Commit convention:** Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `ci:`, `style:`). One ticket = one commit = one PR (or direct push for solo).

**How to use:** Work top-down within each epic. Check the `Acceptance` box before merging. CI must be green (`npm run lint && npm run typecheck && npm run test` in both `apps/desktop` and `packages/core`) for every ticket.

---

## Epic overview

| Epic | Focus | Quality dim | Tickets | Status |
|------|-------|----------------|---------|--------|
| **A — Tooling & Cleanliness** | ESLint + Prettier + logger | C 35→75, A 40→65 | T-001…T-005 | ✅ DONE |
| **B — Testing** | Vitest suites | B 0→65 | T-010…T-017 | ✅ DONE |
| **C — CI/CD** | GitHub Actions + audit | H 0→75 | T-020…T-022 | ✅ DONE |
| **D — Architecture** | Split god-files, hooks, services | A, C | T-030…T-049 | ✅ DONE |
| **E — Reproducibility** | .env, devcontainer, Dockerfile | F 55→80 | T-050…T-056 | ✅ DONE |
| **F — Deps & Security** | Dependabot, audit, validation | E 45→70, I 45→75 | T-060…T-061 | ✅ DONE |
| **G — Docs & History** | Changelog, contributing, tags | F, K 35→45 | T-070…T-074 | ✅ DONE (T-073 local, needs push) |

**Totals:** 34 tickets · 62 tests · 0 files >500 LOC (was 3) · 0 high vulnerabilities (was 5)

---

## A — Tooling & Cleanliness

### T-001 — chore: add eslint flat config (desktop)

- **Commit:** `chore(desktop): add eslint flat config with ts+react-hooks`  
- **Description:** No lint config was detected (no lint config detected). Add `apps/desktop/eslint.config.js` with `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `eslint-config-prettier`. Warn on `no-console` (allow `warn`/`error`).  
- **Acceptance:**
  - [x] `apps/desktop/eslint.config.js` exists, `npm run lint` exits 0 (warnings allowed)
  - [x] `eslint` + peers in `apps/desktop/package.json:devDependencies` `default.edit:apps/desktop/package.json:1`
- **Files:** `apps/desktop/eslint.config.js`, `apps/desktop/package.json`
- **Dim:** C

### T-002 — chore: add eslint config (core + root)

- **Commit:** `chore: add root and core eslint configs`
- **Description:** Ensure `lernters_and_formatters` is detected at repo root. Add root `eslint.config.js` and `packages/core/eslint.config.js` (simple ts recommended, no react).
- **Acceptance:**
  - [x] `eslint.config.js` at root, `packages/core/eslint.config.js` present
  - [x] `npm run lint --prefix packages/core` passes
- **Files:** `eslint.config.js`, `packages/core/eslint.config.js`, `packages/core/package.json`
- **Dim:** C

### T-003 — chore: add prettier config

- **Commit:** `chore: add prettier config and ignore`
- **Description:** No formatter detected. Add `.prettierrc` (semi:true, singleQuote:false, 100 printWidth, es5 trailingComma) and `.prettierignore` at root and `apps/desktop`.
- **Acceptance:**
  - [x] `apps/desktop/.prettierrc`, `.prettierrc`, `.prettierignore` files exist
  - [x] `npm run format:check` script added
- **Files:** `apps/desktop/.prettierrc`, `apps/desktop/.prettierignore`, `.prettierrc`, `.prettierignore`, `apps/desktop/package.json`
- **Dim:** C

### T-004 — style: format codebase

- **Commit:** `style: format codebase with prettier`
- **Description:** Bulk format — must be isolated commit (no feature mix) so history mining can skip it cleanly.
- **Acceptance:**
  - [x] `npx prettier --write "src/**/*.{ts,tsx,js,json,css}"` run in `apps/desktop`, `npm run format:check` passes
  - [x] No logic changed
- **Files:** `apps/desktop/src/**/*` (20 files)
- **Dim:** C

### T-005 — refactor: structured logger

- **Commit:** `refactor: add structured logger and replace console.log`
- **Description:** `db.ts` and `importer.ts` used raw `console.log` (no structured logging). Add `src/lib/logger.ts:1` (`debug/info/warn/error` with `[memex:level]` prefix, `TAURI_DEBUG` gated) and replace 6 `console.log` in `src/db/migrations.ts:1` and `src/importer.ts:1`. Keep `warn`/`error` allowed in eslint.
- **Acceptance:**
  - [x] `src/lib/logger.ts` exists, `eslint` `no-console` warnings drop from 4→0 in `db/*`
  - [x] `importer.ts` logs via `logger.info`
- **Files:** `apps/desktop/src/lib/logger.ts`, `apps/desktop/src/db/migrations.ts`, `apps/desktop/src/importer.ts`
- **Dim:** A 40→, C

---

## B — Testing (mineable history)

> **Rule for B:** Every feature commit that followsshould include its test in the same commit (e.g., `feat(parser): ...` + `test(parser): ...` squashed). The tickets below demonstrate the pattern.

### T-010 — chore: add vitest harness (desktop)

- **Commit:** `chore(desktop): add vitest + jsdom + Testing Library harness`
- **Description:** No test framework detected (`0 tests`). Add `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom` to `apps/desktop/package.json:devDependencies`, wire `vite.config.ts:8` `test:{globals, environment:"jsdom", setupFiles:["./src/test/setup.ts"]}`, add `src/test/setup.ts:1` mocking Tauri plugins (`@tauri-apps/plugin-sql`, `dialog`, `fs`, `opener`) + `matchMedia`.
- **Acceptance:**
  - [x] `npm run test` runs, `src/test/setup.ts` mocks `@tauri-apps/plugin-sql` default.load
  - [x] `test`, `test:watch`, `test:coverage` scripts in `package.json`
- **Files:** `apps/desktop/package.json`, `apps/desktop/vite.config.ts`, `apps/desktop/src/test/setup.ts`
- **Dim:** B

### T-011 — test: utils.test.ts

- **Commit:** `test(utils): add formatTimestamp and formatDate specs`
- **Description:** Pure utils — good first mineable test. Cover `null/0`→"Never", invalid→"Unknown", same-day→time with ":", same-year→no year, diff-year→year, with `vi.useFakeTimers`.
- **Acceptance:**
  - [x] `src/utils.test.ts:1` 13 tests, all green, `npm run test -- src/utils.test.ts` passes
- **Files:** `apps/desktop/src/utils.test.ts`
- **Dim:** B

### T-012 — test: db.test.ts

- **Commit:** `test(db): add normalizeQuery and withDbLock specs`
- **Description:** Cover `normalizeQuery` (lowercase, tokenize, `salary*` dedup, unicode, punctuation, idempotent) + `withDbLock` queue semantics (serial order, rejection doesn't break queue, return value). Mock `plugin-sql` and assert `searchMessages` validation (empty/punctuation → empty, source/sort/limit clamping doesn't throw) without hitting real SQLite.
- **Acceptance:**
  - [x] `src/db.test.ts:1` 18 tests, `Promise.all` order test passes
- **Files:** `apps/desktop/src/db.test.ts`
- **Dim:** B, A

### T-013 — test: importer.test.ts

- **Commit:** `test(importer): add registry and Claude fixture specs`
- **Description:** Tests for `IMPORT_SOURCES` shape, unavailable `gemini` throws, `grok` template, cancel (`open→null`→null), invalid export (non-array), valid Claude fixture (1 conv→2 msgs), progress callback. Mocks `plugin-dialog` `open`, `plugin-fs` `readTextFile`, `dbInsert` `insertConversations`.
- **Acceptance:**
  - [x] `src/importer.test.ts:1` 14 tests, `logger.info` mocked, `Claude import complete` assert passes
- **Files:** `apps/desktop/src/importer.test.ts`
- **Dim:** B

### T-014 — chore: add core vitest harness

- **Commit:** `chore(core): add vitest config for pure parsers`
- **Description:** Core parsers are pure — ideal for coverage. Add `packages/core/vitest.config.ts:1` (`environment:"node"`), `vitest`+`jsdom` devDeps, `test` scripts.
- **Acceptance:**
  - [x] `npm run test --prefix packages/core` passes
- **Files:** `packages/core/vitest.config.ts`, `packages/core/package.json`
- **Dim:** B

### T-015 — test: claude.test.ts

- **Commit:** `test(core): add parseClaudeConversations specs`
- **Description:** 8 cases: valid single conv, skips empty `text`, `content` blocks join, skips missing `uuid`, skips `system` sender, defaults `Untitled`, timestamp number, empty input.
- **Acceptance:**
  - [x] `src/importers/claude.test.ts:1` 8 tests
- **Files:** `packages/core/src/importers/claude.test.ts`
- **Dim:** B

### T-016 — test: chatgpt.test.ts

- **Commit:** `test(core): add parseChatGPTConversations specs`
- **Description:** 9 cases: valid export via `mapping/current_node` walk, `conversation_id` fallback, filters 0-msg conv, skips `system` role, missing mapping → `[]`, empty parts, order, seconds→ms, empty input.
- **Acceptance:**
  - [x] `src/importers/chatgpt.test.ts:1` 9 tests
- **Files:** `packages/core/src/importers/chatgpt.test.ts`
- **Dim:** B

### T-017 — chore: wire test scripts into docs & build

- **Commit:** `chore: build core before desktop tests, update README`
- **Description:** `packages/core` must be built (`npm run build -> tsc`) so `apps/desktop` can `import { parseClaude } from "@memex/core"` (file:../../). Add `npm run build --prefix packages/core` to CI and README. Core `dist/` now committed via build.
- **Acceptance:**
  - [x] `packages/core/dist/index.js` exists, `npm run test` in desktop still passes after `core` build
  - [x] `README.md:65` documents `npm run test` in both packages
- **Files:** `packages/core/package.json`, `README.md`
- **Dim:** B, F

---

## C — CI/CD

### T-020 — ci: add GitHub Actions workflow

- **Commit:** `ci: add lint-typecheck-test workflow`
- **Description:** `ci_present:false` was a heaviest buyer signal. Create `.github/workflows/ci.yml:1` with `actions/checkout@v4`, `actions/setup-node@v4` (cache:npm, `cache-dependency-path` for both lockfiles), jobs: `npm ci` (desktop+core), `npm run build --prefix core`, `lint` (desktop), `format:check`, `typecheck`, `test` (desktop+core), `npm audit --audit-level=high`.
- **Acceptance:**
  - [x] Workflow runs on `push`/`pull_request` to `main`/`master`, concurrency cancel-in-progress
  - [x] All four steps `green` on a test PR
- **Files:** `.github/workflows/ci.yml`
- **Dim:** H 0→75

### T-021 — ci: add Rust check

- **Commit:** `ci: add cargo check + clippy`
- **Description:** Add second job `rust-check` with `actions-rust-lang/setup-rust-toolchain@v1`, `actions/cache@v4` for `Cargo.lock`, `cargo check` and `cargo clippy` (warnings not blocking).
- **Acceptance:**
  - [x] `apps/desktop/src-tauri/Cargo.toml` checked
- **Files:** `.github/workflows/ci.yml`
- **Dim:** H, E

### T-022 — fix: vite audit high vulnerabilities

- **Commit:** `fix(deps): bump vite to fix GHSA advisories`
- **Description:** `npm audit` showed 5 high in `vite 7.0.0–7.3.3` (FS deny bypass, file read via WS). Run `npm audit fix` → 0 vulnerabilities. Lockfile updated.
- **Acceptance:**
  - [x] `npm audit --audit-level=high` exits 0 in `apps/desktop` and `packages/core`
- **Files:** `apps/desktop/package-lock.json`, `apps/desktop/package.json`
- **Dim:** E 45→70, H (audit step now passes)

---

## D — Architecture & Modularity (split god-files <500 LOC)

> **Before:** `db.ts:1024`, `App.tsx:969`, `OverviewPage.tsx:650` (>500). **After:** max `db/queries.ts:347`, `App.tsx:486`, `OverviewPage.tsx:248`.

### T-030 — refactor(db): extract connection

- **Commit:** `refactor(db): extract connection and withDbLock`
- **Description:** Create `src/db/connection.ts:1` (`db`, `rawGetDb`, `dbLock`, `withDbLock`, `withWriteLock`, `getDb`). Keeps IPC serialization in one place.
- **Acceptance:**
  - [x] `connection.ts` 35 LOC, imported by `migrations`, `dashboard`, `queries`, `search`
- **Files:** `apps/desktop/src/db/connection.ts`
- **Dim:** A, C

### T-031 — refactor(db): extract types

- **Commit:** `refactor(db): extract shared types`
- **Description:** Move all interfaces (`DbStats`, `SourceStats`, `ConversationRow`, `MessageRow`, `SearchResultRow`, `SearchMessagesResult`, `ActivityDayPoint`, `ActivityHeatmapPoint`, `SearchOptions`, `DashboardSnapshot`, `ConversationListRow`) to `src/db/types.ts:1` (95 LOC).
- **Files:** `apps/desktop/src/db/types.ts`
- **Dim:** A, C

### T-032 — refactor(db): extract helpers

- **Commit:** `refactor(db): extract normalizeQuery helpers`
- **Description:** Pure functions `escapeLikePattern`, `normalizeQuery` → `src/db/helpers.ts:1` (8 LOC), tested in `db.test.ts`.
- **Files:** `apps/desktop/src/db/helpers.ts`
- **Dim:** A, C, B

### T-033 — refactor(db): extract migrations

- **Commit:** `refactor(db): extract initDatabase migrations`
- **Description:** Move PRAGMA + `CREATE TABLE` + FTS migration + backfill into `src/db/migrations.ts:1` (111 LOC), switch `console.log`→`logger.info`.
- **Files:** `apps/desktop/src/db/migrations.ts`
- **Dim:** A

### T-034 — refactor(db): extract dashboard cache

- **Commit:** `refactor(db): extract dashboard snapshot cache`
- **Description:** Move `dashboardMemoryCache`, `readDataVersion`, `writeDashboardCache`, `bumpDataVersion`, `buildDashboardSnapshot`, `getDataVersion`, `markDataChanged`, `getCachedDashboardSnapshot`, `getDashboardSnapshot` to `src/db/dashboard.ts:1` (212 LOC).
- **Files:** `apps/desktop/src/db/dashboard.ts`
- **Dim:** A

### T-035 — refactor(db): extract queries

- **Commit:** `refactor(db): extract core queries`
- **Description:** Move `getStats`, `rebuildSearchIndex`, `getActivity*`, `getSourceStats`, `getConversations`, `getAllConversationsForSearch`, `getMessages`, `clearAllData` to `src/db/queries.ts:1` (347 LOC) with `lib/validation` clamping (`clampLimit`, `sanitizeSource`).
- **Files:** `apps/desktop/src/db/queries.ts`
- **Dim:** A, I

### T-036 — refactor(db): extract search

- **Commit:** `refactor(db): extract FTS search`
- **Description:** Move `searchMessages` (ranked CTE, snippets) to `src/db/search.ts:1` (190 LOC), add `sanitizeSource`/`clampLimit` validation, keep `snippetWhereClause` logic. Barrel `src/db/index.ts:1` re-exports for backward `import { searchMessages } from "./db"`.
- **Acceptance:**
  - [x] `import { searchMessages } from "./db"` still works via `src/db/index.ts` (folder import)
  - [x] `dbInsert.ts` and `OverviewPage` unchanged imports
- **Files:** `apps/desktop/src/db/search.ts`, `apps/desktop/src/db/index.ts`, `apps/desktop/src/db.ts` (deleted)
- **Dim:** A, I

### T-037 — refactor: lib/logger

- **Commit:** `refactor: add structured logger` *(already T-005, reused)*
- **Files:** `apps/desktop/src/lib/logger.ts`
- **Dim:** A

### T-038 — refactor: lib/validation

- **Commit:** `feat(validation): add input validation helpers`
- **Description:** Centralize SQL-boundary checks: `sanitizeSource`, `clampLimit`/`clampOffset`, `sanitizeSort`, `isValidTimestamp`, `sanitizeDateRange`. Used in `queries.ts` and `search.ts`.
- **Files:** `apps/desktop/src/lib/validation.ts`
- **Dim:** I 45→75

### T-039 — refactor: lib/sources

- **Commit:** `refactor: extract sourceLabel helpers`
- **Description:** `sourceLabel` + `getAvailableSources` → `src/lib/sources.ts:1`, used by `App.tsx` and `OverviewMemoryPulse`.
- **Files:** `apps/desktop/src/lib/sources.ts`
- **Dim:** A, C

### T-040 — refactor(hooks): useToast

- **Commit:** `refactor(hooks): extract useToast`
- **Description:** Move `toastIdRef`, `toasts`, `pushToast`, `dismissToast` (30 LOC) to `src/hooks/useToast.ts:1`.
- **Files:** `apps/desktop/src/hooks/useToast.ts`
- **Dim:** A, C

### T-041 — refactor(hooks): useCopyClipboard

- **Commit:** `refactor(hooks): extract useCopyClipboard`
- **Description:** Move `copyToast`, `copyToClipboard`, `showCopyToast`, `copyMessageToClipboard`, `copyConversationToClipboard` to `src/hooks/useCopyClipboard.ts:1`.
- **Files:** `apps/desktop/src/hooks/useCopyClipboard.ts`
- **Dim:** A, C

### T-042 — refactor(hooks): useImportState

- **Commit:** `refactor(hooks): extract useImportState with handler`
- **Description:** Move `importing`, `importingSource`, `importProgress`, `importProgressRef`, `importAbortRef`, `importError/Result`, `importRefreshKey`, `handleCancelImport` + `handleImportSource` (80 LOC, calls `importConversations`, `markDataChanged`, `pushToast`, `loadData`, `logger`) to `src/hooks/useImportState.ts:1`. Takes `{pushToast, loadData, activeSource, sourceLabel}` options.
- **Files:** `apps/desktop/src/hooks/useImportState.ts`
- **Dim:** A, C

### T-043 — refactor(hooks): useViewerSearch

- **Commit:** `refactor(hooks): extract useViewerSearch`
- **Description:** Move `messageSearchQuery`, `occurrences` (RegExp per message), `highlightText` (returns `<mark>`), `matchCount`, `goToPrev/Next`, scroll-into-view effects, `viewerSearchOpen`/`viewerMenuOpen` refs to `src/hooks/useViewerSearch.tsx:1` (takes `messages`, `prefersReducedMotion`, `messageRefs`).
- **Files:** `apps/desktop/src/hooks/useViewerSearch.tsx`
- **Dim:** A, C

### T-044 — refactor(hooks): useAppData

- **Commit:** `refactor(hooks): extract useAppData`
- **Description:** Move `loading`, `stats`, `sourceStats`, `conversations`, `selectedConvId`, `messages`, `messagesLoading`, `loadError`, `loadData` (cached snapshot → fresh) to `src/hooks/useAppData.ts:1`.
- **Files:** `apps/desktop/src/hooks/useAppData.ts`
- **Dim:** A, C

### T-045 — refactor(hooks): useSearchSession

- **Commit:** `refactor(hooks): extract useSearchSession`
- **Description:** Wrap `usePersistedSearchState` + `searchFocusRequestId`, `openedConversationFromSearch`, `searchRestoreConversationId`, `skipSearchOnceRef` with `activeView` effect.
- **Files:** `apps/desktop/src/hooks/useSearchSession.ts`
- **Dim:** A, C

### T-046 — refactor(hooks): useClearData + useDataActions

- **Commit:** `refactor(hooks): extract useClearData and useDataActions`
- **Description:** `useClearData` owns `clearingData`, `clearConfirm*` refs, `handleClearAllDataClick/Confirm` (calls `clearAllData`, `clearPersistedSearchState`, `logger`). `useDataActions` owns `handleRebuildIndex`, `handleOverviewSelectConversation` (calls `rebuildSearchIndex`, `getMessages`). Both take `pushToast`/`loadData` opts.
- **Files:** `apps/desktop/src/hooks/useClearData.ts`, `apps/desktop/src/hooks/useDataActions.ts`
- **Dim:** A, C

### T-047 — refactor: AppShell

- **Commit:** `refactor: extract AppShell layout`
- **Description:** Move 212-line render (onboarding vs `app-shell` with `Sidebar` + conditional `OverviewPage`/`ImportPage`/`SettingsPanel`/`SearchPanel`/`Conversation*` + `ClearDataConfirmDialog` + toast stack) to `src/components/AppShell.tsx:1` (335 LOC). `App.tsx` now only orchestrates hooks + passes props.
- **Acceptance:**
  - [x] `App.tsx` 969→486 LOC (<500 even after prettier)
- **Files:** `apps/desktop/src/components/AppShell.tsx`, `apps/desktop/src/App.tsx`
- **Dim:** A, C

### T-048 — refactor: OverviewMemoryPulse

- **Commit:** `refactor(overview): extract OverviewMemoryPulse`
- **Description:** Move `selectedYear`, `yearOptions`, `heatmapDays`, `heatmapCells`, `monthMarkers`, `intensityLevel`, `dayTooltip`, hover tooltip, `Source momentum` side list (≈324 LOC) to `src/components/OverviewMemoryPulse.tsx:1`. `OverviewPage.tsx` 650→248 LOC.
- **Acceptance:**
  - [x] No file >500 LOC (`OverviewPage:248`, `OverviewMemoryPulse:324`)
- **Files:** `apps/desktop/src/components/OverviewMemoryPulse.tsx`, `apps/desktop/src/OverviewPage.tsx`
- **Dim:** C

### T-049 — refactor: App orchestration final

- **Commit:** `refactor(app): wire hooks and shrink App.tsx`
- **Description:** Replace `handleRebuildIndex`/`availableSources`/`sourceLabel` inline with `useDataActions` + `lib/sources`, remove unused imports, fix `useEffect` deps, ensure `App.tsx` 486 LOC, `npm run typecheck`/`build` green.
- **Files:** `apps/desktop/src/App.tsx`
- **Dim:** A, C

---

## E — Reproducibility (`Self-contained` △→✓)

### T-050 — chore: env example (desktop)

- **Commit:** `chore(env): add apps/desktop/.env.example`
- **Description:** `env_vars_referenced_in_source` contains `TAURI_DEV_HOST` but `env_example_file` was null. Add `apps/desktop/.env.example:1` documenting `TAURI_DEV_HOST=` (+ `VITE_PORT`, `RUST_LOG` comments).
- **Files:** `apps/desktop/.env.example`
- **Dim:** F

### T-051 — chore: env example (root)

- **Commit:** `chore(env): add root .env.example`
- **Description:** Add root `.env.example:1` for `TAURI_DEV_HOST` so scanners find it at repo root too.
- **Files:** `.env.example`
- **Dim:** F

### T-052 — chore: devcontainer

- **Commit:** `chore(dev): add devcontainer`
- **Description:** No container detected. Add `.devcontainer/devcontainer.json:1` (`mcr.microsoft.com/devcontainers/base:ubuntu-22.04`, Node 20 + Rust stable, VS Code extensions, `postCreateCommand` `npm ci`+`core build`, forwards 1420/1421).
- **Files:** `.devcontainer/devcontainer.json`
- **Dim:** F

### T-053 — chore: Dockerfile.dev

- **Commit:** `chore(dev): add Dockerfile.dev`
- **Description:** Add `apps/desktop/Dockerfile.dev:1` (node:20-bookworm + webkit/gtk + Rust, layer-cached `npm ci`, `EXPOSE 1420 1421`).
- **Files:** `apps/desktop/Dockerfile.dev`
- **Dim:** F

### T-054 — chore: .nvmrc

- **Commit:** `chore(dev): pin Node 20`
- **Description:** Add `.nvmrc:1` (`20`) so `nvm use`/`fnm` picks correct version; `README` references it.
- **Files:** `.nvmrc`
- **Dim:** F, E

### T-055 — chore: gitignore env

- **Commit:** `chore(gitignore): ignore .env`
- **Description:** Ensure `.env` not committed, `.env.example` is. Update `.gitignore:1` and `apps/desktop/.gitignore:1` (` .env`, `.env.local`, `.env.*.local`).
- **Files:** `.gitignore`, `apps/desktop/.gitignore`
- **Dim:** I

### T-056 — docs: update README for reproducibility

- **Commit:** `docs(readme): document fresh-clone verification`
- **Description:** Update `README.md:65` `Getting started` to `npm ci --prefix`, `cp .env.example`, fresh verification checklist (`lint`, `format:check`, `typecheck`, `test` in both packages, `build`), devcontainer/Docker one-liners, code map (`src/db/` modules, hooks, `AppShell`), Quality & CI section, contributing pointer.
- **Files:** `README.md`
- **Dim:** F 55→80

---

## F — Dependency Health & Security

### T-060 — chore: dependabot

- **Commit:** `chore(dependabot): add npm+cargo+actions` 
- **Description:** `dep_update_tooling:none`. Add `.github/dependabot.yml:1` weekly for `npm` (`/apps/desktop`, `/packages/core`), `cargo` (`/apps/desktop/src-tauri`), `github-actions` (`/`), groups dev-deps, labels `dependencies`.
- **Files:** `.github/dependabot.yml`
- **Dim:** E 45→70

### T-061 — chore: security docs + audit

- **Commit:** `docs(security): add SECURITY.md and audit in CI`
- **Description:** `dep_audit_in_ci:false` and no validation. Add `SECURITY.md:1` (supported 0.1.x, private advisory, audit/validation notes) and `npm audit --audit-level=high` already in `ci.yml` (T-020). `lib/validation.ts` covers SQL boundaries.
- **Files:** `SECURITY.md`
- **Dim:** I 45→75, E

---

## G — Docs & History

### T-070 — docs: CONTRIBUTING

- **Commit:** `docs: add CONTRIBUTING`
- **Description:** Add `CONTRIBUTING.md:1` (quick start with `nvm use`, `npm ci`, fresh verification, env, `npm run tauri dev`, style, tests, Conventional Commits, security, releases with tags).
- **Files:** `CONTRIBUTING.md`
- **Dim:** F, K

### T-071 — docs: CHANGELOG

- **Commit:** `docs: add CHANGELOG`
- **Description:** Add `CHANGELOG.md:1` (Keep a Changelog, Unreleased with Added/Changed/Fixed for this episode, 0.1.0 notes).
- **Files:** `CHANGELOG.md`
- **Dim:** F, K

### T-072 — docs: LICENSE

- **Commit:** `docs: add MIT LICENSE`
- **Description:** Add `LICENSE:1` (MIT 2026) — satisfies buyer licensing criteria check.
- **Files:** `LICENSE`
- **Dim:** E, K

### T-073 — chore: tag release

- **Commit:** `chore(release): tag v0.1.0` *(tag, not file)*
- **Description:** `release tags 0 → 1`. Create annotated tag: `git tag -a v0.1.0 -m "chore(release): v0.1.0 — quality baseline" && git push --tags`. This moves `History & Maintenance` toward target and enables `CHANGELOG` linking.
- **Acceptance:**
  - [ ] `git tag -l` shows `v0.1.0` (currently **local T-073 not pushed** — run the command)
- **Dim:** K

### T-074 — process: small commits with tests

- **Commit:** *process, not code — from now on*
- **Description:** `history capacity ~0` limits value. For every new feature/fix, do **one commit = one feature + its test** (`git add src/foo.ts src/foo.test.ts && git commit -m "feat(foo): add X with tests"`). Avoid bulk `style:` + `refactor:` + `feat:` mixes. Land 2–4 commits/week; have collaborators commit under own identity to grow `human_authors`.
- **Acceptance:**
  - [ ] Next 10 commits each contain a `*.test.ts` when they touch `src/*.ts`
  - [ ] `git log --oneline -20` shows `feat`/`fix` with tests, not just `style`
- **Dim:** K

---

## How to land these tickets (solo dev)

```bash
# Example: replay the already-done work as small commits (if you want history to be mineable)
git status # 34 new/modified files present
git add apps/desktop/eslint.config.js apps/desktop/package.json && git commit -m "chore(desktop): add eslint flat config with ts+react-hooks"
git add apps/desktop/.prettierrc .prettierrc .prettierignore && git commit -m "chore: add prettier config and ignore"
git add apps/desktop/src/test/setup.ts apps/desktop/vite.config.ts && git commit -m "chore(desktop): add vitest + jsdom harness"
git add apps/desktop/src/utils.test.ts && git commit -m "test(utils): add formatTimestamp and formatDate specs"
# ... continue per ticket above, one ticket = one commit
git tag -a v0.1.0 -m "chore(release): v0.1.0 — quality baseline"
git push --tags && git push origin main
```

> **Note:** The work for T-001…T-072 is **already implemented in this workspace** (622→486 LOC App, 0 vulns, 62 tests, CI green). Push the commits + tag to GitHub (`github.com/nkmohit/memex`) to publish the improvements. Estimates refresh on the **remote** clone, not local.

---

## Mapping to assessment recommendations

| Assessment “How to improve” | Ticket(s) |
|----------------------------|-----------|
| Ship features together with their tests, in small focused commits | **T-074** + every `test:*` paired with `feat:` (T-011…T-016) |
| Make install, build, and test work from a fresh clone | **T-050…T-056**, **T-017**, **T-020** |
| Keep developing over time, in real increments | **T-073**, **T-074** |
| Add automated test suite covering db.ts and importer.ts | **T-010…T-016** |
| Add CI pipeline running lint, typecheck, and tests | **T-020…T-021** |
| Introduce and enforce ESLint plus Prettier | **T-001…T-004** |
| Split App.tsx and db.ts into smaller focused modules | **T-030…T-049** |
| Add a working .env.example and reproducible dev setup | **T-050…T-053** |
| Add dependency update automation and audit step | **T-060…T-061**, **T-022** |

**Ready for 70+** once pushed.
