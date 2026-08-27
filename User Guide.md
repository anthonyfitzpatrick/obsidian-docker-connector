---
title: Docker Connector User Guide
---

# Docker Connector User Guide

## Desktop access

Docker Connector supports desktop Obsidian on macOS, Windows, and Linux. Local Docker Socket, Docker Context, Remote Docker via SSH, and Remote Docker API (Mutual TLS) use desktop runtime capabilities such as local sockets, the Docker CLI, SSH, and certificate files.

Docker Connector is an Obsidian desktop plugin for monitoring Docker environments and, when you explicitly enable it, carrying out a small set of container-management actions. It keeps local and remote Docker environments in one Obsidian workspace without trying to replace Docker Desktop, the Docker CLI, or a full deployment platform.

Docker Connector is read-only by default. You can inspect hosts, Docker Compose applications, containers, images, volumes, networks, and image-update availability without enabling container management. Lifecycle and update actions are deliberately opt-in.

> [!warning] Docker access is highly privileged
> A person or process that can control a Docker daemon can often gain extensive control of that Docker host. Connect only to hosts and credentials you trust. The safeguards in Docker Connector reduce accidental risk; they do not make Docker-daemon access low-risk.

## 1. About Docker Connector

Docker Connector supports multiple saved Docker environments. Each saved connection has its own status, inventory, cached dashboard data, and runtime credentials. Select one environment as the **Current Environment** to view its Overview, Applications, Containers, Images, Volumes, and Networks.

The current release supports four desktop connection methods:

| Method | Best for | Authentication | Direct Docker API exposure |
| --- | --- | --- | --- |
| Local Docker Socket | Docker running on the same computer as Obsidian | Local operating-system and Docker permissions | No |
| Docker Context | An existing Docker CLI configuration | Defined by the selected Context | Depends on the Context |
| Remote Docker via SSH | Most remote Docker hosts | Password or private key | No |
| Remote Docker API (Mutual TLS) | A deliberately secured direct Docker Engine API | CA certificate, client certificate, and client private key | Yes |

Plain unauthenticated Docker TCP is not supported.

## 2. Important security information

Docker Connector is designed to make its boundaries visible:

- It is read-only until **Container management** is enabled for the selected Online connection from the header switch.
- Its normal Docker Engine client is limited to approved GET requests. Start, Stop, Shut down, Restart, and Update use dedicated, typed operations rather than a general-purpose Docker API console.
- Passwords and private-key passphrases are runtime-only by default. An SSH password profile can explicitly opt in to separate, unencrypted local plugin-data storage on a trusted device; see [[#Password authentication]].
- Remote Docker via SSH keeps Docker API traffic inside the SSH session. It does not require a direct Docker API listener.
- Mutual TLS requires server-certificate verification and a client certificate. Docker Connector does not offer an insecure “accept any certificate” mode.
- Docker Context discovery and use never changes your active Docker Context.
- Delete connection removes Docker Connector data only; it never deletes Docker resources or external credential files.

## 3. Requirements

Docker Connector supports desktop Obsidian on macOS, Windows, and Linux. Local Docker Socket, Docker Context, SSH, and mutual TLS require desktop capabilities.

You also need appropriate access for the method you select:

- **Local Docker Socket:** Docker Engine or Docker Desktop running locally, and permission to open its socket or named pipe.
- **Docker Context:** Docker CLI installed locally and an existing Docker Context. The context is discovered; Docker Connector does not create or modify it.
- **Remote Docker via SSH:** SSH access to the Docker host and permission for that remote account to use the configured Docker socket without interactive `sudo`.
- **Remote Docker API (Mutual TLS):** a Docker Engine HTTPS endpoint configured for mutual TLS, plus a CA certificate, client certificate, and matching client private key.

## 4. Installation

When Docker Connector is available through Obsidian Community Plugins, install it from **Settings → Community plugins → Browse**, search for **Docker Connector**, then install and enable it. If it is not yet listed in the Community Plugin directory, use the project’s release instructions rather than copying source files into your vault.

For a manual release installation, the plugin directory needs only `main.js`, `manifest.json`, and `styles.css`. Source files, test fixtures, and `node_modules` are not required for normal use.

## 5. First launch

On first launch there are no saved Docker connections. Open **Connections** and choose **Add Docker Host**. After testing and saving a host, choose it as the Current Environment to populate the dashboard.

### Screenshot 01 — Empty Docker connections state
![Empty Docker connections state](docs/images/user-guide/01-empty-connections.png)

## 6. Understanding the interface

The header identifies the Current Environment and its connection status. Use the refresh control for an immediate read-only snapshot refresh. When automatic refresh is enabled, Docker Connector also refreshes configured hosts in the background at the interval chosen in Settings. With one individual **Online** host selected, the compact header **Container management** switch is available: **Read-only** is off and **Enabled** is on for that profile only. It is unavailable for **All Docker hosts** and for any non-Online profile.

The primary navigation contains **Overview**, **Applications**, **Containers**, **Images**, **Volumes**, **Networks**, and **Connections**. The resource tabs show data for the Current Environment; their search, filter, sort, and detail controls never mutate Docker resources.

### Screenshot 02 — Main Docker Connector dashboard
![Docker Connector dashboard](docs/images/user-guide/02-dashboard-overview.png)

## 7. Adding a Docker host

1. Open **Connections**.
2. Select **Add Docker Host**.
3. Provide a **Friendly Name**. Description and Category are optional organization fields.
4. Select a **Connection Type**.
5. Complete only the fields for that method.
6. Choose **Test Connection** and review the transport-specific diagnostics.
7. Choose **Save Host**.

On desktop, drag the dialog by its title bar or resize it from its lower-right edge. On touch and narrow layouts, it remains viewport-safe without draggable controls.

### Screenshot 03 — Add Docker Host dialog
![Add Docker Host dialog](docs/images/user-guide/03-add-docker-host.png)

Testing before saving is strongly recommended. A successful test proves the selected profile can validate its endpoint and obtain safe Docker information; saving then registers the profile for the normal dashboard refresh lifecycle.

## 8. Connection methods

### Screenshot 04 — Connection Type selector
![Connection Type selector](docs/images/user-guide/04-connection-type-selector.png)

### 8.1 Local Docker Socket

**Local Docker Socket** connects to Docker running on the same computer as Obsidian. On macOS and Linux this is a Unix socket; on Windows it is a Docker named pipe. Docker Connector discovers common local endpoints and validates the endpoint before connecting.

On macOS, Docker Desktop commonly uses a user socket such as `~/.docker/run/docker.sock`; `/var/run/docker.sock` may be a compatibility symlink. Docker Connector resolves and validates supported socket symlinks rather than replacing them. No SSH credentials, TLS files, or Docker TCP listener are involved.

The **Docker Endpoint** field can show the detected local Unix socket or Windows named pipe. If Docker Desktop is stopped, the endpoint is missing, the symlink is broken, or your account cannot open it, Test Connection explains that local endpoint problem.

### Screenshot 05 — Local Docker Socket configuration
![Local Docker Socket configuration](docs/images/user-guide/05-local-docker-socket.png)

### 8.2 Docker Context

A **Docker Context** is a Docker CLI connection profile. Docker Connector finds existing contexts through the local Docker CLI and does not run `docker context use`, create, update, remove, import, or export a context.

This distinction matters: Docker Connector uses the context you select without changing the context that your terminal or other Docker tools consider active. The Docker CLI must be installed, but the CLI being present is separate from whether the Docker Engine is currently reachable.

The plugin performs bounded discovery of the Docker CLI from the current process PATH and standard platform locations. This helps normal macOS GUI launches, where Obsidian can inherit a different PATH than Terminal, without invoking a login shell or reading shell startup files.

### Screenshot 06 — Docker CLI detected
> **Screenshot placeholder 06**
>
> **Capture:** Docker Context configuration showing the detected Docker CLI/version and a discovered supported context.
>
> **How to capture this screenshot:**
> 1. Open **Add Docker Host** and select **Docker Context**.
> 2. Run context discovery and wait for Docker CLI discovery to finish.
> 3. Ensure the detected Docker CLI/version message and available-context count are visible.
> 4. Ensure at least one safe discovered context is visible, preferably `desktop-linux`, together with its **Current** marker when applicable.
> 5. Include the selected context's supported endpoint summary.
> 6. Use a normal test/local context setup; do not change the active Docker Context merely for the screenshot.
> 7. Avoid displaying private remote endpoints not intended for documentation.
> 8. Capture enough diagnostics to demonstrate that Docker Connector found the CLI, enumerated contexts, and resolved the selected context successfully.
>
> **Suggested filename:** `docs/images/user-guide/06-docker-cli-detected.png`

![Docker CLI and Context discovery](docs/images/user-guide/06-docker-cli-detected.png)

Docker Connector resolves a selected Context to the right physical transport each time it is used:

- a `unix://` Context uses the local Docker transport;
- a Windows `npipe://` Context uses the local named-pipe transport;
- an `ssh://` Context uses Docker CLI’s explicit Context-backed secure transport;
- insecure, unknown, and endpoint types that cannot be handled safely are blocked.

The saved profile and connection card still say **Docker Context**, even when the underlying transport is local.

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

With **Password** selected, enter the SSH password during connection or reconnection. Docker Connector keeps that password in memory only for the current Obsidian session by default. It is not stored in the saved profile, so a profile can show **Authentication Required** after Obsidian restarts. Choose **Reconnect** to provide it again.

For a password profile only, **Remember password on this device** is an optional, off-by-default choice. It stores the password separately in local plugin data so Docker Connector can reconnect after Obsidian restarts. Obsidian does not provide this plugin a supported keychain or guaranteed encryption, so use it only on a trusted device, prefer SSH keys where possible, and use **Forget stored password** to remove it immediately. It never applies to private-key passphrases, TLS passphrases, keys, or certificates. Host-key verification is still mandatory: a changed host key blocks reconnection even when a password is remembered.

### Screenshot 07 — Remote Docker via SSH password
![Remote Docker via SSH password](docs/images/user-guide/07-ssh-password.png)

#### Host-key verification

The **Host Key Fingerprint** identifies the remote SSH server. Docker Connector does not use `known_hosts`, auto-trust a first key, or silently replace a saved key.

1. Select **Test Connection**. An unknown server key opens **Verify SSH Host**, which shows the configured host and port and the received SHA-256 fingerprint.
2. Independently verify the fingerprint with the server administrator or a trusted out-of-band source. Select **Cancel** to leave the draft untrusted, or **Trust and Continue** to trust that received key only in the unsaved form.
3. **Trust and Continue** performs exactly one automatic retest with the same session-only credential. A successful SSH test shows the completed SSH handshake, host-key verification, SSH authentication, Docker `GET /_ping`, and Docker `GET /version` diagnostics. Authentication stages not selected for the profile are marked **SKIPPED**.
4. Select **Save Host** only after that successful retest. Saving persists the verified host-key fingerprint metadata, never a password or private-key passphrase.

### Screenshot 08 — Verify SSH Host
![Verify SSH Host dialog](docs/images/user-guide/08-verify-ssh-host.png)

### Screenshot 09 — SSH connection success diagnostics
![SSH connection success diagnostics](docs/images/user-guide/09-ssh-connection-success.png)

### Screenshot 10 — Remember SSH password option
![Remember SSH password option](docs/images/user-guide/10-remember-ssh-password.png)

With the option off, an Obsidian restart returns the profile to **Authentication Required** and **Reconnect** asks for the password again. With the option explicitly on, Docker Connector rehydrates the stored password only for that profile and only when the saved host-key fingerprint still matches. Use **Forget stored password** to remove it immediately. A changed host key always opens **SSH Host Identity Changed**, showing both trusted and received fingerprints with no replacement action; it blocks reconnection even when a password is remembered.

#### Private-key authentication

With **Private Key** selected, use **Browse…** to choose an existing key or select **Generate SSH Key**. For the recommended unattended setup, leave both passphrase fields blank before generation. A nonblank generation passphrase encrypts the key: it remains session-only and must be entered again after restart, so it is not unattended.

### Screenshot 11 — Generate SSH Key completed
![Generate SSH Key completed](docs/images/user-guide/11-generate-ssh-key.png)

**Generate SSH Key** has completed successfully: the dialog confirms an Ed25519 SSH key is ready, shows a safe public SHA-256 fingerprint, and provides **Close**. Select **Close** to return to the SSH host form.

### Screenshot 12 — Remote Docker via SSH private-key selection
![Remote Docker via SSH private-key selection](docs/images/user-guide/12-ssh-private-key-selection.png)

The host form now shows the validated selected key and public fingerprint. Docker Connector saves only the key path, never key contents, and derives its public identity. When a sibling `<private-key>.pub` exists, its type and base64 identity must match; a mismatched `.pub` blocks installation, while a missing `.pub` is derived in memory without modifying the private key. Select **Install Public Key**, enter the remote account's current session-only SSH password, complete first-host verification if needed, test the selected private key, save the host, then restart Obsidian to confirm it reconnects online.

Never expose private-key contents, public-key contents, entered passphrases, identifying filesystem paths, or other secrets.

### Screenshot 13 — SSH key generation complete
![SSH key generation complete](docs/images/user-guide/13-ssh-key-generation-complete.png)

The completed dialog confirms the Ed25519 key is ready, shows its public SHA-256 fingerprint, and provides **Close** to return to the SSH host form.

### Screenshot 14 — Install Public Key
![Install Public Key](docs/images/user-guide/14-install-public-key.png)

The **Install Public Key** dialog shows the selected key's public SHA-256 fingerprint. Docker Connector appends only that public key to the remote account's `~/.ssh/authorized_keys` when it is not already present; existing entries are preserved.

**Current SSH Password** is the remote account's existing password, needed only for this session-only installation and never saved. The screenshot intentionally leaves it empty. The private key, its passphrase, and its contents are never transferred to the remote host. After entering the remote account password, select **Install public key**.

### Screenshot 15 — Private-key Test Connection success
![Private-key Test Connection success](docs/images/user-guide/15-private-key-test-success.png)

After public-key installation, select **Test Connection** to verify host-key verification, private-key authentication, and Docker `GET /_ping` and `GET /version` all succeed.

The profile can save the private-key file path, not a copy of the key material. An encrypted key’s passphrase remains in memory only for the current session; an unencrypted key simply has no passphrase to enter. Remembered SSH passwords never apply to private-key passphrases or public-key installation.

### 8.4 Remote Docker API (Mutual TLS)

### Screenshot 16 — Remote Docker API (Mutual TLS) form
![Remote Docker API Mutual TLS form](docs/images/user-guide/16-remote-docker-api-mtls.png)

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

Docker Connector validates the selected CA, client certificate, and client private key locally before connecting. The client certificate and private key must form a matching pair; use **Test Connection** only after that validation succeeds.

## 9. Testing a connection

**Test Connection** validates a draft before it is saved or after it is edited. The diagnostics are deliberately transport-specific, so not every method shows the same stages. Typical stages include profile validation, Docker Context discovery, local endpoint validation, loading TLS files, opening a connection, server-certificate verification, server-name verification, Docker `GET /_ping`, Docker `GET /version`, and response parsing.

A completed stage is marked **SUCCESS**. An authoritative failure is **ERROR**. Stages that could not start after a failure are shown as **SKIPPED** or **NOT RUN**, rather than being presented as successful. For example, a mutual-TLS hostname mismatch stops before Docker API requests are used.

For mutual TLS, a successful test loads the TLS files, confirms the certificate/key pair, opens the TLS connection, verifies the server certificate and Server Name, then completes Docker `GET /_ping` and `GET /version`. If the Server Name is wrong, correct it before saving; the Docker API checks do not run after an identity failure.

### Screenshot 17 — Successful local Test Connection diagnostics
![Successful local Docker Test Connection diagnostics](docs/images/user-guide/17-local-test-success.png)

## 10. Managing saved connections

Open **Connections** to manage every saved profile. The page begins with summary cards for **Configured hosts**, **Online**, and **Needs sign-in**; Needs sign-in counts only profiles in **Authentication Required**. For example, three configured profiles may show one Online and two Needs sign-in without changing either healthy profile’s state. It then provides **Add Docker Host** and a card for every profile. Each card uses one uniform structure: purple Docker host identity, textual connection method, transport-relevant safe endpoint details, inventory, runtime details, actions, and management row. Only the safe profile data and status vary by connection method.

### Screenshot 18 — Docker connections overview
![Docker connections overview](docs/images/user-guide/18-connections-overview.png)

The summary cards count saved profiles, currently connected profiles, and profiles whose session-only credentials must be supplied again. **Add Docker Host** opens the profile workflow. Each card shows current status, a safe endpoint, inventory and runtime details where available, **Open dashboard**, **Edit**, **Delete**, and a compact profile-scoped **Container management** control.

**Edit** opens the same profile workflow without changing the profile’s stable identity. **Reconnect** appears when session-only credentials need to be entered again or an Offline or Degraded connection can be retried; it is not always visible and need not appear in this image. **Delete connection** opens a confirmation dialog.

Status is information, not an action. The current states are **Unknown**, **Connecting**, **Online**, **Offline**, **Degraded**, and **Authentication Required**. Unknown means the profile has not yet been evaluated or is between registration and its first refresh; it should not remain permanent after a completed connection attempt. Authentication Required normally means a required runtime-only secret must be supplied again.

**Open dashboard** selects that Docker environment and opens its operational dashboard. Its **Overview** tab is the host-level operational summary for the selected environment. Where available, it presents connection health, Docker version and host information, resource counts, refresh information, and attention items that deserve review. Attention items can identify a host connection problem, an unhealthy container, a restarting or dead container, a non-zero container exit, or an available public release where that information is supported by the view. Overview is not a metrics-history system: it shows the latest safe dashboard snapshot for the selected environment.

### Screenshot 19 — Authentication Required / Reconnect
![Authentication Required profile with Reconnect action](docs/images/user-guide/19-authentication-required-reconnect.png)

**Authentication Required** means Docker Connector needs a runtime-only credential before the profile can reconnect. This screenshot shows an SSH password profile. The same state can occur for an SSH profile using an encrypted private key when its session-only key passphrase is no longer available after restart.

**Reconnect** opens the appropriate credential workflow. Supply the required runtime credential through **Reconnect**, rather than displaying it on the passive connection card. Until authentication succeeds, Docker details may be unavailable, inventory counts may be empty, and **Container management** is unavailable because the connection is not Online.

### Delete connection

Deleting a connection removes only Docker Connector’s saved profile, runtime credentials, cached session data, and associated transport state. It does **not** stop or remove containers; delete images, volumes, or networks; remove Docker Contexts; delete SSH keys or TLS files; change Docker sockets; or change a remote server configuration. The confirmation dialog repeats this boundary before removal.

### Screenshot 20 — Delete connection confirmation
![Delete connection confirmation](docs/images/user-guide/20-delete-connection.png)

## 11. Switching environments

Use **Current Environment** to choose which saved host supplies dashboard data. Switching environment changes the data in Overview, Applications, Containers, Images, Volumes, and Networks. Profiles are isolated even if two profiles intentionally point to the same Docker daemon—for example, a Local Docker Socket profile and a Docker Context that resolves to Docker Desktop’s local socket.

If the selected profile is deleted, Docker Connector chooses a safe remaining profile where possible, preferring an Online profile. If no profiles remain, the dashboard returns to its no-host state.

### Screenshot 21 — Current Environment selector
![Current Environment selector](docs/images/user-guide/21-current-environment.png)

## 12. Applications

Applications groups Docker Compose-managed containers into projects. Docker Connector uses Docker’s Compose metadata—especially `com.docker.compose.project` and `com.docker.compose.service`—rather than guessing project membership from names, paths, networks, or image references.

### Screenshot 22 — Applications list
![Applications list](docs/images/user-guide/22-applications-list.png)

Application cards show a project’s services, container counts, running and stopped counts, available-update count where known, and associated networks, volumes, and images. The list supports searching, status and update filtering, sorting, and an inspector. The inspector exposes project details, services, containers, and images; selecting a listed container opens that container in **Containers**.

### Screenshot 23 — Application detail inspector
![Application detail inspector](docs/images/user-guide/23-application-inspector.png)

The inspector organizes project information into sections such as Overview, Services, Containers, Images, Networks, and storage information where available. Sections can be expanded as needed rather than displaying every relationship at once. Selecting a listed container opens that container in **Containers**.

For example, the `owncloud` Compose project shown above contains services including `euro-office`, `owncloud`, `owncloud-db`, and `owncloud-redis`. Its containers correspond to those services, while the Docker images used to create those containers remain separate image resources. Projects, services, containers, and images are different Docker and Compose concepts, and Docker Connector keeps those relationships distinct.

Applications is read-only at the project level. Docker Connector does not run `docker compose up` or `docker compose down`, edit Compose files, or update a whole Compose application. A Compose-managed container can report that a newer image is available but remains blocked from the standalone Update workflow.

## 13. Containers

The **Containers** tab is the main container inventory. It has summary cards for **Containers**, **Running**, **Stopped**, and **Updates Available**.

### Screenshot 24 — Containers view
![Containers inventory with no active filters](docs/images/user-guide/24-containers-view.png)

With no filter applied the count shows the full inventory, and the summary cards report the totals for the selected environment. The example above shows sixteen containers across **All Docker hosts**, all of them running.

Use the toolbar to search by container information and filter by State, Health, and Network. Sort and density controls make it practical to work with larger inventories. Each container card identifies the container, image, short ID, state, and health, together with its status, Docker host, networks, published ports, and creation time at Comfortable density. Selecting a card's short ID copies the full container ID to the clipboard without opening the container or changing the Docker host.

### Screenshot 25 — Updates Available filter
![Updates Available filter applied in Containers](docs/images/user-guide/25-updates-filter.png)

Selecting the **Updates Available** card applies an additive filter to the container list. The applied filter appears as an **Updates available** chip in the **Active filters** row, alongside **Clear all**, and the result count above the summary cards reports how many of the total containers currently match.

In the example above the filter is applied while every checked container is current, so the count shows `0 of 16 containers` and the list shows the **Everything is up to date** empty state with **Show all containers**. When containers do have a newer image available, the same filtered list shows only those containers instead. Use **Show all containers**, the chip's remove control, or **Clear all** to return to the complete inventory.

### Screenshot 26 — Compact density
![Containers inventory at Compact density](docs/images/user-guide/26-compact-density.png)

Compact density keeps each container's name, state, health, image, and short ID, and omits the Docker host, network, published-port, and creation-time lines that Comfortable adds. The pane above is the same width as screenshot 24, where nine containers were visible; at Compact all sixteen fit.

Density only changes how much of each container is summarized. It does not change which containers the filters return, and it does not affect the Docker host. The selected density is saved, so it is still applied the next time Docker Connector opens.

### Container health

Docker state and Docker health are distinct. A container can be Running, Stopped/Exited, Restarting, or Dead. Health can be Healthy, Unhealthy, or **No health check**. No health check means the image or container configuration does not define Docker health checks; it does not mean Docker considers the container unhealthy.

## 14. Container detail inspector

Select a container to open its read-only inspector. The inspector provides **Actions**, **Overview**, **State**, **Configuration**, **Networking**, **Storage**, **Metadata**, and safe diagnostics where those details are available. Depending on the container, this can include image, creation time, state, health, restart count, port bindings, networks, mounts, labels that are safe to show, and storage attachments.

The inspector lets you refresh details and copy the full container ID. It does not provide an interactive shell, file browser, log terminal, or arbitrary Docker API console.

### Screenshot 27 — Container detail inspector
> **Screenshot placeholder 27**
>
> **Capture:** Read-only sections and the Image update area.
>
> **How to capture this screenshot:**
> 1. Open **Containers** and select a safe test container.
> 2. Allow the detail inspector to populate.
> 3. Ensure **Actions**, **Overview**, **State**, **Configuration**, **Networking**, **Storage**, **Metadata**, and the **Image update** area are visible as much as the layout permits.
> 4. Use a test container whose metadata does not contain sensitive environment information.
> 5. Capture the inspector and selected container row; do not expand anything that would expose secrets.

>
> **Suggested filename:** `docs/images/user-guide/27-container-inspector.png`

## 15. Images

The **Images** tab is a read-only image inventory. Summary cards cover Images, In use, Dangling, and No visible references. You can search, filter by usage/tag state, architecture, and operating system, then sort by repository, tag, creation date, size, or usage count.

Select an image for an inspector with overview data, repository tags and digests, safe labels, and visible container references. Docker Connector does not delete images or expose arbitrary pull controls from this view.

### Screenshot 28 — Images view
> **Screenshot placeholder 28**
>
> **Capture:** Image inventory and detail inspector.
>
> **How to capture this screenshot:**
> 1. Select a populated Online test environment and open **Images**.
> 2. Wait for image inventory and summary counts to load.
> 3. Select a non-sensitive image so the inspector is visible.
> 4. Ensure the inventory, tags/IDs, usage information, and inspector are readable.
> 5. Do not expose registry credentials or private repository information not intended for publication.
> 6. Capture the Images view with both list and inspector if the layout allows.

>
> **Suggested filename:** `docs/images/user-guide/28-images-view.png`

## 16. Volumes

The **Volumes** tab lists Docker named volumes and their driver, scope, mountpoint summary, use state, and visible container count. It has summary cards for Volumes, In use, No visible references, and Drivers, plus search, driver, scope, and sort controls.

The volume inspector shows overview information, options, safe labels, and containers using the volume where Docker makes that relationship visible. Docker Connector does not delete volumes.

### Screenshot 29 — Volumes view
> **Screenshot placeholder 29**
>
> **Capture:** Named-volume inventory and inspector.
>
> **How to capture this screenshot:**
> 1. Select a test environment with at least one named Docker volume.
> 2. Open **Volumes** and wait for inventory to load.
> 3. Select a non-sensitive named volume.
> 4. Ensure the list shows driver/scope/use information and the inspector shows safe volume details/attached containers.
> 5. Avoid publishing host mount paths that reveal sensitive directory structure.
> 6. Capture the populated Volumes view and inspector.

>
> **Suggested filename:** `docs/images/user-guide/29-volumes-view.png`

## 17. Networks

The **Networks** tab lists Docker network definitions. It distinguishes built-in and user-defined networks, shows unused networks, and supports search plus filters for type, driver, scope, internal/external, attachable, and IPv6-enabled networks.

Selecting a network shows driver, scope, internal and attachable settings, IPv6 status, gateways, and attached containers. When a subnet is available it is shown in the list. Docker Connector does not create, change, or delete networks.

### Screenshot 30 — Networks view
> **Screenshot placeholder 30**
>
> **Capture:** Network inventory and attached-container details.
>
> **How to capture this screenshot:**
> 1. Select a test environment with user-defined Docker networks.
> 2. Open **Networks** and wait for inventory to load.
> 3. Select a non-sensitive network with attached test containers if possible.
> 4. Ensure driver, scope, internal/attachable/IPv6 information and attached containers are visible as available.
> 5. Avoid exposing network ranges that should remain private; use the isolated test network if needed.
> 6. Capture the populated Networks view and inspector.

>
> **Suggested filename:** `docs/images/user-guide/30-networks-view.png`

## 18. Image update checking

Image update checking is advisory. Docker Connector compares the image used by an eligible container with the image currently resolved for its configured tagged image reference. It can show **Update status not checked**, **Checking for updates…**, **Update available**, **Image is current**, or a safe unavailable/error reason.

Automatic checks run on a 24-hour stale interval for eligible standalone containers **while Container management is enabled** and an Online snapshot is available. This is automatic checking, not automatic updating. Docker Connector never stops, restarts, recreates, or updates a container just because a scheduled check runs.

Choose **Check now** in the container inspector to perform a one-off check. The Docker daemon may pull or resolve image data to check the image ID, but Check now does not change the running container’s state.

### Screenshot 31 — Image is current
> **Screenshot placeholder 31**
>
> **Capture:** Image update area showing Image is current and Check now.
>
> **How to capture this screenshot:**
> 1. Use an eligible standalone test container whose configured image is already current.
> 2. Enable Container management if update checking requires it.
> 3. Open the container inspector and select **Check now**.
> 4. Wait for the check to finish and display **Image is current**.
> 5. Ensure **Check now/Check again** is visible and no Update action is offered for a current image.
> 6. Capture the Image update area after the result stabilizes.

>
> **Suggested filename:** `docs/images/user-guide/31-image-current.png`

> [!note] Availability is not eligibility
> **Update available** means a newer image is available. **Update eligibility** means Docker Connector can safely use its standalone update transaction. Compose-managed containers can have an available image but remain ineligible for the standalone Update action.

### Screenshot 32 — Update available
> **Screenshot placeholder 32**
>
> **Capture:** Confirmed Update available state for an eligible standalone container.
>
> **How to capture this screenshot:**
> 1. Use only an eligible standalone disposable test container for which a newer tagged image can safely be made available.
> 2. Run **Check now** and wait for Docker Connector to confirm **Update available**.
> 3. Ensure the standalone **Update** action is visible/enabled and the status clearly identifies the newer image availability.
> 4. Do not use a Compose-managed or production container for this screenshot.
> 5. Capture before beginning the update transaction.

>
> **Suggested filename:** `docs/images/user-guide/32-update-available.png`

## 19. Container management

**Container management** is disabled by default, per connection, and session-only. Select an individual **Online** Docker connection and use either its header switch or its Connections-card switch to enable it only for that profile when you trust it. The two switches stay synchronized; more than one profile can be authorized independently. Enabling asks for confirmation because lifecycle and update actions change the Docker host.

Authorization is valid only while the profile remains continuously verified as **Online**. It is immediately cleared if that profile becomes Offline, Degraded, Authentication Required, Unknown, Connecting, or unsupported; other authorized profiles are unaffected. A successful reconnect returns that profile to **Read-only**—it never restores authorization automatically. The backend also refuses a mutation unless the profile is still Online when the action runs.

When disabled, the Actions section says that the plugin is in read-only mode. When enabled, action availability depends on the container’s current state, host status, profile capabilities, and whether another operation is already in progress.

### Screenshot 33 — Container management disabled
> **Screenshot placeholder 33**
>
> **Capture:** Read-only Actions panel and enable guidance.
>
> **How to capture this screenshot:**
> 1. Select an individual Online connection and ensure the header **Container management** switch is off.
> 2. Return to **Containers** and select any test container.
> 3. Open the **Actions** area.
> 4. Confirm it displays the read-only message/guidance rather than lifecycle controls.
> 5. Capture only the Actions area and enough container context to show what is being inspected.
> 6. Do not enable management until after this screenshot is complete.

>
> **Suggested filename:** `docs/images/user-guide/33-management-disabled.png`

### Screenshot 34 — Per-profile Container management enabled
> **Screenshot placeholder 34**
>
> **Capture:** An individual Online host with management enabled in the compact header and on its matching Connections card.
>
> **How to capture this screenshot:**
> 1. Select an individual known-safe **Online** test host in Docker Connector; do not use **All Docker hosts**.
> 2. Turn on **Container management** from either the header or that host’s Connections card.
> 3. Accept the confirmation only in an isolated test environment after confirming the configured environments are understood and you intend to continue test work.
> 4. Confirm the matching header/card controls are synchronized and show **Enabled** for that profile only.
> 5. Capture the enabled profile state; do not include credentials, unrelated settings, or Docker actions in progress.
> 6. If desired, disable management again after all management/update screenshots are finished.

>
> **Suggested filename:** `docs/images/user-guide/34-management-enabled.png`

### Start, Stop, Shut down, and Restart

- **Start** is available for stopped containers.
- **Shut down** requests Docker’s graceful stop behavior with a 30-second wait.
- **Stop** uses the normal stop action with a 10-second wait.
- **Restart** uses Docker’s restart action with a 10-second wait.

### Screenshot 35 — Stopped container Start control
> **Screenshot placeholder 35**
>
> **Capture:** Start action for a stopped standalone container.
>
> **How to capture this screenshot:**
> 1. Use only an approved disposable standalone test container.
> 2. Stop it using Docker outside the screenshot workflow or through a previously approved test action, then wait for Docker Connector to refresh to **Stopped/Exited**.
> 3. Open its inspector.
> 4. Ensure the **Start** action is visible and inappropriate running-only actions are absent/disabled according to the UI.
> 5. Capture before starting it again.
> 6. After capturing, return the test container to its desired normal state.

>
> **Suggested filename:** `docs/images/user-guide/35-stopped-start.png`

Docker Connector asks for confirmation before lifecycle actions and coordinates a refresh after an accepted action. These controls never appear as a bulk-action interface.

### Screenshot 36 — Running container lifecycle controls
> **Screenshot placeholder 36**
>
> **Capture:** Shut down, Stop, Restart, and Update eligibility where applicable.
>
> **How to capture this screenshot:**
> 1. Enable **Container management** only if you are working against an approved test container/environment.
> 2. Select a **running standalone test container** such as the disposable test container on `192.168.1.2`.
> 3. Open its inspector and locate **Actions**.
> 4. Ensure **Shut down**, **Stop**, and **Restart** are visible; **Update** may also appear only if that container is eligible and has an available image.
> 5. Do not click any lifecycle control for the screenshot.
> 6. Capture the Actions section and container identity clearly enough to show it is a test target.

>
> **Suggested filename:** `docs/images/user-guide/36-running-actions.png`

### Update

**Update** appears only when Container management is enabled, a newer image has been confirmed, and the container is eligible for the standalone update workflow. It is hidden when the current image is already current. Compose-managed containers and containers with unsupported configuration receive a safe reason instead of an unsafe generic update button.

## 20. Safe container update workflow

An eligible Update begins with a confirmation preview. It identifies the container and image, summarizes supported configuration preservation, shows warnings, and offers Cancel or a direct proceed action. There is no acknowledgement checkbox; the writable-layer warning remains prominent.

### Screenshot 37 — Update preview
> **Screenshot placeholder 37**
>
> **Capture:** Preview, configuration summary, and writable-layer warning.
>
> **How to capture this screenshot:**
> 1. Use the approved disposable standalone container with a confirmed available update.
> 2. Select **Update** to open the confirmation preview.
> 3. Do not proceed immediately.
> 4. Ensure the preview shows the container/image, supported configuration-preservation summary, writable-layer warning, **Cancel**, and **Proceed with update**.
> 5. Check carefully that no environment values or credentials appear.
> 6. Capture the complete preview dialog before selecting Proceed.

>
> **Suggested filename:** `docs/images/user-guide/37-update-preview.png`

The transaction is designed for standalone containers. It inspects the original container, validates eligibility, pulls the candidate image, compares image IDs, stops the original if needed, preserves it as a backup, creates and configures a replacement, restores supported networking, starts and verifies the replacement, then cleans up the backup where safe. The exact progress view reports the stage actually in progress.

### Screenshot 38 — Update progress
> **Screenshot placeholder 38**
>
> **Capture:** Real in-progress transaction stages.
>
> **How to capture this screenshot:**
> 1. Use only the approved disposable standalone test container.
> 2. From the Update preview, select **Proceed with update**.
> 3. Watch the progress view and capture while the transaction is actively between stages—not before it starts and not after it completes.
> 4. Prefer a moment showing several completed stages plus one clearly active stage such as creating, starting, or verifying the replacement.
> 5. Do not interrupt the transaction merely to obtain the screenshot.
> 6. If the operation completes too quickly to capture reliably, repeat only on the disposable test target when safe.

>
> **Suggested filename:** `docs/images/user-guide/38-update-progress.png`

Docker Connector attempts to preserve the supported Docker configuration needed to recreate an eligible standalone container, including its relevant mounts, ports, restart configuration, and network attachments. No update workflow can make writable-layer-only data persistent.

### Screenshot 39 — Successful update result
> **Screenshot placeholder 39**
>
> **Capture:** Completed replacement and image identifiers.
>
> **How to capture this screenshot:**
> 1. Complete a successful Update on the approved disposable standalone test container.
> 2. Wait for the final result state and subsequent refresh.
> 3. Ensure the result identifies successful completion and, where the UI provides them, original/replacement or image identifiers.
> 4. Confirm the replacement container is healthy/running before capturing.
> 5. Ensure no Update action remains if the image is now current.
> 6. Capture the final success/result panel.

>
> **Suggested filename:** `docs/images/user-guide/39-update-success.png`

## 21. Rollback and recovery

If a replacement cannot be created, started, or verified after mutation starts, Docker Connector attempts to restore the original container from its preserved backup. Results distinguish successful updates, updates where a backup is retained, already-current images, failure before mutation, failure with rollback, incomplete rollback, and cancellation.

Rollback is a recovery attempt, not an absolute guarantee against every host, storage, or Docker failure. If the result says a backup was retained, rollback is incomplete, or manual recovery is required, pause and inspect the reported container names and Docker state before taking further action. Do not repeatedly retry an unclear update result.

### Screenshot 40 — Rollback or recovery result
> **Screenshot placeholder 40**
>
> **Capture:** Safe rollback, backup-retained, or manual-recovery guidance.
>
> **How to capture this screenshot:**
> 1. Do **not** deliberately break a production or valued container to create this screenshot.
> 2. Prefer an existing safe rollback/recovery result from disposable testing if one occurs naturally, or create a controlled failure only on a dedicated disposable fixture designed for recovery testing.
> 3. Acceptable states include successful rollback, backup retained, or explicit manual-recovery guidance.
> 4. Ensure the screenshot clearly shows the recovery outcome and any safe container/backup names needed for understanding.
> 5. Do not expose environment values, credentials, or unrelated server data.
> 6. If no safe real recovery result is available, leave this placeholder uncaptured rather than manufacturing a misleading screenshot.

>
> **Suggested filename:** `docs/images/user-guide/40-update-recovery.png`

> [!warning] Writable-layer data
> Data kept only in a container’s writable layer is not equivalent to a named volume or bind mount. Recreating a container can lose writable-layer-only changes. Persist important data with Docker volumes or bind mounts before updating.

## 22. Automatic refresh

Automatic refresh is enabled by default. The default interval is five minutes and can be changed to any whole number of minutes of at least one. Manual refresh performs one immediate snapshot refresh. Update checks use their separate 24-hour eligibility schedule and are not a substitute for snapshot refresh.

## 23. Settings

Docker Connector Settings provide:

- **Automatic refresh** — refresh configured hosts in the background.
- **Refresh interval** — minutes between background refreshes.
- **Theme integration** — use Obsidian’s native theme variables.

Container management is intentionally not a Setting. It is controlled only by the synchronized per-profile header/card switches and never persists across a restart or reload.

### Screenshot 41 — Settings page
> **Screenshot placeholder 41**
>
> **Capture:** Automatic refresh, interval, and theme integration.
>
> **How to capture this screenshot:**
> 1. Open **Settings → Community plugins → Docker Connector** (or the plugin’s settings tab in the current Obsidian UI).
> 2. Position the settings pane so **Automatic refresh**, **Refresh interval**, and **Theme integration** are all visible; scroll only as needed.
> 3. Use normal/safe values and avoid showing unrelated vault/account settings.
> 4. Do not look for or capture Container management here: it is not a Setting. Capture only the persistent refresh and theme controls.
> 5. Capture the Docker Connector settings page at a width where labels, descriptions, and controls are readable.

>
> **Suggested filename:** `docs/images/user-guide/41-settings.png`

## 24. Security model and saved information

Docker Connector saves connection metadata needed to reconnect, but keeps secrets out of saved settings where possible.

| Information | Saved in the profile? |
| --- | --- |
| Friendly name, description, category, host, and port | Yes |
| Docker Context name and safe endpoint snapshot | Yes |
| SSH username and private-key file path | Yes |
| SSH password | No by default; an explicit per-profile opt-in stores it separately in unencrypted local plugin data |
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

Verify the host, port, username, password/key, passphrase, remote Docker socket path, and Docker permissions for the remote account. Password authentication requires re-entry after an Obsidian restart unless **Remember password on this device** was explicitly enabled. An unencrypted private key reconnects automatically from its saved path; an encrypted private key requires its session-only passphrase again after restart. For a host-key mismatch, independently verify the new fingerprint before trusting it.

### Docker Context missing or changed

The named Context may have been removed or its endpoint configuration may have changed outside Docker Connector. Rediscover contexts and edit/retest the profile. Docker Connector will not repair the Context by changing Docker CLI state for you.

### Mutual TLS failure

Check the selected CA, client certificate, matching client private key, optional passphrase, and Server Name. `DOCKER_TLS_HOSTNAME_MISMATCH` means the expected Server Name does not match a valid certificate identity. An IP address must appear in an IP SAN; a hostname must appear in a DNS SAN. Do not disable certificate verification to work around this error.

### Client certificate rejected

The Docker Engine may require a certificate signed by a different CA, a client certificate with the proper client-authentication purpose, or a matching key. Recheck the server’s mutual-TLS configuration with its administrator; Docker Connector cannot make an untrusted client certificate acceptable.

### Remote user lacks Docker access or the socket path is wrong

For **Remote Docker via SSH**, first confirm the remote account can use Docker in a normal terminal session. A safe starting point is `docker version` and `docker ps -a` after logging in as that account. Check the configured Remote Docker Socket against the host’s Docker configuration. Do not use an interactive `sudo` workaround: Docker Connector cannot answer an interactive privilege prompt, and changing socket permissions broadly is not a safe substitute for correct host access control.

### Update check failed, update is unavailable, or the image is already current

**Check now** can fail when the Docker daemon cannot pull or resolve the configured tagged image reference. Confirm the host’s ordinary Docker image access; Docker Connector does not collect or manage registry credentials. **Image is current** is a result, not a failure. **Update unavailable** can also mean that a container is Compose-managed, untagged, digest-only, or has configuration that cannot safely be recreated. Keep Docker Compose as the source of truth for Compose-managed containers.

### Update rollback, backup retained, or manual recovery

If a transaction reports that the original was restored, inspect the original container before retrying. If a backup was retained or manual recovery is required, stop and inspect the reported container names and state with `docker ps -a`; do not delete volumes, networks, images, or either container merely to clear the message. The plugin deliberately retains the safer recovery evidence rather than guessing which resource to remove.

### A profile cannot be deleted

Deletion is blocked while a container operation is active for that profile. Wait for the operation to reach a final result, then retry. If persistence fails, the profile remains saved rather than being partially removed; check vault/plugin-data write access before trying again.

### Connection stays Unknown

Unknown means not yet evaluated. Use Reconnect or refresh the profile. A completed attempt should become Online, Offline, Degraded, or Authentication Required with a safe error. If it remains Unknown after a completed refresh, collect the diagnostics and report it as a problem.

### Update check or update unavailable

An image can be current, unavailable from a registry, untagged, inaccessible, Compose-managed, or unsuitable for safe standalone recreation. Check now does not override those safety restrictions. Registry authentication or pull failures must be resolved in the Docker environment; Docker Connector does not manage registry credentials.

## 27. Frequently asked questions

**Does Docker Connector store my SSH password?** Not by default. SSH passwords and key passphrases are runtime-only unless a password profile explicitly enables **Remember password on this device**. That opt-in stores only the password separately in unencrypted local plugin data; private-key passphrases are never stored.

**Does it store Mutual TLS passphrases or certificate contents?** No. It can save selected certificate/key paths, but not certificate contents or the client-key passphrase.

**Can I use it on mobile?** No. Docker Connector requires desktop Obsidian.

**Does it change my active Docker Context?** No. It discovers and uses the selected context without running Context mutation commands.

**Does it support insecure `tcp://host:2375`?** No. Plain unauthenticated Docker TCP is unsupported.

**Can it manage a remote Docker host?** Yes, after you explicitly enable Container management and only through the supported connection profile and typed actions.

**Can it update a Docker Compose application?** No. Applications are read-only and Compose-managed containers are blocked from the standalone Update workflow.

**Does deleting a connection delete the Docker server?** No. It removes Docker Connector’s profile and cached session state only.

**Does Update delete my volumes?** Docker Connector does not delete volumes. However, data stored only in a container writable layer may be lost when a container is recreated; use named volumes or bind mounts for persistent data.

**Why is Update missing?** It appears only for an eligible standalone container after a newer image has been confirmed and Container management is enabled.

**Can two profiles point to the same daemon?** Yes. For example, Local Docker Socket and Docker Context can intentionally reach the same local Docker Desktop daemon while remaining distinct saved profiles.

**Does Docker Connector send telemetry?** No telemetry or analytics service is part of the plugin. Its network activity is limited to configured Docker/SSH/TLS/Context connections, image-registry availability checks, and Docker-daemon image pulls used for supported update checks.

**Why does Docker CLI work in Terminal but not Obsidian?** Desktop GUI apps can inherit a different PATH. Docker Connector checks the process PATH and a bounded set of standard Docker locations, but it does not load shell startup files. Restart Obsidian after installing Docker and use **Discover Contexts** again.

**Why is Docker CLI found but the Engine unavailable?** CLI discovery only proves that the executable can run. The selected Context, socket, network endpoint, daemon, or account permissions can still prevent Docker Engine access.

## 28. Known limitations

- Docker Connector requires desktop Obsidian.
- Plain insecure Docker TCP is not supported.
- Applications is a Compose-aware read-only view; it does not deploy, edit, start, stop, or update Compose projects.
- Standalone transactional Update is intentionally blocked for Compose-managed and otherwise unsupported containers.
- Passwords and passphrases are session-only by default. Only an explicitly remembered SSH password can be rehydrated; private-key passphrases are never remembered. A saved unencrypted private key needs no runtime passphrase and reconnects automatically after restart.
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


# Appendix A — Screenshot production checklist

This is an index and capture checklist; the full numbered screenshots and placeholders appear inline with the features they illustrate. Before committing screenshots, verify they do not expose passwords, passphrases, private keys, certificate contents, authentication tokens, registry credentials, container environment secrets, or sensitive internal host information not intended for publication.

| # | Filename | Section | Required capture |
| --- | --- | --- | --- |
| 01 | `01-empty-connections.png` | First launch | Empty state |
| 02 | `02-dashboard-overview.png` | Interface | Main dashboard |
| 03 | `03-add-docker-host.png` | Add | Host dialog |
| 04 | `04-connection-type-selector.png` | Add | Connection method selector |
| 05 | `05-local-docker-socket.png` | Local | Endpoint |
| 06 | `06-docker-cli-detected.png` | Context | CLI and context discovery |
| 07 | `07-ssh-password.png` | SSH | Password |
| 08 | `08-verify-ssh-host.png` | SSH | First host-key verification |
| 09 | `09-ssh-connection-success.png` | SSH | Trusted retry diagnostics |
| 10 | `10-remember-ssh-password.png` | SSH | Optional local password storage |
| 11 | `11-generate-ssh-key.png` | SSH | Generation dialog |
| 12 | `12-ssh-private-key-selection.png` | SSH | Selected key and fingerprint |
| 13 | `13-ssh-key-generation-complete.png` | SSH | Verified key-pair success |
| 14 | `14-install-public-key.png` | SSH | Public-key installation |
| 15 | `15-private-key-test-success.png` | SSH | Private-key test success |
| 16 | `16-mutual-tls-form.png` | Mutual TLS | Form |
| 17 | `17-local-test-success.png` | Testing | Local test success |
| 18 | `18-connections-overview.png` | Connections | Profiles and actions |
| 19 | `19-authentication-required-reconnect.png` | Connections | Reconnect |
| 20 | `20-delete-connection.png` | Connections | Confirmation |
| 21 | `21-current-environment.png` | Interface | Selector |
| 22 | `22-applications-list.png` | Applications | List |
| 23 | `23-application-inspector.png` | Applications | Detail |
| 24 | `24-containers-view.png` | Containers | List |
| 25 | `25-updates-filter.png` | Containers | Filter |
| 26 | `26-compact-density.png` | Containers | Compact density |
| 27 | `27-container-inspector.png` | Container detail | Detail |
| 28 | `28-images-view.png` | Images | Inventory |
| 29 | `29-volumes-view.png` | Volumes | Inventory |
| 30 | `30-networks-view.png` | Networks | Inventory |
| 31 | `31-image-current.png` | Image updates | Current |
| 32 | `32-update-available.png` | Image updates | Available |
| 33 | `33-management-disabled.png` | Container management | Read-only |
| 34 | `34-management-enabled.png` | Container management | Per-profile enabled |
| 35 | `35-stopped-start.png` | Container management | Start |
| 36 | `36-running-actions.png` | Container management | Running actions |
| 37 | `37-update-preview.png` | Update | Preview |
| 38 | `38-update-progress.png` | Update | Progress |
| 39 | `39-update-success.png` | Update | Result |
| 40 | `40-update-recovery.png` | Recovery | Result |
| 41 | `41-settings.png` | Settings | Full page |
