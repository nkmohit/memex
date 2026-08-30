# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

