# Exercise Authoring Guide

Read this before writing or editing any file in `exercise-motion/src/exercises/`.

## Goal

Every exercise file `exercise-motion/src/exercises/<slug>.ts` exports `export const spec: ExerciseSpec = ...` so the solver produces a natural, biomechanically accurate, collision-free looping 3D rep on the right equipment, passing **every** validator (`0` errors) and **every** catalog-quoted form check.

## Fast Path: `buildExerciseSpec` (`src/builders.ts`)

Use `buildExerciseSpec(config)` from `../builders` for almost all exercises (you may also write a raw `ExerciseSpec` if an exercise needs bespoke solver mechanics). `buildExerciseSpec` handles feet planting, benches/seats/backrests, obstacles/contacts, props, live cables/bands, standing balance, bilateral mirroring, unilateral/alternating loops, and smooth non-jerky arcs — so each exercise file stays concise (~50–110 lines) while being **100% tailored** to that exercise's exact equipment, grip, stance, angles, load, and catalog-quoted form checks.

```ts
import { buildExerciseSpec, POSTURE_HINTS, holdElbowNearShoulder } from "../builders";
import { checkFlatBack, checkJointRange } from "../postures";

export const spec = buildExerciseSpec({
  id: "standing-dumbbell-biceps-curl",
  catalogId: "...",
  name: "Standing Dumbbell Biceps Curl",
  defaultLoadKg: 14,
  loadUnit: "perSide",
  laterality: "bilateral", // or "unilateral" (with activeSide: "L"), "alternating", "asymmetrical"
  grip: "hang",            // "hang" | "press" | "open"
  phaseLabels: ["Curl", "Peak", "Lower", "Rest"],
  station: { kind: "standing", stanceX: 0.14 },
  apparatus: { kind: "dumbbells" },
  hints: {
    start: { ...POSTURE_HINTS.standing, "shoulder.elev": 8, "elbow.flex": 8, "forearm.pron": -75 },
    end:   { ...POSTURE_HINTS.standing, "shoulder.elev": 14, "shoulder.plane": 75, "elbow.flex": 134, "forearm.pron": -82 },
  },
  extraGoals: (body) => [
    holdElbowNearShoulder(body, "L", [0.03, -0.29, 0.02], 14, "xz"),
    holdElbowNearShoulder(body, "R", [0.03, -0.29, 0.02], 14, "xz"),
  ],
  checks: (body) => [
    checkFlatBack("Keep your torso upright without swinging your lower back."),
    checkJointRange("elbow-rom", "Full elbow flexion curl", "Curl the dumbbells up toward your shoulders.", "elbow_L.flex", 95),
  ],
});
```

### Supported `station` kinds (`src/builders.ts`)
- `"standing"` — `stanceX`, `heelZ`, `toeOutDeg`, `surfaceY`, `split` (lunge/split squat/Bulgarian with `"flat" | "toe" | "elevated-stand" | "elevated-bench"`), `singleFoot`, `box`, `rack`, `smith`, `trackKnees`, `balanceZ`, `torsoLeanDeg`
- `"seated"` — `seatY` (default `0.43` for flat feet on floor!), `seatZ`, `leanDeg`, `frame`: `"flat-bench"` | `"adjustable-bench"` (`backAngleDeg`) | `"machine"` (`backAngleDeg` or `chestPadZ`) | `"lat-pulldown"` | `"seated-row"` | `"preacher"` | `"leg-extension"` | `"box"`, `feetMode` (`"floor" | "footplate" | "hanging"`)
- `"lying"` — `surface`: `"flat-bench" | "adjustable-bench" | "floor" | "stability-ball" | "lying-leg-curl"`, `face`: `"up" | "down" | "side"`, `backAngleDeg`, `rack`, `smith`, `ankleRollers`, `feetOnFloor`
- `"kneeling"` — `halfKneelingSide?`, `leanDeg?`
- `"hanging"` (pull-up bar) | `"dip"` (parallel bars) | `"pushup"` (floor/incline/decline/knees/forearms plank)
- `"leg-press"` | `"hack-squat"` | `"roman-chair"` | `"ghd"` | `"hip-thrust"` | `"calf-station"` | `"cardio"`

### Supported `apparatus` kinds (`src/builders.ts`)
- `"none"` — bodyweight; pass `bodyweightLoads: [{ anchor: "grip_L", bodyweightShare: 0.5, share: 0.5, grip: "hang", direction: [0, 1, 0] }, ...]` on closed-chain upper-body lifts (pull-ups, dips, push-ups, planks) so bodyweight loads the arms/trunk accurately! (Use negative `share: -0.5` on assisted pull-up/dip machines!)
- `"barbell"` — `style`: `"straight" | "ez" | "trap" | "ssb" | "axle" | "cambered"`, `gripX`, `anchor` (`"grip" | "press"`), optional `restAnchor` (`"traps"`, `"pelvisFront"`), optional `path: { startY, startZ, endY, endZ, arcBulgeZ? }`
- `"dumbbells"` | `"kettlebells"` | `"plate"` | `"medball"` — supports `sides`, `twoHandsOnOne`, `fatGrip`, optional `handPath`
- `"cable-single"` — `pulley: [x, y, z]`, `attachment`: `"d-handle" | "straight-bar" | "lat-bar" | "v-bar" | "rope" | "ankle-cuff"`, `twoHandsOnOne`, `skipColumn` (when using `lat-pulldown` / `seated-row` station), optional `handPath` or `anchor` (e.g. `"ankleCuff_L"`)
- `"cable-dual"` — cable crossover (`pulleyY`, `halfWidth`, `z`, `attachment`, `anchor`)
- `"band"` — elastic band tether from `anchors: Vec3[]` to `targetAnchors`
- `"machine-handles"` — moving machine handles (`orientation: "horizontal" | "neutral"`, `forceDir: Vec3`, optional `handPath`)
- `"roller-pad"` — moving machine roller tracking `trackAnchors` (`["shinFront_L", "shinFront_R"]`, `["shinBack_L", "shinBack_R"]`, `["thighOuter_L", "thighOuter_R"]`, etc.) with `pulley` or `forceDir`!
- `"landmine"` | `"ab-wheel"` | `"rings"` | `"prowler-sled"` | `"leg-press-sled"`

### Unilateral & Alternating helpers
- `sidedHints("L", activeArmHints, restArmHints, sharedTrunkHints)` — sets working side `_L` and resting side `_R` cleanly.
- Set `laterality: "alternating"` and write `hints.end` for the LEFT peak — `buildExerciseSpec` automatically mirrors it into a smooth 4-waypoint `start -> leftPeak -> start -> rightPeak` cycle!

## Coordinate system & body conventions (`src/body.ts`)

- **World axes:** Y up (`y = 0` is floor), figure faces `+Z`, figure's left is `+X`, figure's right is `-X`.
- **1.78 m body geometry:** `root.y = 0.943` standing; horizontal-thigh seated with flat feet on `y = 0` needs **`seatY ≈ 0.43–0.44 m`** (`root.y ≈ 0.50`). Always start from `POSTURE_HINTS` (`standing`, `seated`, `seatedLeanBack`, `incline45`, `incline30`, `supineFlat`, `supineFloor`, `pronePlank`, `kneeling`, `hanging`).
- **Root DOFs (`hints`):** `root.x/y/z` (m), `root.pitch` (deg, `+` forward lean, `-80..-90` supine, `+80..+90` prone), `root.yaw` (`+` turns left), `root.roll` (`+` right ear down / side plank).
- **Joint angle hints (degrees; omit `_L`/`_R` for both sides):**
  - `hip.flex` (`-20..125`), `hip.abd` (`-25..45`), `hip.rot` (`-35..45`), `knee.flex` (`0..150`), `ankle.dorsi` (`-45..35`), `ankle.inv` (`-20..30`)
  - `lumbar.flex` (`-25..50`), `lumbar.bend` (`-25..25`), `lumbar.twist` (`-10..10`), `thoracic.flex` (`-20..35`), `thoracic.bend` (`-25..25`), `thoracic.twist` (`-35..35`), `neck.flex` (`-60..50`)
  - `clavicle.prot` (`-28..25`, `-` retracted), `clavicle.elev` (`-10..35`, `+` shrug)
  - `shoulder.elev` (`0..180`), `shoulder.plane` (`-180..180`, `0` side, `90` forward, `-90` back), `shoulder.twist` (`-100..100`, `+` internal)
  - `elbow.flex` (`0..150`), `forearm.pron` (`-85..85`, `+` overhand, `0` neutral, `-` underhand), `wrist.flex` (`-70..80`), `wrist.dev` (`-30..20`)

## Available body anchors (`body.anchors`)

- Trunk/Head: `traps`, `upperBack`, `sternum`, `chestFront`, `belly`, `sacrum`, `pelvisBottom`, `pelvisFront`, `occiput`, `mouth`, `forehead`, `headTop`, `headSide_L/R`, `frontRack_L/R`, `shoulderTop_L/R`
- Arms (`_L`/`_R`): `grip_L/R`, `press_L/R`, `palmFlat_L/R`, `elbowTip_L/R`, `forearmMid_L/R`, `upperArmBack_L/R`
- Legs (`_L`/`_R`): `thighBack/Front/Outer/Inner_L/R`, `kneeFront/Back_L/R`, `shinFront/Back_L/R`, `ankleCuff_L/R`, `heel_L/R`, `ballIn_L/R`, `ballOut_L/R`, `toe_L/R`, `secondToe_L/R`

## Mandatory verification loop

1. Read each exercise's brief and inspect its reference PNG images (if provided). If instructions or images are missing or unclear, verify standard form online.
2. Create `exercise-motion/src/exercises/<slug>.ts` exporting `export const spec: ExerciseSpec = ...` (do NOT edit `src/exercises/index.ts`).
3. Run:
   ```bash
   bun exercise-motion/scripts/inspect-exercise.ts <slug1> [slug2 ...]
   ```
   (For a batch of multiple exercises, you can also run `bun exercise-motion/scripts/batch-qa.ts <slug1> <slug2> ...` to get a quick tiled mosaic!)
4. **Visually inspect** the generated PNG contact sheet(s) (`/tmp/motion-inspect/<slug>-compare.png` or `-sheet.png`, or batch QA mosaic) using your image reader tool! Check:
   - Right equipment & scale?
   - Character properly set up on the equipment (no floating, no sinking, no clipping, natural posture)?
   - Smooth, realistic motion matching the instructions and reference images?
   - Top muscles match the catalog's primary/secondary muscles?
5. Fix EVERY error flag, EVERY failed check, and EVERY visual defect until `inspect-exercise.ts` exits `0` AND the renders look natural.
6. Run `bun check && bunx oxlint exercise-motion/src/exercises/<slug>.ts ...`, leave no untracked temp files in the repo, and commit cleanly on your worktree branch.
