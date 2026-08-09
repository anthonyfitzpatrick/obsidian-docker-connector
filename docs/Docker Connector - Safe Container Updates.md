---
tags: [docker-connector, container-management, updates]
---

# Safe Container Updates

[[Docker Connector - Container Management]] is disabled by default. Update is an explicitly confirmed, standalone-container workflow: it pulls the existing repository/tag, preserves the original as a temporary backup, recreates and verifies a replacement, and removes the stopped backup without volumes only after success.

Docker Compose containers, digest-only images, unknown mount types, container namespace sharing, links, and auto-remove containers are blocked before mutation. Environment values and recreate payloads remain in memory only. Named volumes and bind mounts are preserved; data stored solely in the writable container layer may be lost. The old image is retained.

Update eligibility is evaluated from the selected container's image reference and recognized Docker Compose labels before the control is enabled. Valid tagged references include `ghost:5-alpine`, `mysql:8.4`, repository paths, and registry hosts with ports. A full inspect and recreate-plan validation still occurs before any mutation. Ineligible containers display a direct safe reason; failed preflight is retained in the action panel with retry and diagnostics.

[[Docker Connector - Update Dialog]] supplies a read-only preview before it delegates to the transaction. Its prominent writable-layer warning remains visible; **Proceed with update** starts the transaction and **Cancel** changes nothing. [[Docker Connector - Update Progress]] documents the safe, scoped progress and outcome feedback.

[[Docker Connector - Container Update Availability]] documents the separate 24-hour image comparison status. Checking may pull the configured image through the Docker daemon but never changes container state.

If replacement creation, networking, start, or verification fails, the workflow removes the failed replacement, restores the original name, and restarts the original where applicable. [[Docker Connector - Update Rollback]] documents the explicit recovery boundary. If backup cleanup fails, the replacement remains running and the stopped backup is retained for review. No unattended, bulk, image, volume, or network deletion is provided.
