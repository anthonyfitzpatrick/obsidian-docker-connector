---
tags: [docker-connector, connectivity]
---

# Connection Capability Matrix

Docker Connector supports four read-only methods: Local Docker, Docker Context, SSH, and Docker API with mutual TLS. Each supports dashboard refresh, Test Connection, reports, and lazy details through the shared GET-only Docker API policy.

SSH provides host-key verification; mutual TLS provides mandatory certificate verification. Docker Context delegates its SSH/TLS handling to Docker CLI. Runtime credentials are session-only and isolated by profile ID. See [[Docker Connector - Connectivity Overview]].
