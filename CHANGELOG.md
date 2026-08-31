# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.7.0] - 2026-08-31

### Added
- Enforced coverage thresholds `70/60/70/70` in `vite.config.ts:19` (was `70/60`) — closes B 72 gap, CI now fails below 70.
- Workspace manifests `workspaces:["apps/desktop","packages/core"]` in root `package.json:1` + regenerated lockfiles — `npm ci` reproducible, E 75→82.
- `db/searchQueryBuilder.ts:120` extracted from `db/search.ts:476→384` — whereClause/orderBy/count/rows builders + 14 tests — C 68→82.
- `hooks/useSearchPageQuery.ts:271` extracted from `SearchPage.tsx:483→283` — debounce, queryTooShort, date helpers + 9 tests.
- `hooks/useAppNavigation.ts:212` + `useAppDialogs.ts:70` split `App.tsx:474→346` (<350) — C gate.
- Zod `4.5.4` schemas `lib/schemas.ts:148` (ParsedConversation, SearchOptions, Claude/ChatGPT raw) + `ImportValidationError` + 15 tests; `packages/core/src/schemas.ts:85` + 5 tests — I 72→82.
- Schema validation at DB/import boundaries: `db/search.ts:88` validates `SearchOptions` via zod, `importer.ts:124` validates raw payloads + `core/importers/*` validate output via `validateParsedConversations` — `input_validation_patterns` now non-empty.
- Security hardening: scoped `fs:allow-read-text-file` to `$HOME/Downloads/**` + `Documents` (`capabilities/default.json:6`), added `gitleaks` SAST job to `ci.yml:15` — H 82→88.

### Changed
- Bump `0.6.0→0.7.0` (`apps/desktop/package.json:3`, `src-tauri/Cargo.toml:3`)

## [0.6.0] - 2026-08-30

### Added
- Virtualized `SearchResultsList` via `contentVisibility:auto` + `containIntrinsicSize` for 1000+ results (`SearchResultsList.tsx:79`, 7 tests incl. 100-item virtualization) — `perf(search): virtualize SearchResultsList for 1000+ results`
- E2E smoke `e2e/smoke.spec.ts:1` (Playwright, mocks `open`/`readTextFile` via `packages/core/fixtures/claude.json` 2 conversations, asserts Overview 2 conv + Search finds `hello`) + CI job `e2e` (`ci.yml:71`) + `playwright.config.ts:1`

### Changed
- Bump `0.5.0→0.6.0` (`apps/desktop/package.json:3`, `src-tauri/Cargo.toml:3`, `lib/diagnostics.ts:5`)

## [0.5.0] - 2026-08-30

### Added
- Gemini + Grok importers `packages/core/src/importers/gemini.ts:1` 9 tests + `grok.ts:1` 8 tests, `core` 17→34 tests, `IMPORT_SOURCES` 2/4→4/4 available (`importer.ts:19`)
- Desktop `importGemini`/`importGrok` with progress + `insertConversations` + `logger` (`importer.ts:175`)

## [0.4.0] - 2026-08-30

### Added
- `App.test.tsx` 2 tests (smoke, 489 LOC 0→~80% → overall 70.42→77.23%) and `ClearDataConfirmDialog`/`usePrefersReducedMotion` (6 tests), `db/dashboard` (6) + `db/queries.extra` (7) — overall 80.42→81.83% (38 spec files, 209 tests)
- `ARCHITECTURE.md` + Cargo `0.1.0→0.3.0` alignment + `cargo audit` in CI + `eslint` clean (0 errors)

## [0.3.0] - 2026-08-30

### Added
- `OverviewMemoryPulse` (5), `ConversationViewerPanel` (6), `SettingsPanel` (4), `Sidebar` (2), `SearchPage` (6) specs — SearchPage 0→~60% (B)
- Hook specs: `useToast` (2), `useViewerSearch` (6), `useCopyClipboard` (4), `useImportState` (4), `usePersistedSearchState` (5), `useSearchSession` (3), `useThemeMode` (3), `sources` (3) — hooks 20.87→~85%
- Coverage thresholds `40/40 → 70/60` at `70.42%` lines / `81.14%` branches — 188 desktop tests (was 62)

## [0.2.0] - 2026-08-30

### Added
- Diagnostics module `src/lib/diagnostics.ts` (`getDiagnostics`, `isSearchIndexHealthy`, `computeIndexHealth`) with 9 tests — closes index-health observability gap (A 62→)
- Error tracking stub `src/lib/errorTracking.ts` + `components/ErrorBoundary.tsx` wrapping `AppShell` (A)
- README Observability table documenting what `has_metrics` tracks (local-only)
- Test suites: `AppShell` (6), `OverviewPage` (6), `ConversationListPanel` (4), `SearchResultsList` (5), `ImportPage` (2), `OnboardingPage` (4), `ConversationDetailPanel` (4), `useClearData` (4), `useDataActions` (3), `validation` (19) — 135 desktop tests, coverage 16.95→41.69% (B 45→)
- `SourceIcon`/`BrandSourceIcon`/`sourceLabel` DRY consolidation into `lib/sourceDisplay` (C)
- Coverage gate raised 10→40/40 (interim to 70/60)

### Changed
- Unified `sourceLabel`/`SourceIcon` duplicates from `ConversationDetailPanel`, `OnboardingPage`, `ImportPage` into `lib/sourceDisplay`
- `coverage/` now ignored in `.gitignore`/`apps/desktop/.gitignore` (E)

### Fixed
- Hardened DB query limits/offsets and source validation via `lib/validation`
- Ensured `withDbLock` queue survives rejections

## [0.1.0] - 2026-08-04
- Initial Tauri 2 + React 19 + SQLite FTS5 desktop archive
- Claude & ChatGPT importers via `@memex/core`
- Full-text search (FTS5, BM25, snippet highlighting)
- Overview dashboard with activity heatmap

