---
tags: [docker-connector, docker-context, lifecycle]
---

# Docker Context Lifecycle

Docker Connector can read and compare saved Docker Context metadata with a fresh read-only CLI discovery result. A Context may be **Not Tested**, **Unchanged**, **Context Missing**, **Context Changed**, **Unsupported**, **Docker CLI Unavailable**, or **Discovery Error**.

Lifecycle metadata is transient and is never persisted automatically. Supported changes require explicit Save in [[Docker Connector - Docker Context Editing]]. Insecure or unsupported endpoints remain blocked. Lifecycle is checked before [[Docker Connector - Docker Context Execution|Context execution]].
