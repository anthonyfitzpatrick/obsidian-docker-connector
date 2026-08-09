---
tags: [docker-connector, ssh, private-key]
---

# Private Key Authentication

Choose an OpenSSH private-key file on Obsidian desktop. The absolute path is saved, while its contents and optional passphrase are held only while the plugin is loaded. The ssh2 library parses supported RSA, Ed25519, and ECDSA keys. Encrypted keys prompt for a passphrase after restart; unencrypted keys reconnect from their saved path. See [[Docker Connector - Runtime Credentials]].

Troubleshoot `SSH_PRIVATE_KEY_NOT_FOUND`, `SSH_PRIVATE_KEY_NOT_A_FILE`, `SSH_PRIVATE_KEY_UNREADABLE`, `SSH_PRIVATE_KEY_EMPTY`, `SSH_PRIVATE_KEY_UNSUPPORTED_FORMAT`, and `SSH_PRIVATE_KEY_PASSPHRASE_REQUIRED` directly from connection diagnostics.
