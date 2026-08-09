---
tags: [docker-connector, container-management, rollback]
---

# Update Rollback

[[Docker Connector - Safe Container Updates]] tracks confirmed facts: whether the original stopped or was renamed, and whether a replacement was created, started, or verified. A failure before stop/rename is reported as pre-mutation and does not invoke rollback.

After the original is stopped, rollback restores its prior state. After it is renamed, the failed replacement is stopped and removed with `force=false` and `v=false`, then the captured original container ID is renamed back and restarted when it was originally running. Volumes, images, and networks are never deleted.

If the verified replacement succeeds but backup deletion fails, the result is **updated with backup retained**. If name restoration, replacement cleanup, or original restart fails, the result is **incomplete rollback** and provides only safe identifiers for manual recovery. Live rollback validation remains outstanding.

[[Docker Connector - Update Cancellation]] explains the mutation boundary shared by user cancellation and plugin unload.
