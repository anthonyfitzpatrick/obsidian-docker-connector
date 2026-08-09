---
tags: [docker-connector, containers, updates]
---

# Update Progress

The [[Docker Connector - Update Dialog]] stays open while the existing transaction runs. It receives scoped, safe boundary events for inspection, validation, image pull, image comparison, original stop, rollback backup, replacement creation, network restoration, replacement start, verification, backup cleanup, and rollback.

Progress contains no environment values, registry authorization, raw Docker responses, or recreate configuration. A terminal dialog distinguishes successful update, already-current, backup retained, complete rollback, incomplete rollback, pre-mutation failure, and cancellation. Manual Obsidian and disposable-container validation remains outstanding.
