import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { box } from "../equipment";
import { checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Plate-loaded power runner: split stance, chest toward the pad, shoulders under the pads. */
const TRUNK = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 4,
  "lumbar.flex": 2,
  "thoracic.flex": 2,
  "neck.flex": 4,
  "clavicle.elev": 6,
  "shoulder.elev": 48,
  "shoulder.plane": 72,
  "shoulder.twist": 18,
  "elbow.flex": 112,
  "forearm.pron": -50,
  "wrist.flex": 8,
};

const FRONT_UP = { "hip.flex": 26, "hip.abd": 8, "knee.flex": 26, "ankle.dorsi": 8 };
const REAR_UP = { "hip.flex": 22, "hip.abd": 8, "knee.flex": 28, "ankle.dorsi": -8 };
const FRONT_DOWN = { "hip.flex": 84, "hip.abd": 12, "knee.flex": 94, "ankle.dorsi": 16 };
const REAR_DOWN = { "hip.flex": 34, "hip.abd": 8, "knee.flex": 98, "ankle.dorsi": -6 };

export const spec = buildExerciseSpec({
  id: "power-runner-squat",
  catalogId: "3aa5c6f170d880379b48cd1aa59d95ea",
  name: "Power Runner Squat",
  defaultLoadKg: 12,
  loadUnit: "total",
  laterality: "asymmetrical",
  grip: "hang",
  cameraHint: { view: "Side" },
  phaseLabels: ["Lower", "Bottom", "Drive", "Stand"],
  tempo: { lower: 1.6, bottom: 0.2, raise: 1.3, top: 0.35 },
  station: {
    kind: "standing",
    stanceX: 0.14,
    toeOutDeg: 8,
    trackKnees: 10,
    split: { frontSide: "L", frontZ: 0.22, rearZ: -0.3, rearMode: "toe", rearY: 0.06 },
  },
  apparatus: { kind: "kettlebells", twoHandsOnOne: true },
  extraEquipment: [
    box("runner.chest", [0, 1.05, 0.42], [0.36, 0.28, 0.08], "pad", false),
    box("runner.post", [0, 0.55, 0.5], [0.08, 1.05, 0.08], "steel", false),
  ],
  hints: {
    start: sidedHints("L", FRONT_UP, REAR_UP, TRUNK),
    end: sidedHints("L", FRONT_DOWN, REAR_DOWN, { ...TRUNK, "root.y": 0.72, "root.z": 0.02, "root.pitch": 10 }),
  },
  checks: () => [
    checkFlatBack("Keep the chest toward the pad and the lower back flat as the front thigh drops.", 12),
    checkNeutralNeck("Keep the neck near neutral while the shoulders stay under the pads."),
    checkFeetPlanted("Keep the whole front foot on the platform.", ["L"]),
    checkJointRange(
      "front-knee",
      "Front knee does the squat",
      "Lower the front thigh toward parallel, then drive that foot through to stand.",
      "knee_L.flex",
      50,
    ),
    checkJointWithinAt(
      "soft-front-knee",
      "Front knee stays slightly bent at the top",
      "Finish the ascent with the front knee straight or only slightly bent.",
      "knee_L.flex",
      "top",
      12,
      42,
    ),
    checkJointWithinAt(
      "rear-stays-back",
      "Rear leg stays in the split",
      "The rear foot stays back on the ball of the foot while the front leg does the press.",
      "hip_R.flex",
      "bottom",
      10,
      55,
    ),
  ],
});
