import { buildExerciseSpec, holdElbowNearShoulder, POSTURE_HINTS } from "../builders";
import { everyFrame } from "../checks";
import { deg } from "../math";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** Thick-bar underhand curl. Wrists stay straighter than on a standard bar. */
const ARMS = {
  "shoulder.elev": 12,
  "shoulder.plane": 62,
  "shoulder.twist": -12,
  "forearm.pron": -68,
  "wrist.flex": 2,
  "clavicle.elev": 2,
  "clavicle.prot": -2,
};

export const spec = buildExerciseSpec({
  id: "axle-biceps-curl",
  catalogId: "3a05c6f170d8805aa301e0b6da152756",
  name: "Axle Biceps Curl",
  defaultLoadKg: 14,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Curl", "Peak", "Lower", "Hang"],
  tempo: { lower: 1.5, bottom: 0.35, raise: 1.7, top: 0.35 },
  station: { kind: "standing", stanceX: 0.16, toeOutDeg: 6 },
  apparatus: {
    kind: "barbell",
    style: "axle",
    gripX: 0.22,
    alignWrists: false,
  },
  hints: {
    start: { ...POSTURE_HINTS.standing, ...ARMS, "elbow.flex": 8 },
    end: { ...POSTURE_HINTS.standing, ...ARMS, "shoulder.elev": 16, "elbow.flex": 132 },
  },
  extraGoals: (body) => [
    holdElbowNearShoulder(body, "L", [0.04, -0.29, 0.055], 16, "xz"),
    holdElbowNearShoulder(body, "R", [0.04, -0.29, 0.055], 16, "xz"),
  ],
  checks: () => [
    checkFlatBack("Stand upright and keep the rest of your body still while you squeeze the axle and curl."),
    checkJointWithinAt(
      "elbows-extended",
      "Elbows start extended",
      "Stand upright with the axle and keep your elbows straight.",
      "elbow_L.flex",
      "top",
      0,
      24,
    ),
    checkJointWithinAt(
      "elbows-flexed",
      "Elbows fully flex at the peak",
      "Curl the axle until your elbows are fully bent, then lower it under control.",
      "elbow_L.flex",
      "bottom",
      110,
      148,
    ),
    checkJointRange(
      "elbow-rom",
      "Full elbow flexion curl",
      "Curl the axle upward and back toward you by bending your elbows.",
      "elbow_L.flex",
      95,
    ),
    {
      id: "upper-arms-fixed",
      label: "Upper arms stay at the sides",
      cue: "Keep your upper arms in place and avoid swinging your elbows forward.",
      evaluate: (context) =>
        everyFrame(
          context,
          (frame) => {
            const shoulder = frame.pos[context.body.index.shoulder_L];
            const elbow = frame.pos[context.body.index.elbow_L];
            return Math.hypot(elbow.x - shoulder.x - 0.04, elbow.z - shoulder.z - 0.055) * 100;
          },
          6,
          " cm of upper-arm drift",
        ),
    },
    {
      id: "underhand-grip",
      label: "Underhand grip held throughout",
      cue: "Grasp the axle with a shoulder-width underhand grip so your palms face forward.",
      evaluate: (context) =>
        everyFrame(context, (_, angles) => deg(angles["forearm_L.pron"]), -40, "° of forearm pronation"),
    },
  ],
});
