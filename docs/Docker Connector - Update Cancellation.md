---
tags: [docker-connector, container-management, cancellation]
---

# Update Cancellation

An Update owns a cancellation controller registered by profile and original container ID. Cancelling before the first confirmed state change returns **cancelled** and does not invoke rollback. After the original container is stopped or renamed, cancellation routes through [[Docker Connector - Update Rollback]] and reports the recovery outcome rather than claiming a plain cancellation.

Plugin unload signals all active update controllers before normal transport teardown and waits for bounded recovery. [[Docker Connector - Plugin Unload Safety]] describes the 15-second bound and its safe timeout result. The update plan, including environment values, remains in memory only and is cleared at terminal completion. Live cancellation and unload validation remains outstanding.
