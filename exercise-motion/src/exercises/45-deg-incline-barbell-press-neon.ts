import { Vector3 } from "three";
import { anchorPoint, SIDES, sideSign, type Body, type PoseHints } from "../body";
import { everyFrame } from "../checks";
import {
  box,
  compileParts,
  IDENTITY,
  olympicBar,
  quatOf,
  type PadSurface,
  type Part,
} from "../equipment";
import type { Built, ExerciseSpec } from "../exercise";
import { deg, rad, type Vec3 } from "../math";
import {
  checkAnchorTravel,
  checkFeetPlanted,
  checkJointRange,
  checkJointWithinAt,
  PAD_RESTING,
  plantBothFeet,
  restBackOnPad,
} from "../postures";
import { aim, mirrored, pin, restOnPlane, type Goal } from "../solver";

/**
 * Exact Blender-measured geometry of `olympic-incline-bench-neon.glb`
 * (cleaned `olympicinclinedbench.glb` with static barbell & plates removed):
 * - Backrest pad: normal (0, 0.8656, 0.5007) -> 30.05° incline from horizontal,
 *   Y=[0.324, 0.865], Z=[-0.630, +0.251], width 0.286 m, plane p·n = 0.4368
 * - Seat pommel pad: normal (0, 0.5829, -0.8126), Y=[0.493, 0.710], Z=[0.056, 0.208], width 0.29 m
 * - Uprights & dual J-hooks: |X| ≈ 0.58 m, hooks at Z ≈ -0.48 m, lower cradle Y ≈ 1.15 m, upper cradle Y ≈ 1.33 m
 * - Front footrest bar: X=[-0.25, +0.25], Y=[0.46, 0.55], Z=[0.85, 0.92]
 * - Floor feet at X = ±0.24 m, heelZ = 0.42 m sit completely clear of the center spine and footrest post.
 */
const BACK_ANGLE = rad(30.05);
const BACK_SURFACE: PadSurface = {
  origin: [0, 0.5046, 0.0],
  normal: [0, 0.8656, 0.5007],
  up: [0, 0.5007, -0.8656],
};

const SEAT_ORIGIN = new Vector3(0, 0.54, 0.08);
const SEAT_NORMAL = new Vector3(0, 0.5829, -0.8126).normalize();

const JHOOK_Z = -0.48;
const GRIP_X = 0.34; // ~1.5x shoulder width (biacromial ~0.44m -> ~0.68m grip)

const TRUNK: PoseHints = {
  "root.y": 0.58,
  "root.z": -0.04,
  "root.pitch": -56,
  "lumbar.flex": -6,
  "thoracic.flex": -4,
  "neck.flex": 8,
  "clavicle.prot": -16,
  "clavicle.elev": 2,
  "hip.flex": 54,
  "hip.abd": 20,
  "hip.rot": 10,
  "knee.flex": 92,
  "ankle.dorsi": 4,
};

const ARMS_TOP: PoseHints = {
  "shoulder.elev": 106,
  "shoulder.plane": 72,
  "shoulder.twist": 24,
  "elbow.flex": 8,
  "forearm.pron": 26,
  "wrist.flex": -6,
};

const ARMS_BOTTOM: PoseHints = {
  "shoulder.elev": 62,
  "shoulder.plane": 8,
  "shoulder.twist": 10,
  "elbow.flex": 104,
  "forearm.pron": 34,
  "wrist.flex": -8,
};

const Z_AXIS = new Vector3(0, 0, 1);

export const spec: ExerciseSpec = {
  id: "45-deg-incline-barbell-press-neon",
  catalogId: "1a05c6f170d880198e1aceac084f30eb",
  name: "45° Incline Barbell Press (neon)",
  defaultLoadKg: 40,
  loadUnit: "total",
  laterality: "bilateral",
  build(body: Body): Built {
    const padT = 0.065;
    const backLen = 0.88;
    const backCenter: Vec3 = [
      0,
      BACK_SURFACE.origin[1] + (backLen / 2 - 0.14) * BACK_SURFACE.up[1] - (padT / 2) * BACK_SURFACE.normal[1],
      BACK_SURFACE.origin[2] + (backLen / 2 - 0.14) * BACK_SURFACE.up[2] - (padT / 2) * BACK_SURFACE.normal[2],
    ];
    const seatCenter: Vec3 = [
      0,
      SEAT_ORIGIN.y - (padT / 2) * SEAT_NORMAL.y,
      SEAT_ORIGIN.z - (padT / 2) * SEAT_NORMAL.z,
    ];

    const staticParts: Part[] = [
      box("bench.backPad", backCenter, [0.29, padT, backLen], "pad", true, quatOf([1, 0, 0], BACK_ANGLE)),
      box("bench.seatPad", seatCenter, [0.22, padT, 0.2], "pad", true, quatOf([1, 0, 0], -rad(54.35))),
      box("bench.uprightL", [0.58, 0.8, -0.54], [0.075, 1.6, 0.075], "steel", true),
      box("bench.uprightR", [-0.58, 0.8, -0.54], [0.075, 1.6, 0.075], "steel", true),
      box("bench.hookL", [0.58, 1.14, JHOOK_Z], [0.06, 0.03, 0.1], "steel", false),
      box("bench.hookR", [-0.58, 1.14, JHOOK_Z], [0.06, 0.03, 0.1], "steel", false),
      box("bench.footrest", [0, 0.5, 0.88], [0.5, 0.08, 0.08], "steel", false),
    ];

    const contacts: Record<string, Record<string, number>> = {
      "bench.backPad": { ...PAD_RESTING, upperarm_L: 0.042, upperarm_R: 0.042 },
      "bench.seatPad": { ...PAD_RESTING, pelvis: 0.05, thigh_L: 0.065, thigh_R: 0.065 },
      bar: {
        hand_L: 0.07,
        hand_R: 0.07,
        forearm_L: 0.035,
        forearm_R: 0.035,
        chest: 0.03,
        girdle: 0.03,
      },
    };

    const obstacles = compileParts(staticParts.filter((p) => p.collide)).map((shape) => ({
      shape,
      allow: contacts[shape.part.id] ?? {},
    }));

    // 2 extra DOFs: bar Y and bar Z (bar stays horizontal along X at exact press_L / press_R height).
    // Shoulders sit around Z ≈ -0.34 m (14 cm forward of J-hooks at Z = -0.48 m!).
    // Top (lockout): bar over shoulders at Y = 1.38 m, Z = -0.31 m (clears J-hooks cleanly).
    // Bottom: bar gently taps upper chest at Y = 0.90 m, Z = -0.19 m (forearms stacked vertically under wrists!).
    const barY = body.dofCount;
    const barZ = body.dofCount + 1;
    const START_Y = 1.38;
    const START_Z = -0.31;
    const END_Y = 0.90;
    const END_Z = -0.19;

    const handTarget = new Vector3();
    const goals: Goal[] = [
      ...restBackOnPad(body, BACK_SURFACE, {
        sacrumAlong: 0.08,
        upperBackAlong: 0.47,
        occiputAlong: 0.75,
        sink: 0.008,
        weight: 42,
      }),
      restOnPlane(body, "pelvisBottom", SEAT_ORIGIN, SEAT_NORMAL, 34, 0.012),
      ...plantBothFeet(body, 0.27, 0.44, rad(15), 0, 44),
      mirrored(body, 6),
    ];

    for (const side of SIDES) {
      const s = sideSign(side);
      goals.push(
        pin(body, `press_${side}`, (q) => handTarget.set(s * GRIP_X, q[barY], q[barZ]), 46),
        aim(body, `wrist_${side}`, Z_AXIS, new Vector3(-s, 0, 0), 4.5),
      );
    }

    const keyStart: Goal[] = [
      ({ q, push }) => {
        push(40 * (q[barY] - START_Y));
        push(40 * (q[barZ] - START_Z));
      },
    ];
    const keyEnd: Goal[] = [
      ({ q, push }) => {
        push(40 * (q[barY] - END_Y));
        push(40 * (q[barZ] - END_Z));
      },
    ];

    return {
      hints: {
        start: { ...TRUNK, ...ARMS_TOP },
        end: { ...TRUNK, ...ARMS_BOTTOM },
      },
      phaseLabels: ["Lower", "Upper chest", "Press", "Lockout"],
      tempo: { lower: 2.0, bottom: 0.3, raise: 1.35, top: 0.5 },
      extras: 2,
      extraStart: [START_Y, START_Z],
      goals,
      keyGoals: { start: keyStart, end: keyEnd },
      stiffness: {
        default: 0.55,
        root: 5,
        lumbar: 6,
        thoracic: 6,
        neck: 3.5,
        clavicle: 3.5,
        hip: 1.2,
        knee: 1.2,
        ankle: 0.8,
        shoulder: 0.85,
        elbow: 3.8,
        forearm: 1.8,
        wrist: 4.5,
      },
      obstacles,
      path: (s, a, b) => [
        a[0] + (b[0] - a[0]) * s,
        a[1] + (b[1] - a[1]) * s + 0.03 * Math.sin(Math.PI * s) ** 2,
      ],
      progress: (frame) => anchorPoint(body, frame, "press_L").y,
      ground: "sacrum",
      props: [olympicBar("bar")],
      propState: (_frame, extras) => [{ pos: [0, extras[0], extras[1]], quat: IDENTITY }],
      equipment: () => staticParts,
      glb: [
        {
          id: "olympic-incline-bench-neon",
          pos: [0, 0, 0],
          hideEquipment: true,
        },
      ],
      loads: [
        { anchor: "press_L", share: 0.5, grip: "press" },
        { anchor: "press_R", share: 0.5, grip: "press" },
      ],
      support: {
        kind: "lying",
        passive: ["lumbar", "thoracic", "neck", "hip", "knee", "ankle", "clavicle"],
        brace: true,
      },
      grip: "press",
      cameraHint: { view: "Angle", target: [0, 0.88, -0.05] },
      laterality: "bilateral",
      contacts,
      required: [
        { label: "Upper back on bench pad", anchor: "upperBack", part: "bench.backPad", allowSlide: true },
        { label: "Left foot on floor", anchor: "heel_L", surfaceY: 0 },
        { label: "Right foot on floor", anchor: "heel_R", surfaceY: 0 },
        { label: "Left hand on bar", anchor: "press_L", prop: "bar" },
        { label: "Right hand on bar", anchor: "press_R", prop: "bar" },
      ],
      checks: [
        checkFeetPlanted(
          "Firmly place your feet flat on the ground approximately shoulder-width apart with your knees bent.",
        ),
        checkJointWithinAt(
          "elbows-locked",
          "Elbows fully straightened at lockout",
          "You should finish with your elbows fully straightened and the bar situated above your shoulders.",
          "elbow_L.flex",
          "start",
          0,
          16,
        ),
        checkJointWithinAt(
          "upper-chest-depth",
          "Bar lowers to upper chest",
          "Lower the bar toward your upper chest in a controlled manner until you are able to tap your upper chest lightly with the bar.",
          "elbow_L.flex",
          "peak",
          85,
          128,
        ),
        checkJointRange(
          "shoulder-rom",
          "Shoulders drive through incline press",
          "Press combines shoulder flexion and horizontal flexion from upper chest to lockout.",
          "shoulder_L.elev",
          28,
        ),
        checkAnchorTravel(
          "bar-travel",
          "Bar travels cleanly from chest to lockout",
          "Reverse the movement by pressing the bar up until the elbows are straight.",
          "press_L",
          "y",
          0.35,
        ),
        {
          id: "clears-jhooks",
          label: "Bar clears the J-hooks cleanly",
          cue: "Your shoulders should be a little in front of the J-hooks so you do not bump the J-hooks with the bar when pressing up.",
          evaluate: (ctx) =>
            everyFrame(
              ctx,
              (_frame, _a, idx) => {
                const barPosZ = ctx.sequence.propStates[idx][0].pos[2];
                return Math.max(0, (JHOOK_Z + 0.08 - barPosZ) * 1000);
              },
              0.5,
              " mm too close to J-hooks",
            ),
        },
        {
          id: "forearms-vertical",
          label: "Forearms stay near vertical at bottom",
          cue: "Strive to keep your elbows stacked underneath (when viewed from the side) your mostly straight wrists as your forearms remain close to vertical throughout the set.",
          evaluate: ({ frames, bottom }) => {
            const el = frames[bottom].pos[body.index.elbow_L];
            const wr = frames[bottom].pos[body.index.wrist_L];
            const tiltDeg = deg(Math.atan2(Math.abs(wr.z - el.z), Math.max(0.05, wr.y - el.y)));
            return {
              pass: tiltDeg <= 18,
              measured: `forearm side tilt at bottom is ${tiltDeg.toFixed(1)}° (limit 18°)`,
            };
          },
        },
      ],
    };
  },
};
