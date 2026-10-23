# Environment

- **One schema, generated projections.** The root `.env` declares every setting with its type and target. The root `.env.local` holds the current environment's values. `env-manager gen` writes each target's values file and `src/env.ts` reader. Never edit a child values file or reader by hand.
- **Two environments in AWS: `dev` and `prod`.** Project `a-better-me` in env-manager. `dev` is for local development, `prod` for deploys. Pull with `env-manager down` after `env-manager env set <env>`, push with `env-manager up`. Use the global `env-manager` for both: it loads the AWS credentials from its own checkout, which the pinned copy in `node_modules` cannot see. There is no `local` environment.
- **Agents and CI never need AWS.** Worktree setup and CI run `env-manager gen --local`, which uses the schema defaults. So every default must be harmless and enough to start the app and run the tests.
- **Worktrees get their own ports.** `scripts/setup-worktree.ts` writes a git-ignored `.env.override` with a free port block from 7200 up. env-manager applies it on top of the root values for every target, and never uploads it.
- **Secrets are optional in the schema and required in `config.ts`.** That keeps offline generation working. `server/src/config.ts` lists the settings production needs in `REQUIRED_IN_PRODUCTION`, and the server refuses to start without them, instead of failing on the first request that reads one.
- **`APP_ENV`** is `development` in `dev` and `production` in `prod`.
