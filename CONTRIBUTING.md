# Contributing

Use a Node.js version compatible with `package-lock.json`, then run `npm ci`, `npm test`, `npm run lint`, `npm run build`, and `npm audit` before submitting a change.

Keep Docker Connector read-only by default. Do not add a generic Docker mutation client, shell execution, insecure TLS, Docker Context mutation, telemetry, secret fixtures, or persisted passwords/passphrases/key material. Container-management changes must remain typed, explicitly enabled, validated in the service layer, and covered by focused tests.

Use realistic but non-secret fixtures. Do not put passwords, private keys, certificate contents, registry credentials, or container environment values in source, test snapshots, diagnostics, or documentation. Docker mutation testing must be local and isolated: use disposable containers and never target a production Docker host.

Keep documentation honest and update relevant Obsidian notes with YAML frontmatter and wikilinks. A release needs only `main.js`, `manifest.json`, and `styles.css`; verify their version consistency and do not claim manual Obsidian or live-Docker validation that was not performed.
