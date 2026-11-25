import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { box, hackSquatMachine } from "../equipment";
import { checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Pin-loaded standing squat: shoulder pads, weight stack behind, feet on the plate. */
const ARMS = {
  "clavicle.elev": 4,
  "shoulder.elev": 24,
  "shoulder.plane": 16,
  "elbow.flex": 42,
  "forearm.pron": 22,
  "wrist.flex": 4,
};

const UP = {
  ...POSTURE_HINTS.standing,
  "root.y": 0.94,
  "root.z": 0.02,
  "root.pitch": 4,
  "hip.flex": 16,
  "hip.abd": 8,
  "hip.rot": 6,
  "knee.flex": 14,
  "ankle.dorsi": 16,
  "lumbar.flex": 2,
  "thoracic.flex": 0,
  "neck.flex": 2,
  ...ARMS,
};

export const spec = buildExerciseSpec({
  id: "pin-loaded-machine-squat",
  catalogId: "3c85c6f170d8805b9b54ce019cd6b4e8",
  name: "Pin-Loaded Machine Squat",
  defaultLoadKg: 30,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  cameraHint: { view: "Side" },
  phaseLabels: ["Lower", "Bottom", "Drive", "Stand"],
  tempo: { lower: 1.7, bottom: 0.25, raise: 1.3, top: 0.4 },
  station: { kind: "standing", stanceX: 0.15, toeOutDeg: 10, trackKnees: 10, heelZ: 0.06 },
  apparatus: { kind: "barbell", style: "ssb", gripX: 0.34, anchor: "grip", restAnchor: "traps", skipHandRequired: true },
  extraEquipment: [
    ...hackSquatMachine({ angleDeg: 50 }).parts.map((part) => ({
      ...part,
      collide: false,
      pos: [part.pos[0], part.pos[1] - 0.16, part.pos[2] - 0.4] as [number, number, number],
    })),
    box("pinsquat.tower", [0, 0.9, -0.85], [0.42, 1.7, 0.28], "steel", false),
    box("pinsquat.stack", [0, 0.75, -0.85], [0.28, 1.2, 0.18], "plate", false),
  ],
  stiffness: { lumbar: 6, knee: 0.75, hip: 0.8 },
  hints: {
    start: UP,
    end: {
      ...UP,
      "root.y": 0.5,
      "root.z": -0.02,
      "root.pitch": 10,
      "hip.flex": 80,
      "hip.abd": 14,
      "knee.flex": 128,
      "ankle.dorsi": 32,
    },
  },
  checks: () => [
    checkFlatBack("Keep the back against the pad and the chest up while the shoulder pads ride the stack.", 12),
    checkNeutralNeck("Look forward with the neck near neutral as the pads stay on the shoulders."),
    checkFeetPlanted("Keep both feet fully on the footplate, knees tracking over the toes."),
    checkJointRange(
      "knee-rom",
      "Pin-loaded squat depth",
      "Bend the knees to at least about 90 degrees under the shoulder pads, then press back to a stand.",
      "knee_L.flex",
      70,
    ),
    checkJointWithinAt(
      "tall-torso",
      "Torso stays fairly upright",
      "A pin-loaded shoulder-pad squat lets the knees travel while the hips stay under the shoulders.",
      "hip_L.flex",
      "bottom",
      50,
      100,
    ),
    checkJointWithinAt(
      "soft-lock",
      "Stand to nearly straight knees",
      "Finish with the knees straight or slightly bent before unlocking the next rep.",
      "knee_L.flex",
      "top",
      4,
      28,
    ),
  ],
});
