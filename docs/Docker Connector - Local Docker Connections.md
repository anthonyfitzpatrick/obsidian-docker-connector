---
tags: [docker-connector, local-docker]
---

# Local Docker Connections

Local Docker is implemented as a first-class profile type and connects directly to Docker Engine through a Unix socket or Windows named pipe using the shared read-only API allowlist. Saved endpoint paths remain user-controlled; symlinks are resolved only for diagnostics and connection. See [[Docker Connector - Local Docker Transport]] and [[Docker Connector - Local Endpoint Detection]].
