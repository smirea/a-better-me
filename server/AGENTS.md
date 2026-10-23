# API server

- Bun routes live in `src/index.ts`. Run `bun run start:server` from the root, or `bun run start` here.
- Read settings from `config` in `src/config.ts`, which wraps the generated `src/env.ts`. Add a secret production needs to `REQUIRED_IN_PRODUCTION` there so the server fails at startup without it. Declare server-only secrets in the server scope of the root `.env`; edit values only in root `.env.local` and run `env-manager gen --local`.
- Browser `/api/status` maps to this server's `/status`. Shared contracts belong in `../shared/`; keep them independent of server configuration.
