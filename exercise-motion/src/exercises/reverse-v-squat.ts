import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { box } from "../equipment";
import { checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/**
 * Reverse V-squat: face into the pad, chest on the backrest, hips travel back
 * so glutes and hamstrings share the squat with the quads.
 */
const ARMS = {
  "clavicle.elev": 6,
  "shoulder.elev": 30,
  "shoulder.plane": 40,
  "elbow.flex": 55,
  "forearm.pron": 16,
  "wrist.flex": 4,
};

const UP = {
  ...POSTURE_HINTS.standing,
  "root.y": 0.96,
  "root.z": 0.02,
  "root.pitch": 12,
  "hip.flex": 22,
  "hip.abd": 8,
  "hip.rot": 6,
  "knee.flex": 18,
  "ankle.dorsi": 6,
  "lumbar.flex": 4,
  "thoracic.flex": 2,
  "neck.flex": 6,
  ...ARMS,
};

export const spec = buildExerciseSpec({
  id: "reverse-v-squat",
  catalogId: "3835c6f170d8806eaf00e87a208ff5c0",
  name: "Reverse V-Squat",
  defaultLoadKg: 20,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  cameraHint: { view: "Side" },
  phaseLabels: ["Hinge", "Bottom", "Drive", "Stand"],
  tempo: { lower: 1.8, bottom: 0.25, raise: 1.4, top: 0.4 },
  station: { kind: "standing", stanceX: 0.16, toeOutDeg: 12, trackKnees: 10, heelZ: 0.02 },
  apparatus: { kind: "barbell", style: "ssb", gripX: 0.34, anchor: "grip", restAnchor: "traps", skipHandRequired: true },
  extraEquipment: [
    box("reverse.chest", [0, 1.12, 0.38], [0.4, 0.46, 0.08], "pad", false),
    box("reverse.post", [0, 0.6, 0.48], [0.1, 1.15, 0.1], "steel", false),
    box("reverse.plate", [0, 0.04, 0.16], [0.7, 0.06, 0.55], "steel", false),
  ],
  stiffness: { lumbar: 6, hip: 0.65, knee: 0.8 },
  hints: {
    start: UP,
    end: {
      ...UP,
      "root.y": 0.64,
      "root.z": -0.1,
      "root.pitch": 38,
      "hip.flex": 88,
      "hip.abd": 12,
      "knee.flex": 78,
      "ankle.dorsi": 12,
    },
  },
  checks: () => [
    checkFlatBack(
      "Face the pad with the chest supported and hinge the hips back. Keep the lower back from rounding.",
      14,
    ),
    checkNeutralNeck("Keep the neck near neutral as the chest stays against the pad."),
    checkFeetPlanted("Keep both soles planted while the hips travel back."),
    checkJointRange(
      "hip-hinge",
      "Hips travel back",
      "Sit the hips back into the reverse V so the glutes and hamstrings load with the quads.",
      "hip_L.flex",
      45,
    ),
    checkJointWithinAt(
      "forward-torso",
      "Hips sit back toward the pad",
      "Facing the pad, the hips travel farther back than the knees, unlike a back-supported V-squat.",
      "hip_L.flex",
      "bottom",
      70,
      110,
    ),
    checkJointRange(
      "knee-rom",
      "Knees bend with the hinge",
      "Bend the knees as the hips sit back, then drive the feet through to stand tall.",
      "knee_L.flex",
      40,
    ),
  ],
});
