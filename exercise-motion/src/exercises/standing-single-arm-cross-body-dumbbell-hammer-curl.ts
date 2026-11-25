import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { everyFrame } from "../checks";
import { deg } from "../math";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** Hammer grip. The working forearm swings across the torso; the other bell stays at the side. */
const HANG = {
  "shoulder.elev": 12,
  "shoulder.plane": 36,
  "shoulder.twist": 6,
  "elbow.flex": 8,
  "forearm.pron": 0,
  "wrist.flex": 0,
  "clavicle.elev": 2,
  "clavicle.prot": -2,
};

const ACROSS = {
  "shoulder.elev": 22,
  "shoulder.plane": 86,
  "shoulder.twist": 48,
  "elbow.flex": 112,
  "forearm.pron": 2,
  "wrist.flex": 0,
  "clavicle.elev": 4,
  "clavicle.prot": 8,
};

export const spec = buildExerciseSpec({
  id: "standing-single-arm-cross-body-dumbbell-hammer-curl",
  catalogId: "1aa5c6f170d880b9ab00ea8320731145",
  name: "Standing Single Arm Cross-Body Dumbbell Hammer Curl",
  defaultLoadKg: 10,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  phaseLabels: ["Curl", "Across", "Lower", "Rest"],
  tempo: { lower: 1.4, bottom: 0.3, raise: 1.6, top: 0.3 },
  station: { kind: "standing", stanceX: 0.18, toeOutDeg: 6 },
  apparatus: { kind: "dumbbells" },
  hints: {
    start: sidedHints("L", HANG, HANG, POSTURE_HINTS.standing),
    end: sidedHints("L", ACROSS, HANG, POSTURE_HINTS.standing),
  },
  checks: () => [
    checkFlatBack(
      "Pick up a pair of dumbbells and stand upright with approximately a shoulder-width stance.",
    ),
    checkJointWithinAt(
      "elbow-extended",
      "Working elbow starts extended",
      "Hold the dumbbells at your sides with extended elbows.",
      "elbow_L.flex",
      "top",
      0,
      22,
    ),
    checkJointWithinAt(
      "elbow-flexed",
      "Working elbow fully flexes across the body",
      "Curl the dumbbell upward and across the front of your torso toward the opposite shoulder.",
      "elbow_L.flex",
      "bottom",
      90,
      150,
    ),
    checkJointRange(
      "elbow-rom",
      "Cross-body hammer curl",
      "After the elbow has fully flexed, lower the dumbbell until the elbow is extended again.",
      "elbow_L.flex",
      90,
    ),
    checkJointWithinAt(
      "other-arm-stays",
      "The other dumbbell stays at the side",
      "Keep one dumbbell resting at your side with an extended elbow while the other arm curls.",
      "elbow_R.flex",
      "bottom",
      0,
      28,
    ),
    {
      id: "hammer-grip",
      label: "Hammer grip held throughout",
      cue: "Direct your palms so that they are facing in toward your sides, and keep that neutral grip.",
      evaluate: (context) =>
        everyFrame(context, (_, angles) => Math.abs(deg(angles["forearm_L.pron"])), 24, "° away from a neutral forearm"),
    },
    {
      id: "crosses-midline",
      label: "Working hand crosses the torso",
      cue: "Curl the dumbbell across the front of your torso toward the opposite shoulder, with the upper arm slightly in front of the body.",
      evaluate: ({ body, frames, bottom }) => {
        const grip = anchorPoint(body, frames[bottom], "grip_L");
        const shoulder = frames[bottom].pos[body.index.shoulder_L];
        const medial = shoulder.x - grip.x;
        const forward = grip.z - shoulder.z;
        return {
          pass: medial > 0.08 && forward > 0.06,
          measured: `hand moves ${(medial * 100).toFixed(0)} cm toward the midline and ${(forward * 100).toFixed(0)} cm forward`,
        };
      },
    },
  ],
});
