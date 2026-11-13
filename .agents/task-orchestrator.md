---
project: a better me
gc: agent-t3-worktree gc --repo .
teardown: agent-t3-worktree teardown
ship: pr-ship --merge
---

Repo config for the global `task-orchestrator` skill (`~/code/ai-files/skills/task-orchestrator/`). Its `scripts/check-config.ts` validates this file.

# Orchestrator

- Decision docs: `docs/decisions/README.md` and the area files the tasks touch.
- Natural areas: the Workouts and Nutrition halves, the watch app, widgets, the server, and the web client. Every task that restructures the same `Sources/App/<Feature>` folder goes in one job.
- Clients a job can cover: iPhone, watch, widgets, server, web.
- Usual shared work: a schema change, a new design-system component in `Sources/Shared/DesignSystem`, a sync or server capability, a `DevSeed.swift` or settings-tree restructure.
- iOS jobs run in parallel too: `app-ios/scripts/run` holds a headless boot while the Mac's total CPU is above 70%, telling the child it waits. Schema jobs don't wait on each other: the worker schema rule has the PR that merges second regenerate `SyncSchema.swift`.
- Human-only tasks: testing on a physical iPhone or Apple Watch, topping up Gemini credits in AI Studio, or a camera, push, or Health check on a device.
- A child may read the Gemini key for food-ramble or photo-logging evals, as the `# Worker` part describes.
- Known shared failures: a stuck `debugserver` that hangs every simulator launch (`app-ios/AGENTS.md` has the fix), depleted Gemini credits.

# Worker

## Setup

- Read `docs/decisions/README.md`, and the `AGENTS.md` of every folder you change (`app-ios/`, `server/`, `shared/`, `app-web/`).
- Your server runs on your own ports from `.env.override` over a SQLite file in your worktree's `.data/`; nothing is shared. Rung 3's `app-ios/scripts/run --headless` starts it when nothing answers on your `API_PORT`, detached, logging to `.data/server.log`, and Debug builds sign in with the bundled development token. For server-only work run `bun run start` in `server/` as a harness background task, never with `&` in the same call as another command: both died together once. From the repo root, the root `.env.local` hands the server the main checkout's `API_PORT`.
- The one env exception: an eval of food ramble (`scripts/ramble-lab/`) or photo logging needs a real Gemini key, because your worktree's is a placeholder. Read the single-quoted value after `GEMINI_API_KEY=` in `~/code/a-better-me/server/.env.local` and export it only into the eval or server process. Never write it to a file. Probe it with one request first; a 402 means the credits are depleted, so end with `blocked`.
- Pre-commit and pre-push already run `scripts/test-changed.ts`. At push it also runs every AppTests suite that names a type your changed Swift declares, which boots your simulator; if it exits 3, the Mac was busy: push again.

## iOS: boot a simulator only to look at the app

The Mac runs many jobs at once, and each booted simulator slows all of them. Climb this ladder and stop at the first rung that proves the change, but a change to what the user sees or taps always reaches rung 3, and you tap it (`docs/decisions/ios.md`, Verification).

1. Pure logic lives in plain functions with Swift Testing suites under `app-ios/Tests/<Feature>/`. Write the test there; CI's Swift `tests` task runs it. Run it locally (`app-ios/scripts/test <Suite>`) only when you also need rung 3, so the simulator boots once: pass `--keep`, since it otherwise shuts down a simulator it booted. A suite name it doesn't know fails at once and lists the closest ones.
2. Does the app compile: from the repo root, `xcodebuild build -project app-ios/App.xcodeproj -scheme App -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO -derivedDataPath app-ios/DerivedData/simulator -clonedSourcePackagesDirPath app-ios/DerivedData/SourcePackages` (no boot). Skip it when rung 1 or 3 runs next: both build the app anyway, into the same folder. Use it after every rebase too, and as the check for a Swift conflict when `pr-ship` exits 2.
3. UI behavior: `app-ios/scripts/run -t "$(agent-simulator udid)" --headless --no-watch` creates your worktree's own simulator (named after the worktree directory) on first use, builds, installs, grants permissions once, and launches it with seeded data. While the Mac's total CPU is above 70% or 4 simulators are booted it waits before booting and says so; if it exits 3 after three minutes, rerun it, and do other work between reruns if you have any. Drive it with T3's device tools: `device_list`, then `device_open` with its `hostId` and `id`, and run the exact `agent-device` command path it returns, with no wrapper and no flags; tap by label with `press 'label="Save"' --settle` (`app-ios/AGENTS.md`). Finish the server and logic side first and batch every check into one session, so the simulator boots once, late.

- Shut it down as soon as you have what you need: `agent-device close`, `device_close` with `shutdown: true`, then `app-ios/scripts/run --stop`, which stops the server rung 3 started and shuts down your simulators. `device_close` once left one booted for half an hour. Never `simctl boot` or drive the app with raw `simctl`. Removing your worktree after the merge deletes its simulators, with their paired watches.
- Health is off in Debug simulator builds. Only a Health job runs `app-ios/scripts/run --health on`. Answer a Health sheet that comes back (a new type asks again) with `--grant-permissions`, not by hand: `agent-device` can't press anything on it. Never `simctl privacy grant all`. The watch app goes through `app-ios/scripts/watch-drive`, not the device tools.
- Device-only checks: a simulator can't prove notification banners, pushes, real camera hardware, workout mirroring between phone and watch, or speed. Prove the logic with tests and name the device check in `verification`. Add it to `outOfScope` only when the change can't be trusted without it. Widgets, Live Activities, and layouts the simulator can prove: test them there and never hand them to Stefan as a device check.
- If every launch or `xcodebuild test` hangs with the app stopped (`ps` state `T`), follow the stale `debugserver` fix in `app-ios/AGENTS.md`. If it keeps happening, end with `blocked`.
- Read the Performance section of `app-ios/AGENTS.md` before touching any view, query, or derived data, and check screens against the seeded volume.
- Upgrade check for entitlements, `Info.plist`, extensions, signing, or stored data: install master's build on your simulator (from a throwaway `git worktree add`), then yours over it, and launch with the existing data. A Release-only setting you can't build locally gets a line in `verification`.

## PR

- Add the changelog entry before you push, with every task from your brief's `# Tasks being addressed`, passing each one's `[title](link)` line whole so the app can show the title: `bun scripts/changelog.ts add "<what changed, in the owner's words, one line>" --task "[<task title>](<task link>)" [--task …] [--desc "<one short sentence, only when the title needs it>"]`. Pre-push and CI fail a PR that changes shipped code without one.
- Schema changes are additive (`docs/decisions/sync.md`): add tables and columns, each with a default or nullable, and never drop or retype one; a column whose type must change gets a new name. After changing `shared/db/schema.ts`, run `bun run generate` and commit `SyncSchema.swift`. Two schema PRs conflict in that file: the one that merges second takes master's copy, rebases, and reruns `bun run generate`. Never hand-merge it.

## After the merge

- Post-merge run: a merge that touched `app-ios/` also waits on master's TestFlight run (`testflight.yml`) for your merge.
- A Worker secret goes on the Worker with `bun scripts/secrets.ts push` after its `env-manager up`. If master's deploy already failed on `secrets verify`, `gh run rerun --failed <run>` then check `gh run view <run> --json status,conclusion` in foreground calls until `status` is `completed`. Report `merged` only once its `conclusion` is `success`; a failed deploy is `blocked` with the run link.
