# Security Policy

## Supported Versions

| File | Version field |
| --- | --- |
| `apps/desktop/package.json` | 0.8.0 |
| `apps/desktop/src-tauri/Cargo.toml` | 0.8.0 |
| `apps/desktop/src-tauri/tauri.conf.json` | 0.6.0 |
| `packages/core/package.json` | 0.1.0 |

These are the version strings checked into the repo. The project does not publish a separate support window. See `THREAT_MODEL.md` for how the local app is bounded.

## Reporting a vulnerability

Use GitHub Security Advisories for this repository. The address `security@memex.local` in older copies of this file is not a monitored mailbox.

## What the app actually trusts

- The process is a local Tauri shell. SQLite is opened in WAL mode. There is no cloud sync in the client.
- Import reads a user-selected file with `readTextFile`. The capability allowlist is `$HOME/Downloads/**` and `$HOME/Documents/**` for `fs:allow-read-text-file` and `fs:allow-exists` (`capabilities/default.json`). The importer does not parse zip files, so there is no zip-slip check and no `fast-check` fuzz suite.
- `tauri.conf.json` sets `app.security.csp` to `default-src 'self'; img-src 'self' data: https:; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' ipc: http://ipc.localhost`.
- FTS queries use bound parameters (`$1`, `$2`, …). `sanitizeSource` limits the source filter. `clampLimit` / `clampOffset` bound page size.
- Snippet strings that contain the literal markers `<mark>` and `</mark>` are split in `renderHighlightedSnippet` and rendered as React children.

## What is not protected

- **At rest.** `memex.db` is a normal SQLite file. The app has no encryption module.
- **Plugins.** There is no plugin evaluator. `loadPlugins()` returns 0. In-memory `registerImporter` is for callers in the same JS realm (used by tests).

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
