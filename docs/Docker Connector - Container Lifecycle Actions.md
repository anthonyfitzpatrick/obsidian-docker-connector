---
tags: [docker-connector, containers, management]
---

# Container Lifecycle Actions

[[Docker Connector - Container Management]] is disabled by default. When enabled, the container detail panel provides confirmed Start, Shut down, Stop, Restart, and eligible Update actions through dedicated typed routes only.

Docker Start uses `POST /containers/{full-id}/start`. The UI never uses a shortened display ID. Docker commonly returns `204 No Content` for lifecycle requests; this is a successful response and does not require a response body or JSON content type.

Running containers show Shut down, Stop, Restart, and Update. Stopped containers show Start and Update. The responsive action grid uses visible labels and icons, becomes one column in narrow panels, and keeps unavailable Update reasons accessible.

Update is available only to an eligible standalone container. It accepts explicit tagged images such as `ghost:5-alpine`; it blocks only recognized Docker Compose labels and unsafe image references before opening the transaction. A full inspect and recreate-plan check remains mandatory before mutation.

On failure, the grid remains usable. Docker Connector shows a bounded safe explanation, error code, HTTP status when available, Retry, and safe diagnostics. It does not expose credentials, environment values, key material, or raw stack traces. Manual Obsidian and disposable-container validation remains required.
