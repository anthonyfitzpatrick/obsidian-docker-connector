# Changelog

## Unreleased

- Route Docker Context profiles by their freshly discovered endpoint: local Unix sockets and Windows named pipes use the local Docker transport, while SSH Contexts retain Docker CLI dial-stdio.
- Continue blocking insecure TCP and unsupported Context endpoints without a fallback transport.
- Refresh a newly saved Docker Context profile immediately so its runtime snapshot and status are published instead of remaining Unknown.

## Unreleased

- Clarified all connection-method labels and descriptions: Local Docker Socket, Docker Context, Remote Docker via SSH, and Remote Docker API (Mutual TLS). The dialog now provides dynamic security and recommendation guidance without changing saved profile discriminator values or transport behavior.

- Added a complete end-user guide and expanded the README with accurate installation, connection, dashboard, Compose-awareness, update-safety, privacy, and troubleshooting guidance.
- Added human-readable security and lifecycle commentary to the remaining local transport, diagnostics, network, and volume modules.
- Corrected stale Docker Context documentation to describe the implemented lifecycle preflight, Test Connection, and dial-stdio execution path.

- Corrected Applications service rendering to preserve exact live Compose service labels rather than stripping project-like prefixes.

- Centralized Compose-label extraction so Applications keep Compose project, Compose service, Docker container name, and image reference distinct without naming-convention heuristics.

- Polished the read-only Applications inspector with self-contained responsive rows, safe long-image truncation, pluralized metadata, human-readable snapshot timestamps, and selection-aware scroll reset.

- Refined the read-only Applications view with naturally sized cards, wrapping service chips, responsive filters, and a full-width/master-detail layout that handles long Compose names safely.

- Added a read-only Applications dashboard that groups Docker Compose-labelled containers by project, reuses existing update availability, and links to the existing container inspector without adding Compose operations.

- Added Community Plugin lifecycle, metadata, documentation, and static security regression review coverage; no product capability was added.

- Added opt-in, confirmed container Start, Stop, graceful Shut down, and Restart actions with per-container progress and refresh-after-action.
- Kept the normal Docker API client GET-only; lifecycle routes are available only through a dedicated typed action service.
- Added an explicit backup-first pull-and-recreate Update transaction for eligible standalone containers, including Compose/configuration blocking and rollback.
- Hardened update rollback with confirmed mutation facts and focused create-failure, incomplete-rollback, and backup-retention coverage.
- Added transaction-scoped update cancellation and plugin-unload cancellation coverage.
- Added bounded active-update recovery before plugin-unload transport cleanup, with explicit timeout guidance.
- Fixed Container management settings propagation so open container detail panels update without a plugin restart.
- Added an explicit persisted-settings event for live Container management panel updates.
- Made Container management setting saves observable with confirmation, saving/status feedback, success notices, safe failure notices, visual rollback, and serialized settings persistence.
- Fixed lifecycle-action handling for Docker's empty 204 responses and refined container action controls with safe inline failure details and retry.
- Made Update eligibility explicit and visible: eligible standalone tagged images activate the existing safe update workflow, while Compose and image-reference blocks show a direct safe reason.
- Added a read-only Update preview dialog with explicit writable-layer acknowledgement, safe configuration-preservation summary, transaction progress, and terminal update/rollback feedback.
- Added transient per-container image availability status with 24-hour checks through typed Docker daemon image pulls; checks never change container state.
- Added Image update status presentation and per-container Check now controls. Update is enabled only for a confirmed newer image, and the preview now proceeds directly from its prominent writable-layer warning without a redundant acknowledgement checkbox.
- Added an Updates Available Containers-dashboard card with a live count, additive one-click filter, active filter chip, and no-updates empty state.

## 1.0.0 — 2026-08-03

- Read-only SSH-to-Docker dashboard with host, container, image, volume, network, connection, and Markdown report views.
- Password-only runtime credential model with SSH host-key verification and `docker system dial-stdio` transport.
- Responsive, theme-aware UI; reduced-motion and keyboard focus support.
- Defensive mappers, snapshot retention, lazy details, diagnostics, and a GET-only Docker API policy.
