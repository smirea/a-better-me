import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

const SIT = {
  ...POSTURE_HINTS.seated,
  "root.y": 0.5,
  "root.pitch": 28,
  "hip.flex": 70,
  "hip.abd": 16,
  "knee.flex": 78,
  "lumbar.flex": 12,
  "thoracic.flex": 18,
  "shoulder.elev": 22,
  "shoulder.plane": 40,
  "elbow.flex": 48,
  "forearm.pron": 16,
  "wrist.flex": 6,
};

export const spec = buildExerciseSpec({
  id: "head-harness-neck-extension",
  catalogId: "2a05c6f170d880f99f47e1aed3f5f87c",
  name: "Head Harness Neck Extension",
  defaultLoadKg: 6,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "open",
  phaseLabels: ["Nod down", "Chin", "Extend", "Neutral"],
  tempo: { lower: 2.2, bottom: 0.35, raise: 2.0, top: 0.35 },
  station: {
    kind: "seated",
    seatY: 0.46,
    stanceX: 0.2,
    heelZ: 0.38,
    leanDeg: 32,
    frame: { type: "flat-bench", zHead: -0.5, zFoot: 0.28 },
    passiveJoints: ["hip", "knee", "ankle", "shoulder", "elbow"],
  },
  apparatus: {
    kind: "band",
    anchors: [[0, 0.18, 0.32]],
    targetAnchors: ["headTop"],
    sides: ["L"],
  },
  stiffness: { neck: 0.6, lumbar: 10, thoracic: 8 },
  hints: {
    start: { ...SIT, "neck.flex": 42 },
    end: { ...SIT, "neck.flex": -12 },
  },
  checks: () => [
    checkFlatBack(
      "Lean the torso forward and keep it still. Only the head nods.",
      12,
    ),
    checkJointWithinAt(
      "chin-tucked",
      "Chin starts toward the chest",
      "Nod the head down, tilting the chin toward the chest through a comfortable range.",
      "neck.flex",
      "start",
      24,
      52,
    ),
    checkJointWithinAt(
      "extended",
      "Neck extends back toward neutral",
      "Nod the head up until the face points forward. There is no need to look at the ceiling.",
      "neck.flex",
      "peak",
      -28,
      6,
    ),
    checkJointRange(
      "neck-extension",
      "Neck extends against the harness",
      "The weight hangs from the harness between the legs while the neck does the lifting.",
      "neck.flex",
      28,
    ),
  ],
});
