import { Vector3 } from "three";
import { box } from "../equipment";
import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkJointRange, checkJointWithinAt } from "../postures";
import { pin } from "../solver";

/** One vertical handle on a plate-loaded pec deck. Arm crosses the body, then opens to a half-T. */
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
  "shoulder.twist": 6,
  "elbow.flex": 16,
  "forearm.pron": 10,
  "wrist.flex": 0,
  "clavicle.elev": 4,
  "clavicle.prot": 6,
};

const OUT = {
  "shoulder.elev": 84,
  "shoulder.plane": 12,
  "shoulder.twist": 4,
  "elbow.flex": 16,
  "forearm.pron": 8,
  "wrist.flex": 0,
  "clavicle.elev": 8,
  "clavicle.prot": -8,
};

const FREE = {
  "shoulder.elev": 16,
  "shoulder.plane": 18,
  "elbow.flex": 18,
  "forearm.pron": 10,
  "clavicle.elev": 2,
};

export const spec = buildExerciseSpec({
  id: "single-arm-plate-loaded-pec-deck-rear-delt-fly",
  catalogId: "39a5c6f170d8801badfafab7637ed42e",
  name: "Single Arm Plate-Loaded Pec Deck Rear Delt Fly",
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
  apparatus: {
    kind: "machine-handles",
    orientation: "neutral",
    sides: ["L"],
    forceDir: [0, 0, 1],
  },
  extraEquipment: [
    box("rear.pad", [0, 0.98, 0.34], [0.26, 0.32, 0.07], "pad", false),
    box("rear.post", [0, 0.52, 0.4], [0.06, 0.95, 0.06], "steel", false),
    box("plates.horn", [0.36, 0.7, -0.55], [0.26, 0.04, 0.04], "chrome", false),
    box("plates.load", [0.44, 0.7, -0.55], [0.05, 0.26, 0.26], "plate", false),
  ],
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
      "neutral",
      "Neutral grip",
      "Grasp the vertical handle with the palm facing inward.",
      "forearm_L.pron",
      "peak",
      -28,
      36,
    ),
    checkJointWithinAt(
      "across",
      "Arm starts across the body",
      "Start with the working arm fully across the body.",
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
    checkJointRange(
      "long-arc",
      "Arm sweeps through a long arc",
      "Return the arm across the body through the range the shoulder allows.",
      "shoulder_L.plane",
      28,
    ),
  ],
});
