import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFeetPlanted, checkJointRange, checkJointWithinAt } from "../postures";

const SEAT = {
  ...POSTURE_HINTS.seated,
  "root.pitch": -8,
  "lumbar.flex": -6,
  "thoracic.flex": -2,
  "neck.flex": 8,
  "hip.flex": 86,
  "knee.flex": 90,
  "clavicle.prot": -6,
  "forearm.pron": 58,
  "wrist.flex": -4,
};

/** Wide grip, bar on the upper traps just under the base of the neck. Elbows flare out under the bar. */
const BOTTOM = {
  ...SEAT,
  "clavicle.elev": 10,
  "shoulder.elev": 96,
  "shoulder.plane": -16,
  "shoulder.twist": -4,
  "elbow.flex": 82,
};

const LOCKOUT = {
  ...SEAT,
  "neck.flex": 4,
  "clavicle.elev": 22,
  "shoulder.elev": 166,
  "shoulder.plane": 8,
  "shoulder.twist": -12,
  "elbow.flex": 6,
};

export const spec = buildExerciseSpec({
  id: "seated-barbell-behind-the-neck-overhead-press",
  catalogId: "1a05c6f170d880ceb4edebad298afca7",
  name: "Seated Barbell Behind-The-Neck Overhead Press",
  defaultLoadKg: 16,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Press", "Lockout", "Lower", "Neck"],
  station: {
    kind: "seated",
    seatY: 0.43,
    frame: { type: "adjustable-bench", backAngleDeg: 82 },
    pinHead: false,
  },
  apparatus: {
    kind: "barbell",
    style: "straight",
    gripX: 0.4,
    anchor: "press",
    path: { startY: 1.06, startZ: -0.12, endY: 1.6, endZ: 0.0, arcBulgeZ: -0.09 },
  },
  hints: { start: BOTTOM, end: LOCKOUT },
  stiffness: { elbow: 3, shoulder: 2, lumbar: 6 },
  extraContacts: { "bar.shaft": { head: 0.09, neck: 0.04 } },
  checks: () => [
    checkFeetPlanted("Keep both feet flat on the floor and the back against the bench."),
    checkJointRange("elbow-rom", "Press from behind the neck", "Lower the bar behind the head toward the upper traps, then press to straight elbows.", "elbow_L.flex", 55),
    checkJointWithinAt("bottom-elbow", "Elbows bent behind the neck", "At the bottom the elbows are bent and flared, stacked under the bar.", "elbow_L.flex", "start", 55, 135),
    checkJointWithinAt("behind", "Bar stays behind the head", "The bottom position is behind the neck, not on the front of the shoulders.", "shoulder_L.plane", "start", -75, 5),
    checkJointWithinAt("lockout-elbow", "Elbows locked overhead", "Press until the elbows are straight overhead.", "elbow_L.flex", "peak", 0, 18),
    checkJointWithinAt("lockout-shoulder", "Shoulders up at lockout", "Finish with the shoulders flexed and the bar stacked over the seat.", "shoulder_L.elev", "peak", 148, 174),
  ],
});
