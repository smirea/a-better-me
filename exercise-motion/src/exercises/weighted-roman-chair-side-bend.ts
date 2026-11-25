import { Vector3 } from "three";
import { buildExerciseSpec, sidedHints } from "../builders";
import { checkJointRange, checkJointWithinAt } from "../postures";
import { pin } from "../solver";

const BASE = {
  "root.y": 0.98,
  "root.z": 0.2,
  "root.pitch": 6,
  "hip.flex": 16,
  "hip.abd": 6,
  "knee.flex": 6,
  "ankle.dorsi": 8,
  "lumbar.flex": 2,
  "thoracic.flex": 2,
  "neck.flex": 0,
  "lumbar.twist": 0,
  "thoracic.twist": 0,
};

const LOADED = {
  "shoulder.elev": 28,
  "shoulder.plane": 48,
  "shoulder.twist": 4,
  "elbow.flex": 8,
  "forearm.pron": 8,
  "wrist.flex": 0,
};

const FREE = {
  "shoulder.elev": 40,
  "shoulder.plane": 70,
  "elbow.flex": 100,
  "forearm.pron": 16,
};

export const spec = buildExerciseSpec({
  id: "weighted-roman-chair-side-bend",
  catalogId: "30c5c6f170d880cda373da8c97aa7074",
  name: "Weighted Roman Chair Side Bend",
  defaultLoadKg: 6,
  loadUnit: "total",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  phaseLabels: ["Lower", "Stretch", "Lift", "Upright"],
  tempo: { lower: 1.8, bottom: 0.25, raise: 1.5, top: 0.3 },
  station: { kind: "roman-chair", padY: 0.9 },
  apparatus: { kind: "dumbbells", sides: ["L"] },
  extraGoals: (body) => [pin(body, "pelvisFront", () => new Vector3(0, 0.9, 0.04), 70)],
  stiffness: { elbow: 8, knee: 8, hip: 8, lumbar: 4, thoracic: 4 },
  hints: {
    start: sidedHints("L", LOADED, FREE, { ...BASE, "lumbar.bend": 0, "thoracic.bend": 0 }),
    end: sidedHints("L", LOADED, FREE, { ...BASE, "lumbar.bend": 20, "thoracic.bend": 18 }),
  },
  checks: () => [
    checkJointRange(
      "side-bend",
      "Torso bends sideways with the weight",
      "Hold the weight with the arm toward the ground and bend the torso sideways through a comfortable range.",
      "lumbar.bend",
      12,
    ),
    checkJointRange(
      "ribs",
      "Ribs move away from the hip",
      "On the side farther from the ground, the ribs move away from the hip bone as you lower.",
      "thoracic.bend",
      10,
    ),
    checkJointWithinAt(
      "arm-hangs",
      "Loaded arm hangs toward the floor",
      "Keep the elbow nearly straight so the weight hangs toward the ground.",
      "elbow_L.flex",
      "bottom",
      0,
      22,
    ),
    checkJointWithinAt(
      "no-twist",
      "Torso does not twist",
      "Bend only to the side. Do not twist, round, or arch the lower back.",
      "thoracic.twist",
      "bottom",
      -10,
      10,
    ),
  ],
});
