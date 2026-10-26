# Decisions

A Better Me's concepts, goals, paradigms, and high-level system decisions, one file per area. Read the areas your work touches before starting. When a change introduces or revises one of these, record it in the matching area file in the same PR as the work, or add a new file and list it here when no area fits. Replace stale entries instead of keeping history; git keeps the history.

- [Product goals](product.md): what A Better Me is and who it is for.
- [Stack](stack.md): tooling, client and server frameworks, and shared code.
- [Environment](environment.md): env-manager, the `dev` and `prod` environments, worktree overrides, and failing early on missing settings.
- [Workflow](workflow.md): threads, PRs, worktrees, git hooks, and which tests run where.
- [Workouts](workouts.md): milestone scope, the exercise catalog source, the workout domain model, and feature ownership.
- [iOS](ios.md): platform targets, SwiftData persistence, the design system, code layout, and verification.
- [Nutrition](nutrition.md): the MacroFactor half, its navigation shell, food data sources, the domain model and the log's snapshot rule, nutrient ids and the registry, the one settings tree and writing food to Apple Health, what is computed instead of stored, the MacroFactor import, and what it defers.
- [Live workout surfaces](live-workout.md): the Apple Watch app, which runs workouts without the phone, the Live Activity, and Apple Health.
- [Sync](sync.md): offline first, the sync engine's one space, the shared SQLite schema and its validators, the owner token, the write rules, local servers, and the iOS client.
- [Agent API](agent-api.md): the REST and OpenAPI surface for automation, its entry point, and bot tokens.
- [Hosting](hosting.md): the Cloudflare Worker, the Durable Object space, the R2 backups, secrets, and the CI deploy.
- [Observability](observability.md): the Sentry projects, where each runtime reports, and what counts as a warning or an error.
