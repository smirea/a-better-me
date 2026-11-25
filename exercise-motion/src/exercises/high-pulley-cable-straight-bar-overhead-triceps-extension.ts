import { buildExerciseSpec, holdElbowNearShoulder, POSTURE_HINTS } from "../builders";
import { everyFrame } from "../checks";
import { deg } from "../math";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** High pulley: upper arms near horizontal, bar presses forward and down in front of the face. */
const ARMS = {
  "shoulder.elev": 96,
  "shoulder.plane": 40,
  "shoulder.twist": 16,
  "forearm.pron": 70,
  "wrist.flex": 0,
  "clavicle.elev": 8,
  "clavicle.prot": -2,
};

const TRUNK = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 36,
  "hip.flex": 40,
  "lumbar.flex": 6,
  "thoracic.flex": 4,
  "neck.flex": 20,
  "knee.flex": 12,
};

export const spec = buildExerciseSpec({
  id: "high-pulley-cable-straight-bar-overhead-triceps-extension",
  catalogId: "1a15c6f170d88060a7c8d05108bf2aef",
  name: "High Pulley Cable Straight Bar Overhead Triceps Extension",
  defaultLoadKg: 8,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Press", "Lockout", "Return", "Stretch"],
  tempo: { lower: 1.3, bottom: 0.3, raise: 1.7, top: 0.4 },
  station: {
    kind: "standing",
    stanceX: 0.16,
    heelZ: 0.02,
    torsoLeanDeg: 36,
    balanceZ: false,
  },
  apparatus: {
    kind: "cable-single",
    pulley: [0, 1.95, -0.85],
    facingDir: 1,
    attachment: "straight-bar",
    gripX: 0.18,
  },
  hints: {
    start: { ...TRUNK, ...ARMS, "elbow.flex": 110 },
    end: { ...TRUNK, ...ARMS, "elbow.flex": 16, "shoulder.plane": 70 },
  },
  extraGoals: (body) => [
    holdElbowNearShoulder(body, "L", [0.08, -0.02, 0.16], 16, "xy"),
    holdElbowNearShoulder(body, "R", [0.08, -0.02, 0.16], 16, "xy"),
  ],
  checks: () => [
    checkFlatBack(
      "Step forward and adopt a staggered stance before moderately leaning forward by hinging at your hips. Maintain this forward torso lean throughout your set.",
    ),
    checkJointWithinAt(
      "elbows-bent",
      "Hands start behind the head",
      "In this position, your hands should be behind your head, and you should feel tension from the cable.",
      "elbow_L.flex",
      "top",
      60,
      130,
    ),
    checkJointWithinAt(
      "elbows-straight",
      "Bar finishes in front with straight elbows",
      "Press the bar forward and somewhat downward by extending your elbows until they are straightened. At the end of this motion, the bar should be situated in front of you.",
      "elbow_L.flex",
      "bottom",
      0,
      40,
    ),
    checkJointRange(
      "elbow-rom",
      "Motion comes from the elbows",
      "Strive to continue keeping your upper arms stationary while all of the movement occurs from elbow motion.",
      "elbow_L.flex",
      30,
    ),
    {
      id: "upper-arms-level",
      label: "Upper arms stay near parallel to the ground",
      cue: "Make sure your upper arms are situated parallel to the ground or raised up a little higher.",
      evaluate: (context) =>
        everyFrame(
          context,
          (_, angles) => Math.abs(deg(angles["shoulder_L.elev"]) - 100),
          28,
          "° off a level upper arm",
        ),
    },
    {
      id: "chin-tuck",
      label: "Chin stays tucked for cable clearance",
      cue: "Tuck your chin toward your chest so the back of your head does not obstruct the cable.",
      evaluate: (context) =>
        everyFrame(
          context,
          (_, angles) => Math.max(0, 12 - deg(angles["neck.flex"])),
          6,
          "° short of a tucked chin",
        ),
    },
  ],
});
