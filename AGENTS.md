# Docker Connector

## Commands

- Use `npm ci` for a clean install; this repository uses the committed npm lockfile.
- Run the normal verification sequence: `npm test`, `npm run lint`, `npm run build`, `npm run release:check`, then `git diff --check`. `lint` is the TypeScript `--noEmit` typecheck; `build` typechecks again before bundling and `release:check` rebuilds then validates the staged package. `npm test` must pass without `dist/`; `release:check` builds the actual three-file staging package.
- Run one plugin test with `npx vitest run tests/<file>.test.ts`. Gateway tests are outside the npm test script: `node --test gateway/test/*.mjs`.
- `npm run build` emits root `main.js`, removes obsolete `desktop-transports.js` and `desktop-ui.js`, and stages the three release files under `dist/community-plugin/docker-connector/`. `npm run dev` is a one-shot unminified build with inline source maps, not a watch server.

## Architecture

- `src/main.ts` is the Obsidian plugin lifecycle entrypoint. It owns persisted non-secret settings and snapshots; keep transport construction, Docker API policy, and mutations in their dedicated services.
- Esbuild emits one CommonJS bundle, `main.js`. Desktop transports and UI services are bundled but initialized only after the desktop platform capability gate; mobile supports the Gateway path only.
- `gateway/` is a dependency-free Node companion service for mobile access. It is intentionally a token-authenticated, GET-only allowlist over the local Docker socket; do not turn it into a generic Docker proxy.

## Safety Boundaries

- Preserve read-only-by-default behavior. Container actions must stay typed, explicitly enabled per online profile, session-only, validated in the service layer, and covered by focused tests. Connection loss revokes management authorization.
- Do not add insecure Docker TCP, TLS-verification or SSH host-key bypasses, Docker Context mutation, shell execution, telemetry, or persisted passwords, passphrases, tokens, private keys, or certificate contents.
- Use only non-secret fixtures and diagnostics. Run any Docker mutation validation only against disposable local containers, never a production host.
- Keep the Gateway a token-authenticated, GET-only allowlist, never an arbitrary Docker or mutation proxy. Keep Compose-managed containers protected from standalone Update.

## Release And Docs

- Release assets are exactly `main.js`, `manifest.json`, and `styles.css`; keep versions aligned across `manifest.json`, `package.json`, `package-lock.json`, and `versions.json` for releases.
- When changing Obsidian documentation, retain YAML frontmatter and wikilinks. `User Guide.md` is the canonical end-user manual.
