---
tags: [docker-connector, security]
---

# Security Review

Private key contents, passwords, passphrases, and signatures are never persisted or logged. Docker Context lifecycle storage is transient and contains only safe snapshot fields; it retains no raw CLI records, endpoint storage paths, certificates, keys, credentials, or environment data. Context execution uses fixed `docker --context <name> system dial-stdio` arguments with `shell: false`; Docker CLI Contexts are never modified. The API allowlist is unchanged. See [[Docker Connector - Docker Context Execution]] and [[Docker Connector - Runtime Credentials]].
