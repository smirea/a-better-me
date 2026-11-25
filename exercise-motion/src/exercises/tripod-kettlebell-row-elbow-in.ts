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
  "forearm.pron": 22,
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
  id: "tripod-kettlebell-row-elbow-in",
  catalogId: "3205c6f170d880d9953aec17bd072bad",
  name: "Tripod Kettlebell Row (Elbow-In)",
  defaultLoadKg: 14,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  phaseLabels: ["Row", "Hip", "Lower", "Hang"],
  tempo: { lower: 1.2, bottom: 0.25, raise: 1.45, top: 0.3 },
  station: {
    kind: "standing",
    stanceX: 0.18,
    heelZ: -0.2,
    toeOutDeg: 8,
    torsoLeanDeg: 58,
    split: { frontSide: "R", frontZ: -0.02, rearZ: -0.38, rearMode: "flat" },
  },
  apparatus: { kind: "kettlebells", sides: ["L"], hangVertical: true },
  extraEquipment: flatBench({ topY: BENCH_TOP, zHead: 0.15, zFoot: 1.15 }),
  extraContacts: {
    "bench.pad": { hand_R: 0.08, forearm_R: 0.05 },
  },
  extraGoals: (body) => [pin(body, "grip_R", () => new Vector3(-0.04, BENCH_TOP + 0.02, 0.28), 42)],
  hints: {
    start: sidedHints(
      "L",
      { ...ROW, "shoulder.elev": 50, "shoulder.plane": 70, "elbow.flex": 8, "clavicle.prot": 2, "clavicle.elev": 4 },
      BRACE_ARM,
      HINGE,
    ),
    end: sidedHints(
      "L",
      { ...ROW, "shoulder.elev": 34, "shoulder.plane": 42, "elbow.flex": 100, "clavicle.prot": -14, "clavicle.elev": 10 },
      BRACE_ARM,
      HINGE,
    ),
  },
  checks: () => [
    checkFlatBack(
      "Keep your lower back flat and your torso fixed. A mild rotation is fine; do not turn the row into a cheat.",
    ),
    checkNeutralNeck("Brace the free hand on the bench with a straight elbow and keep your chest facing forward."),
    checkJointRange(
      "elbow-in-row",
      "Elbow drives back toward the hip",
      "Drive your elbow backward and upward in an arc, tucked by your side, and pull the kettlebell toward your hip.",
      "elbow_L.flex",
      65,
    ),
    checkJointWithinAt(
      "neutral",
      "Neutral grip",
      "Let the working arm hang in toward the opposite side so the palm faces inward.",
      "forearm_L.pron",
      "start",
      -30,
      30,
    ),
    checkJointWithinAt(
      "brace-arm",
      "Brace arm stays straight",
      "Keep the non-working elbow straight and the hand braced on the bench the whole set.",
      "elbow_R.flex",
      "peak",
      0,
      24,
    ),
    checkJointWithinAt(
      "tucked",
      "Elbow finishes by the torso",
      "Finish with the elbow slightly behind the torso or at least aligned with it, still tucked.",
      "elbow_L.flex",
      "peak",
      90,
      140,
    ),
  ],
});
