---
tags: [docker-connector, security]
---

# Security Review

Private key contents, passphrases, signatures, and all credentials are never logged. SSH passwords are session-only by default; the sole exception is an explicit per-profile **Remember password on this device** choice, stored separately in unencrypted plugin data because Obsidian exposes no supported Community Plugin keychain API. It is never included in profile objects or diagnostics and is removed on forget, deletion, authentication change, or SSH host/user change. Docker Context lifecycle storage is transient and contains only safe snapshot fields; it retains no raw CLI records, endpoint storage paths, certificates, keys, credentials, or environment data. Context execution uses fixed `docker --context <name> system dial-stdio` arguments with `shell: false`; Docker CLI Contexts are never modified. The API allowlist is unchanged. See [[Docker Connector - Docker Context Execution]] and [[Docker Connector - Runtime Credentials]].

The four supported desktop connection methods are Local Docker Socket, Docker Context, Remote Docker via SSH, and Remote Docker API (Mutual TLS). Local access depends on local Docker permissions. SSH credentials authenticate the remote session and Docker API traffic remains inside the SSH connection. Mutual TLS requires both mandatory TLS server verification and client-certificate authentication; its Docker API endpoint is directly reachable by design. Plain unauthenticated Docker TCP is not supported.

Deleting a saved connection is plugin-state cleanup only. Docker Connector clears its profile metadata, runtime credentials, cached snapshots, detail/update state, and transport; it never deletes Docker resources, Docker Contexts, sockets, SSH keys, certificate files, or remote configuration.
