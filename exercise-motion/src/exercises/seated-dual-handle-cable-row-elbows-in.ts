import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Dual D-handles, palms angled in, elbows driven straight back beside the ribs. */
const REACH = {
  "shoulder.elev": 80,
  "shoulder.plane": 78,
  "shoulder.twist": 4,
  "elbow.flex": 8,
  "forearm.pron": 8,
  "wrist.flex": 0,
  "clavicle.elev": 4,
  "clavicle.prot": 8,
};

const PULL = {
  "shoulder.elev": 32,
  "shoulder.plane": 28,
  "shoulder.twist": 2,
  "elbow.flex": 112,
  "forearm.pron": 6,
  "wrist.flex": 4,
  "clavicle.elev": 2,
  "clavicle.prot": -16,
};

const SEAT = {
  ...POSTURE_HINTS.seated,
  "root.pitch": 4,
  "hip.flex": 86,
  "knee.flex": 70,
  "lumbar.flex": 4,
  "thoracic.flex": 2,
  "neck.flex": 2,
};

export const spec = buildExerciseSpec({
  id: "seated-dual-handle-cable-row-elbows-in",
  catalogId: "33c5c6f170d88097a179d6e74e09af7b",
  name: "Seated Dual Handle Cable Row (Elbows-In)",
  defaultLoadKg: 10,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Pull", "Ribs", "Return", "Reach"],
  tempo: { lower: 1.4, bottom: 0.3, raise: 1.7, top: 0.3 },
  station: {
    kind: "seated",
    seatZ: -0.02,
    heelZ: 0.42,
    frame: { type: "seated-row", pulleyY: 0.7 },
    feetMode: "floor",
    leanDeg: 4,
  },
  apparatus: {
    kind: "cable-dual",
    pulleyY: 0.72,
    halfWidth: 0.72,
    z: 1.15,
    attachment: "d-handle",
  },
  hints: {
    start: { ...SEAT, ...REACH },
    end: { ...SEAT, ...PULL },
  },
  checks: () => [
    checkFlatBack(
      "Movement should occur at your shoulders, shoulder blades, and elbows, while your torso stays upright.",
    ),
    checkNeutralNeck("Keep your chest up and your neck quiet."),
    checkJointRange(
      "elbow-row",
      "Elbows bend with the handles at the sides",
      "Pull the handles back toward the sides of your torso by driving your elbows backward.",
      "elbow_L.flex",
      75,
    ),
    checkJointWithinAt(
      "arms-long",
      "Arms start aligned with the cables",
      "Sit upright with straight elbows and your palms angled in toward each other.",
      "elbow_L.flex",
      "top",
      0,
      22,
    ),
    checkJointWithinAt(
      "elbows-in",
      "Elbows stay tucked",
      "Keep your elbows tucked close to your sides, rather than flaring them out.",
      "shoulder_L.plane",
      "bottom",
      12,
      50,
    ),
    checkJointWithinAt(
      "scapulae-together",
      "Shoulder blades pull together",
      "Finish in a proud-chest posture with your shoulder blades squeezed together.",
      "clavicle_L.prot",
      "bottom",
      -28,
      -6,
    ),
  ],
});
