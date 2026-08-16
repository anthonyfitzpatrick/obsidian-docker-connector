---
tags: [docker-connector, container-management]
---

# Container Management

[[Docker Connector]] is read-only by default. Enable **Container management** in Settings only for trusted Docker hosts. Authorization applies to open container details immediately, is session-only, and resets to disabled after restarting or reloading Obsidian. Credentials remain session-only.

The canonical persisted field is `containerManagementEnabled`. Enabling first asks for confirmation. While the setting is being written, its toggle is disabled and the Settings tab displays **Status: Saving…**. Only after persistence succeeds does Docker Connector emit the settings-change event that rerenders open Docker Connector views; no Docker refresh is needed for this UI change.

The Settings tab always shows the authoritative runtime state: **Status: Disabled**, **Status: Enabled**, **Status: Saving…**, or **Status: Save failed**. A successful change shows a notice. A failed save restores both the canonical runtime value and the visual toggle to their prior value, shows a bounded safe error notice, and does not emit a success event. Enabling the setting alone performs no Docker mutation.

When enabled, the container detail panel shows state-appropriate actions and requires confirmation before Start, Stop, Shut down, or Restart. Shut down uses Docker's graceful stop endpoint with a 30 second wait; Stop uses 10 seconds. Every accepted action triggers a coordinated refresh.

Lifecycle actions accept Docker's valid `204 No Content` responses. A failed action keeps the action grid visible and shows a bounded safe failure panel with the action, error code, HTTP status when available, retry, and safe diagnostics. [[Docker Connector - Container Lifecycle Actions]]

The generic [[Docker Connector - Read-Only API Policy]] remains GET-only. Lifecycle mutations pass through a dedicated, typed allowlist and cannot be entered as arbitrary Docker paths. No volume, network, image, or arbitrary container deletion route is exposed.

Standalone Update is explicit and confirmed: it inspects the container, pulls its exact repository/tag, renames the stopped original to a temporary backup, creates the replacement, verifies it, then removes the backup without volumes. Compose-managed containers remain blocked and must be updated through Docker Compose. [[Docker Connector - Safe Container Updates]]
