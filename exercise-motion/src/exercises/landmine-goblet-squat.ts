import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { lockAngle } from "../solver";

const PIVOT_Z = 1.85;

/** Both hands cup the free sleeve in front of the chest, elbows tucked. */
const ARMS = {
  "clavicle.elev": 6,
  "clavicle.prot": 4,
  "shoulder.elev": 42,
  "shoulder.plane": 78,
  "shoulder.twist": 18,
  "elbow.flex": 108,
  "forearm.pron": 10,
  "wrist.flex": 18,
};

const STAND = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 6,
  "root.z": 0.02,
  "hip.abd": 8,
  "hip.rot": 12,
  "knee.flex": 6,
  "ankle.dorsi": 4,
  "lumbar.flex": 2,
  "neck.flex": 4,
  ...ARMS,
};

const BOTTOM = {
  "root.y": 0.56,
  "root.z": -0.08,
  "root.pitch": 12,
  "hip.flex": 108,
  "hip.abd": 18,
  "hip.rot": 8,
  "knee.flex": 118,
  "ankle.dorsi": 26,
  "ankle.inv": 2,
  "lumbar.flex": 4,
  "thoracic.flex": 2,
  "neck.flex": 6,
  ...ARMS,
};

export const spec = buildExerciseSpec({
  id: "landmine-goblet-squat",
  catalogId: "1a25c6f170d880239ac5f3cb0637c2e1",
  name: "Landmine Goblet Squat",
  defaultLoadKg: 15,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Lower", "Bottom", "Stand", "Top"],
  tempo: { lower: 1.8, bottom: 0.3, raise: 1.4, top: 0.5 },
  station: { kind: "standing", stanceX: 0.18, toeOutDeg: 16, trackKnees: 12, heelZ: -0.12, balanceZ: 0.04 },
  apparatus: { kind: "landmine", pivotZ: PIVOT_Z, sides: ["L", "R"] },
  hints: { start: STAND, end: BOTTOM },
  stiffness: { elbow: 4, shoulder: 2.2, wrist: 2.4, lumbar: 6 },
  extraGoals: (body) => [
    ({ frame, push }) => {
      const chest = anchorPoint(body, frame, "chestFront");
      for (const side of ["L", "R"] as const) {
        const hand = anchorPoint(body, frame, `grip_${side}`);
        const sign = side === "L" ? 1 : -1;
        const dist = Math.hypot(hand.x, hand.y - 0.06, hand.z - PIVOT_Z);
        // Hold the free sleeve, which is about 2.12 m from the floor pivot, clear of the chest.
        push(22 * (dist - 2.12));
        push(24 * (hand.x - sign * 0.01));
        push(12 * (hand.y - chest.y));
        push(16 * (hand.z - (chest.z + 0.22)));
      }
    },
  ],
  extraKeyGoals: (body) => ({
    end: [lockAngle(body, "knee_L.flex", 112, 22), lockAngle(body, "hip_L.flex", 100, 16)],
  }),
  checks: () => [
    checkFlatBack("Avoid rounding your lower back or letting your chest cave down."),
    checkNeutralNeck("Keep your neck near a neutral position throughout the set."),
    checkFeetPlanted("Keep the entire sole of each foot firmly planted on the ground."),
    checkJointRange("knee-depth", "Goblet squat depth", "Squat down through the range the landmine sleeve allows without the bar driving into the chest.", "knee_L.flex", 50),
    checkJointWithinAt("sleeve-at-chest", "Sleeve stays at the chest", "Keep the tip of the bar directly in front of your chest, with the elbows bent.", "elbow_L.flex", "peak", 80, 135),
    checkJointWithinAt("elbows-tucked", "Elbows stay in front of the ribs", "Hold the end of the bar with the elbows tucked slightly in front of your sides.", "shoulder_L.plane", "peak", 45, 110),
  ],
});
