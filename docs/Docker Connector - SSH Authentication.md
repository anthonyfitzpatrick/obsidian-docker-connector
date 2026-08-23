---
tags: [docker-connector, ssh, authentication]
---

# SSH authentication

Docker Connector supports password and [[Docker Connector - Private Key Authentication|private-key-file]] authentication. Passwords and key passphrases are session-only by default; profile settings contain no secret material. SSH Agent and SSH config support are not implemented.

For a password profile only, **Remember password on this device** is an explicit off-by-default choice. It stores that password separately in plugin data so reconnection can resume after an Obsidian restart. Obsidian Community Plugins provide no supported keychain API, so this storage has no guaranteed encryption; use it only on a trusted device and prefer SSH keys where possible. Forget the password to delete it immediately. Host-key verification remains mandatory and a changed host key always blocks reconnection.
