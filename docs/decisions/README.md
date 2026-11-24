# Decisions

A Better Me's concepts, goals, paradigms, and high-level system decisions, one file per area. Read the areas your work touches before starting. When a change introduces or revises one of these, record it in the matching area file in the same PR as the work, or add a new file and list it here when no area fits. Replace stale entries instead of keeping history; git keeps the history.

- [Product goals](product.md): what A Better Me is and who it is for.
- [Stack](stack.md): tooling, client and server frameworks, and shared code.
- [Environment](environment.md): env-manager, the `dev` and `prod` environments, worktree overrides, and failing early on missing settings.
- [Workflow](workflow.md): threads, PRs, worktrees, git hooks, and which tests run where.
- [Workouts](workouts.md): milestone scope, the exercise catalog source, the workout domain model, and feature ownership.
- [Exercise motion](exercise-motion.md): the generator for 3D exercise animations, how a rep is solved from an exercise's instructions, the muscle and tendon model and its limits, the flags and the fault tests behind them, and what it defers.
- [iOS](ios.md): platform targets, SwiftData persistence, the design system, code layout, and verification.
- [Design language](design.md): priority order and high-level UI principles (comprehension and primary-task speed over minimalism, signal-to-noise copy with progressive disclosure, flat grouping with sibling-only separators, direct manipulation, purposeful color, tabular alignment, state persistence) and this app's patterns (surfaces, titles, toolbars, actions, stats, charts, bottom bars, and proportional verification).
- [Nutrition](nutrition.md): the MacroFactor half, its navigation shell, food data sources and photo logging, the domain model and the log's snapshot rule, nutrient ids and the registry, the one settings tree and writing food to Apple Health, what is computed instead of stored, the MacroFactor import, supplements, and what it defers.
- [Pings](pings.md): quick logs of events and qualia, their two kinds, the day's bottom-up timeline and its markers from meals, workouts, weigh-ins, and sleep, the drawer the tab bar turns into, rows that edit in place and move by a long-press drag, where pings are ordered, and their Dashboard cards.
- [Health data](health.md): the standing rule that every reading the owner's devices record lands in the database, the activities and sleep copied from Apple Health, and how sessions several apps recorded become one row.
- [Live workout surfaces](live-workout.md): the Apple Watch app, which runs workouts without the phone, the Live Activity, and Apple Health.
- [Widgets](widgets.md): the Home Screen and Lock Screen widgets, the Control Center control, the nutrition and steps snapshots in the app group, the step widgets' own Health and pedometer read and their refresh cadence, and quick action routing.
- [Sync](sync.md): offline first, the sync engine's one space, the shared SQLite schema and its validators, the owner token, the write rules, local servers, and the iOS client.
- [Pictures](images.md): picture bytes outside the database, the private bucket and its route, the phone's upload queue and cache, the sweep, and the one-time move of the old rows.
- [Agent API](agent-api.md): the REST and OpenAPI surface for automation, its entry point, and bot tokens.
- [Hosting](hosting.md): the Cloudflare Worker, the Durable Object space, the R2 backups, secrets, and the CI deploy.
- [Changelog](changelog.md): the per-PR entries under `changelog/`, how each gets the build it shipped in, the More > Changelog screen, and the check that makes every PR add one.
- [Observability](observability.md): the Sentry projects, where each runtime reports, and what counts as a warning or an error.
