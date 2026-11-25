import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { box } from "../equipment";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/**
 * Hinged stance at a plate-loaded lever row with no chest pad.
 * Neutral parallel handles, elbows stay near the ribs.
 */
const HINGE = {
  ...POSTURE_HINTS.standing,
  "root.y": 0.86,
  "root.z": 0.04,
  "root.pitch": 50,
  "hip.flex": 68,
  "hip.abd": 12,
  "knee.flex": 28,
  "ankle.dorsi": 8,
  "lumbar.flex": 6,
  "thoracic.flex": 6,
  "neck.flex": -4,
};

const GRIP = {
  "shoulder.twist": 0,
  "forearm.pron": 0,
  "wrist.flex": 4,
};

export const spec = buildExerciseSpec({
  id: "bent-over-plate-loaded-machine-row",
  catalogId: "2fe5c6f170d88015b8cefcc4b6409e41",
  name: "Bent-Over Plate-Loaded Machine Row",
  defaultLoadKg: 8,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Row", "Hinge", "Lower", "Reach"],
  tempo: { lower: 1.2, bottom: 0.25, raise: 1.5, top: 0.3 },
  station: { kind: "standing", stanceX: 0.2, heelZ: 0.02, toeOutDeg: 10, torsoLeanDeg: 50 },
  apparatus: {
    kind: "machine-handles",
    orientation: "neutral",
    anchor: "grip",
    forceDir: [0, 1, 0.05],
  },
  stiffness: { lumbar: 14, thoracic: 10, hip: 8, knee: 5 },
  extraEquipment: [
    box("lever.post", [0, 0.55, 0.55], [0.08, 1.05, 0.08], "steel", false),
    box("lever.hornL", [0.42, 0.7, 0.7], [0.06, 0.06, 0.2], "chrome", false),
    box("lever.hornR", [-0.42, 0.7, 0.7], [0.06, 0.06, 0.2], "chrome", false),
  ],
  extraContacts: {
    handle_L: { thigh_L: 0.06, shank_L: 0.08, pelvis: 0.05, upperarm_L: 0.05, girdle: 0.05 },
    handle_R: { thigh_R: 0.06, shank_R: 0.08, pelvis: 0.05, upperarm_R: 0.05, girdle: 0.05 },
  },
  extraGoals: (body) => [
    ({ frame, push }) => {
      const left = anchorPoint(body, frame, "grip_L");
      const right = anchorPoint(body, frame, "grip_R");
      push(32 * (left.x - 0.16));
      push(32 * (right.x + 0.16));
      push(16 * (left.z - 0.22));
      push(16 * (right.z - 0.22));
    },
  ],
  hints: {
    start: {
      ...HINGE,
      ...GRIP,
      "shoulder.elev": 52,
      "shoulder.plane": 70,
      "elbow.flex": 10,
      "clavicle.prot": 6,
      "clavicle.elev": 4,
    },
    end: {
      ...HINGE,
      ...GRIP,
      "shoulder.elev": 34,
      "shoulder.plane": 58,
      "elbow.flex": 108,
      "clavicle.prot": -14,
      "clavicle.elev": 6,
    },
  },
  checks: () => [
    checkFlatBack(
      "Hinge at the hips until the torso is closer to horizontal than vertical, keep the lower back flat, and hold that torso angle for the whole set.",
    ),
    checkNeutralNeck("Keep the chest up and the neck in line with the hinged torso rather than rounding through the back."),
    checkJointRange(
      "row",
      "Elbows drive back",
      "Pull the lever handles to the torso by driving the elbows up and back until they are level with the torso or slightly behind it.",
      "elbow_L.flex",
      60,
    ),
    checkJointWithinAt(
      "arms-long",
      "Elbows start straight",
      "Start with the elbows straight and the handles in front of the shoulders so the plates load the row from a full reach.",
      "elbow_L.flex",
      "start",
      0,
      32,
    ),
    checkJointWithinAt(
      "neutral",
      "Neutral grip",
      "Grasp the parallel handles with a neutral grip so the palms face each other.",
      "forearm_L.pron",
      "start",
      -25,
      25,
    ),
    checkJointWithinAt(
      "tucked",
      "Elbows stay near the ribs",
      "Keep the elbows tucked fairly close to the sides on the neutral handles rather than flaring them out wide.",
      "shoulder_L.plane",
      "peak",
      -40,
      78,
    ),
    checkJointWithinAt(
      "scapulae",
      "Shoulder blades pinch",
      "Squeeze the shoulder blades together at the end of the pull.",
      "clavicle_L.prot",
      "peak",
      -30,
      -2,
    ),
  ],
});
