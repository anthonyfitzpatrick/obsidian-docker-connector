---
tags: [docker-connector, documentation, screenshots]
---

# Screenshot recapture

21 of the 41 User Guide screenshots predate UI changes and need retaking. Each row was checked by opening the image, not inferred from its caption. Images live in `docs/images/user-guide/`; the guide sizes each one to at most 880px and centres it.

The other 20 are current: 03, 04, 05, 06, 07, 08, 10, 24, 25, 26, 27, 28, 29, 31, 32, 33, 34, 36, 37, 39.

## Recapture list

| ✓ | # | File | What the current image shows | What the new image must show |
| --- | --- | --- | --- | --- |
| [ ] | 01 | `01-empty-connections.png` | Connections tab empty state. Header carries a **Container management / Individual host required** switch. Button reads **Add Docker Host** | No header switch. Button reads **Add Docker host** |
| [ ] | 02 | `02-dashboard-overview.png` | Overview, zeroed metric cards, *No Docker hosts yet*. Header carries the **Container management** switch | Same view without the header switch |
| [ ] | 09 | `09-ssh-connection-success.png` | SSH password diagnostics. Footer **Test Connection** / **Save Host**. Username correctly blurred | Footer **Test connection** / **Save host** |
| [ ] | 11 | `11-generate-ssh-key.png` | Modal titled **Generate SSH Key** | Title **Generate SSH key** |
| [ ] | 12 | `12-ssh-private-key-selection.png` | **Add Docker Host**, Friendly **N**ame, Connection **T**ype, SSH **H**ost/**P**ort/**U**sername, **Private Key**, Selected **P**rivate **K**ey **F**ile, Generate SSH **K**ey, Private-**K**ey Passphrase, Public **K**ey, Remote Docker **S**ocket, Test **C**onnection, Save **H**ost | All sentence case. Authentication dropdown reads **Private key** |
| [ ] | 13 | `13-ssh-key-generation-complete.png` | Authentication-details crop: Selected **P**rivate **K**ey **F**ile, Generate SSH **K**ey, Private-**K**ey Passphrase, Public **K**ey, Remote Docker **S**ocket | All sentence case |
| [ ] | 14 | `14-install-public-key.png` | Modal **Install Public Key**, field **Current SSH Password** | **Install public key**, field **Current SSH password** |
| [ ] | 15 | `15-private-key-test-success.png` | Private-key diagnostics, **Test Connection** / **Save Host**. Remote username shown **in clear** where 09 blurs it | Sentence-case buttons, and blur the username to match 09 |
| [ ] | 16 | `16-remote-docker-api-mtls.png` | **Add Docker Host**, Connection **T**ype, Docker API **P**ort, Server **N**ame, CA **C**ertificate, Client **C**ertificate, Client **P**rivate **K**ey, Client-**K**ey Passphrase | All sentence case |
| [ ] | 17 | `17-local-test-success.png` | **Edit Docker Host**, Endpoint **T**ype = **Unix Socket**, Docker **E**ndpoint, **Detect Local Docker** | **Edit Docker host**, Endpoint type = Unix socket, Docker endpoint, Detect local Docker |
| [ ] | 18 | `18-connections-overview.png` | Five cards. Header switch, **Add Docker Host**, Context card button **Refresh Context Metadata** | No header switch. **Add Docker host**, **Refresh context metadata** |
| [ ] | 19 | `19-authentication-required-reconnect.png` | Authentication-required card: pill, Reconnect, zeroed inventory, *Docker details unavailable* | Card now also carries a **failure-reason line** — lock icon and the server's own reason — above the endpoint row |
| [ ] | 20 | `20-delete-connection.png` | Delete modal ending *…and Docker **C**ontexts are not deleted.* Behind it, the header switch and **Add Docker Host** | *…and Docker contexts are not deleted.* No header switch. **Add Docker host** |
| [ ] | 21 | `21-current-environment.png` | Header crop, environment dropdown open, **Container management / Unavailable** switch | Same dropdown, no management switch |
| [ ] | 22 | `22-applications-list.png` | **20 applications, every one duplicated** (gitea ×2, owncloud ×2, …). Header switch present | **10 applications, no duplicates.** No header switch |
| [ ] | 23 | `23-application-inspector.png` | Application inspector, 10 apps. Header switch. A tooltip *Open owncloud-db in Containers* overlaps a card | No header switch, and no stray tooltip |
| [ ] | 30 | `30-volumes-view.png` | Volume cards badged **In Use** | Badges read **In use** |
| [ ] | 35 | `35-management-confirmation.png` | **Native browser dialog**, OS-styled: *Enable container management for …?* with **Cancel / OK** | **Obsidian modal** titled *Enable container management*, a details row naming the Docker host, buttons **Cancel / Enable management** |
| [ ] | 38 | `38-action-confirmation.png` | **Native browser dialog** *Stop container?* listing Container / Image / Docker host, **Cancel / OK** | **Obsidian modal** titled *Stop container*, the three as labelled rows, red **Stop** button |
| [ ] | 40 | `40-start-confirmation.png` | **Native browser dialog** *Start container?*, **Cancel / OK** | **Obsidian modal** titled *Start container*, accent **Start** button — start is not destructive, so it is not red |
| [ ] | 41 | `41-settings.png` | Settings with three rows only: Automatic refresh, Refresh interval, Theme integration | The same three plus the **About and support footer**: logo, version, and the six buttons Report a bug, Request a feature, Anthony Fitzpatrick, wolf359.app, wolf359.press, Buy me a coffee |

## Why each is stale

| Cause | Landed | Screenshots |
| --- | --- | --- |
| Header **Container management** switch removed | 26-Aug-2026 22:43 | 01, 02, 18, 20, 21, 22, 23 |
| Inventories deduplicated by Docker daemon | 26-Aug-2026 23:09 | 22 |
| UI text moved to sentence case | 27-Aug-2026 21:14 | 09, 11, 12, 13, 14, 15, 16, 17, 18, 20, 30 |
| About and support footer added to settings | 27-Aug-2026 23:09 | 41 |
| Browser confirm dialogs replaced by an Obsidian modal | 27-Aug-2026 23:44 | 35, 38, 40 |
| Connection card states its failure reason | 28-Aug-2026 11:04 | 19 |

Two renames are invisible and need no recapture: the metric card labels and the dialog section headings are uppercased by CSS, so `Updates Available` to `Updates available` and `Authentication Details` to `Authentication details` do not change what is on screen.

See [[Docker Connector - Testing]] for the verification record and [[User Guide]] for placement.
