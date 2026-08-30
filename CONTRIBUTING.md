# Contributing to Memex

Thanks for considering a contribution! This guide covers the minimal workflow to keep CI green.

## Quick start

```bash
# 1. Clone and use Node 20
nvm use || fnm use # or ensure node --version is 20.x

# 2. Install
npm ci --prefix apps/desktop
npm ci --prefix packages/core
npm run build --prefix packages/core

# 3. Fresh verification (must all pass)
npm run lint --prefix apps/desktop
npm run format:check --prefix apps/desktop
npm run typecheck --prefix apps/desktop
npm run test --prefix apps/desktop
npm run test --prefix packages/core
npm run build --prefix apps/desktop
```

Alternatively, open the devcontainer: `Reopen in Container` in VS Code — it auto-installs Node 20 + Rust stable and runs the verification.

## Environment

Copy `apps/desktop/.env.example` to `apps/desktop/.env`. The only variable you normally need is:

- `TAURI_DEV_HOST` — your LAN IP when running `npm run tauri dev` on a device that needs network access. Leave empty for localhost-only.

## Development

```bash
cd apps/desktop
npm run tauri dev   # launches Vite + Tauri
npm run dev         # frontend only (no Rust)
```

## Code style

- ESLint + Prettier are enforced in CI. Run `npm run lint:fix` and `npm run format` before pushing.
- Keep modules under 500 LOC — extract hooks/components when a file grows.
- Use the structured logger `import { logger } from "./lib/logger"` instead of `console.log`.
- Validate external input via `lib/validation.ts` before SQL.

## Tests

- Desktop: `npm run test` (Vitest + jsdom + Testing Library) — includes `db.test.ts`, `importer.test.ts`, `utils.test.ts`
- Core: `npm run test` (pure parser tests, no DOM)
- Add tests alongside the feature in the same commit (small, focused commits are preferred for history mining).

## Commit style

We use Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:` …). CI checks lint/typecheck/tests; keep commits small and include tests with the feature.

## Security

- No secrets are committed. `npm audit --audit-level=high` runs in CI and will fail the build on high-severity vulnerabilities.
- Input validation lives in `lib/validation.ts` and is enforced at DB boundaries.

## Releases

We tag releases (`git tag v0.1.0 && git push --tags`). Changelog is in `CHANGELOG.md`.
