---
tags: [docker-connector, security]
---

# Runtime Credentials

Passwords, SSH private-key passphrases, and Docker TLS client-key passphrases are stored separately by profile ID in memory. They are cleared on profile removal and plugin unload, never written to `data.json`, diagnostics, notices, or reports. See [[Docker Connector - Mutual TLS Profiles]].
