import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { hackSquatMachine } from "../equipment";
import { checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

const MACHINE = hackSquatMachine({ angleDeg: 40 }).parts.map((part) => ({
  ...part,
  collide: false,
  pos: [part.pos[0], part.pos[1] - 0.16, part.pos[2] - 0.4] as [number, number, number],
}));

const ARMS = {
  "clavicle.elev": 4,
  "shoulder.elev": 28,
  "shoulder.plane": 12,
  "shoulder.twist": 6,
  "elbow.flex": 36,
  "forearm.pron": 30,
  "wrist.flex": 4,
};

const UP = {
  ...POSTURE_HINTS.standing,
  "root.y": 0.94,
  "root.z": 0.02,
  "root.pitch": 8,
  "hip.flex": 18,
  "hip.abd": 10,
  "hip.rot": 10,
  "knee.flex": 16,
  "ankle.dorsi": 16,
  "lumbar.flex": 2,
  "thoracic.flex": 2,
  "neck.flex": 2,
  ...ARMS,
};

export const spec = buildExerciseSpec({
  id: "leverage-machine-squat",
  catalogId: "2fe5c6f170d8809c9102d308364d3f41",
  name: "Leverage Machine Squat",
  defaultLoadKg: 25,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  cameraHint: { view: "Side" },
  phaseLabels: ["Lower", "Bottom", "Drive", "Stand"],
  tempo: { lower: 1.8, bottom: 0.25, raise: 1.4, top: 0.4 },
  station: { kind: "standing", stanceX: 0.17, toeOutDeg: 14, trackKnees: 12, heelZ: 0.04 },
  apparatus: { kind: "barbell", style: "ssb", gripX: 0.34, anchor: "grip", restAnchor: "traps", skipHandRequired: true },
  extraEquipment: MACHINE,
  stiffness: { lumbar: 6, thoracic: 5.5, knee: 0.8, hip: 0.7 },
  hints: {
    start: UP,
    end: {
      ...UP,
      "root.y": 0.55,
      "root.z": -0.06,
      "root.pitch": 22,
      "hip.flex": 100,
      "hip.abd": 16,
      "knee.flex": 118,
      "ankle.dorsi": 22,
    },
  },
  checks: () => [
    checkFlatBack(
      "Squat with the chest up and the lower back flat. Stop before the back has to round to go deeper.",
      14,
    ),
    checkNeutralNeck("Keep the back and neck near neutral, as when standing upright and looking straight ahead."),
    checkFeetPlanted("Keep the entire sole of each foot planted on the footplate while the shoulders stay under the pads."),
    checkJointRange(
      "knee-rom",
      "Full leverage-squat depth",
      "Bend the hips and knees together until the knees are bent by at least 90 degrees, then drive back up.",
      "knee_L.flex",
      75,
    ),
    checkJointRange(
      "hip-rom",
      "Hips fold and extend",
      "The lever arm rides on the shoulders while the hips and knees extend together to stand.",
      "hip_L.flex",
      50,
    ),
    checkJointWithinAt(
      "soft-lock",
      "Stand to a soft knee",
      "Finish upright with the knees straight or ever so slightly bent, without snapping the lockout.",
      "knee_L.flex",
      "top",
      4,
      30,
    ),
  ],
});
