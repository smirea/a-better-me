import { Vector3 } from "three";
import { box } from "../equipment";
import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkJointRange, checkJointWithinAt } from "../postures";
import { pin } from "../solver";

/** One arm, chest toward the pad, horizontal handle, from across the body out to a half-T. */
const SEAT = {
  ...POSTURE_HINTS.seated,
  "root.pitch": 4,
  "lumbar.flex": 4,
  "thoracic.flex": 2,
  "neck.flex": 2,
};

const ACROSS = {
  "shoulder.elev": 78,
  "shoulder.plane": 86,
  "shoulder.twist": 14,
  "elbow.flex": 14,
  "forearm.pron": 70,
  "wrist.flex": 0,
  "clavicle.elev": 4,
  "clavicle.prot": 6,
};

const OUT = {
  "shoulder.elev": 84,
  "shoulder.plane": 12,
  "shoulder.twist": 12,
  "elbow.flex": 14,
  "forearm.pron": 68,
  "wrist.flex": 0,
  "clavicle.elev": 8,
  "clavicle.prot": -8,
};

const FREE = {
  "shoulder.elev": 16,
  "shoulder.plane": 18,
  "elbow.flex": 18,
  "forearm.pron": 12,
  "clavicle.elev": 2,
  "clavicle.prot": 0,
};

export const spec = buildExerciseSpec({
  id: "single-arm-machine-rear-delt-fly",
  catalogId: "2ad5c6f170d8802abf00e4d2809132fa",
  name: "Single Arm Machine Rear Delt Fly",
  defaultLoadKg: 4,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  phaseLabels: ["Sweep", "Half T", "Return", "Across"],
  tempo: { lower: 1.5, bottom: 0.25, raise: 1.4, top: 0.3 },
  station: {
    kind: "seated",
    seatY: 0.43,
    seatZ: 0,
    stanceX: 0.16,
    heelZ: 0.4,
    pinBack: false,
    passiveJoints: ["hip", "knee", "ankle"],
    frame: { type: "flat-bench", zHead: -0.15, zFoot: 0.22 },
  },
  extraEquipment: [
    box("rear.pad", [0, 0.98, 0.34], [0.26, 0.32, 0.07], "pad", false),
    box("rear.post", [0, 0.52, 0.4], [0.06, 0.95, 0.06], "steel", false),
    box("rear.stack", [0, 0.7, -0.55], [0.28, 1.15, 0.22], "plate", false),
  ],
  apparatus: {
    kind: "machine-handles",
    orientation: "horizontal",
    sides: ["L"],
    forceDir: [0, 0, 1],
  },
  stiffness: { elbow: 8, shoulder: 8, lumbar: 10 },
  extraKeyGoals: (body) => ({
    start: [pin(body, "grip_L", () => new Vector3(-0.02, 1.12, 0.38), 24)],
    end: [pin(body, "grip_L", () => new Vector3(0.46, 1.1, 0.08), 34)],
  }),
  extraContacts: {
    "bench.pad": { thigh_L: 0.05, thigh_R: 0.05, pelvis: 0.04 },
  },
  hints: {
    start: sidedHints("L", ACROSS, FREE, SEAT),
    end: sidedHints("L", OUT, FREE, SEAT),
  },
  checks: () => [
    checkJointWithinAt(
      "overhand",
      "Overhand grip",
      "Grasp the horizontal handle with the palm facing down.",
      "forearm_L.pron",
      "peak",
      45,
      95,
    ),
    checkJointWithinAt(
      "across",
      "Arm starts across the body",
      "Start with the working arm fully across the body so the rear delt is lengthened.",
      "shoulder_L.plane",
      "start",
      60,
      120,
    ),
    checkJointWithinAt(
      "half-t",
      "Arm finishes in half a T",
      "Sweep out until the arm points straight out from the shoulder.",
      "shoulder_L.plane",
      "peak",
      35,
      85,
    ),
    checkJointWithinAt(
      "elbow-quiet",
      "Elbow stays nearly straight",
      "Sweep without bending the elbow.",
      "elbow_L.flex",
      "peak",
      0,
      28,
    ),
    checkJointRange(
      "long-arc",
      "Arm sweeps through a long arc",
      "Let the arm return across the body through the range the shoulder allows.",
      "shoulder_L.plane",
      28,
    ),
  ],
});
