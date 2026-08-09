---
tags: [docker-connector, docker-context, execution]
---

# Docker Context Execution

Docker Context profiles execute through `docker --context <saved-name> system dial-stdio`. The Context name is passed as a fixed argument; Docker Connector never changes the global active Context or copies Context SSH/TLS material into settings.

Before connection, read-only discovery verifies the exact saved Context and its [[Docker Connector - Docker Context Lifecycle|lifecycle]]. Missing, changed, insecure TCP, and unsupported Contexts are blocked. Docker CLI owns Context SSH and TLS resolution. See [[Docker Connector - Docker Context Connections]].
