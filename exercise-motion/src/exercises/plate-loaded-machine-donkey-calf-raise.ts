import { Vector3 } from "three";
import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { platformBox } from "../equipment";
import { checkAnchorTravel, checkJointRange, checkJointWithinAt } from "../postures";
import { pin } from "../solver";

const HINGE = {
  ...POSTURE_HINTS.standing,
  "root.y": 0.9,
  "root.z": -0.02,
  "root.pitch": 62,
  "hip.flex": 50,
  "hip.abd": 6,
  "knee.flex": 10,
  "lumbar.flex": 10,
  "thoracic.flex": 14,
  "neck.flex": -6,
  "shoulder.elev": 88,
  "shoulder.plane": 82,
  "elbow.flex": 96,
  "forearm.pron": 55,
  "wrist.flex": 0,
};

export const spec = buildExerciseSpec({
  id: "plate-loaded-machine-donkey-calf-raise",
  catalogId: "1ac5c6f170d880879ea9c5c546d4d270",
  name: "Plate-Loaded Machine Donkey Calf Raise",
  defaultLoadKg: 55,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Raise", "Peak", "Lower", "Stretch"],
  tempo: { lower: 1.4, bottom: 0.3, raise: 1.7, top: 0.35 },
  station: { kind: "calf-station", mode: "standing", stanceX: 0.12, blockY: 0.18 },
  apparatus: {
    kind: "roller-pad",
    trackAnchors: ["sacrum"],
    offset: [0, 0.04, 0.01],
    forceDir: [0, -1, 0],
    width: 0.32,
    radius: 0.045,
  },
  stiffness: { ankle: 14, knee: 8, hip: 4 },
  extraContacts: {
    "calf.block": { foot_L: 0.018, foot_R: 0.018 },
    "donkey.armPad": { hand_L: 0.06, hand_R: 0.06, forearm_L: 0.05, forearm_R: 0.05 },
  },
  extraEquipment: platformBox("donkey.armPad", [0, 0, 0.55], 0.62, 0.84, 0.22, "pad"),
  extraGoals: (body) => [
    pin(body, "grip_L", () => new Vector3(0.2, 0.9, 0.58), 12),
    pin(body, "grip_R", () => new Vector3(-0.2, 0.9, 0.58), 12),
  ],
  progress: (body, frame) => anchorPoint(body, frame, "heel_L").y,
  hints: {
    start: { ...HINGE, "ankle.dorsi": 18 },
    end: { ...HINGE, "root.y": 0.98, "ankle.dorsi": -24 },
  },
  checks: () => [
    checkJointRange(
      "ankle-rom",
      "Heels rise under the hip pad",
      "Raise your heels into the air through the available range of motion of your ankles.",
      "ankle_L.dorsi",
      28,
    ),
    checkJointWithinAt(
      "knees-straight",
      "Knees stay extended",
      "Maintain your knees in a position of extension or a slight bend with the front halves of your feet on the foot plate throughout the set.",
      "knee_L.flex",
      "peak",
      4,
      18,
    ),
    checkJointWithinAt(
      "hinge",
      "Torso stays hinged forward",
      "With your knees mildly bent and your torso flexed forward at your hips while facing toward the handles, position the front halves of your feet onto the foot plate.",
      "hip_L.flex",
      "start",
      35,
      80,
    ),
    checkJointWithinAt(
      "stretch",
      "Heels drop into a calf stretch",
      "Strive to lower your heels as far as you can, and you will likely feel a stretching sensation in your calf at the bottom position.",
      "ankle_L.dorsi",
      "start",
      8,
      26,
    ),
    checkAnchorTravel(
      "heel-rise",
      "Heels rise",
      "Raise your heels into the air through the available range of motion of your ankles.",
      "heel_L",
      "y",
      0.04,
    ),
  ],
});
