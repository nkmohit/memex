# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Vitest + Testing Library suite for `apps/desktop` and `packages/core` (45 desktop, 17 core tests)
- ESLint (flat config) + Prettier with CI enforcement (`lint`, `format:check`, `typecheck`)
- GitHub Actions CI (`.github/workflows/ci.yml`) — lint, typecheck, tests, audit, Rust `cargo check`
- Devcontainer (`.devcontainer/devcontainer.json`) and `Dockerfile.dev` for reproducible dev
- `.env.example` at repo root and `apps/desktop/.env.example` documenting `TAURI_DEV_HOST`
- Dependabot (`.github/dependabot.yml`) for npm (desktop, core), cargo, and GitHub Actions
- Structured logger (`src/lib/logger.ts`) and input validation (`src/lib/validation.ts`)
- DB modularization: `src/db/{connection,migrations,queries,search,dashboard,types,helpers}`

### Changed
- Split `db.ts` (1024 LOC) and `App.tsx` (969 LOC) into focused modules (<500 LOC each)
- Extracted `OverviewPage` heatmap into `components/OverviewMemoryPulse`
- Introduced `AppShell` + hooks (`useToast`, `useCopyClipboard`, `useImportState`, `useViewerSearch`, `useAppData`, `useSearchSession`, `useClearData`) to separate concerns
- Replaced `console.log` with `logger.info` and added `npm audit` in CI (security hygiene)

### Fixed
- Hardened DB query limits/offsets and source validation via `lib/validation`
- Ensured `withDbLock` queue survives rejections

## [0.1.0] - 2026-08-04
- Initial Tauri 2 + React 19 + SQLite FTS5 desktop archive
- Claude & ChatGPT importers via `@memex/core`
- Full-text search (FTS5, BM25, snippet highlighting)
- Overview dashboard with activity heatmap

