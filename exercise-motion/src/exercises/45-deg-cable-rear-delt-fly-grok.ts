import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import type { ExerciseSpec } from "../exercise";
import type { Vec3 } from "../math";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/**
 * Sheave centers on `cable-crossover-grok.glb` sit near (±1.26, 2.00, -0.07).
 * The station is slid forward so those sheaves stay in front of both the crossed
 * hands and the swept-back hands. The lifter stands behind that line.
 */
const MACHINE_Z = 0.5;
/** Inner-lower rim of the measured sheaves, in the shifted station. */
const PULLEY_L: Vec3 = [1.22, 1.985, 0.42];
const PULLEY_R: Vec3 = [-1.22, 1.985, 0.42];

/** Upright, a step behind the pulley line. */
const STANCE = {
  ...POSTURE_HINTS.standing,
  "root.z": -0.22,
  "knee.flex": 6,
  "hip.flex": 2,
  "lumbar.flex": 0,
  "thoracic.flex": -2,
  "neck.flex": -4,
};

/** High cross: arms up toward the cables, elbows softly bent. */
const HIGH = {
  "shoulder.elev": 102,
  "shoulder.plane": 58,
  "shoulder.twist": 8,
  "elbow.flex": 38,
  "forearm.pron": 16,
  "wrist.flex": 0,
  "clavicle.elev": 12,
  "clavicle.prot": 4,
};

/** Finish out, down, and slightly behind the chest. */
const LOW = {
  "shoulder.elev": 64,
  "shoulder.plane": -6,
  "shoulder.twist": 2,
  "elbow.flex": 22,
  "forearm.pron": 12,
  "wrist.flex": 0,
  "clavicle.elev": 6,
  "clavicle.prot": -8,
};

const base = buildExerciseSpec({
  id: "45-deg-cable-rear-delt-fly-grok",
  catalogId: "2a15c6f170d88066b38fd65f8757716f",
  name: "45° Cable Rear Delt Fly (grok)",
  defaultLoadKg: 4,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "hang",
  cameraHint: { view: "Front" },
  phaseLabels: ["Sweep", "Low", "Return", "High cross"],
  tempo: { lower: 1.5, bottom: 0.25, raise: 1.5, top: 0.3 },
  station: { kind: "standing", stanceX: 0.16, heelZ: -0.32, toeOutDeg: 8 },
  apparatus: {
    kind: "cable-dual",
    pulleyY: PULLEY_L[1],
    halfWidth: PULLEY_L[0] + 0.08,
    z: PULLEY_L[2],
    attachment: "d-handle",
    anchor: "grip",
  },
  stiffness: {
    elbow: 8,
    shoulder: 6,
    knee: 3,
    hip: 2.4,
    lumbar: 10,
    thoracic: 8,
    ankle: 2,
    wrist: 6,
    forearm: 4,
  },
  hints: {
    start: { ...STANCE, ...HIGH },
    end: { ...STANCE, ...LOW },
  },
  glb: [{ id: "cable-crossover-grok", pos: [0, 0, MACHINE_Z], hideEquipment: true }],
  checks: () => [
    checkFlatBack("Keep the torso upright with the chest up. The arms move at the shoulders."),
    checkJointWithinAt(
      "hands-high",
      "Hands start above the shoulders",
      "Start with the arms crossed and the hands above shoulder height, in line with the high cables.",
      "shoulder_L.elev",
      "start",
      78,
      125,
    ),
    checkJointWithinAt(
      "soft-elbows",
      "Elbows stay slightly bent",
      "Maintain slightly bent elbows throughout the set.",
      "elbow_L.flex",
      "peak",
      6,
      40,
    ),
    checkJointWithinAt(
      "low-finish",
      "Elbows finish out and back",
      "Finish with the elbows about level with the shoulders or slightly behind them.",
      "shoulder_L.plane",
      "peak",
      -16,
      28,
    ),
    checkJointRange(
      "diagonal",
      "Arms sweep down and out",
      "Sweep the arms equally outward and downward, then let them cross back up.",
      "shoulder_L.elev",
      28,
    ),
  ],
});

/** Same-side cable-dual tethers get swapped so each hand holds the opposite pulley. */
export const spec: ExerciseSpec = {
  ...base,
  build(body) {
    const built = base.build(body);
    const loads = built.loads.map((load) => {
      if (load.anchor.endsWith("_L")) return { ...load, pulley: PULLEY_R };
      if (load.anchor.endsWith("_R")) return { ...load, pulley: PULLEY_L };
      return load;
    });
    const inner = built.tetherState;
    return {
      ...built,
      loads,
      tetherState: inner
        ? (frame, extras, propStates) => {
            const row = inner(frame, extras, propStates);
            const leftHand = row[0].points[row[0].points.length - 1];
            const rightHand = row[1].points[row[1].points.length - 1];
            return [{ points: [PULLEY_R, leftHand] }, { points: [PULLEY_L, rightHand] }];
          }
        : undefined,
    };
  },
};
