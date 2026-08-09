---
title: Docker Connector - Docker Context
---

# Docker Context

Docker Context remains a distinct Docker Connector profile type. Before use, Docker Connector rediscovers the saved Context and compares its current safe endpoint metadata with the saved snapshot.

Docker Connector then selects the appropriate underlying transport from that discovered endpoint. A `unix://` Context, such as Docker Desktop's `desktop-linux`, uses the existing local Unix-socket transport. A Windows `npipe://` Context uses the local named-pipe transport. An `ssh://` Context uses Docker CLI's explicit `docker --context <name> system dial-stdio` helper. Insecure TCP and unknown endpoints remain unsupported; no insecure HTTP fallback is used.

The connection card and profile continue to say **Docker Context**, even when the underlying transport is local. Docker Connector never changes the active Docker CLI Context.
