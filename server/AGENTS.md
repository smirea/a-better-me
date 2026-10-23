# API server

- Bun routes live in `src/index.ts`. Run `bun run start:server` from the root, or `bun run start` here.
- Import settings from generated `src/env.ts`. Declare server-only secrets in the server scope of the root `.env`; edit values only in root `.env.local` and run `env-manager gen --local`.
- Browser `/api/status` maps to this server's `/status`. Shared contracts belong in `../shared/`; keep them independent of server configuration.
