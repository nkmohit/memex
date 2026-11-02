# Threat Model — Memex

## Assets

- Local SQLite file: `conversations`, `messages`, `messages_fts`, `messages_vec` (hash embeddings as JSON), `app_meta`, `dashboard_cache`.
- JSON exports the user chooses to import (Claude, ChatGPT, Gemini, Grok shapes).

## Actors

- **User.** Imports their own files and searches locally.
- **Import file.** Untrusted JSON. The app reads it as text and runs the matching parser. It does not unpack archives.
- **Plugin author.** `loadPlugins()` would read `~/.memex/plugins/*.js` and evaluate it. The desktop UI does not call `loadPlugins()`. A caller that did would be running arbitrary JS in the webview, limited only by a regex denylist in `plugins/sandbox.ts`.

## Boundaries

- React UI (`localhost:1420` in dev) talks to SQLite through `@tauri-apps/plugin-sql`.
- Rust commands: `get_diagnostics` only (`src-tauri/src/commands/diagnostics.rs`).
- FS capability: read text and exists under `$HOME/Downloads/**` and `$HOME/Documents/**`. No plugin-directory grant.

## Mitigations that exist

| Threat | What the code does |
| --- | --- |
| Unexpected source string in search | `sanitizeSource` allows known source ids |
| Huge limit/offset | `clampLimit`, `clampOffset` |
| FTS query shape | `normalizeQuery` builds prefix tokens; the `MATCH` text is a bound parameter |
| HTML in snippets | `renderHighlightedSnippet` splits on `<mark>` markers and uses React text nodes |
| CSP | `app.security.csp` in `tauri.conf.json` |
| Dependency advisories | `npm audit` (high) and `cargo deny` in CI; gitleaks on the git history |
| Secrets in the repo | `.env` is gitignored. `.env.example` only documents `TAURI_DEV_HOST` |

## Not mitigated here

- The SQLite file is plaintext on disk. `crypto.rs` does not wrap it.
- Disk plugins are not sandboxed. They are also not loaded by the running app.
- `cargo audit` and Trivy are not CI jobs. Clippy and CycloneDX do not fail the build.
- Release artifacts are not signed by this workflow.
- `generated_at` on the Rust diagnostics command is always `0`.

## Not in this product

At-rest encryption (`age`, Stronghold, SQLCipher) and signed updater artifacts. They are not implemented. `FUTURE.md` is the list of other product ideas.
