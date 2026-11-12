# Decisions

- Read [`docs/decisions/README.md`](docs/decisions/README.md) and the area files your work touches before starting.
- Whenever a new concept, goal, paradigm, or high-level system decision comes up, record it in the matching area file under `docs/decisions/` in the same PR as the work. Add a new file and list it in the index when no area fits.

# Workflow

Full rules in [`docs/decisions/workflow.md`](docs/decisions/workflow.md).

- One PR per thread, never stacked. Rebase only when GitHub reports a real conflict.
- Worktree setup is automatic: T3 Code runs `agent-t3-worktree setup` when it creates a worktree, and the session-start and pre-commit checks rerun it when something is missing. Never run it by hand, and never rename a T3 worktree's branch. A merged worktree is removed when its thread settles or by `agent-t3-worktree gc --repo .`; `agent-t3-worktree teardown <worktree | branch>` removes one right away.
- A PR that changes shipped code (`app-ios/Sources`, `app-ios/Config`, `app-ios/Assets`, `server/src`, `app-web/src`, `shared/`) adds a changelog entry, which the app lists in More > Changelog: `bun scripts/changelog.ts add "<one-line title of what changed for the owner>" --task <task id or link from your brief> [--desc "<one short sentence>"]`, then commit the file it writes under `changelog/`. Pre-push and CI's Changelog entry check fail without one. See [`docs/decisions/changelog.md`](docs/decisions/changelog.md).
- After opening a PR, run `pr-ship [--merge]` (shared, from `~/code/scripts`) in the foreground until it exits 0. Its exit code names the next step.
- Never skip git hooks. Fix the failure instead.
- Run only the relevant tests locally; CI runs the full suite.
- Development speed is a goal. When friction shows up (a manual step, a prompt you click through, a slow command, a flaky tool), fix it in the same thread if it is small; otherwise open a GitHub issue with what you found and a proposed fix, and say so in your reply.
- Set up for the default path. Dev and test environments start the way the owner uses the app, with every permission granted and realistic data seeded; an agent testing a denied or empty state revokes or clears it itself.

# Stack

- Tooling: Bun + TypeScript
- Server: Bun.serve API
- Client: React + Vite + TanStack Router
- UI: Tailwind CSS (enabled in **WEB_DIRECTORY**/src/index.css)
- Linting and Hooks: Oxlint + Lefthook

# Structure and commands

- `app-web/` owns React, routes, styles, and Vite. `server/` owns the Bun API. `shared/` holds environment-independent types and contracts. Read each folder's `AGENTS.md` before changing it.
- `bun run start` runs client and server; `start:client` and `start:server` run them separately. Browser API calls use the client-relative `/api` proxy.
- The server needs no services: `bun run start:server` runs it over a git-ignored SQLite file in `.data/`. After changing `shared/db/schema.ts`, run `bun run generate` and commit the Swift schema it writes. See [`docs/decisions/sync.md`](docs/decisions/sync.md) and [`docs/decisions/hosting.md`](docs/decisions/hosting.md).
- A `monorepo-swift` scaffold also has `app-ios/` with native instructions and its own launcher. See that folder's docs.

# Environment

Full rules in [`docs/decisions/environment.md`](docs/decisions/environment.md).

- Use env-manager's root `.env` schema and named directory targets. Values live in AWS, project `a-better-me`, environments `dev` and `prod`. Switch with `env-manager env set <env>` (it downloads that environment), edit the root `.env.local`, then `env-manager up`. Child values and readers are generated projections, not independent configs.
- Use the global `env-manager` for `down` and `up`; it has the AWS credentials. Agents without AWS access run `env-manager gen --local`, which uses the schema defaults. A worktree runs `up` only after its PR merged, and only after `env-manager env set <env>` downloaded that environment's real values: its own `.env.local` holds schema defaults, which `up` would upload over them.
- Read application settings through generated `src/env.ts` in each TypeScript target. The server reads them through `server/src/config.ts`, which fails at startup when production lacks a setting. The client's reader runs only in Vite's Node context; browser code must not import it.
- Keep schema and readers tracked, values files and `.env.override` ignored, and secrets scoped to the server target. Native and browser settings are public, except `OWNER_TOKEN`, which Release iOS bundles from `prod` via `bun run env:ios`.

# Native app

- Performance is a top priority. Read the Performance section of `app-ios/AGENTS.md` before touching any view, query, or derived data.

- SwiftUI lives in `app-ios/`; read its `AGENTS.md` for native development. The root `start:ios` script delegates to `app-ios/scripts/run` and forwards launcher arguments.
- The web client lives in `app-web/`. Root `start` runs it and the server together. `start:client` and `start:server` run each individually; iOS runs separately.
- The root env-manager schema declares each directory target with explicit output paths: TypeScript values at `.env.local` and readers at `src/env.ts`, native values at `Config/LocalSecrets.xcconfig`. Regenerate the nested xcconfig with `env-manager gen --local`; never hand-edit `app-ios/Config/LocalSecrets.xcconfig`.
- `Config/Base.xcconfig` and `Config/Info.plist` bridge selected settings into `AppEnvironment.apiURL`. Native settings are bundled; server credentials belong exclusively to the server target.

- Local web host: a-better-me.localhost -> 6150; browser API calls use the /api proxy.
