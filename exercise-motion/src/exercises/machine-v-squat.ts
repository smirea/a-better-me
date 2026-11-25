import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { hackSquatMachine } from "../equipment";
import { checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

const MACHINE = hackSquatMachine({ angleDeg: 68 }).parts.map((part) => ({
  ...part,
  collide: false,
  pos: [part.pos[0], part.pos[1] - 0.16, part.pos[2] - 0.4] as [number, number, number],
}));

/** V-squat: back on the angled pad, shoulders under the pads, feet on the tilted plate. Quad-biased and upright. */
const ARMS = {
  "clavicle.elev": 4,
  "shoulder.elev": 22,
  "shoulder.plane": 18,
  "elbow.flex": 48,
  "forearm.pron": 20,
  "wrist.flex": 6,
};

const UP = {
  ...POSTURE_HINTS.standing,
  "root.y": 0.94,
  "root.z": 0.0,
  "root.pitch": 2,
  "hip.flex": 14,
  "hip.abd": 8,
  "hip.rot": 6,
  "knee.flex": 12,
  "ankle.dorsi": 18,
  "lumbar.flex": 2,
  "thoracic.flex": 0,
  "neck.flex": 2,
  ...ARMS,
};

export const spec = buildExerciseSpec({
  id: "machine-v-squat",
  catalogId: "1a25c6f170d8809cbb0bc4413178b159",
  name: "Machine V-Squat",
  defaultLoadKg: 25,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  cameraHint: { view: "Side" },
  phaseLabels: ["Lower", "Bottom", "Drive", "Stand"],
  tempo: { lower: 1.7, bottom: 0.2, raise: 1.3, top: 0.4 },
  station: { kind: "standing", stanceX: 0.15, toeOutDeg: 10, trackKnees: 10, heelZ: 0.08 },
  apparatus: { kind: "barbell", style: "ssb", gripX: 0.36, anchor: "grip", restAnchor: "traps", skipHandRequired: true },
  extraEquipment: MACHINE,
  stiffness: { lumbar: 6.5, thoracic: 6, knee: 0.7, hip: 0.85 },
  hints: {
    start: UP,
    end: {
      ...UP,
      "root.y": 0.5,
      "root.z": -0.02,
      "root.pitch": 8,
      "hip.flex": 70,
      "hip.abd": 14,
      "knee.flex": 130,
      "ankle.dorsi": 34,
    },
  },
  checks: () => [
    checkFlatBack("Keep the whole back snug on the back pad. Stop if the hip bones start to curl off the pad.", 12),
    checkNeutralNeck("Keep the neck near neutral whether the head rests on the pad or sits just in front of it."),
    checkFeetPlanted("Keep the entire sole, including the heel, planted on the angled foot plate."),
    checkJointWithinAt(
      "upright-back",
      "Hips stay under a tall torso",
      "The V-squat keeps the torso nearly upright against the pad, so the hips do not fold as far as a free squat.",
      "hip_L.flex",
      "bottom",
      45,
      90,
    ),
    checkJointRange(
      "knee-rom",
      "Knees do most of the work",
      "Squat by bending the knees through at least 90 degrees, then drive the feet into the plate to stand.",
      "knee_L.flex",
      60,
    ),
    checkJointWithinAt(
      "soft-lock",
      "Knees finish straight or nearly straight",
      "Stand until the knees are straight or just slightly bent before the next descent.",
      "knee_L.flex",
      "top",
      2,
      26,
    ),
  ],
});
