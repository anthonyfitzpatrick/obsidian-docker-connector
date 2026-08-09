---
tags: [docker-connector, docker-context, connections]
---

# Docker Context Connections

Supported saved Docker Context profiles can now run the normal read-only Docker API refresh and Test Connection flow. The dial-stdio child process is closed on disconnect, request failure, profile removal, edit, and plugin unload.

Test Connection and dashboard refresh require a working Docker CLI Context. Test Connection remains unavailable until discovery confirms a supported selected Context in the edit dialog. No Context mutation occurs.
