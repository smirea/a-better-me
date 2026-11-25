import { Vector3 } from "three";
import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Pivot sits behind the lifter so the shaft runs between the legs to the handles. */
const PIVOT = new Vector3(0, 0.06, -1.55);

const GRIP = {
  "shoulder.plane": 82,
  "shoulder.twist": 16,
  "forearm.pron": 72,
  "wrist.flex": 8,
  "wrist.dev": 2,
};

const HINGE = {
  ...POSTURE_HINTS.standing,
  "root.y": 0.88,
  "root.z": 0.02,
  "root.pitch": 52,
  "hip.flex": 68,
  "hip.abd": 10,
  "knee.flex": 28,
  "ankle.dorsi": 10,
  "lumbar.flex": 6,
  "thoracic.flex": 8,
  "neck.flex": -6,
};

export const spec = buildExerciseSpec({
  id: "overhand-grip-landmine-t-bar-row",
  catalogId: "1d05c6f170d8805295d5c5c4637401f8",
  name: "Overhand Grip Landmine T-Bar Row",
  defaultLoadKg: 30,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Row", "Torso", "Lower", "Hang"],
  tempo: { lower: 1.2, bottom: 0.25, raise: 1.5, top: 0.35 },
  station: { kind: "standing", stanceX: 0.2, heelZ: -0.08, toeOutDeg: 12, torsoLeanDeg: 50, balanceZ: 0.02 },
  apparatus: { kind: "landmine", pivotZ: PIVOT.z, sides: ["L", "R"] },
  extraContacts: {
    bar: { thigh_L: 0.06, thigh_R: 0.06, shank_L: 0.05, shank_R: 0.05, pelvis: 0.05 },
  },
  hints: {
    start: {
      ...HINGE,
      ...GRIP,
      "shoulder.elev": 48,
      "elbow.flex": 10,
      "clavicle.prot": 0,
      "clavicle.elev": 6,
    },
    end: {
      ...HINGE,
      ...GRIP,
      "shoulder.elev": 34,
      "shoulder.plane": 42,
      "elbow.flex": 108,
      "clavicle.prot": -14,
      "clavicle.elev": 10,
    },
  },
  extraGoals: (body) => [
    ({ frame, push }) => {
      const left = anchorPoint(body, frame, "grip_L");
      const right = anchorPoint(body, frame, "grip_R");
      const mid = left.clone().add(right).multiplyScalar(0.5);
      push(16 * (mid.distanceTo(PIVOT) - 1.92));
      push(14 * (left.y - right.y));
      push(14 * (left.z - right.z));
      push(48 * (left.x - 0.015));
      push(48 * (right.x + 0.015));
    },
  ],
  checks: () => [
    checkFlatBack(
      "Keep your torso in a fixed hinged position, closer to horizontal than vertical, with your lower back flat and your core braced.",
    ),
    checkNeutralNeck("Keep your chest up and your neck near neutral rather than rounding through the back."),
    checkJointRange(
      "t-bar-row",
      "Elbows drive up and back",
      "Pull the bar upward and back toward your torso by driving your elbows simultaneously upward and backward.",
      "elbow_L.flex",
      65,
    ),
    checkJointWithinAt(
      "arms-long",
      "Elbows start straight",
      "Lift the bar just high enough that you feel the weight with your elbows fully straight, rather than resting the plates on the ground.",
      "elbow_L.flex",
      "start",
      0,
      30,
    ),
    checkJointWithinAt(
      "overhand",
      "Overhand grip on the handles",
      "Grasp the handles with a slightly outside shoulder-width overhand grip so your palms face backward.",
      "forearm_L.pron",
      "start",
      45,
      90,
    ),
    checkJointWithinAt(
      "scapulae",
      "Shoulder blades pinch",
      "Squeeze your shoulder blades together at the top of the pull as if you were pinching a pencil between them.",
      "clavicle_L.prot",
      "peak",
      -28,
      -4,
    ),
  ],
});
