---
tags: [docker-connector, local-docker]
---

# Local Endpoint Detection

On macOS and Linux, discovery checks local Unix socket candidates including `DOCKER_HOST`, `/var/run/docker.sock`, Docker Desktop's user socket, and rootless runtime sockets. Windows uses the Docker named-pipe default. Detection never scans the filesystem broadly and never selects between multiple results silently.
