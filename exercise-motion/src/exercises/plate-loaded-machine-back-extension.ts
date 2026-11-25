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
  "hip.flex": 88,
  "knee.flex": 90,
  "ankle.dorsi": 4,
  ...ARMS,
};

const ROUND = {
  ...SEAT,
  "lumbar.flex": 32,
  "thoracic.flex": 22,
  "neck.flex": 6,
};

const LONG = {
  ...SEAT,
  "root.pitch": -4,
  "hip.flex": 86,
  "lumbar.flex": -14,
  "thoracic.flex": -8,
  "neck.flex": 2,
};

export const spec = buildExerciseSpec({
  id: "plate-loaded-machine-back-extension",
  catalogId: "28a5c6f170d8804c9154c16c44fce190",
  name: "Plate-Loaded Machine Back Extension",
  defaultLoadKg: 10,
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
      "Drive the roller back by flaring the ribs away from the hip bones, not by leaning at the hips.",
      "lumbar.flex",
      18,
    ),
    checkJointRange(
      "thoracic-extend",
      "Middle back uncurls with the lower back",
      "Round the lower and middle back forward, then uncurl both.",
      "thoracic.flex",
      10,
    ),
    checkJointWithinAt(
      "hips-quiet",
      "Buttocks stay on the seat",
      "Keep the hips planted. The top of the hip bones stays aligned with the machine pivot.",
      "hip_L.flex",
      "peak",
      74,
      102,
    ),
    checkJointWithinAt(
      "rounded-bottom",
      "Back finishes rounded",
      "Finish the return in a slouch, ribs toward the hip bones, rather than a flat or arched lower back.",
      "lumbar.flex",
      "bottom",
      6,
      48,
    ),
    checkNeutralNeck(
      "Keep the neck near neutral, as when looking straight ahead while standing upright.",
      16,
    ),
  ],
});
