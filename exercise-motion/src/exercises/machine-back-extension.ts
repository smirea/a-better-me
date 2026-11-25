import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

const ARMS = {
  "shoulder.elev": 28,
  "shoulder.plane": 55,
  "shoulder.twist": 10,
  "elbow.flex": 78,
  "forearm.pron": 40,
  "wrist.flex": 6,
  "clavicle.elev": 4,
};

const SEAT = {
  ...POSTURE_HINTS.seated,
  "root.y": 0.5,
  "root.z": -0.08,
  "root.pitch": 6,
  "hip.flex": 86,
  "knee.flex": 92,
  "ankle.dorsi": 4,
  ...ARMS,
};

/** Rounded, roller on the upper back. */
const ROUND = {
  ...SEAT,
  "lumbar.flex": 32,
  "thoracic.flex": 22,
  "neck.flex": 6,
};

/** Uncurled until the lower back is mildly arched. Hips barely move. */
const LONG = {
  ...SEAT,
  "root.pitch": -4,
  "hip.flex": 84,
  "lumbar.flex": -14,
  "thoracic.flex": -8,
  "neck.flex": 2,
};

export const spec = buildExerciseSpec({
  id: "machine-back-extension",
  catalogId: "1a45c6f170d8801cbc4de021fccb0fd8",
  name: "Machine Back Extension",
  defaultLoadKg: 12,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Round", "Flexed", "Extend", "Arched"],
  tempo: { lower: 2.2, bottom: 0.25, raise: 2, top: 0.35 },
  station: {
    kind: "seated",
    seatY: 0.48,
    seatZ: -0.02,
    heelZ: 0.42,
    stanceX: 0.16,
    frame: { type: "box", height: 0.48 },
    feetMode: "floor",
  },
  apparatus: {
    kind: "roller-pad",
    width: 0.42,
    radius: 0.06,
    trackAnchors: ["upperBack"],
    offset: [0, 0.02, -0.03],
    forceDir: [0, 0, 1],
  },
  stiffness: { lumbar: 12, thoracic: 9, hip: 12, neck: 3, knee: 4 },
  hints: { start: LONG, end: ROUND },
  checks: () => [
    checkJointRange(
      "lumbar-extend",
      "Lower back uncurls under the pad",
      "Flare the ribs up and away from the hip bones. The roller moves because the spine moves.",
      "lumbar.flex",
      20,
    ),
    checkJointRange(
      "thoracic-extend",
      "Middle back uncurls with the lower back",
      "Round the lower and middle back on the way forward, then uncurl both on the way back.",
      "thoracic.flex",
      12,
    ),
    checkJointWithinAt(
      "hips-quiet",
      "Hips stay seated",
      "Keep the buttocks on the seat and limit hip motion. Do not lean back mainly from the hips.",
      "hip_L.flex",
      "peak",
      74,
      100,
    ),
    checkJointWithinAt(
      "rounded-bottom",
      "Back finishes rounded",
      "Return to a rounded lower and middle back, chest angled toward the knees.",
      "lumbar.flex",
      "bottom",
      8,
      48,
    ),
    checkNeutralNeck(
      "Keep the neck near neutral, as when looking straight ahead while standing upright.",
      16,
    ),
  ],
});
