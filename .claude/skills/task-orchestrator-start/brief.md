# How to work

You own this job end to end, through the merge. Stefan authorized you to merge your PR without asking.

## Setup

- Read `AGENTS.md`, `docs/decisions/README.md`, the area files the brief names, and the `AGENTS.md` of every folder you change (`app-ios/`, `server/`, `shared/`, `app-web/`). They are binding. A decision your work introduces or revises goes in its area file in this PR.
- This file and those docs can go stale. When an instruction is wrong (a script that moved, a flag that changed, a tool you do have), do what is right, fix the instruction in this PR, and say so in your report's `summary`.
- T3 already ran `scripts/setup-worktree.ts` and owns the branch name. Check that `node_modules` and `.env.override` exist. Only if they don't, run `bun scripts/setup-worktree.ts` with no branch argument.
- Your server runs on your own ports from `.env.override` over a SQLite file in your worktree's `.data/`; nothing is shared. `bun run start:server` is enough for the iOS app's sync, and Debug builds sign in with the bundled development token.
- Never read or copy the main checkout's env files, and never run `env-manager up`, `down`, or `env set` before your PR merges. A new setting goes in the root `.env` schema with a harmless default, since worktrees and CI build from the defaults (`env-manager gen --local`). Its real values go up only after `pr-ship` exits 0, from your worktree: see "After the merge".
- The one exception: an eval of food ramble (`scripts/ramble-lab/`) or photo logging needs a real Gemini key, because your worktree's is a placeholder. Read the single-quoted value after `GEMINI_API_KEY=` in `~/code/a-better-me/server/.env.local` and export it only into the eval or server process. Never write it to a file. Probe it with one request first; a 402 means the credits are depleted, so end with `blocked`.
- Never touch the main checkout or another worktree's servers or simulators. Anything else you need from outside, such as a Sentry event, is in the brief; if it isn't, ask for it with `needs_input`.

## iOS: boot a simulator only to look at the app

The Mac runs many jobs at once, and each booted simulator slows all of them. Climb this ladder and stop at the first rung that proves the change, but a change to what the user sees always reaches rung 3 (`docs/decisions/ios.md`: done means you drove the changed screen and looked at a screenshot).

1. Pure logic lives in plain functions with Swift Testing suites under `app-ios/Tests/<Feature>/`. Write the test there; CI's Swift `tests` task runs it. Run it locally (`xcodebuild test -scheme App -only-testing:AppTests/<Suite>`) only when you also need rung 3, so the simulator boots once.
2. Does the app compile: from the repo root, `xcodebuild build -project app-ios/App.xcodeproj -scheme App -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO -clonedSourcePackagesDirPath app-ios/DerivedData/SourcePackages` (no boot). Use it after every rebase too.
3. UI behavior: create your own simulator named after your branch (`xcrun simctl create "$(git branch --show-current)" "iPhone 18 Pro"`), then `app-ios/scripts/run -t <udid> --headless --no-watch` claims it for your worktree, builds, installs, grants permissions once, and launches it with seeded data. While the Mac's total CPU is above 70% it waits before booting and says so; if it exits 3 after three minutes, rerun it, and do other work between reruns if you have any. Drive it with T3's device tools: `device_list`, then `device_open` with its `hostId` and `id`, and use the `agent-device` command it returns (through a bash wrapper under your worktree's `DerivedData/`, per `app-ios/AGENTS.md`). Finish the server and logic side first and batch every check into one session, so the simulator boots once, late.

- Shut it down as soon as you have what you need: `agent-device close`, then `device_close` with `shutdown: true`. Never `simctl boot` or drive the app with raw `simctl`. The teardown after your merge deletes every simulator your worktree claimed, with its paired watches.
- Health is off in Debug simulator builds. Only a Health job runs `app-ios/scripts/run --health on`. Never `simctl privacy grant all`. The watch app goes through `app-ios/scripts/watch-drive`, not the device tools.
- A simulator can't prove notification banners, pushes, real camera hardware, workout mirroring between phone and watch, or speed. Prove the logic with tests, then report the on-device check as a followup instead of trying. Widgets, Live Activities, and layouts the simulator can prove: test them there and never hand them to Stefan as a device check.
- If every launch or `xcodebuild test` hangs with the app stopped (`ps` state `T`), follow the stale `debugserver` fix in `app-ios/AGENTS.md`. If it keeps happening, end with `blocked`.
- Read the Performance section of `app-ios/AGENTS.md` before touching any view, query, or derived data, and check screens against the seeded volume.

## Shell

- Never end your turn while anything you started still runs: a background command, a server, a simulator session, or a review or other subagent. Nothing wakes you once the turn ends, and the orchestrator has to restart you. Run subagents and reviews in the foreground.
- A command that may outlive the 600 s tool limit, such as an eval, runs detached with unbuffered output to a file (`nohup cmd > out.log 2>&1 &`), and you wait for it in foreground calls of under 600 s each. Background jobs the harness starts are killed after 30 minutes.
- Never pipe `pr-ship`, `git push`, or a test run through `tail`/`head`: the pipe hides the exit status and the error. If the output is long, redirect it to a file and read the end.
- Stop every server you start, by its pid. Never `pkill -f` a pattern another worktree could match: one nutrition worker's `pkill` stopped its siblings' dev servers. macOS has no `timeout`. Don't chain `sleep` before another command, because a hook blocks it.
- Never use `git stash`; it is shared with every worktree. Use a WIP commit. For a baseline on master, `git worktree add` a throwaway checkout instead. Use `trash`, not `rm`.
- The machine is loaded, so run only the tests that cover the change; pre-commit and pre-push already run `scripts/test-changed.ts`. A timeout that passes when rerun alone is load; a failure that repeats is yours.
- Git hooks can't be skipped (a Claude Code hook blocks it). A failing hook gets its cause fixed, in this PR or as a followup. A flaky test is a bad test: fix why it flakes, or report it as a followup with the failing output, and never add retries or sleeps. "Fails only in this environment" is a followup too, not a reason to move on.

## PR

- Open one PR whose description starts with the `# Tasks being addressed` section the brief gives you, verbatim. Attach screenshots with `gh pr create --attach <file>` (UI changes only, 2 to 4). Then call `link_pull_request` with the PR URL.
- Then loop `bun scripts/pr-ship.ts --merge` in the foreground with a 600000 ms tool timeout. Its last line is `pr-ship exit <n>`:
  - `0`: merged.
  - `1`: fix the failing checks, or fix or answer each review thread and resolve it. Then push and rerun. If a failing check also fails on master or other PRs, rerun it once with `gh run rerun --failed`; if it fails again, fix it in this PR only when the fix is small and clearly yours to make, otherwise end with `blocked` and the run link.
  - `2`: another job landed first. Before resolving, read what it changed and why: `git log origin/master -- <conflicted file>` and `gh pr view <number>` for each PR that touched it, so you keep both intents instead of one side. Rebase onto `origin/master`, rerun only the checks that cover the conflicted files (the rung 2 build for Swift), push, rerun. During a rebase, `--theirs` is your branch and `--ours` is master.
  - `3`: rerun.
- Wait on CI only with `pr-ship`, never `gh run watch`. Treat review-bot comments skeptically: fix real bugs, and dismiss noise with a concrete reason in your reply.
- Schema changes are additive (`docs/decisions/sync.md`): add tables and columns, each with a default or nullable, and never drop or retype one; a column whose type must change gets a new name. After changing `shared/db/schema.ts`, run `bun run generate` and commit `SyncSchema.swift`. Two schema PRs conflict in that file: the one that merges second takes master's copy, rebases, and reruns `bun run generate`. Never hand-merge it.
- A job the brief marks as research, or "don't merge": open a draft PR, skip `pr-ship`, and end with `needs_input`, the findings in `summary`, and the decisions you need in `questions`.

## After the merge

- A new setting: upload its values now, from your worktree. For each environment it needs, `env-manager env set dev` (or `prod`), which downloads that environment's real values over your placeholders, set the value in the root `.env.local`, then `env-manager up`. Never `up` without that `env set` first: it would upload the schema defaults over the real values. Both commands make a local "chore: env manager update" commit; never push it, since teardown deletes the branch. A Worker secret then goes on the Worker with `bun scripts/secrets.ts push`, and if master's deploy already failed on `secrets verify`, `gh run rerun --failed <run>` then check `gh run view <run> --json status,conclusion` in foreground calls until `status` is `completed`. Report `merged` only once its `conclusion` is `success`; a failed deploy is `blocked` with the run link. A value only Stefan has (a key from a dashboard) is a `needs_input` instead.
- Clean up what you started: stop your servers by pid, close your `agent-device` session, shut your simulator down with `device_close`, and `trash` scratch files outside the worktree. Leave the worktree, the simulators it claimed, its data, and its branches: the orchestrator's teardown removes them.

## Scope and report

- Note bugs, weird interactions, bad UX, jank, or performance issues you find along the way as followups instead of fixing out-of-scope work. Report only real bugs and clearly useful gaps, not every edge case you can imagine. Dev-tooling friction (a slow command, a flaky tool, a manual step) is a followup with `"type": "tooling"` unless the fix is small enough to make in this PR.
- Don't message the orchestrator mid-job. If you need input, end with `needs_input`, and keep your worktree as it is.
- End with only this JSON:

```json
{"status": "merged" | "needs_input" | "blocked", "pr": "<url or null>", "branch": "...", "worktree": "<absolute path>", "tasks": {"done": ["<id>"], "not_done": [{"id": "...", "reason": "..."}]}, "summary": "<2-4 sentences: what changed, clients covered, verification>", "questions": "<for needs_input/blocked>", "followups": [{"title": "...", "description": "...", "type": "bug" | "feature" | "tooling", "relatedTaskId": "..."}]}
```
