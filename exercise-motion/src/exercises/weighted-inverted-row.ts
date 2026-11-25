import { Vector3 } from "three";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { box, powerRack } from "../equipment";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { pin } from "../solver";

/** Hip-height bar in the J-cups. The body stays in a straight bridge and the chest travels to the bar. */
const BAR_Y = 0.86;
const BAR_Z = -0.12;

const BODY = {
  ...POSTURE_HINTS.supineFlat,
  "root.y": 0.42,
  "root.z": 0.02,
  "root.pitch": -72,
  "hip.flex": 8,
  "hip.abd": 8,
  "knee.flex": 48,
  "ankle.dorsi": 0,
  "lumbar.flex": 0,
  "thoracic.flex": 0,
  "neck.flex": 4,
};

const GRIP = {
  "shoulder.twist": 12,
  "forearm.pron": 72,
  "wrist.flex": 6,
  "shoulder.plane": 70,
};

export const spec = buildExerciseSpec({
  id: "weighted-inverted-row",
  catalogId: "32e5c6f170d880efb190df52550f9f93",
  name: "Weighted Inverted Row",
  defaultLoadKg: 12,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Pull", "Chest to bar", "Lower", "Long arms"],
  tempo: { lower: 1.4, bottom: 0.25, raise: 1.4, top: 0.3 },
  station: {
    kind: "lying",
    surface: "floor",
    face: "up",
    pinSacrum: false,
    feetOnFloor: false,
    heelZ: 0.55,
    stanceX: 0.14,
  },
  stiffness: { hip: 8, knee: 8, lumbar: 10, thoracic: 8 },
  apparatus: {
    kind: "barbell",
    style: "straight",
    gripX: 0.32,
    path: { startY: BAR_Y, startZ: BAR_Z, endY: BAR_Y, endZ: BAR_Z },
  },
  extraEquipment: [
    ...powerRack({ hookY: BAR_Y, safetyY: 0.42, zCenter: -0.05, height: 2.05 }).parts,
    box("vest.plate", [0, 0.55, 0.08], [0.32, 0.04, 0.28], "plate", false),
  ],
  extraGoals: (body) => [
    pin(body, "heel_L", () => new Vector3(0.14, 0.04, 0.48), 26),
    pin(body, "heel_R", () => new Vector3(-0.14, 0.04, 0.48), 26),
  ],
  extraContacts: {
    "rack.hook_L": { hand_L: 0.06 },
    "rack.hook_R": { hand_R: 0.06 },
  },
  hints: {
    start: {
      ...BODY,
      ...GRIP,
      "shoulder.elev": 118,
      "elbow.flex": 12,
      "clavicle.prot": 4,
      "clavicle.elev": 6,
    },
    end: {
      ...BODY,
      "root.y": 0.58,
      ...GRIP,
      "shoulder.elev": 78,
      "shoulder.plane": 48,
      "elbow.flex": 110,
      "clavicle.prot": -14,
      "clavicle.elev": 10,
    },
  },
  checks: () => [
    checkFlatBack(
      "Keep a straight line from your knees through your hips to your shoulders, like a reverse plank. Do not let the hips sag.",
      12,
    ),
    checkNeutralNeck("Keep your neck quiet while your chest travels toward the bar."),
    checkJointRange(
      "inverted-row",
      "Chest travels to the bar",
      "Pull your chest toward the bar by driving your elbows downward and backward and pulling your shoulder blades together.",
      "elbow_L.flex",
      40,
    ),
    checkJointWithinAt(
      "long-arms",
      "Arms start outstretched",
      "Start with your arms outstretched up toward the bar and your heels driven into the floor.",
      "elbow_L.flex",
      "start",
      0,
      32,
    ),
    checkJointWithinAt(
      "overhand",
      "Overhand grip",
      "Grasp the bar with a slightly outside shoulder-width overhand grip so your palms face your feet.",
      "forearm_L.pron",
      "start",
      45,
      90,
    ),
    checkJointWithinAt(
      "bridge",
      "Hips stay bridged",
      "Squeeze your glutes and keep the knees, hips, and shoulders aligned for the whole set.",
      "hip_L.flex",
      "peak",
      -10,
      28,
    ),
  ],
});
