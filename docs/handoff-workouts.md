# Handoff: Workouts milestone coordinator

Temporary. Delete this file in the PR that merges the groundwork.

The owner's request: re-create MacroFactor Workouts on iOS (creating workouts, tracking workouts, Levels, the full exercise catalog with videos where possible). The coordinator does the groundwork, then launches T3 worker threads with disjoint ownership. Read [`decisions/product.md`](decisions/product.md), [`decisions/workouts.md`](decisions/workouts.md), [`decisions/ios.md`](decisions/ios.md), and [`decisions/workflow.md`](decisions/workflow.md) first. Owner preferences from the session: work fully autonomously, bundle analysis before UI scraping, Pareto (drop costly items with a written reason), newest iOS only, Liquid Glass and native components over custom ones.

## Done (branch `workouts-groundwork`, pushed, no PR yet)

- Decision docs, committed before any code.
- iPhone-only iOS 27 target, Swift package and macOS removed, CI checks with a simulator build on `macos-26` plus Xcode 27 (unverified on GitHub until the PR runs).
- Native Liquid Glass `TabView` in `RootView.swift`: "+" is a `.prominent` tab that opens `NewWorkoutSheet`, and `ActiveSessionBar` is the bottom accessory while a session has `endedAt == nil`.
- Design tokens and static font cuts (`DesignSystem/`, `scripts/make-fonts.py`), titles via `screenTitle(_:)`.
- Domain model in `Workouts/Model/`: `WorkoutTemplate` and `WorkoutSession` share a JSON-stored `[WorkoutBlock]` tree, plus `CustomExercise`, `ExerciseCatalog`, `ExerciseImage`, `WeightUnit`, and `SampleData` (`-seedSampleData`).
- Full catalog from `app_file.json` via `scripts/catalog.ts` (1,345 exercises, equipment, articles, instructions, frames). Videos dropped (App Check).
- `scripts/sim` drives a simulator through Device Hub with a mouse lock. It is the fallback now that T3 device tools are back on.
- Placeholder roots that workers replace: `Dashboard/DashboardTab`, `Builder/WorkoutTab`, `Builder/NewWorkoutSheet`, `Session/ActiveSessionBar`, `Levels/LevelsTab`, `Library/ExerciseLibraryView`.

## In flight

- A research subagent explored the MF Workouts UI and was asked to write `docs/research/mf-workouts/README.md` from its screenshots in `screens/` (uncommitted when this note was written). If README.md is missing or has a "Not yet explored" section, launch one research agent to finish it before the workers start. Use `/tmp/mfw-tools/ax` and `/tmp/mfw-tools/shot` (Runner window capture), rebuilding from `ax.swift` if `/tmp` was cleared. Only one agent may drive the Runner app at a time.

## Next steps

1. Read the research spec. Adjust `Workouts/Model/` to what it shows (set types, targets, rest, superset behavior, progression, Levels inputs), and fold durable findings into `decisions/workouts.md`, including final ownership per worker (whether the builder and the live session share one exercise editor, who owns history).
2. Commit the research and model changes, open the PR, run `bun scripts/pr-ship.ts --merge`, and delete this file in that PR.
3. Confirm T3 device tools work (`device_list`). Then launch four worker threads with `t3_thread_launch`, `workspaceStrategy: {type: "worktree", baseRef: "master", startFromOrigin: true}`: Exercise library and picker, Workout builder, Live session and history, Levels. Each brief names its owned folders, the research sections and screenshots to copy, the shared model files it must not change without saying so in its PR, and the verification bar (simulator build, drive the screen with T3 device tools or `scripts/sim`, look at a screenshot, `-seedSampleData` for history).
4. Integrate: review each PR, resolve overlaps in shared files, and drive the merged app end to end.
