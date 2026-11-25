import { buildExerciseSpec, holdElbowNearShoulder, POSTURE_HINTS } from "../builders";
import { checkJointRange, checkJointWithinAt } from "../postures";

/** Plate-loaded pushdown: arms stay by the sides, forearms press the pads down. */
const SEAT = {
  ...POSTURE_HINTS.seated,
  "root.pitch": -2,
  "lumbar.flex": 0,
  "thoracic.flex": 0,
  "neck.flex": 4,
};

const ARMS = {
  "shoulder.elev": 20,
  "shoulder.plane": 58,
  "shoulder.twist": 12,
  "forearm.pron": 55,
  "wrist.flex": -2,
  "clavicle.elev": 0,
  "clavicle.prot": -4,
};

export const spec = buildExerciseSpec({
  id: "plate-loaded-machine-triceps-pushdown",
  catalogId: "3b25c6f170d88099bab5c480240fa61f",
  name: "Plate-Loaded Machine Triceps Pushdown",
  defaultLoadKg: 25,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Press", "Lockout", "Return", "Bend"],
  tempo: { lower: 1.3, bottom: 0.25, raise: 1.4, top: 0.3 },
  station: {
    kind: "seated",
    seatY: 0.5,
    stanceX: 0.16,
    heelZ: 0.36,
    frame: { type: "machine", backAngleDeg: 88, stackZ: -0.5 },
  },
  apparatus: {
    kind: "machine-handles",
    orientation: "horizontal",
    forceDir: [0, 1, 0.1],
  },
  stiffness: { elbow: 3, shoulder: 3.2, lumbar: 7 },
  hints: {
    start: { ...SEAT, ...ARMS, "elbow.flex": 116 },
    end: { ...SEAT, ...ARMS, "elbow.flex": 8 },
  },
  extraContacts: {
    handle_L: { chest: 0.1, thigh_L: 0.08, upperarm_L: 0.06, forearm_L: 0.05 },
    handle_R: { chest: 0.1, thigh_R: 0.08, upperarm_R: 0.06, forearm_R: 0.05 },
  },
  extraGoals: (body) => [
    holdElbowNearShoulder(body, "L", [0.05, -0.28, 0.08], 18, "xz"),
    holdElbowNearShoulder(body, "R", [0.05, -0.28, 0.08], 18, "xz"),
  ],
  checks: () => [
    checkJointWithinAt(
      "elbows-bent",
      "Elbows start bent at the sides",
      "Grasp the handles with the upper arms by the sides and the elbows bent.",
      "elbow_L.flex",
      "top",
      90,
      140,
    ),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows finish straight",
      "Press down until the elbows are fully straight.",
      "elbow_L.flex",
      "bottom",
      0,
      22,
    ),
    checkJointRange(
      "elbow-rom",
      "Forearms arc down in front of the body",
      "Do not let the elbows drift forward through the shoulders.",
      "elbow_L.flex",
      80,
    ),
  ],
});
