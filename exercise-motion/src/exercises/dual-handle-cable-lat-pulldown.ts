import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Independent high D-handles. Elbows finish close to the sides. Palms stay near neutral. */
const GRIP = {
  "shoulder.twist": 4,
  "forearm.pron": 8,
  "wrist.flex": 2,
};

const SEAT = {
  ...POSTURE_HINTS.seatedLeanBack,
  "root.pitch": -12,
  "hip.flex": 82,
  "knee.flex": 92,
  "lumbar.flex": 2,
  "thoracic.flex": -2,
  "neck.flex": -6,
};

const UP = {
  ...GRIP,
  "shoulder.elev": 156,
  "shoulder.plane": 64,
  "elbow.flex": 6,
  "clavicle.elev": 12,
  "clavicle.prot": 4,
};

const DOWN = {
  ...GRIP,
  "shoulder.elev": 36,
  "shoulder.plane": 48,
  "elbow.flex": 108,
  "clavicle.elev": -8,
  "clavicle.prot": -12,
};

export const spec = buildExerciseSpec({
  id: "dual-handle-cable-lat-pulldown",
  catalogId: "30d5c6f170d880e7a00ee1e7319b720d",
  name: "Dual Handle Cable Lat Pulldown",
  defaultLoadKg: 16,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Pull", "Sides", "Return", "Reach"],
  tempo: { lower: 1.6, bottom: 0.3, raise: 1.8, top: 0.4 },
  station: {
    kind: "seated",
    seatY: 0.44,
    seatZ: -0.02,
    stanceX: 0.16,
    heelZ: 0.34,
    leanDeg: -12,
    frame: { type: "lat-pulldown", thighPadY: 0.62, pulleyZ: 0.22 },
    feetMode: "floor",
  },
  apparatus: {
    kind: "cable-dual",
    pulleyY: 2.05,
    halfWidth: 0.42,
    z: 0.28,
    attachment: "d-handle",
  },
  hints: { start: { ...SEAT, ...UP }, end: { ...SEAT, ...DOWN } },
  checks: () => [
    checkFlatBack(
      "Maintain the slight backward lean of your torso you adopted while setting up, rather than leaning further backward.",
    ),
    checkNeutralNeck("Keep your neck quiet while each handle travels on its own cable."),
    checkJointRange(
      "elbow-pull",
      "Elbows bend toward the sides of the chest",
      "Drive your elbows down toward your sides to pull the handles down toward the sides of your upper chest.",
      "elbow_L.flex",
      70,
    ),
    checkJointWithinAt(
      "arms-overhead",
      "Arms start overhead",
      "Start with straight elbows and the cables holding your arms overhead.",
      "shoulder_L.elev",
      "top",
      125,
      175,
    ),
    checkJointWithinAt(
      "elbows-in",
      "Elbows finish close to the torso",
      "Finish with your elbows close to the sides of your torso, forearms aligned with the cables.",
      "shoulder_L.plane",
      "bottom",
      28,
      75,
    ),
    checkJointWithinAt(
      "scapulae-down",
      "Shoulder blades pull down",
      "Pull your shoulder blades down away from your ears as the handles come in.",
      "clavicle_L.elev",
      "bottom",
      -22,
      2,
    ),
  ],
});
