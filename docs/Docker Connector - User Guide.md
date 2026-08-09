---
title: Docker Connector - User Guide
tags: [docker-connector, user-guide]
---

# Docker Connector - User Guide

Docker Connector is a desktop-only dashboard for Docker environments inside Obsidian. It is read-only by default; container management is optional and disabled until you explicitly enable it.

> [!warning] Treat Docker access as privileged access
> A Docker daemon can provide control equivalent to root on its host. Add only hosts and accounts you trust. This plugin does not use telemetry or cloud services, but it does use the Docker access you configure.

## Before you begin

Use Obsidian desktop 1.7.0 or later. The plugin cannot run on mobile because it needs desktop access to local sockets, SSH, TLS certificate files, and Docker CLI Context processes.

Have one of the following ready:

- A local Docker Unix socket or Windows named pipe.
- An existing named Docker Context and a local Docker CLI.
- SSH access to a host where the account can run `docker system dial-stdio` without `sudo`.
- A Docker API endpoint secured with a CA certificate, client certificate, client key, and a server name that matches the certificate.

## Open the dashboard

Choose **Open Docker Connector** from the ribbon or Command palette. The dashboard can also be opened through the **Docker Connector: Open dashboard** command. Use **Docker Connector: Refresh all Docker hosts** to request a fresh snapshot of configured enabled hosts.

## Add and test a connection

1. Open **Connections** and choose the action to add a Docker host.
2. Give the profile a recognisable friendly name and choose the connection method.
3. Enter only the connection metadata requested by that method.
4. Use **Test connection** before saving or monitoring the host.
5. Review the diagnostic steps if a test fails. They are designed to be actionable without exposing passwords, key material, or raw Docker responses.

### Local Docker

Select a Unix socket or Windows named pipe. Docker Connector looks only in explicit conventional locations when discovering endpoints; it never scans your filesystem. Your Obsidian user account must have permission to use the selected endpoint.

### Docker Context

Choose an already-existing Docker CLI Context. Docker Connector runs the Docker CLI with an explicit `--context` argument and does not change which Context is globally active. It never creates, imports, exports, removes, or activates a Context.

### SSH Docker

Provide the SSH host, port, user, and the selected authentication method. Confirm the SSH host fingerprint deliberately. Passwords and private-key passphrases are kept only while Obsidian is running; you will need to provide them again after a restart when required.

### Docker API with mutual TLS

Provide the endpoint host and port, server name, CA certificate path, client certificate path, and client-key path. Docker Connector always verifies the server certificate and does not support insecure TCP or a TLS-verification bypass.

## Read the dashboard

Choose a host from the host selector, then use the tabs:

- **Overview**: a concise host summary and attention items.
- **Applications**: a read-only view of Docker Compose-labelled projects.
- **Containers**: operational state, health, images, and optional container controls.
- **Images**, **Volumes**, and **Networks**: read-only inventory, filters, and details.
- **Connections**: saved profile management and connection diagnostics.

The dashboard refreshes according to **Settings → Docker Connector → Automatic refresh**. You can change the interval; a refresh failure is shown safely and does not discard a previously usable snapshot without marking it stale.

## Understand Applications

Applications are an operational overview, not a Docker Compose interface. A container appears only when Docker supplies `com.docker.compose.project`. Docker Connector uses that label as the application/project name and uses `com.docker.compose.service` as the service name.

The plugin does not infer projects or services from container names, image names, hyphens, networks, or paths. This means the labels shown may differ from a name you expected from a Compose file. Standalone containers never become a synthetic application; find them in **Containers**.

The application inspector shows safe project, service, container, image, network, volume, and Compose metadata. It does not show environment values, raw labels, secrets, or full bind-mount paths. Applications never run Docker Compose, edit Compose files, deploy a stack, or update an application.

## Image update availability

An available update means the configured tagged image now resolves to a different image ID. The check asks the configured Docker daemon to pull the image and compares IDs. It does not recreate a container, restart a service, or install an update automatically.

Availability is not eligibility. A container can have an available image but remain blocked from an Update because it is Compose-managed, untagged, or unsafe to recreate. The **Check now** control is per-container and read-only with respect to container state.

## Enable container management only when needed

In **Settings → Docker Connector**, turn on **Container management** only for trusted hosts. The confirmation explains that Docker access is highly privileged. The setting defaults to disabled and its saved status is shown in the Settings tab.

When enabled, the container inspector may provide explicit Start, graceful Shut down, Stop, Restart, and Update actions. These are typed, validated service operations—not generic Docker API access. The backend checks the setting again for every action; a visible button is never the authority to mutate Docker.

The Update action is for eligible standalone containers only. It displays a safe preview, pulls the existing repository/tag, preserves the original as a temporary backup, creates and verifies a replacement, and removes the stopped backup only after success. If the transaction cannot complete, it follows its rollback path and never force-deletes volumes. Data stored only in the old container's writable layer can still be lost; review the preview before proceeding.

## What is stored and what is not

Saved settings contain non-secret connection metadata and dashboard preferences. SSH passwords, SSH key passphrases, TLS client-key passphrases, certificate contents, private-key contents, registry credentials, and Docker environment values are not stored in plugin settings.

Use **Connections** and the safe diagnostics when troubleshooting. Do not paste secret material into notes, screenshots, issue reports, or test fixtures.

## Common problems

| Problem | What to check |
| --- | --- |
| Local socket access fails | Docker is running, the endpoint is correct, and the Obsidian user has permission. |
| SSH connection fails | Host/port/user, host fingerprint, SSH authentication, and remote Docker permissions. |
| Mutual TLS fails | CA/client certificate/key paths, key passphrase if applicable, and server-name certificate match. |
| Context is unavailable | Docker CLI exists locally and the named Context still exists and is supported. |
| No applications appear | Only `com.docker.compose.project` labels create applications; check Containers for standalone workloads. |
| Update button is unavailable | Updates are standalone-only and require both a confirmed available image and a safe recreate plan. |

For implementation and security detail, see [[Docker Connector - Connection Architecture]], [[Docker Connector - Runtime Credentials]], [[Docker Connector - Applications View]], [[Docker Connector - Safe Container Updates]], and [[Docker Connector - Obsidian Community Plugin Compliance]].
