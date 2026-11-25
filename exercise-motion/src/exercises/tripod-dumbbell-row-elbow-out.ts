import { Vector3 } from "three";
import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { flatBench } from "../equipment";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { pin } from "../solver";

const BENCH_TOP = 0.5;

const HINGE = {
  ...POSTURE_HINTS.standing,
  "root.x": 0.08,
  "root.y": 0.84,
  "root.z": -0.12,
  "root.pitch": 62,
  "hip.flex": 68,
  "hip.abd": 8,
  "knee.flex": 24,
  "ankle.dorsi": 8,
  "lumbar.flex": 4,
  "thoracic.flex": 6,
  "neck.flex": -6,
};

const ROW = {
  "shoulder.twist": 8,
  "forearm.pron": 40,
  "wrist.flex": 4,
};

const BRACE_ARM = {
  "shoulder.elev": 72,
  "shoulder.plane": 48,
  "shoulder.twist": 6,
  "elbow.flex": 6,
  "forearm.pron": 18,
  "wrist.flex": 0,
  "clavicle.elev": 4,
  "clavicle.prot": 2,
};

export const spec = buildExerciseSpec({
  id: "tripod-dumbbell-row-elbow-out",
  catalogId: "3505c6f170d880b2bf5cf674d12ff79b",
  name: "Tripod Dumbbell Row (Elbow-Out)",
  defaultLoadKg: 12,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  phaseLabels: ["Row", "Flare", "Lower", "Hang"],
  tempo: { lower: 1.2, bottom: 0.25, raise: 1.45, top: 0.3 },
  station: {
    kind: "standing",
    stanceX: 0.18,
    heelZ: -0.2,
    toeOutDeg: 8,
    torsoLeanDeg: 58,
    split: { frontSide: "R", frontZ: -0.02, rearZ: -0.38, rearMode: "flat" },
  },
  stiffness: { shoulder: 4, elbow: 4, lumbar: 6, thoracic: 5 },
  apparatus: { kind: "dumbbells", sides: ["L"] },
  extraEquipment: flatBench({ topY: BENCH_TOP, zHead: 0.15, zFoot: 1.15 }),
  extraContacts: {
    "bench.pad": { hand_R: 0.08, forearm_R: 0.05 },
  },
  extraGoals: (body) => [
    pin(body, "grip_R", () => new Vector3(-0.04, BENCH_TOP + 0.02, 0.28), 42),
    pin(body, "pelvisBottom", () => new Vector3(0.02, 0.8, -0.32), 24, "x"),
  ],
  hints: {
    start: sidedHints(
      "L",
      { ...ROW, "shoulder.elev": 50, "shoulder.plane": 68, "elbow.flex": 8, "clavicle.prot": 2, "clavicle.elev": 4 },
      BRACE_ARM,
      HINGE,
    ),
    end: sidedHints(
      "L",
      { ...ROW, "shoulder.elev": 34, "shoulder.plane": 18, "elbow.flex": 102, "clavicle.prot": -14, "clavicle.elev": 10 },
      BRACE_ARM,
      HINGE,
    ),
  },
  checks: () => [
    checkFlatBack("Keep your lower back flat and your torso fixed while the elbow arcs out about 45 degrees."),
    checkNeutralNeck("Brace the free hand on the bench with a straight elbow and keep your chest facing forward."),
    checkJointRange(
      "elbow-out-row",
      "Elbow arcs back and out",
      "Drive the elbow backward, upward, and about 45 degrees out from your side.",
      "elbow_L.flex",
      60,
    ),
    checkJointWithinAt(
      "hybrid",
      "Hybrid overhand grip",
      "Angle the palm diagonally backward and inward so the elbow points out and back.",
      "forearm_L.pron",
      "start",
      15,
      65,
    ),
    checkJointWithinAt(
      "flare",
      "Elbow finishes flared",
      "Finish with the elbow slightly behind the torso or aligned with it, flared about 45 degrees.",
      "shoulder_L.plane",
      "peak",
      8,
      28,
    ),
  ],
});
