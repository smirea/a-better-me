# Shared contracts

- Keep shared types and domain helpers here. Both TypeScript apps resolve `shared/*` through the root tsconfig.
- `db/schema.ts` is the synced schema: Drizzle `sqlite-core` tables and the engine's `defineSchema` with the per-column validators. The server, the generator (`bun run generate`), and the tests import it; the iOS schema is generated from it, never edited by hand.
- Keep this folder independent of app-specific environment readers, server-only code, and browser frameworks. Each app owns its env-manager target.
