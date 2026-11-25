import { Vector3 } from "three";
import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkJointRange, checkJointWithinAt } from "../postures";
import { pin } from "../solver";

/**
 * Seated single-leg dorsiflexion with the load hooked over the forefoot.
 * A kettlebell prop can only hang from the hands, so the forefoot load is a
 * narrow roller in the same place the bell's handle would sit.
 */
const SIT = {
  ...POSTURE_HINTS.seated,
  "root.y": 0.5,
  "root.pitch": -4,
  "hip.flex": 82,
  "hip.abd": 10,
  "lumbar.flex": 6,
  "thoracic.flex": 4,
  "neck.flex": 8,
  "shoulder.elev": 18,
  "shoulder.plane": 30,
  "elbow.flex": 48,
  "forearm.pron": 16,
  "wrist.flex": 4,
};

export const spec = buildExerciseSpec({
  id: "kettlebell-tib-raise",
  catalogId: "2f25c6f170d880ef9f0de24e1da83af5",
  name: "Kettlebell Tib Raise",
  defaultLoadKg: 8,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "open",
  phaseLabels: ["Pull", "Toes up", "Lower", "Pointed"],
  tempo: { lower: 1.5, bottom: 0.25, raise: 1.3, top: 0.3 },
  station: {
    kind: "seated",
    seatY: 0.46,
    seatZ: -0.02,
    frame: { type: "flat-bench", zHead: -0.55, zFoot: 0.22 },
    feetMode: "hanging",
    passiveJoints: ["hip", "knee"],
  },
  apparatus: {
    kind: "roller-pad",
    trackAnchors: ["toe_L"],
    offset: [0, 0.03, 0],
    forceDir: [0, -1, 0],
    width: 0.16,
    radius: 0.028,
  },
  extraGoals: (body) => [
    pin(body, "heel_L", () => new Vector3(0.12, 0.08, 0.48), 48),
    pin(body, "heel_R", () => new Vector3(-0.16, 0.02, 0.36), 36),
    pin(body, "ballIn_R", () => new Vector3(-0.16, 0.02, 0.5), 28),
  ],
  extraContacts: { roller: { foot_L: 0.045 } },
  stiffness: { ankle: 10, knee: 8 },
  hints: {
    start: sidedHints("L", { "ankle.dorsi": -30, "knee.flex": 80 }, { "ankle.dorsi": 4, "knee.flex": 90 }, SIT),
    end: sidedHints("L", { "ankle.dorsi": 28, "knee.flex": 80 }, { "ankle.dorsi": 4, "knee.flex": 90 }, SIT),
  },
  checks: () => [
    checkJointWithinAt(
      "toes-pointed",
      "Working foot starts pointed",
      "Sit with the kettlebell hooked over the forefoot and let the toes point down to start.",
      "ankle_L.dorsi",
      "start",
      -42,
      -8,
    ),
    checkJointWithinAt(
      "toes-up",
      "Working foot dorsiflexes",
      "Pull the toes and the ball of the foot up toward the shin against the kettlebell.",
      "ankle_L.dorsi",
      "peak",
      12,
      36,
    ),
    checkJointRange(
      "ankle-dorsiflexion",
      "Ankle dorsiflexes under the bell",
      "The load stays on the forefoot while only the working ankle moves.",
      "ankle_L.dorsi",
      24,
    ),
    checkJointWithinAt(
      "other-foot-quiet",
      "The other ankle stays still",
      "Keep the non-working foot resting on the floor.",
      "ankle_R.dorsi",
      "peak",
      -8,
      16,
    ),
  ],
});
