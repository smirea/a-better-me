import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkAnchorTravel, checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";
import { lockAngle } from "../solver";

/** Standing dual-cable press: low pulleys, D-handles, elbows about 60–75° out, palms in. */
const TRUNK = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 3,
  "lumbar.flex": -3,
  "thoracic.flex": -2,
  "hip.flex": 4,
  "knee.flex": 4,
  "ankle.dorsi": 2,
};

const ARMS_BOTTOM = {
  "clavicle.elev": 6,
  "clavicle.prot": -4,
  "shoulder.elev": 70,
  "shoulder.plane": 62,
  "shoulder.twist": 8,
  "elbow.flex": 96,
  "forearm.pron": 18,
  "wrist.flex": 4,
  "wrist.dev": 0,
};

const ARMS_TOP = {
  "clavicle.elev": 18,
  "clavicle.prot": 2,
  "shoulder.elev": 166,
  "shoulder.plane": 24,
  "shoulder.twist": 4,
  "elbow.flex": 6,
  "forearm.pron": 22,
  "wrist.flex": 2,
  "wrist.dev": 0,
};

export const spec = buildExerciseSpec({
  id: "cable-shoulder-press",
  catalogId: "2aa5c6f170d8805eba89d16e66093142",
  name: "Cable Shoulder Press",
  defaultLoadKg: 8,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Press", "Lockout", "Lower", "Shoulders"],
  tempo: { lower: 1.2, bottom: 0.25, raise: 1.5, top: 0.3 },
  station: { kind: "standing", stanceX: 0.16, toeOutDeg: 10, balanceZ: 0.06 },
  apparatus: {
    kind: "cable-dual",
    pulleyY: 0.2,
    halfWidth: 0.95,
    z: 0.42,
    attachment: "d-handle",
    anchor: "press",
  },
  hints: {
    start: { ...TRUNK, ...ARMS_BOTTOM, "neck.flex": 8 },
    end: { ...TRUNK, ...ARMS_TOP, "neck.flex": -2, "root.pitch": 2 },
  },
  stiffness: { knee: 2.8, elbow: 3.2, shoulder: 1.2 },
  extraGoals: (body) => [lockAngle(body, "knee_L.flex", 5, 22), lockAngle(body, "knee_R.flex", 5, 22)],
  checks: () => [
    checkFlatBack(
      "Rather than excessively arching your lower back, maintain the natural curvature of your lower back along with your neck.",
      16,
    ),
    checkFeetPlanted("Keep your knees and hips straightened. Do not use your legs to help lift the handles."),
    checkJointWithinAt(
      "knees-straight",
      "Legs stay straight",
      "Throughout the set, keep your knees and hips straightened and avoid leaning back through the lower back.",
      "knee_L.flex",
      "peak",
      0,
      16,
    ),
    checkJointWithinAt(
      "elbows-locked",
      "Elbows lock out overhead",
      "Press until the elbows are directed straight up toward the ceiling and the arms are straight.",
      "elbow_L.flex",
      "peak",
      0,
      22,
    ),
    checkJointWithinAt(
      "overhead",
      "Handles finish overhead",
      "Drive the elbows upward and inward until the arms point at the ceiling, wrists stacked over the elbows.",
      "shoulder_L.elev",
      "peak",
      140,
      175,
    ),
    checkAnchorTravel(
      "handles-rise",
      "Handles travel upward",
      "Press the handles upward in an arc until they are overhead, then lower them under control.",
      "press_L",
      "y",
      0.35,
    ),
    checkJointRange(
      "shoulder-rom",
      "Shoulders flex and abduct",
      "Primary joint actions are shoulder abduction and shoulder flexion, with the elbows bending past 90 degrees at the bottom.",
      "shoulder_L.elev",
      70,
    ),
  ],
});
