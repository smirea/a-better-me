import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { everyFrame } from "../checks";
import { deg } from "../math";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";
import { lockAngle } from "../solver";

/** Seated upright between two head-height pulleys. Arms stay in a T and curl toward the ears. */
const SEAT = {
  ...POSTURE_HINTS.seated,
  "root.pitch": -4,
  "lumbar.flex": -2,
  "thoracic.flex": -2,
  "neck.flex": 4,
  "hip.flex": 88,
  "knee.flex": 90,
};

const ARMS = {
  "shoulder.elev": 84,
  "shoulder.plane": 12,
  "shoulder.twist": -52,
  "forearm.pron": -55,
  "wrist.flex": 0,
  "clavicle.elev": 8,
  "clavicle.prot": -8,
};

export const spec = buildExerciseSpec({
  id: "seated-crucifix-curl",
  catalogId: "2ab5c6f170d88052bd13e33d9f5c0360",
  name: "Seated Crucifix Curl",
  defaultLoadKg: 2.5,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "hang",
  cameraHint: { view: "Front" },
  phaseLabels: ["Curl", "Ears", "Lower", "Out"],
  tempo: { lower: 1.4, bottom: 0.3, raise: 1.6, top: 0.3 },
  station: {
    kind: "seated",
    seatY: 0.48,
    stanceX: 0.2,
    heelZ: 0.42,
    leanDeg: -2,
    pinBack: true,
    frame: { type: "adjustable-bench", backAngleDeg: 82 },
  },
  apparatus: {
    kind: "cable-dual",
    pulleyY: 1.38,
    halfWidth: 1.12,
    z: 0.02,
    attachment: "d-handle",
  },
  stiffness: { elbow: 16, shoulder: 3.2, lumbar: 8, hip: 4 },
  hints: {
    start: { ...SEAT, ...ARMS, "elbow.flex": 8 },
    end: { ...SEAT, ...ARMS, "elbow.flex": 100 },
  },
  extraContacts: {
    "bench.seatPad": { thigh_L: 0.08, thigh_R: 0.08, thighShaft_L: 0.08, thighShaft_R: 0.08 },
    "bench.backPad": { pelvis: 0.04, girdle: 0.04 },
  },
  extraKeyGoals: (body) => ({
    end: [
      lockAngle(body, "elbow_L.flex", 100, 40),
      lockAngle(body, "elbow_R.flex", 100, 40),
    ],
  }),
  checks: () => [
    checkFlatBack(
      "Sit down on the seated bench with an upright torso and keep the rest of your body still.",
    ),
    checkJointWithinAt(
      "arms-out",
      "Arms stay aligned with the cables",
      "Your arms should be fully aligned with the cables, from each shoulder through your arm to the pulley.",
      "shoulder_L.elev",
      "peak",
      72,
      108,
    ),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows start straight",
      "Your elbows should be straightened in the starting position.",
      "elbow_L.flex",
      "top",
      0,
      24,
    ),
    checkJointWithinAt(
      "elbows-bent",
      "Elbows curl toward the ears",
      "Bend your elbows to curl the handles in toward your ears.",
      "elbow_L.flex",
      "bottom",
      68,
      140,
    ),
    checkJointRange(
      "elbow-rom",
      "Seated double-biceps curl",
      "At the end of this movement, you should look like you are flexing for a double biceps pose.",
      "elbow_L.flex",
      60,
    ),
    {
      id: "palms-up",
      label: "Palms point up",
      cue: "Rotate your palms to point up toward the ceiling if they are not already facing this way.",
      evaluate: (context) =>
        everyFrame(context, (_, angles) => deg(angles["forearm_L.pron"]), -40, "° of forearm pronation"),
    },
  ],
});
