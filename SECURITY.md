# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

Please open a private security advisory on GitHub or email the maintainer listed in `Cargo.toml`/`package.json`. Do not open a public issue for sensitive reports.

## Hardening in this repo

- No secrets are committed (`.env` is ignored; `.env.example` is the template).
- `npm audit --audit-level=high` runs in CI and fails the build on high-severity advisories.
- Inputs at SQL boundaries are validated via `apps/desktop/src/lib/validation.ts`:
  - `sanitizeSource`, `clampLimit`, `clampOffset`, `sanitizeQuery`, etc.
  - Conversation IDs and timestamps are range-checked before use.
- `cargo audit` is recommended locally (`cargo install cargo-audit && cargo audit`).

We welcome PRs that improve validation and audit coverage.
