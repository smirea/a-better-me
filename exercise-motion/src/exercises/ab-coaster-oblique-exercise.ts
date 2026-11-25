import { Vector3 } from "three";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkJointRange, checkJointWithinAt } from "../postures";
import { pin } from "../solver";

/** Tall kneel, forearms on the arm pads, knees on the moving pad. */
const BASE = {
  ...POSTURE_HINTS.kneeling,
  "root.y": 0.62,
  "root.z": -0.05,
  "root.pitch": 8,
  "hip.flex": 28,
  "hip.abd": 8,
  "knee.flex": 100,
  "ankle.dorsi": -20,
  "lumbar.flex": 6,
  "thoracic.flex": 8,
  "neck.flex": 4,
  "lumbar.twist": 4,
  "thoracic.twist": 8,
  "shoulder.elev": 70,
  "shoulder.plane": 55,
  "shoulder.twist": 10,
  "elbow.flex": 100,
  "forearm.pron": 10,
  "wrist.flex": 4,
};

export const spec = buildExerciseSpec({
  id: "ab-coaster-oblique-exercise",
  catalogId: "2865c6f170d88016b8e6e93207217cb6",
  name: "Ab Coaster Oblique Exercise",
  defaultLoadKg: 10,
  loadUnit: "total",
  laterality: "asymmetrical",
  grip: "open",
  phaseLabels: ["Drive", "Crunch", "Lower", "Tall"],
  tempo: { lower: 1.5, bottom: 0.25, raise: 1.6, top: 0.25 },
  station: {
    kind: "pushup",
    forearmsOnFloor: true,
    plantFeet: false,
    handSupport: "none",
    handElevationY: 0.98,
    handZ: 0.38,
    handX: 0.18,
  },
  apparatus: {
    kind: "roller-pad",
    trackAnchors: ["kneeFront_L", "kneeFront_R"],
    width: 0.36,
    radius: 0.06,
    offset: [0, -0.02, 0.04],
    forceDir: [0, -1, 0],
  },
  extraGoals: (body) => [
    pin(body, "forearmMid_L", () => new Vector3(0.18, 0.98, 0.38), 48),
    pin(body, "forearmMid_R", () => new Vector3(-0.18, 0.98, 0.38), 48),
  ],
  stiffness: { elbow: 6, shoulder: 4, lumbar: 5, thoracic: 5, knee: 4 },
  hints: {
    start: { ...BASE, "lumbar.bend": 4, "thoracic.bend": 4 },
    end: {
      ...BASE,
      "hip.flex": 78,
      "knee.flex": 115,
      "lumbar.flex": 18,
      "thoracic.flex": 22,
      "lumbar.bend": 16,
      "thoracic.bend": 14,
      "lumbar.twist": 6,
      "thoracic.twist": 12,
    },
  },
  checks: () => [
    checkJointRange(
      "knees-drive",
      "Knees drive up toward the elbows",
      "While the pad stays swiveled, drive the knees up across the body through the available range.",
      "hip_L.flex",
      30,
    ),
    checkJointRange(
      "side-bend",
      "Trunk side bends as the hip pulls toward the ribs",
      "Crunch the working hip bone diagonally up toward the ribs. This is a crunch mixed with a side bend.",
      "lumbar.bend",
      8,
    ),
    checkJointWithinAt(
      "forearms-still",
      "Forearms stay on the pads",
      "Keep the chest and arms stationary. Do not pull through the arms.",
      "elbow_L.flex",
      "peak",
      70,
      130,
    ),
    checkJointWithinAt(
      "knees-bent",
      "Knees stay bent on the pad",
      "Kneel with the shins on the pad rather than sitting back onto the heels.",
      "knee_L.flex",
      "bottom",
      70,
      130,
    ),
  ],
});
