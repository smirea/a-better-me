import { buildExerciseSpec, holdElbowNearShoulder, POSTURE_HINTS } from "../builders";
import { everyFrame } from "../checks";
import { deg } from "../math";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** Seated against a back pad, facing away from two low-mid pulleys, arms pulled behind the torso. */
const SEAT = {
  ...POSTURE_HINTS.seated,
  "root.pitch": -6,
  "lumbar.flex": -2,
  "thoracic.flex": -4,
  "neck.flex": 4,
  "hip.flex": 86,
  "knee.flex": 90,
};

const ARMS = {
  "shoulder.elev": 40,
  "shoulder.plane": -55,
  "shoulder.twist": -14,
  "forearm.pron": -74,
  "wrist.flex": 0,
  "clavicle.elev": 2,
  "clavicle.prot": -10,
};

export const spec = buildExerciseSpec({
  id: "seated-dual-cable-bayesian-curl",
  catalogId: "2ac5c6f170d88021a3a3d4aa413fda43",
  name: "Seated Dual Cable Bayesian Curl",
  defaultLoadKg: 3,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "hang",
  cameraHint: { view: "Side" },
  phaseLabels: ["Curl", "Peak", "Lower", "Stretch"],
  tempo: { lower: 1.5, bottom: 0.3, raise: 1.7, top: 0.35 },
  station: {
    kind: "seated",
    seatY: 0.48,
    stanceX: 0.2,
    heelZ: 0.46,
    leanDeg: -4,
    pinBack: true,
    frame: { type: "adjustable-bench", backAngleDeg: 80 },
  },
  apparatus: {
    kind: "cable-dual",
    pulleyY: 0.72,
    halfWidth: 0.42,
    z: -0.62,
    attachment: "d-handle",
  },
  stiffness: { elbow: 5, shoulder: 2.6, lumbar: 8, hip: 4 },
  hints: {
    start: { ...SEAT, ...ARMS, "elbow.flex": 8 },
    end: { ...SEAT, ...ARMS, "elbow.flex": 126 },
  },
  extraContacts: {
    "bench.seatPad": { thigh_L: 0.08, thigh_R: 0.08, thighShaft_L: 0.08, thighShaft_R: 0.08 },
    "bench.backPad": { pelvis: 0.04, girdle: 0.04, chest: 0.03 },
  },
  extraGoals: (body) => [
    holdElbowNearShoulder(body, "L", [0.12, -0.18, -0.14], 16, "xz"),
    holdElbowNearShoulder(body, "R", [0.12, -0.18, -0.14], 16, "xz"),
  ],
  checks: () => [
    checkFlatBack(
      "Pull your shoulder blades back together with your chest up and keep the elbows behind the torso.",
    ),
    checkJointWithinAt(
      "arms-behind",
      "Upper arms stay behind the torso",
      "With straight elbows, allow the cables to pull your arms back behind your torso.",
      "shoulder_L.plane",
      "peak",
      -90,
      -28,
    ),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows start straight",
      "Finish this step with your elbows fully straightened.",
      "elbow_L.flex",
      "top",
      0,
      24,
    ),
    checkJointWithinAt(
      "elbows-bent",
      "Elbows finish fully bent",
      "You should finish with your elbows fully bent as your forearms contact your biceps.",
      "elbow_L.flex",
      "bottom",
      105,
      150,
    ),
    checkJointRange(
      "elbow-rom",
      "Seated lengthened curl",
      "Bend your elbows to curl the handles forward and upward in an arcing manner.",
      "elbow_L.flex",
      85,
    ),
    {
      id: "palms-forward",
      label: "Palms face forward",
      cue: "Grasp the two handles with your elbows straightened and palms facing forward.",
      evaluate: (context) =>
        everyFrame(context, (_, angles) => deg(angles["forearm_L.pron"]), -40, "° of forearm pronation"),
    },
  ],
});
