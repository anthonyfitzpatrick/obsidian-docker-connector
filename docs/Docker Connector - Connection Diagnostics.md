---
tags: [docker-connector, diagnostics]
---

# Connection Diagnostics

Lifecycle-action failures expose only safe diagnostic information: profile ID, container short ID, action, error code, optional HTTP status, and a bounded Docker daemon message. Docker Connector does not expose credentials, environment values, certificate material, private keys, or raw stack traces.
