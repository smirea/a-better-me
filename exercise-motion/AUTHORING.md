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
- **Hand-carried props** (dumbbells, kettlebells, a deadlifted bar, a cable attachment): `graspProp` each hand on the prop's handle (`propHandles("prop-barbell").grip`, `propHandles("prop-lat-bar").grip_L`), place the prop with `carryProp(body, frame, prop, grasps)`, and pose the hands with goals. Two hands on two handles of one prop also need `keepGraspSpan(body, gL, gR, prop)`. A cable attachment rolls in the hands to face its cable: pass `{ toward: machine.pulleys!.pulley.pos }` so its eye turns to the pulley.
- **Body-carried props** (a squat bar on the traps, a front rack): place the prop from body anchors in `propState`, and hold it with `holdGrasp(body, grasp, ctx.live, { at: ±halfWidth, style })`.
- **Free hands:** `palmOnFloor` / `braceHandOnSurface` / `braceBothHands` with `grips: "flat-floor"`; otherwise `grips` defaults to `"relaxed"`. A closed grip (`bar`, `press`, `neutral`, `hook`, …) without a grasp throws.

## Moving machine parts

Pass `drive` to the machine so its sled, lever, stack or swivel moves each frame. Cables come from `cableTether(id, machine, pulleyKey, attachmentProp, props)` (outlet to attachment eye, checked every frame). Read anchors from the static instance and let them ride: `plantBothFeetOnPlate(body, m.footplates!.sled.surface, stanceX, along, toeOut, weight, carried(m.carrier("sled")!, ctx.live))`, and the same `carry` option on `plantFootOnToeBreak`. Use `m.atFrame(frame, extras, propStates)` for anything else that moves.

A sled or carriage whose travel the lifter decides (leg press, hack squat, Smith machine) is an extra unknown the solver finds with the pose. The machine stops it at its limits, and `composeExercise` already penalizes travel past them, so don't add your own rail penalty:

```ts
const machine = legPress45Machine({ drive: (_frame, extras) => ({ sledTravel: extras[0] }) });
// in setup: extras: 1, extraStart: [0.5], and seed each key pose's travel with a weak key goal if it helps:
keyGoals: { start: [({ q, push }) => push(q[body.dofCount] - 0.5)], end: [lockAngle(body, "knee_L.flex", 92, 10)] },
```

Cable stacks rest on their pins at the rep's slackest frame automatically; `restCable` only needs to be roughly right.

## Sitting on a machine

`POSTURE_HINTS` are built for equipment at the origin. On a machine, take the root position from its seat anchor so the solve starts in the right place: `"root.y": seat.origin[1] + 0.09, "root.z": seat.origin[2]`, and pitch the trunk to the backrest. Hints pick the solver's basin for every goal, not just the posture: when a spec that passed starts failing after a hint change, the hint moved the basin.

## Racks

Set J-hooks and safeties from the bar's solved height, not from the cradle: `rackHeightsFor(standingUnderside, bottomUnderside)` (`src/machines/power-rack.ts`) puts the hooks where the standing bar clears their lips and the safeties just under the bottom of the rep. A bar resting on the traps is placed from body anchors in `propState`, and the hands `holdGrasp` it through `ctx.live` with `{ at: ±halfWidth, style: "overhand" }`; keep the grip close enough that the shoulders aren't held at their rotation limit (QA warns when a joint sits at its limit for most of the rep).

## Loads, contacts and muscles

The muscle numbers come from the forces on the body, so say what those are and nothing else.

- **`loads` are known forces:** a weight at an anchor (`share` of the logged weight), a cable (`pulley`, the point it pulls toward), or a push in a fixed `direction`. A cable pulls each hand parallel to the cable, so on a wide bar give each hand its own `pulley` point offset by its grip width, not the pulley's centre.
- **`support` says what holds the lifter up.** `seated`, `lying` and `supported` rest the pelvis on a seat, bench or pad; list in `passive` the joints that pad carries. `standing` (the feet) and `hanging` (the hands) have their contacts built in. `planted` is everything else on the floor: list `contacts` with `footContact(side)` and `palmContact(side)` (push-ups, planks, hip thrusts). Never state how much a contact carries: balance works it out.
- **A plate on rails** (a leg press sled) is a contact with a `normal` and a `share`: the fraction of the logged weight it presses with along that normal.
- **Two hands on one bar** go in `support.bars: [["grip_L", "grip_R"]]`, so they can push or pull along it. Without it a wide grip loads the shoulders as if each hand hung from its own rope.
- **A bar hung from a cable** is one load on one hand with the other named in `with`: `{ anchor: "grip_L", with: "grip_R", share: 1, grip: "hang", pulley, eye, rest }`. `eye` is how far the bar's eye rides above the grips and `rest` how much cable is paid out with the stack on its pin. The bar is then one rigid body: the cable pulls its eye, each hand's share is solved, and a cable shorter than `rest` is slack and carries nothing.
- **A weight resting on the body** goes in `support.leans`: dumbbells or a bar against the thighs at the top of a deadlift (`{ anchor: "grip_L", on: "hip_L", within }`, with `within` the distance from the thigh's axis to the hand when they touch). Without it the shoulders hold the weight out in front at lockout.
- **Line limbs up with their loads.** A forearm held off the line of its cable, or an arm trailing behind a dumbbell, puts the work in the wrong muscle. `limbAlongForce(body, "elbow_L", "grip_L", force)` (`src/solver.ts`) holds a limb along the force on its end.

**Posing by least effort (`effort: true`).** A spec can leave the posture between its constraints to the muscles: every pose is then the one that costs the least muscle effort among those that meet the goals. List only what the exercise fixes (contacts, grasps, the instruction's cues as ranges, where the rep starts and ends) and nothing that follows from the load: no elbow line, no hand path, no lean angle inside its allowed range. `steady: [(frame) => quantity]` holds a quantity the instructions say to maintain (a torso lean) at one value through the rep without saying which. The engine adds what every such rep needs: cables stay taut, a hanging hand lines up with its load, a standing lifter's weight stays over the middle of his feet, joints stay out of the last of their range. Write each cue as the range it allows with `within(read, lo, hi, weight)` or `angleWithin(body, "clavicle_L.elev", -5, 12, 40)` (`src/solver.ts`), and give a finish the range its cue allows too ("the upper chest" is a band, "fairly close to parallel" is a few centimetres): where in it the rep ends is the lifter's choice. The pulldown, the push-up and the squat are posed this way; each takes 10 to 20 s to build against under 1 s for a hand-posed rep.

QA holds the result against the catalog's muscles, plus any muscle that studies of the exercise found working (`src/measured.ts`). `./scripts/measured.ts [slug]` prints the model beside the measured activity for the exercises that have been studied; add an exercise's studies there when they exist. `muscle-flicker` (error) is a muscle that switches on more than once each way: look for a joint that pops, a hand that shifts or a load that changes direction. `muscle-mismatch` (warning) is a muscle the exercise doesn't list out-working the ones it does, a listed prime mover left idle, or a muscle that works hardest while the lifter rests at lockout (a bar behind the spine, a weight held out from the body): fix the pose or where the lifter sits on the machine, and never touch the muscle model to quiet it. An `overload` error is often a load pointing the wrong way before it is too heavy. How the numbers are computed is in [`docs/biomechanics.md`](docs/biomechanics.md).

## Form checks

Each check tests the cue it quotes, exactly as written, on both sides when the cue applies to both, and over every frame when the cue is about the whole rep ("keep", "throughout"). Never widen a range, swap a check for an easier one, or drop a check to get green. If the body or the machine can't meet a cue, leave the check failing and say why in your report: that is how a machine or rig problem gets fixed. Contact checks ("chest touches the floor", "bar to upper chest") measure the gap from the body surface the cue names, not from a nearby anchor with a generous distance.

- `checkJointWithinAt(id, label, cue, angleKey, "start" | "peak", loDeg, hiDeg)` — `"start"` evaluates frame 0, `"peak"` evaluates the end of phase 1 (the lockout or the stretch, whichever the rep moves to first).
- `checkFlatBack`, `checkNeutralNeck`, `checkJointRange`, `checkAnchorTravel`, `checkFeetPlanted`.

## Goals, key goals and extras

- `goals` apply to every solve: both key poses and every frame between them. `keyGoals.start` and `keyGoals.end` apply only to their key pose; the frames between are blended from the two keys and re-solved with `goals` alone.
- So anything that must hold mid-rep (a contact, a bar path, a knee line) belongs in `goals`. A goal that switches on a joint it also moves (for example "pull the bar to the chest once the elbows pass 90°") is bistable and pops; drive such a thing with an extra unknown instead.
- An extra (`extras: n`) is an unknown the solver finds with the pose, such as sled travel. `extraStart` seeds both key solves; seed the end key with a `keyGoals.end` residual on `q[body.dofCount + i]`. `path(s, start, end)` sets the extras between the keys (linear by default).

## When the solve fights you

Run `bun exercise-motion/scripts/batch-qa.ts <slug> --explain`. For the start and peak poses it prints the key joint angles, every joint within 3° of a limit, each required contact's signed gap and each grasp's offset, plus every check's measured value. A joint pinned at its limit is usually the reason a contact won't close or a depth target won't reach: fix the placement (foot height on a plate, grip width, seat position) rather than the weights.
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
- Arms (`_L`/`_R`): `grip_L/R`, `press_L/R`, `palmFlat_L/R`, `palmHeel_L/R`, `knuckles_L/R`, `fingertips_L/R`, `elbowTip_L/R`, `forearmMid_L/R`, `upperArmBack_L/R`
- Legs (`_L`/`_R`): `thighBack/Front/Outer/Inner_L/R`, `kneeFront/Back_L/R`, `shinFront/Back_L/R`, `ankleCuff_L/R`, `heel_L/R`, `ballIn_L/R`, `ballOut_L/R`, `forefoot_L/R`, `toe_L/R`, `secondToe_L/R`

## Mandatory verification loop

1. Read the exercise's brief (`bun exercise-motion/scripts/exercise-brief.ts "<name>"`) and look at its reference images. If the instructions or images are unclear, check standard form online.
2. Write `exercise-motion/src/exercises/<slug>.ts` (don't edit `src/exercises/index.ts`; `scripts/sync-exercises.ts` regenerates it).
3. Run `bun exercise-motion/scripts/batch-qa.ts <slug>`. It must report `0` errors and pass every form check; treat each warning as a defect unless you can say why it is right. Add `--explain` when something fights you.
4. Run `bun exercise-motion/scripts/render-3d.ts <slug> --closeups` and look at the PNG: full views, hand close-ups and foot close-ups. Compare with the reference images. Check that the equipment is right and set up correctly, that nothing floats, sinks or clips, that the fingers wrap what they hold and the soles sit flat, and that the motion matches the instructions.
5. Fix every error, failed check and visual defect at its cause (pose, placement, equipment state), never by widening a contact allowance or loosening a check, until both are clean.
6. Run `bun check` and `bunx oxlint exercise-motion/src/exercises/<slug>.ts`, and leave no untracked temp files.
