import { Vector3 } from "three";
import { buildExerciseSpec } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { lockAngle, pin } from "../solver";

/** Kettlebell held to the chest. */
const ARMS = {
  "shoulder.plane": 70,
  "shoulder.twist": 10,
  "elbow.flex": 108,
  "forearm.pron": 20,
  "wrist.flex": 8,
};

export const spec = buildExerciseSpec({
  id: "goblet-roman-chair-hip-hinge",
  catalogId: "1a35c6f170d880f2bac4d9f97e2077ca",
  name: "Goblet Roman Chair Hip Hinge",
  defaultLoadKg: 6,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Hinge", "Stretch", "Raise", "Aligned"],
  tempo: { lower: 2.2, bottom: 0.3, raise: 1.6, top: 0.5 },
  station: { kind: "roman-chair", padY: 0.9 },
  apparatus: { kind: "kettlebells", twoHandsOnOne: true },
  extraContacts: { "roman.hipPad": { thigh_L: 0.08, thigh_R: 0.08, pelvis: 0.06 } },
  extraGoals: (body) => [pin(body, "pelvisFront", () => new Vector3(0, 0.9, 0.04), 50)],
  extraKeyGoals: (body) => ({
    start: [lockAngle(body, "hip_L.flex", 16, 24), lockAngle(body, "hip_R.flex", 16, 24)],
    end: [lockAngle(body, "hip_L.flex", 36, 36), lockAngle(body, "hip_R.flex", 36, 36)],
  }),
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
      "shoulder.elev": 28,
    },
    end: {
      "root.y": 0.92,
      "root.z": 0.32,
      "root.pitch": 26,
      "hip.flex": 36,
      "hip.abd": 4,
      "knee.flex": 6,
      "ankle.dorsi": 6,
      "lumbar.flex": 4,
      "thoracic.flex": 6,
      "neck.flex": -6,
      ...ARMS,
      "shoulder.elev": 48,
      "elbow.flex": 96,
    },
  },
  checks: () => [
    checkFlatBack(
      "Nearly all of the motion should come from your hips, with your trunk braced and your lower back keeping its natural curve.",
      14,
    ),
    checkNeutralNeck(
      "Keep your lower back and neck near a neutral position, like when you are standing upright and looking straight ahead.",
    ),
    checkJointRange(
      "hip-hinge",
      "Hips travel through a long arc",
      "Most people can descend until the shoulders are lower than the hips while the kettlebell stays at the chest.",
      "hip_L.flex",
      8,
    ),
    checkJointWithinAt(
      "straight-knees",
      "Knees stay nearly straight",
      "Keep the knees straight without intentionally locking them by squeezing the quads.",
      "knee_L.flex",
      "bottom",
      -8,
      22,
    ),
    checkJointWithinAt(
      "aligned-top",
      "Legs and torso line up at the top",
      "Lift through the hips until you can draw a straight line from your legs through your hips to your torso.",
      "hip_L.flex",
      "start",
      0,
      32,
    ),
  ],
});
