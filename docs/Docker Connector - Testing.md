---
tags: [docker-connector, testing]
---

# Docker Connector testing

Automated coverage currently contains 85 test files / 393 tests. It covers profile migration and validation, runtime secrets, local endpoints, Context discovery/lifecycle/routing, SSH and Mutual TLS boundaries, GET-only API policy, connection deletion, Applications grouping, selectors, update availability, typed lifecycle actions, update transactions, cancellation, and rollback paths.

It also guards the release itself: the community-plugin compliance suite asserts the manifest and `versions.json` agree, that `minAppVersion` covers the Obsidian APIs the code calls, that confirmation goes through the Obsidian modal rather than a browser dialog, that the stylesheet avoids `!important`, `:has`, and `display: contents`, that no element styles are assigned directly, that the settings tab is described once for rendering and search, and that the type packages stay installable without dev dependencies.

None of this replaces live desktop or Docker validation. The table below is what only a person at a real Docker host can establish.

## Manual functional checklist

Mark each item **PASS**, **FAIL**, or **NOT YET VERIFIED** with the environment and date. Use disposable Docker hosts and containers for every mutation test; never put credentials, private keys, certificate contents, registry credentials, or environment values in results.

| Area | Verification | Status |
| --- | --- | --- |
| Local Docker Socket | Connect; missing/broken/non-socket/permission cases | PASS — desktop, 28-Aug-2026 |
| Docker Context | Discover; local and SSH routing; missing/changed Context; no active-context change | PASS — desktop, 28-Aug-2026 |
| SSH password | Positive reconnect and rejected password | PARTIAL — desktop, 28-Aug-2026. Positive reconnect PASS. A rejected password gave the user no feedback: the dialog closed as though it had worked, because `reconnectHost` records the outcome as a snapshot instead of throwing. Fixed in 1.1.10; re-verify. |
| SSH private key | Unencrypted/encrypted key, passphrase, host-key trust/mismatch | NOT YET VERIFIED |
| Mutual TLS | Valid chain and client auth; invalid Server name, IP SAN, DNS SAN, CA, and key pair | NOT YET VERIFIED |
| Connections | Add, Edit, Reconnect, Retry, status, delete/current/final profile | NOT YET VERIFIED |
| Views | Overview, Applications, Containers, Images, Volumes, Networks, Connections | NOT YET VERIFIED |
| Update checks | Current, available, Check now, coalescing, 24-hour stale interval | NOT YET VERIFIED |
| Management | Disabled boundary; enabling asks through the **Enable container management** modal and the switch returns to its previous position on cancel; enabled Start, Stop, Shut down, Restart each confirm in a titled modal whose accepting button carries the action | NOT YET VERIFIED |
| Update transaction | Preview cancel, update, rollback, backup retained, manual recovery | NOT YET VERIFIED |
| Obsidian lifecycle | Reload, switching, deletion cleanup, error recovery | NOT YET VERIFIED |
| UI | Light/dark, narrow pane, keyboard focus, Escape/modals, and the settings tab rendering its three controls plus the About block from the declarative definitions | NOT YET VERIFIED |

## Automated commands

```bash
npm test            # 84 files / 389 tests
npm run lint        # typecheck, then typescript-eslint type-checked rules and
                    # eslint-plugin-obsidianmd, the plugin check's own rules,
                    # at --max-warnings 0
npm run build
npm run release:check
git diff --check
```

`.github/workflows/release.yml` runs lint and the suite from the pushed tag, checks that `npm ci` also succeeds under npm 10, and attests the published assets.

See [[Docker Connector - Release Checklist]] for release gates and [[User Guide]] for the illustrated end-user manual.
