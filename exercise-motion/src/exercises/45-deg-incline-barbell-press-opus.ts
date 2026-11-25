import { Vector3 } from "three";
import { anchorPoint, SIDES, sideSign, type Body, type Frame } from "../body";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { BAR_RADIUS, box, compileParts, cylinder, type Part, type PropDef } from "../equipment";
import type { Built, ExerciseSpec, FormCheck } from "../exercise";
import type { Vec3 } from "../math";
import { checkAnchorTravel, checkFeetPlanted, checkJointRange, checkJointWithinAt } from "../postures";
import { pin } from "../solver";

/**
 * Catalog setup "adjustable bench and power rack": the real adjustable bench GLB, its backrest re-hinged in
 * Blender from the stock 37° to 45° (pad, rail, bracket and adjustment rod all follow), inside the real half
 * rack GLB. The rack's bar and plates were split into their own GLB prop and the J-hooks into a `jhooks` node
 * that is lowered to the lifter's unrack height, and the safety arms into a `safeties` node raised to just under the bar's lowest point. The GLB backrest plane (y = 0.745 - z before `BENCH_POS`)
 * coincides with the builder's 45° adjustable bench hinged at (y 0.44, z -0.05), so the solver's pad is the
 * rendered pad. The stock fixed Olympic incline bench was rejected because its backrest is only 30°.
 */
const BENCH_POS: Vec3 = [0, 0, -0.355];
const RACK_POS: Vec3 = [0, 0, -0.6];
/** Bar resting in the stock J-hooks, in rack coordinates. */
const STOCK_BAR_REST = { y: 1.778, z: 0.074 };
/** Front edge of the J-hook lip, in rack coordinates. */
const STOCK_HOOK_LIP_Z = 0.154;

const GRIP_X = 0.345;
const LOCKOUT = { y: 1.5, z: -0.4 };
const CHEST = { y: 1.02, z: -0.235 };
/** Instructions: after unracking, the bar sits about 5 cm above the J-hooks. */
const HOOK_DROP = LOCKOUT.y - 0.05 - STOCK_BAR_REST.y;
/** Instructions: safety arms slightly under the lowest point the bar reaches (stock arm top is y 0.864). */
const SAFETY_RAISE = CHEST.y - BAR_RADIUS - 0.03 - 0.864;

const SEAT: Part = box("bench.seatPad", [0, 0.4075, 0.07], [0.32, 0.065, 0.25], "pad");

const BAR: PropDef = {
  id: "bar",
  kind: "glb",
  glbId: "olympicbar-opus",
  colliders: [cylinder("bar.shaft", [0, 0, 0], BAR_RADIUS, 1.49, "chrome")],
};

function hookParts(): Part[] {
  const restY = STOCK_BAR_REST.y + HOOK_DROP;
  const z = RACK_POS[2] + STOCK_BAR_REST.z;
  return [1, -1].flatMap((s) => [
    box(`rack.hook_${s > 0 ? "L" : "R"}`, [s * 0.585, restY - BAR_RADIUS - 0.015, z], [0.07, 0.03, 0.2], "steel", false),
    box(`rack.upright_${s > 0 ? "L" : "R"}`, [s * 0.585, 1.18, RACK_POS[2] - 0.08], [0.08, 2.36, 0.08], "steel", false),
  ]);
}

function barClearsHooks(): FormCheck {
  return {
    id: "bar-clears-hooks",
    label: "Shoulders sit in front of the J-hooks",
    cue: "With the appropriate bench placement, your shoulders should now be a little in front of the front edge of the J-hooks. If your shoulders are under the J-hooks, you may bump the J-hooks with the bar when pressing the bar up.",
    evaluate: ({ body, frames, sequence }) => {
      const lip = RACK_POS[2] + STOCK_HOOK_LIP_Z;
      let gap = Infinity;
      sequence.propStates.forEach((states) => (gap = Math.min(gap, states[0].pos[2] - BAR_RADIUS - lip)));
      const shoulder = anchorPoint(body, frames[0], "shoulderTop_L").z - lip;
      return {
        pass: gap >= 0.03 && shoulder > 0,
        measured: `bar stays ${(gap * 100).toFixed(1)} cm in front of the hook lips; shoulders ${(shoulder * 100).toFixed(0)} cm in front`,
      };
    },
  };
}

function forearmsVertical(): FormCheck {
  return {
    id: "forearms-vertical",
    label: "Elbows stacked under the wrists",
    cue: "Strive to keep your elbows stacked underneath (when viewed from the side) your mostly straight wrists as your forearms remain close to vertical throughout the set.",
    evaluate: ({ body, frames }) => {
      let worst = 0;
      frames.forEach((frame: Frame) => {
        const e = anchorPoint(body, frame, "elbowTip_L");
        const w = anchorPoint(body, frame, "press_L");
        const len = Math.hypot(w.y - e.y, w.z - e.z);
        if (len > 0.15) worst = Math.max(worst, (Math.abs(Math.atan2(w.z - e.z, w.y - e.y)) * 180) / Math.PI);
      });
      return { pass: worst <= 25, measured: `forearm leans up to ${worst.toFixed(0)}° from vertical (side view)` };
    },
  };
}

const TRUNK = {
  ...POSTURE_HINTS.incline45,
  "root.y": 0.53,
  "root.z": 0.02,
  "lumbar.flex": -8,
  "thoracic.flex": -4,
  "neck.flex": 8,
  "clavicle.prot": -14,
  "clavicle.elev": 2,
};

const base = buildExerciseSpec({
  id: "45-deg-incline-barbell-press-opus",
  catalogId: "1a05c6f170d880198e1aceac084f30eb",
  name: "45° Incline Barbell Press (opus)",
  defaultLoadKg: 60,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Lower", "Upper chest", "Press", "Lockout"],
  tempo: { lower: 2, bottom: 0.25, raise: 1.25, top: 0.55 },
  station: {
    kind: "lying",
    surface: "adjustable-bench",
    face: "up",
    backAngleDeg: 45,
    benchTopY: 0.44,
    stanceX: 0.22,
    heelZ: 0.4,
    feetOnFloor: true,
  },
  apparatus: {
    kind: "barbell",
    gripX: GRIP_X,
    anchor: "press",
    path: { startY: LOCKOUT.y, startZ: LOCKOUT.z, endY: CHEST.y, endZ: CHEST.z, arcBulgeZ: 0.03 },
  },
  hints: {
    start: {
      ...TRUNK,
      "shoulder.elev": 112,
      "shoulder.plane": 70,
      "shoulder.twist": 30,
      "elbow.flex": 8,
      "forearm.pron": 30,
      "wrist.flex": -8,
    },
    end: {
      ...TRUNK,
      "shoulder.elev": 72,
      "shoulder.plane": 18,
      "shoulder.twist": 20,
      "elbow.flex": 100,
      "forearm.pron": 40,
      "wrist.flex": -10,
    },
  },
  extraKeyGoals: (body) => ({
    end: SIDES.map((side) =>
      pin(body, `elbowTip_${side}`, () => new Vector3(sideSign(side) * 0.5, CHEST.y - 0.27, CHEST.z + 0.03), 14),
    ),
  }),
  stiffness: { shoulder: 0.7, elbow: 4, lumbar: 5, thoracic: 5, clavicle: 3.5 },
  checks: () => [
    checkFeetPlanted("Firmly place your feet flat on the ground approximately shoulder-width apart with your knees bent."),
    checkJointWithinAt(
      "elbows-locked",
      "Elbows straight at lockout",
      "You should finish with your elbows fully straightened and the bar situated above your shoulders.",
      "elbow_L.flex",
      "start",
      0,
      20,
    ),
    checkJointWithinAt(
      "upper-chest",
      "Bar taps the upper chest",
      "Descend until you are able to tap your upper chest lightly with the bar.",
      "elbow_L.flex",
      "peak",
      80,
      125,
    ),
    checkJointWithinAt(
      "elbow-flare",
      "Upper arms 45–75° from the torso at the bottom",
      "Near the bottom of the rep, the proper balance should result in your upper arms forming approximately 45-75-degree angles with your torso.",
      "shoulder_L.abd",
      "peak",
      45,
      80,
    ),
    forearmsVertical(),
    barClearsHooks(),
    checkJointRange(
      "shoulder-rom",
      "Shoulders flex and horizontally flex",
      "Reverse the movement by pressing the bar up. It may help to focus on driving your elbows upward and inward.",
      "shoulder_L.elev",
      25,
    ),
    checkAnchorTravel("bar-rises", "Bar travels from chest to lockout", "Press the bar up until the elbows are straight.", "press_L", "y", 0.25),
  ],
});

export const spec: ExerciseSpec = {
  ...base,
  build(body: Body): Built {
    const built = base.build(body);
    const seatAllow = built.contacts["bench.seatPad"] ?? {};
    const hooks = hookParts();
    return {
      ...built,
      props: built.props.map((p) => (p.id === "bar" ? BAR : p)),
      obstacles: [
        ...built.obstacles.filter((o) => o.shape.part.id !== "bench.seatPad"),
        ...compileParts([SEAT]).map((shape) => ({ shape, allow: seatAllow })),
      ],
      equipment: (keys) => [
        ...built.equipment(keys).map((part) => (part.id === "bench.seatPad" ? SEAT : part)),
        ...hooks,
      ],
      glb: [
        { id: "adjustablebench45-opus", pos: BENCH_POS, hideEquipment: true },
        { id: "olympichalfrack-opus", pos: RACK_POS, hideEquipment: true },
      ],
      glbState: () => [
        [],
        [
          { node: "jhooks", posOffset: [0, HOOK_DROP, 0] },
          { node: "safeties", posOffset: [0, SAFETY_RAISE, 0] },
        ],
      ],
      cameraHint: { view: "Angle" },
    };
  },
};
