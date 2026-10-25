# Client and server

Bun API in `server/`, React + Vite + TanStack Router in `app-web/`, and shared TypeScript contracts in `shared/`. Each app owns its entry points and generated environment reader; shared code should stay independent of app configuration.

```sh
bun install
env-manager down               # or `env-manager gen --local` without AWS access
bun run start                  # web client and API, with watch/reload
bun run start:client
bun run start:server
```

The client proxies `/api/*` to the API and removes the `/api` prefix. For example, `/api/status` reaches the server's `/status`. The local web hostname and ports are configured during scaffolding; inspect the root `.env` for defaults.

## Environment

`env-manager` manages one root `.env` schema with directory targets. The root `.env.local` is the only place to edit local values. Run `env-manager gen --local` after editing either file; it generates `app-web/.env.local`, `server/.env.local`, and each target's `src/env.ts`. Commands from child directories find the owning root. There are no independent child schemas.

Values live in AWS Secrets Manager under project `a-better-me`, in environments `dev` and `prod`. Select one with `env-manager env set dev`, pull it with `env-manager down`, and push edits with `env-manager up`. Without AWS access, `env-manager gen --local` generates everything from the schema defaults. A git-ignored `.env.override` pins per-checkout values such as worktree ports; `scripts/setup-worktree.ts` writes it.

Keep `.env` and generated TypeScript readers tracked. Ignore all `.env.local` files and generated Swift values. Read server configuration through `server/src/env.ts`; the client's reader is for Vite's Node-side configuration, not browser code. Browser requests use `/api` and must never import server secrets or the environment reader.

## iOS app

`app-ios/` contains the SwiftUI app, Xcode project, Swift package, and executable `scripts/run` launcher. It uses the same Swift template as the standalone scaffold.

```sh
bun run start:ios --targets
bun run start:ios -t simulator
bun run start:ios -t mac --no-watch
```

`app-web/` contains the web client. `start:client` runs it; `start` runs the web client and API; launch iOS separately with `start:ios`. Arguments pass through to `app-ios/scripts/run`. See `app-ios/README.md` and `app-ios/AGENTS.md` for native development and signing.

The root `.env` declares `app-web format=ts path=.env.local generate=src/env.ts`, the server target with the same output paths, and `app-ios format=swift path=Config/LocalSecrets.xcconfig`. Paths are relative to each target directory. `env-manager gen --local` projects its selected values into `app-ios/Config/LocalSecrets.xcconfig`. `API_URL` is shared by Vite's proxy and the native app; read it in Swift with `AppEnvironment.apiURL`. Configure a reachable API host in the root `.env.local` for physical devices: `127.0.0.1` points at the device itself. Regenerate and rebuild after changing values. Release iOS builds take the production `API_URL` and `OWNER_TOKEN` from env-manager `prod` via `bun run env:ios`. Other credentials stay scoped to the server.
