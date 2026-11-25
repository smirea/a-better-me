import { box } from "../equipment";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** Bent over on a multi-flight. Palms in, arms arc from under the shoulders out to the sides. */
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
  "shoulder.elev": 54,
  "shoulder.plane": 74,
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
  "shoulder.plane": 4,
  "elbow.flex": 20,
  "clavicle.elev": 12,
  "clavicle.prot": -14,
};

export const spec = buildExerciseSpec({
  id: "multi-flight-rear-delt-fly",
  catalogId: "3895c6f170d880f58c37ec914c041543",
  name: "Multi Flight Rear Delt Fly",
  defaultLoadKg: 8,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Sweep", "Shoulder height", "Lower", "Together"],
  tempo: { lower: 1.5, bottom: 0.25, raise: 1.4, top: 0.3 },
  station: { kind: "standing", stanceX: 0.14, toeOutDeg: 6, torsoLeanDeg: 62 },
  apparatus: {
    kind: "machine-handles",
    orientation: "neutral",
    forceDir: [0, -1, 0.1],
  },
  extraEquipment: [
    box("mf.postL", [0.52, 0.75, -0.28], [0.06, 1.3, 0.06], "steel", false),
    box("mf.postR", [-0.52, 0.75, -0.28], [0.06, 1.3, 0.06], "steel", false),
    box("mf.pivotL", [0.52, 1.2, -0.16], [0.07, 0.07, 0.07], "accent", false),
    box("mf.pivotR", [-0.52, 1.2, -0.16], [0.07, 0.07, 0.07], "accent", false),
  ],
  stiffness: { elbow: 6, shoulder: 2, lumbar: 10, hip: 5 },
  hints: {
    start: { ...HINGE, ...HANG },
    end: { ...HINGE, ...OUT },
  },
  checks: () => [
    checkFlatBack("Keep the hinged torso still. The arms move; the lower body does not."),
    checkJointWithinAt(
      "neutral",
      "Palms face each other",
      "Grasp the handles with the elbows slightly bent and the palms facing each other.",
      "forearm_L.pron",
      "start",
      -25,
      35,
    ),
    checkJointWithinAt(
      "soft-elbows",
      "Elbows stay slightly bent",
      "Keep the slight elbow bend for the whole set.",
      "elbow_L.flex",
      "peak",
      8,
      40,
    ),
    checkJointWithinAt(
      "shoulder-height",
      "Elbows finish near shoulder height",
      "Sweep the arms out until the elbows are near shoulder height.",
      "shoulder_L.elev",
      "peak",
      78,
      120,
    ),
    checkJointRange(
      "arc",
      "Arms arc from together out to the sides",
      "Lower the arms back in toward each other under control.",
      "shoulder_L.plane",
      40,
    ),
  ],
});
