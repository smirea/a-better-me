import { Quaternion, Vector3 } from "three";
import { anchorPoint, SIDES, sideSign, type Body, type Frame, type PoseHints, type Side } from "../body";
import { HANDLE_QUAT, quatFromAxisX } from "../builders";
import { everyFrame } from "../checks";
import {
  box,
  cableAttachmentProp,
  compileParts,
  cylinder,
  IDENTITY,
  quatOf,
  type Part,
  type PropState,
} from "../equipment";
import type { Built, ExerciseSpec } from "../exercise";
import { deg, rad, type Vec3 } from "../math";
import {
  checkFlatBack,
  checkJointRange,
  checkJointWithinAt,
  POSTURE_HINTS,
} from "../postures";
import { balance, pin, type Goal } from "../solver";

/**
 * Dual adjustable pulley GLB (`dual-adjustable-pulley-neon.glb`) placed behind origin at `Z = -MACHINE_DIST`
 * rotated 180° around Y so its swivel pulleys face +Z toward the lifter standing at `Z = +STANCE_Z`
 * facing -Z into the machine. This keeps Side, Angle, and Front cameras completely unobstructed by the shrouds
 * while showcasing the rear delts, crossed X-cables, and both pulley columns cleanly.
 *
 * Exact Blender-measured swivel pulley exits in local GLB coords: X = ±0.7064, Y = 1.8691, Z = -0.6060.
 * After 180° Y rotation and translation `[0, 0, -MACHINE_DIST]`:
 * world exits sit at `[±0.7064, 1.8691, -MACHINE_DIST + 0.6060]`.
 */
const MACHINE_DIST = 1.12;
const PULLEY_X = 0.7064;
const PULLEY_Y = 1.8691;
const PULLEY_Z = -MACHINE_DIST + 0.606; // -0.514 m in front of the -Z-facing lifter

const PULLEY_POS_X: Vec3 = [PULLEY_X, PULLEY_Y, PULLEY_Z];
const PULLEY_NEG_X: Vec3 = [-PULLEY_X, PULLEY_Y, PULLEY_Z];

const STANCE_Z = 0.22;
const STANCE_X = 0.16;

const STANCE: PoseHints = {
  ...POSTURE_HINTS.standing,
  "root.z": STANCE_Z,
  "root.yaw": 180,
  "knee.flex": 7,
  "hip.flex": 4,
  "lumbar.flex": 2,
  "thoracic.flex": 0,
  "neck.flex": -3,
};

/**
 * High crossed start: arms reach forward and slightly inward above shoulder height with elbows
 * softly bent, upper arms staying at plane <= 88° (no lateral-delt overstretch) while the
 * crossed cables from the opposite pulleys form a crisp X in front of the lifter.
 */
const HIGH_CROSS: PoseHints = {
  "shoulder.elev": 96,
  "shoulder.plane": 84,
  "shoulder.twist": 24,
  "elbow.flex": 26,
  "forearm.pron": 24,
  "wrist.flex": 0,
  "clavicle.elev": 12,
  "clavicle.prot": 10,
};

/**
 * 45° diagonal rear-delt sweep peak: arms sweep equally outward and downward until elbows finish
 * slightly behind or level with the shoulder line, maintaining slight elbow bend.
 */
const LOW_SWEEP: PoseHints = {
  "shoulder.elev": 52,
  "shoulder.plane": -4,
  "shoulder.twist": -6,
  "elbow.flex": 22,
  "forearm.pron": 16,
  "wrist.flex": 0,
  "clavicle.elev": 4,
  "clavicle.prot": -14,
};

function plantFootFacingNegZ(
  body: Body,
  side: Side,
  heel: Vector3,
  toeOutRad: number,
  weight = 44,
): Goal[] {
  const s = sideSign(side);
  const yaw = Math.PI + s * toeOutRad;
  const heelLocal = body.anchors[`heel_${side}`].local;
  const spot = (anchor: string) => {
    const local = body.anchors[anchor].local.clone().sub(heelLocal);
    const x = local.x * Math.cos(yaw) + local.z * Math.sin(yaw);
    const z = -local.x * Math.sin(yaw) + local.z * Math.cos(yaw);
    const world = new Vector3(heel.x + x, heel.y, heel.z + z);
    return pin(body, anchor, () => world, weight);
  };
  return [spot(`heel_${side}`), spot(`ballIn_${side}`), spot(`ballOut_${side}`)];
}

function mirroredYaw180(body: Body, weight: number): Goal {
  const pairs: [number, number, number][] = [];
  const zero: number[] = [0, 5];
  for (const joint of body.joints) {
    if (joint.side === null && joint.kind === "ball") {
      zero.push(joint.dofStart + 1, joint.dofStart + 2);
    }
    if (joint.side !== "L") continue;
    const twin = body.joints[body.index[`${joint.name.slice(0, -2)}_R`]];
    if (joint.kind === "ball") {
      pairs.push(
        [joint.dofStart, twin.dofStart, 1],
        [joint.dofStart + 1, twin.dofStart + 1, -1],
        [joint.dofStart + 2, twin.dofStart + 2, -1],
      );
    } else {
      joint.dofs.forEach((_, n) => pairs.push([joint.dofStart + n, twin.dofStart + n, 1]));
    }
  }
  return ({ q, push }) => {
    for (const [left, right, sign] of pairs) push(weight * (q[left] - sign * q[right]));
    for (const index of zero) push(weight * q[index]);
    push(weight * (q[4] - Math.PI));
  };
}

function dHandleAligned(body: Body, frame: Frame, side: Side, pulley: Vec3): PropState {
  const grip = anchorPoint(body, frame, `grip_${side}`);
  const wristRot = frame.rot[body.index[`wrist_${side}`]];
  const gripAxis = new Vector3(0, 0, 1).applyQuaternion(wristRot).normalize();
  const toPulley = new Vector3(pulley[0] - grip.x, pulley[1] - grip.y, pulley[2] - grip.z);
  if (toPulley.lengthSq() < 1e-6) {
    const q = wristRot.clone().multiply(HANDLE_QUAT);
    return { pos: [grip.x, grip.y, grip.z], quat: [q.x, q.y, q.z, q.w] };
  }
  toPulley.normalize();
  return {
    pos: [grip.x, grip.y, grip.z],
    quat: quatFromAxisX(gripAxis, toPulley),
  };
}

function dHandleTop(state: PropState): Vec3 {
  const topLocal = new Vector3(0, 0.1, 0).applyQuaternion(new Quaternion(...state.quat));
  return [state.pos[0] + topLocal.x, state.pos[1] + topLocal.y, state.pos[2] + topLocal.z];
}

export const spec: ExerciseSpec = {
  id: "45-deg-cable-rear-delt-fly-neon",
  catalogId: "2a15c6f170d88066b38fd65f8757716f",
  name: "45° Cable Rear Delt Fly (neon)",
  defaultLoadKg: 4,
  loadUnit: "perSide",
  laterality: "bilateral",
  build(body: Body): Built {
    const staticParts: Part[] = [];
    for (const s of [1, -1]) {
      const tag = s > 0 ? "R" : "L";
      const x = s * PULLEY_X;
      staticParts.push(
        box(`dap.post_${tag}`, [x, 1.16, PULLEY_Z - 0.16], [0.1, 2.32, 0.1], "steel"),
        box(`dap.shroud_${tag}`, [x, 1.05, -MACHINE_DIST - 0.15], [0.22, 1.95, 0.72], "steel", false),
        cylinder(`dap.pulley_${tag}`, [x, PULLEY_Y, PULLEY_Z], 0.05, 0.03, "chrome", IDENTITY, false),
      );
    }
    staticParts.push(
      box("dap.bridge", [0, 2.26, -MACHINE_DIST + 0.25], [PULLEY_X * 2 + 0.1, 0.08, 0.08], "steel", false),
    );

    const obstacles = compileParts(staticParts.filter((p) => p.collide)).map((shape) => ({
      shape,
      allow: {},
    }));

    // Facing -Z: left foot sits at -STANCE_X, right foot sits at +STANCE_X.
    const goals: Goal[] = [
      ...plantFootFacingNegZ(body, "L", new Vector3(-STANCE_X, 0, STANCE_Z), rad(6), 44),
      ...plantFootFacingNegZ(body, "R", new Vector3(STANCE_X, 0, STANCE_Z), rad(6), 44),
      balance(body, [], STANCE_Z - 0.08, 12),
      mirroredYaw180(body, 6),
    ];

    // Facing -Z: left hand (`grip_L`) sits on -X side and holds the OPPOSITE pulley (`PULLEY_POS_X`, +X);
    // right hand (`grip_R`) sits on +X side and holds the OPPOSITE pulley (`PULLEY_NEG_X`, -X).
    // Hands start ~24 cm apart above shoulder height (clean handle clearance + bold X-crossed cables!)
    // and sweep diagonally 45° outward, downward, and slightly backward.
    const startTargetL = new Vector3(-0.125, 1.56, STANCE_Z - 0.48);
    const startTargetR = new Vector3(0.125, 1.56, STANCE_Z - 0.48);
    const endTargetL = new Vector3(-0.62, 1.12, STANCE_Z - 0.04);
    const endTargetR = new Vector3(0.62, 1.12, STANCE_Z - 0.04);

    const keyStart: Goal[] = [
      pin(body, "grip_L", () => startTargetL, 18),
      pin(body, "grip_R", () => startTargetR, 18),
    ];
    const keyEnd: Goal[] = [
      pin(body, "grip_L", () => endTargetL, 18),
      pin(body, "grip_R", () => endTargetR, 18),
    ];

    const props = SIDES.map((side) => cableAttachmentProp(`handle_${side}`, "d-handle"));

    const contacts: Record<string, Record<string, number>> = {
      handle_L: { hand_L: 0.075, forearm_L: 0.035 },
      handle_R: { hand_R: 0.075, forearm_R: 0.035 },
    };

    return {
      hints: {
        start: { ...STANCE, ...HIGH_CROSS },
        end: { ...STANCE, ...LOW_SWEEP },
      },
      phaseLabels: ["Sweep", "Peak", "Return", "High cross"],
      tempo: { lower: 1.5, bottom: 0.3, raise: 1.5, top: 0.35 },
      extras: 0,
      extraStart: [],
      goals,
      keyGoals: { start: keyStart, end: keyEnd },
      stiffness: {
        default: 0.55,
        root: 5,
        lumbar: 9,
        thoracic: 8,
        neck: 4,
        clavicle: 2.5,
        hip: 1.5,
        knee: 1.5,
        ankle: 1,
        shoulder: 1.4,
        elbow: 6,
        forearm: 2.2,
        wrist: 3.5,
      },
      obstacles,
      progress: (frame) => {
        const pL = anchorPoint(body, frame, "grip_L");
        return pL.y + 0.7 * pL.x;
      },
      ground: "heel_L",
      props,
      propState: (frame) => [
        // Left hand (-X) holds opposite pulley (+X); right hand (+X) holds opposite pulley (-X).
        dHandleAligned(body, frame, "L", PULLEY_POS_X),
        dHandleAligned(body, frame, "R", PULLEY_NEG_X),
      ],
      tethers: [
        { id: "cable_L", kind: "cable", radius: 0.0045 },
        { id: "cable_R", kind: "cable", radius: 0.0045 },
      ],
      tetherState: (_frame, _extras, propStates) => [
        // Crossed cables originating cleanly from the exact swivel pulley wheels!
        { points: [PULLEY_POS_X, dHandleTop(propStates[0])] },
        { points: [PULLEY_NEG_X, dHandleTop(propStates[1])] },
      ],
      equipment: () => staticParts,
      glb: [
        {
          id: "dual-adjustable-pulley-neon",
          pos: [0, 0, -MACHINE_DIST],
          quat: quatOf([0, 1, 0], Math.PI),
          hideEquipment: true,
        },
      ],
      loads: [
        { anchor: "grip_L", share: 1, grip: "hang", pulley: PULLEY_POS_X },
        { anchor: "grip_R", share: 1, grip: "hang", pulley: PULLEY_NEG_X },
      ],
      support: { kind: "standing", brace: true },
      grip: "hang",
      cameraHint: { view: "Angle", target: [0, 1.15, -0.25] },
      laterality: "bilateral",
      contacts,
      required: [
        { label: "Left heel planted", anchor: "heel_L", surfaceY: 0 },
        { label: "Right heel planted", anchor: "heel_R", surfaceY: 0 },
        { label: "Left forefoot planted", anchor: "ballIn_L", surfaceY: 0 },
        { label: "Right forefoot planted", anchor: "ballIn_R", surfaceY: 0 },
        { label: "Left hand on cable handle", anchor: "grip_L", prop: "handle_L" },
        { label: "Right hand on cable handle", anchor: "grip_R", prop: "handle_R" },
      ],
      checks: [
        checkFlatBack(
          "Keep your torso upright with your chest up throughout the set, while all the motion occurs from your arms moving at your shoulder joints.",
        ),
        checkJointWithinAt(
          "hands-high",
          "Hands start above shoulder height",
          "In this position, your arms should resemble an 'X-shape' with each other as your hands are above shoulder height in line with the resistance from the cables.",
          "shoulder_L.elev",
          "start",
          80,
          125,
        ),
        checkJointWithinAt(
          "soft-elbows",
          "Elbows stay slightly bent",
          "Maintain slightly bent elbows throughout your set.",
          "elbow_L.flex",
          "peak",
          8,
          38,
        ),
        checkJointWithinAt(
          "elbows-back",
          "Elbows finish level with or behind shoulders",
          "Move through the full range of motion your shoulder mobility permits, which should result in your elbows being slightly behind your shoulders or at least horizontally level with your shoulders at the end range.",
          "shoulder_L.plane",
          "peak",
          -20,
          18,
        ),
        checkJointRange(
          "diagonal-sweep",
          "Arms sweep diagonally downward and outward",
          "Sweep your arms out and away from each other while driving them diagonally downward and backward.",
          "shoulder_L.elev",
          32,
        ),
        {
          id: "cables-clear-chest",
          label: "Crossed cables stay clear of torso",
          cue: "Return to being centered between the cables with your arms crossed in front of your torso, as the pulleys are situated a little in front of you.",
          evaluate: (ctx) =>
            everyFrame(
              ctx,
              (frame) => {
                const handL = anchorPoint(body, frame, "grip_L");
                const chest = anchorPoint(body, frame, "sternum");
                const denom = handL.x - PULLEY_POS_X[0];
                if (Math.abs(denom) < 1e-4) return 0;
                const t = (0 - PULLEY_POS_X[0]) / denom;
                const cableMidZ = PULLEY_POS_X[2] + t * (handL.z - PULLEY_POS_X[2]);
                // Facing -Z: front of chest is at chest.z, clear means cableMidZ < chest.z - 0.02
                return Math.max(0, (cableMidZ - (chest.z - 0.02)) * 1000);
              },
              0.5,
              " mm chest overlap",
            ),
        },
        {
          id: "diagonal-balance",
          label: "Even balance between outward and downward sweep",
          cue: "Strive to achieve a roughly even balance between sweeping horizontally outward and vertically downward.",
          evaluate: ({ frames, top, bottom }) => {
            const p0 = anchorPoint(body, frames[top], "grip_L");
            const p1 = anchorPoint(body, frames[bottom], "grip_L");
            const dx = Math.abs(p1.x - p0.x);
            const dy = Math.abs(p0.y - p1.y);
            const angle = deg(Math.atan2(dy, Math.max(dx, 1e-4)));
            return {
              pass: angle >= 28 && angle <= 62,
              measured: `hand path sweeps ${angle.toFixed(0)}° below horizontal (dx=${(dx * 100).toFixed(0)} cm, dy=${(dy * 100).toFixed(0)} cm)`,
            };
          },
        },
      ],
    };
  },
};
