---
tags: [docker-connector, docker-context, security]
---

# Docker Context Change Detection

Read-only discovery compares only endpoint type, safe endpoint display, TLS-verification setting, and supported state. It does not compare the active Context flag, timestamps, raw CLI output, storage paths, credentials, certificates, keys, or environment data.

Missing Contexts are not silently replaced. A supported replacement or changed Context is saved only after explicit user action. Docker CLI Contexts are never modified. See [[Docker Connector - Docker Context Lifecycle]].
