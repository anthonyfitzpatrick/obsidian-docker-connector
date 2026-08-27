---
tags: [docker-connector, container-management]
---

# Container Management

[[Docker Connector]] is read-only by default. Use the **Container management** switch on an individual Online trusted Docker connection's card in **Connections**. Authorization is profile-scoped and session-only, resets after restarting or reloading Obsidian, and is cleared on connection loss, edit, or deletion. Reconnecting never restores authorization; enable it explicitly again. Applications remain read-only and Compose-managed standalone Update remains blocked. Credentials remain session-only by default; see [[Docker Connector - Runtime Credentials]] for the explicit remembered SSH password exception.

Management authorization is never persisted. Enabling first asks for confirmation. The switch is unavailable for All Docker hosts and for any non-Online connection.

Each Connections card carries its own switch for that profile's runtime authorization. Only an individual Online profile can be enabled; **All Docker hosts** and Offline, Degraded, Authentication required, Unknown, Connecting, or unsupported profiles remain unavailable. If an enabled profile leaves Online, its authorization is cleared immediately and does not return on reconnect. The typed backend mutation gate also rechecks that the profile is still Online.

When enabled, the container detail panel shows state-appropriate actions and requires confirmation before Start, Stop, Shut down, or Restart. Shut down uses Docker's graceful stop endpoint with a 30 second wait; Stop uses 10 seconds. Every accepted action triggers a coordinated refresh.

Lifecycle actions accept Docker's valid `204 No Content` responses. A failed action keeps the action grid visible and shows a bounded safe failure panel with the action, error code, HTTP status when available, retry, and safe diagnostics. [[Docker Connector - Container Lifecycle Actions]]

The generic [[Docker Connector - Read-Only API Policy]] remains GET-only. Lifecycle mutations pass through a dedicated, typed allowlist and cannot be entered as arbitrary Docker paths. No volume, network, image, or arbitrary container deletion route is exposed.

Standalone Update is explicit and confirmed: it inspects the container, pulls its exact repository/tag, renames the stopped original to a temporary backup, creates the replacement, verifies it, then removes the backup without volumes. Compose-managed containers remain blocked and must be updated through Docker Compose. [[Docker Connector - Safe Container Updates]]
