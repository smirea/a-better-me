import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { ALONG_Y, cylinder } from "../equipment";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { lockAngle } from "../solver";

/** Chest-supported plate-loaded iso-lateral row. Wide overhand, elbows out. */
const SEAT = {
  ...POSTURE_HINTS.seated,
  "root.pitch": 8,
  "hip.flex": 88,
  "knee.flex": 76,
  "lumbar.flex": 4,
  "thoracic.flex": 4,
  "neck.flex": 4,
};

const REACH = {
  "shoulder.elev": 78,
  "shoulder.plane": 88,
  "shoulder.twist": 16,
  "elbow.flex": 8,
  "forearm.pron": 78,
  "wrist.flex": 4,
  "clavicle.elev": 6,
  "clavicle.prot": 12,
};

const PULL = {
  "shoulder.elev": 64,
  "shoulder.plane": 20,
  "shoulder.twist": 14,
  "elbow.flex": 102,
  "forearm.pron": 74,
  "wrist.flex": 4,
  "clavicle.elev": 8,
  "clavicle.prot": -16,
};

export const spec = buildExerciseSpec({
  id: "wide-grip-plate-loaded-machine-row",
  catalogId: "2ae5c6f170d880d3959cd70b4a714957",
  name: "Wide Grip Plate-Loaded Machine Row",
  defaultLoadKg: 25,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Pull", "T", "Return", "Reach"],
  tempo: { lower: 1.4, bottom: 0.3, raise: 1.6, top: 0.3 },
  station: {
    kind: "seated",
    seatY: 0.5,
    seatZ: -0.02,
    heelZ: 0.36,
    frame: { type: "machine", chestPadZ: 0.4, chestPadY: 0.92, stackZ: -1.05 },
    feetMode: "floor",
  },
  apparatus: {
    kind: "machine-handles",
    orientation: "horizontal",
    forceDir: [0, 0, 1],
  },
  extraEquipment: [
    cylinder("row.hornL", [0.55, 0.72, -0.55], 0.02, 0.28, "steel", ALONG_Y, false),
    cylinder("row.hornR", [-0.55, 0.72, -0.55], 0.02, 0.28, "steel", ALONG_Y, false),
    cylinder("row.plateL", [0.55, 0.55, -0.55], 0.16, 0.04, "plate", ALONG_Y, false),
    cylinder("row.plateR", [-0.55, 0.55, -0.55], 0.16, 0.04, "plate", ALONG_Y, false),
  ],
  extraContacts: {
    handle_L: { upperarm_L: 0.1, chest: 0.12, thigh_L: 0.1, shank_L: 0.1, forearm_L: 0.08, pelvis: 0.08 },
    handle_R: { upperarm_R: 0.1, chest: 0.12, thigh_R: 0.1, shank_R: 0.1, forearm_R: 0.08, pelvis: 0.08 },
    "machine.chestPad": { neck: 0.1, girdle: 0.08, head: 0.08, chest: 0.05 },
  },
  stiffness: { elbow: 1.4, shoulder: 0.7, lumbar: 8, clavicle: 0.7 },
  hints: { start: { ...SEAT, ...REACH }, end: { ...SEAT, ...PULL } },
  extraKeyGoals: (body) => ({
    start: [
      lockAngle(body, "neck.flex", 2, 60),
      lockAngle(body, "lumbar.flex", 4, 40),
      lockAngle(body, "thoracic.flex", 4, 40),
    ],
    end: [
      lockAngle(body, "neck.flex", 2, 60),
      lockAngle(body, "lumbar.flex", 4, 40),
      lockAngle(body, "thoracic.flex", 4, 40),
      lockAngle(body, "elbow_L.flex", 102, 80),
      lockAngle(body, "elbow_R.flex", 102, 80),
      lockAngle(body, "clavicle_L.prot", -16, 50),
      lockAngle(body, "clavicle_R.prot", -16, 50),
      lockAngle(body, "shoulder_L.plane", 28, 40),
      lockAngle(body, "shoulder_R.plane", 28, 40),
    ],
  }),
  checks: () => [
    checkFlatBack("Keep your chest in contact with the chest pad throughout the set.", 18),
    checkNeutralNeck("Keep the neck quiet against the chest pad.", 28),
    checkJointRange(
      "wide-plate-row",
      "Elbows drive back and out",
      "Pull the handles back by driving your elbows backward and outward while bending them and pulling your shoulder blades together.",
      "elbow_L.flex",
      60,
    ),
    checkJointWithinAt(
      "arms-long",
      "Arms start outstretched",
      "Grasp the horizontal handles when your arms are fully outstretched forward with straight elbows.",
      "elbow_L.flex",
      "top",
      0,
      48,
    ),
    checkJointWithinAt(
      "overhand",
      "Wide overhand grip",
      "Grasp the horizontally directed handles with your palms facing down and your hands clearly outside shoulder width.",
      "forearm_L.pron",
      "start",
      45,
      90,
    ),
    checkJointWithinAt(
      "elbows-out",
      "Elbows flare toward a T",
      "Allow your elbows to flare out so your upper arms finish closer to a T-shape than tucked by your sides.",
      "shoulder_L.plane",
      "bottom",
      0,
      48,
    ),
    checkJointWithinAt(
      "scapulae",
      "Shoulder blades pinch",
      "Pull your shoulder blades back together as if pinching a pencil between them.",
      "clavicle_L.prot",
      "bottom",
      -40,
      -4,
    ),
  ],
});
