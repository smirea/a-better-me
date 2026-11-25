import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { ALONG_Y, cylinder } from "../equipment";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/**
 * Hinged over a plate-loaded lever row. Pronated handles, no chest pad.
 * Standard cue: torso fixed near horizontal, elbows drive up and back.
 */
const HINGE = {
  ...POSTURE_HINTS.standing,
  "root.y": 0.86,
  "root.z": 0.0,
  "root.pitch": 56,
  "hip.flex": 74,
  "hip.abd": 8,
  "knee.flex": 26,
  "ankle.dorsi": 8,
  "lumbar.flex": 4,
  "thoracic.flex": 6,
  "neck.flex": -4,
};

const HANG = {
  "shoulder.elev": 48,
  "shoulder.plane": 74,
  "shoulder.twist": 14,
  "elbow.flex": 8,
  "forearm.pron": 74,
  "wrist.flex": 6,
  "clavicle.elev": 4,
  "clavicle.prot": 4,
};

const ROW = {
  "shoulder.elev": 36,
  "shoulder.plane": 38,
  "shoulder.twist": 12,
  "elbow.flex": 108,
  "forearm.pron": 70,
  "wrist.flex": 4,
  "clavicle.elev": 8,
  "clavicle.prot": -14,
};

export const spec = buildExerciseSpec({
  id: "bent-over-overhand-grip-plate-loaded-machine-row",
  catalogId: "3a15c6f170d88086bef0df37254b8a6d",
  name: "Bent-Over Overhand Grip Plate-Loaded Machine Row",
  defaultLoadKg: 30,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Row", "Torso", "Lower", "Hang"],
  tempo: { lower: 1.2, bottom: 0.25, raise: 1.5, top: 0.35 },
  station: { kind: "standing", stanceX: 0.18, heelZ: -0.04, toeOutDeg: 10, torsoLeanDeg: 56, balanceZ: 0.02 },
  apparatus: {
    kind: "machine-handles",
    orientation: "horizontal",
    forceDir: [0, -1, 0.2],
  },
  extraEquipment: [
    cylinder("lever.hornL", [0.42, 0.38, 0.72], 0.02, 0.22, "steel", ALONG_Y, false),
    cylinder("lever.hornR", [-0.42, 0.38, 0.72], 0.02, 0.22, "steel", ALONG_Y, false),
    cylinder("lever.plateL", [0.42, 0.22, 0.72], 0.16, 0.04, "plate", ALONG_Y, false),
    cylinder("lever.plateR", [-0.42, 0.22, 0.72], 0.16, 0.04, "plate", ALONG_Y, false),
  ],
  extraContacts: {
    handle_L: { upperarm_L: 0.1, chest: 0.12, thigh_L: 0.1, shank_L: 0.1, forearm_L: 0.08, pelvis: 0.08 },
    handle_R: { upperarm_R: 0.1, chest: 0.12, thigh_R: 0.1, shank_R: 0.1, forearm_R: 0.08, pelvis: 0.08 },
  },
  stiffness: { elbow: 2.2, shoulder: 1.1, lumbar: 8, hip: 3 },
  hints: { start: { ...HINGE, ...HANG }, end: { ...HINGE, ...ROW } },
  checks: () => [
    checkFlatBack(
      "Keep the torso in a fixed hinge, closer to horizontal than vertical, with the lower back flat and the core braced.",
    ),
    checkNeutralNeck("Keep the chest up and the neck near neutral rather than rounding through the back."),
    checkJointRange(
      "lever-row",
      "Elbows drive up and back",
      "Row the plate-loaded handles up and back toward the torso by driving the elbows up and bending them.",
      "elbow_L.flex",
      65,
    ),
    checkJointWithinAt(
      "arms-long",
      "Elbows start straight",
      "Start each rep with the elbows fully straight so the lever arms load the hang.",
      "elbow_L.flex",
      "top",
      0,
      28,
    ),
    checkJointWithinAt(
      "overhand",
      "Overhand grip",
      "Hold the lever handles with a pronated overhand grip, palms angled backward.",
      "forearm_L.pron",
      "start",
      45,
      90,
    ),
    checkJointWithinAt(
      "scapulae",
      "Shoulder blades pinch",
      "Finish by pulling the shoulder blades together, elbows level with or slightly behind the torso.",
      "clavicle_L.prot",
      "peak",
      -40,
      -4,
    ),
  ],
});
