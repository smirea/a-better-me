# Exercise Authoring Guide

Read this and `exercise-motion/AGENTS.md` before writing or editing any file in `exercise-motion/src/exercises/`.

## Goal

Every exercise file `exercise-motion/src/exercises/<slug>.ts` exports `export const spec = composeExercise({...})` (`src/scene.ts`). The solver turns it into a natural, collision-free looping 3D rep on the canonical equipment that passes **every** validator with `0` errors and **every** catalog-quoted form check. There is no other authoring path: never write procedural stand-in equipment, copy a GLB, or hand-place a prop away from the hand or body part that carries it.

## Example: standing dumbbell curl

```ts
import { anchorPoint } from "../body";
import { carryProp, graspProp } from "../grasp";
import { dumbbellProp, propHandles } from "../machines";
import { checkJointRange, plantBothFeet, POSTURE_HINTS } from "../postures";
import { composeExercise } from "../scene";
import { balance, mirrored } from "../solver";

export const spec = composeExercise({
  id: "standing-dumbbell-biceps-curl",
  catalogId: "...",
  name: "Standing Dumbbell Biceps Curl",
  defaultLoadKg: 12,
  loadUnit: "perSide",
  setup(body) {
    const handle = propHandles("prop-dumbbell").grip;
    const props = [dumbbellProp("dbL"), dumbbellProp("dbR")];
    // What each hand holds: sets the finger wrap and is what QA measures the hand against every frame.
    const grasps = [graspProp("L", "dbL", handle), graspProp("R", "dbR", handle)];
    const s = POSTURE_HINTS.standing;
    return {
      hints: {
        start: { ...s, "shoulder.elev": 8, "elbow.flex": 10, "forearm.pron": -80 },
        end: { ...s, "shoulder.elev": 14, "shoulder.plane": 80, "elbow.flex": 130, "forearm.pron": -80 },
      },
      goals: [
        ...plantBothFeet(body, 0.12, -0.02),
        balance(body, [{ anchor: "grip_L", kg: 12 }, { anchor: "grip_R", kg: 12 }], 0.07, 20),
        mirrored(body, 6),
      ],
      keyGoals: { start: [], end: [] },
      stiffness: { default: 1, lumbar: 8, thoracic: 8 },
      progress: (frame) => anchorPoint(body, frame, "grip_L").y,
      ground: "heel_L",
      props,
      // Hand-carried props sit exactly in the closed hands; the solver keeps limbs out of them.
      propState: (frame) => props.map((p) => carryProp(body, frame, p, grasps)),
      grasps,
      loads: [
        { anchor: "grip_L", share: 1, grip: "hang" },
        { anchor: "grip_R", share: 1, grip: "hang" },
      ],
      support: { kind: "standing" },
      required: [
        { label: "Left heel", anchor: "heel_L", surfaceY: 0 },
        { label: "Right heel", anchor: "heel_R", surfaceY: 0 },
      ],
      checks: [checkJointRange("elbow", "Full curl", "Curl the weights up toward your shoulders.", "elbow_L.flex", 95)],
    };
  },
});
```

## Holding things

- **Machine handles:** `machine.grasp(side, "handle_L")`, held with `...holdGrasp(body, grasp, ctx.live, { style: "overhand" | "underhand" | "neutral" })`. A handle on a driven node (a lever, a sled) is tracked live.
- **Hand-carried props** (dumbbells, kettlebells, a deadlifted bar, a cable attachment): `graspProp` each hand on the prop's handle (`propHandles("prop-barbell").grip`, `propHandles("prop-lat-bar").grip_L`), place the prop with `carryProp(body, frame, prop, grasps)`, and pose the hands with goals. Two hands on two handles of one prop also need `keepGraspSpan(body, gL, gR, prop)`.
- **Body-carried props** (a squat bar on the traps, a front rack): place the prop from body anchors in `propState`, and hold it with `holdGrasp(body, grasp, ctx.live, { at: ±halfWidth, style })`.
- **Free hands:** `palmOnFloor` / `braceHandOnSurface` / `braceBothHands` with `grips: "flat-floor"`; otherwise `grips` defaults to `"relaxed"`. A closed grip (`bar`, `press`, `neutral`, `hook`, …) without a grasp throws.

## Moving machine parts

Pass `drive` to the machine so its sled, lever, stack or swivel moves each frame. Cables come from `cableTether(id, machine, pulleyKey, attachmentProp, props)` (outlet to attachment eye, checked every frame). Read anchors from the static instance and let them ride: `plantBothFeetOnPlate(body, m.footplates!.sled.surface, stanceX, along, toeOut, weight, carried(m.carrier("sled")!, ctx.live))`. Use `m.atFrame(frame, extras, propStates)` for anything else that moves, such as a swivelled pulley outlet in `tetherState`.

### Form checks (`src/postures.ts`)
- `checkJointWithinAt(id, label, cue, angleKey, "start" | "peak", loDeg, hiDeg)` — `"start"` evaluates frame 0, `"peak"` evaluates the end of phase 1 (the lockout or the stretch, whichever the rep moves to first).
- `checkFlatBack`, `checkNeutralNeck`, `checkJointRange`, `checkAnchorTravel`, `checkFeetPlanted`.

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

1. Read the exercise's brief (`bun exercise-motion/scripts/exercise-brief.ts "<name>"`) and look at its reference images. If the instructions or images are unclear, check standard form online.
2. Write `exercise-motion/src/exercises/<slug>.ts` (don't edit `src/exercises/index.ts`; `scripts/sync-exercises.ts` regenerates it).
3. Run `bun exercise-motion/scripts/batch-qa.ts <slug>`. It must report `0` errors and pass every form check.
4. Run `bun exercise-motion/scripts/render-3d.ts <slug> --closeups` and look at the PNG: full views, hand close-ups and foot close-ups. Compare with the reference images. Check that the equipment is right and set up correctly, that nothing floats, sinks or clips, that the fingers wrap what they hold and the soles sit flat, and that the motion matches the instructions.
5. Fix every error, failed check and visual defect at its cause (pose, placement, equipment state), never by widening a contact allowance or loosening a check, until both are clean.
6. Run `bun check` and `bunx oxlint exercise-motion/src/exercises/<slug>.ts`, and leave no untracked temp files.
