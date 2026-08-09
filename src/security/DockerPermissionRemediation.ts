import type { SshDockerProfile } from "../models/DockerConnectionProfile";

/** Safe, server-side remediation text for a Docker socket permission failure. */
export function dockerPermissionRemediation(profile: SshDockerProfile, socketGroupName = "<socket-group>"): string {
  return `SSH login succeeded, but user "${profile.sshUsername}" cannot access Docker on the remote server.

Ask the server administrator to run:

sudo usermod -aG ${socketGroupName} ${profile.sshUsername}

Then fully disconnect every SSH session for that user and reconnect. Verify:

id ${profile.sshUsername}
getent group ${socketGroupName}
docker ps
docker version
ls -l ${profile.remoteSocketPath}

The group that owns the Docker socket should appear in the user's groups; docker commands must succeed without sudo. The socket is commonly root:docker with mode srw-rw----, but the socket's actual numeric GID is authoritative.

Do not make the Docker socket world-writable. Docker group access is normally root-equivalent; grant it only to trusted accounts.

If group membership does not refresh after reconnecting, an administrator may run:

sudo loginctl terminate-user ${profile.sshUsername}

Warning: this terminates all current sessions for that user.`;
}
