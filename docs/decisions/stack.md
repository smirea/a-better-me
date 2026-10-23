# Stack

- **Bun and TypeScript everywhere.** Bun runs the API, scripts, tests, and package management, pinned by `.bun-version` and `packageManager`.
- **Web client.** React with TanStack Router on Vite, styled with Tailwind CSS. The browser calls the API through the client-relative `/api` proxy.
- **Server.** `Bun.serve` in `server/`. It reads settings only through `server/src/config.ts`.
- **Shared code.** `shared/` holds environment-independent types and contracts that both TypeScript apps import as `shared/*`.
- **iOS.** SwiftUI in `app-ios/`, launched through `app-ios/scripts/run`.
- **Lint and format.** Oxlint and oxfmt, run on staged files by lefthook and checked read-only in CI.
