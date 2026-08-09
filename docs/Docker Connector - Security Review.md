---
tags: [docker-connector, security]
---

# Security Review

Private key contents, passwords, passphrases, and signatures are never persisted or logged. Docker Context lifecycle storage is transient and contains only safe snapshot fields; it retains no raw CLI records, endpoint storage paths, certificates, keys, credentials, or environment data. Context execution uses fixed `docker --context <name> system dial-stdio` arguments with `shell: false`; Docker CLI Contexts are never modified. The API allowlist is unchanged. See [[Docker Connector - Docker Context Execution]] and [[Docker Connector - Runtime Credentials]].

The four supported connection methods are Local Docker Socket, Docker Context, Remote Docker via SSH, and Remote Docker API (Mutual TLS). Local access depends on local Docker permissions. SSH credentials authenticate the remote session and Docker API traffic remains inside the SSH connection. Mutual TLS requires both mandatory TLS server verification and client-certificate authentication; its Docker API endpoint is directly reachable by design. Plain unauthenticated Docker TCP is not supported.
