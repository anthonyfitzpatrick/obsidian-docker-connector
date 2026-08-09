---
tags: [docker-connector, local-docker]
---

# Local Docker Transport

Local Docker uses Node HTTP directly over the configured Unix socket or Windows named pipe. It shares the existing read-only Docker API allowlist and does not use SSH, Docker CLI, or a TCP proxy. Unix-socket transport has automated coverage; live local-engine validation depends on the current desktop permissions.
