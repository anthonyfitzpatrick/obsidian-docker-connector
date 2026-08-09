---
tags: [docker-connector, connectivity]
---

# Connectivity Overview

The four supported connection methods are Local Docker Socket, Docker Context, Remote Docker via SSH, and Remote Docker API (Mutual TLS). Docker Context is resolved by its endpoint: local sockets/pipes use the local transport and SSH Contexts use Context dial-stdio. All routes use the same read-only Docker API allowlist and normalized dashboard snapshots. No insecure TCP, TLS verification bypass, Docker Context mutation, or generic Docker API mutation is supported.

All transports and runtime credentials are cleared on profile removal and plugin unload. Manual live Docker, TLS, and Obsidian validation remain outstanding where no endpoint or UI session is available.
