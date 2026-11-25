import { Vector3 } from "three";
import { anchorPoint, SIDES, type Body, type Frame, type Side } from "../body";
import { everyFrame } from "../checks";
import { footContact, palmContact, type FormCheck } from "../exercise";
import { deg } from "../math";
import { checkFlatBack, checkNeutralNeck, plantBothToes, POSTURE_HINTS } from "../postures";
import { composeExercise } from "../scene";
import { keepAbove, lockAngle, mirrored, palmOnFloor, type Goal } from "../solver";

/**
 * Hands "mildly outside shoulder width": a palm's breadth outside the shoulder joint, which is about level with the
 * outside of the deltoid. Any narrower and the forearms lean far in under the chest at the bottom, where the
 * triceps hold almost the whole lift.
 */
const HAND_X = 0.31;
const HAND_Z = 0.25;
const FOOT_X = 0.12;
const FOOT_Z = -1.12;
const FINGERS = new Vector3(0.18, 0, 0.984).normalize();

/** Angle between the upper arm and the torso, viewed from above. 0° is tucked along the body, 90° is a T. */
function elbowFlareDeg(body: Body, frame: Frame, side: Side): number {
  const shoulder = frame.pos[body.index[`shoulder_${side}`]];
  const elbow = frame.pos[body.index[`elbow_${side}`]];
  const hip = frame.pos[body.index[`hip_${side}`]];
  const ax = elbow.x - shoulder.x;
  const az = elbow.z - shoulder.z;
  const tx = hip.x - shoulder.x;
  const tz = hip.z - shoulder.z;
  const arm = Math.hypot(ax, az);
  const torso = Math.hypot(tx, tz);
  if (arm < 0.06 || torso < 0.05) return 0;
  const cos = Math.min(1, Math.max(-1, (ax * tx + az * tz) / (arm * torso)));
  return (Math.acos(cos) * 180) / Math.PI;
}

function flare(body: Body, side: Side, targetDeg: number, weight: number): Goal {
  return ({ frame, push }) => push((weight * (elbowFlareDeg(body, frame, side) - targetDeg) * Math.PI) / 180);
}

/** How far the hip sits off the shoulder-to-knee line, in the side view. */
function hipOffLine(body: Body, frame: Frame): number {
  let worst = 0;
  for (const side of SIDES) {
    const shoulder = frame.pos[body.index[`shoulder_${side}`]];
    const hip = frame.pos[body.index[`hip_${side}`]];
    const knee = frame.pos[body.index[`knee_${side}`]];
    const alongY = knee.y - shoulder.y;
    const alongZ = knee.z - shoulder.z;
    const len = Math.hypot(alongY, alongZ);
    const cross = Math.abs(alongZ * (hip.y - shoulder.y) - alongY * (hip.z - shoulder.z));
    worst = Math.max(worst, cross / len);
  }
  return worst;
}

const elbowsStraight: FormCheck = {
  id: "elbows-straight",
  label: "Elbows finish straight",
  cue: "Finish with your elbows fully straightened.",
  evaluate: ({ angles, top }) => {
    const left = deg(angles[top]["elbow_L.flex"]);
    const right = deg(angles[top]["elbow_R.flex"]);
    const worst = Math.max(left, right);
    return {
      pass: worst <= 10,
      measured: `elbows ${left.toFixed(0)}° and ${right.toFixed(0)}° bent at the top`,
    };
  },
};

const chestTouches: FormCheck = {
  id: "chest-touches",
  label: "Chest touches the floor",
  cue: "bend your elbows to lower your chest in a controlled manner until it lightly touches the ground.",
  evaluate: ({ body, frames, bottom }) => {
    const gap = anchorPoint(body, frames[bottom], "chestFront").y;
    return {
      pass: gap <= 0.02 && gap >= -0.008,
      measured: `chest surface is ${(gap * 100).toFixed(1)} cm above the floor at the bottom`,
    };
  },
};

const elbowFlare: FormCheck = {
  id: "elbow-flare",
  label: "Elbows flare moderately",
  cue: "This commonly results in the upper arms forming approximately 45-75-degree angles with the torso (when viewed from above) at the bottom of the push-up.",
  evaluate: ({ body, frames, bottom }) => {
    const left = elbowFlareDeg(body, frames[bottom], "L");
    const right = elbowFlareDeg(body, frames[bottom], "R");
    return {
      pass: left >= 45 && left <= 75 && right >= 45 && right <= 75,
      measured: `upper arm to torso ${left.toFixed(0)}° and ${right.toFixed(0)}° at the bottom`,
    };
  },
};

const legsStraight: FormCheck = {
  id: "legs-straight",
  label: "Legs stay straight",
  cue: "While keeping your torso rigid and your legs straight, bend your elbows to lower your chest",
  evaluate: (context) => {
    const left = everyFrame(context, (_, a) => deg(a["knee_L.flex"]), 12, "° of left knee bend");
    const right = everyFrame(context, (_, a) => deg(a["knee_R.flex"]), 12, "° of right knee bend");
    return {
      pass: left.pass && right.pass,
      measured: `${left.measured}; ${right.measured}`,
    };
  },
};

const straightLine: FormCheck = {
  id: "straight-line",
  label: "Body stays in a straight line",
  cue: "you should still be able to draw a straight line from your thighs through your torso at the bottom of the rep.",
  evaluate: (context) =>
    everyFrame(context, (frame) => hipOffLine(context.body, frame) * 100, 5, " cm off the shoulder-knee line"),
};

const shouldersDown: FormCheck = {
  id: "shoulders-down",
  label: "Shoulders stay down",
  cue: "Without shrugging your shoulders up toward your ears, allow your shoulder blades to pull back together as you lower yourself",
  evaluate: (context) => {
    const left = everyFrame(context, (_, a) => deg(a["clavicle_L.elev"]), 16, "° of left shrug");
    const right = everyFrame(context, (_, a) => deg(a["clavicle_R.elev"]), 16, "° of right shrug");
    return { pass: left.pass && right.pass, measured: `${left.measured}; ${right.measured}` };
  },
};

const bladesTogether: FormCheck = {
  id: "blades-together",
  label: "Shoulder blades retract at the bottom",
  cue: "allow your shoulder blades to pull back together as you lower yourself, which will result in you having a “proud chest posture” by the time you contact the ground",
  evaluate: ({ angles, top, bottom }) => {
    const change = (side: Side) => deg(angles[top][`clavicle_${side}.prot`] - angles[bottom][`clavicle_${side}.prot`]);
    const left = change("L");
    const right = change("R");
    return {
      pass: left >= 8 && right >= 8,
      measured: `retraction increases ${left.toFixed(0)}° and ${right.toFixed(0)}° from the top to the bottom`,
    };
  },
};

export const spec = composeExercise({
  id: "push-up",
  catalogId: "1a05c6f170d880a5b43fe13bcb1b6f3a",
  name: "Push-Up",
  defaultLoadKg: 0,
  loadUnit: "total",
  setup(body) {
    const plank = POSTURE_HINTS.pronePlank;
    const fingers = (side: Side) => new Vector3(side === "L" ? FINGERS.x : -FINGERS.x, 0, FINGERS.z);
    // The chest sits well below the shoulder line, so a floor touch needs the torso horizontal and the elbows
    // folded out beside it. A shallower bend leaves the chest hanging.
    const tall = {
      ...plank,
      "root.y": 0.44,
      "root.z": -0.25,
      "root.pitch": 72,
      "hip.flex": 0,
      "hip.abd": 2,
      "knee.flex": 3,
      "ankle.dorsi": 12,
      "toes.ext": 52,
      "lumbar.flex": 0,
      "thoracic.flex": 0,
      "neck.flex": 2,
      "clavicle.elev": 8,
      "clavicle.prot": 0,
      "shoulder.elev": 70,
      "shoulder.plane": 80,
      "shoulder.twist": 5,
      "elbow.flex": 5,
      "forearm.pron": 50,
      "wrist.flex": -78,
      "wrist.dev": -10,
    };
    return {
      hints: {
        start: tall,
        end: {
          ...tall,
          "root.y": 0.15,
          "root.z": -0.15,
          "root.pitch": 90,
          "toes.ext": 70,
          "clavicle.prot": -12,
          "shoulder.elev": 45,
          "shoulder.plane": 10,
          "shoulder.twist": 0,
          "elbow.flex": 145,
          "wrist.flex": -45,
          "wrist.dev": -12,
        },
      },
      goals: [
        ...plantBothToes(body, FOOT_X, FOOT_Z, 0, 70),
        ...palmOnFloor(body, "L", new Vector3(HAND_X, 0, HAND_Z), fingers("L"), 100),
        ...palmOnFloor(body, "R", new Vector3(-HAND_X, 0, HAND_Z), fingers("R"), 100),
        lockAngle(body, "knee_L.flex", 3, 20),
        lockAngle(body, "knee_R.flex", 3, 20),
        lockAngle(body, "hip_L.flex", 0, 16),
        lockAngle(body, "hip_R.flex", 0, 16),
        lockAngle(body, "lumbar.flex", 0, 12),
        lockAngle(body, "thoracic.flex", 0, 8),
        lockAngle(body, "neck.flex", 2, 6),
        lockAngle(body, "clavicle_L.elev", 8, 12),
        lockAngle(body, "clavicle_R.elev", 8, 12),
        lockAngle(body, "wrist_L.dev", -12, 10),
        lockAngle(body, "wrist_R.dev", -12, 10),
        keepAbove(body, "chestFront", 0, 180),
        keepAbove(body, "elbowTip_L", 0.07, 28),
        keepAbove(body, "elbowTip_R", 0.07, 28),
        ({ frame, push }) => {
          for (const side of SIDES) {
            const elbow = frame.pos[body.index[`elbow_${side}`]];
            const wrist = frame.pos[body.index[`wrist_${side}`]];
            const low = Math.min(elbow.y - 0.046, wrist.y - 0.036);
            push(48 * Math.min(0, low - 0.004));
          }
        },
        mirrored(body, 8),
      ],
      keyGoals: {
        start: [
          lockAngle(body, "elbow_L.flex", 5, 24),
          lockAngle(body, "elbow_R.flex", 5, 24),
          lockAngle(body, "clavicle_L.prot", 0, 8),
          lockAngle(body, "clavicle_R.prot", 0, 8),
          // Arms straight down at the top: each shoulder stacked over its wrist.
          ({ frame, push }) => {
            for (const side of SIDES)
              push(60 * (frame.pos[body.index[`shoulder_${side}`]].z - frame.pos[body.index[`wrist_${side}`]].z));
          },
        ],
        end: [
          lockAngle(body, "elbow_L.flex", 138, 10),
          lockAngle(body, "elbow_R.flex", 138, 10),
          lockAngle(body, "shoulder_L.elev", 45, 14),
          lockAngle(body, "shoulder_R.elev", 45, 14),
          lockAngle(body, "shoulder_L.plane", 10, 8),
          lockAngle(body, "shoulder_R.plane", 10, 8),
          lockAngle(body, "clavicle_L.prot", -12, 8),
          lockAngle(body, "clavicle_R.prot", -12, 8),
          flare(body, "L", 55, 8),
          flare(body, "R", 55, 8),
          ({ q, frame, push }) => {
            push(14 * (q[3] - Math.PI / 2));
            const chest = anchorPoint(body, frame, "chestFront").y;
            push(60 * (chest - 0.006));
          },
        ],
      },
      stiffness: {
        default: 1,
        lumbar: 10,
        thoracic: 8,
        knee: 16,
        hip: 12,
        clavicle: 10,
        neck: 6,
        elbow: 24,
        shoulder: 26,
        wrist: 14,
        toes: 6,
        ankle: 8,
      },
      progress: (frame) => -anchorPoint(body, frame, "chestFront").y,
      ground: "forefoot_L",
      grips: "flat-floor",
      // Added load is a plate across the upper back.
      loads: [{ anchor: "upperBack", share: 1, grip: "rest" }],
      support: {
        kind: "planted",
        contacts: SIDES.flatMap((side) => [palmContact(side), footContact(side)]),
      },
      required: [
        { label: "Left palm", anchor: "palm_L", surfaceY: 0 },
        { label: "Right palm", anchor: "palm_R", surfaceY: 0 },
        { label: "Left forefoot", anchor: "forefoot_L", surfaceY: 0 },
        { label: "Right forefoot", anchor: "forefoot_R", surfaceY: 0 },
        { label: "Left toes", anchor: "toe_L", surfaceY: 0 },
        { label: "Right toes", anchor: "toe_R", surfaceY: 0 },
      ],
      checks: [
        elbowsStraight,
        chestTouches,
        elbowFlare,
        legsStraight,
        straightLine,
        shouldersDown,
        bladesTogether,
        checkNeutralNeck(
          "Keep your neck near a neutral position, as you would normally do when standing upright, which should direct your gaze to the ground slightly out in front of you.",
        ),
        checkFlatBack(
          "Contracting your abs and glutes will help you keep your back in a mostly flat position with your hips held up (but not excessively hiked up) rather than letting your hips sag",
          8,
        ),
      ],
      cameraHint: { view: "Side" },
    };
  },
});
