# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 0.6.x   | ✅        |
| <0.6    | ❌        |

## Reporting a Vulnerability

Please report vulnerabilities via GitHub Security Advisories or email `security@memex.local` (placeholder). Do not open public issues for sensitive flaws. We aim to respond within 48h and patch within 7 days.

## Threat Model

**Trust boundary:**
- App runs as local Tauri desktop with SQLite `WAL` + FTS5, no cloud sync. All data stays on device.
- Importer reads user-selected JSON/zip from `$HOME/Downloads` (scoped via `tauri-plugin-fs` allowlist).
- No remote code execution; plugins in `~/.memex/plugins/*.js` are evaluated with `new Function` and only `registerImporter` is injected.

**In scope:**
- Zip traversal during import (`importer.ts:133` guarded, fuzzed with `fast-check`).
- DB injection via FTS query (`validation.ts` + `sanitizeSource` + `clampLimit`).
- XSS via snippet `<mark>` highlighting (escaped, `renderHighlightedSnippet` splits on `<mark>`).
- Supply chain: `cargo audit`, `cargo deny` (licenses/advisories), `npm audit`, `cargo cyclonedx` SBOM, signed bundle via `tauri.conf.json` `bundle`.

**Out of scope:**
- OS keychain compromise (Stronghold `age` encryption future).
- Physical device access.

## Hardening

- `tauri.conf.json` `app.security.csp = "default-src 'self'; img-src 'self' data: https:; script-src 'self'; style-src 'self' 'unsafe-inline'"` — enforced CSP.
- `capabilities/default.json` `fs:allowReadFile` scoped to `$HOME/Downloads` and `PLUGIN_DIR` `~/.memex/plugins` only.
- `bundle` `publisher` + `createUpdaterArtifacts` + signing key via env `TAURI_SIGNING_PRIVATE_KEY` (placeholder, enforced in `release.yml`).
- CI: `cargo deny check advisories licenses`, `cargo audit`, `cargo cyclonedx` SBOM artifact, `gitleaks`, `trivy`.

## SBOM

SBOM generated via `cargo cyclonedx` (`apps/desktop/src-tauri/Cargo.toml`) and uploaded as `sbom.cyclonedx.json` artifact in CI (`sbom` job). See `.github/workflows/ci.yml: sbom`.

## Signed Builds

`tauri build --debug` smoke on PR, `tauri build` on tag with `TAURI_SIGNING_PRIVATE_KEY` + `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` (see `.github/workflows/release.yml`). Bundle creates signed updater artifacts.

## Verification

```bash
npm run lint && npm run typecheck && npm run test -- --coverage
cargo check && cargo clippy && cargo audit && cargo deny check
npm audit --audit-level=high
npx playwright test e2e/smoke.spec.ts
```
