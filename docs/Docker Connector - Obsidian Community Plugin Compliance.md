---
title: Docker Connector - Obsidian Community Plugin Compliance
status: review-ready
plugin-id: docker-connector
desktop-only: true
---

# Docker Connector - Obsidian Community Plugin Compliance

## Audit status

This is an engineering compliance record, not an Obsidian approval statement. **PASS** means the repository evidence satisfied the stated review item. **FIXED** records an issue corrected in the Part 1 audit. **MANUAL REVIEW** requires live desktop, mobile, or Docker validation before release. **NOT APPLICABLE** means the item is outside the plugin’s scope.

## Manifest and release — PASS

`manifest.json` uses the stable lowercase-hyphenated ID `docker-connector`, semantic version `1.1.9`, minimum Obsidian version `1.13.0`, and `isDesktopOnly: true`. The 1.13.0 floor is set by `ButtonComponent.setDestructive` and by the settings tab rendering from `getSettingDefinitions()` alone; the next constraint below it is `Workspace.revealLeaf` at 1.7.2. `versions.json` lists `1.1.9` only, which is the single published release. Desktop transport methods use Node APIs for sockets, SSH, TLS files, and bounded child processes. `package.json`, `manifest.json`, and `versions.json` are version-aligned. Release assets are [[main.js]], [[manifest.json]], and [[styles.css]].

This review was checked against the current official Obsidian documentation: [Manifest](https://docs.obsidian.md/Reference/Manifest), [Events](https://docs.obsidian.md/Plugins/Events), [Plugin load time](https://docs.obsidian.md/plugins/guides/load-time), [plugin self-critique checklist](https://docs.obsidian.md/oo/plugin), and [Community Plugin submission](https://docs.obsidian.md/Plugins/Releasing/Submit%20your%20plugin). These cover manifest and versioning rules, desktop-only declaration, lifecycle registration and timers, deferred startup work, Node/Electron implications, UI/style guidance, release assets, README/LICENSE expectations, and submission workflow. The review also verified the repository's privacy, external-resource, dependency, command, filesystem, child-process, network, CSS, and accessibility boundaries against those requirements and the published developer policies referenced by the submission guide.

## Lifecycle, events, and timers — PASS / FIXED

Startup registration is lightweight; host refresh is deferred until the workspace layout is ready. Plugin and view cleanup stop refresh timers, clear view subscriptions and debounced UI timers, cancel update checks, clear caches and runtime credentials, close transports, and bound active-update recovery. The audit fixed malformed/duplicate persisted profile handling so untrusted `data.json` records cannot reach a view or transport, and fixed cancellation so a deleted profile cannot receive a late image-update status.

## Security boundaries — PASS

Generic Docker Engine access is allowlisted and GET-only through [[DockerApiClient]]. Typed lifecycle and update operations are confined to [[DockerContainerActionService]], recheck the explicit container-management opt-in, and do not offer arbitrary POST or DELETE routes. Management is disabled by default. Update checks pull through the selected Docker daemon but never recreate a container automatically. Update rollback keeps the original container or backup and never force-deletes volumes.

Docker connection methods are documented in [[Docker Connector - Connection Architecture]]. Local sockets, SSH, named Docker Contexts, and mutual TLS are the only supported transports. Docker Context execution uses `docker --context <name> system dial-stdio` without changing the active Context. Insecure TCP and disabled certificate verification are unsupported. Child processes use fixed argument arrays, `shell: false`, timeouts, and bounded output. The unreachable macOS system-SSH diagnostic was removed rather than left in the bundle. No Docker Context create/use/remove/import/export command is used.

## Filesystem, network, DOM, CSS, and accessibility — PASS

Settings persist non-secret profile metadata only. [[Docker Connector - Runtime Credentials]] documents the default runtime-only boundary for SSH passwords, SSH key passphrases, and TLS client-key passphrases, plus the explicit per-profile unencrypted plugin-data exception for remembered SSH passwords where no supported Obsidian keychain API exists. Certificate and private-key contents, registry credentials, container environment values, and raw inspect payloads are not persisted or copied into safe diagnostics. Explicitly selected paths are read for key/certificate/socket functionality; no recursive filesystem scan occurs.

There is no telemetry, analytics, cloud service, remote script, remote CSS, or runtime executable-code download. Network activity is limited to configured Docker/SSH/TLS/Context connections, public registry lookups for advisory image-release checks, and Docker-daemon pulls used solely for image-ID checking/updating. Docker metadata is rendered with Obsidian DOM text APIs rather than HTML insertion. Clipboard and diagnostics exclude secrets. CSS is scoped under the plugin namespace, uses Obsidian variables, and includes visible focus and responsive/reduced-motion treatment.

## Dependency advisories — MANUAL REVIEW

`npm audit --omit=dev` reports no vulnerabilities, so nothing advisory reaches the shipped bundle. The full tree reports one moderate advisory, GHSA-67mh-4wv8-2f99, against `esbuild`'s development server. That server is never started: esbuild is used only as a one-shot bundler in `npm run build`. The earlier high advisory for transitive `nanoid` is gone with the move to vitest 3. Re-run `npm audit` at release time and record the result.

## Documentation and automated validation — PASS

The canonical [[User Guide]] and README document four desktop connection methods; privilege model; settings; Applications; inventories; update checks; explicit profile-scoped management; rollback limits; privacy model; troubleshooting; FAQ; and 41 captured screenshots, each centred and width-limited.

The Obsidian plugin check's own rules run in this repository. `eslint-plugin-obsidianmd` is a dev dependency, its recommended configuration is enabled in `eslint.config.mjs` alongside typescript-eslint's type-checked rules, and `npm run lint` runs both with `--max-warnings 0`, so any finding fails the build. `.github/workflows/release.yml` runs lint and the test suite from the pushed tag, verifies `npm ci` succeeds under npm 10 as well as the runner's npm, and publishes build provenance attestations for `main.js`, `manifest.json`, and `styles.css`.

## Manual Marketplace submission checks — MANUAL REVIEW

Before submission, verify the plugin ID and name are unique in the Community directory, commit the accurate manifest on the default branch, and create a GitHub release whose tag exactly matches `manifest.json`'s semantic version. Attach `main.js`, `manifest.json`, and `styles.css` to that release. Inspect the installed UI on supported desktop platforms and run live-Docker mutation tests only against disposable environments. This document records implementation review; it does not claim official Obsidian approval.

Current Obsidian guidance prefers distributing `main.js` as a release attachment rather than committing it to the source repository. This vault-local plugin currently tracks its built bundle so Obsidian can load the working copy. Decide the release-repository policy before submission; do not remove the local bundle from this active vault without an alternative build/release workflow.

## Required release-candidate validation — PASS for 1.1.14, 28-Aug-2026

Every row of [[Docker Connector - Testing]] is PASS for this build. The connection rows are reproducible through the read-only live harness; the interface and mutation rows were verified by hand. Both must be repeated for the next release candidate.

That verification changed the build. It found a mutual TLS profile whose Server name is an IP that differs from the host connecting as online, because SNI cannot carry an IP literal and Node then verified the certificate against the host instead. 1.1.14 supplies an explicit `checkServerIdentity` against the configured Server name.

- Test Local Docker Socket, Docker Context, SSH password, SSH private key, and Mutual TLS—including an invalid server identity—on disposable/non-production environments.
- Test connection Add/Edit/Reconnect/Retry/Delete, including deleting the Current Environment and final profile.
- Test all views in light/dark themes and narrow panes; verify keyboard focus, modals, and status communication.
- Test lifecycle actions and update/rollback/backup-retention only on disposable containers.
- Reload Obsidian and the plugin; verify default session-only credentials are not retained, the explicit remembered SSH-password option behaves as documented, host-key mismatches still block reconnect, and no stale status returns after deletion.

## User-facing documentation

[[User Guide]] is the end-user starting point and [[README]] provides the Marketplace-facing overview. Both identify the desktop-only limit, all four supported connection methods, Compose-label Applications, profile-scoped session-only management, image-update limitations, privilege warning, no-telemetry policy, runtime credentials by default, and the explicit unencrypted remembered SSH-password exception, installation, and troubleshooting. Technical notes remain linked from the guide rather than being required reading for a first-time user.
