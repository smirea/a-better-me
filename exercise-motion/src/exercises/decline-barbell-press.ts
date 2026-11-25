import { Vector3 } from "three";
import { buildExerciseSpec } from "../builders";
import { checkAnchorTravel, checkJointRange, checkJointWithinAt } from "../postures";
import { pin } from "../solver";

const TRUNK = {
  "root.y": 0.58,
  "root.z": 0.08,
  "root.pitch": -96,
  "lumbar.flex": -4,
  "thoracic.flex": -2,
  "neck.flex": 4,
  "hip.flex": 18,
  "hip.abd": 8,
  "hip.rot": 4,
  "knee.flex": 100,
  "ankle.dorsi": 8,
  "clavicle.prot": -16,
  "clavicle.elev": 0,
};

const ARMS_TOP = {
  "shoulder.elev": 96,
  "shoulder.plane": 68,
  "shoulder.twist": 30,
  "elbow.flex": 8,
  "forearm.pron": 28,
  "wrist.flex": -6,
};

const ARMS_BOTTOM = {
  "shoulder.elev": 52,
  "shoulder.plane": 4,
  "shoulder.twist": 12,
  "elbow.flex": 108,
  "forearm.pron": 36,
  "wrist.flex": -8,
};

export const spec = buildExerciseSpec({
  id: "decline-barbell-press",
  catalogId: "1a05c6f170d880c09936def7e47899b1",
  name: "Decline Barbell Press",
  defaultLoadKg: 40,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Press", "Lockout", "Lower", "Lower chest"],
  tempo: { lower: 2, bottom: 0.25, raise: 1.2, top: 0.5 },
  station: {
    kind: "lying",
    surface: "adjustable-bench",
    face: "up",
    backAngleDeg: -15,
    ankleRollers: true,
    feetOnFloor: false,
    rack: {},
  },
  apparatus: {
    kind: "barbell",
    gripX: 0.34,
    anchor: "press",
    path: { startY: 1.02, startZ: -0.42, endY: 0.62, endZ: -0.22, arcBulgeZ: 0.04 },
  },
  hints: {
    start: { ...TRUNK, ...ARMS_TOP },
    end: { ...TRUNK, ...ARMS_BOTTOM },
  },
  stiffness: { shoulder: 0.7, elbow: 4, hip: 2, knee: 2, lumbar: 8, thoracic: 6, neck: 4, clavicle: 3.5 },
  extraGoals: (body) => [
    pin(body, "ankle_L", () => new Vector3(0.13, 0.34, 0.48), 26),
    pin(body, "ankle_R", () => new Vector3(-0.13, 0.34, 0.48), 26),
  ],
  checks: () => [
    checkJointWithinAt(
      "elbows-locked",
      "Elbows locked out",
      "Finish with the elbows straight and the bar over the shoulders.",
      "elbow_L.flex",
      "start",
      0,
      22,
    ),
    checkJointWithinAt(
      "lower-chest",
      "Bar meets the lower chest",
      "Lower the bar to the lower chest or lower breastbone.",
      "elbow_L.flex",
      "peak",
      85,
      130,
    ),
    checkJointRange(
      "shoulder-rom",
      "Shoulders press on the decline",
      "The decline press still moves the shoulders through a full press arc.",
      "shoulder_L.elev",
      20,
    ),
    checkAnchorTravel(
      "bar-rises",
      "Bar travels up",
      "Press the bar up from the lower chest.",
      "press_L",
      "y",
      0.2,
    ),
  ],
});
