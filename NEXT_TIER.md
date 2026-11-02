# Memex — what is actually left

This file used to be a score sheet (coverage percents, “DataFactor”, dollar ranges, and a roadmap that mixed finished refactors with features the code only stubs). Those scores are not measured by this repo. This page lists behavior that is present, behavior that is only a stub, and work that is not started.

Package versions in tree: desktop `0.8.0` (`apps/desktop/package.json`, `src-tauri/Cargo.toml`), Tauri config `version` `0.6.0`, core `0.1.0`.

## Present

- npm workspaces (`apps/desktop`, `packages/core`) and a root `package-lock.json`. CI runs `npm ci` at the root on Node 22.
- Four importers: Claude, ChatGPT, Gemini, Grok, with unit tests under `packages/core/src/importers/`.
- SQLite FTS5 search, prefix tokens, snippets, source and date filters. Rank is term-count plus a title `LIKE` boost (`db/searchQueryBuilder.ts`), not `bm25()`.
- Diagnostics, local error logging, an in-process latency histogram, a TF-IDF topic helper, and an extractive three-bullet summary.
- ESLint 10, Prettier, TypeScript 6 (desktop) / 5.9 (core), Vite 8, Vitest 4, jsdom 30 (desktop) / 26 (core), React 19, Tailwind 4, `@vitejs/plugin-react` 6, `eslint-plugin-react-hooks` 7.
- Coverage thresholds 70/60/70/70. CI also runs format check, core tests, `size-limit`, `npm audit` (high), `cargo check`, `cargo deny` (advisories, licenses, bans, sources), gitleaks, a non-blocking `cargo clippy`, a non-blocking CycloneDX attempt, a Playwright file that does not drive the UI (`e2e/smoke.spec.ts`), and `tauri build --debug --no-bundle`.
- CSP string in `tauri.conf.json`. FS permissions: read text and exists under `$HOME/Downloads/**` and `$HOME/Documents/**`.
- `content-visibility: auto` on search rows. The list still mounts every row React renders. There is no windowing library.

`search.ts` is about 560 lines. There is no CI check that fails a file for length.

## In the tree, and not the real feature

| Name in code | What the code does |
| --- | --- |
| `crypto.rs` / `lib/crypto.ts` | XOR with the key bytes. `is_encrypted()` is true only when `MEMEX_ENCRYPTED` is `1` or `true`. The DB is not encrypted. |
| `plugins/sandbox.ts` | Regex denylist, then `new Function` inside `loadPlugins()`. No app call site loads plugins. Allowlist does not include `~/.memex/plugins`. |
| `lib/vector.ts`, `vector.rs`, `messages_vec`, Search “Hybrid” | Hashed bag-of-tokens plus a fixed synonym table. `isSqliteVecAvailable()` is true only when `MEMEX_VEC=1`. The `vec0` virtual table is not created on a normal SQLite build. |
| `lib/summarize.ts` | Sentence frequency ranking. The comment mentions `tauri-plugin-llm` / WebLLM; those packages are not dependencies. |
| `lib/otel.ts` | A fixed-size array of latencies. `@opentelemetry/api` is not installed. |
| `createUpdaterArtifacts: true` | Release workflow (`.github/workflows/release.yml`) does not run `tauri build` and does not set a signing key. |
| `e2e/smoke.spec.ts` | Reads `packages/core/fixtures/claude.json`, parses it, and checks strings. It does not launch Memex. |
| `perf/budgets.json` | Notes. The enforced limits are the `size-limit` entries in `apps/desktop/package.json`. |

## Not started

Labeled so they are not read as shipped work:

- SQLite FTS5 `bm25()` ranking (the query builder still uses occurrence counts).
- Encryption at rest (keychain, `age`, SQLCipher).
- A plugin runtime with a real sandbox, and wiring `loadPlugins()` into startup.
- Embedding search (`sqlite-vec`, ONNX, or otherwise) and hybrid rank that uses those scores.
- An offline model for summaries.
- Zip import, and tests that fuzz it.
- UI windowing for large result lists.
- Trivy, `cargo audit` in CI, a blocking SBOM, signed updater artifacts.
- `docs/` site, Storybook, screenshots.
- Aligning the devcontainer and `Dockerfile.dev` (Node 20) with `.nvmrc` / CI (Node 22).

Older text in this file cited specific GitHub dependency PRs, a `c1addec` batch, and “209 tests / 81.83% lines”. Those figures are not regenerated here. Run `npm test` and `npm run test -- --coverage` in `apps/desktop` for the current numbers.
