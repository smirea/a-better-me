# Workflow

- **One PR per thread, never stacked.** Fold small same-area follow-ups into an open PR instead of starting a new thread.
- **Rebase only on a real conflict.** PR CI already tests the merge with `master`.
- **Every agent worktree is sandboxed by script.** `bun scripts/setup-worktree.ts [branch]` installs, gives the worktree its own ports, and writes offline env files. T3 Code runs it as the project's blocking setup script, so an agent starts in a ready worktree. `bun scripts/teardown-worktree.ts <worktree | branch>` stops its servers and removes the worktree and its branches from the main checkout once the PR is merged. Rules that a script can enforce live in the script, not in prompts.
- **PRs wait on one script.** `bun scripts/pr-ship.ts [--merge]` waits for CI, lists failing checks and unresolved review threads, reports a conflict with master, and merges when green. It exits before the 600-second tool limit with a code that names the next step, printed as its last line, so an agent reruns it instead of writing `sleep` loops.
- **Hooks run only what the change touches.** Pre-commit runs oxlint and oxfmt one after the other on staged files, since in parallel one overwrote the other's fix. `bun check` (Bun's TypeScript 7 checker, 3-4x faster than `tsc`) runs only when a script or JSON file is staged. Pre-commit and pre-push run `scripts/test-changed.ts`, which picks every test whose imports reach a changed file. It runs with `--no-env-file`, so it sees the same environment as CI.
- **Tests run in a pinned zone and never against a remote database.** `bunfig.toml` preloads `scripts/test-timezone.ts` and `scripts/test-guard.ts`.
- **Git hooks are never skipped.** A Claude Code hook in `.claude/settings.json` blocks `--no-verify` and lefthook overrides. A failing hook gets its cause fixed; a flaky test is a bad test.
- **Run only the relevant tests locally.** CI runs the full suite.
