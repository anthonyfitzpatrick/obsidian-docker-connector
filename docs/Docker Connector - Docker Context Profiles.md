---
tags: [docker-connector, docker-context]
---

# Docker Context Profiles

Docker Context profiles persist only a context name and safe endpoint snapshot metadata. New profiles can be saved, and existing Context profiles can be edited through the shared host dialog. Editing first shows the saved safe metadata, then requires read-only discovery to confirm a supported selected Context before it can save.

Before a Context is used, Docker Connector performs read-only discovery and evaluates its lifecycle. Missing, changed, insecure, and unsupported Contexts are reported or blocked rather than silently used. Supported Contexts can be tested and refreshed through the normal dashboard pipeline using an explicit `docker --context <name> system dial-stdio` invocation. Docker Connector never changes the active Docker CLI Context. See [[Docker Connector - Docker Context Lifecycle]], [[Docker Connector - Docker Context Execution]], and [[Docker Connector - Docker Context Editing]].
