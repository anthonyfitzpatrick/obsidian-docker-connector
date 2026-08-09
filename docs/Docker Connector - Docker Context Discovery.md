---
tags: [docker-connector, docker-context]
---

# Docker Context Discovery

Docker Connector discovers contexts using read-only Docker CLI commands. It never runs `docker context use` or changes the active context. The dialog supports saving new profiles and editing saved Context profiles after discovery confirms a supported Context. Supported Context execution uses explicit `docker --context` dial-stdio after lifecycle preflight. Insecure TCP contexts are classified as unsupported.
