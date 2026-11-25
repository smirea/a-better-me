import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { lockAngle } from "../solver";

/** Chest-supported pin-loaded row. Wide overhand handles, elbows flare toward a T. */
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
  "shoulder.plane": 86,
  "shoulder.twist": 16,
  "elbow.flex": 8,
  "forearm.pron": 76,
  "wrist.flex": 4,
  "clavicle.elev": 6,
  "clavicle.prot": 10,
};

const PULL = {
  "shoulder.elev": 62,
  "shoulder.plane": 22,
  "shoulder.twist": 14,
  "elbow.flex": 100,
  "forearm.pron": 72,
  "wrist.flex": 4,
  "clavicle.elev": 8,
  "clavicle.prot": -16,
};

export const spec = buildExerciseSpec({
  id: "wide-grip-pin-loaded-machine-row",
  catalogId: "2ae5c6f170d880d0bd81c87b1814c805",
  name: "Wide Grip Pin-Loaded Machine Row",
  defaultLoadKg: 22,
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
    frame: { type: "machine", chestPadZ: 0.4, chestPadY: 0.92, stackZ: -0.85 },
    feetMode: "floor",
  },
  apparatus: {
    kind: "machine-handles",
    orientation: "horizontal",
    forceDir: [0, 0, 1],
  },
  extraContacts: {
    handle_L: { upperarm_L: 0.1, chest: 0.12, thigh_L: 0.1, shank_L: 0.1, forearm_L: 0.08, pelvis: 0.08 },
    handle_R: { upperarm_R: 0.1, chest: 0.12, thigh_R: 0.1, shank_R: 0.1, forearm_R: 0.08, pelvis: 0.08 },
    "machine.chestPad": { neck: 0.1, girdle: 0.08, head: 0.08, chest: 0.05 },
  },
  stiffness: { elbow: 1.4, shoulder: 0.7, lumbar: 8, clavicle: 0.7 },
  hints: { start: { ...SEAT, ...REACH }, end: { ...SEAT, ...PULL } },
  extraKeyGoals: (body) => ({
    start: [
      lockAngle(body, "neck.flex", 2, 50),
    ],
    end: [
      lockAngle(body, "neck.flex", 2, 50),
      lockAngle(body, "elbow_L.flex", 100, 80),
      lockAngle(body, "elbow_R.flex", 100, 80),
      lockAngle(body, "clavicle_L.prot", -16, 50),
      lockAngle(body, "clavicle_R.prot", -16, 50),
      lockAngle(body, "shoulder_L.plane", 28, 40),
      lockAngle(body, "shoulder_R.plane", 28, 40),
    ],
  }),
  checks: () => [
    checkFlatBack("Keep your chest in contact with the chest pad throughout the set."),
    checkNeutralNeck("Keep the neck quiet against the chest pad.", 28),
    checkJointRange(
      "wide-row",
      "Elbows drive back and out",
      "Pull the handles back toward you by driving your elbows backward and outward while bending them.",
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
      26,
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
