import { Vector3 } from "three";
import { anchorPoint } from "../body";
import { buildExerciseSpec, sidedHints } from "../builders";
import { checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { pin } from "../solver";

const TRUNK = {
  "root.y": 0.56,
  "root.z": -0.32,
  "root.pitch": -4,
  "lumbar.flex": 6,
  "thoracic.flex": 4,
  "neck.flex": 12,
  "clavicle.elev": 4,
  "shoulder.elev": 28,
  "shoulder.plane": 62,
  "shoulder.twist": 8,
  "elbow.flex": 88,
  "forearm.pron": 20,
  "wrist.flex": 10,
};

const active = (ankle: number, knee: number) => ({
  "hip.flex": 86,
  "hip.abd": 6,
  "knee.flex": knee,
  "ankle.dorsi": ankle,
});

const rest = {
  "hip.flex": 78,
  "hip.abd": 22,
  "knee.flex": 88,
  "ankle.dorsi": 0,
};

export const spec = buildExerciseSpec({
  id: "seated-single-leg-pin-loaded-machine-calf-raise",
  catalogId: "25d5c6f170d8801a981fed5219ddbb4e",
  name: "Seated Single Leg Pin-Loaded Machine Calf Raise",
  defaultLoadKg: 22,
  loadUnit: "total",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  cameraHint: { view: "Side" },
  phaseLabels: ["Raise", "Top", "Lower", "Stretch"],
  tempo: { lower: 2.0, bottom: 0.35, raise: 1.5, top: 0.35 },
  station: { kind: "calf-station", mode: "seated", seatY: 0.48, singleFoot: "L", stanceX: 0.1 },
  apparatus: {
    kind: "roller-pad",
    trackAnchors: ["kneeFront_L"],
    offset: [0, 0.05, 0],
    forceDir: [0, -1, 0],
    width: 0.28,
  },
  hints: {
    start: sidedHints("L", active(22, 104), rest, TRUNK),
    end: sidedHints("L", active(-34, 82), rest, TRUNK),
  },
  progress: (body, frame) => anchorPoint(body, frame, "heel_L").y,
  extraGoals: (body) => [
    pin(body, "ballIn_R", () => new Vector3(-0.42, 0.02, -0.15), 36),
    pin(body, "heel_R", () => new Vector3(-0.42, 0.02, -0.28), 28),
  ],
  stiffness: { knee: 1.2, hip: 2.2, ankle: 6 },
  checks: () => [
    checkNeutralNeck("Keep the head quiet while the working thigh sits under the pad."),
    checkJointWithinAt(
      "knee-bent",
      "Working knee stays bent",
      "Leave the working knee bent under the pad and the other foot on the floor.",
      "knee_L.flex",
      "peak",
      75,
      110,
    ),
    checkJointRange(
      "ankle-rom",
      "Working heel rises through the ankle",
      "Lower the working heel below the ball of the foot, then push it up above the forefoot.",
      "ankle_L.dorsi",
      32,
    ),
    checkJointWithinAt(
      "stretch",
      "Working heel stretches the soleus",
      "Drop the heel as far as mobility allows before you press back up.",
      "ankle_L.dorsi",
      "start",
      6,
      34,
    ),
    checkJointWithinAt(
      "top",
      "Working heel finishes high",
      "At the top the heel is higher than the ball of the foot.",
      "ankle_L.dorsi",
      "peak",
      -42,
      -16,
    ),
  ],
});
