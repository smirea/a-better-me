# Workouts

The Workouts half re-creates MacroFactor Workouts (MF Workouts) on iOS. The reference app's behavior is captured in [`docs/research/mf-workouts/`](../research/mf-workouts/README.md). Read that spec and its screenshots before building a screen. Implementation agents can't drive the reference app themselves, because only one agent can control its window at a time.

## Milestone 1 scope

- **Exercise catalog.** Every exercise from MF Workouts' "add exercise" list, with name, muscles, equipment, instructions, and the start and end position frames where the app has them.
- **Creating workouts.** Building reusable workouts (templates) from catalog exercises, with sets, set types, supersets, rest times, and notes, laid out like the reference.
- **Tracking workouts.** Running a workout live: logging sets, rest timer, finishing, the summary, and history.
- **Levels.** The Levels tab, computed on-device from logged history.
- Dashboard widgets, programs, gym profiles, and integrations wait until milestone 1 lands, unless research shows a feature is load-bearing for the four above.

## Exercise catalog source

- **The catalog is the reference app's own export.** MF Workouts bundles its full exercise database as `flutter_assets/packages/macrofactor/assets/import/app_file.json`: 1,345 exercises with alternative names, compound or isolation type, the 23 feature muscle groups, anatomical muscles, movement patterns, laterality, tracking metrics, equipment options, and linked articles, plus a `uuidIndex` that names every referenced entity. Next to it sit the instruction Markdown (`assets/markdown/<id>.md`, 1,213 exercises plus 277 articles), two or three poster frames for 619 exercises (`assets/exercises/<id>_{a,b,c}.webp`), and equipment photos (`assets/equipment/<id>.png`).
- **`app-ios/scripts/catalog.ts` regenerates it.** It reads the installed app and writes `Sources/App/Resources/Catalog/`: `exercises.json`, `equipment.json`, `articles.json`, per-exercise `Instructions/` and `Articles/` Markdown with Notion links reduced to their text, the exercise frames as-is, and equipment photos shrunk to 240px WebP (the originals total 81 MB). The script fails on any reference it can't resolve. Rerun it when MF Workouts updates and commit the result.
- **Prefer the bundle to the UI.** Data and assets come from analyzing the app bundle wherever possible. Driving the reference app is for behavior and layout only, because a scrape is slower and less complete than the data the app ships.
- **Videos are dropped.** MF Workouts streams them from Firebase Storage (`sbs-diet-app.appspot.com`, `videos/`), which enforces Firebase App Check. Unauthenticated requests fail with `401 Firebase App Check token is invalid`, and a valid token means attesting as the real app. The bundled poster frames are each video's start and end positions, and the exercise detail page shows them instead. The app's sandbox cache might hold videos it has played, but it is closed to tools without Full Disk Access, so that path waits until it is worth the setup.

## Domain model

- **Catalog exercises are read-only bundle data. Everything the owner creates is persisted.** The catalog JSON loads into memory at launch and Markdown loads on demand. Workouts, sessions, and custom exercises live in SwiftData and refer to catalog exercises by their MF ID string, so a regenerated catalog never orphans history.
- **A workout and a session share one shape.** A template is an ordered list of blocks. A block is one exercise, or several exercises run as a superset. Each exercise holds ordered sets with a set type and targets. A session copies a template's blocks and records what was actually lifted against each set. Logged sets are history and are never rewritten by later template edits.
- **Exercises record what MF records.** An exercise's `metrics` list (weight, assistance weight, reps, duration, distance, each optionally per side) decides which fields a set row shows and logs, instead of a coarser exercise kind.
- **Weights are stored in kilograms.** Display units come from settings, the way the reference app does it.
- Field-level detail lives in the code (`app-ios/Sources/App/Workouts/Model/`) and is mirrored in the research spec's "Data model implied" section. Do not copy it here.

## Feature ownership

Milestone 1 is split so that parallel agents never edit the same files.

- **Coordinator (groundwork, merged first).** The app shell and tab bar, the design system (`Sources/App/DesignSystem/`), the domain model and persistence (`Sources/App/Workouts/Model/`), the catalog loader, and the catalog data. Shared types change only through the coordinator, or through a worker PR that says so in its description.
- **Exercise library.** `Sources/App/Workouts/Library/`: browsing, search, filters, the exercise detail page, and the exercise picker that the builder and the live session present.
- **Workout builder.** `Sources/App/Workouts/Builder/`: creating and editing templates, and the "+" flow that starts from one.
- **Live session and history.** `Sources/App/Workouts/Session/` and `Sources/App/Workouts/History/`: running a workout, the rest timer, finishing, the summary, and past sessions.
- **Levels.** `Sources/App/Workouts/Levels/`: the Levels tab and its computations, read-only over history.
