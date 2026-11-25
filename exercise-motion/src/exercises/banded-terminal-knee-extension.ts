import { Vector3 } from "three";
import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { box } from "../equipment";
import { checkJointRange, checkJointWithinAt } from "../postures";
import { lockAngle, plantFoot, plantToe } from "../solver";

const TRUNK = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 2,
  "lumbar.flex": 2,
  "thoracic.flex": 0,
  "neck.flex": 2,
  "clavicle.elev": 4,
  "shoulder.elev": 18,
  "shoulder.plane": 28,
  "shoulder.twist": 8,
  "elbow.flex": 16,
  "forearm.pron": 30,
  "wrist.flex": 0,
};

const STRAIGHT = { "hip.flex": 4, "hip.abd": 6, "knee.flex": 6, "ankle.dorsi": 2 };
const BENT = { "hip.flex": 18, "hip.abd": 6, "knee.flex": 42, "ankle.dorsi": -28 };

export const spec = buildExerciseSpec({
  id: "banded-terminal-knee-extension",
  catalogId: "1a25c6f170d8808a85dfe5d16227644e",
  name: "Banded Terminal Knee Extension",
  defaultLoadKg: 8,
  loadUnit: "total",
  laterality: "unilateral",
  activeSide: "L",
  grip: "open",
  cameraHint: { view: "Side" },
  phaseLabels: ["Bend", "Heel up", "Extend", "Squeeze"],
  tempo: { lower: 1.2, bottom: 0.45, raise: 1.3, top: 0.7 },
  station: { kind: "cardio", machine: "none" },
  apparatus: {
    kind: "band",
    anchors: [[0.14, 0.48, 0.85]],
    targetAnchors: ["kneeBack_L"],
  },
  extraEquipment: [box("tke.post", [0.14, 0.72, 0.95], [0.08, 1.45, 0.08], "steel", false)],
  ground: "heel_R",
  extraGoals: (body) => [
    ...plantFoot(body, "R", new Vector3(-0.14, 0, 0), 0.08, 48),
    ...plantToe(body, "L", new Vector3(0.14, 0.05, 0.04), 0.06, 70),
    lockAngle(body, "knee_R.flex", 6, 18),
    lockAngle(body, "hip_R.flex", 4, 14),
  ],
  extraRequired: [
    { label: "Working forefoot planted", anchor: "ballIn_L", surfaceY: 0.05 },
    { label: "Resting heel planted", anchor: "heel_R", surfaceY: 0 },
  ],
  stiffness: { knee: 4, ankle: 3, hip: 3, lumbar: 8 },
  hints: {
    start: sidedHints("L", STRAIGHT, STRAIGHT, TRUNK),
    end: sidedHints("L", BENT, STRAIGHT, { ...TRUNK, "root.y": 0.9 }),
  },
  checks: () => [
    checkJointWithinAt(
      "start-straight",
      "Working knee starts straight",
      "Stand upright facing the anchor with the band on the back of one knee.",
      "knee_L.flex",
      "start",
      0,
      16,
    ),
    checkJointWithinAt(
      "knee-forward",
      "Working knee tracks forward",
      "Let the band pull the working knee forward as the heel lifts and the ball of the foot stays down.",
      "knee_L.flex",
      "peak",
      28,
      60,
    ),
    checkJointWithinAt(
      "other-leg-straight",
      "Resting knee stays straight",
      "Keep the other knee straight with that foot fully on the ground.",
      "knee_R.flex",
      "peak",
      0,
      16,
    ),
    checkJointRange(
      "knee-rom",
      "Knee bends and straightens against the band",
      "Let the knee come forward, then pull it back until the knee is straight and the foot is flat.",
      "knee_L.flex",
      22,
    ),
    checkJointWithinAt(
      "heel-lift",
      "Working heel lifts as the knee bends",
      "The heel comes off the ground while the ball of the foot stays down.",
      "ankle_L.dorsi",
      "peak",
      -45,
      -12,
    ),
  ],
});
