import { box } from "../equipment";
import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

const HINGE = {
  ...POSTURE_HINTS.standing,
  "root.y": 0.88,
  "root.z": 0.02,
  "root.pitch": 64,
  "hip.flex": 80,
  "hip.abd": 8,
  "knee.flex": 24,
  "ankle.dorsi": 8,
  "lumbar.flex": 6,
  "thoracic.flex": 8,
  "neck.flex": -6,
};

const HANG = {
  "shoulder.elev": 52,
  "shoulder.plane": 78,
  "shoulder.twist": 4,
  "elbow.flex": 18,
  "forearm.pron": 8,
  "wrist.flex": 0,
  "clavicle.elev": 4,
  "clavicle.prot": 4,
};

const OUT = {
  ...HANG,
  "shoulder.elev": 96,
  "shoulder.plane": 2,
  "elbow.flex": 20,
  "clavicle.elev": 12,
  "clavicle.prot": -12,
};

const FREE = {
  "shoulder.elev": 40,
  "shoulder.plane": 70,
  "elbow.flex": 16,
  "forearm.pron": 8,
  "clavicle.elev": 2,
  "clavicle.prot": 2,
};

export const spec = buildExerciseSpec({
  id: "single-arm-multi-flight-rear-delt-fly",
  catalogId: "39a5c6f170d880da819ed45a1e8a25b6",
  name: "Single Arm Multi Flight Rear Delt Fly",
  defaultLoadKg: 4,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  phaseLabels: ["Sweep", "Shoulder height", "Lower", "Under shoulder"],
  tempo: { lower: 1.5, bottom: 0.25, raise: 1.4, top: 0.3 },
  station: { kind: "standing", stanceX: 0.14, toeOutDeg: 6, torsoLeanDeg: 62 },
  apparatus: {
    kind: "machine-handles",
    orientation: "neutral",
    sides: ["L"],
    forceDir: [0, -1, 0.1],
  },
  extraEquipment: [
    box("mf.postL", [0.52, 0.75, -0.28], [0.06, 1.3, 0.06], "steel", false),
    box("mf.postR", [-0.52, 0.75, -0.28], [0.06, 1.3, 0.06], "steel", false),
  ],
  stiffness: { elbow: 6, shoulder: 2, lumbar: 10, hip: 5 },
  hints: {
    start: sidedHints("L", HANG, FREE, HINGE),
    end: sidedHints("L", OUT, FREE, HINGE),
  },
  checks: () => [
    checkFlatBack("Keep the hinged torso still. Only the working arm moves."),
    checkJointWithinAt(
      "neutral",
      "Palm faces in",
      "Grasp the handle with a slightly bent elbow and the palm facing in.",
      "forearm_L.pron",
      "start",
      -25,
      35,
    ),
    checkJointWithinAt(
      "soft-elbow",
      "Elbow stays slightly bent",
      "Keep the slight elbow bend for the whole set.",
      "elbow_L.flex",
      "peak",
      8,
      40,
    ),
    checkJointWithinAt(
      "shoulder-height",
      "Elbow finishes near shoulder height",
      "Sweep the arm out and up until the elbow is near shoulder height.",
      "shoulder_L.elev",
      "peak",
      78,
      125,
    ),
    checkJointRange(
      "arc",
      "Arm arcs from under the shoulder out to the side",
      "Lower the arm back under the shoulder under control.",
      "shoulder_L.elev",
      28,
    ),
  ],
});
