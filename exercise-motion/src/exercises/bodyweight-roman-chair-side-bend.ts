import { Vector3 } from "three";
import { buildExerciseSpec } from "../builders";
import { checkJointRange, checkJointWithinAt } from "../postures";
import { pin } from "../solver";

const ARMS = {
  "shoulder.elev": 46,
  "shoulder.plane": 72,
  "shoulder.twist": 16,
  "elbow.flex": 110,
  "forearm.pron": 20,
  "wrist.flex": 4,
};

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
  ...ARMS,
};

export const spec = buildExerciseSpec({
  id: "bodyweight-roman-chair-side-bend",
  catalogId: "30c5c6f170d8801aaa48d5ae7033f414",
  name: "Bodyweight Roman Chair Side Bend",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "unilateral",
  activeSide: "L",
  grip: "open",
  phaseLabels: ["Lower", "Stretch", "Lift", "Upright"],
  tempo: { lower: 1.8, bottom: 0.25, raise: 1.4, top: 0.35 },
  station: { kind: "roman-chair", padY: 0.9 },
  apparatus: { kind: "none" },
  extraGoals: (body) => [pin(body, "pelvisFront", () => new Vector3(0, 0.9, 0.04), 70)],
  stiffness: { knee: 8, hip: 8, lumbar: 4, thoracic: 4 },
  hints: {
    start: { ...BASE, "lumbar.bend": 0, "thoracic.bend": 0 },
    end: { ...BASE, "lumbar.bend": 20, "thoracic.bend": 18 },
  },
  checks: () => [
    checkJointRange(
      "side-bend",
      "Torso bends sideways toward the floor",
      "Bend the torso sideways toward the ground through a comfortable full range, then lift back up.",
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
      "no-twist",
      "Torso does not twist",
      "If the chest's laser beam angles up or down, you are twisting. Bend only to the side.",
      "thoracic.twist",
      "bottom",
      -10,
      10,
    ),
    checkJointWithinAt(
      "legs-straight",
      "Knees stay straight",
      "Keep the legs and hips stationary on the pads with the knees straight.",
      "knee_L.flex",
      "bottom",
      0,
      20,
    ),
  ],
});
