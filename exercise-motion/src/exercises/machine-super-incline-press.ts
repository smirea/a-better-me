import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFeetPlanted, checkJointRange, checkJointWithinAt } from "../postures";

/** Super incline: forearms aim up and forward, more vertical than a 45° press. */
const SEAT = {
  ...POSTURE_HINTS.seatedLeanBack,
  "root.pitch": -10,
  "lumbar.flex": -4,
  "thoracic.flex": -2,
  "neck.flex": 6,
  "hip.flex": 78,
};

const ARMS_BOTTOM = {
  "clavicle.elev": 4,
  "clavicle.prot": -8,
  "shoulder.elev": 52,
  "shoulder.plane": 62,
  "shoulder.twist": 16,
  "elbow.flex": 98,
  "forearm.pron": 40,
  "wrist.flex": 2,
};

const ARMS_TOP = {
  "clavicle.elev": 14,
  "clavicle.prot": -2,
  "shoulder.elev": 138,
  "shoulder.plane": 58,
  "shoulder.twist": 6,
  "elbow.flex": 10,
  "forearm.pron": 36,
  "wrist.flex": 0,
};

export const spec = buildExerciseSpec({
  id: "machine-super-incline-press",
  catalogId: "2fe5c6f170d8809c9e9de9929f46e34e",
  name: "Machine Super Incline Press",
  defaultLoadKg: 14,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Press", "Lockout", "Lower", "Chest"],
  station: {
    kind: "seated",
    seatY: 0.46,
    stanceX: 0.18,
    heelZ: 0.42,
    leanDeg: -8,
    pinBack: true,
    frame: { type: "machine", backAngleDeg: 68, stackZ: -0.7 },
  },
  apparatus: {
    kind: "machine-handles",
    orientation: "horizontal",
    anchor: "press",
    forceDir: [0, 0.72, 0.55],
  },
  hints: { start: { ...SEAT, ...ARMS_BOTTOM }, end: { ...SEAT, ...ARMS_TOP } },
  stiffness: { elbow: 3, shoulder: 1.8, lumbar: 6 },
  checks: () => [
    checkFeetPlanted("Keep the chest up, the back on the pad, and the feet flat under the knees."),
    checkJointRange(
      "elbow-rom",
      "Press up the high incline",
      "Press the handles upward and moderately forward until the elbows straighten, then lower under control.",
      "elbow_L.flex",
      60,
    ),
    checkJointWithinAt(
      "bottom-elbow",
      "Elbows start stacked with the wrists",
      "Start with the elbows stacked under the wrists so the forearms line up with the high incline.",
      "elbow_L.flex",
      "start",
      70,
      125,
    ),
    checkJointWithinAt(
      "lockout-elbow",
      "Elbows finish straight",
      "Finish with the elbows straight. The path has more vertical travel than horizontal travel.",
      "elbow_L.flex",
      "peak",
      0,
      24,
    ),
    checkJointWithinAt(
      "shoulder-flex",
      "Shoulders flex on the incline",
      "The press is shoulder flexion on a high incline, with some horizontal flexion and abduction.",
      "shoulder_L.elev",
      "peak",
      100,
      165,
    ),
  ],
});
