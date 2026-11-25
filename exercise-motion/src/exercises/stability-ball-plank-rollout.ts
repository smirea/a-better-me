import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { IDENTITY, sphere } from "../equipment";
import { exerciseMat } from "../equipment-library";
import type { ExerciseSpec } from "../exercise";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck, plantBothToes } from "../postures";
import { pin } from "../solver";
import { Vector3 } from "three";

const BALL_R = 0.32;

const PLANK = {
  ...POSTURE_HINTS.pronePlank,
  "root.y": 0.72,
  "root.pitch": 78,
  "lumbar.flex": 12,
  "thoracic.flex": 6,
  "neck.flex": 2,
  "hip.flex": 6,
  "hip.abd": 6,
  "knee.flex": 6,
  "ankle.dorsi": 8,
  "clavicle.prot": 12,
  "shoulder.plane": 84,
  "shoulder.twist": 18,
  "forearm.pron": 70,
  "wrist.flex": 0,
};

const base = buildExerciseSpec({
  id: "stability-ball-plank-rollout",
  catalogId: "2d85c6f170d880c98191fe4f739ddaca",
  name: "Stability Ball Plank Rollout",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "open",
  brace: true,
  phaseLabels: ["Plank", "Roll out", "Reach", "Pull back"],
  ground: "ballIn_L",
  station: { kind: "cardio", machine: "none" },
  extraEquipment: exerciseMat(0.9, 2.2, 0),
  apparatus: {
    kind: "none",
    bodyweightLoads: [
      { anchor: "forearmMid_L", bodyweightShare: 0.14, grip: "press", direction: [0, 1, 0] },
      { anchor: "forearmMid_R", bodyweightShare: 0.14, grip: "press", direction: [0, 1, 0] },
    ],
  },
  stiffness: { lumbar: 16, thoracic: 12, hip: 8, knee: 6, elbow: 3, shoulder: 2 },
  extraGoals: (body) => [
    ...plantBothToes(body, 0.11, -0.7, 0.08, 46),
    pin(body, "forearmMid_L", () => new Vector3(0.18, BALL_R * 1.82, 0), 36, "y"),
    pin(body, "forearmMid_R", () => new Vector3(-0.18, BALL_R * 1.82, 0), 36, "y"),
  ],
  hints: {
    start: { ...PLANK, "root.z": -0.08, "shoulder.elev": 70, "elbow.flex": 88 },
    end: { ...PLANK, "root.z": -0.08, "shoulder.elev": 100, "elbow.flex": 52 },
  },
  checks: () => [
    checkFlatBack(
      "Tighten your abs and squeeze your glutes so you can draw a straight line from your legs through your hips to your shoulders.",
      12,
    ),
    checkNeutralNeck("Keep your neck near a neutral position like you would normally do when standing upright."),
    checkJointRange(
      "elbows-roll-forward",
      "Elbows drive the ball forward",
      "Drive your elbows forward to push the ball forward through the range in which you can keep your lower back flat.",
      "shoulder_L.elev",
      25,
    ),
    checkJointRange(
      "elbows-open",
      "Elbows straighten as the ball rolls out",
      "While you push the ball forward, allow your elbows to straighten naturally, then return them to about 90 degrees.",
      "elbow_L.flex",
      25,
    ),
    checkJointWithinAt(
      "hips-not-sagging",
      "Hips stay up in the plank",
      "Particularly avoid letting your hips sag down or your ribs flare up, which will arch your lower back.",
      "hip_L.flex",
      "peak",
      -10,
      24,
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
      hand_L: 0.08,
      hand_R: 0.08,
      forearm_L: 0.09,
      forearm_R: 0.09,
      upperarm_L: 0.07,
      upperarm_R: 0.07,
    };
    const prev = built.propState;
    built.propState = (frame, extras) => {
      const states = prev(frame, extras);
      const l = anchorPoint(body, frame, "forearmMid_L");
      const r = anchorPoint(body, frame, "forearmMid_R");
      states.push({ pos: [(l.x + r.x) / 2, BALL_R, (l.z + r.z) / 2], quat: IDENTITY });
      return states;
    };
    return built;
  },
};
