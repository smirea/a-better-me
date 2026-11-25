import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Dual D-handles, palms angled down, elbows flare about 45 degrees. */
const REACH = {
  "shoulder.elev": 78,
  "shoulder.plane": 80,
  "shoulder.twist": 14,
  "elbow.flex": 8,
  "forearm.pron": 62,
  "wrist.flex": 2,
  "clavicle.elev": 6,
  "clavicle.prot": 8,
};

const PULL = {
  "shoulder.elev": 62,
  "shoulder.plane": 28,
  "shoulder.twist": 12,
  "elbow.flex": 104,
  "forearm.pron": 55,
  "wrist.flex": 4,
  "clavicle.elev": 8,
  "clavicle.prot": -16,
};

const SEAT = {
  ...POSTURE_HINTS.seated,
  "root.pitch": 4,
  "hip.flex": 86,
  "knee.flex": 70,
  "lumbar.flex": 4,
  "thoracic.flex": 2,
  "neck.flex": 2,
};

export const spec = buildExerciseSpec({
  id: "seated-dual-handle-cable-row-elbows-out",
  catalogId: "3445c6f170d880118464dfb97c3e8b4a",
  name: "Seated Dual Handle Cable Row (Elbows-Out)",
  defaultLoadKg: 10,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Pull", "Flare", "Return", "Reach"],
  tempo: { lower: 1.4, bottom: 0.3, raise: 1.7, top: 0.3 },
  station: {
    kind: "seated",
    seatZ: -0.02,
    heelZ: 0.42,
    frame: { type: "seated-row", pulleyY: 0.74 },
    feetMode: "floor",
    leanDeg: 4,
  },
  apparatus: {
    kind: "cable-dual",
    pulleyY: 0.78,
    halfWidth: 0.92,
    z: 1.15,
    attachment: "d-handle",
  },
  hints: {
    start: { ...SEAT, ...REACH },
    end: { ...SEAT, ...PULL },
  },
  checks: () => [
    checkFlatBack(
      "Movement should occur at your shoulders, shoulder blades, and elbows, while your torso stays upright.",
    ),
    checkNeutralNeck("Keep your chest up and your neck quiet."),
    checkJointRange(
      "elbow-row",
      "Elbows bend as they flare",
      "Pull the handles back by driving your elbows backward and out away from your sides.",
      "elbow_L.flex",
      70,
    ),
    checkJointWithinAt(
      "arms-long",
      "Arms start outstretched",
      "Sit upright with straight elbows, arms aligned with the cables, and palms angled down.",
      "elbow_L.flex",
      "top",
      0,
      22,
    ),
    checkJointWithinAt(
      "elbows-45",
      "Elbows flare about halfway out",
      "Flare your elbows about 45 degrees away from your sides, equally backward and out, short of a full T.",
      "shoulder_L.plane",
      "bottom",
      12,
      48,
    ),
    checkJointWithinAt(
      "scapulae-together",
      "Shoulder blades pull together",
      "Finish in a proud-chest posture with your shoulder blades squeezed together.",
      "clavicle_L.prot",
      "bottom",
      -28,
      -6,
    ),
  ],
});
