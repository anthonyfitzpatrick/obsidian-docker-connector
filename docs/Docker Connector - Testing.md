---
tags: [docker-connector, testing]
---

# Docker Connector testing

Automated coverage currently contains 85 test files / 396 tests, plus an opt-in live harness of 16 checks that is skipped by default. It covers profile migration and validation, runtime secrets, local endpoints, Context discovery/lifecycle/routing, SSH and Mutual TLS boundaries, GET-only API policy, connection deletion, Applications grouping, selectors, update availability, typed lifecycle actions, update transactions, cancellation, and rollback paths.

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
| SSH password | Positive reconnect and rejected password | PASS. Positive reconnect verified on desktop 28-Aug-2026; rejected password automated the same day, returning authentication-required with `The SSH server rejected password authentication for user "…"`. That reason never used to reach the user, because `reconnectHost` records the outcome as a snapshot instead of throwing and the dialog closed as though it had worked; fixed in 1.1.10 and made legible in 1.1.11. |
| SSH private key | Unencrypted/encrypted key, passphrase, host-key trust/mismatch | PASS — automated 28-Aug-2026. Unencrypted key inspected online against Docker 26.1.5. An encrypted key gave the three expected outcomes in order: `requires a passphrase`, then `The private-key passphrase was rejected.`, then, with the right passphrase, `The SSH server rejected the selected private key` — the failure moving from passphrase to server proves decryption succeeded. A refused key returns authentication-required, the 1.1.13 change. A tampered fingerprint was blocked with `SSH host key changed.`, and a host with no trusted fingerprint was blocked with `SSH host identity must be trusted before connecting`. |
| Mutual TLS | Valid chain and client auth; invalid Server name, IP SAN, DNS SAN, CA, and key pair | PASS — automated 28-Aug-2026, and it found a defect. Valid material validated (client certificate valid to 11-Nov-2028) and inspected online against Docker 26.1.5. Mismatched certificate and key rejected by validation; a CA that does not vouch for the server refused; a client certificate the server does not accept refused; a Server name the certificate does not cover refused as both a DNS name and an IP. The IP spelling previously connected as online: SNI cannot carry an IP, so no servername was sent and Node verified against host, silently ignoring the configured Server name. Fixed in 1.1.14 with an explicit checkServerIdentity against the configured Server name. |
| Connections | Add, Edit, Reconnect, Retry, status, delete/current/final profile | NOT YET VERIFIED |
| Views | Overview, Applications, Containers, Images, Volumes, Networks, Connections | NOT YET VERIFIED |
| Update checks | Current, available, Check now, coalescing, 24-hour stale interval | NOT YET VERIFIED |
| Management | Disabled boundary; enabling asks through the **Enable container management** modal and the switch returns to its previous position on cancel; enabled Start, Stop, Shut down, Restart each confirm in a titled modal whose accepting button carries the action | NOT YET VERIFIED |
| Update transaction | Preview cancel, update, rollback, backup retained, manual recovery | NOT YET VERIFIED |
| Obsidian lifecycle | Reload, switching, deletion cleanup, error recovery | NOT YET VERIFIED |
| UI | Light/dark, narrow pane, keyboard focus, Escape/modals, and the settings tab rendering its three controls plus the About block from the declarative definitions | NOT YET VERIFIED |

## Live harness results, 28-Aug-2026

Read-only, against local Docker 29.6.1 and a remote Docker 26.1.5 host. All 16 checks passed, after the Server name defect they exposed was fixed.

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
| SSH encrypted key, no passphrase | authentication-required, passphrase required |
| SSH encrypted key, wrong passphrase | authentication-required, passphrase rejected |
| SSH encrypted key, right passphrase | decrypts; server then refuses the key |
| SSH changed host key | blocked, with a verification message |
| SSH untrusted host key | blocked, identity must be trusted first |
| TLS mismatched certificate and key | rejected by validation |
| TLS CA that does not vouch for the server | refused |
| TLS client certificate the server rejects | refused |
| TLS Server name not covered, DNS and IP | both refused (the IP spelling connected before 1.1.14) |
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
