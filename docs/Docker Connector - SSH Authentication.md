---
tags: [docker-connector, ssh, authentication]
---

# SSH authentication

Docker Connector supports password and [[Docker Connector - Private Key Authentication|private-key-file]] authentication. Passwords and key passphrases are session-only by default; profile settings contain no secret material. SSH Agent and SSH config support are not implemented.

For a password profile only, **Remember password on this device** is an explicit off-by-default choice. It stores that password separately in plugin data so reconnection can resume after an Obsidian restart. Obsidian Community Plugins provide no supported keychain API, so this storage has no guaranteed encryption; use it only on a trusted device and prefer SSH keys where possible. Forget the password to delete it immediately. Host-key verification remains mandatory and a changed host key always blocks reconnection.

Desktop private-key setup can generate an Ed25519 key through the local OpenSSH `ssh-keygen` tool and install only its public line through a separate trusted password session. The installation password and any private-key passphrase remain session-only. Neither is eligible for remembered-password storage, and unknown or mismatched host keys block installation.

An unknown host key opens **Verify SSH Host** with the received SHA-256 fingerprint. **Cancel** leaves the draft untrusted; **Trust and Continue** permits one retry and the fingerprint is saved only after that retry succeeds. A changed key shows both trusted and received fingerprints and offers no replacement action. Docker Connector neither treats `known_hosts` as authority nor auto-accepts or bypasses host verification.
