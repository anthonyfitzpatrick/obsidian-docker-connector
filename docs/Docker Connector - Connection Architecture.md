---
tags: [docker-connector, architecture]
---

# Connection Architecture

Profiles are a discriminated set of Local Docker Socket, Docker Context, Remote Docker via SSH, and Remote Docker API (Mutual TLS) profiles. Local endpoint discovery, symlink-aware validation, and local HTTP execution are implemented. Docker Context remains a logical profile type and resolves to its discovered physical transport at runtime.

For a current end-user description, see [[Docker Connector - User Guide]].
