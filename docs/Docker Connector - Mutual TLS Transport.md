---
tags: [docker-connector, tls, transport]
---

# Mutual TLS Transport

TLS Test Connection revalidates the configured PEM files, creates a per-profile native HTTPS agent, presents the client certificate and key, and keeps `rejectUnauthorized` enabled. The configured Server Name is used for SNI and hostname verification. Certificate/key contents and passphrases remain in memory only.

Insecure TCP and TLS-verification bypass are unsupported. Certificate files are revalidated before each new TLS transport; dashboard refresh and automatic refresh use the same agent-backed transport and read-only API allowlist.
