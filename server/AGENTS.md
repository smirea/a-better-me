# API server

- Routes live in one fetch handler, `src/api.ts`, free of Bun and Node APIs. `src/index.ts` serves it with Bun (`bun run start:server` from the root, or `bun run start` here) over `.data/<checkout>.sqlite`, and `src/worker.ts` on Cloudflare, where the `Space` Durable Object holds the data.
- Settings go through `parseConfig` in `src/config.ts`: `index.ts` passes the generated `src/env.ts`, the Worker its bindings. Add a secret production needs to `REQUIRED_IN_PRODUCTION` there so the server fails at startup without it, and `scripts/secrets.ts` pushes and verifies it on the Worker.
- The schema is `../shared/db/schema.ts`. A new column needs a default or must be nullable, because both sides add it to existing tables. After changing it, run `bun run generate` from the root and commit `app-ios/Sources/App/Sync/Generated/SyncSchema.swift`; `../shared/db/schema.test.ts` fails when it is stale. Declare server-only secrets in the server scope of the root `.env`; edit values only in root `.env.local` and run `env-manager gen --local`.
- `src/api.test.ts` drives `handle` over an in-memory space from `sync-engine/core`; add a case there for any route or rule change.
- Browser `/api/status` maps to this server's `/status`. Shared contracts belong in `../shared/`; keep them independent of server configuration.
