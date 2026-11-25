import { buildExerciseSpec } from "../builders";
import { checkAnchorTravel, checkJointRange, checkJointWithinAt } from "../postures";

const TRUNK = {
  "root.y": 0.48,
  "root.z": -0.04,
  "root.pitch": -42,
  "hip.abd": 10,
  "lumbar.flex": 2,
  "thoracic.flex": 0,
  "neck.flex": 8,
  "shoulder.elev": 16,
  "shoulder.plane": -6,
  "elbow.flex": 70,
  "forearm.pron": 15,
};

export const spec = buildExerciseSpec({
  id: "pin-loaded-leg-press-calf-jump",
  catalogId: "2ab5c6f170d8800588eed5e2f0acad94",
  name: "Pin-Loaded Leg Press Calf Jump",
  defaultLoadKg: 18,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Jump", "Point", "Lower", "Bend"],
  tempo: { lower: 0.45, bottom: 0.08, raise: 1.15, top: 0.15 },
  station: { kind: "leg-press", angleDeg: 42 },
  apparatus: { kind: "leg-press-sled", angleDeg: 42 },
  stiffness: { ankle: 8, knee: 4, hip: 3 },
  hints: {
    start: { ...TRUNK, "hip.flex": 74, "knee.flex": 28, "ankle.dorsi": 8 },
    end: { ...TRUNK, "hip.flex": 66, "knee.flex": 12, "ankle.dorsi": -10 },
  },
  checks: () => [
    checkJointRange(
      "ankle-rom",
      "Ankles snap into plantarflexion",
      "Forcefully push through the balls of your feet to point your feet away from you and press the platform away.",
      "ankle_L.dorsi",
      12,
    ),
    checkJointRange(
      "knee-assist",
      "Knees straighten with the jump",
      "While simultaneously straightening your knees quickly, forcefully push through the balls of your feet.",
      "knee_L.flex",
      10,
    ),
    checkJointWithinAt(
      "knees-bent-bottom",
      "Knees bend on the way down",
      "Reverse the movement in a controlled manner while mildly bending your knees.",
      "knee_L.flex",
      "start",
      18,
      40,
    ),
    checkJointWithinAt(
      "knees-straight-top",
      "Knees finish straight",
      "Once you have pointed your feet as far as your ankle mobility permits with your knees fully straightened, you have finished the lifting phase.",
      "knee_L.flex",
      "peak",
      2,
      16,
    ),
    checkAnchorTravel(
      "sled-travel",
      "Sled jumps away",
      "This quick movement should resemble a jump rope motion but without the ball of your foot leaving the platform.",
      "ballIn_L",
      "z",
      0.03,
    ),
  ],
});
