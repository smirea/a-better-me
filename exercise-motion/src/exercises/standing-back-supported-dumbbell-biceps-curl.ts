import { Vector3 } from "three";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { everyFrame } from "../checks";
import { box } from "../equipment";
import { deg } from "../math";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";
import { pin } from "../solver";

/**
 * Upper back and the backs of the upper arms rest on a slim vertical post,
 * narrow enough that the angled camera still sees the curl.
 */
const ARMS = {
  "shoulder.elev": 14,
  "shoulder.plane": 8,
  "shoulder.twist": -16,
  "forearm.pron": -78,
  "wrist.flex": 2,
  "clavicle.elev": 2,
  "clavicle.prot": -2,
};

const STANCE = {
  ...POSTURE_HINTS.standing,
  "root.z": 0,
  "root.pitch": 0,
  "hip.flex": 4,
  "knee.flex": 4,
  "lumbar.flex": 2,
  "thoracic.flex": 0,
};

export const spec = buildExerciseSpec({
  id: "standing-back-supported-dumbbell-biceps-curl",
  catalogId: "3a35c6f170d880038bb5fa8cbb8f2b20",
  name: "Standing Back-Supported Dumbbell Biceps Curl",
  defaultLoadKg: 10,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Curl", "Peak", "Lower", "Rest"],
  tempo: { lower: 1.5, bottom: 0.3, raise: 1.6, top: 0.3 },
  station: { kind: "standing", stanceX: 0.15, heelZ: -0.04, toeOutDeg: 4, balanceZ: false },
  apparatus: { kind: "dumbbells" },
  extraEquipment: [box("wall.post", [0, 0.82, -0.16], [0.14, 1.64, 0.06], "pad", true)],
  extraContacts: {
    "wall.post": {
      chest: 0.05,
      girdle: 0.05,
      pelvis: 0.05,
      abdomen: 0.05,
      upperarm_L: 0.06,
      upperarm_R: 0.06,
    },
  },
  hints: {
    start: { ...STANCE, ...ARMS, "elbow.flex": 8 },
    end: { ...STANCE, ...ARMS, "elbow.flex": 132 },
  },
  extraGoals: (body) => [
    pin(body, "upperBack", () => new Vector3(0, 1.32, -0.1), 8, "z"),
    pin(body, "sacrum", () => new Vector3(0, 0.96, -0.1), 6, "z"),
  ],
  checks: () => [
    checkFlatBack(
      "Set the feet with the knees straight and the back near neutral, like standing upright.",
      14,
    ),
    checkJointWithinAt(
      "knees-straight",
      "Knees stay straight",
      "Once you set your feet, your knees should be straight.",
      "knee_L.flex",
      "top",
      0,
      16,
    ),
    checkJointWithinAt(
      "elbows-extended",
      "Elbows start extended",
      "Hold the dumbbells by your sides with straight elbows and the palms forward.",
      "elbow_L.flex",
      "top",
      0,
      24,
    ),
    checkJointWithinAt(
      "elbows-flexed",
      "Elbows fully flex at the peak",
      "Curl the dumbbells upward by fully bending the elbows while the upper arms stay on the pad.",
      "elbow_L.flex",
      "bottom",
      110,
      150,
    ),
    checkJointRange(
      "elbow-rom",
      "Back-supported curl",
      "Lower the dumbbells until the elbows are fully straightened, upper arms still on the pad.",
      "elbow_L.flex",
      90,
    ),
    {
      id: "underhand-grip",
      label: "Underhand grip held throughout",
      cue: "Direct your palms forward to adopt an underhand grip, and maintain it throughout the set.",
      evaluate: (context) =>
        everyFrame(context, (_, angles) => deg(angles["forearm_L.pron"]), -52, "° of forearm pronation"),
    },
  ],
});
