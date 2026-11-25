import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { everyFrame } from "../checks";
import { deg } from "../math";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";
import { lockAngle } from "../solver";

/** Arms outstretched in a T between two high pulleys, palms up, curling toward the ears. */
const ARMS = {
  "shoulder.elev": 84,
  "shoulder.plane": 12,
  "shoulder.twist": -52,
  "forearm.pron": -55,
  "wrist.flex": 0,
  "clavicle.elev": 8,
  "clavicle.prot": -8,
};

const STANCE = {
  ...POSTURE_HINTS.standing,
  "thoracic.flex": -3,
  "knee.flex": 4,
};

export const spec = buildExerciseSpec({
  id: "crucifix-curl",
  catalogId: "2795c6f170d88003959bf668d235bb04",
  name: "Crucifix Curl",
  defaultLoadKg: 1.5,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "hang",
  cameraHint: { view: "Front" },
  phaseLabels: ["Curl", "Ears", "Lower", "Out"],
  tempo: { lower: 1.4, bottom: 0.3, raise: 1.6, top: 0.3 },
  station: { kind: "standing", stanceX: 0.24, toeOutDeg: 8, balanceZ: false },
  apparatus: {
    kind: "cable-dual",
    pulleyY: 1.5,
    halfWidth: 1.15,
    z: 0.02,
    attachment: "d-handle",
  },
  stiffness: { elbow: 16, shoulder: 3.2, lumbar: 9, thoracic: 8 },
  hints: {
    start: { ...STANCE, ...ARMS, "elbow.flex": 8 },
    end: { ...STANCE, ...ARMS, "elbow.flex": 100 },
  },
  extraKeyGoals: (body) => ({
    end: [
      lockAngle(body, "elbow_L.flex", 100, 40),
      lockAngle(body, "elbow_R.flex", 100, 40),
      lockAngle(body, "shoulder_L.plane", 12, 18),
      lockAngle(body, "shoulder_R.plane", 12, 18),
    ],
  }),
  checks: () => [
    checkFlatBack(
      "Pull your shoulder blades back together with a proud chest and keep the rest of your body still.",
    ),
    checkJointWithinAt(
      "arms-out",
      "Upper arms stay out toward the pulleys",
      "Keep your upper arms stationary as they remain directed toward the pulleys.",
      "shoulder_L.elev",
      "peak",
      74,
      108,
    ),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows start straight",
      "Finish with your elbows fully straightened, like they were in the starting position.",
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
      "Double-biceps curl",
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
