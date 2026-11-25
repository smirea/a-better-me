import { Vector3 } from "three";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkJointRange, checkJointWithinAt } from "../postures";
import { pin } from "../solver";

/**
 * Seated on a bench with the lower legs supported and the feet hanging
 * off the end, loaded in a tib bar across the forefeet.
 */
const SIT = {
  ...POSTURE_HINTS.seated,
  "root.y": 0.5,
  "root.z": -0.12,
  "root.pitch": -8,
  "hip.flex": 78,
  "hip.abd": 8,
  "knee.flex": 18,
  "lumbar.flex": 8,
  "thoracic.flex": 6,
  "neck.flex": 14,
  "shoulder.elev": 16,
  "shoulder.plane": 24,
  "elbow.flex": 20,
};

export const spec = buildExerciseSpec({
  id: "tib-bar-tib-raise",
  catalogId: "2f25c6f170d880488addf9e87c5b79a2",
  name: "Tib Bar Tib Raise",
  defaultLoadKg: 10,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "open",
  phaseLabels: ["Pull", "Toes up", "Lower", "Pointed"],
  tempo: { lower: 1.6, bottom: 0.3, raise: 1.4, top: 0.3 },
  station: {
    kind: "seated",
    seatY: 0.46,
    seatZ: -0.08,
    frame: { type: "flat-bench", zHead: -0.7, zFoot: 0.42 },
    feetMode: "hanging",
    passiveJoints: ["hip", "knee"],
  },
  apparatus: {
    kind: "roller-pad",
    trackAnchors: ["toe_L", "toe_R"],
    offset: [0, 0.03, 0.01],
    forceDir: [0, -1, 0],
    width: 0.46,
    radius: 0.028,
  },
  extraGoals: (body) => [
    pin(body, "shinBack_L", () => new Vector3(0.1, 0.44, 0.28), 28, "y"),
    pin(body, "shinBack_R", () => new Vector3(-0.1, 0.44, 0.28), 28, "y"),
  ],
  stiffness: { ankle: 10, knee: 8 },
  hints: {
    start: { ...SIT, "ankle.dorsi": -34 },
    end: { ...SIT, "ankle.dorsi": 26 },
  },
  checks: () => [
    checkJointWithinAt(
      "shins-supported",
      "Knees stay softly straight on the bench",
      "Sit so the lower legs are supported and the feet hang off the bench into the tib bar.",
      "knee_L.flex",
      "peak",
      4,
      40,
    ),
    checkJointWithinAt(
      "pointed",
      "Feet start pointed",
      "Let the tib bar point the toes down to start.",
      "ankle_L.dorsi",
      "start",
      -45,
      -12,
    ),
    checkJointWithinAt(
      "pulled-up",
      "Feet finish dorsiflexed",
      "Dorsiflex both ankles, pulling the forefeet up against the tib bar.",
      "ankle_L.dorsi",
      "peak",
      -6,
      36,
    ),
    checkJointRange(
      "ankle-dorsiflexion",
      "Both ankles dorsiflex in the tib bar",
      "The lower legs stay supported while the ankles pull the loaded bar up and lower it under control.",
      "ankle_L.dorsi",
      28,
    ),
  ],
});
