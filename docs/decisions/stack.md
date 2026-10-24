# Stack

- **Bun and TypeScript everywhere.** Bun runs the API, scripts, tests, type checks (`bun check`, which needs Bun 1.4.3 or newer), and package management, pinned by `.bun-version` and `packageManager`. `typescript` stays installed only for editors, since `bun check` has no language server.
- **Web client.** React with TanStack Router on Vite, styled with Tailwind CSS. The browser calls the API through the client-relative `/api` proxy.
- **Server.** One fetch handler in `server/src/api.ts`, served by `Bun.serve` locally and by a Cloudflare Worker in production ([Hosting](hosting.md)). It reads settings only through `server/src/config.ts`. Drizzle over postgres.js talks to Postgres, and the tests run on PGlite through the real migrations.
- **Shared code.** `shared/` holds environment-independent types and contracts that both TypeScript apps import as `shared/*`, plus the generated exercise catalog data in `shared/catalog/` that every client reads.
- **iOS.** SwiftUI in `app-ios/`, launched through `app-ios/scripts/run`.
- **Lint and format.** Oxlint and oxfmt, run on staged files by lefthook and checked read-only in CI.
