import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { everyFrame } from "../checks";
import { deg } from "../math";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";
import { lockAngle } from "../solver";

/** Underhand curl that borrows a small hip drive, then lowers under control. */
const GRIP = {
  "shoulder.twist": -14,
  "forearm.pron": -76,
  "wrist.flex": 4,
  "clavicle.elev": 2,
};

export const spec = buildExerciseSpec({
  id: "barbell-cheat-curl",
  catalogId: "1a15c6f170d88068bb6dc7b853803537",
  name: "Barbell Cheat Curl",
  defaultLoadKg: 22,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Cheat", "Peak", "Lower", "Sit back"],
  tempo: { lower: 1.6, bottom: 0.25, raise: 0.9, top: 0.3 },
  station: { kind: "standing", stanceX: 0.16, toeOutDeg: 4 },
  apparatus: {
    kind: "barbell",
    style: "straight",
    gripX: 0.22,
    alignWrists: false,
    path: { startY: 0.66, startZ: 0.22, endY: 1.18, endZ: 0.28, arcBulgeZ: 0.06 },
  },
  hints: {
    start: {
      ...POSTURE_HINTS.standing,
      ...GRIP,
      "root.pitch": 14,
      "hip.flex": 22,
      "knee.flex": 16,
      "lumbar.flex": 2,
      "thoracic.flex": 2,
      "shoulder.elev": 10,
      "shoulder.plane": 60,
      "clavicle.prot": 2,
      "elbow.flex": 6,
    },
    end: {
      ...POSTURE_HINTS.standing,
      ...GRIP,
      "root.pitch": 0,
      "hip.flex": 4,
      "knee.flex": 4,
      "lumbar.flex": -2,
      "thoracic.flex": 0,
      "shoulder.elev": 28,
      "shoulder.plane": 72,
      "clavicle.prot": -4,
      "elbow.flex": 132,
    },
  },
  extraKeyGoals: (body) => ({
    start: [
      lockAngle(body, "hip_L.flex", 24, 48),
      lockAngle(body, "hip_R.flex", 24, 48),
      lockAngle(body, "knee_L.flex", 16, 24),
      lockAngle(body, "knee_R.flex", 16, 24),
      lockAngle(body, "lumbar.flex", 4, 40),
    ],
    end: [
      lockAngle(body, "hip_L.flex", 6, 48),
      lockAngle(body, "hip_R.flex", 6, 48),
      lockAngle(body, "knee_L.flex", 5, 24),
      lockAngle(body, "knee_R.flex", 5, 24),
      lockAngle(body, "lumbar.flex", 0, 40),
    ],
  }),
  checks: () => [
    checkFlatBack(
      "Brace your core and keep your lower back near neutral. Use your hips, not a rounded spine, to help the bar up.",
      16,
    ),
    checkJointRange(
      "hip-drive",
      "Hips help the curl",
      "Sit your hips back, then drive them forward as you curl so your torso comes upright.",
      "hip_L.flex",
      12,
    ),
    checkJointWithinAt(
      "starts-hinged",
      "Slight forward lean before the curl",
      "With your elbows straight, sit your hips back and incline your torso slightly forward.",
      "hip_L.flex",
      "top",
      12,
      36,
    ),
    checkJointWithinAt(
      "finishes-upright",
      "Torso finishes upright",
      "The hip drive brings you upright with your knees straightened as the elbows finish bent.",
      "hip_L.flex",
      "bottom",
      0,
      14,
    ),
    checkJointRange(
      "elbow-rom",
      "Elbows flex through the cheat",
      "Curl the bar upward in an arc by bending your elbows while they swing a bit forward.",
      "elbow_L.flex",
      95,
    ),
    {
      id: "underhand-grip",
      label: "Underhand grip held throughout",
      cue: "Grasp the bar with a shoulder-width underhand grip so your palms face forward.",
      evaluate: (context) =>
        everyFrame(context, (_, angles) => deg(angles["forearm_L.pron"]), -50, "° of forearm pronation"),
    },
  ],
});
