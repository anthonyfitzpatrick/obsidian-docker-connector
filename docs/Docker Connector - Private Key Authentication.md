---
tags: [docker-connector, ssh, private-key]
---

# Private Key Authentication

Choose an OpenSSH private-key file on Obsidian desktop, or use **Generate SSH key** to open the dedicated generation dialog. It keeps preparing, Ed25519 generation, private-key validation, public-key resolution, pair verification, success, and retryable failure visible until the user closes it. Only then does the host form adopt the fully validated path, public identity, SHA-256 fingerprint, and session-only passphrase. Blank or whitespace-only passphrase input creates a genuinely unencrypted key through the fixed `ssh-keygen -N ""` argument; a nonblank passphrase is supplied only through standard input. Shell execution is disabled, and collision-safe `~/.ssh/docker_connector_ed25519[_N]` paths never overwrite an existing key.

For a selected private key, **Install public key** derives the public identity from that exact private key at click time. It verifies a sibling `<private-key>.pub` when present and blocks a mismatched file; when absent, it derives the public line in memory. The strict host-key-verified SFTP session creates or preserves `~/.ssh/authorized_keys` permissions and appends only a missing type-and-base64 identity. It never transfers the private key, uses `ssh-copy-id`, rewrites authorized keys, touches `known_hosts`, or accepts an unknown or changed host key. The installation password is session-only and is not eligible for remembered-password storage.

The absolute private-key path is saved, while its contents and optional passphrase are held only while the plugin is loaded. The ssh2 library parses supported RSA, Ed25519, and ECDSA keys. Encrypted keys prompt for a passphrase after restart; unencrypted keys reconnect from their saved path. See [[Docker Connector - Runtime Credentials]].

Troubleshoot `SSH_PRIVATE_KEY_NOT_FOUND`, `SSH_PRIVATE_KEY_NOT_A_FILE`, `SSH_PRIVATE_KEY_UNREADABLE`, `SSH_PRIVATE_KEY_EMPTY`, `SSH_PRIVATE_KEY_UNSUPPORTED_FORMAT`, and `SSH_PRIVATE_KEY_PASSPHRASE_REQUIRED` directly from connection diagnostics.
