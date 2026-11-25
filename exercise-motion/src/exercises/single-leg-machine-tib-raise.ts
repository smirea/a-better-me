import { Vector3 } from "three";
import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkJointRange, checkJointWithinAt } from "../postures";
import { pin } from "../solver";

const SIT = {
  ...POSTURE_HINTS.seated,
  "root.y": 0.52,
  "root.pitch": -4,
  "hip.flex": 78,
  "hip.abd": 10,
  "lumbar.flex": 6,
  "thoracic.flex": 4,
  "neck.flex": 8,
  "shoulder.elev": 18,
  "shoulder.plane": 36,
  "elbow.flex": 70,
  "forearm.pron": 20,
};

export const spec = buildExerciseSpec({
  id: "single-leg-machine-tib-raise",
  catalogId: "37b5c6f170d8800bb6d9d95880021253",
  name: "Single Leg Machine Tib Raise",
  defaultLoadKg: 8,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "open",
  phaseLabels: ["Pull", "Toes up", "Lower", "Pointed"],
  tempo: { lower: 1.6, bottom: 0.3, raise: 1.4, top: 0.3 },
  station: {
    kind: "seated",
    seatY: 0.48,
    seatZ: -0.02,
    frame: { type: "flat-bench", zHead: -0.55, zFoot: 0.18 },
    feetMode: "hanging",
    passiveJoints: ["hip"],
  },
  apparatus: {
    kind: "roller-pad",
    trackAnchors: ["toe_L"],
    offset: [0, 0.035, 0],
    forceDir: [0, -1, 0],
    width: 0.22,
    radius: 0.04,
  },
  extraGoals: (body) => [
    pin(body, "heel_L", () => new Vector3(0.12, 0.1, 0.46), 46),
    pin(body, "heel_R", () => new Vector3(-0.18, 0.02, 0.34), 36),
    pin(body, "ballIn_R", () => new Vector3(-0.18, 0.02, 0.48), 28),
  ],
  stiffness: { ankle: 10, knee: 8 },
  hints: {
    start: sidedHints("L", { "ankle.dorsi": -32, "knee.flex": 82 }, { "ankle.dorsi": 2, "knee.flex": 92 }, SIT),
    end: sidedHints("L", { "ankle.dorsi": 28, "knee.flex": 82 }, { "ankle.dorsi": 2, "knee.flex": 92 }, SIT),
  },
  checks: () => [
    checkJointWithinAt(
      "pointed",
      "Working foot starts pointed",
      "Let the machine point the working toes down away from you to start.",
      "ankle_L.dorsi",
      "start",
      -45,
      -10,
    ),
    checkJointWithinAt(
      "pulled-up",
      "Working toes finish above the heel",
      "Pull the toes and the ball of the working foot up toward the shin.",
      "ankle_L.dorsi",
      "peak",
      12,
      36,
    ),
    checkJointRange(
      "ankle-dorsiflexion",
      "Working ankle dorsiflexes",
      "Motion occurs at the working ankle. The rest of the body stays still.",
      "ankle_L.dorsi",
      28,
    ),
    checkJointWithinAt(
      "other-foot-down",
      "The other foot stays on the floor",
      "Keep the non-working foot in a comfortable position on the ground.",
      "ankle_R.dorsi",
      "peak",
      -10,
      16,
    ),
  ],
});
