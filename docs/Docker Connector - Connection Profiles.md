---
tags: [docker-connector, profiles]
---

# Connection Profiles

Profiles persist SSH configuration, a Local Docker endpoint, a safe Docker Context snapshot, or Docker API mutual-TLS metadata. Existing Docker Context profiles require fresh read-only discovery before an edit can save. Their lifecycle is checked before the normal Test Connection and dashboard refresh pipeline uses an explicit Context dial-stdio process. See [[Docker Connector - Docker Context Profiles]], [[Docker Connector - Local Docker Connections]], [[Docker Connector - Docker API TLS Connections]], and [[Docker Connector - Private Key Authentication]].
