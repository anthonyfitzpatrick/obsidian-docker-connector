---
tags: [docker-connector, connectivity]
---

# Connection Capability Matrix

Docker Connector supports four read-only methods: **Local Docker Socket**, **Docker Context**, **Remote Docker via SSH**, and **Remote Docker API (Mutual TLS)**. Each supports dashboard refresh, Test Connection, reports, and lazy details through the shared GET-only Docker API policy.

Local Docker Socket uses local Docker permissions. Docker Context delegates its SSH/TLS handling to Docker CLI without modifying the active context. Remote Docker via SSH provides host-key verification and keeps the Docker API inside the SSH transport. Remote Docker API (Mutual TLS) provides mandatory server verification and client-certificate authentication. Runtime credentials are session-only and isolated by profile ID; plain unauthenticated Docker TCP is unsupported. See [[Docker Connector - Connectivity Overview]].
