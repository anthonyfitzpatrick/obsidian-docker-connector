---
tags: [docker-connector, tls, security]
---

# TLS Certificate Validation

The TLS profile form locally verifies readable PEM CA/client certificates, private-key parsing, encrypted-key passphrase requirements, client certificate validity dates, and client certificate/key matching. It does not contact a Docker endpoint or prove server trust.

## Server identity

The request supplies its own `checkServerIdentity`, matching the certificate against the configured Server name rather than the connection host. SNI carries host names only, so an IP Server name is never sent as `servername`; without the explicit check Node falls back to verifying against the host, which silently ignores an IP Server name that differs from it. A live mutual TLS daemon connected as online under exactly that configuration before 1.1.14.
