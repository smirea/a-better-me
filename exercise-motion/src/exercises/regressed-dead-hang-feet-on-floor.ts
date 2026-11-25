import { Vector3 } from "three";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { pullUpStation } from "../equipment-library";
import { checkJointWithinAt } from "../postures";
import { pin, plantToe } from "../solver";

const BAR_Y = 2.08;

/** Overhand hang with the bar low enough that the balls of the feet stay down and the heels lift. */
const HOLD = {
  ...POSTURE_HINTS.hanging,
  "root.y": 1.06,
  "root.z": 0.02,
  "root.pitch": 0,
  "lumbar.flex": 2,
  "thoracic.flex": 0,
  "neck.flex": 6,
  "hip.flex": 8,
  "hip.abd": 4,
  "knee.flex": 10,
  "ankle.dorsi": -16,
  "clavicle.elev": 2,
  "shoulder.elev": 168,
  "shoulder.plane": 16,
  "shoulder.twist": -14,
  "elbow.flex": 8,
  "forearm.pron": 76,
  "wrist.flex": 12,
};

export const spec = buildExerciseSpec({
  id: "regressed-dead-hang-feet-on-floor",
  catalogId: "1e75c6f170d880a2ba4bdf854dcdf5e3",
  name: "Regressed Dead Hang (Feet On Floor)",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  isometric: true,
  brace: true,
  phaseLabels: ["Set", "Hang", "Hold", "Hold"],
  // The hanging station marks the hips passive, which dumps the foot contact into the spine.
  station: { kind: "cardio", machine: "none" },
  extraEquipment: pullUpStation(BAR_Y, 0, 1.2).parts,
  extraContacts: { "pullup.bar": { hand_L: 0.07, hand_R: 0.07, forearm_L: 0.04, forearm_R: 0.04 } },
  extraGoals: (body) => [
    pin(body, "grip_L", () => new Vector3(0.22, BAR_Y, 0), 52),
    pin(body, "grip_R", () => new Vector3(-0.22, BAR_Y, 0), 52),
    ...plantToe(body, "L", new Vector3(0.12, 0.02, -0.02), 0.1, 28),
    ...plantToe(body, "R", new Vector3(-0.12, 0.02, -0.02), 0.1, 28),
  ],
  ground: "grip_L",
  apparatus: {
    kind: "none",
    bodyweightLoads: [
      { anchor: "grip_L", bodyweightShare: 0.22, grip: "hang", direction: [0, 1, 0] },
      { anchor: "grip_R", bodyweightShare: 0.22, grip: "hang", direction: [0, 1, 0] },
    ],
  },
  stiffness: { shoulder: 8, elbow: 8, wrist: 6, ankle: 3, knee: 3, thoracic: 14, lumbar: 10, hip: 2 },
  extraRequired: [
    { label: "Left hand on bar", anchor: "grip_L", part: "pullup.bar", allowSlide: true },
    { label: "Right hand on bar", anchor: "grip_R", part: "pullup.bar", allowSlide: true },
    { label: "Left forefoot on floor", anchor: "ballIn_L", surfaceY: 0.02, allowSlide: true },
    { label: "Right forefoot on floor", anchor: "ballIn_R", surfaceY: 0.02, allowSlide: true },
  ],
  hints: { start: HOLD, end: HOLD },
  checks: () => [
    checkJointWithinAt(
      "elbows-straight",
      "Elbows stay straight",
      "Keep your elbows straight while your hands grasp the bar.",
      "elbow_L.flex",
      "start",
      0,
      22,
    ),
    checkJointWithinAt(
      "heels-up",
      "Heels lift while the forefeet stay down",
      "Bend your knees enough to lift your heels while the balls of your feet and your toes stay on the ground.",
      "ankle_L.dorsi",
      "start",
      -40,
      -4,
    ),
    checkJointWithinAt(
      "arms-overhead",
      "Arms stay overhead",
      "Reach overhead with an overhand grip and hang while your feet share some of your weight.",
      "shoulder_L.elev",
      "start",
      145,
      180,
    ),
    checkJointWithinAt(
      "soft-knees",
      "Knees stay softly bent",
      "A small knee bend lets you unload the hands without picking the feet off the floor.",
      "knee_L.flex",
      "start",
      0,
      40,
    ),
  ],
});
