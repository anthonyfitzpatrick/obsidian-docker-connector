---
tags: [docker-connector, release]
---

# Release Checklist

Use this checklist for a release candidate. Do not mark a manual item complete from automated coverage alone.

## Package and release assets

- [ ] Confirm `manifest.json`, `package.json`, `package-lock.json`, and `versions.json` have the intended matching version/minimum app version.
- [ ] Confirm the manifest ID, display name, description, and `isDesktopOnly: true` are current.
- [ ] Push the version tag and let `.github/workflows/release.yml` build it, attach exactly `main.js`, `manifest.json`, and `styles.css`, and publish their provenance attestations. Verify one with `gh attestation verify main.js --repo anthonyfitzpatrick/obsidian-docker-connector`.
- [ ] Confirm no source, `node_modules`, fixtures, credentials, or development configuration are needed by installers.

## Automated checks

- [ ] `npm test`
- [ ] `npm run lint` (TypeScript typecheck, then ESLint with typescript-eslint's type-checked rules and the Obsidian plugin check's own `eslint-plugin-obsidianmd` rules, at `--max-warnings 0`)
- [ ] `npm run build`
- [ ] `npm run release:check` (rebuilds and validates the staged three-file release package)
- [ ] `git diff --check`
- [ ] Review `npm audit --omit=dev` for anything reaching the bundle, then `npm audit` for the build tooling; record any unresolved advisory and its decision. Do not use a forced breaking upgrade without review.
- [ ] Confirm `npm ci` succeeds under an older npm as well as the current one, since the plugin check installs with its own.
- [ ] Search for debug logs, credentials, private paths, `shell: true`, disabled TLS verification, Context mutation, and insecure Docker TCP.

## Documentation and submission

- [ ] README links resolve and match shipped behavior.
- [ ] The canonical [[User Guide]] is current and every screenshot in it matches the shipped interface.
- [ ] Screenshot captures are real, redacted, reviewed, and use no fabricated/blank placeholder assets.
- [ ] [[Docker Connector - Obsidian Community Plugin Compliance]] and [[Docker Connector - Testing]] are current.
- [ ] Confirm Community directory plugin-ID/name uniqueness and submission requirements. Do not claim approval before it occurs.

## Manual functional validation — PASS for 1.1.14, 28-Aug-2026

Recorded in [[Docker Connector - Testing]]. Reset these boxes for the next release candidate: the record covers the build it was run against, not the repository.

- [ ] Local Docker Socket: positive connection and missing/permission-denied endpoint.
- [ ] Docker Context: CLI discovery, local endpoint, SSH endpoint, changed/missing Context, and no active-Context mutation.
- [ ] Remote Docker via SSH: password, private key, encrypted key/passphrase, host-key trust/mismatch, and remote Docker permission failure.
- [ ] Remote Docker API (Mutual TLS): valid certificate chain, cert/key mismatch, CA failure, DNS SAN failure, and IP SAN failure.
- [ ] Connections: Add, Edit, Reconnect, Retry, Delete, delete Current Environment, and delete final profile.
- [ ] Views: Overview, Applications, Containers, Images, Volumes, Networks, and Connections.
- [ ] Management disabled/enabled; Start, Stop, Shut down, Restart on disposable containers only.
- [ ] Image current, Update available, Check now, 24-hour stale behavior, successful update, rollback, and backup-retained recovery on disposable containers only.
- [ ] Obsidian reload, profile switching/deletion cleanup, error recovery, light/dark themes, keyboard navigation, and narrow panes.
