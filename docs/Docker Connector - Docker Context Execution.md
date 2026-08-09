---
tags: [docker-connector, docker-context, execution]
---

# Docker Context Execution

Docker Context profiles first resolve to their freshly discovered physical endpoint. A `unix://` endpoint uses the local Unix-socket transport and a `npipe://` endpoint uses the local Windows named-pipe transport. Only an `ssh://` endpoint executes through `docker --context <saved-name> system dial-stdio`. The Context name is passed as a fixed argument; Docker Connector never changes the global active Context or copies Context SSH/TLS material into settings.

Before connection, read-only discovery verifies the exact saved Context and its [[Docker Connector - Docker Context Lifecycle|lifecycle]]. Missing, changed, insecure TCP, TLS endpoints not safely supported by the Context architecture, and unknown endpoints are blocked. Docker CLI owns Context SSH resolution where dial-stdio is used. See [[Docker Connector - Docker Context Connections]].
