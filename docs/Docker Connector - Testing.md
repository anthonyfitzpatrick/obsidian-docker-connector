---
tags: [docker-connector, testing]
---

# Docker Connector testing

Automated coverage currently contains 50 test files / 194 tests. It covers profile migration and validation, runtime secrets, local endpoints, Context discovery/lifecycle/routing, SSH and Mutual TLS boundaries, GET-only API policy, connection deletion, Applications grouping, selectors, update availability, typed lifecycle actions, update transactions, cancellation, and rollback paths. It does not replace live desktop or Docker validation.

## Manual functional checklist

Mark each item **PASS**, **FAIL**, or **NOT YET VERIFIED** with the environment and date. Use disposable Docker hosts and containers for every mutation test; never put credentials, private keys, certificate contents, registry credentials, or environment values in results.

| Area | Verification | Status |
| --- | --- | --- |
| Local Docker Socket | Connect; missing/broken/non-socket/permission cases | NOT YET VERIFIED |
| Docker Context | Discover; local and SSH routing; missing/changed Context; no active-context change | NOT YET VERIFIED |
| SSH password | Positive reconnect and rejected password | NOT YET VERIFIED |
| SSH private key | Unencrypted/encrypted key, passphrase, host-key trust/mismatch | NOT YET VERIFIED |
| Mutual TLS | Valid chain and client auth; invalid Server Name, IP SAN, DNS SAN, CA, and key pair | NOT YET VERIFIED |
| Connections | Add, Edit, Reconnect, Retry, status, delete/current/final profile | NOT YET VERIFIED |
| Views | Overview, Applications, Containers, Images, Volumes, Networks, Connections | NOT YET VERIFIED |
| Update checks | Current, available, Check now, coalescing, 24-hour stale interval | NOT YET VERIFIED |
| Management | Disabled boundary; enabled Start, Stop, Shut down, Restart | NOT YET VERIFIED |
| Update transaction | Preview cancel, update, rollback, backup retained, manual recovery | NOT YET VERIFIED |
| Obsidian lifecycle | Reload, switching, deletion cleanup, error recovery | NOT YET VERIFIED |
| UI | Light/dark, narrow pane, keyboard focus, Escape/modals | NOT YET VERIFIED |

## Automated commands

```bash
npm test
npm run lint
npm run build
git diff --check
```

See [[Docker Connector - Release Checklist]] for release gates and [[User Guide]] for the screenshot capture plan.
