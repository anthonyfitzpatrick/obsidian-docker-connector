---
tags: [docker-connector, containers, updates]
---

# Update Dialog

[[Docker Connector - Safe Container Updates]] opens a read-only preview before an Update transaction can begin. It shows the container, host, connection method, configured image, shortened current image ID, and safe counts for volumes, binds, ports, networks, environment variables, labels, restart policy, health checks, and stop timeout.

The dialog never renders environment values, registry credentials, raw inspect data, or a recreate payload. It explains the service interruption, temporary rollback backup, writable-layer risk, preserved bind mounts and named volumes, and retained old image. The acknowledgement checkbox is required before **Proceed with update** becomes available.

Compose-managed and unsupported containers remain blocked with their safe reason. Preflight is read-only; mutation remains in the existing transaction-gated service.
