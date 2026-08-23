---
tags: [docker-connector, security]
---

# Runtime Credentials

Passwords, SSH private-key passphrases, Docker TLS client-key passphrases, and Gateway tokens are stored separately by profile ID in memory. They are cleared on profile removal and plugin unload, and are never written to diagnostics, notices, or reports.

SSH password profiles also offer an off-by-default **Remember password on this device** choice. Obsidian Community Plugins expose no supported keychain or secure-credential API, so this explicit choice stores only that password in a separate profile-ID-scoped `rememberedSshPasswords` record in plugin `data.json`; it is not part of the profile object and has no guaranteed encryption. It is removed when forgotten, the profile is deleted, password authentication is changed, or the SSH host or username changes. SSH private-key passphrases, TLS client-key passphrases, Gateway tokens, private keys, certificates, and certificate/key contents are never remembered. See [[Docker Connector - Mutual TLS Profiles]].

Generating a private key and installing its public key do not expand this exception: the generator passphrase and the password used for public-key installation stay in memory only. The installer transmits only the public `.pub` line.
