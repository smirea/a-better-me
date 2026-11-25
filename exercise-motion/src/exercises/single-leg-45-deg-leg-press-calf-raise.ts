import { buildExerciseSpec, sidedHints } from "../builders";
import { checkAnchorTravel, checkJointRange, checkJointWithinAt } from "../postures";

const TRUNK = {
  "root.y": 0.5,
  "root.z": -0.02,
  "root.pitch": -46,
  "lumbar.flex": 4,
  "thoracic.flex": 2,
  "neck.flex": 10,
  "shoulder.elev": 18,
  "shoulder.plane": -8,
  "elbow.flex": 78,
  "forearm.pron": 20,
};

const pose = (ankle: number) =>
  sidedHints(
    "L",
    { "hip.flex": 68, "hip.abd": 8, "knee.flex": 12, "ankle.dorsi": ankle },
    { "hip.flex": 48, "hip.abd": 16, "knee.flex": 95, "ankle.dorsi": 8 },
    TRUNK,
  );

export const spec = buildExerciseSpec({
  id: "single-leg-45-deg-leg-press-calf-raise",
  catalogId: "1a15c6f170d880bdacd4ebd2f59212d3",
  name: "Single Leg 45° Leg Press Calf Raise",
  defaultLoadKg: 12,
  loadUnit: "total",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  phaseLabels: ["Press", "Point", "Lower", "Stretch"],
  tempo: { lower: 1.3, bottom: 0.3, raise: 1.7, top: 0.35 },
  station: { kind: "leg-press", angleDeg: 45, singleLeg: "L" },
  apparatus: { kind: "leg-press-sled", angleDeg: 45 },
  stiffness: { ankle: 8, knee: 6, hip: 3 },
  hints: {
    start: pose(8),
    end: pose(-12),
  },
  checks: () => [
    checkJointRange(
      "ankle-rom",
      "Working ankle presses the sled",
      "Press the platform away from you by pointing the ball of your foot away from you through your ankle’s available range of motion.",
      "ankle_L.dorsi",
      16,
    ),
    checkJointWithinAt(
      "knee-quiet",
      "Working knee stays nearly straight",
      "You should maintain this knee position (rather than bending and extending your knee) while performing this exercise.",
      "knee_L.flex",
      "peak",
      6,
      18,
    ),
    checkJointWithinAt(
      "free-leg",
      "Free leg stays off the plate",
      "Keep your other foot in a comfortable position, such as resting on the ground.",
      "knee_R.flex",
      "start",
      60,
      130,
    ),
    checkAnchorTravel(
      "sled-travel",
      "Sled travels with the working ankle",
      "Motion should occur exclusively at your ankle, while your knee and hip do not move.",
      "ballIn_L",
      "z",
      0.025,
    ),
  ],
});
