# Decisions

- Read [`docs/decisions/README.md`](docs/decisions/README.md) and the area files your work touches before starting.
- Whenever a new concept, goal, paradigm, or high-level system decision comes up, record it in the matching area file under `docs/decisions/` in the same PR as the work. Add a new file and list it in the index when no area fits.

# Workflow

Full rules in [`docs/decisions/workflow.md`](docs/decisions/workflow.md).

- One PR per thread, never stacked. Rebase only when GitHub reports a real conflict.
- In a fresh git worktree, run `bun scripts/setup-worktree.ts [branch]` first. T3 Code threads already ran it, so check for `node_modules` and `.env.override` first, and never pass `[branch]` there: T3 owns the branch name. `bun scripts/teardown-worktree.ts <worktree | branch>` removes it from the main checkout once the PR is merged.
- After opening a PR, run `bun scripts/pr-ship.ts [--merge]` in the foreground until it exits 0. Its exit code names the next step.
- Never skip git hooks. Fix the failure instead.
- Run only the relevant tests locally; CI runs the full suite.

# Stack

- Tooling: Bun + TypeScript
- Server: Bun.serve API
- Client: React + Vite + TanStack Router
- UI: Tailwind CSS (enabled in **WEB_DIRECTORY**/src/index.css)
- Linting and Hooks: Oxlint + Lefthook

# Structure and commands

- `app-web/` owns React, routes, styles, and Vite. `server/` owns the Bun API. `shared/` holds environment-independent types and contracts. Read each folder's `AGENTS.md` before changing it.
- `bun run start` runs client and server; `start:client` and `start:server` run them separately. Browser API calls use the client-relative `/api` proxy.
- A `monorepo-swift` scaffold also has `app-ios/` with native instructions and its own launcher. See that folder's docs.

# Environment

Full rules in [`docs/decisions/environment.md`](docs/decisions/environment.md).

- Use env-manager's root `.env` schema and named directory targets. Values live in AWS, project `a-better-me`, environments `dev` and `prod`. Edit them in the root `.env.local` after `env-manager down`, then `env-manager up`. Child values and readers are generated projections, not independent configs.
- Use the global `env-manager` for `down` and `up`; it has the AWS credentials. Agents without AWS access run `env-manager gen --local`, which uses the schema defaults. Never run `up` from a worktree: `.env.override` is local, but the values you edited are not.
- Read application settings through generated `src/env.ts` in each TypeScript target. The server reads them through `server/src/config.ts`, which fails at startup when production lacks a setting. The client's reader runs only in Vite's Node context; browser code must not import it.
- Keep schema and readers tracked, values files and `.env.override` ignored, and secrets scoped to the server target. Native and browser settings are public.

# Native app

- SwiftUI lives in `app-ios/`; read its `AGENTS.md` for native development. The root `start:ios` script delegates to `app-ios/scripts/run` and forwards launcher arguments.
- The web client lives in `app-web/`. Root `start` runs it and the server together. `start:client` and `start:server` run each individually; iOS runs separately.
- The root env-manager schema declares each directory target with explicit output paths: TypeScript values at `.env.local` and readers at `src/env.ts`, native values at `Config/LocalSecrets.xcconfig`. Regenerate the nested xcconfig with `env-manager gen --local`; never hand-edit `app-ios/Config/LocalSecrets.xcconfig`.
- `Config/Base.xcconfig` and `Config/Info.plist` bridge selected settings into `AppEnvironment.apiURL`. Native settings are bundled; server credentials belong exclusively to the server target.

- Local web host: a-better-me.localhost -> 6150; browser API calls use the /api proxy.
