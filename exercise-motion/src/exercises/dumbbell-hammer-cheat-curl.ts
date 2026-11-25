import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { everyFrame } from "../checks";
import { deg } from "../math";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";
import { lockAngle } from "../solver";

/** Neutral grip. A small hip drive helps the bells up; the arms lower under control. */
const GRIP = {
  "shoulder.twist": 4,
  "forearm.pron": 0,
  "wrist.flex": 0,
  "clavicle.elev": 2,
};

export const spec = buildExerciseSpec({
  id: "dumbbell-hammer-cheat-curl",
  catalogId: "29f5c6f170d880daa4a5e61eeefcadff",
  name: "Dumbbell Hammer Cheat Curl",
  defaultLoadKg: 16,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Cheat", "Peak", "Lower", "Sit back"],
  tempo: { lower: 1.6, bottom: 0.25, raise: 0.9, top: 0.3 },
  station: { kind: "standing", stanceX: 0.16, toeOutDeg: 4 },
  apparatus: { kind: "dumbbells" },
  hints: {
    start: {
      ...POSTURE_HINTS.standing,
      ...GRIP,
      "root.pitch": 14,
      "hip.flex": 22,
      "knee.flex": 16,
      "lumbar.flex": 2,
      "thoracic.flex": 2,
      "shoulder.elev": 12,
      "shoulder.plane": 48,
      "clavicle.prot": 2,
      "elbow.flex": 8,
    },
    end: {
      ...POSTURE_HINTS.standing,
      ...GRIP,
      "root.pitch": 0,
      "hip.flex": 4,
      "knee.flex": 4,
      "lumbar.flex": -2,
      "thoracic.flex": 0,
      "shoulder.elev": 32,
      "shoulder.plane": 58,
      "clavicle.prot": -2,
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
      "Brace your core and keep your lower back flat or mildly arched. Use your hips, not a rounded spine, to help the dumbbells up.",
      16,
    ),
    checkJointRange(
      "hip-drive",
      "Hips help the curl",
      "Sit your hips back, then thrust them forward as you curl so your torso comes upright.",
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
      16,
    ),
    checkJointRange(
      "elbow-rom",
      "Elbows flex through the cheat",
      "Curl the dumbbells upward by bending your elbows while allowing them to swing forward mildly.",
      "elbow_L.flex",
      90,
    ),
    {
      id: "neutral-grip",
      label: "Neutral grip held throughout",
      cue: "Direct your palms so that they are facing in toward your sides. Maintain this neutral grip throughout the set.",
      evaluate: (context) =>
        everyFrame(context, (_, angles) => Math.abs(deg(angles["forearm_L.pron"])), 24, "° away from a neutral forearm"),
    },
  ],
});
