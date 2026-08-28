---
tags: [docker-connector, testing]
---

# Docker Connector testing

Automated coverage currently contains 85 test files / 395 tests, plus an opt-in live harness of 10 checks that is skipped by default. It covers profile migration and validation, runtime secrets, local endpoints, Context discovery/lifecycle/routing, SSH and Mutual TLS boundaries, GET-only API policy, connection deletion, Applications grouping, selectors, update availability, typed lifecycle actions, update transactions, cancellation, and rollback paths.

It also guards the release itself: the community-plugin compliance suite asserts the manifest and `versions.json` agree, that `minAppVersion` covers the Obsidian APIs the code calls, that confirmation goes through the Obsidian modal rather than a browser dialog, that the stylesheet avoids `!important`, `:has`, and `display: contents`, that no element styles are assigned directly, that the settings tab is described once for rendering and search, and that the type packages stay installable without dev dependencies.

`tests/liveDockerEnvironment.manual.test.ts` drives the real transports against a real Docker environment and is skipped unless it is asked for:

```bash
DOCKER_CONNECTOR_LIVE=1 \
  DOCKER_CONNECTOR_VAULT="<vault>/.obsidian/plugins/docker-connector/data.json" \
  DOCKER_CONNECTOR_UNAUTHORISED_KEY="<throwaway key>" \
  npx vitest run tests/liveDockerEnvironment.manual.test.ts
```

It is read-only: it inspects hosts and never starts, stops, creates or deletes anything, so it covers connectivity but no mutation. It reads profiles from a vault's `data.json` and needs whatever credentials those profiles require; it stores nothing.

None of this replaces driving the plugin in Obsidian. The table below records where each row stands.

## Manual functional checklist

Mark each item **PASS**, **FAIL**, or **NOT YET VERIFIED** with the environment and date. Use disposable Docker hosts and containers for every mutation test; never put credentials, private keys, certificate contents, registry credentials, or environment values in results.

| Area | Verification | Status |
| --- | --- | --- |
| Local Docker Socket | Connect; missing/broken/non-socket/permission cases | PASS — desktop, 28-Aug-2026. Connection also automated 28-Aug-2026: endpoint discovery found 1 socket and inspection returned online, Docker 29.6.1. Missing, broken, non-socket and permission-denied cases remain manual. |
| Docker Context | Discover; local and SSH routing; missing/changed Context; no active-context change | PASS — desktop, 28-Aug-2026. Automated 28-Aug-2026: discovery listed `default` and `desktop-linux`, the saved Context inspected online, and `docker context show` was unchanged either side of the call. Missing and changed Context remain manual. |
| SSH password | Positive reconnect and rejected password | PARTIAL. Positive reconnect PASS — desktop, 28-Aug-2026. Rejected password automated 28-Aug-2026: authentication-required carrying `The SSH server rejected password authentication for user "…"`. That reason previously never reached the user, because `reconnectHost` records the outcome as a snapshot instead of throwing and the dialog closed as though it had worked; fixed in 1.1.10, made legible and moved under the field in 1.1.11. The dialog itself still needs one manual look. |
| SSH private key | Unencrypted/encrypted key, passphrase, host-key trust/mismatch | PARTIAL — automated 28-Aug-2026. Unencrypted key inspected online against Docker 26.1.5. A key the server refuses returned authentication-required carrying `The SSH server rejected the selected private key for user "…"`, which is the 1.1.13 classification change. A tampered host-key fingerprint was blocked with `SSH host key changed. Verify the server before reconnecting.` Encrypted key with passphrase, and first-time host-key trust, remain manual. |
| Mutual TLS | Valid chain and client auth; invalid Server name, IP SAN, DNS SAN, CA, and key pair | PARTIAL — automated 28-Aug-2026. TLS material validated (client certificate valid to 11-Nov-2028) and the host inspected online against Docker 26.1.5. Every negative case — invalid Server name, IP SAN, DNS SAN, CA, and mismatched key pair — remains manual. |
| Connections | Add, Edit, Reconnect, Retry, status, delete/current/final profile | NOT YET VERIFIED |
| Views | Overview, Applications, Containers, Images, Volumes, Networks, Connections | NOT YET VERIFIED |
| Update checks | Current, available, Check now, coalescing, 24-hour stale interval | NOT YET VERIFIED |
| Management | Disabled boundary; enabling asks through the **Enable container management** modal and the switch returns to its previous position on cancel; enabled Start, Stop, Shut down, Restart each confirm in a titled modal whose accepting button carries the action | NOT YET VERIFIED |
| Update transaction | Preview cancel, update, rollback, backup retained, manual recovery | NOT YET VERIFIED |
| Obsidian lifecycle | Reload, switching, deletion cleanup, error recovery | NOT YET VERIFIED |
| UI | Light/dark, narrow pane, keyboard focus, Escape/modals, and the settings tab rendering its three controls plus the About block from the declarative definitions | NOT YET VERIFIED |

## Live harness results, 28-Aug-2026

Read-only, against local Docker 29.6.1 and a remote Docker 26.1.5 host. All 10 checks passed.

| Check | Result |
| --- | --- |
| Local endpoint discovery | 1 endpoint |
| Local socket inspection | online, Docker 29.6.1 |
| Context discovery | `default`, `desktop-linux` |
| Saved Context inspection | online, Docker 29.6.1 |
| Active Context unchanged | `desktop-linux` before and after |
| SSH private key inspection | online, Docker 26.1.5, 16 containers |
| SSH rejected password | authentication-required, with the server's reason |
| SSH refused private key | authentication-required, with the server's reason |
| SSH changed host key | blocked, connection refused with a verification message |
| Mutual TLS inspection | certificate validated, online, Docker 26.1.5 |

Not covered by the harness, because it performs no mutation and does not drive the interface: every management action, the update transaction and its rollback, and everything in the Connections, Views, Update checks, Obsidian lifecycle and UI rows below.

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
