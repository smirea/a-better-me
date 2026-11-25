import { Vector3 } from "three";
import { buildExerciseSpec } from "../builders";
import { checkFlatBack, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { pin, plantFoot } from "../solver";

/** Bent-knee reverse plank: torso and thighs parallel to the floor, shins vertical. */
const HOLD = {
  "root.y": 0.42,
  "root.z": 0.02,
  "root.pitch": -4,
  "lumbar.flex": 2,
  "thoracic.flex": 2,
  "neck.flex": 8,
  "hip.flex": 10,
  "hip.abd": 8,
  "knee.flex": 96,
  "ankle.dorsi": 6,
  "clavicle.prot": -16,
  "clavicle.elev": -2,
  "shoulder.elev": 36,
  "shoulder.plane": 70,
  "shoulder.twist": -4,
  "elbow.flex": 8,
  "forearm.pron": 18,
  "wrist.flex": -24,
};

export const spec = buildExerciseSpec({
  id: "tabletop-reverse-plank",
  catalogId: "2765c6f170d880e4ac3cc89dc17cac07",
  name: "Tabletop Reverse Plank",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "open",
  isometric: true,
  brace: true,
  cameraHint: { view: "Side" },
  phaseLabels: ["Set", "Tabletop", "Hold", "Hold"],
  station: {
    kind: "lying",
    surface: "floor",
    face: "up",
    pinSacrum: false,
    feetOnFloor: false,
  },
  extraGoals: (body) => [
    pin(body, "palmFlat_L", () => new Vector3(0.22, 0.05, -0.28), 44),
    pin(body, "palmFlat_R", () => new Vector3(-0.22, 0.05, -0.28), 44),
    ...plantFoot(body, "L", new Vector3(0.14, 0, 0.42), 0.1, 40),
    ...plantFoot(body, "R", new Vector3(-0.14, 0, 0.42), 0.1, 40),
  ],
  stiffness: { hip: 8, knee: 8, shoulder: 10, elbow: 10, lumbar: 12, wrist: 6 },
  apparatus: {
    kind: "none",
    bodyweightLoads: [
      { anchor: "palmFlat_L", bodyweightShare: 0.25, grip: "press", direction: [0, 1, 0] },
      { anchor: "palmFlat_R", bodyweightShare: 0.25, grip: "press", direction: [0, 1, 0] },
      { anchor: "heel_L", bodyweightShare: 0.15, grip: "press", direction: [0, 1, 0] },
      { anchor: "heel_R", bodyweightShare: 0.15, grip: "press", direction: [0, 1, 0] },
    ],
  },
  hints: { start: HOLD, end: HOLD },
  checks: () => [
    checkFlatBack(
      "Lift until a straight line runs from the knees through the hips to the shoulders. Squeeze the glutes so the lower back stays only mildly curved.",
      12,
    ),
    checkNeutralNeck("Keep the neck near neutral, as when standing and looking ahead."),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows stay straight",
      "Arms point down into the heels of the hands.",
      "elbow_L.flex",
      "start",
      -10,
      24,
    ),
    checkJointWithinAt(
      "knees-bent",
      "Knees stay near 90 degrees",
      "Shins point down toward the floor, soles flat, about hip width.",
      "knee_L.flex",
      "start",
      70,
      130,
    ),
    checkJointWithinAt(
      "hips-level",
      "Thighs stay parallel to the floor",
      "Hips finish high enough that the torso and thighs are parallel to the ground.",
      "hip_L.flex",
      "start",
      -10,
      50,
    ),
  ],
});
