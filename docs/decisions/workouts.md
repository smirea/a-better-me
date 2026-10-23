# Workouts

The Workouts half re-creates MacroFactor Workouts (MF Workouts) on iOS. The reference app's behavior is captured in [`docs/research/mf-workouts/`](../research/mf-workouts/README.md). Read that spec and its screenshots before building a screen. Implementation agents can't drive the reference app themselves, because only one agent can control its window at a time.

## Milestone 1 scope

- **Exercise catalog.** Every exercise from MF Workouts' "add exercise" list, with name, muscles, equipment, instructions, and the start and end position frames where the app has them.
- **Creating workouts.** Building reusable workouts (templates) from catalog exercises, with sets, set types, supersets, rest times, and notes, laid out like the reference.
- **Tracking workouts.** Running a workout live: logging sets, rest timer, finishing, the summary, and history.
- **Levels.** The Levels tab, computed on-device from logged history.
- Dashboard widgets, programs, gym profiles, and integrations wait until milestone 1 lands, unless research shows a feature is load-bearing for the four above.

## Exercise catalog source

- **The catalog is extracted from the installed app, not typed by hand.** MF Workouts bundles per-exercise instruction Markdown (`flutter_assets/assets/markdown/<id>.md`, about 1,490 files) and two poster frames for the exercises that have a video (`flutter_assets/assets/exercises/<id>_{a,b,c}.webp`, 621 exercises). Names, muscles, and equipment are compiled into the Dart AOT snapshot without a readable structure. They are scraped from the running app's accessibility tree, and each exercise is joined to its bundled ID by matching its on-screen instructions against the Markdown files.
- **The extraction script lives in the repo** (`app-ios/scripts/catalog/`), so the catalog can be regenerated when MF Workouts adds exercises. Its output is a checked-in JSON file plus the copied images, bundled into the app.
- **Videos are dropped.** MF Workouts streams them from Firebase Storage (`sbs-diet-app.appspot.com`, `videos/`), which enforces Firebase App Check. Unauthenticated requests fail with `401 Firebase App Check token is invalid`, and getting a valid token would mean attesting as the real app. The bundled poster frames are the start and end positions of each video. The exercise detail page shows them in place of the video. The app's sandbox cache might hold played videos, but it is closed to tools without Full Disk Access, so that path waits until it is worth the setup.
- **The Dart snapshot is not decompiled.** The binary is built with Dart 3.13. Public snapshot parsers (blutter and similar) lag behind that version, and the accessibility scrape gets the same data with far less risk.

## Domain model

- **Catalog exercises are read-only bundle data. Everything the owner creates is persisted.** The catalog JSON loads into memory at launch. Workouts, sessions, and custom exercises live in SwiftData and refer to catalog exercises by their MF ID string, so a regenerated catalog never orphans history.
- **A workout and a session share one shape.** A template is an ordered list of blocks. A block is one exercise, or several exercises run as a superset. Each exercise holds ordered sets with a set type and targets. A session copies a template's blocks and records what was actually lifted against each set. Logged sets are history and are never rewritten by later template edits.
- **Weights are stored in kilograms.** Display units come from settings, the way the reference app does it.
- Field-level detail lives in the code (`app-ios/Sources/App/Workouts/Model/`) and is mirrored in the research spec's "Data model implied" section. Do not copy it here.

## Feature ownership

Milestone 1 is split so that parallel agents never edit the same files.

- **Coordinator (groundwork, merged first).** The app shell and tab bar, the design system (`Sources/App/DesignSystem/`), the domain model and persistence (`Sources/App/Workouts/Model/`), the catalog loader, and the catalog data. Shared types change only through the coordinator, or through a worker PR that says so in its description.
- **Exercise library.** `Sources/App/Workouts/Library/`: browsing, search, filters, the exercise detail page, and the exercise picker that the builder and the live session present.
- **Workout builder.** `Sources/App/Workouts/Builder/`: creating and editing templates, and the "+" flow that starts from one.
- **Live session and history.** `Sources/App/Workouts/Session/` and `Sources/App/Workouts/History/`: running a workout, the rest timer, finishing, the summary, and past sessions.
- **Levels.** `Sources/App/Workouts/Levels/`: the Levels tab and its computations, read-only over history.
