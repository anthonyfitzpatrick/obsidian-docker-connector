---
tags: [docker-connector, tls, profiles]
---

# Mutual TLS Profiles

Certificate and client-key files are locally validated and matched before save. Only absolute file paths and safe fingerprints, subject, issuer, and validity metadata are persisted. Client-key passphrases remain session-only in [[Docker Connector - Runtime Credentials]]. Insecure Docker TCP and TLS-verification bypass are not supported.
