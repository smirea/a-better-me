import { Vector3 } from "three";
import { box } from "../equipment";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkJointRange, checkJointWithinAt } from "../postures";
import { pin } from "../solver";

/** Plate-loaded reverse pec deck. Vertical handles, palms in, chest on the pad. */
const SEAT = {
  ...POSTURE_HINTS.seated,
  "root.pitch": 4,
  "lumbar.flex": 4,
  "thoracic.flex": 2,
  "neck.flex": 2,
};

const IN = {
  "shoulder.elev": 78,
  "shoulder.plane": 88,
  "shoulder.twist": 4,
  "elbow.flex": 22,
  "forearm.pron": 8,
  "wrist.flex": 0,
  "clavicle.elev": 4,
  "clavicle.prot": 8,
};

const OUT = {
  "shoulder.elev": 84,
  "shoulder.plane": 10,
  "shoulder.twist": 2,
  "elbow.flex": 20,
  "forearm.pron": 6,
  "wrist.flex": 0,
  "clavicle.elev": 8,
  "clavicle.prot": -14,
};

export const spec = buildExerciseSpec({
  id: "plate-loaded-machine-rear-delt-fly",
  catalogId: "2f25c6f170d880d988d2eb4da119664b",
  name: "Plate-Loaded Machine Rear Delt Fly",
  defaultLoadKg: 8,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Open", "T", "Return", "Together"],
  tempo: { lower: 1.5, bottom: 0.25, raise: 1.4, top: 0.3 },
  station: {
    kind: "seated",
    seatY: 0.43,
    seatZ: 0,
    stanceX: 0.18,
    heelZ: 0.42,
    pinBack: false,
    passiveJoints: ["hip", "knee", "ankle"],
    frame: { type: "flat-bench", zHead: -0.15, zFoot: 0.22 },
  },
  apparatus: {
    kind: "machine-handles",
    orientation: "neutral",
    forceDir: [0, 0, 1],
  },
  extraEquipment: [
    box("rear.pad", [0, 0.98, 0.34], [0.26, 0.32, 0.07], "pad", false),
    box("rear.post", [0, 0.52, 0.4], [0.06, 0.95, 0.06], "steel", false),
    box("plates.horn", [0.34, 0.72, -0.55], [0.28, 0.04, 0.04], "chrome", false),
    box("plates.load", [0.42, 0.72, -0.55], [0.06, 0.28, 0.28], "plate", false),
  ],
  stiffness: { elbow: 8, shoulder: 8, lumbar: 10 },
  extraKeyGoals: (body) => ({
    start: [
      pin(body, "grip_L", () => new Vector3(0.05, 1.16, 0.36), 22),
      pin(body, "grip_R", () => new Vector3(-0.05, 1.04, 0.36), 22),
    ],
    end: [
      pin(body, "grip_L", () => new Vector3(0.46, 1.1, 0.08), 32),
      pin(body, "grip_R", () => new Vector3(-0.46, 1.1, 0.08), 32),
    ],
  }),
  extraContacts: {
    "bench.pad": { thigh_L: 0.05, thigh_R: 0.05, pelvis: 0.04 },
  },
  hints: {
    start: { ...SEAT, ...IN },
    end: { ...SEAT, ...OUT },
  },
  checks: () => [
    checkJointWithinAt(
      "neutral-grip",
      "Palms face each other",
      "Grasp the vertical handles with the palms facing in toward each other.",
      "forearm_L.pron",
      "peak",
      -28,
      35,
    ),
    checkJointWithinAt(
      "soft-elbows",
      "Elbows stay slightly bent",
      "Keep a slight bend in the elbows for the whole set.",
      "elbow_L.flex",
      "peak",
      8,
      42,
    ),
    checkJointWithinAt(
      "t-shape",
      "Arms finish in a T",
      "Spread the handles back until the arms and torso form a T.",
      "shoulder_L.plane",
      "peak",
      -10,
      50,
    ),
    checkJointRange(
      "reverse-fly",
      "Handles travel from together to a T",
      "Bring the handles forward and toward each other to return.",
      "shoulder_L.plane",
      30,
    ),
  ],
});
