---
tags: [docker-connector, docker-context, connections]
---

# Docker Context Connections

Supported saved Docker Context profiles run the normal read-only Docker API refresh and Test connection flow. The freshly discovered endpoint determines the underlying transport: local Unix sockets and Windows named pipes use the existing local Docker transport; SSH Contexts use Docker CLI dial-stdio. A dial-stdio child process, when one is required, is closed on disconnect, request failure, profile removal, edit, and plugin unload.

Test connection and dashboard refresh require a working Docker CLI Context. Test connection remains unavailable until discovery confirms a supported selected Context in the edit dialog. No Context mutation occurs.
