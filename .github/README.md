# Continuous integration

`workflows/ci.yml` runs checks, tests, and builds on pull requests, default-branch pushes, and manual dispatches. The Bun tasks run on every change; each macOS task reports success from a Linux runner when its stack has no relevant changes. Manual dispatches and initial pushes run every configured task. Documentation changes are ignored; workflow changes run every task. Edit `scripts/changes.ts` when adding a new component or changing the layout. All CI helpers run with Bun, pinned by `.bun-version`.

Actions are pinned to commit SHAs. Dependabot checks for action updates weekly. A failure in change detection fails the task jobs too.

Bun tasks run the root `lint:ci`, `typecheck`, `test`, and `build` scripts, one job each, with a 5-minute timeout. Keep CI checks read-only. Tests pass until tests are added, and failures then fail CI. `.bun-version` and `packageManager` pin Bun to the version used during scaffolding; update them together. Commit `bun.lock` after changing dependencies. CI caches package downloads, then always installs with `--frozen-lockfile`.

Apps using env-manager never install or run it in CI. The committed readers (`env.ts`) and `app-ios/Config/check-env.sh` validate the environment. The workflow's top-level `env:` holds the schema defaults they require, because no per-target values file exists in CI: scripts that run from a subdirectory and xcodebuild read the process environment, and `Config/Base.xcconfig` includes the generated xcconfig files only when they exist. Keep defaults harmless and complete enough for CI. If a test needs a credential, supply it explicitly through GitHub Actions secrets. Never commit `.env.local` or native local secrets, and never cache environment outputs.

Builds compile the shared `App` Xcode scheme for a generic iOS simulator without signing. Tests run the scheme's testables on an available iPhone simulator. Native jobs use the macOS runner's installed Xcode and Swift, and cache only package dependencies with a key including both toolchain versions. `Package.resolved` is not tracked, so each run resolves the owner's own packages at their latest `master` commit ([iOS decisions](../docs/decisions/ios.md)).

Configure branch protection to require the generated task names you need. After renaming the default branch, update the workflow's push branch.
