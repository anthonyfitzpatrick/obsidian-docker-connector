---
title: Docker Connector User Guide
---

# Docker Connector User Guide

Docker Connector is an Obsidian desktop plugin for viewing Docker environments and, when you explicitly enable it, carrying out a small set of container-management actions. It lets you keep local and remote Docker environments in one Obsidian workspace without treating Obsidian as a replacement for Docker Desktop, the Docker CLI, or a full deployment platform.

Docker Connector is read-only by default. You can inspect hosts, Docker Compose applications, containers, images, volumes, networks, and image-update availability without enabling container management. Lifecycle and update actions are deliberately opt-in.

> [!warning] Docker access is highly privileged
> A person or process that can control a Docker daemon can often gain extensive control of that Docker host. Connect only to hosts and credentials you trust. The safeguards in Docker Connector reduce accidental risk; they do not make Docker-daemon access low-risk.

## 1. About Docker Connector

Docker Connector supports multiple saved Docker environments. Each saved connection has its own status, inventory, cached dashboard data, and runtime credentials. Select one environment as the **Current Environment** to view its Overview, Applications, Containers, Images, Volumes, and Networks.

The current release supports four connection methods:

| Method | Best for | Authentication | Direct Docker API exposure |
| --- | --- | --- | --- |
| Local Docker Socket | Docker running on the same computer as Obsidian | Local operating-system and Docker permissions | No |
| Docker Context | An existing Docker CLI configuration | Defined by the selected Context | Depends on the Context |
| Remote Docker via SSH | Most remote Docker hosts | Password or private key | No |
| Remote Docker API (Mutual TLS) | A deliberately secured direct Docker Engine API | CA certificate, client certificate, and client private key | Yes |

Plain unauthenticated Docker TCP is not supported.

## 2. Important security information

Docker Connector is designed to make its boundaries visible:

- It is read-only until **Container management** is enabled in Settings.
- Its normal Docker Engine client is limited to approved GET requests. Start, Stop, Shut down, Restart, and Update use dedicated, typed operations rather than a general-purpose Docker API console.
- Passwords and private-key passphrases are runtime-only. They are kept in memory for the current Obsidian session and are not saved in plugin settings.
- Remote Docker via SSH keeps Docker API traffic inside the SSH session. It does not require a direct Docker API listener.
- Mutual TLS requires server-certificate verification and a client certificate. Docker Connector does not offer an insecure “accept any certificate” mode.
- Docker Context discovery and use never changes your active Docker Context.
- Delete connection removes Docker Connector data only; it never deletes Docker resources or external credential files.

## 3. Requirements

Docker Connector is a desktop-only plugin (`isDesktopOnly: true`). It is supported on desktop Obsidian for macOS, Windows, and Linux. It is not supported on Obsidian mobile because it needs desktop Node/Electron capabilities for local sockets or named pipes, file selection, SSH, TLS, and bounded Docker CLI processes.

You also need appropriate access for the method you select:

- **Local Docker Socket:** Docker Engine or Docker Desktop running locally, and permission to open its socket or named pipe.
- **Docker Context:** Docker CLI installed locally and an existing Docker Context. The context is discovered; Docker Connector does not create or modify it.
- **Remote Docker via SSH:** SSH access to the Docker host and permission for that remote account to use the configured Docker socket without interactive `sudo`.
- **Remote Docker API (Mutual TLS):** a Docker Engine HTTPS endpoint configured for mutual TLS, plus a CA certificate, client certificate, and matching client private key.

## 4. Installation

When Docker Connector is available through Obsidian Community Plugins, install it from **Settings → Community plugins → Browse**, search for **Docker Connector**, then install and enable it. If it is not yet listed in the Community Plugin directory, use the project’s release instructions rather than copying source files into your vault.

For a manual release installation, the plugin directory needs the release assets `main.js`, `manifest.json`, and `styles.css`. Source files, test fixtures, and `node_modules` are not required for normal use.

## 5. First launch

On first launch there are no saved Docker connections. Open **Connections** and choose **Add Docker Host**. After testing and saving a host, choose it as the Current Environment to populate the dashboard.

> <font color="red"><strong>📷 Screenshot 01 required — First launch and empty connection state</strong></font>
>
> <font color="red">Capture: The Connections view with no saved profiles, its explanatory empty state, and the Add Docker Host action.</font>
>
> Suggested filename: `docs/images/user-guide/first-launch-empty-state.png`

## 6. Understanding the interface

The header identifies the Current Environment and its connection status. Use the refresh control for an immediate read-only snapshot refresh. When automatic refresh is enabled, Docker Connector also refreshes configured hosts in the background at the interval chosen in Settings.

The primary navigation contains **Overview**, **Applications**, **Containers**, **Images**, **Volumes**, **Networks**, and **Connections**. The resource tabs show data for the Current Environment; their search, filter, sort, and detail controls never mutate Docker resources.

> <font color="red"><strong>📷 Screenshot 02 required — Main Docker Connector dashboard</strong></font>
>
> <font color="red">Capture: The Overview tab showing Current Environment, Online status, navigation tabs, summary cards, refresh controls, and host information.</font>
>
> Suggested filename: `docs/images/user-guide/dashboard-overview.png`

## 7. Adding a Docker host

1. Open **Connections**.
2. Select **Add Docker Host**.
3. Provide a **Friendly Name**. Description and Category are optional organization fields.
4. Select a **Connection Type**.
5. Complete only the fields for that method.
6. Choose **Test Connection** and review the transport-specific diagnostics.
7. Choose **Save Host**.

Testing before saving is strongly recommended. A successful test proves the selected profile can validate its endpoint and obtain safe Docker information; saving then registers the profile for the normal dashboard refresh lifecycle.

> <font color="red"><strong>📷 Screenshot 03 required — Add Docker Host dialog</strong></font>
>
> <font color="red">Capture: A complete Add Docker Host form with Friendly Name, Connection Type, method description panel, Test Connection, and Save Host controls visible.</font>
>
> Suggested filename: `docs/images/user-guide/add-docker-host.png`

## 8. Connection methods

### 8.1 Local Docker Socket

**Local Docker Socket** connects to Docker running on the same computer as Obsidian. On macOS and Linux this is a Unix socket; on Windows it is a Docker named pipe. Docker Connector discovers common local endpoints and validates the endpoint before connecting.

On macOS, Docker Desktop commonly uses a user socket such as `~/.docker/run/docker.sock`; `/var/run/docker.sock` may be a compatibility symlink. Docker Connector resolves and validates supported socket symlinks rather than replacing them. No SSH credentials, TLS files, or Docker TCP listener are involved.

The **Docker Endpoint** field can show the detected local Unix socket or Windows named pipe. If Docker Desktop is stopped, the endpoint is missing, the symlink is broken, or your account cannot open it, Test Connection explains that local endpoint problem.

> <font color="red"><strong>📷 Screenshot 04 required — Local Docker Socket configuration</strong></font>
>
> <font color="red">Capture: Local Docker Socket selected in Add Docker Host, with the detected Docker Endpoint and local discovery status visible.</font>
>
> Suggested filename: `docs/images/user-guide/local-docker-socket.png`

### 8.2 Docker Context

A **Docker Context** is a Docker CLI connection profile. Docker Connector finds existing contexts through the local Docker CLI and does not run `docker context use`, create, update, remove, import, or export a context.

This distinction matters: Docker Connector uses the context you select without changing the context that your terminal or other Docker tools consider active. The Docker CLI must be installed, but the CLI being present is separate from whether the Docker Engine is currently reachable.

The plugin performs bounded discovery of the Docker CLI from the current process PATH and standard platform locations. This helps normal macOS GUI launches, where Obsidian can inherit a different PATH than Terminal, without invoking a login shell or reading shell startup files.

Docker Connector resolves a selected Context to the right physical transport each time it is used:

- a `unix://` Context uses the local Docker transport;
- a Windows `npipe://` Context uses the local named-pipe transport;
- an `ssh://` Context uses Docker CLI’s explicit Context-backed secure transport;
- insecure, unknown, and endpoint types that cannot be handled safely are blocked.

The saved profile and connection card still say **Docker Context**, even when the underlying transport is local.

> <font color="red"><strong>📷 Screenshot 05 required — Docker Context discovery</strong></font>
>
> <font color="red">Capture: Docker Context selected with Docker CLI detected, version, discovered context selector, safe endpoint summary, and supported status.</font>
>
> Suggested filename: `docs/images/user-guide/docker-context.png`

### 8.3 Remote Docker via SSH

**Remote Docker via SSH** is usually the most straightforward remote choice. Docker Connector opens an SSH session and runs Docker’s secure `docker system dial-stdio` transport through that session. The Docker API is therefore transported over SSH and does not need to be directly exposed to the network.

Configure:

- **SSH Host** and **SSH Port**;
- **SSH Username**;
- **SSH Authentication**: Password or Private Key;
- **Remote Docker Socket**; and
- **Host Key Fingerprint** when host identity verification is required by the connection workflow.

The remote account must be able to access the configured Docker socket without interactive `sudo`.

#### Password authentication

With **Password** selected, enter the SSH password during connection or reconnection. Docker Connector keeps that password in memory only for the current Obsidian session. It is not stored in the saved profile, so a profile can show **Authentication Required** after Obsidian restarts. Choose **Reconnect** to provide it again.

> <font color="red"><strong>📷 Screenshot 06 required — SSH password authentication</strong></font>
>
> <font color="red">Capture: Remote Docker via SSH selected with Password authentication, its password field, remote socket field, and host-key fingerprint field.</font>
>
> Suggested filename: `docs/images/user-guide/ssh-password.png`

#### Private-key authentication

With **Private Key** selected, choose a **Private Key File** and, if required, enter its **Private-Key Passphrase**. The profile can save the file path, not a copy of the key material. An encrypted key’s passphrase remains in memory only for the current session; an unencrypted key simply has no passphrase to enter.

> <font color="red"><strong>📷 Screenshot 07 required — SSH private-key authentication</strong></font>
>
> <font color="red">Capture: Remote Docker via SSH selected with Private Key authentication, file picker path, passphrase field, and host-key verification controls.</font>
>
> Suggested filename: `docs/images/user-guide/ssh-private-key.png`

#### Host-key verification

The **Host Key Fingerprint** identifies the remote SSH server. Verifying it protects against connecting to an unexpected or malicious host that merely answers at the same network address. If Docker Connector reports a changed or unknown host key, independently verify the fingerprint with the server administrator before accepting any trust prompt. Do not treat a host-key warning as a password problem.

### 8.4 Remote Docker API (Mutual TLS)

**Remote Docker API (Mutual TLS)** is for a Docker Engine HTTPS endpoint that has deliberately been configured for mutual TLS. Unlike SSH, the Docker API endpoint is directly reachable on the network. Both sides authenticate:

- Docker Connector verifies the Docker server certificate against the selected CA and Server Name.
- Docker Engine verifies Docker Connector’s client certificate and private key.

Configure these fields:

| Field | Purpose |
| --- | --- |
| Docker Host | Network address of the Docker Engine endpoint. |
| Docker API Port | HTTPS port exposed by the secured Docker Engine endpoint. |
| Server Name | Certificate identity Docker Connector must verify. |
| CA Certificate | Certificate authority used to verify the Docker server certificate. |
| Client Certificate | Certificate presented to Docker Engine to authenticate Docker Connector. |
| Client Private Key | Private key associated with the client certificate. |
| Client-Key Passphrase | Optional passphrase for that private key; session-only. |

Server verification cannot be disabled. If the Server Name is an IP address, the server certificate must contain that IP in an **IP SAN**. If it is a DNS name, the certificate must contain the matching **DNS SAN**. A certificate common name alone is not a reliable substitute for a matching SAN.

Selected certificate and key paths may be saved as profile metadata; certificate contents and client-key passphrases are not persisted in settings.

> <font color="red"><strong>📷 Screenshot 08 required — Mutual TLS configuration</strong></font>
>
> <font color="red">Capture: Remote Docker API (Mutual TLS) selected with Docker Host, Docker API Port, Server Name, CA Certificate, Client Certificate, Client Private Key, and Client-Key Passphrase fields.</font>
>
> Suggested filename: `docs/images/user-guide/mutual-tls.png`

## 9. Testing a connection

**Test Connection** validates a draft before it is saved or after it is edited. The diagnostics are deliberately transport-specific, so not every method shows the same stages. Typical stages include profile validation, Docker Context discovery, local endpoint validation, loading TLS files, opening a connection, server-certificate verification, server-name verification, Docker `GET /_ping`, Docker `GET /version`, and response parsing.

A completed stage is marked **SUCCESS**. An authoritative failure is **ERROR**. Stages that could not start after a failure are shown as **SKIPPED** or **NOT RUN**, rather than being presented as successful. For example, a mutual-TLS hostname mismatch stops before Docker API requests are used.

> <font color="red"><strong>📷 Screenshot 09 required — Successful connection diagnostics</strong></font>
>
> <font color="red">Capture: A successful Test Connection result with relevant validation, ping, version, and verified security stages.</font>
>
> Suggested filename: `docs/images/user-guide/connection-test-success.png`

> <font color="red"><strong>📷 Screenshot 10 required — Failed connection diagnostics</strong></font>
>
> <font color="red">Capture: A failed Test Connection showing the first failing stage, later NOT RUN/SKIPPED stages, and a safe error message.</font>
>
> Suggested filename: `docs/images/user-guide/connection-test-failure.png`

## 10. Managing saved connections

Open **Connections** to manage every saved profile. The page is titled **Docker connections** and provides **Add Docker Host** at the top. Each card shows the friendly name, canonical connection method, a safe endpoint summary, and its current status.

Cards expose the applicable management actions:

- **Edit** opens the same profile workflow without changing the profile’s stable identity.
- **Reconnect** appears when session-only credentials need to be entered again.
- **Retry** appears when an offline or degraded connection can be retried.
- **Delete connection** opens a confirmation dialog.

Status is information, not an action. The current states are **Unknown**, **Connecting**, **Online**, **Offline**, **Degraded**, and **Authentication Required**. Unknown means the profile has not yet been evaluated or is between registration and its first refresh; it should not be a permanent result after a completed connection attempt. Authentication Required normally means a required runtime-only secret needs to be supplied again.

> <font color="red"><strong>📷 Screenshot 11 required — Connections management page</strong></font>
>
> <font color="red">Capture: Docker connections with Add Docker Host, profiles in Online and Authentication Required states, and visible Edit, Reconnect/Retry, and Delete actions.</font>
>
> Suggested filename: `docs/images/user-guide/connections-management.png`

### Delete connection

Deleting a connection removes only Docker Connector’s saved profile, runtime credentials, cached session data, and associated transport state. It does **not** stop or remove containers; delete images, volumes, or networks; remove Docker Contexts; delete SSH keys or TLS files; change Docker sockets; or change a remote server configuration. The confirmation dialog repeats this boundary before removal.

> <font color="red"><strong>📷 Screenshot 12 required — Delete connection confirmation</strong></font>
>
> <font color="red">Capture: The Delete connection confirmation dialog showing a friendly name, connection method, explicit scope, Cancel, and destructive Delete connection action.</font>
>
> Suggested filename: `docs/images/user-guide/delete-connection.png`

## 11. Switching environments

Use **Current Environment** to choose which saved host supplies dashboard data. Switching environment changes the data in Overview, Applications, Containers, Images, Volumes, and Networks. Profiles are isolated even if two profiles intentionally point to the same Docker daemon—for example, a Local Docker Socket profile and a Docker Context that resolves to Docker Desktop’s local socket.

If the selected profile is deleted, Docker Connector chooses a safe remaining profile where possible, preferring an Online profile. If no profiles remain, the dashboard returns to its no-host state.

> <font color="red"><strong>📷 Screenshot 13 required — Current Environment switcher</strong></font>
>
> <font color="red">Capture: The Current Environment selector with multiple saved profiles and a visible active environment.</font>
>
> Suggested filename: `docs/images/user-guide/current-environment.png`

## 12. Overview

Overview is the host-level operational summary. It presents connection health, Docker version and host information when available, resource counts, refresh information, and attention items that deserve review. Attention items can include a host connection problem, an unhealthy container, a restarting or dead container, a non-zero exit, or an available public release where supported by the view.

Overview is not a metrics-history system. It shows the latest safe dashboard snapshot for the selected environment.

## 13. Applications

Applications groups Docker Compose-managed containers into projects. Docker Connector uses Docker’s Compose metadata—especially `com.docker.compose.project` and `com.docker.compose.service`—rather than guessing project membership from names, paths, networks, or image references.

Application cards show a project’s services, container counts, running and stopped counts, available-update count where known, and associated networks, volumes, and images. The list supports searching, status and update filtering, sorting, and an inspector. The inspector exposes project details, services, containers, and images; selecting a listed container opens that container in **Containers**.

For example, a project named `juliarosedelane` can contain services `ghost` and `ghost-db`, containers named `juliarosedelane-ghost` and `juliarosedelane-ghost-db`, and images such as `ghost:5-alpine` and `mysql:8.4`. These are different concepts, and Docker Connector keeps them separate.

Applications is read-only at the project level. Docker Connector does not run `docker compose up` or `docker compose down`, edit Compose files, or update a whole Compose application. A Compose-managed container can report that a newer image is available but remains blocked from the standalone Update workflow.

> <font color="red"><strong>📷 Screenshot 14 required — Applications list</strong></font>
>
> <font color="red">Capture: Compose application cards with search/filter controls, service chips, status, resource counts, and update availability.</font>
>
> Suggested filename: `docs/images/user-guide/applications-list.png`

> <font color="red"><strong>📷 Screenshot 15 required — Application inspector</strong></font>
>
> <font color="red">Capture: An opened application inspector with Services, Containers, and Images sections.</font>
>
> Suggested filename: `docs/images/user-guide/application-inspector.png`

## 14. Containers

The **Containers** tab is the main container inventory. It has summary cards for **Containers**, **Running**, **Stopped**, and **Updates Available**. Selecting the Updates Available card filters the list; clear the active filter to return to the complete inventory.

Use the toolbar to search by container information and filter by State, Health, and Network. Sort and density controls make it practical to work with larger inventories. Each row identifies the container, image, short ID, state, health, and relevant update state. Copy controls copy a full ID without changing the Docker host.

> <font color="red"><strong>📷 Screenshot 16 required — Containers list and filters</strong></font>
>
> <font color="red">Capture: Container summary cards, search, State/Health/Network filters, sorting/density controls, and rows with state and health information.</font>
>
> Suggested filename: `docs/images/user-guide/containers-list.png`

### Container health

Docker state and Docker health are distinct. A container can be Running, Stopped/Exited, Restarting, or Dead. Health can be Healthy, Unhealthy, or **No health check**. No health check means the image or container configuration does not define Docker health checks; it does not mean Docker considers the container unhealthy.

## 15. Container detail inspector

Select a container to open its read-only inspector. The inspector provides **Actions**, **Overview**, **State**, **Configuration**, **Networking**, **Storage**, **Metadata**, and safe diagnostics where those details are available. Depending on the container, this can include image, creation time, state, health, restart count, port bindings, networks, mounts, labels that are safe to show, and storage attachments.

The inspector lets you refresh details and copy the full container ID. It does not provide an interactive shell, file browser, log terminal, or arbitrary Docker API console.

> <font color="red"><strong>📷 Screenshot 17 required — Container detail inspector</strong></font>
>
> <font color="red">Capture: A selected container with Actions and expanded Overview, State, Configuration, Networking, and Storage sections.</font>
>
> Suggested filename: `docs/images/user-guide/container-inspector.png`

## 16. Images

The **Images** tab is a read-only image inventory. Summary cards cover Images, In use, Dangling, and No visible references. You can search, filter by usage/tag state, architecture, and operating system, then sort by repository, tag, creation date, size, or usage count.

Select an image for an inspector with overview data, repository tags and digests, safe labels, and visible container references. Docker Connector does not delete images or expose arbitrary pull controls from this view.

> <font color="red"><strong>📷 Screenshot 18 required — Images inventory</strong></font>
>
> <font color="red">Capture: Image summary cards, search and filters, list rows, and an opened image inspector.</font>
>
> Suggested filename: `docs/images/user-guide/images.png`

## 17. Volumes

The **Volumes** tab lists Docker named volumes and their driver, scope, mountpoint summary, use state, and visible container count. It has summary cards for Volumes, In use, No visible references, and Drivers, plus search, driver, scope, and sort controls.

The volume inspector shows overview information, options, safe labels, and containers using the volume where Docker makes that relationship visible. Docker Connector does not delete volumes.

> <font color="red"><strong>📷 Screenshot 19 required — Volumes inventory</strong></font>
>
> <font color="red">Capture: Volume summary cards, filters, rows marked In Use or Unused, and a volume detail panel.</font>
>
> Suggested filename: `docs/images/user-guide/volumes.png`

## 18. Networks

The **Networks** tab lists Docker network definitions. It distinguishes built-in and user-defined networks, shows unused networks, and supports search plus filters for type, driver, scope, internal/external, attachable, and IPv6-enabled networks.

Selecting a network shows driver, scope, internal and attachable settings, IPv6 status, gateways, and attached containers. When a subnet is available it is shown in the list. Docker Connector does not create, change, or delete networks.

> <font color="red"><strong>📷 Screenshot 20 required — Networks inventory</strong></font>
>
> <font color="red">Capture: Network summary cards, filters, list rows, and a selected network with attached-container details.</font>
>
> Suggested filename: `docs/images/user-guide/networks.png`

## 19. Image update checking

Image update checking is advisory. Docker Connector compares the image used by an eligible container with the image currently resolved for its configured tagged image reference. It can show **Update status not checked**, **Checking for updates…**, **Update available**, **Image is current**, or a safe unavailable/error reason.

Automatic checks run on a 24-hour stale interval for eligible standalone containers **while Container management is enabled** and an Online snapshot is available. This is automatic checking, not automatic updating. Docker Connector never stops, restarts, recreates, or updates a container just because a scheduled check runs.

Choose **Check now** in the container inspector to perform a one-off check. The Docker daemon may pull or resolve image data to check the image ID, but Check now does not change the running container’s state.

> [!note] Availability is not eligibility
> **Update available** means a newer image is available. **Update eligibility** means Docker Connector can safely use its standalone update transaction. Compose-managed containers can have an available image but remain ineligible for the standalone Update action.

> <font color="red"><strong>📷 Screenshot 21 required — Image update availability</strong></font>
>
> <font color="red">Capture: A container inspector’s Image update section showing Check now, Update available, comparison information, and the eligibility note.</font>
>
> Suggested filename: `docs/images/user-guide/update-available.png`

## 20. Container management

**Container management** is disabled by default. Enable it in Docker Connector Settings only for Docker hosts you trust. Enabling it asks for confirmation because lifecycle and update actions change the Docker host.

When disabled, the Actions section says that the plugin is in read-only mode. When enabled, action availability depends on the container’s current state, host status, profile capabilities, and whether another operation is already in progress.

> <font color="red"><strong>📷 Screenshot 22 required — Container management setting</strong></font>
>
> <font color="red">Capture: Docker Connector Settings with the Container management toggle, its privileged-access description, and status feedback.</font>
>
> Suggested filename: `docs/images/user-guide/container-management-setting.png`

### Start, Stop, Shut down, and Restart

- **Start** is available for stopped containers.
- **Shut down** requests Docker’s graceful stop behavior with a 30-second wait.
- **Stop** uses the normal stop action with a 10-second wait.
- **Restart** uses Docker’s restart action with a 10-second wait.

Docker Connector asks for confirmation before lifecycle actions and coordinates a refresh after an accepted action. These controls never appear as a bulk-action interface.

### Update

**Update** appears only when Container management is enabled, a newer image has been confirmed, and the container is eligible for the standalone update workflow. It is hidden when the current image is already current. Compose-managed containers and containers with unsupported configuration receive a safe reason instead of an unsafe generic update button.

## 21. Safe container update workflow

An eligible Update begins with a confirmation preview. It identifies the container and image, summarizes supported configuration preservation, shows warnings, and offers Cancel or a direct proceed action. There is no acknowledgement checkbox; the writable-layer warning remains prominent.

The transaction is designed for standalone containers. It inspects the original container, validates eligibility, pulls the candidate image, compares image IDs, stops the original if needed, preserves it as a backup, creates and configures a replacement, restores supported networking, starts and verifies the replacement, then cleans up the backup where safe. The exact progress view reports the stage actually in progress.

Docker Connector attempts to preserve the supported Docker configuration needed to recreate an eligible standalone container, including its relevant mounts, ports, restart configuration, and network attachments. No update workflow can make writable-layer-only data persistent.

> <font color="red"><strong>📷 Screenshot 23 required — Update preview</strong></font>
>
> <font color="red">Capture: The standalone container update confirmation preview with container/image details, preservation summary, writable-layer warning, Cancel, and Proceed with update.</font>
>
> Suggested filename: `docs/images/user-guide/update-preview.png`

> <font color="red"><strong>📷 Screenshot 24 required — Update progress</strong></font>
>
> <font color="red">Capture: An in-progress update transaction showing its real current stage and non-interactive progress state.</font>
>
> Suggested filename: `docs/images/user-guide/update-progress.png`

## 22. Rollback and recovery

If a replacement cannot be created, started, or verified after mutation starts, Docker Connector attempts to restore the original container from its preserved backup. Results distinguish successful updates, updates where a backup is retained, already-current images, failure before mutation, failure with rollback, incomplete rollback, and cancellation.

Rollback is a recovery attempt, not an absolute guarantee against every host, storage, or Docker failure. If the result says a backup was retained, rollback is incomplete, or manual recovery is required, pause and inspect the reported container names and Docker state before taking further action. Do not repeatedly retry an unclear update result.

> [!warning] Writable-layer data
> Data kept only in a container’s writable layer is not equivalent to a named volume or bind mount. Recreating a container can lose writable-layer-only changes. Persist important data with Docker volumes or bind mounts before updating.

> <font color="red"><strong>📷 Screenshot 25 required — Update result and recovery guidance</strong></font>
>
> <font color="red">Capture: A completed update result, including either success or a rollback/backup-retained result with safe next-step guidance.</font>
>
> Suggested filename: `docs/images/user-guide/update-result.png`

## 23. Automatic refresh

Automatic refresh is enabled by default. The default interval is five minutes and can be changed to any whole number of minutes of at least one. Manual refresh performs one immediate snapshot refresh. Update checks use their separate 24-hour eligibility schedule and are not a substitute for snapshot refresh.

## 24. Settings

Docker Connector Settings provide:

- **Automatic refresh** — refresh configured hosts in the background.
- **Refresh interval** — minutes between background refreshes.
- **Theme integration** — use Obsidian’s native theme variables.
- **Container management** — enable or disable explicit Start, Shut down, Stop, Restart, and Update actions.

Changing Container management is persisted safely and open Docker Connector views update their action controls. It does not retroactively run any Docker action.

## 25. Security model and saved information

Docker Connector saves connection metadata needed to reconnect, but keeps secrets out of saved settings where possible.

| Information | Saved in the profile? |
| --- | --- |
| Friendly name, description, category, host, and port | Yes |
| Docker Context name and safe endpoint snapshot | Yes |
| SSH username and private-key file path | Yes |
| SSH password | No — session-only |
| SSH private-key passphrase | No — session-only |
| TLS CA, client-certificate, and client-private-key paths | Yes |
| TLS certificate/key contents | No |
| TLS client-key passphrase | No — session-only |

The plugin does not mutate Docker Contexts and does not support insecure `tcp://` Docker endpoints. Mutual TLS server verification is mandatory. Profile deletion clears runtime secrets and plugin-owned cached state but leaves external SSH and certificate files untouched.

## 26. Troubleshooting

### Docker CLI was not found

Docker Context needs a local Docker CLI. Confirm Docker is installed with:

```bash
docker --version
docker context ls
```

Docker Connector uses bounded PATH and standard-location discovery; it does not source `~/.zshrc`, `~/.bashrc`, or a login shell. If Terminal finds Docker but the plugin does not, restart Obsidian after installing Docker or Docker Desktop and use **Discover Contexts** again.

### Docker Engine unavailable

The Docker CLI being installed is not the same as Docker Engine being available. Check the engine with:

```bash
docker info
docker ps -a
```

Docker Desktop may be stopped, a remote Context endpoint may be unreachable, or a socket may be missing. Do not change the active Docker Context merely to make Docker Connector connect.

### Local Docker endpoint unavailable

Check that Docker is running and that your account can access the selected endpoint. On macOS, inspect a compatibility link safely with:

```bash
ls -l /var/run/docker.sock
```

Docker Connector validates symlinks and reports missing, broken, non-socket, looped, or inaccessible endpoints. Do **not** use `chmod 666 /var/run/docker.sock` as a workaround; that weakens Docker-host security.

### SSH authentication or host-key error

Verify the host, port, username, password/key, passphrase, remote Docker socket path, and Docker permissions for the remote account. A password or passphrase must be re-entered after an Obsidian restart. For a host-key mismatch, independently verify the new fingerprint before trusting it.

### Docker Context missing or changed

The named Context may have been removed or its endpoint configuration may have changed outside Docker Connector. Rediscover contexts and edit/retest the profile. Docker Connector will not repair the Context by changing Docker CLI state for you.

### Mutual TLS failure

Check the selected CA, client certificate, matching client private key, optional passphrase, and Server Name. `DOCKER_TLS_HOSTNAME_MISMATCH` means the expected Server Name does not match a valid certificate identity. An IP address must appear in an IP SAN; a hostname must appear in a DNS SAN. Do not disable certificate verification to work around this error.

### Client certificate rejected

The Docker Engine may require a certificate signed by a different CA, a client certificate with the proper client-authentication purpose, or a matching key. Recheck the server’s mutual-TLS configuration with its administrator; Docker Connector cannot make an untrusted client certificate acceptable.

### Connection stays Unknown

Unknown means not yet evaluated. Use Retry or refresh the profile. A completed attempt should become Online, Offline, Degraded, or Authentication Required with a safe error. If it remains Unknown after a completed refresh, collect the diagnostics and report it as a problem.

### Update check or update unavailable

An image can be current, unavailable from a registry, untagged, inaccessible, Compose-managed, or unsuitable for safe standalone recreation. Check now does not override those safety restrictions. Registry authentication or pull failures must be resolved in the Docker environment; Docker Connector does not manage registry credentials.

## 27. Frequently asked questions

**Does Docker Connector store my SSH password?** No. SSH passwords and key passphrases are runtime-only and must be re-entered when the session needs them again.

**Can I use it on mobile?** No. Docker Connector is desktop-only.

**Does it change my active Docker Context?** No. It discovers and uses the selected context without running Context mutation commands.

**Does it support insecure `tcp://host:2375`?** No. Plain unauthenticated Docker TCP is unsupported.

**Can it manage a remote Docker host?** Yes, after you explicitly enable Container management and only through the supported connection profile and typed actions.

**Can it update a Docker Compose application?** No. Applications are read-only and Compose-managed containers are blocked from the standalone Update workflow.

**Does deleting a connection delete the Docker server?** No. It removes Docker Connector’s profile and cached session state only.

**Does Update delete my volumes?** Docker Connector does not delete volumes. However, data stored only in a container writable layer may be lost when a container is recreated; use named volumes or bind mounts for persistent data.

**Why is Update missing?** It appears only for an eligible standalone container after a newer image has been confirmed and Container management is enabled.

**Can two profiles point to the same daemon?** Yes. For example, Local Docker Socket and Docker Context can intentionally reach the same local Docker Desktop daemon while remaining distinct saved profiles.

**Does Docker Connector send telemetry?** No telemetry or analytics service is part of the plugin. Its network activity is limited to configured Docker/SSH/TLS/Context connections, image-registry availability checks, and Docker-daemon image pulls used for supported update checks.

## 28. Known limitations

- Docker Connector is desktop-only.
- Plain insecure Docker TCP is not supported.
- Applications is a Compose-aware read-only view; it does not deploy, edit, start, stop, or update Compose projects.
- Standalone transactional Update is intentionally blocked for Compose-managed and otherwise unsupported containers.
- Passwords and passphrases are session-only, so reconnecting after restarting Obsidian can require them again.
- Some Docker Context endpoint types are blocked when they cannot be routed through an existing secure transport.
- Docker permissions, Docker Engine availability, registry access, and remote host policy ultimately control what the plugin can inspect or change.

## 29. Uninstalling Docker Connector

Disable or remove Docker Connector through Obsidian’s Community Plugins settings. Removing the plugin does not delete Docker containers, images, volumes, networks, Docker Contexts, SSH keys, TLS certificates, Docker sockets, or remote server configuration. Removing saved plugin data follows Obsidian’s normal plugin-data behavior; inspect your vault before manually deleting plugin files.

## 30. Glossary

- **Docker Engine / daemon:** The service that manages containers, images, volumes, and networks.
- **Docker socket:** A local Unix socket or Windows named pipe used to communicate with Docker Engine.
- **Docker Context:** A Docker CLI connection profile describing where and how Docker is reached.
- **SSH:** Secure Shell, a secure remote-session protocol.
- **Private key:** A secret key file used for SSH or client-certificate authentication.
- **Mutual TLS:** HTTPS where both the server and client prove their identities with certificates.
- **CA:** Certificate authority; the certificate used to verify a server certificate chain.
- **Client certificate:** A certificate presented by Docker Connector to a mutual-TLS Docker Engine.
- **Compose project / service:** Docker Compose’s grouping and service metadata, represented by Docker labels.
- **Container:** A running or stopped instance created from an image.
- **Image:** A packaged filesystem and metadata used to create containers.
- **Volume:** Docker-managed persistent storage that can outlive a container.
- **Network:** Docker’s connectivity definition for containers.
- **Health check:** Docker’s optional command-based health reporting for a container.
- **Writable layer:** Data written inside a container outside mounted persistent storage.
- **Rollback:** An attempt to restore the original container after an update transaction fails.

## 31. Reporting problems and getting help

When reporting a problem, include the connection method, safe error code or diagnostic stage, Docker Engine version, operating system, and the steps that reproduce the issue. Do not include passwords, passphrases, private keys, certificate contents, complete inspect output, or environment-variable values.

For implementation and security details, see [[Docker Connector - Security Review]], [[Docker Connector - Testing]], [[Docker Connector - Docker Context]], and the repository README.

## Screenshot production checklist

| No. | Filename | Section | Capture |
| --- | --- | --- | --- |
| 01 | `first-launch-empty-state.png` | First launch | Empty Connections state and Add Docker Host action. |
| 02 | `dashboard-overview.png` | Interface | Online Overview with header, navigation, and summary. |
| 03 | `add-docker-host.png` | Adding a host | Complete Add Docker Host form. |
| 04 | `local-docker-socket.png` | Local connection | Detected local endpoint and discovery status. |
| 05 | `docker-context.png` | Docker Context | CLI detected and context selector. |
| 06 | `ssh-password.png` | SSH | Password authentication fields. |
| 07 | `ssh-private-key.png` | SSH | Private-key fields and host-key controls. |
| 08 | `mutual-tls.png` | Mutual TLS | Host, Server Name, CA, client cert, and client key fields. |
| 09 | `connection-test-success.png` | Testing | Successful transport-specific diagnostics. |
| 10 | `connection-test-failure.png` | Testing | First failure with later stages not run. |
| 11 | `connections-management.png` | Connections | Add, status, Edit, Reconnect/Retry, and Delete actions. |
| 12 | `delete-connection.png` | Connections | Scope-safe delete confirmation. |
| 13 | `current-environment.png` | Switching | Current Environment selector. |
| 14 | `applications-list.png` | Applications | Compose project cards and filters. |
| 15 | `application-inspector.png` | Applications | Services, containers, and images inspector. |
| 16 | `containers-list.png` | Containers | Summary cards, filters, and container rows. |
| 17 | `container-inspector.png` | Containers | Detail inspector sections. |
| 18 | `images.png` | Images | Inventory and image inspector. |
| 19 | `volumes.png` | Volumes | Inventory and volume inspector. |
| 20 | `networks.png` | Networks | Inventory and network inspector. |
| 21 | `update-available.png` | Update checking | Available image state and Check now. |
| 22 | `container-management-setting.png` | Management | Opt-in Settings control. |
| 23 | `update-preview.png` | Update | Confirmation and writable-layer warning. |
| 24 | `update-progress.png` | Update | Transaction progress. |
| 25 | `update-result.png` | Recovery | Update or rollback result guidance. |
