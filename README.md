# Docker Connector

Docker Connector is a desktop-only Docker environment dashboard for Obsidian. It is read-only by default. Optional container-management features must be deliberately enabled in Settings and remain limited to explicit, typed container actions.

> [!warning] Docker access is highly privileged
> Access to a Docker daemon can be equivalent to root-level control of that host. Connect only to Docker hosts and accounts you trust. Obsidian and this plugin do not make Docker-daemon access harmless.

## At a glance

- Monitor local Docker, a named Docker Context, SSH Docker, or the Docker API with mutual TLS.
- Browse Overview, Applications, Containers, Images, Volumes, Networks, and Connections.
- View Compose-labelled applications without running Docker Compose or modifying a stack.
- Check whether eligible tagged images resolve to a newer image. Checks are advisory and never install an update automatically.
- Optionally enable confirmed Start, Shut down, Stop, Restart, and safe standalone-container Update actions.

See the [User Guide](User%20Guide.md) for step-by-step use and the [Security Review](docs/Docker%20Connector%20-%20Security%20Review.md) for the security model.

## Requirements

| Requirement | Details |
| --- | --- |
| Obsidian | 1.7.0 or later, desktop only (`isDesktopOnly: true`) |
| Local Docker | A user-selected Unix socket or Windows named pipe |
| Docker Context | Docker CLI installed locally; the selected Context already exists |
| SSH Docker | SSH access plus Docker CLI with `docker system dial-stdio`; no `sudo` is used |
| Mutual TLS | CA certificate, client certificate, client key, and mandatory server verification |

Mobile is not supported. The plugin uses desktop Node APIs for sockets, SSH, TLS files, and carefully bounded child processes.

## Installation

Install Docker Connector through Obsidian's Community Plugins flow when it is published. For a manual release installation, place exactly these release assets in your vault's `.obsidian/plugins/docker-connector/` directory:

- `main.js`
- `manifest.json`
- `styles.css`

Restart Obsidian or enable the plugin in **Settings → Community plugins**. The release does not require source files, `node_modules`, test fixtures, or local configuration.

## Connection methods

| Method | How it connects | Important behaviour |
| --- | --- | --- |
| Local Docker | A configured Unix socket or Windows named pipe | Only explicit conventional endpoints are discovered; filesystem scanning is not used. |
| Docker Context | `docker --context <name> system dial-stdio` | The plugin never changes the globally active Docker Context. |
| SSH Docker | SSH plus `docker system dial-stdio` | Host-key verification is required; passwords and key passphrases are session-only. |
| Docker API with mutual TLS | HTTPS with a CA, client certificate, and client key | Certificate verification is mandatory; insecure TCP is unsupported. |

Use **Connections** to add a host and **Test connection** before relying on its dashboard. For each transport's requirements and errors, see [Add, test, and save a connection](User%20Guide.md#4-add-test-and-save-a-connection).

## Using the dashboard

Select a host, then use the dashboard navigation:

- **Overview** gives a host-level operational summary and attention items.
- **Applications** groups only containers carrying Docker's `com.docker.compose.project` label. It is a read-only Compose overview; standalone containers remain in **Containers**.
- **Containers** shows state, health, image, network, and available-update information. Selecting a container opens its inspector.
- **Images**, **Volumes**, and **Networks** provide read-only inventory and lazy details.
- **Connections** manages saved non-secret connection profiles.

Applications use Docker's actual Compose labels. A project comes from `com.docker.compose.project`; a service comes from `com.docker.compose.service`; container names and image references are separate fields. The plugin never guesses Compose identity from names, paths, networks, or images. See [Applications View](docs/Docker%20Connector%20-%20Applications%20View.md).

## Optional container management and image updates

Container management starts disabled. Enabling it requires confirmation and only permits the explicit typed actions shown in the container inspector. The generic Docker Engine client remains GET-only; no arbitrary Docker API routes, shell commands, builds, bulk actions, or resource deletion are available.

An image check pulls a tagged image through the configured Docker daemon and compares image IDs. It does not recreate, restart, or automatically update a container. The 24-hour scheduler checks only eligible standalone containers while management is enabled. A confirmed **Update** is available only for eligible standalone containers and follows a backup-first transaction with rollback protection. Compose-managed containers remain blocked from the standalone update workflow.

Read [Container Management](docs/Docker%20Connector%20-%20Container%20Management.md), [Container Update Availability](docs/Docker%20Connector%20-%20Container%20Update%20Availability.md), and [Safe Container Updates](docs/Docker%20Connector%20-%20Safe%20Container%20Updates.md) before enabling management.

## Privacy and security

- No telemetry, analytics, cloud service, remote script, remote CSS, or runtime executable-code download.
- Network activity is limited to the configured Docker/SSH/TLS/Context connection, public image-registry checks for update information, and image pulls performed by the configured Docker daemon.
- SSH passwords, SSH key passphrases, and TLS client-key passphrases stay in memory for the current Obsidian session. They are never saved in plugin settings.
- Certificate and private-key contents are read only from the explicitly selected paths and are never persisted.
- Docker-provided environment-variable values, raw inspect responses, registry credentials, and full label dumps are not rendered or copied into safe diagnostics.
- Insecure Docker TCP and disabling TLS certificate verification are unsupported.

## Troubleshooting

- **Cannot connect locally:** Confirm Docker is running and that Obsidian's user account can access the selected socket or named pipe.
- **SSH authentication or host-key error:** Verify the host, port, account, and fingerprint. Do not bypass a changed host key without independently verifying it.
- **Docker Context unavailable:** Ensure Docker CLI is installed and the named Context already exists. The plugin discovers and uses Contexts but never creates, imports, exports, removes, or activates them.
- **No Applications listed:** Only containers with `com.docker.compose.project` appear in Applications. Non-Compose containers remain in Containers.
- **Update unavailable:** An image may be newer but still ineligible—for example, if the container is Compose-managed, untagged, or cannot be recreated safely. This is intentional.

For detailed walkthroughs, safe limitations, and what data is stored, use the [User Guide](User%20Guide.md).

## Development and release checks

```bash
npm ci
npm test
npm run lint
npm run build
npm audit
```

See [CONTRIBUTING.md](CONTRIBUTING.md), [CHANGELOG.md](CHANGELOG.md), [Testing](docs/Docker%20Connector%20-%20Testing.md), [Release Checklist](docs/Docker%20Connector%20-%20Release%20Checklist.md), and [Community Plugin Compliance](docs/Docker%20Connector%20-%20Obsidian%20Community%20Plugin%20Compliance.md).

## License

MIT. See [LICENSE](LICENSE).
