# Per-user infrastructure

Research, November 2026. Nothing here is decided or built. When it is, the rulings move to `docs/decisions/` and replace the single-owner entries in [Product goals](../decisions/product.md), [Sync](../decisions/sync.md), and [Hosting](../decisions/hosting.md).

## Goal

Everyone installs the same app build. Each user runs their own backend in their own cloud accounts and is the only tenant in it. The build carries no endpoint and no secret. A fresh install works on the device alone and syncs nothing until the user's backend exists and the app is paired with it. The user gets a prompt to hand to their own agent, and the agent does the setup.

## Inventory

What exists today, and what each user would need.

| Piece                                                                | Today                                                                                         | Per user                                                                                                          | Provisioned by                                                |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Cloudflare account                                                   | Shared with procrastimate                                                                     | Their own                                                                                                         | The user signs up and runs `wrangler login`; the agent cannot |
| Worker `a-better-me` (`server/src/worker.ts`)                        | Deployed by CI from `master`                                                                  | The same code, deployed to their account                                                                          | Agent                                                         |
| Durable Object `Space`, object `owner`                               | The one database, created on first request                                                    | Unchanged. Their account holds their one space                                                                    | Created by the deploy                                         |
| Public URL                                                           | Custom domain `a-better-me.stf.lol`, `workers_dev` off                                        | `https://a-better-me.<their-subdomain>.workers.dev`, or their own domain                                          | Agent                                                         |
| R2 `a-better-me-backups` + cron `0 9 * * *`                          | Daily dump, newest 30 kept                                                                    | The same, in their account. R2 has to be enabled in the dashboard first, which asks for a payment method          | User enables R2; agent creates the bucket                     |
| R2 `a-better-me-assets` (1,785 exercise and equipment images, 16 MB) | Private bucket; the build carries a read-only S3 key                                          | Their own copy, served by their Worker (see [Assets](#assets))                                                    | Agent uploads from the repo                                   |
| `OWNER_TOKEN`                                                        | Worker secret, and bundled in the Release build                                               | Generated per user; reaches the app by pairing, never by build                                                    | Agent                                                         |
| `GEMINI_API_KEY`                                                     | Photo logging, label scan, Ramble's reads                                                     | Their own Google AI Studio key. Optional: without it those features are off                                       | User creates the key; agent stores it                         |
| `XAI_API_KEY`                                                        | Live Ramble speech-to-text                                                                    | Their own xAI key. Optional                                                                                       | User creates the key; agent stores it                         |
| Open Food Facts                                                      | No key; proxied by the Worker                                                                 | Unchanged                                                                                                         | Nothing to do                                                 |
| USDA foods                                                           | SQLite file in the app bundle                                                                 | Unchanged                                                                                                         | Nothing to do                                                 |
| Sentry `a-better-me-worker`                                          | Required in production                                                                        | Optional: their own DSN or none                                                                                   | Agent, if they want it                                        |
| Sentry `a-better-me-ios`                                             | DSN in the build; traces every session; attaches screenshots and the view hierarchy to errors | Cannot stay as is: it would send every user's screens to the developer's Sentry (see [App changes](#app-changes)) | Developer                                                     |
| Agent API and bot tokens                                             | Per space                                                                                     | Unchanged, at their URL                                                                                           | Nothing to do                                                 |
| env-manager on AWS                                                   | Holds every value                                                                             | Not used. The setup script keeps the user's values in Cloudflare and a local file                                 | Not applicable                                                |
| GitHub Actions (`ci.yml`, `testflight.yml`)                          | Deploys the developer's Worker and uploads the build                                          | Stays the developer's. Users need only a way to redeploy on update (see [Updates](#updates))                      | Developer                                                     |
| App Store Connect app, bundle ids, app group, HealthKit entitlements | Developer's team `FNYFHG5SV7`                                                                 | Shared: one build for everyone, from the developer's account                                                      | Developer                                                     |
| TestFlight                                                           | Uploads on every push to `master`                                                             | An external tester group or public link, which needs Beta App Review, a privacy policy URL, and review notes      | Developer                                                     |
| Apple Health, Watch app, widgets, Live Activity                      | On the device                                                                                 | Unchanged. None of them talks to the server                                                                       | Nothing to do                                                 |

The repositories a setup needs (`smirea/a-better-me`, `smirea/sync-engine`, `smirea/feedback-engine`) are already public.

## What has to be built

### App changes

1. **Server settings at run time.** `API_URL`, `OWNER_TOKEN`, and the `ASSETS_*` settings leave `Info.plist` and the Release build. The URL and token live in the Keychain. `AppEnvironment` stops calling `fatalError` when they are missing; unpaired is a normal state.
2. **Local-only mode.** `SyncClient` does not start until the app is paired. Writes still queue in `_outbox`, so the first sync after pairing uploads everything logged before it. Verify this against a fresh space: the first sync must send the outbox before it applies the snapshot.
3. **Pairing.** The app reads a URL and token from a QR code or a deep link, checks them against the server (open `/status`, then one authorized request), stores them, and starts syncing. A 401 today stops sync until the next launch; it becomes a "pair again" state.
4. **Features that need the server say so.** Unpaired, or paired with a server that has no Gemini or xAI key, the branded search, barcode lookup, photo logging, label scan, and Ramble are hidden or explain what is missing. `/status` reports which the server supports.
5. **Server version check.** See [Updates](#updates).
6. **A first-run path.** The app has no onboarding by design. A new user starts with no profile (the BMR inputs), no units choice, no gym, and no nutrition plan. Decide how little is enough: sensible defaults plus the existing settings pages may do.
7. **Telemetry that is safe for other people's data.** Either no Sentry outside the developer's own install, or crash reports only with screenshots, view hierarchy, and tracing off, or an opt-in. A user's own DSN could arrive with the pairing payload.
8. **An audit for owner-specific defaults.** Known candidates: the male body figure, `Resources/Gyms` defaults, the dev seed, and the shared keychain group `com.stefan.shared`.

### Server and repository changes

1. **A deploy config without the developer's values.** `wrangler.jsonc` names the `stf.lol` route. Users need `workers_dev` on and no route, generated by the setup script or selected by a wrangler environment.
2. **Optional secrets.** `REQUIRED_IN_PRODUCTION` drops `SENTRY_DSN`, `GEMINI_API_KEY`, and `XAI_API_KEY` for user deploys. The routes already answer 503 without a key in development.
3. **`/status` grows.** It reports the server's version, its schema, and its capabilities, so the app can check compatibility and show the right features.
4. **One idempotent setup script,** for example `./scripts/setup.ts`. It checks the tools and the Cloudflare login, creates the buckets, generates the token, sets the secrets, deploys, uploads the assets, proves a sync round trip against the deployed Worker, and prints the pairing QR code. A rerun converges, so the same script is the update and the repair command. The developer's own deploy should run through it too, so there is one path.
5. **The setup prompt.** Short, and it points at the script: clone the repository at the release the app names, run the script, do the steps only the user can do when the script asks. The script is the lever; the prompt stays thin so it cannot drift.
6. **Teardown and export.** `GET /api/export` already returns every row. Add a documented way to delete the Worker, the object, and the buckets.

### Assets

The app downloads the catalog images instead of bundling them. Debug already fetches them from the dev server at `$(API_URL)/assets`, in the bucket's layout. The simplest per-user shape is the same path in production: an `ASSETS` R2 binding on the user's Worker, served at `/assets` behind the owner token. Pairing then needs only the URL and the token, and the read-only S3 key disappears. Bundling the 16 MB in the app is the alternative with no infrastructure.

### Updates

The app updates itself through TestFlight; a user's Worker does not. Today that gap can lose data: the server rejects a write to a table it does not know, answers with a tombstone, and the device deletes the row. Columns are safe, tables are not. Before other people run servers:

- The app compares `/status` with the schema it was built with and pauses sync, keeping the outbox, when the server is behind. It shows the update prompt.
- Users need a low-effort update. Options: a scheduled GitHub Action in the user's fork that pulls upstream and deploys; Cloudflare's Workers Builds on that fork; or a rerun of the setup script when the app asks. The first two need a GitHub account; the third needs the agent again.
- Releases get tags, and the app names the server release it needs.

## The process, end to end

1. **Install.** The user joins TestFlight and opens the app. It works on the device, with Apple Health, the Watch, and widgets. Nothing leaves the phone.
2. **Ask.** Settings shows "Set up sync" with the prompt to copy to an agent on their computer.
3. **Accounts.** The agent stops for what only the user can do: sign up for Cloudflare and log in through the browser, enable R2, and create a Gemini key and an xAI key if they want the AI features.
4. **Provision.** The agent runs the setup script, which deploys the Worker, creates the buckets, sets the secrets, uploads the assets, and verifies the result against the live Worker.
5. **Pair.** The script prints a QR code. The user scans it; the app verifies the server, uploads what was logged locally, and turns on the server features.
6. **Optional.** Import MacroFactor exports with the existing scripts, and create a bot token for a coaching agent.
7. **Afterwards.** Updates when the app asks, the daily backup in their own bucket, token rotation by rerunning the script and pairing again.

## Open questions

- **Distribution.** One shared build through TestFlight (Beta App Review, builds expire after 90 days, 10,000 testers) or the App Store. The alternative, every user building the app with their own Apple developer account, is far heavier and is not assumed here.
- **The catalog is MacroFactor's.** The exercise data, instructions, images, and the body figure come from the MF Workouts bundle ([Workouts](../decisions/workouts.md#exercise-catalog-source)). That was a personal-use tradeoff. Handing the app to other people makes it distribution of someone else's content, and the catalog needs a ruling before anyone else installs the app.
- **Who generates the token.** The agent can generate it and show it in the QR code. Or the app generates it, the prompt carries only its SHA-256, and the server stores the hash, as bot tokens already work; the secret then never passes through the agent's transcript.
- **Cost for a user.** Expected to fit Cloudflare's free plan (SQLite Durable Objects, R2's free tier, one cron), with Gemini and xAI billed to the user. Not yet measured: the per-minute sync and the `/api/live` socket against the free plan's limits.
- **Does the developer's install move too.** One path is simpler: the developer's phone pairs like everyone's, and the bundled token goes away in the same release.
- **Support surface.** What a user's agent does when the script fails, and where the developer learns about it without holding their data.
