---
tags: [docker-connector, ui]
---

# Connections View

The Connections view presents four clearly labelled methods: **Local Docker Socket**, **Docker Context**, **Remote Docker via SSH**, and **Remote Docker API (Mutual TLS)**. Each configured-server card uses the same canonical connection name as the Add/Edit Docker Host dialog, followed by safe endpoint or authentication detail.

Local Docker Socket is for Docker running on this computer. Docker Context uses an existing Docker CLI context without changing the active Docker context. Remote Docker via SSH uses password or private-key authentication and Docker's secure dial-stdio transport, so direct Docker API exposure is not required. Remote Docker API (Mutual TLS) is the advanced direct HTTPS option and requires a trusted CA, client certificate, and client private key.

Context cards show safe saved metadata and read-only lifecycle status, with Edit, View Context Details, and Refresh Context Metadata actions. Context profiles use the normal read-only refresh after lifecycle preflight. A local socket or Windows named-pipe Context uses the local transport while retaining the **Docker Context** card label; an SSH Context uses the Docker CLI Context helper. See [[Docker Connector - Docker Context Execution]], [[Docker Connector - Docker Context Editing]], and [[Docker Connector - Docker API TLS Connections]].

Every saved connection card has a **Delete connection** action. Confirmation removes only Docker Connector’s saved profile, runtime credentials, cached session data, and transport. It does not delete or change Docker resources, Docker Contexts, SSH keys, TLS files, sockets, or the remote host.
