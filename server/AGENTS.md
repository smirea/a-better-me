# API server

- Routes live in one fetch handler, `src/api.ts`, free of Bun and Node APIs. `src/index.ts` serves it with Bun (`bun run start:server` from the root, or `bun run start` here) and `src/worker.ts` on Cloudflare.
- Settings go through `parseConfig` in `src/config.ts`: `index.ts` passes the generated `src/env.ts`, the Worker its bindings. Add a secret production needs to `REQUIRED_IN_PRODUCTION` there so the server fails at startup without it, and `scripts/secrets.ts` pushes and verifies it on the Worker.
- The schema is `../shared/db/schema.ts`. After changing it, run `bun run db:generate` and commit the new migration and `src/db/migrations.generated.ts`. Migrations are append-only. Declare server-only secrets in the server scope of the root `.env`; edit values only in root `.env.local` and run `env-manager gen --local`.
- Browser `/api/status` maps to this server's `/status`. Shared contracts belong in `../shared/`; keep them independent of server configuration.
