import { Vector3 } from "three";
import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { box } from "../equipment";
import { checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { pin } from "../solver";

const BENCH_TOP = 0.62;
const BENCH_X = -0.42;

const HANG = {
  ...POSTURE_HINTS.standing,
  "root.x": 0.04,
  "root.y": 0.86,
  "root.z": -0.08,
  "root.pitch": 58,
  "hip.flex": 62,
  "hip.abd": 6,
  "knee.flex": 22,
  "ankle.dorsi": 8,
  "lumbar.flex": 4,
  "thoracic.flex": 6,
  "thoracic.twist": -6,
  "neck.flex": -4,
};

const CHEAT = {
  ...HANG,
  "root.pitch": 48,
  "hip.flex": 50,
  "thoracic.twist": 14,
};

const ROW = {
  "shoulder.twist": 4,
  "forearm.pron": 8,
  "wrist.flex": 2,
};

const BRACE_ARM = {
  "shoulder.elev": 68,
  "shoulder.plane": 42,
  "shoulder.twist": 6,
  "elbow.flex": 8,
  "forearm.pron": 16,
  "wrist.flex": 0,
  "clavicle.elev": 4,
  "clavicle.prot": 2,
};

export const spec = buildExerciseSpec({
  id: "single-arm-dumbbell-cheat-row",
  catalogId: "26d5c6f170d88122a65ec353ea06cfdc",
  name: "Single Arm Dumbbell Cheat Row",
  defaultLoadKg: 12,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  phaseLabels: ["Cheat", "Proud chest", "Lower", "Reach"],
  tempo: { lower: 1.15, bottom: 0.2, raise: 1.05, top: 0.25 },
  station: {
    kind: "standing",
    stanceX: 0.2,
    heelZ: -0.16,
    toeOutDeg: 8,
    split: { frontSide: "R", frontZ: 0.06, rearZ: -0.28, rearMode: "flat" },
    balanceZ: -0.08,
  },
  stiffness: { shoulder: 4, elbow: 3, lumbar: 8, thoracic: 6, hip: 3 },
  apparatus: { kind: "dumbbells", sides: ["L"] },
  extraEquipment: [
    box("brace.pad", [BENCH_X, BENCH_TOP, 0.28], [0.22, 0.08, 0.28], "pad"),
    box("brace.post", [BENCH_X, 0.3, 0.28], [0.06, 0.56, 0.06], "steel", false),
  ],
  extraContacts: {
    "brace.pad": { hand_R: 0.08, forearm_R: 0.05 },
  },
  extraGoals: (body) => [pin(body, "grip_R", () => new Vector3(BENCH_X, BENCH_TOP + 0.06, 0.28), 28)],
  hints: {
    start: sidedHints(
      "L",
      { ...ROW, "shoulder.elev": 50, "shoulder.plane": 64, "elbow.flex": 8, "clavicle.prot": 6, "clavicle.elev": 4 },
      BRACE_ARM,
      HANG,
    ),
    end: sidedHints(
      "L",
      { ...ROW, "shoulder.elev": 32, "shoulder.plane": 48, "elbow.flex": 108, "clavicle.prot": -12, "clavicle.elev": 10 },
      BRACE_ARM,
      CHEAT,
    ),
  },
  checks: () => [
    checkNeutralNeck("Brace your free hand on the bench and keep your lower back from rounding as you rotate."),
    checkJointRange(
      "torso-help",
      "Chest rotates toward the dumbbell",
      "Rotate your chest moderately toward the dumbbell as you pull, then let it rotate away on the way down.",
      "thoracic.twist",
      12,
    ),
    checkJointRange(
      "elbow-drive",
      "Elbow drives back toward the hip",
      "Explosively drive your elbow backward and upward and finish with a proud chest.",
      "elbow_L.flex",
      60,
    ),
    checkJointWithinAt(
      "neutral",
      "Palm stays angled inward",
      "Grasp the dumbbell with your palm angled inward.",
      "forearm_L.pron",
      "start",
      -20,
      35,
    ),
    checkJointWithinAt(
      "brace-arm",
      "Brace arm stays straight",
      "Keep the non-working hand braced on the bench with a straight elbow.",
      "elbow_R.flex",
      "peak",
      0,
      24,
    ),
  ],
});
