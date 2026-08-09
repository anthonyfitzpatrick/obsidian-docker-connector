---
tags: [docker-connector, lifecycle, safety]
---

# Plugin Unload Safety

During unload, Docker Connector first blocks new container actions, signals every active Update transaction, and waits up to 15 seconds for the active transaction registry to drain before closing transports and clearing runtime credentials.

If recovery finishes, normal transport cleanup continues. If the bound expires, the in-memory result is marked **timed out** with safe container identifiers and recovery guidance; it never claims rollback succeeded. Recreate plans and environment values are never persisted. [[Docker Connector - Update Cancellation]]
