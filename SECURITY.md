# Security Policy

## Versions in the repo

| File | Version field |
| --- | --- |
| `apps/desktop/package.json` | 0.8.0 |
| `apps/desktop/src-tauri/Cargo.toml` | 0.8.0 |
| `apps/desktop/src-tauri/tauri.conf.json` | 0.6.0 |
| `packages/core/package.json` | 0.1.0 |

There is no separate support matrix beyond what is on the default branch.

## Reporting a vulnerability

Use GitHub Security Advisories for this repository. The address `security@memex.local` in older copies of this file is not a monitored mailbox.

## What the app actually trusts

- The process is a local Tauri shell. SQLite is opened in WAL mode. There is no cloud sync in the client.
- Import reads a user-selected file with `readTextFile`. The capability allowlist is `$HOME/Downloads/**` and `$HOME/Documents/**` for `fs:allow-read-text-file` and `fs:allow-exists` (`capabilities/default.json`). The importer does not parse zip files, so there is no zip-slip check and no `fast-check` fuzz suite.
- `tauri.conf.json` sets `app.security.csp` to `default-src 'self'; img-src 'self' data: https:; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' ipc: http://ipc.localhost`.
- FTS queries use bound parameters (`$1`, `$2`, …). `sanitizeSource` limits the source filter. `clampLimit` / `clampOffset` bound page size.
- Snippet strings that contain the literal markers `<mark>` and `</mark>` are split in `renderHighlightedSnippet` and rendered as React children.

## What is not a security control

- **At-rest encryption.** `crypto.rs` XORs with a caller-supplied key. `get_diagnostics` reports `encrypted: true` when the environment variable `MEMEX_ENCRYPTED` is `1` or `true`. The database connection never applies a key. XOR is not confidentiality for the SQLite file.
- **Plugin sandbox.** `plugins/sandbox.ts` is a regex denylist (`process`, `require`, `fetch`, and similar). `loadPlugins()` compiles the file with `new Function` and passes `registerImporter`. The regexes do not define a sandbox. The function is not called on startup. The FS allowlist does not include `~/.memex/plugins`.
- **`messages_vec`.** Stores the hash embedder output. It is not encryption and not access control.

## Supply chain checks that CI runs

From `.github/workflows/ci.yml`:

- `npm audit --audit-level=high`
- `cargo deny check advisories licenses bans sources` (in `rust-check` and `sbom`)
- gitleaks (`gitleaks/gitleaks-action@v2`)
- `cargo check`
- `cargo clippy -- -D warnings` with `|| echo`, so clippy findings do not fail the job
- `cargo cyclonedx` with `|| echo`, so a missing SBOM does not fail the job. The workflow uploads `sbom.cyclonedx.json` when the file exists.

These are not in CI: `cargo audit`, Trivy, a signing step, `tauri build` on the release workflow (release runs `cargo check` and uploads the Vite `dist`). `bundle.createUpdaterArtifacts` is `true` in config, and no signing private key is wired in `release.yml`.

## Out of scope for this document

Physical access to the machine, and any future keychain design. Neither is implemented.

## Checks you can run locally

```bash
npm run lint --prefix apps/desktop
npm run typecheck --prefix apps/desktop
npm run test --prefix apps/desktop
npm audit --audit-level=high
# from apps/desktop/src-tauri, with cargo-deny installed:
cargo deny check advisories licenses bans sources
cargo check
```
