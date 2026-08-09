---
title: Docker Connector - User Guide
tags: [docker-connector, user-guide]
---

# Docker Connector - User Guide

Docker Connector is a desktop-only Docker dashboard inside Obsidian. It lets you connect to trusted Docker environments, inspect their workload and resource inventory, and—only after deliberate opt-in—perform a small set of explicitly confirmed container actions. The normal dashboard is read-only. It does not provide a terminal, a generic Docker API console, Docker Compose deployment, stack editing, bulk operations, or resource deletion.

> [!warning] Docker access is privileged access
> A Docker daemon can usually control its host at an administrator or root-equivalent level. Treat every connection profile as a privileged credential. Add only hosts, sockets, certificates, and SSH accounts you trust.

> [!info] How to use this guide
> Complete the sections in order for a first connection: requirements, settings, connection, test, and dashboard. Red screenshot callouts are production-documentation requirements. Replace each callout with the specified screenshot after the UI and example data are ready; redact hostnames, user names, addresses, certificate paths, container names, image names, project names, and all secrets where necessary.

## Screenshot placement map

🟥 <span style="color: red;"><strong>Screenshot 1 — Insert after “1. Before you begin”.</strong> Show installation and desktop requirements.</span>

🟥 <span style="color: red;"><strong>Screenshot 2 — Insert after “2. Open Docker Connector”.</strong> Show the Command palette command or ribbon entry point.</span>

🟥 <span style="color: red;"><strong>Screenshot 3 — Insert after “3. Configure plugin settings”.</strong> Show Automatic refresh, Refresh interval, Theme integration, and Container management.</span>

🟥 <span style="color: red;"><strong>Screenshot 4 — Insert immediately after Screenshot 3.</strong> Show the Container-management confirmation dialog.</span>

🟥 <span style="color: red;"><strong>Screenshot 5 — Insert after the general workflow in “4. Add, test, and save a connection”.</strong> Show the Connections tab and Add Docker host entry point.</span>

🟥 <span style="color: red;"><strong>Screenshot 6 — Insert after the four connection-method subsections in Section 4.</strong> Show the connection-method form; use 6a–6d if separate method forms are needed.</span>

🟥 <span style="color: red;"><strong>Screenshot 7 — Insert immediately after Screenshot 6.</strong> Show a successful Test connection and, optionally, a redacted safe diagnostic error state.</span>

🟥 <span style="color: red;"><strong>Screenshot 8 — Insert after the Overview subsection in “5. Navigate and interpret the dashboard”.</strong> Show the selected-host overview dashboard.</span>

🟥 <span style="color: red;"><strong>Screenshot 9 — Insert after the Containers subsection in Section 5.</strong> Show Applications and Containers together as panels 9a and 9b.</span>

🟥 <span style="color: red;"><strong>Screenshot 10 — Insert after the Images, Volumes, and Networks subsection in Section 5.</strong> Show the three read-only inventory views.</span>

🟥 <span style="color: red;"><strong>Screenshot 11 — Insert after the lifecycle-actions subsection in “6. Use optional container management safely”.</strong> Show lifecycle controls and safe failure handling.</span>

🟥 <span style="color: red;"><strong>Screenshot 12 — Insert at the end of Section 6.</strong> Show the image-check result and safe standalone-update confirmation as 12a and 12b.</span>

🟥 <span style="color: red;"><strong>Screenshot 13 — Insert after the troubleshooting table in “8. Troubleshooting”.</strong> Show a fully redacted safe diagnostic example.</span>

## 1. Before you begin

Use Obsidian Desktop 1.7.0 or later. Mobile is not supported because Docker Connector needs desktop access to local sockets, SSH, certificate files, and local Docker CLI processes.

Before creating a profile, decide which connection method matches the Docker host you intend to monitor. Prepare only the information for that method.

| Connection method | Use it when | What you need | Important limitation |
| --- | --- | --- | --- |
| Local Docker | Docker runs on the same computer as Obsidian. | A usable Unix socket or Windows named pipe. | Your desktop user must have permission to use the endpoint. |
| Docker Context | Docker Desktop or Docker CLI already has a named Context for the target. | Docker CLI installed locally and an existing supported Context. | The plugin never changes the globally active Context. |
| SSH Docker | The Docker host is remote and reachable over SSH. | Host, port, user, host-key verification, and password or private key. The remote account must run `docker system dial-stdio` without `sudo`. | Passwords and private-key passphrases are session-only. |
| Docker API with mutual TLS | The Docker Engine API is deliberately exposed through secure mutual TLS. | Host, port, server name, CA certificate, client certificate, client key, and optional key passphrase. | Insecure TCP and disabled certificate verification are unsupported. |

Do not put passwords, private keys, certificate contents, registry tokens, or Docker environment values in the profile name, description, screenshot, or an Obsidian note.

🟥 <span style="color: red;"><strong>Screenshot 1 — Installation and requirements.</strong> Place this immediately after this section. Capture Obsidian Desktop with Docker Connector enabled in Community plugins, plus a cropped view of the plugin’s desktop-only notice or requirements. Do not include other vault names, installed-plugin lists, or personal paths. The screenshot should establish where the plugin is enabled and that this guide applies to desktop Obsidian.</span>

## 2. Open Docker Connector

There are two equivalent ways to open the dashboard:

1. Select the Docker Connector ribbon icon in Obsidian’s left ribbon.
2. Or open the Command palette, search for **Docker Connector: Open dashboard**, and run it.

The dashboard opens as an Obsidian view. Use **Docker Connector: Refresh all Docker hosts** from the Command palette whenever you want to request a new snapshot for every enabled profile. Refreshing reads current Docker state; it does not start, stop, restart, update, or remove a container.

If this is your first use, open **Connections** first. An empty dashboard is expected until at least one profile is saved and successfully connected.

🟥 <span style="color: red;"><strong>Screenshot 2 — Opening the dashboard.</strong> Place this after the preceding numbered steps. Capture the Command palette with “Docker Connector: Open dashboard” highlighted, or the ribbon icon with a visible tooltip. Use a clean demonstration vault. The image must make it obvious how a user discovers the dashboard command.</span>

## 3. Configure plugin settings

Open **Settings → Docker Connector** in Obsidian. These settings apply to the plugin as a whole, not to an individual Docker host.

### Automatic refresh

**Automatic refresh** controls whether Docker Connector asks enabled profiles for a fresh dashboard snapshot in the background. It is enabled by default.

1. Leave it enabled if you want a dashboard that regularly reflects host changes.
2. Turn it off if you only want information refreshed when you explicitly use Refresh all Docker hosts or reopen the relevant view.
3. Disabling automatic refresh does not delete profiles, disconnect a host permanently, change Docker configuration, or alter container state. It only stops scheduled background refresh requests.

### Refresh interval

**Refresh interval** sets the number of minutes between background refresh attempts. The default is five minutes and the minimum accepted value is one minute.

1. Enter a whole number of minutes.
2. Use a longer interval for remote, low-bandwidth, metered, or heavily loaded hosts.
3. Use a shorter interval only when you need more frequent operational visibility and the selected hosts can tolerate the additional read-only requests.
4. If you enter an invalid value, the previous valid interval remains in effect. Verify the field before leaving Settings.

### Theme integration

**Theme integration** makes the dashboard use Obsidian’s native theme variables.

1. Leave it enabled for the best match with your Obsidian light or dark theme.
2. Disable it only if you are diagnosing a theme-specific display issue or deliberately want the plugin’s non-integrated presentation.
3. This option changes appearance only. It has no effect on connection security, Docker permissions, refresh behaviour, or data retention.

### Container management

**Container management** is disabled by default. When disabled, Docker Connector remains read-only even if a dashboard displays a container that could otherwise accept an action. When enabled, the detail panel can offer Start, Shut down, Stop, Restart, and—where the safety requirements are met—Update.

1. Enable this only after you understand that the configured Docker account can have administrator-level control of its host.
2. Turn on the toggle and read the confirmation dialog. Select **Cancel** if you are not prepared to grant mutating access.
3. Select **OK** only for trusted hosts and only when you intend to use the limited actions provided by the plugin.
4. Wait for the status beside the setting to report **Enabled**. While the setting is saving, the toggle is intentionally disabled.
5. If the status says **Save failed**, the old setting remains authoritative. Correct the storage problem and try again; do not assume the toggle was saved.
6. Turning the setting on does not itself perform a Docker action. Turning it off immediately prevents the plugin from authorizing new container actions.

🟥 <span style="color: red;"><strong>Screenshot 3 — Docker Connector settings.</strong> Place this at the end of the settings section. Capture all four settings in one view: Automatic refresh, Refresh interval, Theme integration, and Container management with its authoritative status text. Use a safe sample value for the interval. If management is shown enabled, include no host details and annotate that this is an intentional opt-in.</span>

🟥 <span style="color: red;"><strong>Screenshot 4 — Container-management confirmation.</strong> Place directly after Screenshot 3. Capture the confirmation dialog that appears when enabling Container management. The dialog must be legible enough to show the privileged-access warning and the available confirm/cancel choice. Use a non-production demonstration environment.</span>

## 4. Add, test, and save a connection

Choose the **Connections** tab, then choose the control to add a Docker host. A profile is a saved, non-secret description of one Docker endpoint. Use a friendly name that tells you what the host is for—such as “Development NAS” or “Office Docker Desktop”—without embedding a password, network address, or customer information.

For every method, use this sequence:

1. Enter a profile name and optional non-sensitive description or category.
2. Choose exactly one connection method.
3. Complete the fields required by that method.
4. Run **Test connection** before relying on the profile.
5. Read every diagnostic step from top to bottom if the test fails. The diagnostics are deliberately bounded: they tell you what to correct without exposing raw Docker responses, secrets, private-key material, or environment values.
6. Save the profile only after the test succeeds or after you deliberately choose to save an offline configuration for later correction.
7. Confirm the profile is enabled if you want it included in background refreshes. Disabled profiles remain saved but are not normally refreshed.

🟥 <span style="color: red;"><strong>Screenshot 5 — Connections tab and add-profile entry point.</strong> Place after the general connection workflow. Capture the Connections tab with one or two clearly fictional profiles and the Add Docker host control. Show the profile cards, connection type, enabled state, and available actions, but redact endpoint addresses, account names, certificate file paths, and any real host identity.</span>

### 4.1 Local Docker connection

Use Local Docker when Docker runs on the same computer as Obsidian.

1. Select **Local Docker** as the connection method.
2. Choose the Unix socket or Windows named pipe that Docker Desktop or Docker Engine exposes.
3. Use the offered conventional endpoint where it matches your installation. Docker Connector discovers only explicit conventional locations; it does not scan your filesystem for Docker sockets.
4. Run **Test connection**. A successful test confirms the selected endpoint is reachable and that the Obsidian desktop user can use it.
5. If the test reports a permissions issue, resolve Docker socket or named-pipe permissions for your operating-system user. Do not work around the problem by broadly weakening endpoint permissions.

### 4.2 Docker Context connection

Use Docker Context when the target already exists in the local Docker CLI configuration.

1. Select **Docker Context**.
2. Use the discovery control to list existing Contexts.
3. Select a supported Context and review its safe metadata: name, endpoint type, supported state, and lifecycle state.
4. Save the profile and run **Test connection**.
5. For an existing Context profile, use **Refresh Context Metadata** if its endpoint details may have changed, and use **View Context Details** to inspect the safe saved metadata.

Docker Connector runs the CLI with an explicit `docker --context <name> system dial-stdio` invocation. It does not run `docker context use`, create, import, export, remove, or activate a Context. If a Context disappears, becomes unsupported, or its safe endpoint characteristics change, the profile reports that state rather than silently switching to a different Context.

### 4.3 SSH Docker connection

Use SSH Docker for a remote Linux or Unix-like host that can run Docker through the configured account.

1. Select **SSH Docker**.
2. Enter the host name or address, SSH port, and account name.
3. Choose **Password** or **Private key** authentication.
4. For Password authentication, enter the password only into the prompt or session field. It is held in memory only while Obsidian runs.
5. For Private key authentication, choose the private-key file and enter a passphrase only when required. The key content and passphrase are not saved in the plugin settings.
6. Verify the server host fingerprint deliberately. A changed fingerprint can mean a legitimate server change, but it can also indicate a connection to the wrong host. Verify through an independent trusted channel before accepting a change.
7. Run **Test connection**. The remote account needs permission to run `docker system dial-stdio` without `sudo` and to access the Docker daemon.

If SSH itself succeeds but Docker access fails, the usual cause is that the remote account cannot access the Docker socket or is using a session that has not inherited recent Docker-group membership. End all SSH sessions for that account, reconnect, and test again after the host administrator confirms the intended permission.

### 4.4 Docker API with mutual TLS

Use mutual TLS only for an intentionally secured Docker API endpoint.

1. Select **Docker API with mutual TLS**.
2. Enter the endpoint host and port.
3. Enter the **server name** expected by the server certificate. This must match the certificate identity; it is not merely a display label.
4. Select the CA certificate, client certificate, and client-key file paths.
5. Supply a client-key passphrase only if the selected key requires one. It remains session-only.
6. Run **Test connection** and correct certificate paths, key matching, trust chain, or server-name mismatch errors before saving.

Docker Connector always verifies the server certificate and always uses mutual TLS for this method. It does not support plain Docker TCP, an invalid certificate, a missing CA trust chain, or a “skip verification” option.

🟥 <span style="color: red;"><strong>Screenshot 6 — Connection-method form.</strong> Place after the four connection-method subsections. Capture a sanitized edit form with the connection-method selector visible. If the layout requires separate captures, use four sub-images labelled 6a Local Docker, 6b Docker Context, 6c SSH Docker, and 6d Mutual TLS. Show field labels and the Test connection control; replace every sensitive value with obvious fictional data and blur file-system paths if they reveal a user name.</span>

🟥 <span style="color: red;"><strong>Screenshot 7 — Successful test connection and safe diagnostics.</strong> Place immediately after Screenshot 6. Capture a successful Test connection result showing its ordered validation steps. A second cropped example may show a safe, non-secret error state and Retry/diagnostics behaviour. Do not show raw errors, terminal output, certificate contents, passwords, or host fingerprints from a real environment.</span>

## 5. Navigate and interpret the dashboard

Select an enabled host from the host selector. The dashboard represents the most recently retrieved snapshot for that profile. A refresh failure is shown safely and does not silently pretend that an old snapshot is current.

### Overview

**Overview** is the starting point for an operational scan. It summarizes the selected host and draws attention to items that may require review. Use it to decide whether to investigate a particular container, image update, connection problem, or resource category.

1. Confirm the host selector shows the intended profile before acting on any information.
2. Review attention items and metric cards.
3. Follow the relevant tab or detail panel for investigation.
4. Refresh the host when you need a current reading. A refresh only reads Docker state.

### Applications

**Applications** is a read-only Docker Compose-oriented overview. An application appears only if Docker reports the `com.docker.compose.project` label. The displayed service comes from `com.docker.compose.service`.

1. Use the summary and filters to locate a Compose-labelled project.
2. Select an application to inspect its safe project, service, container, image, network, volume, and Compose metadata.
3. Select a container from the application when you need the full container detail inspector.
4. If a workload does not appear here, look in **Containers**. Docker Connector does not guess Compose identity from container names, image references, paths, networks, or hyphens.

Applications never run Docker Compose, parse a Compose file, edit a stack, deploy a project, or update an entire application. Compose-managed containers remain blocked from the standalone Update workflow.

### Containers

**Containers** is the primary operational inventory. It includes standalone containers and Compose-managed containers. Use its search, filters, sorting, and density controls to narrow the list, then select a container for details.

1. Use search and the available health, network, or status filters to find a workload.
2. Choose a container to open its inspector. Review state, health, image, network, and safe metadata before considering an action.
3. Use **Check now** in the Image update section to check that one eligible container’s configured tagged image. This pulls the exact tag through the configured Docker daemon and compares image IDs; it does not restart or recreate anything.
4. Use the **Updates Available** summary card to apply an additive filter for containers with a confirmed newer image. The filter preserves your other search, health, network, sort, and density choices. Use the **Updates available ×** chip to remove only that filter.
5. When no matching containers remain, use **Show all containers** to clear the update filter.

An image status can be not checked, checking, available, current, error, or unsupported. Only **available** means a newer image ID has been confirmed. It does not automatically make a container eligible for a safe update.

### Images, Volumes, and Networks

These tabs are read-only inventories. Use them to understand what the selected Docker host reports, filter the list, and open lazy-loaded details where provided.

1. Select **Images** to inspect image inventory and associate image references with the container information you see elsewhere.
2. Select **Volumes** to inspect named-volume inventory and details without altering or deleting a volume.
3. Select **Networks** to inspect Docker network inventory and details without joining, leaving, creating, or removing a network.
4. Return to **Containers** when you need to investigate a resource’s workload use or perform an explicitly enabled container action.

🟥 <span style="color: red;"><strong>Screenshot 8 — Dashboard Overview.</strong> Place after the Overview subsection. Capture a sanitized selected-host dashboard with the host selector, top-level navigation, metric cards, and at least one attention item. Use fictional container/project names and do not reveal IP addresses, internal DNS names, uptime patterns, or production capacity data.</span>

🟥 <span style="color: red;"><strong>Screenshot 9 — Applications and Containers workflow.</strong> Place after the Containers subsection. Use a two-part image or two consecutively numbered panels: 9a shows the Applications list and safe application inspector; 9b shows the Containers list, selected container inspector, and the Image update status area. Clearly demonstrate that standalone containers are found in Containers and that Compose-labelled applications are read-only.</span>

🟥 <span style="color: red;"><strong>Screenshot 10 — Read-only resource inventories.</strong> Place after the Images, Volumes, and Networks subsection. Use three small labelled panels for Images, Volumes, and Networks. Each must show a list and a safe detail panel, making clear that these screens are inspection-only. Use fictitious resource names.</span>

## 6. Use optional container management safely

Do not use this section until **Container management** is deliberately enabled in Settings. The plugin checks the setting again for every action; a button’s appearance is not by itself permission to change Docker state.

### Start, Shut down, Stop, and Restart

The container inspector shows only actions appropriate to the container’s current state. Running containers can show **Shut down**, **Stop**, and **Restart**. Stopped containers can show **Start**. Actions are explicit typed requests for the selected container’s full Docker ID; the plugin does not expose a free-form command entry field.

1. In **Containers**, select the exact container you intend to affect.
2. Reconfirm the selected host, container name, state, and any health information in the inspector.
3. Choose the named lifecycle action.
4. Read the confirmation and operational context carefully, then confirm only if the workload can safely experience the requested state change.
5. Wait for the progress result. Do not repeatedly click an action while it is in flight.
6. If Docker rejects the action, keep the inspector open and read the safe failure panel. It includes the action, safe explanation, error code, optional HTTP status, retry option, and safe diagnostics without exposing secrets or raw stack traces.

**Shut down** requests a graceful shutdown. **Stop** may be more abrupt after Docker’s configured stop behaviour. **Restart** stops and starts the chosen container. Review the application’s operational requirements before using any of these controls.

### Check image availability

Image availability and update eligibility are separate safeguards.

1. Select the container and locate **Image update**.
2. Choose **Check now** for a one-time check. This forces a check for only the selected container and does not change the normal 24-hour check schedule.
3. Wait for the status. **Current** means the configured tag resolves to the same image ID; **Available** means it resolves to a different image ID; **Unsupported** means the image or container cannot safely use this workflow; **Error** means the check could not complete.
4. Treat **Available** as advisory. Review the deployment, configuration, persistent data, and the container’s role before you choose Update.

Eligible online standalone containers may also be checked after a snapshot refresh when no status exists or the existing status is at least 24 hours old. This scheduler checks availability only; it never installs an update unattended.

### Update an eligible standalone container

**Update** is available only when all safety requirements hold: Container management is enabled, the container is standalone rather than Compose-managed, its image reference is an explicit usable tag, a newer image has been confirmed, and the plugin can produce a safe recreate plan.

1. Select the eligible standalone container and read the safe update preview in full.
2. Verify the image tag is the one you expect and that the workload is not controlled by Docker Compose or another orchestrator.
3. Confirm that important data is in appropriate volumes or another persistent store. Data held only in the old container’s writable layer can still be lost during a recreate.
4. Choose **Update** only after you are prepared for the container to be recreated.
5. Let the transaction complete. Docker Connector pulls the existing repository/tag, preserves the original as a temporary backup, creates and verifies a replacement, and removes the stopped backup only after a successful replacement.
6. If the transaction fails, read the rollback result. The workflow is designed to follow its rollback path and never force-delete volumes, but you should still validate the application after any attempted update.

Docker Connector never bulk-updates containers, updates Compose-managed containers, deletes volumes, or runs unattended automatic updates.

🟥 <span style="color: red;"><strong>Screenshot 11 — Lifecycle actions and failure handling.</strong> Place after the Start/Shut down/Stop/Restart subsection. Capture an eligible sample container detail inspector with the management controls and an action-progress area. Include a separate non-secret failure-state crop if possible, showing the safe explanation, error code, Retry, and diagnostics. Do not show a destructive action being executed against a production workload.</span>

🟥 <span style="color: red;"><strong>Screenshot 12 — Image check and safe update confirmation.</strong> Place at the end of this section. Capture the Image update section in two states: 12a “Available” after Check now, and 12b the pre-update preview/confirmation for an eligible standalone sample container. Make the eligibility conditions and warning visible. Do not capture or imply an Update action for a Compose-managed container.</span>

## 7. What Docker Connector stores and protects

Docker Connector saves non-secret profile metadata and dashboard preferences. This can include the friendly profile identity, connection type, non-secret endpoint metadata, enabled state, refresh choices, display preferences, and saved Docker Context lifecycle metadata.

It does not save the following in plugin settings:

- SSH passwords.
- SSH private-key passphrases.
- TLS client-key passphrases.
- Private-key contents or certificate contents.
- Registry credentials.
- Docker environment values.
- Raw Docker inspect responses, raw label dumps, or raw error stacks.

Passwords and passphrases are retained only in memory for the current Obsidian session when they are required. Expect to supply them again after an Obsidian restart. When sharing screenshots, support requests, or issue reports, omit or redact every host identity, endpoint, account name, path, key, fingerprint, registry reference, environment value, and diagnostic detail that could identify a system or grant access.

## 8. Troubleshooting

| Symptom | Likely cause | What to do |
| --- | --- | --- |
| Local test fails | Docker is not running, the wrong socket/named pipe is selected, or the desktop user lacks permission. | Confirm Docker is running, choose the intended conventional endpoint, and have the operating-system administrator correct only the required user permission. |
| SSH test fails before Docker checks | Wrong host, port, user, authentication data, or host-key verification issue. | Recheck the profile fields; verify a changed fingerprint independently before accepting it. |
| SSH login succeeds but Docker access fails | The remote user cannot access Docker or its session has stale group membership. | Confirm the remote user can run `docker system dial-stdio` without `sudo`; end all sessions and reconnect after group membership changes. |
| Mutual TLS test fails | Wrong file path, key/certificate mismatch, untrusted CA, or server-name mismatch. | Recheck each selected file and the certificate identity. Do not disable verification to make the test pass. |
| Docker Context is unavailable or changed | Docker CLI is absent, the Context no longer exists, or its safe endpoint state changed. | Install/repair Docker CLI, restore the intended Context outside the plugin, then refresh Context metadata and test again. |
| No applications appear | Workloads do not have Docker Compose labels. | Inspect **Containers**. Only `com.docker.compose.project` creates an Applications entry. |
| Update is unavailable | Image is current, not safely tagged, Compose-managed, offline, unsupported, or lacks a safe recreate plan. | Read the displayed safe reason. Update the workload through its own orchestrator if it is Compose-managed. |
| A setting says Save failed | Obsidian could not persist the requested setting. | Resolve the vault/plugin storage issue, reopen Settings, and verify the displayed authoritative status before relying on the change. |

When requesting help, describe the connection method, the step that failed, the safe error code, and what you have already verified. Never attach secret material or raw diagnostic output unless you have first reviewed and redacted it.

🟥 <span style="color: red;"><strong>Screenshot 13 — Troubleshooting example.</strong> Place after the troubleshooting table. Capture one fully redacted safe diagnostic result with a visible error code and recommended next step. This screenshot should teach a user where to find actionable diagnostics without disclosing any connection secret, path, host identity, certificate detail, or raw response.</span>

## 9. Quick operating checklist

Before relying on a Docker host:

1. Confirm you are in the correct Obsidian vault and selected the intended Docker profile.
2. Confirm the connection test succeeds and its identity details are expected.
3. Keep Container management disabled unless you actively need a limited action.
4. Use Overview and Containers to assess state before taking action.
5. Treat an image update as a planned change, not routine housekeeping. Read the preview, confirm persistence, and validate the application afterward.
6. Keep screenshots and support material free of secrets and internal infrastructure details.

For implementation and security detail, see the documents in `docs/`, including Connection Architecture, Runtime Credentials, Applications View, Safe Container Updates, and Obsidian Community Plugin Compliance.
