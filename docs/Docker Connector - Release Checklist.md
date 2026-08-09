---
tags: [docker-connector, release]
---

# Release Checklist

- Verify Applications groups only containers carrying `com.docker.compose.project`, excludes standalone containers, and displays update availability without an application-level action.
- Verify the README and [[Docker Connector - User Guide]] describe only the shipped dashboard tabs and supported transports, retain the desktop-only and Docker-privilege warnings, and make no claim of automatic updates, Compose mutation, credential persistence, telemetry, or official Marketplace approval.
- Verify `manifest.json`, `package.json`, `package-lock.json`, and `versions.json` agree on the release version. Use a matching semantic-version GitHub tag, and attach `main.js`, `manifest.json`, and `styles.css` to the release.
- Confirm the Community directory's plugin-ID and display-name requirements and uniqueness before submission. Resolve the repository policy for the currently tracked local `main.js` before publishing source.

- Verify [[Docker Connector - Container Management]] remains disabled on a fresh install.
- Enable it in Obsidian, accept the warning, and confirm the Enabled status, success notice, and persisted `containerManagementEnabled: true` value.
- Disable it and confirm the Disabled status, success notice, and persisted false value.
- Exercise a write failure where practical and confirm the toggle returns to the authoritative value without a false success notice.
- Against a disposable container only, verify Start accepts Docker's `204 No Content`, refreshes the container state, and keeps safe error details visible if Docker rejects an action.
- Verify the action grid remains compact in both wide and narrow container detail panels.
- On a standalone disposable container using `ghost:5-alpine`, use Check now and verify Update becomes enabled only when a distinct image ID is available; verify a current image hides Update. Confirm Proceed with update starts only after the preview warning and Cancel performs no mutation.
- On a Docker Compose-managed container, verify Update remains disabled with its visible Compose explanation.
- Rebuild and reload the plugin bundle before manual validation.
