import { Vector3 } from "three";
import { buildExerciseSpec } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { pin } from "../solver";

const ARMS = {
  "shoulder.plane": 85,
  "shoulder.twist": 8,
  "elbow.flex": 6,
  "forearm.pron": 70,
  "wrist.flex": 4,
};

export const spec = buildExerciseSpec({
  id: "weighted-roman-chair-hip-hinge",
  catalogId: "1a35c6f170d880e2bf67fe2d8892d98c",
  name: "Weighted Roman Chair Hip Hinge",
  defaultLoadKg: 15,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Hinge", "Stretch", "Raise", "Aligned"],
  tempo: { lower: 2.2, bottom: 0.3, raise: 1.6, top: 0.55 },
  station: { kind: "roman-chair", padY: 0.9 },
  apparatus: { kind: "plate", twoHandsOnOne: true },
  hints: {
    start: {
      "root.y": 0.98,
      "root.z": 0.22,
      "root.pitch": 8,
      "hip.flex": 18,
      "hip.abd": 6,
      "knee.flex": 6,
      "ankle.dorsi": 8,
      "lumbar.flex": 0,
      "thoracic.flex": 2,
      "neck.flex": 0,
      ...ARMS,
      "shoulder.elev": 22,
    },
    end: {
      "root.y": 0.9,
      "root.z": 0.34,
      "root.pitch": 28,
      "hip.flex": 32,
      "hip.abd": 4,
      "knee.flex": 8,
      "ankle.dorsi": 6,
      "lumbar.flex": 4,
      "thoracic.flex": 8,
      "neck.flex": -8,
      ...ARMS,
      "shoulder.elev": 40,
    },
  },
  extraGoals: (body) => [pin(body, "pelvisFront", () => new Vector3(0, 0.9, 0.04), 55)],
  checks: () => [
    checkFlatBack(
      "Nearly all of the motion should occur from you moving at your hips as you keep your trunk in a static position that maintains the natural curvature of your lower back.",
      12,
    ),
    checkNeutralNeck(
      "Throughout your set, keep your lower back and neck near a neutral position, like you have when you are normally standing upright and looking straight ahead.",
    ),
    checkJointRange(
      "hip-hinge",
      "Hips travel through a long arc",
      "Most people will be able to descend until their shoulders are lower than their hips.",
      "hip_L.flex",
      3,
    ),
    checkJointWithinAt(
      "straight-knees",
      "Knees stay nearly straight",
      "Maintain a straight knee position throughout your set, but you should avoid intentionally locking your knees out by squeezing your quads.",
      "knee_L.flex",
      "bottom",
      -8,
      20,
    ),
    checkJointWithinAt(
      "aligned-top",
      "Legs and torso line up at the top",
      "Lift your torso up through your hips until you can draw approximately a straight line from your legs through your hips and to your torso.",
      "hip_L.flex",
      "start",
      0,
      30,
    ),
  ],
});
