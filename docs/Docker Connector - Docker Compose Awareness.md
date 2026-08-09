---
tags: [docker-connector, docker-compose, security]
---

# Docker Connector - Docker Compose Awareness

Compose awareness is label-based, never heuristic. [[Docker Connector - Applications View]] recognises `com.docker.compose.project` as the sole grouping key and `com.docker.compose.service` as the sole service key. Docker container names, image references, network names, and paths are distinct metadata and never substitute for Compose identity. A project-labelled container with no service label is shown as an unlabelled Compose container instead of inventing a service name.

Stopped one-off containers are included in an application's total container count but excluded from normal service-health calculation. A running one-off remains relevant to health. Compose-managed containers remain blocked from the existing standalone transactional update path; available images are informational and must be applied through the user’s Compose workflow outside the plugin.

The presentation remains responsive even for long project or service names: service chips wrap, truncate safely, and retain their full name in a tooltip. This affects display only, not Compose grouping or status policy.
