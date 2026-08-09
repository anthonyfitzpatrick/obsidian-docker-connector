---
tags: [docker-connector, docker-context, editing]
---

# Docker Context Editing

Saved Docker Context profiles open in the shared **Edit Docker Host** dialog. The dialog restores the profile's friendly name, description, category, Context name, and saved safe snapshot. It displays [[Docker Connector - Docker Context Profiles|Saved Context Details]] before discovery runs.

Saving an edit requires a fresh, read-only discovery result for a supported selected Context. The profile ID, enabled state, and creation timestamp remain unchanged. A saved supported Context can use normal Test Connection and dashboard refresh after lifecycle preflight. Docker Connector never changes Docker CLI Contexts.

If the saved Context is not returned by discovery, the dialog shows a validation error. [[Docker Connector - Docker Context Lifecycle]] presents missing and changed Context states. Supported metadata changes require an explicit save; unsupported and insecure changes remain blocked.
