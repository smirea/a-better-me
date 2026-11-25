import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { box, hackSquatMachine } from "../equipment";
import { checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

const MACHINE = hackSquatMachine({ angleDeg: 58 }).parts.map((part) => ({
  ...part,
  collide: false,
  pos: [part.pos[0], part.pos[1] - 0.16, part.pos[2] - 0.4] as [number, number, number],
}));

/** Rear-pivot power squat: shoulders under the pads, chest facing away from the pivot, torso stays tall. */
const ARMS = {
  "clavicle.elev": 6,
  "shoulder.elev": 42,
  "shoulder.plane": -18,
  "shoulder.twist": -40,
  "elbow.flex": 110,
  "forearm.pron": 40,
  "wrist.flex": -8,
};

const UP = {
  ...POSTURE_HINTS.standing,
  "root.y": 0.94,
  "root.z": 0.02,
  "root.pitch": 4,
  "hip.flex": 16,
  "hip.abd": 10,
  "hip.rot": 8,
  "knee.flex": 14,
  "ankle.dorsi": 18,
  "lumbar.flex": 2,
  "thoracic.flex": 0,
  "neck.flex": 2,
  ...ARMS,
};

export const spec = buildExerciseSpec({
  id: "pro-power-squat",
  catalogId: "2fe5c6f170d880b8a7b5c9524731a1bb",
  name: "Pro Power Squat",
  defaultLoadKg: 20,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  cameraHint: { view: "Side" },
  phaseLabels: ["Lower", "Bottom", "Drive", "Stand"],
  tempo: { lower: 1.8, bottom: 0.25, raise: 1.4, top: 0.4 },
  station: { kind: "standing", stanceX: 0.16, toeOutDeg: 12, trackKnees: 12, heelZ: 0.06 },
  apparatus: { kind: "barbell", style: "ssb", gripX: 0.28, anchor: "press", restAnchor: "traps" },
  extraEquipment: [
    ...MACHINE,
    box("power.pivot", [0, 0.7, -0.7], [0.12, 1.2, 0.12], "steel", false),
  ],
  stiffness: { lumbar: 6, thoracic: 5.5, knee: 0.8, hip: 0.7, ankle: 0.6 },
  hints: {
    start: UP,
    end: {
      ...UP,
      "root.y": 0.5,
      "root.z": -0.04,
      "root.pitch": 10,
      "hip.flex": 88,
      "hip.abd": 16,
      "knee.flex": 128,
      "ankle.dorsi": 32,
    },
  },
  checks: () => [
    checkFlatBack("Keep the chest up and the lower back flat while the shoulders stay under the pads.", 14),
    checkNeutralNeck("Keep the neck near neutral, looking forward rather than craning up or tucking the chin."),
    checkFeetPlanted("Keep the whole sole of each foot on the footplate, pushing evenly through the foot."),
    checkJointWithinAt(
      "upright",
      "Torso stays tall off the rear pivot",
      "A power squat faces away from the rear pivot so the hips stay under the shoulders instead of folding into a hinge.",
      "hip_L.flex",
      "bottom",
      60,
      100,
    ),
    checkJointRange(
      "knee-rom",
      "Knees bend to about parallel or deeper",
      "Squat until the knees are bent at least about 90 degrees, then drive the feet into the plate to stand.",
      "knee_L.flex",
      70,
    ),
    checkJointWithinAt(
      "soft-lock",
      "Knees finish softly straight",
      "Stand until the knees are straight or only slightly bent. Do not snap them into a hard lock.",
      "knee_L.flex",
      "top",
      4,
      28,
    ),
  ],
});
