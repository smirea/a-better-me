import { buildExerciseSpec, holdElbowNearShoulder, POSTURE_HINTS, sidedHints } from "../builders";
import { everyFrame } from "../checks";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** Left arm vertical beside the head; the free arm hangs. Opposite foot steps forward. */
const ACTIVE = {
  "shoulder.elev": 155,
  "shoulder.plane": 72,
  "shoulder.twist": 8,
  "forearm.pron": 0,
  "wrist.flex": 0,
  "clavicle.elev": 8,
  "clavicle.prot": 0,
};

const REST = {
  "shoulder.elev": 16,
  "shoulder.plane": 20,
  "shoulder.twist": 8,
  "elbow.flex": 12,
  "forearm.pron": 20,
  "wrist.flex": 0,
  "clavicle.elev": 0,
  "clavicle.prot": -6,
};

const TRUNK = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 12,
  "hip.flex": 12,
  "lumbar.flex": 2,
  "thoracic.flex": 0,
  "neck.flex": 10,
  "knee.flex": 12,
};

export const spec = buildExerciseSpec({
  id: "single-arm-cable-overhead-triceps-extension",
  catalogId: "1a15c6f170d880bea7f6e5698ee2a6f7",
  name: "Single Arm Cable Overhead Triceps Extension",
  defaultLoadKg: 5,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  phaseLabels: ["Press", "Lockout", "Lower", "Stretch"],
  tempo: { lower: 1.3, bottom: 0.3, raise: 1.7, top: 0.4 },
  station: {
    kind: "standing",
    stanceX: 0.14,
    torsoLeanDeg: 12,
    balanceZ: false,
    split: { frontSide: "R", frontZ: 0.22, rearZ: -0.16, rearMode: "flat" },
  },
  apparatus: {
    kind: "cable-single",
    pulley: [0.16, 0.55, -0.85],
    facingDir: 1,
    attachment: "d-handle",
    sides: ["L"],
  },
  hints: {
    start: sidedHints("L", { ...ACTIVE, "elbow.flex": 130 }, REST, TRUNK),
    end: sidedHints("L", { ...ACTIVE, "elbow.flex": 8 }, REST, TRUNK),
  },
  extraGoals: (body) => [holdElbowNearShoulder(body, "L", [0.04, 0.02, 0.0], 16, "xz")],
  checks: () => [
    checkFlatBack(
      "Rather than being excessively arched from leaning back toward the cable station, your lower back should be near a neutral position.",
    ),
    checkJointWithinAt(
      "elbow-bent",
      "Working elbow starts fully bent",
      "Reverse the motion by bending your elbow and lowering the rope until you have returned to the starting position with your elbow fully bent.",
      "elbow_L.flex",
      "top",
      105,
      148,
    ),
    checkJointWithinAt(
      "elbow-straight",
      "Working elbow finishes straight",
      "While keeping your elbow up, press the rope upward by extending your elbow until it is fully straightened.",
      "elbow_L.flex",
      "bottom",
      0,
      20,
    ),
    checkJointRange(
      "elbow-rom",
      "Forearm hinges about a still elbow",
      "Essentially all the motion should occur from your forearm hinging at your elbow without any shoulder motion.",
      "elbow_L.flex",
      95,
    ),
    {
      id: "elbow-stays-up",
      label: "Upper arm stays vertical beside the head",
      cue: "As you keep your elbow up, your upper arm should remain in a vertical position by the side of your head.",
      evaluate: (context) =>
        everyFrame(
          context,
          (frame) => {
            const shoulder = frame.pos[context.body.index.shoulder_L];
            const elbow = frame.pos[context.body.index.elbow_L];
            const rise = elbow.y - shoulder.y;
            const drift = Math.hypot(elbow.x - shoulder.x, elbow.z - shoulder.z);
            return rise < 0.12 ? (0.12 - rise) * 100 : drift > 0.16 ? (drift - 0.16) * 100 : 0;
          },
          6,
          " cm off a vertical upper arm",
        ),
    },
  ],
});
