import { Vector3 } from "three";
import { anchorPoint, SIDES, sideSign, type Body, type PoseHints } from "../body";
import { everyFrame } from "../checks";
import {
  ALONG_Z,
  box,
  compileParts,
  cylinder,
  IDENTITY,
  quatOf,
  type PadSurface,
  type Part,
  type PropDef,
} from "../equipment";
import type { Built, ExerciseSpec } from "../exercise";
import { rad, type Vec3 } from "../math";
import {
  checkFlatBack,
  checkJointRange,
  checkJointWithinAt,
  checkNeutralNeck,
  PAD_RESTING,
  restBackOnPad,
} from "../postures";
import { kneeOverToes, mirrored, pin, restOnPlane, type Goal } from "../solver";

/**
 * Exact Blender-measured geometry of `linear-leg-press-frame-neon.glb` and
 * `linear-leg-press-sled-neon.glb` (split from `linearlegpresspure.glb` rotated 180° around Y):
 * - Backrest pad: normal (0, 0.8646, 0.5025) -> 30.16° incline, Y=[0.242, 0.678], Z=[-1.253, -0.498]
 * - Seat pad: normal (0, 0.7757, -0.6310) -> 39.13° cradle, Y=[0.268, 0.366], Z=[-0.408, -0.295]
 * - Linear guide rails: exact angle 40.05° -> unit dir [0, 0.64344, 0.76550]
 * - Footplate bind origin (sled local 0,0,0): [0, 1.0884, 0.2203]
 * - Footplate front contact face normal (toward lifter): [0, -0.4228, -0.9062]
 * - Footplate UP along face: [0, 0.9062, -0.4228], span [-0.275, +0.326] (60 cm tall), X=[-0.340, +0.340] (68 cm wide)
 * - Fixed side handles: X = ±0.350, Y = 0.23, Z = -0.41
 */
const RAIL_DIR = new Vector3(0, 0.64344, 0.7655).normalize();
const FP_BIND = new Vector3(0, 1.0884, 0.2203);
const FP_NORMAL = new Vector3(0, -0.4228, -0.9062).normalize();
const FP_UP = new Vector3(0, 0.9062, -0.4228).normalize();
// Local box +Z maps to [0, -sin(a), cos(a)]; negative angle tilts local +Z to [0, +0.4228, +0.9062] = -FP_NORMAL.
const FP_QUAT = quatOf([1, 0, 0], -Math.atan2(0.4228, 0.9062));
// Slight outward offset along FP_NORMAL keeps MakeHuman foot soles flush on the front face with zero poke-through.
const SOLE_SURFACE_OFFSET = 0.008;

const BACK_ANGLE = rad(30.16);
const BACK_SURFACE: PadSurface = {
  origin: [0, 0.2434, -0.5],
  normal: [0, 0.8646, 0.5025],
  up: [0, 0.5025, -0.8646],
};
const SEAT_ORIGIN = new Vector3(0, 0.3133, -0.36);
const SEAT_NORMAL = new Vector3(0, 0.7757, -0.631).normalize();

const HANDLE_L = new Vector3(0.35, 0.22, -0.42);
const HANDLE_R = new Vector3(-0.35, 0.22, -0.42);

// High, mildly wide stance on the upper half of the footplate (heels at +0.025m, toes at +0.275m,
// comfortably inside the +0.326m top edge so toes never hang off!).
const STANCE_HEEL_X = 0.21;
const HEEL_ALONG = 0.015;
const TOE_OUT_RAD = rad(10);

const SEATED_BASE: PoseHints = {
  "root.y": 0.34,
  "root.z": -0.48,
  "root.pitch": -58,
  "hip.abd": 14,
  "hip.rot": 10,
  "lumbar.flex": 4,
  "thoracic.flex": 2,
  "neck.flex": 8,
  "clavicle.elev": 2,
  "clavicle.prot": 4,
  "shoulder.elev": 42,
  "shoulder.plane": 18,
  "shoulder.twist": 10,
  "elbow.flex": 48,
  "forearm.pron": 25,
  "wrist.flex": 0,
};

/** Evaluates a point on the moving footplate contact surface at rail travel `d` (meters from bind). */
function footplatePoint(
  d: number,
  x: number,
  along: number,
  out = new Vector3(),
): Vector3 {
  return out
    .copy(FP_BIND)
    .addScaledVector(RAIL_DIR, d)
    .addScaledVector(FP_UP, along)
    .addScaledVector(FP_NORMAL, SOLE_SURFACE_OFFSET)
    .setX(x);
}

/**
 * Pins heel, inner ball, and outer ball of one foot flat onto the moving angled footplate
 * at sled travel `q[sledDof]`, with mild toe-out flare.
 */
function plantFootOnSled(
  body: Body,
  side: "L" | "R",
  sledDof: number,
  weight = 48,
): Goal[] {
  const s = sideSign(side);
  const yaw = s * TOE_OUT_RAD;
  const heelLocal = body.anchors[`heel_${side}`].local;

  const pinAnchor = (anchorName: string): Goal => {
    const delta = body.anchors[anchorName].local.clone().sub(heelLocal);
    // In standing foot local frame: +Z is forward toward toes (maps to +FP_UP on plate),
    // +X is medial/lateral (maps to +X on plate). Apply mild outward yaw in the footplate plane.
    const dx = delta.x * Math.cos(yaw) + delta.z * Math.sin(yaw);
    const dAlong = -delta.x * Math.sin(yaw) + delta.z * Math.cos(yaw);
    const target = new Vector3();
    return pin(
      body,
      anchorName,
      (q) => footplatePoint(q[sledDof], s * STANCE_HEEL_X + dx, HEEL_ALONG + dAlong, target),
      weight,
    );
  };

  return [pinAnchor(`heel_${side}`), pinAnchor(`ballIn_${side}`), pinAnchor(`ballOut_${side}`)];
}

export const spec: ExerciseSpec = {
  id: "45-deg-glute-biased-leg-press-neon",
  catalogId: "2aa5c6f170d880c08fcbf27e03a0e2dc",
  name: "45° Glute-Biased Leg Press (neon)",
  defaultLoadKg: 80,
  loadUnit: "total",
  laterality: "bilateral",
  build(body: Body): Built {
    const padT = 0.07;
    const backLen = 0.86;
    const backCenter: Vec3 = [
      0,
      BACK_SURFACE.origin[1] + (backLen / 2) * BACK_SURFACE.up[1] - (padT / 2) * BACK_SURFACE.normal[1],
      BACK_SURFACE.origin[2] + (backLen / 2) * BACK_SURFACE.up[2] - (padT / 2) * BACK_SURFACE.normal[2],
    ];
    const seatLen = 0.24;
    const seatCenter: Vec3 = [
      0,
      SEAT_ORIGIN.y - (padT / 2) * SEAT_NORMAL.y,
      SEAT_ORIGIN.z - (padT / 2) * SEAT_NORMAL.z,
    ];

    const staticParts: Part[] = [
      box("legpress.base", [0, 0.04, 0.0], [0.95, 0.08, 2.5], "steel", false),
      box("legpress.backPad", backCenter, [0.37, padT, backLen], "pad", true, quatOf([1, 0, 0], BACK_ANGLE)),
      box("legpress.seatPad", seatCenter, [0.37, padT, seatLen], "pad", true, quatOf([1, 0, 0], -rad(39.13))),
      cylinder("legpress.handleL", [0.35, 0.2, -0.45], 0.018, 0.26, "chrome", ALONG_Z, false),
      cylinder("legpress.handleR", [-0.35, 0.2, -0.45], 0.018, 0.26, "chrome", ALONG_Z, false),
    ];

    const contacts: Record<string, Record<string, number>> = {
      "legpress.backPad": { ...PAD_RESTING },
      "legpress.seatPad": { ...PAD_RESTING, pelvis: 0.055, thigh_L: 0.055, thigh_R: 0.055 },
      sled: { foot_L: 0.04, foot_R: 0.04 },
    };

    const obstacles = compileParts(staticParts.filter((p) => p.collide)).map((shape) => ({
      shape,
      allow: contacts[shape.part.id] ?? {},
    }));

    // 1 extra DOF: sled linear travel `d` (meters along exact 40.05° rails relative to bind pose FP_BIND).
    const sledDof = body.dofCount;
    const SLED_START_D = -0.115; // Lockout (knees softly bent ~12-18°, comfortably inside top bumpers)
    const SLED_END_D = -0.275; // Bottom (deep hip flexion ~121°, stops cleanly right before bottom bumpers!)

    const goals: Goal[] = [
      ...restBackOnPad(body, BACK_SURFACE, {
        sacrumAlong: 0.09,
        upperBackAlong: 0.48,
        occiputAlong: 0.78,
        sink: 0.008,
        weight: 42,
      }),
      restOnPlane(body, "pelvisBottom", SEAT_ORIGIN, SEAT_NORMAL, 36, 0.01),
      pin(body, "grip_L", () => HANDLE_L, 28),
      pin(body, "grip_R", () => HANDLE_R, 28),
      ...plantFootOnSled(body, "L", sledDof, 52),
      ...plantFootOnSled(body, "R", sledDof, 52),
      kneeOverToes(body, "L", 8),
      kneeOverToes(body, "R", 8),
      mirrored(body, 6),
    ];

    const keyStart: Goal[] = [({ q, push }) => push(44 * (q[sledDof] - SLED_START_D))];
    const keyEnd: Goal[] = [({ q, push }) => push(44 * (q[sledDof] - SLED_END_D))];

    // Moving GLB prop: footplate contact face sits at local (0, 0, 0); collider front face sits at SOLE_SURFACE_OFFSET
    // (0.008 m in front of the GLB sheet) so feet visually rest flush on top with zero poke-through and <2 mm contact gap.
    const plateBackOffset: Vec3 = [
      0,
      FP_NORMAL.y * (SOLE_SURFACE_OFFSET - 0.025),
      FP_NORMAL.z * (SOLE_SURFACE_OFFSET - 0.025),
    ];
    const sledProp: PropDef = {
      id: "sled",
      kind: "glb",
      glbId: "linear-leg-press-sled-neon",
      colliders: [box("sled.plate", plateBackOffset, [0.68, 0.6, 0.05], "steel", true, FP_QUAT)],
    };

    const forceDir: Vec3 = [-RAIL_DIR.x, -RAIL_DIR.y, -RAIL_DIR.z];

    return {
      hints: {
        start: { ...SEATED_BASE, "hip.flex": 54, "knee.flex": 16, "ankle.dorsi": 4 },
        end: { ...SEATED_BASE, "hip.flex": 108, "knee.flex": 96, "ankle.dorsi": 10 },
      },
      phaseLabels: ["Lower", "Bottom", "Press", "Lockout"],
      tempo: { lower: 2.1, bottom: 0.35, raise: 1.5, top: 0.4 },
      extras: 1,
      extraStart: [SLED_START_D],
      goals,
      keyGoals: { start: keyStart, end: keyEnd },
      stiffness: {
        default: 0.55,
        root: 6,
        lumbar: 9,
        thoracic: 8,
        neck: 4,
        clavicle: 3,
        hip: 1.6,
        knee: 1.6,
        ankle: 1.4,
        shoulder: 1.8,
        elbow: 2,
        forearm: 1.5,
        wrist: 2.5,
      },
      obstacles,
      progress: (frame) => {
        const heel = anchorPoint(body, frame, "heel_L");
        return heel.y * RAIL_DIR.y + heel.z * RAIL_DIR.z;
      },
      ground: "sacrum",
      props: [sledProp],
      propState: (_frame, extras) => {
        const d = extras[0];
        return [
          {
            pos: [
              FP_BIND.x + RAIL_DIR.x * d,
              FP_BIND.y + RAIL_DIR.y * d,
              FP_BIND.z + RAIL_DIR.z * d,
            ],
            quat: IDENTITY,
          },
        ];
      },
      equipment: () => staticParts,
      glb: [
        {
          id: "linear-leg-press-frame-neon",
          pos: [0, 0, 0],
          hideEquipment: true,
        },
      ],
      loads: [
        { anchor: "heel_L", share: 0.3, grip: "rest", direction: forceDir },
        { anchor: "heel_R", share: 0.3, grip: "rest", direction: forceDir },
        { anchor: "ballIn_L", share: 0.2, grip: "rest", direction: forceDir },
        { anchor: "ballIn_R", share: 0.2, grip: "rest", direction: forceDir },
      ],
      support: {
        kind: "lying",
        rail: true,
        passive: ["lumbar", "thoracic", "neck", "clavicle", "shoulder", "elbow", "forearm", "wrist"],
        brace: true,
      },
      grip: "hang",
      cameraHint: { view: "Side", target: [0, 0.72, 0.05] },
      laterality: "bilateral",
      contacts,
      required: [
        { label: "Back on sled backrest", anchor: "upperBack", part: "legpress.backPad", allowSlide: true },
        { label: "Left heel on footplate", anchor: "heel_L", prop: "sled" },
        { label: "Right heel on footplate", anchor: "heel_R", prop: "sled" },
        { label: "Left forefoot on footplate", anchor: "ballIn_L", prop: "sled" },
        { label: "Right forefoot on footplate", anchor: "ballIn_R", prop: "sled" },
      ],
      checks: [
        checkFlatBack(
          "Continue lowering the sled through the full range of motion you can while keeping your buttocks firmly on the seat, lower back flat against the back rest, and heels fully on the platform.",
          12,
        ),
        checkNeutralNeck(
          "Keep your neck near a neutral position, like when you are normally looking straight ahead while standing upright.",
        ),
        checkJointWithinAt(
          "hips-deep",
          "Hips reach a deep bend at bottom",
          "With the feet high on the platform, let the hips bend deeply while keeping your buttocks firmly on the seat.",
          "hip_L.flex",
          "peak",
          88,
          125,
        ),
        checkJointWithinAt(
          "shins-upright",
          "Ankles stay relatively neutral (shins upright)",
          "Placing your feet higher on the platform biases the glutes while keeping the heels firmly planted and ankles from folding excessively.",
          "ankle_L.dorsi",
          "peak",
          -8,
          18,
        ),
        checkJointRange(
          "hip-rom",
          "Hips drive through a full glute-biased range",
          "Lower the sled toward you in a controlled manner by simultaneously bending at your knees and hips.",
          "hip_L.flex",
          28,
        ),
        checkJointWithinAt(
          "knees-soft-lockout",
          "Knees finish straight or slightly bent",
          "Based on your preference, you can finish with your knees fully straightened or ever so slightly bent.",
          "knee_L.flex",
          "start",
          5,
          35,
        ),
        {
          id: "entire-sole-on-plate",
          label: "Entire soles stay planted flat on upper footplate",
          cue: "Place your feet fully on the upper half of the foot platform, mildly outside shoulder width apart, making sure your toes do not hang above it and heels stay fully planted.",
          evaluate: (ctx) =>
            everyFrame(
              ctx,
              (frame, _a, idx) => {
                const sledPos = ctx.sequence.propStates[idx][0].pos;
                const origin = new Vector3(...sledPos);
                let worstMm = 0;
                for (const side of SIDES) {
                  for (const name of [`heel_${side}`, `ballIn_${side}`, `ballOut_${side}`, `toe_${side}`]) {
                    const pt = anchorPoint(body, frame, name).sub(origin);
                    const planeGap = Math.abs(pt.dot(FP_NORMAL) - SOLE_SURFACE_OFFSET);
                    const along = pt.dot(FP_UP);
                    const overTop = Math.max(0, along - 0.326);
                    const overSide = Math.max(0, Math.abs(pt.x) - 0.34);
                    worstMm = Math.max(worstMm, Math.max(planeGap, overTop, overSide) * 1000);
                  }
                }
                return worstMm;
              },
              10,
              " mm off upper footplate",
            ),
        },
      ],
    };
  },
};
