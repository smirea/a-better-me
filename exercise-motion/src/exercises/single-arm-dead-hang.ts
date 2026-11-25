import { Vector3 } from "three";
import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { pullUpStation } from "../equipment-library";
import { checkJointWithinAt } from "../postures";
import { pin } from "../solver";

const BAR_Y = 2.24;

/** Working arm locked overhead. The free arm hangs beside the ribs. */
const ACTIVE = {
  "clavicle.elev": 4,
  "shoulder.elev": 172,
  "shoulder.plane": 2,
  "shoulder.twist": 0,
  "elbow.flex": 6,
  "forearm.pron": 76,
  "wrist.flex": 14,
};

const FREE = {
  "clavicle.elev": 0,
  "shoulder.elev": 12,
  "shoulder.plane": 20,
  "shoulder.twist": 6,
  "elbow.flex": 14,
  "forearm.pron": 20,
  "wrist.flex": 0,
};

const HOLD = {
  ...POSTURE_HINTS.hanging,
  "root.y": 1.26,
  "root.x": 0.04,
  "root.z": 0,
  "root.pitch": 2,
  "lumbar.flex": 4,
  "thoracic.flex": 2,
  "thoracic.bend": 4,
  "neck.flex": 6,
  "hip.flex": 16,
  "hip.abd": 6,
  "knee.flex": 52,
  "ankle.dorsi": 8,
};

export const spec = buildExerciseSpec({
  id: "single-arm-dead-hang",
  catalogId: "1a15c6f170d88086828becf503a509c6",
  name: "Single Arm Dead Hang",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  isometric: true,
  brace: true,
  phaseLabels: ["Set", "Hang", "Hold", "Hold"],
  // The hanging station pins both hands to the bar, so a one-arm hang uses the same pull-up frame directly.
  station: { kind: "cardio", machine: "none" },
  extraEquipment: pullUpStation(BAR_Y, 0, 1.2).parts,
  extraContacts: { "pullup.bar": { hand_L: 0.07, forearm_L: 0.04 } },
  extraRequired: [{ label: "Working hand on bar", anchor: "grip_L", part: "pullup.bar", allowSlide: true }],
  extraGoals: (body) => [
    pin(body, "grip_L", () => new Vector3(0.06, BAR_Y, 0), 56),
    pin(body, "sternum", () => new Vector3(0.02, 1.48, 0.02), 18, "x"),
  ],
  ground: "grip_L",
  apparatus: {
    kind: "none",
    // A true one-arm bodyweight hang overloads the grip model, so the share stays under that ceiling.
    bodyweightLoads: [{ anchor: "grip_L", bodyweightShare: 0.42, grip: "hang", direction: [0, 1, 0] }],
  },
  stiffness: { shoulder: 8, elbow: 8, wrist: 6, lumbar: 8, hip: 4 },
  hints: {
    start: sidedHints("L", ACTIVE, FREE, HOLD),
    end: sidedHints("L", ACTIVE, FREE, HOLD),
  },
  checks: () => [
    checkJointWithinAt(
      "working-elbow-straight",
      "Working elbow stays straight",
      "Hang from one straight arm with your feet off the ground.",
      "elbow_L.flex",
      "start",
      0,
      22,
    ),
    checkJointWithinAt(
      "working-arm-overhead",
      "Working arm stays overhead",
      "Reach up with one arm and grasp the bar with an overhand grip.",
      "shoulder_L.elev",
      "start",
      145,
      180,
    ),
    checkJointWithinAt(
      "free-arm-down",
      "Free arm stays off the bar",
      "Only the working hand holds the bar. The other arm hangs free.",
      "shoulder_R.elev",
      "start",
      0,
      40,
    ),
    checkJointWithinAt(
      "feet-tucked",
      "Knees bend so the feet leave the floor",
      "Lift your feet off the ground by bending your knees and hold.",
      "knee_L.flex",
      "start",
      28,
      85,
    ),
  ],
});
