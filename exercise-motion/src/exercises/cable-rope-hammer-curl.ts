import { buildExerciseSpec, holdElbowNearShoulder, POSTURE_HINTS } from "../builders";
import { everyFrame } from "../checks";
import { deg } from "../math";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** Low rope, neutral hammer grip, upper arms slightly in front of the torso. */
const ARMS = {
  "shoulder.elev": 24,
  "shoulder.plane": 70,
  "shoulder.twist": 4,
  "forearm.pron": 0,
  "wrist.flex": 0,
  "clavicle.elev": 2,
  "clavicle.prot": -2,
};

export const spec = buildExerciseSpec({
  id: "cable-rope-hammer-curl",
  catalogId: "1a15c6f170d8804f98d1f9c040eef407",
  name: "Cable Rope Hammer Curl",
  defaultLoadKg: 10,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Curl", "Peak", "Lower", "Hang"],
  tempo: { lower: 1.4, bottom: 0.3, raise: 1.6, top: 0.3 },
  station: { kind: "standing", stanceX: 0.17, heelZ: -0.08, toeOutDeg: 6, balanceZ: false },
  apparatus: {
    kind: "cable-single",
    pulley: [0, 0.28, 0.95],
    columnPos: [0, 1.12],
    facingDir: -1,
    attachment: "rope",
    attachmentWidth: 0.36,
    gripX: 0.08,
  },
  stiffness: { elbow: 4, shoulder: 2.4, lumbar: 8, forearm: 2.2 },
  hints: {
    start: { ...POSTURE_HINTS.standing, ...ARMS, "elbow.flex": 8 },
    end: { ...POSTURE_HINTS.standing, ...ARMS, "elbow.flex": 130 },
  },
  extraGoals: (body) => [
    holdElbowNearShoulder(body, "L", [0.08, -0.27, 0.1], 14, "xz"),
    holdElbowNearShoulder(body, "R", [0.08, -0.27, 0.1], 14, "xz"),
  ],
  checks: () => [
    checkFlatBack(
      "Stand upright with the rope and keep the rest of your body stationary throughout the set.",
    ),
    checkJointWithinAt(
      "elbows-extended",
      "Elbows start straight",
      "Stand upright with the rope while keeping your elbows straight.",
      "elbow_L.flex",
      "top",
      0,
      22,
    ),
    checkJointWithinAt(
      "elbows-flexed",
      "Elbows finish fully bent",
      "Curl the rope upward and back toward you by bending your elbows until they are fully bent.",
      "elbow_L.flex",
      "bottom",
      108,
      150,
    ),
    checkJointRange(
      "elbow-rom",
      "Full elbow flexion curl",
      "Curl the rope upward and back toward you in an arcing motion by bending your elbows.",
      "elbow_L.flex",
      90,
    ),
    {
      id: "hammer-grip",
      label: "Neutral hammer grip",
      cue: "Grasp the rope with a neutral grip as your palms face in toward each other.",
      evaluate: (context) =>
        everyFrame(
          context,
          (_, angles) => Math.abs(deg(angles["forearm_L.pron"])),
          22,
          "° off a neutral grip",
        ),
    },
  ],
});
