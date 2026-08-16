---
title: Docker Connector - Connections View
---

# Connections View

The **Connections** tab is the saved-profile management surface. Its heading is **Docker connections** and the page-level **Add Docker Host** action opens the canonical Add Docker Host dialog.

Each saved connection card uses one canonical display name: **Local Docker Socket**, **Docker Context**, **Remote Docker via SSH**, or **Remote Docker API (Mutual TLS)**. Every card uses the same decorative purple Docker host icon regardless of connection method, while its text continues to communicate the method. A card also shows a safe endpoint and the profile’s runtime status. SSH cards show only `host:port` in passive metadata: they do not expose the SSH username, password/private-key mode, or credential paths.

Available status values are **Unknown**, **Connecting**, **Online**, **Offline**, **Degraded**, and **Authentication Required**. Unknown is the transient state before a profile has completed its first connection evaluation; it is not a substitute for an error after a completed refresh.

Every card has **Edit** and **Delete connection**. Authentication-required profiles have **Reconnect** so session-only passwords or passphrases can be entered again. Offline and degraded profiles expose a retry/reconnect action where the existing runtime flow can retry them. All applicable actions, including Delete, share the first footer row. The compact per-card **Container management** switch is centered in its own second footer row; action buttons may wrap only in narrow panes. Action clicks do not select the card or switch the Current Environment.

Deleting a card opens a confirmation dialog. Confirmation removes only the Docker Connector profile, runtime credentials, caches, status, active read-only work, and associated transport resources. It never deletes or changes containers, images, volumes, networks, Docker Contexts, sockets, SSH keys, TLS files, or remote Docker configuration. If the removed profile is current, the host manager safely reconciles the Current Environment from the remaining profiles.

Docker Context cards remain labelled **Docker Context** even if their discovered endpoint uses the local Unix-socket or Windows named-pipe transport. Docker Connector does not mutate the Docker CLI Context.

For end-user instructions, see [[User Guide]].
