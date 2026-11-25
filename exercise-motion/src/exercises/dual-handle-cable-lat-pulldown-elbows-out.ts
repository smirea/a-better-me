import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/**
 * Seated dual high cables with elbows flared about 60° from the torso
 * (between a tucked pulldown and a full T). Hits lats, teres, and upper back.
 */
const GRIP = {
  "shoulder.twist": 12,
  "forearm.pron": 55,
  "wrist.flex": 2,
};

const SEAT = {
  ...POSTURE_HINTS.seatedLeanBack,
  "root.pitch": -10,
  "hip.flex": 82,
  "knee.flex": 92,
  "lumbar.flex": 2,
  "thoracic.flex": -2,
  "neck.flex": -4,
};

const UP = {
  ...GRIP,
  "shoulder.elev": 146,
  "shoulder.plane": 38,
  "elbow.flex": 8,
  "clavicle.elev": 14,
  "clavicle.prot": -2,
};

const DOWN = {
  ...GRIP,
  "shoulder.elev": 62,
  "shoulder.plane": 18,
  "elbow.flex": 96,
  "clavicle.elev": -4,
  "clavicle.prot": -10,
};

export const spec = buildExerciseSpec({
  id: "dual-handle-cable-lat-pulldown-elbows-out",
  catalogId: "3a15c6f170d880b2a33ac923355fa96f",
  name: "Dual Handle Cable Lat Pulldown (Elbows-Out)",
  defaultLoadKg: 14,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Pull", "Flare", "Return", "Reach"],
  tempo: { lower: 1.6, bottom: 0.3, raise: 1.8, top: 0.4 },
  station: {
    kind: "seated",
    seatY: 0.44,
    seatZ: -0.02,
    stanceX: 0.16,
    heelZ: 0.34,
    leanDeg: -10,
    frame: { type: "lat-pulldown", thighPadY: 0.62, pulleyZ: 0.22 },
    feetMode: "floor",
  },
  apparatus: {
    kind: "cable-dual",
    pulleyY: 2.05,
    halfWidth: 0.62,
    z: 0.22,
    attachment: "d-handle",
  },
  hints: { start: { ...SEAT, ...UP }, end: { ...SEAT, ...DOWN } },
  checks: () => [
    checkFlatBack(
      "Keep the slight backward lean steady. Let the elbows flare instead of leaning back to move the load.",
    ),
    checkNeutralNeck("Keep your chest tall and your neck quiet."),
    checkJointRange(
      "elbow-pull",
      "Elbows bend on the flared pull",
      "Pull each handle down toward the upper chest by bending the elbow while the upper arm stays flared about 60 degrees from your side.",
      "elbow_L.flex",
      60,
    ),
    checkJointWithinAt(
      "arms-wide",
      "Arms start wide and overhead",
      "Start with straight elbows and the arms opened out toward the high cables.",
      "shoulder_L.elev",
      "top",
      120,
      175,
    ),
    checkJointWithinAt(
      "elbows-60",
      "Elbows flare about 60 degrees",
      "Keep the elbows flared wider than a tucked pulldown, about 60 degrees from the torso, short of a full T, to bias the upper back, teres, and lats.",
      "shoulder_L.plane",
      "bottom",
      4,
      40,
    ),
    checkJointWithinAt(
      "scapulae-down",
      "Shoulder blades pull down",
      "Depress the shoulder blades as the elbows drive down and out.",
      "clavicle_L.elev",
      "bottom",
      -18,
      6,
    ),
  ],
});
