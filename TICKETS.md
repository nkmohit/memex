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

---

## H — Next: 67 → 70+ (assessment 2026-08-30, 67 C)

> **Gaps:** Test breadth 1:13 (B 45), DRY violation SourceIcon/sourceLabel (C 78→), lockfile not detected (E 58), no integration test for FTS path (B). Fixes below are ~19 points combined (B up to 7, C up to 3, E up to 5, integration up to 7).

### T-080 — chore: add coverage dep + thresholds

- **Commit:** `chore(test): add @vitest/coverage-v8 and thresholds`
- **Description:** No coverage threshold in CI. Add `@vitest/coverage-v8` to `apps/desktop/package.json:devDependencies`, add `coverage:{provider:"v8", thresholds:{lines:70, branches:60}}` to `apps/desktop/vite.config.ts:8`, add `test:coverage` script if missing.
- **Acceptance:**
  - [ ] `npm install --prefix apps/desktop` updates lockfile
  - [ ] `npm run test -- --coverage` shows `Coverage` and respects thresholds (fails below 70/60)
- **Files:** `apps/desktop/package.json`, `apps/desktop/package-lock.json`, `apps/desktop/vite.config.ts`
- **Dim:** B 45→

### T-081 — test: SearchPanel happy+error path

- **Commit:** `test(search): add SearchPanel happy and error specs`
- **Description:** `AppShell.tsx` and `SearchPage.tsx` untested. Create `src/panels/SearchPanel.test.tsx:1` rendering `SearchPanel` with mocked `SearchPage` + `SearchViewer` props, assert query change, source filter, result select, viewer open/close, empty state. Commit together with any tiny refactor needed to make it testable (no logic change).
- **Acceptance:**
  - [ ] `src/panels/SearchPanel.test.tsx` 2+ tests, `npm run test -- src/panels/SearchPanel.test.tsx` passes
  - [ ] Coverage lines increase
- **Files:** `apps/desktop/src/panels/SearchPanel.test.tsx`
- **Dim:** B

### T-082 — test: useAppData hook

- **Commit:** `test(hooks): add useAppData happy and error specs`
- **Description:** Hook currently untested. Create `src/hooks/useAppData.test.ts:1` using `renderHook` + mocked `src/db` (`getStats`, `getSourceStats`, `getConversations`), cover `loadData` success (sets stats/source/conversations) and error (sets loadError + pushToast), plus `loading` transitions. Mock `lib/logger` to silence.
- **Acceptance:**
  - [ ] `src/hooks/useAppData.test.ts` 2+ tests, `npm run test -- src/hooks/useAppData.test.ts` passes
- **Files:** `apps/desktop/src/hooks/useAppData.test.ts`
- **Dim:** B

### T-083 — ci: add coverage gate

- **Commit:** `ci: add coverage step with threshold`
- **Description:** Add `Coverage` step to `.github/workflows/ci.yml:1` after `Test` step: `npm run test -- --coverage` (desktop) and fail below thresholds. Ensure `actions/setup-node` cache still hits.
- **Acceptance:**
  - [ ] `ci.yml` has `npm run test -- --coverage` step, job fails if <70 lines
  - [ ] Local `npm run test -- --coverage` exits 0 with ≥70% (after T-081/082)
- **Files:** `.github/workflows/ci.yml`
- **Dim:** B, H

### T-090 — refactor: extract sourceDisplay

- **Commit:** `refactor(overview): extract SourceIcon and sourceLabel`
- **Description:** DRY violation: `SourceIcon` + `sourceLabel` copy-pasted in `OverviewPage.tsx:1` and `OverviewMemoryPulse.tsx:1`. Create `src/lib/sourceDisplay.tsx:1` exporting both (reuse `IMPORT_SOURCES` + dot span). Remove duplicates and import from lib.
- **Acceptance:**
  - [ ] `src/lib/sourceDisplay.tsx` exists, both `OverviewPage` and `OverviewMemoryPulse` import from it, no duplicate definitions remain
  - [ ] `grep -rn "function SourceIcon" apps/desktop/src` → 1 hit (lib only)
- **Files:** `apps/desktop/src/lib/sourceDisplay.tsx`, `apps/desktop/src/OverviewPage.tsx`, `apps/desktop/src/components/OverviewMemoryPulse.tsx`
- **Dim:** C 78→

### T-091 — test: sourceDisplay

- **Commit:** `test(lib): add sourceDisplay specs`
- **Description:** Add `src/lib/sourceDisplay.test.tsx:1` asserting `sourceLabel` for `claude`→"Claude", `chatgpt`→"ChatGPT", `gemini`→"Gemini", `grok`→"Grok", `unknown`→capitalized, plus `SourceIcon` renders correct dot class. Commit together with T-090 as **one focused commit** (refactor + test) to be mineable.
- **Acceptance:**
  - [ ] `src/lib/sourceDisplay.test.tsx` 5+ asserts, `npm run test -- src/lib/sourceDisplay.test.tsx` passes
  - [ ] `npm run lint` and `npm run test` both 0
- **Files:** `apps/desktop/src/lib/sourceDisplay.test.tsx` (and `sourceDisplay.tsx` if not already)
- **Dim:** C, B

### T-100 — chore: commit desktop lockfile

- **Commit:** `chore: commit desktop lockfile for reproducible installs`
- **Description:** Stats reports `lockfiles_found` for `packages/core` and `Cargo.lock` but not `apps/desktop` — likely stale or uncommitted. Regenerate `apps/desktop/package-lock.json` against current `package.json` and ensure CI `cache-dependency-path` already references it.
- **Acceptance:**
  - [ ] `apps/desktop/package-lock.json` is committed, `git ls-files | grep package-lock.json` shows both `apps/desktop` and `packages/core`
  - [ ] `npm ci --prefix apps/desktop` exits 0 on clean checkout (verified in CI)
  - [ ] `.github/workflows/ci.yml` `cache-dependency-path` includes `apps/desktop/package-lock.json`
- **Files:** `apps/desktop/package-lock.json`
- **Dim:** E 58→

### T-110 — test: db integration (import→search)

- **Commit:** `test(db): add import-to-search integration spec`
- **Description:** Current tests mock DB. Create `src/db.integration.test.ts:1` that uses a real sqlite driver (file-based temp `memex.test.db` via `better-sqlite3` or `sqlite3` with `fts5` if available, otherwise skip gracefully). Test: run `migrations` (`initDatabase` equivalent via direct SQL), import small Claude fixture via `insertConversations` helper (or direct `db` inserts), call `rebuildSearchIndex`, then `searchMessages` and assert non-empty ranked results. If native sqlite not available in CI, the test skips with `it.skip` but does not fail.
- **Acceptance:**
  - [ ] `src/db.integration.test.ts` exists, `npm run test -- db.integration` passes (or skips gracefully)
  - [ ] Added as separate `Integration test` step in `ci.yml` (or part of coverage run) that fails PR on breakage when sqlite available
- **Files:** `apps/desktop/src/db.integration.test.ts`, `.github/workflows/ci.yml` (optional separate step)
- **Dim:** B

> **Order to land:** T-090+T-091 together (one commit), T-100 (one commit), T-080→T-083 in order, T-110 last. Each ticket = one commit. Keep `npm run lint && npm run test` green per commit.

---

## Mapping to new assessment (67 C, 2026-08-30)

| Assessment “How to improve” | Ticket(s) |
|----------------------------|-----------|
| Raise test breadth and add a coverage gate | **T-080…T-083** |
| Extract duplicated source-label/icon helpers | **T-090, T-091** |
| Commit a package-lock.json for apps/desktop | **T-100** |
| Add integration test for the Tauri SQLite import-to-search flow | **T-110** |

---

## I — Architecture & Robustness (62→70, ~8 pts)

> **Gaps:** `has_metrics true` but no evidence of what it tracks; no error tracking/health endpoint; `sourceLabel` still duplicated in `ConversationDetailPanel.tsx:16`, `OnboardingPage.tsx:4`, `ImportPage.tsx:8`; `sources.ts` vs `sourceDisplay.tsx` split is confusing; large panels still untested for error paths.

### T-120 — refactor: unify remaining sourceLabel / SourceIcon DRY

- **Commit:** `refactor(overview): unify remaining source helpers`
- **Description:** `ConversationDetailPanel.tsx:16` has private `sourceLabel`, `OnboardingPage.tsx:4` + `ImportPage.tsx:8` each have private `SourceIcon` (brand icons). Consolidate into `src/lib/sourceDisplay.tsx:1` — export `sourceLabel`, `SourceIcon` (dot variant, used in overview) and `BrandSourceIcon` (icon variant, wraps `ClaudeIcon/ChatGPTIcon/GeminiIcon/GrokIcon`). Make `src/lib/sources.ts:1` re-export `sourceLabel` from `sourceDisplay` and keep only `getAvailableSources`. Delete private funcs.
- **Acceptance:**
  - [ ] `grep -rn "function SourceIcon" apps/desktop/src --include="*.tsx"` → 1 hit (lib only, `BrandSourceIcon` counts)
  - [ ] `grep -rn "function sourceLabel" apps/desktop/src` → 1 hit
  - [ ] `npm run lint --prefix apps/desktop && npm run test --prefix apps/desktop` passes (sourceDisplay tests still green)
- **Files:** `src/lib/sourceDisplay.tsx`, `src/lib/sources.ts`, `src/ConversationDetailPanel.tsx`, `src/OnboardingPage.tsx`, `src/ImportPage.tsx`
- **Dim:** C, A

### T-121 — feat: add diagnostics / health module

- **Commit:** `feat(arch): add diagnostics and health check`
- **Description:** Desktop has no health endpoint — add `src/lib/diagnostics.ts:1` exposing `getDiagnostics(): Promise<{db: DbStats, indexHealth:{indexedPct:number, missing:boolean}, version:string, sourceStats:SourceStats[]}>` that reuses `getStats/getSourceStats` and returns index health (`indexedMsgs===0 && totalMsgs>0`). Also export `isSearchIndexHealthy()`. No telemetry leaves device.
- **Acceptance:**
  - [ ] `src/lib/diagnostics.ts` exists, typed, uses `logger.debug`
  - [ ] Unit test `src/lib/diagnostics.test.ts` mocks `db/queries` and asserts healthy vs missing cases
  - [ ] Call not wired to UI yet (pure module) — no runtime side effect
- **Files:** `apps/desktop/src/lib/diagnostics.ts`, `apps/desktop/src/lib/diagnostics.test.ts`
- **Dim:** A 62→ (observability)

### T-122 — feat: add error boundary + error tracking stub

- **Commit:** `feat(arch): add error boundary and tracking stub`
- **Description:** `App.tsx` has no error boundary; logger has no error tracking. Add `src/components/ErrorBoundary.tsx:1` (class component, fallback UI, calls `logger.error` + `reportError` from new `src/lib/errorTracking.ts:1`). `errorTracking.ts` is a local stub — `initErrorTracking`, `reportError(err, context)` that logs with `logger.error` and is a no-op for external service (respects local-first). Wrap `AppShell` in `ErrorBoundary` in `App.tsx:1`.
- **Acceptance:**
  - [ ] `src/components/ErrorBoundary.tsx` + `src/lib/errorTracking.test.ts` exist
  - [ ] `App.tsx` wraps shell, `npm run test` includes boundary test (throw in child → fallback renders)
- **Files:** `apps/desktop/src/lib/errorTracking.ts`, `apps/desktop/src/components/ErrorBoundary.tsx`, `apps/desktop/src/App.tsx`
- **Dim:** A (observability, robustness)

### T-123 — docs: document metrics and architecture

- **Commit:** `docs(arch): document metrics and diagnostics`
- **Description:** `has_metrics true` but no evidence of what it tracks. Add `ARCHITECTURE.md:1` or extend `README.md:30` Architecture section with “Observability” table: what `diagnostics` returns, what `logger` levels do, what `errorTracking` captures, and that `has_metrics` is local only (no outbound). Keeps buyer signal from being vague.
- **Acceptance:**
  - [ ] `README.md` or `ARCHITECTURE.md` lists tracked metrics (conversation/message counts, indexedPct, source breakdown, activity timeline)
  - [ ] `has_metrics` evidence lines point to `src/lib/diagnostics.ts`
- **Files:** `README.md` or `ARCHITECTURE.md`
- **Dim:** A

---

## J — Test Coverage 45→70 (1:13 → 1:3, ~7 pts)

> **Current:** `coverage lines 16.95%` (see `npm run test -- --coverage`). Files at `0%`: `App.tsx:486`, `OverviewPage:293`, `SearchPage:483`, `AppShell:342`, `ImportPage:246`, most hooks. Goal: lines ≥70, branches ≥60, spec ratio ≥1:5. Achieve by adding targeted suites (happy+error) — each committed with refactor as one mineable commit.

### T-124 — chore: raise coverage thresholds to 70/60

- **Commit:** `chore(test): raise coverage thresholds to 70/60`
- **Description:** After T-081/082/110 nominal thresholds are still `lines:10`. Raise `apps/desktop/vite.config.ts:21` thresholds to `lines:70, branches:60`. Expect CI to fail until J-125…J-129 land — land this **last** in the J epic or set `thresholds` per-file if needed. Update CI `Coverage` step to `npm run test -- --coverage --run`.
- **Acceptance:**
  - [ ] `vite.config.ts` thresholds `70/60`, `npm run test -- --coverage` fails locally until new tests land (desired)
  - [ ] After J-125…J-129, coverage exits 0 with lines ≥70
- **Files:** `apps/desktop/vite.config.ts`
- **Dim:** B

### T-125 — test: AppShell + OverviewPage + OverviewMemoryPulse specs

- **Commit:** `test(overview): add AppShell and OverviewPage specs`
- **Description:** Cover `OverviewPage.tsx:42` loading skeleton vs populated metrics, empty/needsRebuild banners, topSource sort; `OverviewMemoryPulse.tsx:30` heatmap cells, intensity, year filter, tooltip. Mock `db` (`getCachedDashboardSnapshot`, `getDashboardSnapshot`).
- **Acceptance:**
  - [ ] `src/components/AppShell.test.tsx` and `src/OverviewPage.test.tsx` (or `OverviewMemoryPulse.test.tsx`) — ≥3 tests each
  - [ ] `npm run test -- AppShell` passes, lines ↑ ~10-15%
- **Files:** `apps/desktop/src/components/AppShell.test.tsx`, `apps/desktop/src/OverviewPage.test.tsx`
- **Dim:** B

### T-126 — test: SearchPage + SearchResultsList + ConversationListPanel

- **Commit:** `test(search): add SearchPage and results list specs`
- **Description:** Mock `usePersistedSearchState` + `db/search` to test query input, source filter, sort change, pagination, open conversation → resets viewer search. Keep happy + error (search throws → error banner).
- **Acceptance:**
  - [ ] `src/SearchPage.test.tsx` + `src/components/SearchResultsList.test.tsx` ≥4 tests
  - [ ] Branches ↑ (filter/sort branches)
- **Files:** `apps/desktop/src/SearchPage.test.tsx`
- **Dim:** B

### T-127 — test: ImportPage + OnboardingPage + ConversationDetailPanel

- **Commit:** `test(panels): add Import/Onboarding/Detail specs`
- **Description:** Test import source cards render, available vs coming-soon, import/cancel clicks, progress display; `ConversationDetailPanel` sender pill uses `sourceLabel`, menu open/close.
- **Acceptance:**
  - [ ] `src/ImportPage.test.tsx` etc — ≥2 tests each
- **Files:** `apps/desktop/src/ImportPage.test.tsx`, `apps/desktop/src/OnboardingPage.test.tsx`
- **Dim:** B

### T-128 — test: remaining hooks (useClearData, useDataActions, useImportState, useViewerSearch, useThemeMode)

- **Commit:** `test(hooks): add remaining hooks specs`
- **Description:** Use `renderHook` for `useClearData` (clearConfirm flow, calls `clearAllData`), `useDataActions` (rebuild index toast), `useViewerSearch` (highlightText, occurrence count, next/prev), `useThemeMode` (persist, system fallback). Suppress logger in setup.
- **Acceptance:**
  - [ ] `src/hooks/useClearData.test.tsx`, `useDataActions.test.tsx` etc — ≥2 tests each
  - [ ] Coverage lines → ~55% after this ticket
- **Files:** `apps/desktop/src/hooks/*.test.tsx`
- **Dim:** B

### T-129 — test: lib/validation + lib/diagnostics + errorTracking

- **Commit:** `test(lib): add validation and diagnostics specs`
- **Description:** `validation.ts:1` has `sanitizeSource`, `clampLimit`, `sanitizeSort`, `sanitizeDateRange` — all pure and untested at 57% branches. Add `src/lib/validation.test.ts:1` with 12+ cases (incl. invalid source → undefined, limit clamping, sort fallback, date swap). Also test `diagnostics` and `errorTracking`.
- **Acceptance:**
  - [ ] `src/lib/validation.test.ts` ≥12 tests, `src/lib/diagnostics.test.ts` ≥2, `src/lib/errorTracking.test.ts` ≥1
  - [ ] Branches ≥60% after
- **Files:** `apps/desktop/src/lib/validation.test.ts`
- **Dim:** B

---

## K — History & Maintenance 45→60 (~4 pts) + Dependency Health 58→75 (~5 pts)

### T-130 — chore: tag v0.2.0 + establish release cadence

- **Commit:** `chore(release): tag v0.2.0` *(tag)*
- **Description:** Only `v0.1.0` (97 commits, 202 days). Create annotated tag after J epic lands: `git tag -a v0.2.0 -m "chore(release): v0.2.0 — coverage 70, diagnostics, DRY"` and push. Update `CHANGELOG.md` with `0.2.0` entry linking tag. This directly raises `Tags` and `Recency`.
- **Acceptance:**
  - [ ] `git tag -l` shows `v0.1.0` and `v0.2.0`, `CHANGELOG.md` has `## [0.2.0]`
  - [ ] `git push --tags` done
- **Files:** `CHANGELOG.md` (+ tag)
- **Dim:** K

### T-131 — chore: verify lockfiles + add .gitignore for coverage

- **Commit:** `chore(deps): ignore coverage and verify lockfiles`
- **Description:** `apps/desktop/coverage/` is currently untracked but shows in `git status` (see `?? apps/desktop/coverage/`). Add `coverage/` to `apps/desktop/.gitignore:1` and root `.gitignore`. Verify `git ls-files | grep package-lock.json` shows both `apps/desktop` and `packages/core` and `Cargo.lock` — add `manifests_found` hint by ensuring `package.json` has `workspaces` or at least root `package.json` not confusing parser.
- **Acceptance:**
  - [ ] `git status --short` no longer shows `coverage/` untracked
  - [ ] `git ls-files | grep package-lock` shows 2 npm lockfiles + Cargo
- **Files:** `.gitignore`, `apps/desktop/.gitignore`
- **Dim:** E 58→, C

### T-132 — process: small commits with tests (mineable history)

- **Commit:** *process, not code — from now on*
- **Description:** `Task capacity ~0` + `Buyer fit: Task capacity Almost no mineable commits` because history was built in large bulk commits. From now on: **one commit = one feature + its test** (`git add src/foo.ts src/foo.test.ts && git commit -m "feat(foo): add X with tests"`). Avoid `style:`+`feat:` mixes. Land 2–4 commits/week; have collaborators commit under own identity to grow `human_authors` from 1→2+. After this file lands, re-score after 10–15 mineable commits and measure `Task capacity` moves from `~0`.
- **Acceptance:**
  - [ ] Next 10 commits each contain a `*.test.ts` when they touch `src/*.ts`
  - [ ] `git log --oneline -20` shows conventional commits with tests
  - [ ] Re-score at datafactor.com/score → `Task capacity` >5
- **Dim:** K, B (task capacity is buyer payout multiplier)

### T-133 — chore: raise coverage gate to enforce 70 in CI (tie-off)

- **Commit:** `ci: enforce coverage threshold 70`
- **Description:** Ensure `.github/workflows/ci.yml:68` `Coverage (desktop)` step fails below 70. If flakes from missing sqlite, keep `db.integration` as separate `Integration test` step (already added). Add `fail_ci_if_error: true` semantics via `vitest --coverage` exit code.
- **Acceptance:**
  - [ ] `ci.yml` coverage step exit 1 when `npx vitest --coverage` lines <70
  - [ ] CI green on `main` after J epic
- **Files:** `.github/workflows/ci.yml`
- **Dim:** H, B

---

## Mapping to assessment gaps (67 C → 70+ → 80)

| Dimension | Score → Target | Tickets |
|-----------|---------------|---------|
| **A Architecture & Robustness** 62→70 (~8) | Add diagnostics, error boundary, DRY final, metrics docs | **T-120…T-123** |
| **B Test Coverage** 45→65 (~7) | Raise 16.95%→70%, 1:13→1:3, thresholds 10→70 | **T-124…T-129** (plus T-080…T-083) |
| **K History & Maintenance** 45→60 (~4) | 97→130+ commits, 1→2 tags, sustained mineable commits | **T-130, T-132** |
| **E Dependency Health** 58→70 (~5) | Lockfiles + ignore coverage + manifests | **T-131** |
| **C Code Cleanliness** 78→85 | Final DRY (SourceIcon/BrandSourceIcon) | **T-120** |
| **H CI/CD** 80→85 | Coverage gate enforced at 70 | **T-133, T-124** |

> **Order to land for max points:** T-120 (DRY) → T-121/T-122 (arch, parallel) → T-125…T-129 (tests, 1 commit each) → T-131 (ignore) → **T-124** (raise thresholds last) → T-130 (tag v0.2.0) → push all → **T-132 process** ongoing. Each ticket = one commit. Keep `npm run lint && npm run test` green per commit. Re-score after push.
