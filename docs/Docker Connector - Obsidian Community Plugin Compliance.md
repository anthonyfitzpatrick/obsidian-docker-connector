---
title: Docker Connector - Obsidian Community Plugin Compliance
status: review-ready
plugin-id: docker-connector
desktop-only: true
---

# Docker Connector - Obsidian Community Plugin Compliance

## Manifest and release

`manifest.json` uses the stable lowercase-hyphenated ID `docker-connector`, semantic version `1.0.0`, minimum Obsidian version `1.7.0`, and `isDesktopOnly: true`. Desktop-only status is required because the plugin uses Node APIs for sockets, SSH, TLS files, and bounded child processes. `package.json`, `manifest.json`, and `versions.json` are version-aligned. Release assets are [[main.js]], [[manifest.json]], and [[styles.css]].

## Security boundaries

Generic Docker Engine access is allowlisted and GET-only through [[DockerApiClient]]. Typed lifecycle and update operations are confined to [[DockerContainerActionService]], recheck the explicit container-management opt-in, and do not offer arbitrary POST or DELETE routes. Management is disabled by default. Update checks pull through the selected Docker daemon but never recreate a container automatically. Update rollback keeps the original container or backup and never force-deletes volumes.

Docker connection methods are documented in [[Docker Connector - Connection Architecture]]. Local sockets, SSH, named Docker Contexts, and mutual TLS are the only supported transports. Docker Context execution uses `docker --context <name> system dial-stdio` without changing the active Context. Insecure TCP and disabled certificate verification are unsupported. Child processes use fixed argument arrays, `shell: false`, timeouts, and bounded stderr. No Docker Context create/use/remove/import/export command is used.

## Data, network, and UI safety

Settings persist non-secret profile metadata only. [[Docker Connector - Runtime Credentials]] documents why SSH passwords, SSH key passphrases, and TLS client-key passphrases are runtime-only. Certificate and private-key contents, registry credentials, container environment values, and raw inspect payloads are not persisted or copied into safe diagnostics. Explicitly selected paths are read for key/certificate/socket functionality; no recursive filesystem scan occurs.

There is no telemetry, analytics, cloud service, remote script, remote CSS, or runtime executable-code download. Network activity is limited to configured Docker/SSH/TLS/Context connections and public registry lookups for advisory image-release checks. Docker metadata is rendered with Obsidian DOM text APIs rather than HTML insertion. Clipboard and diagnostics exclude secrets.

## Lifecycle and review items

Plugin unload stops refreshes, cancels and bounds active update recovery, clears caches and runtime credentials through transport shutdown, and detaches the view. View-local timers and settings subscriptions are cleared on close. The plugin uses Obsidian registration helpers where they fit long-lived plugin lifecycle ownership.

## Manual Marketplace submission checks

Before submission, verify the plugin ID and name are unique in the Community directory, commit the accurate manifest on the default branch, and create a GitHub release whose tag exactly matches `manifest.json`'s semantic version. Attach `main.js`, `manifest.json`, and `styles.css` to that release. Inspect the installed UI on supported desktop platforms and run live-Docker mutation tests only against disposable environments. This document records implementation review; it does not claim official Obsidian approval.

Current Obsidian guidance prefers distributing `main.js` as a release attachment rather than committing it to the source repository. This vault-local plugin currently tracks its built bundle so Obsidian can load the working copy. Decide the release-repository policy before submission; do not remove the local bundle from this active vault without an alternative build/release workflow.

## User-facing documentation

[[Docker Connector - User Guide]] is the end-user starting point and [[README]] provides the Marketplace-facing overview. Both identify the desktop-only requirement, all four supported connection methods, Compose-label Applications, optional management, image-update limitations, privilege warning, no-telemetry policy, runtime-only credentials, installation, and troubleshooting. Technical notes remain linked from the guide rather than being required reading for a first-time user.
