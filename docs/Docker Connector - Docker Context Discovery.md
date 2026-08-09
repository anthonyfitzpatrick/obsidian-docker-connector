---
tags: [docker-connector, docker-context]
---

# Docker Context Discovery

Docker Connector discovers contexts using read-only Docker CLI commands. It never runs `docker context use` or changes the active context. The dialog supports saving new profiles and editing saved Context profiles after discovery confirms a supported Context. After lifecycle preflight, Unix-socket and Windows named-pipe Context endpoints route to the local transport; SSH Contexts use explicit `docker --context` dial-stdio. Insecure TCP and Context endpoint types that cannot be handled through the existing secure transport model are classified as unsupported.
