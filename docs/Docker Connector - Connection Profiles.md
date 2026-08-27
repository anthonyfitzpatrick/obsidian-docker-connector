---
tags: [docker-connector, profiles]
---

# Connection Profiles

Profiles persist SSH configuration, a Local Docker endpoint, a safe Docker Context snapshot, or Remote Docker API (Mutual TLS) metadata. Existing Docker Context profiles require fresh read-only discovery before an edit can save. Their lifecycle is checked before the normal Test connection and dashboard refresh pipeline resolves the current endpoint: local Unix sockets and Windows named pipes use the local transport, while SSH Contexts use explicit Context dial-stdio. See [[Docker Connector - Docker Context Profiles]], [[Docker Connector - Local Docker Connections]], [[Docker Connector - Docker API TLS Connections]], and [[Docker Connector - Private Key Authentication]].
