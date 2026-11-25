import { Vector3 } from "three";
import { anchorPoint, type Body, type Frame } from "../body";
import { everyFrame, within } from "../checks";
import type { FormCheck } from "../exercise";
import { deg } from "../math";
import { braceBothHands, checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck, plantBothToes, POSTURE_HINTS } from "../postures";
import { composeExercise } from "../scene";
import { lockAngle, mirrored, pin } from "../solver";

const HAND_Z = 0.3;
const HAND_HALF_WIDTH = 0.24;
const TOE_Z = -0.98;

/** Upper arm against the trunk's long axis, both seen from above: 0° is tucked to the sides, 90° a T. */
function elbowFlare(body: Body, frame: Frame) {
  const shoulder = frame.pos[body.index.shoulder_L];
  const elbow = frame.pos[body.index.elbow_L];
  const hip = frame.pos[body.index.hip_L];
  const arm = new Vector3(elbow.x - shoulder.x, 0, elbow.z - shoulder.z).normalize();
  const trunk = new Vector3(hip.x - shoulder.x, 0, hip.z - shoulder.z).normalize();
  return deg(Math.acos(Math.min(1, arm.dot(trunk))));
}

const chestTouch: FormCheck = {
  id: "chest-to-floor",
  label: "Chest lowers to the floor",
  cue: "bend your elbows to lower your chest in a controlled manner until it lightly touches the ground.",
  evaluate: ({ body, frames, bottom }) => {
    const y = anchorPoint(body, frames[bottom], "chestFront").y;
    return { pass: y < 0.08, measured: `chest front is ${(y * 100).toFixed(1)} cm off the floor at the bottom (target < 8 cm)` };
  },
};

const flare: FormCheck = {
  id: "elbow-flare",
  label: "Elbows flare 45–75°",
  cue: "This commonly results in the upper arms forming approximately 45-75-degree angles with the torso (when viewed from above) at the bottom of the push-up.",
  evaluate: ({ body, frames, bottom }) => {
    const a = elbowFlare(body, frames[bottom]);
    return { pass: within(a, 40, 78), measured: `upper arm is ${a.toFixed(0)}° from the torso seen from above (target 45°–75°)` };
  },
};

const straightLine: FormCheck = {
  id: "straight-line",
  label: "Hips stay in line",
  cue: "Particularly avoid letting your hips sag from lower back arching or hike up from bending your hips.",
  evaluate: (context) => everyFrame(context, (_, a) => Math.abs(deg(a["hip_L.flex"])), 10, "° of hip bend"),
};

export const spec = composeExercise({
  id: "push-up",
  catalogId: "1a05c6f170d880a5b43fe13bcb1b6f3a",
  name: "Push-Up",
  defaultLoadKg: 0,
  loadUnit: "total",
  setup(body) {
    const p = POSTURE_HINTS.pronePlank;
    const fingers = new Vector3(0, 0, 1);
    return {
      hints: {
        start: {
          ...p,
          "root.z": -0.1,
          "root.y": 0.5,
          "root.pitch": 72,
          "hip.flex": 0,
          "knee.flex": 2,
          "shoulder.elev": 80,
          "shoulder.plane": 80,
          "elbow.flex": 2,
          "neck.flex": 2,
        },
        end: {
          ...p,
          "root.z": -0.1,
          "root.y": 0.22,
          "root.pitch": 84,
          "hip.flex": 0,
          "knee.flex": 2,
          "shoulder.elev": 55,
          "shoulder.plane": 5,
          "elbow.flex": 100,
          "neck.flex": 2,
          "clavicle.prot": -12,
        },
      },
      goals: [
        ...braceBothHands(body, 0, new Vector3(0, 0, HAND_Z), HAND_HALF_WIDTH, fingers),
        ...plantBothToes(body, 0.1, TOE_Z),
        lockAngle(body, "hip_L.flex", 0, 8),
        lockAngle(body, "hip_R.flex", 0, 8),
        lockAngle(body, "knee_L.flex", 2, 8),
        lockAngle(body, "knee_R.flex", 2, 8),
        // A plank stands on toes broken ~70° with the ankle near neutral; left free, the solver sinks into the calves.
        lockAngle(body, "ankle_L.dorsi", 14, 2),
        lockAngle(body, "ankle_R.dorsi", 14, 2),
        mirrored(body, 6),
      ],
      keyGoals: {
        start: [
          lockAngle(body, "elbow_L.flex", 2, 10),
          // Shoulders stacked over the wrists (the palm centre sits ~7 cm ahead of the wrist), arms straight down.
          pin(body, "shoulder_L", () => new Vector3(0, 0, HAND_Z - 0.1), 30, "z"),
        ],
        end: [
          pin(body, "chestFront", () => new Vector3(0, 0.05, 0), 20, "y"),
          // Elbows flared about 60° from the trunk at the bottom, between tucked (0°) and a T (90°).
          ...(["L", "R"] as const).flatMap((side) => [
            lockAngle(body, `shoulder_${side}.elev`, 55, 6),
            lockAngle(body, `shoulder_${side}.plane`, 10, 4),
          ]),
        ],
      },
      stiffness: { default: 1, lumbar: 10, thoracic: 10, neck: 4 },
      progress: (frame) => anchorPoint(body, frame, "chestFront").y,
      ground: "palm_L",
      grips: "flat-floor",
      loads: [
        // The floor pushes up on the hands and toes; without `direction` a bodyweight share would hang from them.
        { anchor: "palm_L", share: 0, bodyweightShare: 0.34, grip: "press", direction: [0, 1, 0] },
        { anchor: "palm_R", share: 0, bodyweightShare: 0.34, grip: "press", direction: [0, 1, 0] },
        { anchor: "forefoot_L", share: 0, bodyweightShare: 0.16, grip: "rest", direction: [0, 1, 0] },
        { anchor: "forefoot_R", share: 0, bodyweightShare: 0.16, grip: "rest", direction: [0, 1, 0] },
      ],
      support: { kind: "supported", brace: true },
      required: [
        { label: "Left palm", anchor: "palm_L", surfaceY: 0 },
        { label: "Right palm", anchor: "palm_R", surfaceY: 0 },
        { label: "Left forefoot", anchor: "forefoot_L", surfaceY: 0 },
        { label: "Right forefoot", anchor: "forefoot_R", surfaceY: 0 },
      ],
      checks: [
        chestTouch,
        checkJointWithinAt("elbows-straight", "Elbows lock out at the top", "Finish with your elbows fully straightened.", "elbow_L.flex", "start", 0, 12),
        flare,
        straightLine,
        checkFlatBack(
          "Contracting your abs and glutes will help you keep your back in a mostly flat position with your hips held up (but not excessively hiked up) rather than letting your hips sag.",
        ),
        checkJointRange(
          "scapula-retracts",
          "Shoulder blades pull back on the way down",
          "allow your shoulder blades to pull back together as you lower yourself, which will result in you having a \u201cproud chest posture\u201d",
          "clavicle_L.prot",
          15,
        ),
        checkNeutralNeck("Keep your neck near a neutral position, as you would normally do when standing upright."),
      ],
      cameraHint: { view: "Side" },
    };
  },
});
