---
tags: [docker-connector, documentation, screenshots]
---

# Screenshot recapture

10 User Guide screenshots still need retaking, because what they show has structurally changed: a control that no longer exists, a dialog that is now an Obsidian modal, duplicated data since deduplicated, or a block that did not exist yet. Each row was checked by opening the image.

01 and 02 were replaced on 28-Aug-2026.

Screenshots whose only difference is letter case are deliberately left as they are: 09, 11, 12, 13, 14, 15, 16, 17 and 30 show title-case labels such as **Test Connection** or **In Use** where the interface now reads **Test connection** and **In use**. They are not being recaptured.

Images live in `docs/images/user-guide/`; the guide sizes each one to at most 880px and centres it.

## Recapture list

| ✓ | # | File | What the current image shows | What the new image must show |
| --- | --- | --- | --- | --- |
| [ ] | 18 | `18-connections-overview.png` | Five cards. Header switch, **Add Docker Host**, Context card button **Refresh Context Metadata** | No header switch. Label casing is not the reason for this one |
| [ ] | 19 | `19-authentication-required-reconnect.png` | Authentication-required card: pill, Reconnect, zeroed inventory, *Docker details unavailable* | Card now also carries a **failure-reason line** — lock icon and the server's own reason — above the endpoint row |
| [ ] | 20 | `20-delete-connection.png` | Delete modal ending *…and Docker **C**ontexts are not deleted.* Behind it, the header switch and **Add Docker Host** | No header switch behind the modal. Label casing is not the reason for this one |
| [ ] | 21 | `21-current-environment.png` | Header crop, environment dropdown open, **Container management / Unavailable** switch | Same dropdown, no management switch |
| [ ] | 22 | `22-applications-list.png` | **20 applications, every one duplicated** (gitea ×2, owncloud ×2, …). Header switch present | **10 applications, no duplicates.** No header switch |
| [ ] | 23 | `23-application-inspector.png` | Application inspector, 10 apps. Header switch. A tooltip *Open owncloud-db in Containers* overlaps a card | No header switch, and no stray tooltip |
| [ ] | 35 | `35-management-confirmation.png` | **Native browser dialog**, OS-styled: *Enable container management for …?* with **Cancel / OK** | **Obsidian modal** titled *Enable container management*, a details row naming the Docker host, buttons **Cancel / Enable management** |
| [ ] | 38 | `38-action-confirmation.png` | **Native browser dialog** *Stop container?* listing Container / Image / Docker host, **Cancel / OK** | **Obsidian modal** titled *Stop container*, the three as labelled rows, red **Stop** button |
| [ ] | 40 | `40-start-confirmation.png` | **Native browser dialog** *Start container?*, **Cancel / OK** | **Obsidian modal** titled *Start container*, accent **Start** button — start is not destructive, so it is not red |
| [ ] | 41 | `41-settings.png` | Settings with three rows only: Automatic refresh, Refresh interval, Theme integration | The same three plus the **About and support footer**: logo, version, and the six buttons Report a bug, Request a feature, Anthony Fitzpatrick, wolf359.app, wolf359.press, Buy me a coffee |

## Why each is stale

| Cause | Landed | Screenshots still to retake |
| --- | --- | --- |
| Header **Container management** switch removed | 26-Aug-2026 22:43 | 18, 20, 21, 22, 23 |
| Inventories deduplicated by Docker daemon | 26-Aug-2026 23:09 | 22 |
| About and support footer added to settings | 27-Aug-2026 23:09 | 41 |
| Browser confirm dialogs replaced by an Obsidian modal | 27-Aug-2026 23:44 | 35, 38, 40 |
| Connection card states its failure reason | 28-Aug-2026 11:04 | 19 |

Sentence case landed on 27-Aug-2026 21:14 and affects 09, 11, 12, 13, 14, 15, 16, 17, 18, 20 and 30. Only 18 and 20 are being retaken, and for other reasons; the rest are accepted as they are.

Two renames are invisible and need no recapture: the metric card labels and the dialog section headings are uppercased by CSS, so `Updates Available` to `Updates available` and `Authentication Details` to `Authentication details` do not change what is on screen.

See [[Docker Connector - Testing]] for the verification record and [[User Guide]] for placement.
