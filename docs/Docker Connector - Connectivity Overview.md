---
tags: [docker-connector, connectivity]
---

# Connectivity Overview

The four supported connection methods are Local Docker sockets/pipes, explicit Docker Context dial-stdio, SSH dial-stdio, and direct Docker mutual TLS. All use the same read-only Docker API allowlist and normalized dashboard snapshots. No insecure TCP, TLS verification bypass, Docker Context mutation, or Docker API mutation is supported.

All transports and runtime credentials are cleared on profile removal and plugin unload. Manual live Docker, TLS, and Obsidian validation remain outstanding where no endpoint or UI session is available.
