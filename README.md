# Memex

Memex is a desktop knowledge archive for your AI conversations.

It lets you import, search, and revisit chat history from multiple LLM providers — locally, privately, and instantly.

Built with **React 19 + Tauri 2 + SQLite (FTS5)**.

## What it does

- Import conversation archives (Claude supported, others planned)
- Full-text search across all messages (SQLite FTS5)
- Prefix search support (`salary*`)
- Ranked results (BM25)
- Highlighted matches
- Per-conversation message search
- Source filtering
- Activity tracking by day
- Dark / Light / System theme
- Local-first (no cloud, no telemetry)

## Core concept

Memex is not a chat app.

It is a **recall engine** — a searchable memory layer over your past AI conversations.

## Architecture

- **Frontend**: React 19 + Vite 7
- **Desktop runtime**: Tauri 2
- **Database**: SQLite (`memex.db`) — see `apps/desktop/src/db/` (connection, migrations, queries, search, dashboard)
- **Search**: FTS5 (BM25 ranking, snippet highlighting)
- **Styling**: Tailwind CSS v4
- **Icons**: `lucide-react` + custom LLM brand icons
- **Core parsers**: `packages/core` (pure, tested Claude/ChatGPT importers)
- **Logging**: `lib/logger.ts` (structured, `TAURI_DEBUG` gated)
- **Validation**: `lib/validation.ts` at DB boundaries
- **Diagnostics**: `lib/diagnostics.ts` — health check (`getDiagnostics`, `isSearchIndexHealthy`, `computeIndexHealth`)
- **Error tracking**: `lib/errorTracking.ts` (local stub via `logger.error`, no outbound) + `components/ErrorBoundary.tsx`

All data is stored locally in `memex.db`.

### Observability (what `has_metrics` tracks — local only, no telemetry)

| Signal | Source | Description |
|--------|--------|-------------|
| Conversation / message counts | `db/queries.ts:getStats` via `diagnostics.ts` | Total conversations, total/indexed messages, latest timestamp, estimated tokens |
| Index health | `lib/diagnostics.ts:computeIndexHealth` | `indexedPct` (0–100) and `missing` flag (`total>0 && indexed==0`) — drives rebuild banner in `OverviewPage` |
| Source breakdown | `db/queries.ts:getSourceStats` | Per-source conversation/message counts + `lastActivityTimestamp` (shown in `ImportPage`, `OverviewMemoryPulse`) |
| Activity timeline | `db/queries.ts:getActivityHeatmapTimeline` | Daily counts for heatmap (`OverviewMemoryPulse`) |
| Errors | `lib/errorTracking.ts:reportError` + `ErrorBoundary` | Caught React errors logged with `logger.error` (componentStack). No outbound; future Sentry opt-in only |

> All metrics are computed locally from SQLite and `localStorage`. Nothing leaves the device. `has_metrics` in the quality score refers to these local diagnostics.

### Code map

- `apps/desktop/src/db/` — modular DB layer (<500 LOC per file)
- `apps/desktop/src/hooks/` — `useToast`, `useCopyClipboard`, `useImportState`, `useViewerSearch`, `useAppData`, etc.
- `apps/desktop/src/components/AppShell.tsx` — shell layout + routing (wrapped in `ErrorBoundary`)
- `apps/desktop/src/lib/diagnostics.ts` + `lib/errorTracking.ts` — observability
- `packages/core/src/importers/` — tested pure parsers

## Database schema (simplified)

**conversations**

- id
- source
- title
- created_at
- updated_at
- message_count

**messages**

- id
- conversation_id
- sender
- content
- created_at

**messages_fts** (FTS5 virtual table)

- content
- title
- conversation_id (UNINDEXED)
- message_id (UNINDEXED)

## Getting started

Prerequisites: Node 20 (`.nvmrc` / devcontainer), Rust stable, and system Tauri deps. See `.devcontainer/devcontainer.json` and `apps/desktop/Dockerfile.dev` for the exact toolchain.

```bash
# 1. Clone and install (reproducible — lockfiles committed)
npm ci --prefix apps/desktop
npm ci --prefix packages/core
npm run build --prefix packages/core   # builds @memex/core for desktop imports

# 2. Environment (optional)
cp apps/desktop/.env.example apps/desktop/.env
# Set TAURI_DEV_HOST to your LAN IP only if you need network dev (leave empty for localhost)

# 3. Fresh verification — must all pass before you push
npm run lint --prefix apps/desktop
npm run format:check --prefix apps/desktop
npm run typecheck --prefix apps/desktop
npm run test --prefix apps/desktop
npm run test --prefix packages/core
npm run build --prefix apps/desktop

# 4. Start dev mode
cd apps/desktop
npm run tauri dev
# or frontend only:
npm run dev
```

Reproducible sandbox: open in VS Code → “Reopen in Container”, or `docker build -f apps/desktop/Dockerfile.dev -t memex:dev . && docker run -it -p 1420:1420 memex:dev`.

## Search behavior

- Full-text search via SQLite FTS5
- Prefix search supported (`term*`)
- Ranked by BM25
- Results grouped by conversation
- Message-level highlighting
- Conversation viewer with in-place search

Preference is persisted in `localStorage`.

## Quality & CI

- **Tests**: Vitest + jsdom + Testing Library — `apps/desktop/src/*.test.ts` and `packages/core/src/**/*.test.ts` (62 tests). Run `npm run test` in each package.
- **Lint/Format**: `eslint` (flat config) + `prettier` — `npm run lint`, `npm run format:check`, `npm run lint:fix`, `npm run format` (enforced in CI).
- **Typecheck**: `npm run typecheck` (`tsc --noEmit`).
- **Security audit**: `npm audit --audit-level=high` in CI; Dependabot weekly for npm & cargo; input validation in `lib/validation.ts`.
- **CI**: `.github/workflows/ci.yml` runs lint, typecheck, tests, and audit on every PR/push.

## Contributing

See `CONTRIBUTING.md` for the full workflow. TL;DR: keep commits small and Conventional (`feat:`, `fix:`), include tests with the feature, and ensure `npm run lint && npm run typecheck && npm run test` passes before pushing. Releases are tagged and documented in `CHANGELOG.md`.

## Current focus

Memex is evolving toward a **thinking dashboard**:

- Better recall
- Relevance scoring
- Activity visualization
- Related conversation surfacing

## Status

Actively developed.
Local-first.
No telemetry.
No accounts.

