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

`manifest.json` uses the stable lowercase-hyphenated ID `docker-connector`, semantic version `1.0.0`, minimum Obsidian version `1.7.0`, and `isDesktopOnly: true`. Desktop transport methods use Node APIs for sockets, SSH, TLS files, and bounded child processes. `package.json`, `manifest.json`, and `versions.json` are version-aligned. Release assets are [[main.js]], [[manifest.json]], and [[styles.css]].

This review was checked against the current official Obsidian documentation: [Manifest](https://docs.obsidian.md/Reference/Manifest), [Events](https://docs.obsidian.md/Plugins/Events), [Plugin load time](https://docs.obsidian.md/plugins/guides/load-time), [plugin self-critique checklist](https://docs.obsidian.md/oo/plugin), and [Community Plugin submission](https://docs.obsidian.md/Plugins/Releasing/Submit%20your%20plugin). These cover manifest and versioning rules, desktop-only declaration, lifecycle registration and timers, deferred startup work, Node/Electron implications, UI/style guidance, release assets, README/LICENSE expectations, and submission workflow. The review also verified the repository's privacy, external-resource, dependency, command, filesystem, child-process, network, CSS, and accessibility boundaries against those requirements and the published developer policies referenced by the submission guide.

## Lifecycle, events, and timers — PASS / FIXED

Startup registration is lightweight; host refresh is deferred until the workspace layout is ready. Plugin and view cleanup stop refresh timers, clear view subscriptions and debounced UI timers, cancel update checks, clear caches and runtime credentials, close transports, and bound active-update recovery. The audit fixed malformed/duplicate persisted profile handling so untrusted `data.json` records cannot reach a view or transport, and fixed cancellation so a deleted profile cannot receive a late image-update status.

## Security boundaries — PASS

Generic Docker Engine access is allowlisted and GET-only through [[DockerApiClient]]. Typed lifecycle and update operations are confined to [[DockerContainerActionService]], recheck the explicit container-management opt-in, and do not offer arbitrary POST or DELETE routes. Management is disabled by default. Update checks pull through the selected Docker daemon but never recreate a container automatically. Update rollback keeps the original container or backup and never force-deletes volumes.

Docker connection methods are documented in [[Docker Connector - Connection Architecture]]. Local sockets, SSH, named Docker Contexts, and mutual TLS are the only supported transports. Docker Context execution uses `docker --context <name> system dial-stdio` without changing the active Context. Insecure TCP and disabled certificate verification are unsupported. Child processes use fixed argument arrays, `shell: false`, timeouts, and bounded output. The audit made the optional macOS system-SSH diagnostic explicit about those limits. No Docker Context create/use/remove/import/export command is used.

## Filesystem, network, DOM, CSS, and accessibility — PASS

Settings persist non-secret profile metadata only. [[Docker Connector - Runtime Credentials]] documents the default runtime-only boundary for SSH passwords, SSH key passphrases, and TLS client-key passphrases, plus the explicit per-profile unencrypted plugin-data exception for remembered SSH passwords where no supported Obsidian keychain API exists. Certificate and private-key contents, registry credentials, container environment values, and raw inspect payloads are not persisted or copied into safe diagnostics. Explicitly selected paths are read for key/certificate/socket functionality; no recursive filesystem scan occurs.

There is no telemetry, analytics, cloud service, remote script, remote CSS, or runtime executable-code download. Network activity is limited to configured Docker/SSH/TLS/Context connections, public registry lookups for advisory image-release checks, and Docker-daemon pulls used solely for image-ID checking/updating. Docker metadata is rendered with Obsidian DOM text APIs rather than HTML insertion. Clipboard and diagnostics exclude secrets. CSS is scoped under the plugin namespace, uses Obsidian variables, and includes visible focus and responsive/reduced-motion treatment.

## Dependency advisories — MANUAL REVIEW

Part 1’s `npm audit` reported a moderate advisory for transitive `esbuild` and a high advisory for transitive `nanoid`. The available esbuild remediation required a breaking upgrade, so this documentation/release pass does not apply it automatically. Re-run and assess `npm audit` at release time; record the result and any accepted risk in the release notes.

## Documentation and automated validation — PASS

The canonical [[User Guide]] and README document four desktop connection methods; privilege model; settings; Applications; inventories; update checks; explicit profile-scoped management; rollback limits; privacy model; troubleshooting; FAQ; and 43 numbered screenshot capture specifications. Automated validation must be repeated for the release candidate.

## Manual Marketplace submission checks — MANUAL REVIEW

Before submission, verify the plugin ID and name are unique in the Community directory, commit the accurate manifest on the default branch, and create a GitHub release whose tag exactly matches `manifest.json`'s semantic version. Attach `main.js`, `manifest.json`, and `styles.css` to that release. Inspect the installed UI on supported desktop platforms and run live-Docker mutation tests only against disposable environments. This document records implementation review; it does not claim official Obsidian approval.

Current Obsidian guidance prefers distributing `main.js` as a release attachment rather than committing it to the source repository. This vault-local plugin currently tracks its built bundle so Obsidian can load the working copy. Decide the release-repository policy before submission; do not remove the local bundle from this active vault without an alternative build/release workflow.

## Required release-candidate validation — MANUAL REVIEW

- Test Local Docker Socket, Docker Context, SSH password, SSH private key, and Mutual TLS—including an invalid server identity—on disposable/non-production environments.
- Test connection Add/Edit/Reconnect/Retry/Delete, including deleting the Current Environment and final profile.
- Test all views in light/dark themes and narrow panes; verify keyboard focus, modals, and status communication.
- Test lifecycle actions and update/rollback/backup-retention only on disposable containers.
- Reload Obsidian and the plugin; verify default session-only credentials are not retained, the explicit remembered SSH-password option behaves as documented, host-key mismatches still block reconnect, and no stale status returns after deletion.

## User-facing documentation

[[User Guide]] is the end-user starting point and [[README]] provides the Marketplace-facing overview. Both identify the desktop-only limit, all four supported connection methods, Compose-label Applications, profile-scoped session-only management, image-update limitations, privilege warning, no-telemetry policy, runtime credentials by default, and the explicit unencrypted remembered SSH-password exception, installation, and troubleshooting. Technical notes remain linked from the guide rather than being required reading for a first-time user.
