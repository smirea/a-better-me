import { Vector3 } from "three";
import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Straddle the bar, chest toward the plates, pivot behind. Both hands hold a neutral V-grip. */
const PIVOT_Z = -1.45;

const HINGE = {
  ...POSTURE_HINTS.standing,
  "root.y": 0.84,
  "root.z": 0.18,
  "root.pitch": 58,
  "hip.flex": 76,
  "hip.abd": 10,
  "knee.flex": 30,
  "ankle.dorsi": 10,
  "lumbar.flex": 4,
  "thoracic.flex": 8,
  "neck.flex": -4,
};

const HANG = {
  "clavicle.elev": 4,
  "clavicle.prot": 2,
  "shoulder.elev": 36,
  "shoulder.plane": 74,
  "shoulder.twist": 6,
  "elbow.flex": 8,
  "forearm.pron": 6,
  "wrist.flex": 6,
};

const ROW = {
  "clavicle.elev": 8,
  "clavicle.prot": -16,
  "shoulder.elev": 32,
  "shoulder.plane": 48,
  "shoulder.twist": 8,
  "elbow.flex": 112,
  "forearm.pron": 6,
  "wrist.flex": 4,
};

export const spec = buildExerciseSpec({
  id: "neutral-grip-landmine-t-bar-row",
  catalogId: "1a15c6f170d8809b94d8f668bf45a229",
  name: "Neutral Grip Landmine T-Bar Row",
  defaultLoadKg: 12,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Row", "Torso", "Lower", "Hang"],
  tempo: { lower: 1.2, bottom: 0.25, raise: 1.5, top: 0.3 },
  station: { kind: "standing", stanceX: 0.2, heelZ: 0.08, toeOutDeg: 10, torsoLeanDeg: 58 },
  apparatus: { kind: "landmine", pivotZ: PIVOT_Z, sides: ["L", "R"] },
  stiffness: { lumbar: 12, thoracic: 9, hip: 8, knee: 5, elbow: 2.6 },
  extraGoals: (body) => [
    ({ frame, push }) => {
      const pivot = new Vector3(0, 0.06, PIVOT_Z);
      for (const side of ["L", "R"] as const) {
        const sign = side === "L" ? 1 : -1;
        const hand = anchorPoint(body, frame, `grip_${side}`);
        push(18 * (hand.distanceTo(pivot) - 1.98));
        push(20 * (hand.x - sign * 0.03));
      }
    },
  ],
  hints: {
    start: { ...HINGE, ...HANG },
    end: { ...HINGE, ...ROW },
  },
  checks: () => [
    checkFlatBack(
      "Keep the torso fixed in the hinge with the lower back near neutral. The erectors hold that position; they do not lift the chest.",
    ),
    checkNeutralNeck("Keep the neck in line with the hinged torso."),
    checkJointWithinAt(
      "neutral-grip",
      "Palms face each other",
      "Grasp the V-bar handles with the palms facing each other and the elbows straight at the bottom.",
      "forearm_L.pron",
      "start",
      -25,
      30,
    ),
    checkJointWithinAt(
      "arms-long",
      "Elbows start straight",
      "Start with the elbows straight and the plates just clear of the floor.",
      "elbow_L.flex",
      "start",
      0,
      28,
    ),
    checkJointWithinAt(
      "elbows-in",
      "Elbows stay near the sides",
      "Row with the elbows tucked fairly close to the sides until they are level with the torso or slightly behind it.",
      "shoulder_L.plane",
      "peak",
      28,
      75,
    ),
    checkJointRange(
      "row",
      "Elbows bend through the row",
      "Pull the bar up and back toward the torso and squeeze the shoulder blades together, then lower until the elbows are straight.",
      "elbow_L.flex",
      60,
    ),
  ],
});
