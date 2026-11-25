import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";
import { lockAngle } from "../solver";

/**
 * Viking press: both hands on a close neutral handle at the free end of a landmine,
 * pressing from the front of the shoulders up along the bar's arc.
 */
const RACK = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 4,
  "lumbar.flex": -4,
  "neck.flex": 0,
  "clavicle.elev": 8,
  "clavicle.prot": -4,
  "shoulder.elev": 52,
  "shoulder.plane": 96,
  "shoulder.twist": 18,
  "elbow.flex": 100,
  "forearm.pron": 8,
  "wrist.flex": 0,
};

const LOCKOUT = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 2,
  "lumbar.flex": -3,
  "neck.flex": 2,
  "clavicle.elev": 20,
  "clavicle.prot": -2,
  "shoulder.elev": 128,
  "shoulder.plane": 70,
  "shoulder.twist": 4,
  "elbow.flex": 16,
  "forearm.pron": 6,
  "wrist.flex": 0,
};

export const spec = buildExerciseSpec({
  id: "landmine-viking-press",
  catalogId: "2fe5c6f170d88052ba08d4afbde9c5f4",
  name: "Landmine Viking Press",
  defaultLoadKg: 6,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Press", "Lockout", "Lower", "Shoulders"],
  station: { kind: "standing", stanceX: 0.16 },
  apparatus: { kind: "landmine", pivotZ: 1.65, sides: ["L"] },
  hints: { start: RACK, end: LOCKOUT },
  stiffness: { elbow: 2.5, shoulder: 1.8, lumbar: 6, knee: 4 },
  extraGoals: (body) => [
    ({ frame, push }) => {
      // Both hands share the end of the shaft, inside the bar's length from the floor pivot.
      for (const side of ["L", "R"] as const) {
        const p = anchorPoint(body, frame, `grip_${side}`);
        const dist = Math.hypot(p.x, p.y - 0.06, p.z - 1.65);
        push(12 * (p.x - (side === "L" ? 0.1 : -0.1)));
        push(16 * (dist - 2.02));
      }
    },
    lockAngle(body, "shoulder_L.abd", 8, 16),
    lockAngle(body, "shoulder_R.abd", 8, 16),
  ],
  checks: () => [
    checkFlatBack("Brace the trunk and press without leaning back into an excessive arch."),
    checkFeetPlanted("Stand shoulder-width facing the landmine and keep both feet planted."),
    checkJointRange("elbow-rom", "Press the landmine end up", "Drive the handle from the front of the shoulders until the elbows nearly straighten.", "elbow_L.flex", 20),
    checkJointWithinAt("start-elbow", "Starts at the shoulders", "Begin with the elbows bent and the handle in front of the shoulders.", "elbow_L.flex", "start", 50, 125),
    checkJointWithinAt("lockout-elbow", "Elbows extend at the top", "Finish with the elbows nearly straight and the bar end up and forward.", "elbow_L.flex", "peak", 0, 70),
    checkJointWithinAt("legs-still", "Legs stay quiet", "This is a strict press. Do not dip the knees to drive the bar.", "knee_L.flex", "peak", 0, 14),
  ],
});
