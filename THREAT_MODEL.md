# Threat Model — Memex

## Assets
- Local SQLite DB (`conversations`, `messages`, `messages_fts`, `messages_vec`, `dashboard_cache`) — user’s AI conversation history.
- Imported JSON/zip exports from Claude/ChatGPT/Gemini/Grok.

## Actors
- **User** (trusted) — imports own data, searches locally.
- **Importer** (untrusted input) — zip/JSON may contain traversal or injection attempts.
- **Plugin** (semi-trusted) — `~/.memex/plugins/*.js` author.

## Boundaries
- Tauri frontend (React, `localhost:1420`) ↔ Rust backend (Tauri IPC, `tauri-plugin-sql`).
- FS allowlist: only `$HOME/Downloads` (import dialog) + `~/.memex/plugins` (plugin load).

## Mitigations
| Threat | Mitigation |
|--------|------------|
| Zip slip | `importer.ts` validates zip entry paths (`!entry.includes("..")`), rejects absolute. |
| FTS injection | `normalizeQuery` + `sanitizeSource` + `clampLimit/Offset`, `messages_fts MATCH $1` parameterized. |
| XSS snippet | `renderHighlightedSnippet` splits on `<mark>`/`</mark>`, no innerHTML. |
| XSS CSP | `tauri.conf.json` `csp` default-src self. |
| Supply chain | `cargo deny`, `cargo audit`, `npm audit`, SBOM `cargo cyclonedx`. |
| Secret leak | `gitleaks` + `trivy` in CI, `.env` gitignored. |

## Out of Scope
- OS-level compromise, keychain theft, physical access.

## Future
- At-rest encryption via `age` + `tauri-plugin-stronghold` (see NEXT_TIER Tier1 encrypted at-rest).
- Signed updater artifacts via `TAURI_SIGNING_PRIVATE_KEY`.
