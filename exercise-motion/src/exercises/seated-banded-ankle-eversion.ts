import { POSTURE_HINTS, buildExerciseSpec } from "../builders";
import { checkJointRange, checkJointWithinAt } from "../postures";

/** Seated on a box, knees bent, band looped around both forefeet. */
const SIT = {
  ...POSTURE_HINTS.seated,
  "root.y": 0.5,
  "lumbar.flex": 6,
  "thoracic.flex": 4,
  "neck.flex": 6,
  "shoulder.elev": 18,
  "shoulder.plane": 28,
  "elbow.flex": 28,
  "forearm.pron": 20,
};

export const spec = buildExerciseSpec({
  id: "seated-banded-ankle-eversion",
  catalogId: "1a15c6f170d88064b709d85b6c065100",
  name: "Seated Banded Ankle Eversion",
  defaultLoadKg: 4,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "open",
  phaseLabels: ["Evert", "Out", "Return", "In"],
  tempo: { lower: 1.2, bottom: 0.25, raise: 1.2, top: 0.25 },
  station: {
    kind: "seated",
    seatY: 0.46,
    frame: { type: "box", height: 0.46 },
    feetMode: "floor",
    passiveJoints: ["hip", "knee"],
  },
  extraContacts: { "seat.box": { thigh_L: 0.04, thigh_R: 0.04, pelvis: 0.03 } },
  apparatus: {
    kind: "band",
    anchors: [
      [0.34, 0.08, 0.42],
      [-0.34, 0.08, 0.42],
    ],
    targetAnchors: ["ballOut_L", "ballOut_R"],
  },
  stiffness: { ankle: 6, knee: 8, hip: 6 },
  hints: {
    start: { ...SIT, "ankle.dorsi": 8, "ankle.inv": 22 },
    end: { ...SIT, "ankle.dorsi": 8, "ankle.inv": -16 },
  },
  checks: () => [
    checkJointWithinAt(
      "knees-bent",
      "Knees stay bent over the feet",
      "Sit tall with the knees bent so the feet rest on the floor.",
      "knee_L.flex",
      "peak",
      60,
      120,
    ),
    checkJointWithinAt(
      "inverted-start",
      "Feet start turned in",
      "Let the band turn the feet inward so the soles angle toward the midline.",
      "ankle_L.inv",
      "start",
      8,
      32,
    ),
    checkJointWithinAt(
      "everted",
      "Feet finish turned out",
      "Rotate the feet outward against the band. Keep the kneecaps still.",
      "ankle_L.inv",
      "peak",
      -22,
      -4,
    ),
    checkJointRange(
      "ankle-eversion",
      "Ankles evert against the band",
      "Evert through the available range, then let the band return the feet inward.",
      "ankle_L.inv",
      18,
    ),
  ],
});
