import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { IDENTITY, sphere } from "../equipment";
import type { ExerciseSpec } from "../exercise";
import { checkAnchorTravel, checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { plantToe } from "../solver";
import { Vector3 } from "three";

const BALL_R = 0.32;

const KNEEL = {
  ...POSTURE_HINTS.kneeling,
  "root.z": 0.02,
  "lumbar.flex": 10,
  "thoracic.flex": 4,
  "neck.flex": 2,
  "hip.flex": 8,
  "hip.abd": 6,
  "knee.flex": 100,
  "ankle.dorsi": -30,
  "clavicle.prot": 6,
  "shoulder.plane": 88,
  "shoulder.twist": 6,
  "elbow.flex": 8,
  "forearm.pron": 72,
  "wrist.flex": 4,
};

const base = buildExerciseSpec({
  id: "stability-ball-rollout",
  catalogId: "2a25c6f170d880268432ceb1f40307a1",
  name: "Stability Ball Rollout",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  brace: true,
  phaseLabels: ["Kneel", "Lean", "Reach", "Return"],
  station: { kind: "kneeling" },
  apparatus: {
    kind: "none",
    bodyweightLoads: [
      { anchor: "palmFlat_L", bodyweightShare: 0.12, grip: "press", direction: [0, 1, 0] },
      { anchor: "palmFlat_R", bodyweightShare: 0.12, grip: "press", direction: [0, 1, 0] },
    ],
  },
  stiffness: { lumbar: 16, thoracic: 12, hip: 8, knee: 6, elbow: 8, shoulder: 2 },
  extraGoals: (body) => [
    ...plantToe(body, "L", new Vector3(0.14, 0.08, -0.4), 0, 120),
    ...plantToe(body, "R", new Vector3(-0.14, 0.08, -0.4), 0, 120),
  ],
  hints: {
    start: { ...KNEEL, "root.y": 0.52, "root.pitch": 8, "shoulder.elev": 72 },
    end: { ...KNEEL, "root.y": 0.46, "root.pitch": 28, "shoulder.elev": 108 },
  },
  checks: () => [
    checkFlatBack(
      "Keep your glutes squeezed and your core braced so your knees, hips, and shoulders stay aligned and your lower back does not arch.",
      12,
    ),
    checkNeutralNeck("Keep your neck near a neutral position like you would normally do when standing upright."),
    checkAnchorTravel(
      "torso-leans",
      "Torso and thighs lean forward as one",
      "Slowly lean your torso and thighs forward as one unit as you let the ball roll forward and your arms angle forward.",
      "grip_L",
      "z",
      0.08,
    ),
    checkJointRange(
      "arms-reach",
      "Straight arms roll the ball forward",
      "The forward movement of the arms is the same shoulder motion as lifting your arms straight forward and up overhead.",
      "shoulder_L.elev",
      28,
    ),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows stay straight",
      "Place your palms on the ball with straight elbows and keep them straight as you roll.",
      "elbow_L.flex",
      "peak",
      0,
      24,
    ),
    checkJointWithinAt(
      "hips-stay-open",
      "Hips do not fold",
      "Continue avoiding letting your hips bend or arching your lower back. You should still be able to draw a straight line from your knees through your hips to your shoulders.",
      "hip_L.flex",
      "peak",
      -8,
      28,
    ),
  ],
});

export const spec: ExerciseSpec = {
  ...base,
  build(body) {
    const built = base.build(body);
    built.props.push({
      id: "ball",
      kind: "parts",
      parts: [sphere("ball.body", [0, 0, 0], BALL_R, "accent")],
    });
    built.contacts["ball.body"] = {
      hand_L: 0.09,
      hand_R: 0.09,
      forearm_L: 0.06,
      forearm_R: 0.06,
    };
    const prev = built.propState;
    built.propState = (frame, extras) => {
      const states = prev(frame, extras);
      const l = anchorPoint(body, frame, "palmFlat_L");
      const r = anchorPoint(body, frame, "palmFlat_R");
      states.push({ pos: [(l.x + r.x) / 2, BALL_R, (l.z + r.z) / 2 - 0.02], quat: IDENTITY });
      return states;
    };
    return built;
  },
};
