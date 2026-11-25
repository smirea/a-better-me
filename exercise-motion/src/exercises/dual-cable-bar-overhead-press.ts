import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkAnchorTravel, checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/**
 * Seated press of a straight bar fed by a low cable. `cable-dual` only builds
 * separate D-handles, so the shared bar is a straight-bar attachment on a low pulley.
 */
const SEAT = {
  ...POSTURE_HINTS.seated,
  "root.pitch": 2,
  "lumbar.flex": -4,
  "thoracic.flex": -2,
  "neck.flex": 8,
  "hip.flex": 86,
  "knee.flex": 88,
};

const ARMS_BOTTOM = {
  "clavicle.elev": 6,
  "clavicle.prot": -6,
  "shoulder.elev": 68,
  "shoulder.plane": 48,
  "shoulder.twist": 12,
  "elbow.flex": 94,
  "forearm.pron": 72,
  "wrist.flex": 6,
};

const ARMS_TOP = {
  "clavicle.elev": 18,
  "clavicle.prot": 2,
  "shoulder.elev": 164,
  "shoulder.plane": 20,
  "shoulder.twist": 6,
  "elbow.flex": 8,
  "forearm.pron": 68,
  "wrist.flex": 2,
};

export const spec = buildExerciseSpec({
  id: "dual-cable-bar-overhead-press",
  catalogId: "3965c6f170d880b8ae57f3b9792ad088",
  name: "Dual Cable Bar Overhead Press",
  defaultLoadKg: 18,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Press", "Lockout", "Lower", "Shoulders"],
  tempo: { lower: 1.2, bottom: 0.25, raise: 1.5, top: 0.3 },
  station: {
    kind: "seated",
    seatY: 0.48,
    stanceX: 0.18,
    heelZ: 0.42,
    leanDeg: 2,
    pinBack: true,
    frame: { type: "adjustable-bench", backAngleDeg: 82 },
  },
  apparatus: {
    kind: "cable-single",
    pulley: [0, 0.18, 0.95],
    facingDir: -1,
    attachment: "straight-bar",
    gripX: 0.18,
    handPath: { startY: 1.12, startZ: 0.32, endY: 1.68, endZ: 0.14 },
  },
  hints: {
    start: { ...SEAT, ...ARMS_BOTTOM },
    end: { ...SEAT, ...ARMS_TOP, "neck.flex": 0 },
  },
  stiffness: { elbow: 3.2, shoulder: 1.3, lumbar: 6, knee: 4 },
  checks: () => [
    checkFlatBack(
      "Sit tall against the bench. Keep the natural curve of the lower back and do not lean back to finish the press.",
      18,
    ),
    checkFeetPlanted("Keep both feet flat on the floor so the torso stays a stable platform."),
    checkJointWithinAt(
      "bar-at-shoulders",
      "Bar starts at the shoulders",
      "Start with the straight bar at the front of the shoulders, elbows under the wrists, palms facing forward.",
      "elbow_L.flex",
      "start",
      70,
      115,
    ),
    checkJointWithinAt(
      "elbows-locked",
      "Elbows lock out overhead",
      "Press the bar overhead until the elbows are straight and the bar sits over the shoulders.",
      "elbow_L.flex",
      "peak",
      0,
      22,
    ),
    checkJointWithinAt(
      "overhead",
      "Bar finishes overhead",
      "Drive the bar up from the shoulders until the arms are overhead. The cable stays in front of the body.",
      "shoulder_L.elev",
      "peak",
      140,
      175,
    ),
    checkAnchorTravel(
      "bar-rises",
      "Bar travels upward",
      "Press the bar from shoulder height to overhead, then lower it under control to the shoulders.",
      "press_L",
      "y",
      0.32,
    ),
    checkJointRange(
      "shoulder-rom",
      "Shoulders flex and abduct",
      "The press is shoulder flexion and abduction, with the shoulder blades free to rotate upward.",
      "shoulder_L.elev",
      65,
    ),
  ],
});
