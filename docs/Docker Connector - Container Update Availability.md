---
tags: [docker-connector, containers, updates]
---

# Container Update Availability

[[Docker Connector - Safe Container Updates]] separates **eligibility** from **availability**. Eligibility decides whether a standalone container can safely use the recreate transaction. Availability records whether the configured tagged image currently resolves to a different Docker image ID.

Statuses are transient and scoped by profile ID plus full container ID: not checked, checking, available, current, error, or unsupported. Docker Connector checks eligible online containers after a snapshot refresh only when no status exists or its 24-hour interval has elapsed. A check inspects the container, pulls the exact configured image through the Docker daemon, resolves its image ID, and compares IDs. It never recreates, stops, starts, restarts, renames, or removes a container; it never deletes images.

The detail panel shows one Image update status at a time. **Check now** forces a check for that container only; it does not alter the 24-hour schedule or change container state. The Update action is shown only when the container is eligible *and* the status is **available**. A current image hides Update so the same container cannot be recreated repeatedly without a newer resolved image. Errors provide a safe retry action, while unsupported containers show their safe reason.

[[Docker Connector - Containers View]] surfaces the same transient state as an **Updates available** dashboard count and filter. Only `available` contributes to that count; checking, current, error, and unsupported statuses do not.

A successful recreate moves the status to the trusted replacement container ID and marks it current without a further pull. No automatic installation or unattended update is provided.
