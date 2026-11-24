# Exercise Authoring Guide

Read this before writing or editing any file in `exercise-motion/src/exercises/`.

## Goal

Every exercise file `exercise-motion/src/exercises/<slug>.ts` exports `export const spec: ExerciseSpec = ...` so the solver produces a natural, biomechanically accurate, collision-free looping 3D rep on the right equipment, passing **every** validator (`0` errors) and **every** catalog-quoted form check.

## Coordinate system & body conventions (`src/body.ts`)

- **World axes:** Y up (`y = 0` is the floor), figure faces `+Z`, figure's left is `+X`, figure's right is `-X`.
- **Root DOFs (`hints`):**
  - `root.x`, `root.y`, `root.z` in metres (`root.y` defaults to `0.943` standing hip height).
  - `root.pitch` (deg, `+` leans forward, `-80` to `-90` supine/lying face-up, `+80` to `+90` prone/face-down), `root.yaw` (deg, `+` turns left), `root.roll` (deg, `+` tilts right ear down / side-lying).
- **Anatomical joint angle hints (degrees, positive = named motion on both sides; omit `_L`/`_R` to set both sides):**
  - `hip.flex` (`-20..125`, `+` thigh lifts forward), `hip.abd` (`-25..45`, `+` thigh moves outward), `hip.rot` (`-35..45`, `+` external rotation / toes out)
  - `knee.flex` (`0..150`), `ankle.dorsi` (`-45..35`, `+` toes pull toward shin), `ankle.inv` (`-20..30`)
  - `lumbar.flex` (`-25..50`, `+` rounds forward, `-` arches), `lumbar.bend` (`-25..25`), `lumbar.twist` (`-10..10`)
  - `thoracic.flex` (`-20..35`), `thoracic.bend` (`-25..25`), `thoracic.twist` (`-35..35`)
  - `neck.flex` (`-60..50`, `+` chin down), `neck.bend` (`-40..40`), `neck.twist` (`-75..75`)
  - `clavicle.prot` (`-28..25`, `-` scapulae retracted / proud chest), `clavicle.elev` (`-10..35`, `+` shrug)
  - `shoulder.elev` (`0..180`, angle away from hanging straight down), `shoulder.plane` (`-180..180`, `0` = out to side, `90` = straight forward, `-90` = straight behind), `shoulder.twist` (`-100..100`, `+` internal rotation)
  - `elbow.flex` (`0..150`), `forearm.pron` (`-85..85`, `+` pronated/overhand, `0` = neutral, `-` supinated/underhand)
  - `wrist.flex` (`-70..80`, `-` extended), `wrist.dev` (`-30..20`)

## Available body anchors (`body.anchors`)

- Trunk / Head: `traps`, `upperBack`, `sternum`, `chestFront`, `belly`, `sacrum`, `pelvisBottom`, `pelvisFront`, `occiput`, `mouth`, `forehead`, `headTop`, `headSide_L/R`, `frontRack_L/R`, `shoulderTop_L/R`
- Arms (`_L` / `_R`): `grip_L/R` (middle of closed fist, best for hanging/pulling/dumbbells/cables), `press_L/R` (heel of palm, best for pressing bars/handles), `palmFlat_L/R` (flat palm on floor/bench), `elbowTip_L/R`, `forearmMid_L/R`, `upperArmBack_L/R`
- Legs (`_L` / `_R`): `thighBack_L/R`, `thighFront_L/R`, `thighOuter_L/R`, `thighInner_L/R`, `kneeFront_L/R`, `kneeBack_L/R`, `shinFront_L/R`, `shinBack_L/R`, `ankleCuff_L/R`, `heel_L/R`, `ballIn_L/R`, `ballOut_L/R`, `toe_L/R`, `secondToe_L/R`

## Equipment, postures & check helpers (`src/equipment.ts`, `src/equipment-library.ts`, `src/postures.ts`)

Always match the exercise's primary resistance and support equipment accurately:
- **Benches & Pads:** `flatBench`, `adjustableBench({ backAngleDeg, seatY, seatTiltDeg, ankleRollers })` (returns `{ parts, seat, back }` + use `pointOnPad(surface, along, sink)`!), `preacherBench`, `romanChair`, `ghdBench`, `splitSquatStand`, `platformBox`, `exerciseMat`, `stabilityBall`.
- **Racks & Bodyweight Stations:** `powerRack`, `benchRack`, `smithMachine`, `pullUpStation`, `dipStation`, `landmineBase`, `gymRingProp`, `abWheelProp`, `prowlerSledProp`.
- **Cables & Bands:** `cableColumn`, `cableCrossover`, `latPulldownMachine`, `seatedRowMachine`, `cableAttachmentProp(id, style)` + `tethers` & `tetherState` to draw live taut cables or elastic bands every frame!
- **Strength & Cardio Machines:** `seatedMachineFrame`, `legPressFrame`, `legExtensionMachine`, `lyingLegCurlMachine`, `hackSquatMachine`, `calfRaiseStation`, `machineHandleProp`, `rollerPadProp`, `legPressSledProp`, `cardioMachine`, or custom `PropDef` `{ id, kind: "parts", parts: [...] }` so every moving lever arm, sled, or roller tracks the lifter smoothly every frame!
- **Free weights & Bars:** `olympicBar`, `ezBar`, `trapBar`, `safetySquatBar`, `axleBar`, `{ id, kind: "dumbbell" }`, `{ id, kind: "kettlebell" }`, `{ id, kind: "plate" }`, `{ id, kind: "medball" }`.
- **Posture & check helpers (`src/postures.ts`):** `PAD_RESTING`, `plantBothFeet`, `plantBothToes`, `sitOnSeat`, `restBackOnPad`, `alignBarWrists`, `checkFlatBack`, `checkNeutralNeck`, `checkJointRange`, `checkJointWithinAt`, `checkAnchorTravel`, `checkFeetPlanted`.

## Biomechanics: `support` & `loads`

- `support.kind`:
  - `"standing"` — bipedal or single-leg standing (set `support.feet: ["L"]` for single-leg standing; `rail: true` for Smith machine / fixed track).
  - `"seated"` — seated on bench or machine (list joints carried by seat/backrest in `support.passive`, e.g. `["hip", "knee", "ankle"]` or also `["lumbar", "thoracic", "neck"]` when back-supported!).
  - `"lying"` — supine or prone on bench/floor (put supported trunk/leg joints in `support.passive`).
  - `"hanging"` — pull-ups, chin-ups, hanging leg raises.
  - `"supported"` — push-ups, dips, planks, quadruped, hip thrust, GHD, Roman chair.
- `loads`:
  - Free weights: omit `pulley`/`direction` (gravity acts downward `[0, -1, 0]`).
  - Cables & bands: set `pulley: [x, y, z]` to the exact pulley/anchor world coordinate so tension pulls directly toward the pulley every frame!
  - Horizontal/angled machines or assistance: set `direction: [dx, dy, dz]` (unit vector of external force ON the lifter's body — e.g. opposite the push direction for a chest press `[0, 0, -1]`, or upward `[0, 1, 0]` for an assisted pull-up/dip!).
- `laterality`: set `"bilateral"`, `"unilateral"`, `"alternating"`, or `"asymmetrical"` matching the catalog! Bilateral specs should include `mirrored(body, 4)`.
- `grip`: `"hang"` (dumbbells, cables, pulling, deadlifts), `"press"` (barbell/machine pressing, squats), or `"open"` (push-ups, planks, flat-hand support).
- **Contacts & obstacles**:
  - Put benches/pads/seats the solver must not penetrate into `obstacles` with realistic `allow` depths (0.015–0.035 m for resting pads), AND repeat matching prefixes in `contacts` so `validateMotion` allows intended contact while still catching clipping!
  - Every `required` contact uses `surfaceY` (horizontal floor/flat bench), `part` (any named static `Part`, like `"bench.backPad"` or `"lat.seatPad"`), or `prop` (any moving prop handle/bar/roller). Set `allowSlide: true` only when an anchor intentionally rolls/slides.
- **Multi-phase / Alternating / Isometric**:
  - Standard reps use `hints: { start, end }`, `keyGoals: { start, end }`, `progress`, `tempo`, and optional `phaseLabels` (e.g. `["Curl", "Peak", "Lower", "Pause"]` for concentric-first lifts!).
  - Alternating or multi-stage lifts can use `waypoints: [...]` + `loopMode: "cycle" | "pingpong"`.
  - Isometric holds set `isometric: true`.

## Mandatory verification loop

1. Read the exercise brief and inspect all provided reference PNG images. If instructions or images are missing or unclear, double-check standard form online.
2. Implement `exercise-motion/src/exercises/<slug>.ts` exporting `export const spec: ExerciseSpec = ...` (do NOT edit `src/exercises/index.ts`).
3. Run:
   ```bash
   bun exercise-motion/scripts/inspect-exercise.ts <slug>
   ```
4. **Visually inspect** the generated PNG contact sheet (`/tmp/motion-inspect/<slug>-compare.png` or `-sheet.png`) using your image reader tool! Compare against the reference photos:
   - Is the equipment right and properly scaled?
   - Is the character seated/lying/standing naturally on the equipment (no floating, no sinking, no clipping, no backward elbows/knees)?
   - Does the motion match the instructions and look natural through all 5 frames (side, front, angle)?
   - Do the top engaged muscles match the exercise's primary/secondary muscles?
5. Fix EVERY error flag, EVERY failed check, and EVERY visual defect until `inspect-exercise.ts` exits `0` AND the contact sheet looks genuinely natural.
6. Run `bun check && bunx oxlint exercise-motion/src/exercises/<slug>.ts`, clean up temporary files outside `/tmp`, and commit cleanly on your worktree branch.
