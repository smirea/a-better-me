# Exercise motion

Generates a replayable 3D rep for an exercise from its instructions, with the muscles and tendons it loads and the flags a person watching would raise. Decisions and the model's limits are in [`docs/decisions/exercise-motion.md`](../docs/decisions/exercise-motion.md); read it first.

## Commands

- `bun run motion` (`scripts/build.ts`) generates every exercise, runs the validators, the instruction checks, and the fault tests, prints the evaluation, and writes `dist/exercise-motion.html` (the viewer, one self-contained file), `dist/<id>.json` (each baked rep), and `dist/evaluation.md`. It fails when a fault test goes uncaught.
- `scripts/review.ts [id]` prints only the flags and checks, in under a second. Use it while tuning a pose.
- `scripts/sheet.ts <id> out.png [side,front,top]` writes a grid of stills without a browser (needs `rsvg-convert`). Look at it after every change to a spec; numbers alone miss a pose that is valid and wrong.
- `scripts/shot.ts out.png "ex=0&frame=60&view=Side&tab=Review&play=0"` screenshots the viewer in headless Chrome. The hash also takes `mode`, `fault`, `load`, and `speed`.

## Adding an exercise

1. Read its instructions (`Instructions/<id>` in the catalog's Markdown pack) and its start and end frames in `app-ios/Assets/ExerciseImages/`.
2. Write `src/exercises/<name>.ts` and list it in `src/exercises/index.ts`. A spec gives: the contacts that hold all rep (planted feet, hands on the bar, back on the bench) as solver goals, the two key poses as rough joint-angle hints plus the condition that defines each (thighs parallel, bar on the chest), where the weight bears, what carries the body, and one form check per instruction that can be measured, quoting the instruction.
3. Hints only need to land in the right basin; the solver does the rest. A hint pose that starts inside the equipment or far from its contacts solves to nonsense, so print the hint pose's anchors when a key pose comes out wrong.
4. Add fault tests to `src/faults.ts` for the mistakes the instructions warn about.
5. Run the build, look at the sheet and the viewer, and fix every flag and failed check, or state in the reply why one stands.

## Conventions

- The figure stands on the floor (Y up) facing +Z, so its left is +X. Joint angles are anatomical and positive in the named direction on both sides (`body.ts`).
- A baked `Sequence` is plain JSON and needs no solver to replay or analyse. The viewer imports only the body, the muscle model, and the equipment shapes.
- Equipment the solver must avoid goes in `obstacles`; everything a person can touch goes in `contacts` with how deep it may press, or the clipping check flags it.
