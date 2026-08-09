---
tags: [docker-connector, ui]
---

# Connections View

The Connections view presents four clearly labelled methods: **Local Docker Socket**, **Docker Context**, **Remote Docker via SSH**, and **Remote Docker API (Mutual TLS)**. Each configured-server card uses the same canonical connection name as the Add/Edit Docker Host dialog, followed by safe endpoint or authentication detail.

Local Docker Socket is for Docker running on this computer. Docker Context uses an existing Docker CLI context without changing the active Docker context. Remote Docker via SSH uses password or private-key authentication and Docker's secure dial-stdio transport, so direct Docker API exposure is not required. Remote Docker API (Mutual TLS) is the advanced direct HTTPS option and requires a trusted CA, client certificate, and client private key.

Context cards show safe saved metadata and read-only lifecycle status, with Edit, View Context Details, and Refresh Context Metadata actions. Context profiles use the normal read-only refresh after lifecycle preflight. See [[Docker Connector - Docker Context Execution]], [[Docker Connector - Docker Context Editing]], and [[Docker Connector - Docker API TLS Connections]].
