import { Vector3 } from "three";
import { buildExerciseSpec } from "../builders";
import { exerciseMat } from "../equipment-library";
import { checkJointRange, checkJointWithinAt } from "../postures";
import { pin } from "../solver";

/** Long sitting on the floor, knees straight, heels down, band around both forefeet. */
const SIT = {
  "root.y": 0.22,
  "root.z": -0.15,
  "root.pitch": -18,
  "hip.flex": 62,
  "hip.abd": 18,
  "hip.rot": 4,
  "knee.flex": 6,
  "lumbar.flex": 10,
  "thoracic.flex": 8,
  "neck.flex": 8,
  "shoulder.elev": 8,
  "shoulder.plane": 18,
  "elbow.flex": 8,
  "forearm.pron": 40,
  "wrist.flex": 8,
};

export const spec = buildExerciseSpec({
  id: "long-sitting-banded-ankle-eversion",
  catalogId: "20d5c6f170d8801ebfe4d558ab32f1fe",
  name: "Long Sitting Banded Ankle Eversion",
  defaultLoadKg: 4,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "open",
  phaseLabels: ["Evert", "Out", "Return", "In"],
  tempo: { lower: 1.2, bottom: 0.25, raise: 1.2, top: 0.25 },
  station: { kind: "cardio", machine: "none" },
  extraEquipment: exerciseMat(0.9, 1.6, 0.2),
  extraGoals: (body) => [
    pin(body, "pelvisBottom", () => new Vector3(0, 0.06, -0.1), 40, "y"),
    pin(body, "heel_L", () => new Vector3(0.16, 0.02, 0.55), 40),
    pin(body, "heel_R", () => new Vector3(-0.16, 0.02, 0.55), 40),
    pin(body, "palmFlat_L", () => new Vector3(0.28, 0.08, -0.02), 24),
    pin(body, "palmFlat_R", () => new Vector3(-0.28, 0.08, -0.02), 24),
  ],
  apparatus: {
    kind: "band",
    anchors: [
      [0.02, 0.08, 0.68],
      [-0.02, 0.08, 0.68],
    ],
    targetAnchors: ["ballOut_L", "ballOut_R"],
  },
  stiffness: { ankle: 6, knee: 10, hip: 6 },
  hints: {
    start: { ...SIT, "ankle.dorsi": 8, "ankle.inv": 22 },
    end: { ...SIT, "ankle.dorsi": 8, "ankle.inv": -16 },
  },
  checks: () => [
    checkJointWithinAt(
      "knees-straight",
      "Knees stay straight in long sitting",
      "Sit with the knees straight and only the heels on the ground.",
      "knee_L.flex",
      "peak",
      0,
      20,
    ),
    checkJointWithinAt(
      "inverted-start",
      "Feet start turned in",
      "Let the band rotate the feet inward so the soles angle toward the midline.",
      "ankle_L.inv",
      "start",
      8,
      32,
    ),
    checkJointWithinAt(
      "everted",
      "Feet finish turned out",
      "Rotate the feet outward against the band while the thighs stay still.",
      "ankle_L.inv",
      "peak",
      -22,
      -4,
    ),
    checkJointRange(
      "ankle-eversion",
      "Ankles evert against the band",
      "Evert through the available ankle motion, then let the band turn the feet back in.",
      "ankle_L.inv",
      18,
    ),
  ],
});
