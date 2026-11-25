# Exercise motion

Generates a replayable 3D rep for an exercise from its instructions, with the muscles and tendons it loads, canonical single-instance GLB equipment, anatomical hand grips and toe-break feet, and automated parametric + 3D GLB mesh validation. Architectural decisions are in [`docs/decisions/exercise-motion.md`](../docs/decisions/exercise-motion.md) and the catalog clustering map is in [`docs/machine-catalog.md`](docs/machine-catalog.md).

## Commands

- `bun run motion` (`scripts/build.ts`) builds the lazy-loaded library (`dist/library/`) and single-file viewers (`dist/exercise-motion.html`), running parametric, load, and 3D GLB BVH validators plus form checks. Pass `--library-only` for fast incremental viewer rebuilds.
- `bun run motion:serve` (`scripts/serve.ts`) serves the live library viewer at `http://localhost:6162/` on a pure white stage (`studio-light`) with live skin swapping and 3s auto-reload.
- `bun exercise-motion/scripts/batch-qa.ts <slug>... [--out /tmp/motion-inspect/qa.png]` validates specs (motion + load + real 3D GLB BVH collision + form checks) and writes a fast 2D QA mosaic.
- `bun exercise-motion/scripts/render-3d.ts <slug> --closeups [--out /tmp/motion-inspect/3d-<slug>.png] [--skin studio-graphite]` renders real Three.js WebGL multi-view stills plus hand-grip and foot-contact close-ups on a pure `#ffffff` white stage. **Always inspect the 3D render + close-ups visually.**
- `bun exercise-motion/scripts/verify-machines.ts` validates all 42 canonical GLBs (`models/machines/*.glb`), semantic materials, bounds, anchors, and all 21 machine factories + props.
- `blender -b --factory-startup -P exercise-motion/scripts/machines/build_machines.py` deterministically rebuilds all 42 canonical GLBs and `src/machines/anchors.json` in ~1 s.
- `scripts/figure-asset.ts` rebuilds `viewer/assets/lifter.bin` and `muscle-map.png` offline from MakeHuman's CC0 assets (~20 s). Run after changing body joints or the body map.

## Authoring an exercise (Canonical Scene Composition)

**Never duplicate or hand-edit GLB files per exercise.** Every exercise selects shared canonical machine(s) and prop(s) from `src/machines/` and wires them via `composeExercise()` (`src/scene.ts`):

1. **Read the exercise brief & reference frames** (`app-ios/Assets/ExerciseImages/`). Confirm exact start/peak posture, grip style, foot contact, range of motion, and every form cue.
2. **Pick canonical equipment from `src/machines/`:**
   - Machines (`src/machines/index.ts`): e.g. `adjustableBenchMachine({ backAngleDeg: 45 })`, `powerRackMachine({ hookY, safetyY })`, `latPulldownMachine({ bar: ... })`, `dualAdjustablePulleyMachine({ pulleyY, handles: ... })`, `legPress45Machine({ sledTravel, drive: ... })`. Pass `pos` / `yawDeg` to place them; pass `drive` when a sled, carriage, lever arm, pulley swivel, or weight stack animates during the rep.
   - Props (`src/machines/free-weights.ts`): `loadedBarbell("bar", kg)`, `loadedEzBar("bar", kg)`, `dumbbellProp("db")`, `kettlebellProp("kb")`, `cableAttachment("bar", "prop-lat-bar" | "prop-d-handle" | "prop-v-bar" | "prop-rope")`, `medicineBallProp`, `stabilityBallProp`, `abWheelProp`. Draw a cable with `cableTether(id, machine, pulleyKey, attachmentProp, props)`: list its `def` in `tethers` and return its `state` row from `tetherState`. It runs from the swivelled outlet to the attachment eye, and QA holds a cable's end to what it says it is clipped to.
   - Use the machine's exported anchors (`machine.surfaces`, `machine.footplates`, `machine.handles`, `machine.pulleys`, `machine.rails`, `machine.pivots`, `machine.hooks`) instead of hardcoding magic coordinates!
3. **Wire the body with anatomical foot & hand primitives (`src/solver.ts`, `src/postures.ts`):**
   - **Feet:** `plantFootFlat` / `plantBothFeet` / `plantBothFeetOnPlate` (flat sole on floor or tilted footplate), `plantFootOnToeBreak` / `plantBothToes` (metatarsal toe-break with raised heel — push-ups, planks, lunges, split squats), `plantFootOnEdge` (calf raises on a step edge). For toe-break contacts in `required`, check `forefoot_L/R` (or `toe_L/R`), not `ballIn_L/R`.
   - **Hands:** declare what each hand holds as a grasp (`src/grasp.ts`) and list them in `grasps`; never set `grips` for a hand that holds something. `machine.grasp(side, key)` for a machine handle (live when the handle's node is driven), `graspProp(side, propId, propHandles(glbId).grip)` for a prop. Hold machine handles with `holdGrasp(body, grasp, ctx.live, { style })`; seat hand-carried props with `propState: (frame) => props.map((p) => carryProp(body, frame, p, grasps))` (add `keepGraspSpan` for two handles on one prop). A prop carried by the body (a squat bar on the traps) is placed from the body and the hands `holdGrasp` it through `ctx.live`. Free hands: `braceHandOnSurface` / `palmOnFloor` / `braceBothHands` with `grips: "flat-floor"`.
   - **Moving footplates/pads:** pass `carried(machine.carrier("sled")!, ctx.live)` as the `carry` argument of `plantFootFlat` / `plantBothFeetOnPlate`; the targets come from the machine's static anchors and ride with the node. `machine.atFrame(frame, extras, props)` gives the driven machine for anything else that moves (pulley outlets for tethers).
4. **Hints, key goals, loads, contacts & checks:**
   - Start from `POSTURE_HINTS` (`src/postures.ts`) so hints land in the right solver basin (note: `standing` has `root.y = 0.947`, `pronePlank` sets `toes.ext = 60`).
   - Add `required` contacts for every grounded foot and pad contact (hands are covered by their grasps). On a driven machine, name the part (`part: "leg-press-45.footplate"`): it tracks the moving node every frame, and sliding is measured across the part itself.
   - Add one `FormCheck` per measurable instruction cue, quoting the catalog instruction.
5. **Verify numerically AND visually:**
   - Run `bun exercise-motion/scripts/batch-qa.ts <slug>` — must pass with **0 errors**, **0 GLB/cable clips**, and **100% form checks passing**.
   - Run `bun exercise-motion/scripts/render-3d.ts <slug> --closeups` and inspect BOTH full views and hand/foot close-ups against the reference frames. Fix any floating/clipping hands, unnatural thumb/wrist twist, heel lift, or misaligned equipment before finishing.

## Conventions

- The figure stands on the floor (`y = 0`, Y up) facing `+Z`, so its left is `+X`. Joint angles are anatomical and positive in the named direction on both sides (`body.ts`).
- Every canonical machine uses exclusively the 10 `SEMANTIC_MATERIALS` (`src/contracts.ts`) so runtime skinning (`src/skin.ts`) works without editing meshes.
- `composeExercise()` automatically merges machine GLBs, articulated `glbState`, moving hidden collider props for animated nodes, static colliders, and default pad/grip/foot contact allowances.
- Never silence a real collision by inflating contact allowances past soft-tissue compression (~3–4 cm for pads, ~2 cm for grips/feet) — fix the pose or placement instead.
