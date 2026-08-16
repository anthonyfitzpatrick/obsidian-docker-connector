---
tags: [docker-connector, status]
---

# Implementation Status

Implemented: [[Docker Connector - Applications View]] groups Docker Compose-managed snapshot containers by the real project and service labels. Docker container names and image references remain separate normalized fields, and the displayed service is the exact live label. It is read-only across all supported transports; no Compose CLI or application mutation exists. Live read-only label validation was completed against the configured test host.

Implemented: Applications presentation uses naturally sized cards, wrapping service previews, responsive filters, and a Containers-style master/detail inspector. Inspector rows contain their complete metadata, long identifiers truncate safely with a tooltip, selection changes reset scroll, and refresh timestamps are human-readable. Manual validation remains appropriate for actual Obsidian pane dimensions and installed themes.

Implemented: Password and Private Key authentication, session-only credentials, host-key verification, Remote Docker via SSH dial-stdio, direct Local Docker Socket HTTP transport over Unix sockets/named pipes, and saving/editing safe Docker Context profiles. Docker Context execution now resolves local Unix/named-pipe endpoints through the local transport and retains dial-stdio only for SSH Contexts. Windows live validation remains outstanding.

Implemented: deletion of saved Docker Connector connection profiles with explicit confirmation. Deletion clears plugin-owned runtime state and never deletes external Docker resources, Docker Contexts, credential files, or server configuration.

Implemented: Remote Docker API (Mutual TLS) profile modeling, HTTPS mutual-TLS Test Connection, dashboard refresh, and lazy details. Local Docker Socket, Docker Context, Remote Docker via SSH, Remote Docker API (Mutual TLS), and Gateway share the read-only API policy and cleanup lifecycle. Not implemented: SSH Agent, SSH config import, and OS credential storage. See [[Docker Connector - Connectivity Overview]].

Implemented: Container management is opt-in, disabled by default, profile-scoped, and session-only. The synchronized header/card switches are available only for an individual Online profile, revoke authorization immediately on connection loss, and never restore it automatically after reconnect. Manual Obsidian verification of the installed bundle remains outstanding.

Implemented: lifecycle actions use typed routes and accept valid empty Docker responses, including Start's `204 No Content`. The Actions panel has a responsive grid and bounded safe error presentation. Manual Obsidian and disposable-container validation remains outstanding.

Implemented: Image availability is separate from update eligibility. Eligible online standalone containers receive a transient 24-hour image-ID check and an on-demand Check now action. Update is available only for a confirmed newer image; a current image hides it. The preview retains the writable-layer warning but no longer uses an acknowledgement checkbox. Manual Obsidian Update-button validation remains outstanding.
