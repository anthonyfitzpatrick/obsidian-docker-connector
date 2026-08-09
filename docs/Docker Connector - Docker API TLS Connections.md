---
tags: [docker-connector, tls]
---

# Docker API TLS Connections

Remote Docker API (Mutual TLS) profiles store a host, port, server name, certificate file paths, and safe certificate metadata. Test Connection and the normal read-only dashboard refresh use native HTTPS mutual TLS with mandatory CA and server-name verification. Server Name can be an IP address verified against an IP SAN or a DNS name verified against a DNS SAN. Containers, images, volumes, networks, and lazy details use the shared read-only API pipeline.

For the user-facing field walkthrough and troubleshooting, see [[Docker Connector - User Guide]].
