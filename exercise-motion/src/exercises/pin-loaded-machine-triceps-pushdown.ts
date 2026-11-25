import { buildExerciseSpec, holdElbowNearShoulder, POSTURE_HINTS } from "../builders";
import { checkJointRange, checkJointWithinAt } from "../postures";

/** Seated pushdown: upper arms pinned by the sides, forearms press down in front. */
const SEAT = {
  ...POSTURE_HINTS.seated,
  "root.pitch": -2,
  "lumbar.flex": 0,
  "thoracic.flex": 0,
  "neck.flex": 4,
};

const ARMS = {
  "shoulder.elev": 22,
  "shoulder.plane": 55,
  "shoulder.twist": 10,
  "forearm.pron": 8,
  "wrist.flex": 0,
  "clavicle.elev": 0,
  "clavicle.prot": -4,
};

export const spec = buildExerciseSpec({
  id: "pin-loaded-machine-triceps-pushdown",
  catalogId: "3b55c6f170d8800982aec9cb5ae2d235",
  name: "Pin-Loaded Machine Triceps Pushdown",
  defaultLoadKg: 30,
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
    frame: { type: "machine", backAngleDeg: 88, stackZ: -0.72 },
  },
  apparatus: {
    kind: "machine-handles",
    orientation: "neutral",
    forceDir: [0, 1, 0.08],
  },
  stiffness: { elbow: 3, shoulder: 3.2, lumbar: 7 },
  hints: {
    start: { ...SEAT, ...ARMS, "elbow.flex": 118 },
    end: { ...SEAT, ...ARMS, "elbow.flex": 8 },
  },
  extraContacts: {
    handle_L: { chest: 0.1, thigh_L: 0.08, upperarm_L: 0.06, forearm_L: 0.04 },
    handle_R: { chest: 0.1, thigh_R: 0.08, upperarm_R: 0.06, forearm_R: 0.04 },
  },
  extraGoals: (body) => [
    holdElbowNearShoulder(body, "L", [0.04, -0.28, 0.06], 18, "xz"),
    holdElbowNearShoulder(body, "R", [0.04, -0.28, 0.06], 18, "xz"),
  ],
  checks: () => [
    checkJointWithinAt(
      "elbows-bent",
      "Elbows start bent at the sides",
      "Sit tall with the upper arms by the sides and the elbows bent.",
      "elbow_L.flex",
      "top",
      90,
      140,
    ),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows finish straight",
      "Press the handles down until the elbows are fully straight.",
      "elbow_L.flex",
      "bottom",
      0,
      22,
    ),
    checkJointRange(
      "elbow-rom",
      "Forearms arc down in front of the body",
      "Keep the upper arms still. Only the elbows move.",
      "elbow_L.flex",
      80,
    ),
  ],
});
