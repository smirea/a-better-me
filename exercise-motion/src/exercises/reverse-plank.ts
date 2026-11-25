import { Vector3 } from "three";
import { buildExerciseSpec } from "../builders";
import { checkFlatBack, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { lockAngle, pin, plantFoot } from "../solver";

/**
 * Face-up bridge: hands under the shoulders behind the hips, heels down, body in one line.
 * Push-up station places the hands; heels are planted because the station's default is the forefoot.
 */
const HOLD = {
  "root.y": 0.38,
  "root.z": 0.05,
  "root.pitch": -6,
  "lumbar.flex": 2,
  "thoracic.flex": 2,
  "neck.flex": 8,
  "hip.flex": 6,
  "hip.abd": 6,
  "knee.flex": 12,
  "ankle.dorsi": 14,
  "clavicle.prot": -16,
  "clavicle.elev": -2,
  "shoulder.elev": 28,
  "shoulder.plane": 70,
  "shoulder.twist": -4,
  "elbow.flex": 10,
  "forearm.pron": 24,
  "wrist.flex": -20,
};

export const spec = buildExerciseSpec({
  id: "reverse-plank",
  catalogId: "1a45c6f170d880faa555d3e604efa65f",
  name: "Reverse Plank",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "open",
  isometric: true,
  brace: true,
  cameraHint: { view: "Side" },
  phaseLabels: ["Set", "Bridge", "Hold", "Hold"],
  station: {
    kind: "lying",
    surface: "floor",
    face: "up",
    pinSacrum: false,
    feetOnFloor: false,
  },
  extraGoals: (body) => [
    pin(body, "palmFlat_L", () => new Vector3(0.22, 0.045, -0.32), 44),
    pin(body, "palmFlat_R", () => new Vector3(-0.22, 0.045, -0.32), 44),
    ...plantFoot(body, "L", new Vector3(0.1, 0.085, 0.58), 0.08, 36),
    ...plantFoot(body, "R", new Vector3(-0.1, 0.085, 0.58), 0.08, 36),
    lockAngle(body, "ankle_L.dorsi", -2, 10),
    lockAngle(body, "ankle_R.dorsi", -2, 10),
  ],
  stiffness: { hip: 8, knee: 8, shoulder: 10, elbow: 10, lumbar: 12, wrist: 6 },
  apparatus: {
    kind: "none",
    bodyweightLoads: [
      { anchor: "palmFlat_L", bodyweightShare: 0.22, grip: "press", direction: [0, 1, 0] },
      { anchor: "palmFlat_R", bodyweightShare: 0.22, grip: "press", direction: [0, 1, 0] },
      { anchor: "heel_L", bodyweightShare: 0.18, grip: "press", direction: [0, 1, 0] },
      { anchor: "heel_R", bodyweightShare: 0.18, grip: "press", direction: [0, 1, 0] },
    ],
  },
  hints: { start: HOLD, end: HOLD },
  checks: () => [
    checkFlatBack(
      "Squeeze the glutes so you can draw a straight line from the legs through the hips to the shoulders, without an excessive arch.",
      12,
    ),
    checkNeutralNeck("Keep the neck near the position you use when standing and looking straight ahead."),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows stay straight",
      "Weight through the arms goes through the heels of the hands, with the elbows straight.",
      "elbow_L.flex",
      "start",
      -8,
      24,
    ),
    checkJointWithinAt(
      "hips-extended",
      "Hips stay high",
      "Drive the heels down and keep the hips up so the body does not sag.",
      "hip_L.flex",
      "start",
      -15,
      25,
    ),
    checkJointWithinAt(
      "knees-straight",
      "Legs stay straight",
      "Heels stay on the ground with the knees straight.",
      "knee_L.flex",
      "start",
      -6,
      40,
    ),
  ],
});
