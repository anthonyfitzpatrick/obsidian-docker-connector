---
tags: [docker-connector, applications, docker-compose]
---

# Docker Connector - Applications View

[[Docker Connector - Applications View]] is a read-only operational view of Docker Compose projects. It groups normalized snapshot containers only when Docker provides `com.docker.compose.project`; standalone containers remain exclusively in [[Docker Connector - Containers View]].

The view supports Local Docker Socket, Docker Context, Remote Docker via SSH, and Remote Docker API (Mutual TLS) because it uses no transport-specific logic. It filters and sorts cached snapshot summaries, reuses existing per-container image-update state, and never starts a new image check.

Compose identity is authoritative: the application/project comes only from `com.docker.compose.project`, and each service comes only from `com.docker.compose.service`. Docker container names and image references remain separate Docker metadata. The view displays the exact service label: it never strips prefixes or otherwise guesses Compose identity from names, networks, images, or paths. A project-labelled container without a service label appears as an unlabelled Compose container.

Application cards use a full-width, naturally growing stacked layout: project/status header, summary metadata, a wrapping preview of up to five service chips, and network/volume/image footer metadata. When the detail inspector is open, the view uses a master/detail layout; narrow panes stack it below the list. Search and filter controls use the existing dashboard toolbar with responsive wrapping, and cards, summary filters, and container links remain keyboard accessible.

The detail panel uses self-contained service, container, image, network, storage, and Compose-metadata rows. Long identifiers truncate with a full-name tooltip rather than forcing awkward word breaks; metadata is pluralized and snapshot times are human-readable. Selecting a different application resets the inspector to its top, while a refresh of the same selection retains its scroll position where practical.

It does not show environment values, raw label dumps, or full bind paths. Applications are read-only: no Docker Compose CLI, Compose mutation, or application-level update action exists.
