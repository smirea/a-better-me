import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkAnchorTravel, checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

const TRUNK = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 2,
  "lumbar.flex": 2,
  "thoracic.flex": 2,
  "neck.flex": 4,
  "shoulder.elev": 16,
  "shoulder.plane": 18,
  "shoulder.twist": 12,
  "elbow.flex": 26,
  "forearm.pron": 35,
};

const pose = (ankle: number, rootY: number) =>
  sidedHints(
    "L",
    { "hip.flex": 4, "hip.abd": 6, "knee.flex": 8, "ankle.dorsi": ankle },
    { "hip.flex": -6, "hip.abd": 10, "knee.flex": 100, "ankle.dorsi": 8 },
    { ...TRUNK, "root.y": rootY },
  );

export const spec = buildExerciseSpec({
  id: "standing-single-leg-machine-calf-raise",
  catalogId: "1a15c6f170d8803aa8bffc5a0dae7406",
  name: "Standing Single Leg Machine Calf Raise",
  defaultLoadKg: 40,
  loadUnit: "total",
  laterality: "unilateral",
  activeSide: "L",
  grip: "open",
  phaseLabels: ["Raise", "Peak", "Lower", "Stretch"],
  tempo: { lower: 1.4, bottom: 0.35, raise: 1.8, top: 0.4 },
  station: { kind: "calf-station", mode: "standing", stanceX: 0.06, singleFoot: "L", blockY: 0.18 },
  apparatus: {
    kind: "roller-pad",
    trackAnchors: ["upperBack"],
    offset: [0, 0.03, 0.02],
    forceDir: [0, -1, 0],
    width: 0.38,
    radius: 0.045,
  },
  stiffness: { ankle: 14, knee: 8, hip: 4 },
  extraContacts: { "calf.block": { foot_L: 0.018, foot_R: 0.02 } },
  progress: (body, frame) => anchorPoint(body, frame, "heel_L").y,
  hints: {
    start: pose(20, 0.943),
    end: pose(-28, 1.05),
  },
  checks: () => [
    checkFlatBack("Maintain this upright position throughout the set."),
    checkJointRange(
      "ankle-rom",
      "Full ankle raise",
      "Raise your heel into the air through your ankle’s available range of motion.",
      "ankle_L.dorsi",
      32,
    ),
    checkJointWithinAt(
      "working-knee-straight",
      "Working knee stays straight",
      "Stand upright with your knees extended to receive the weight from the machine.",
      "knee_L.flex",
      "peak",
      2,
      16,
    ),
    checkJointWithinAt(
      "free-leg-bent",
      "Free leg stays off the step",
      "While keeping one foot on the step, lift your other foot off the step by bending that knee.",
      "knee_R.flex",
      "start",
      70,
      130,
    ),
    checkAnchorTravel(
      "heel-rise",
      "Working heel rises",
      "Raise your heel into the air through your ankle’s available range of motion.",
      "heel_L",
      "y",
      0.035,
    ),
  ],
});
